"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useXO } from "@/context/XOProvider";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface Certificate {
  id: string;
  pdf_url: string;
  nft_token_id: string | null;
  tx_hash: string | null;
  chain: string;
  verified?: boolean;
  created_at: string;
}

function subscribe() {
  return () => {};
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getFilenameFromUrl(url: string) {
  try {
    const parts = new URL(url).pathname.split("/");
    const raw = parts[parts.length - 1];
    const match = raw.match(/^\d+_(.+)$/);
    return match ? decodeURIComponent(match[1]) : decodeURIComponent(raw);
  } catch {
    return "certificado.pdf";
  }
}

// ═══════════════════════════════════════
// Caché de NFTs verificados (localStorage)
// ═══════════════════════════════════════
const CACHE_KEY = "verux_minted_nfts";

function getCachedMints(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setCachedMint(certId: string, tokenId: string) {
  if (typeof window === "undefined") return;
  const cache = getCachedMints();
  cache[certId] = tokenId;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

// Sonido mágico usando Web Audio API
function playMintSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    const playNote = (freq: number, startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

      gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + 0.7);
    };

    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      playNote(freq, i * 0.08);
    });
  } catch (e) {
    console.error("Audio Context no soportado", e);
  }
}

export default function CertificatesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { address, isConnected } = useXO();
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const [studentId, setStudentId] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [certsLoading, setCertsLoading] = useState(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [successTxHash, setSuccessTxHash] = useState("");

  const [isMintingMock, setIsMintingMock] = useState<string | null>(null);
  const [newlyMintedToken, setNewlyMintedToken] = useState<string | null>(null);

  // ═══════════════════════════════════════
  // Hydrate cached mints into certificates
  // ═══════════════════════════════════════
  const hydrateCachedMints = useCallback((certs: Certificate[]): Certificate[] => {
    const cache = getCachedMints();
    return certs.map((c) => {
      if (!c.verified && !c.nft_token_id && cache[c.id]) {
        return { ...c, verified: true, nft_token_id: cache[c.id] };
      }
      return c;
    });
  }, []);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  // Fetch student ID and certificates
  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      setCertsLoading(true);

      const { data: studentData } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      if (!studentData) {
        setCertsLoading(false);
        return;
      }

      setStudentId(studentData.id);

      const { data: certsData } = await supabase
        .from("certificates")
        .select("id, pdf_url, nft_token_id, tx_hash, chain, verified, created_at")
        .eq("student_id", studentData.id)
        .order("created_at", { ascending: false });

      setCertificates(hydrateCachedMints((certsData as Certificate[]) ?? []));
      setCertsLoading(false);
    }

    fetchData();
  }, [user, supabase, hydrateCachedMints]);

  async function handleDelete(cert: Certificate) {
    if (!confirm("¿Seguro que querés eliminar este certificado?")) return;
    setDeletingId(cert.id);

    try {
      const url = new URL(cert.pdf_url);
      const parts = url.pathname.split("/object/public/certificates/");
      const storagePath = parts[1];
      if (storagePath) {
        await supabase.storage.from("certificates").remove([storagePath]);
      }
    } catch { /* si falla el borrado de storage igual borramos el registro */ }

    await supabase.from("certificates").delete().eq("id", cert.id);
    setCertificates((prev) => prev.filter((c) => c.id !== cert.id));
    setDeletingId(null);
  }

  async function handleMintNFT(certId: string) {
    setIsMintingMock(certId);

    // Simular acuñación
    await new Promise(resolve => setTimeout(resolve, 1500));

    const nftTokenId = `verus-nft-${certId}`;
    const { error } = await supabase
      .from("certificates")
      .update({ verified: true, nft_token_id: nftTokenId })
      .eq("id", certId);

    setIsMintingMock(null);

    if (!error) {
      // Guardar en caché local para persistencia
      setCachedMint(certId, nftTokenId);

      setCertificates((prev) =>
        prev.map((c) => c.id === certId ? { ...c, verified: true, nft_token_id: nftTokenId } : c)
      );
      setNewlyMintedToken(nftTokenId);
      playMintSound();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadError("");
    setSuccessTxHash("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedFile) {
      setUploadError("Seleccioná un archivo PDF.");
      return;
    }
    if (!studentId) {
      setUploadError("No se encontró perfil de estudiante.");
      return;
    }
    if (!address) {
      setUploadError("Conectá tu wallet antes de subir un certificado.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setSuccessTxHash("");

    try {
      const storagePath = `${studentId}/${Date.now()}_${selectedFile.name}`;
      const { error: storageError } = await supabase.storage
        .from("certificates")
        .upload(storagePath, selectedFile, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (storageError) {
        throw new Error(`Error al subir el archivo: ${storageError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from("certificates")
        .getPublicUrl(storagePath);

      const pdfUrl = publicUrlData.publicUrl;

      const response = await fetch("/api/certificates/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          pdfUrl,
          walletAddress: address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error ?? `Error al acuñar: ${response.statusText}`);
      }

      const result = await response.json();
      const txHash: string = result?.txHash ?? result?.tx_hash ?? "";

      setSuccessTxHash(txHash);

      const { data: certsData } = await supabase
        .from("certificates")
        .select("id, pdf_url, nft_token_id, tx_hash, chain, verified, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

      setCertificates(hydrateCachedMints((certsData as Certificate[]) ?? []));

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setUploading(false);
    }
  }

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-low">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-16 space-y-12">

        {/* ═══════════════════════════════════════
            Header
            ═══════════════════════════════════════ */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight font-[family-name:var(--font-plus-jakarta)]">
              Carga de Certificados
            </h1>
            <p className="text-secondary text-sm mt-1">
              Arrastrá tus documentos académicos para transformarlos en activos digitales.
            </p>
          </div>
          <Link
            href="/student/dashboard"
            className="text-primary font-bold text-sm flex items-center gap-1 hover:underline font-[family-name:var(--font-plus-jakarta)] uppercase tracking-widest"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Volver al panel
          </Link>
        </div>

        {/* ═══════════════════════════════════════
            Upload Zone
            ═══════════════════════════════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload area */}
          <div className="bg-surface-container-lowest p-4 sm:p-8 rounded-3xl shadow-ambient space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold font-[family-name:var(--font-plus-jakarta)]">Subir Certificado</h2>
              <p className="text-sm text-secondary">El PDF se almacena y se acuña como NFT automáticamente</p>
            </div>

            {/* Wallet gate */}
            {mounted && !isConnected ? (
              <div className="bg-surface-container-high/50 p-5 rounded-2xl flex items-start gap-4">
                <span className="material-symbols-outlined text-primary">warning</span>
                <div>
                  <p className="text-sm font-bold text-on-surface">Wallet no conectada</p>
                  <p className="text-sm text-secondary mt-0.5">
                    Para subir y acuñar certificados, primero conectá tu wallet desde el{" "}
                    <Link href="/student/dashboard" className="underline text-primary font-medium">
                      panel principal
                    </Link>.
                  </p>
                </div>
              </div>
            ) : !mounted ? (
              <div className="h-12 bg-surface-container-high rounded-2xl animate-pulse" />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Drop zone */}
                <div
                  className="border-2 border-dashed border-outline-variant/40 bg-white/50 rounded-2xl p-6 sm:p-10 flex flex-col items-center justify-center gap-4 group cursor-pointer hover:bg-white hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-3xl">upload_file</span>
                  </div>
                  <div className="text-center">
                    {selectedFile ? (
                      <p className="font-bold text-on-surface">{selectedFile.name}</p>
                    ) : (
                      <>
                        <p className="font-bold text-on-surface">Hacé clic para subir o arrastrá un archivo</p>
                        <p className="text-xs text-secondary mt-1">PDF, PNG o JPG (Max. 10MB)</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </div>

                {/* Error */}
                {uploadError && (
                  <div className="flex items-start gap-3 bg-error/10 rounded-2xl px-5 py-4">
                    <span className="material-symbols-outlined text-error text-sm mt-0.5">error</span>
                    <p className="text-sm text-error">{uploadError}</p>
                  </div>
                )}

                {/* Success */}
                {successTxHash && (
                  <div className="flex items-start gap-3 bg-green-50 rounded-2xl px-5 py-4">
                    <span className="material-symbols-outlined text-green-600 text-sm mt-0.5" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                    <div>
                      <p className="text-sm font-bold text-green-800">¡Certificado acuñado exitosamente!</p>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${successTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-green-700 underline mt-1"
                      >
                        Ver en Etherscan
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                      </a>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!selectedFile || uploading}
                  className="brand-gradient text-white px-8 py-3 rounded-full font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition-all font-[family-name:var(--font-plus-jakarta)] uppercase tracking-widest disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                  {uploading ? "Procesando…" : "Subir y acuñar NFT"}
                </button>
              </form>
            )}
          </div>

          {/* Validation States column */}
          <div className="flex flex-col gap-4">
            {/* Uploading state (only shows during upload) */}
            {uploading && (
              <div className="bg-surface-container-lowest p-6 rounded-2xl flex items-center gap-6 shadow-ambient">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <div className="absolute inset-0 border-2 border-primary/20 rounded-full" />
                  <div className="absolute inset-0 border-t-2 border-primary rounded-full animate-spin" />
                  <span className="material-symbols-outlined text-primary">data_object</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-on-surface">Validando Certificado...</p>
                  <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-primary h-full w-2/3 animate-pulse" />
                  </div>
                </div>
                <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Procesando</span>
              </div>
            )}

            {/* Already verified certs – show success state */}
            {certificates.filter(c => c.verified || c.nft_token_id).slice(0, 3).map((cert) => (
              <div
                key={cert.id}
                className="bg-surface-container-lowest p-4 sm:p-6 rounded-2xl border-2 border-secondary-container/30 flex items-center gap-6 shadow-[0_10px_30px_rgba(231,199,240,0.2)]"
              >
                <div className="brand-gradient w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md shrink-0">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>verified_user</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-on-surface">Insignia Verificada</p>
                  <p className="text-xs text-secondary truncate">{getFilenameFromUrl(cert.pdf_url)}</p>
                </div>
                {cert.tx_hash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${cert.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-surface-container-high px-4 py-2 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-primary hover:bg-primary hover:text-white transition-colors shrink-0"
                  >
                    Ver NFT
                  </a>
                )}
              </div>
            ))}

            {/* Empty state */}
            {!uploading && certificates.filter(c => c.verified || c.nft_token_id).length === 0 && (
              <div className="bg-surface-container-lowest/50 p-6 sm:p-10 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-4xl text-outline-variant/30 mb-3">diamond</span>
                <p className="text-sm text-secondary">Tus insignias verificadas aparecerán aquí</p>
              </div>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════
            Certificates List
            ═══════════════════════════════════════ */}
        <section className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold font-[family-name:var(--font-plus-jakarta)]">
              Todos los Certificados
            </h2>
            <div className="flex bg-surface-container-low p-1 rounded-full text-xs font-bold uppercase tracking-widest">
              <span className="px-4 py-2 bg-white rounded-full text-on-background shadow-sm">
                {certificates.length} total
              </span>
            </div>
          </div>

          {certsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-24 bg-surface-container-lowest rounded-3xl animate-pulse"
                />
              ))}
            </div>
          ) : certificates.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-3xl shadow-ambient p-6 sm:p-10 text-center">
              <span className="material-symbols-outlined text-5xl text-outline-variant/20 mb-3">school</span>
              <p className="text-secondary text-sm">Todavía no tenés certificados.</p>
              <p className="text-outline-variant text-xs mt-1">Subí tu primer PDF para acuñarlo como NFT.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="bg-surface-container-lowest p-4 sm:p-6 rounded-3xl shadow-ambient hover:translate-y-[-4px] transition-transform duration-300 flex flex-col"
                >
                  {/* Top row */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface">
                      <span className="material-symbols-outlined">description</span>
                    </div>
                    {cert.verified || cert.nft_token_id ? (
                      <span className="material-symbols-outlined text-green-500" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                    ) : (
                      <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2 py-1 rounded-full uppercase">
                        Pendiente
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h4 className="font-bold text-base leading-tight text-on-background mb-1 truncate">
                    {getFilenameFromUrl(cert.pdf_url)}
                  </h4>
                  <p className="text-xs text-secondary mb-4">{formatDate(cert.created_at)}</p>

                  {/* Token ID */}
                  {cert.nft_token_id && (
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-4 truncate">
                      Token: #{cert.nft_token_id}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="mt-auto flex items-center gap-2 flex-wrap pt-4 border-t border-outline-variant/10">
                    <a
                      href={cert.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-surface-container-high px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-on-surface hover:bg-surface-container-highest transition-colors"
                    >
                      Ver PDF
                    </a>

                    {cert.tx_hash && (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${cert.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-surface-container-high px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-primary hover:bg-primary hover:text-white transition-colors"
                      >
                        Etherscan
                      </a>
                    )}

                    <span className="px-3 py-1.5 rounded-full bg-surface-container text-[10px] font-bold text-secondary uppercase tracking-widest">
                      {cert.chain ?? "sepolia"}
                    </span>

                    {!(cert.verified || cert.nft_token_id) ? (
                      <button
                        onClick={() => handleMintNFT(cert.id)}
                        disabled={isMintingMock === cert.id}
                        className="brand-gradient text-white px-4 py-2 rounded-full text-[10px] font-extrabold uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {isMintingMock === cert.id ? "Acuñando..." : "🏅 Recibir NFT"}
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-extrabold uppercase tracking-widest">
                        🏅 Verificado
                      </span>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(cert)}
                    disabled={deletingId === cert.id}
                    className="mt-3 text-xs text-secondary hover:text-error transition-colors font-bold uppercase tracking-widest flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    {deletingId === cert.id ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* ═══════════════════════════════════════
          🎉 Animación de Token Generado 🎉
          ═══════════════════════════════════════ */}
      <AnimatePresence>
        {newlyMintedToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-background/40 backdrop-blur-md"
            style={{ perspective: 1000 }}
          >
            {/* Confetti Particles */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {[...Array(30)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: [1, 1, 0],
                    scale: [0, Math.random() * 1.5 + 0.5, 0.5],
                    x: (Math.random() - 0.5) * 600,
                    y: (Math.random() - 0.5) * 600 + (Math.random() > 0.5 ? 100 : -100),
                  }}
                  transition={{ duration: 1.5 + Math.random(), ease: "easeOut" }}
                  className="absolute w-3 h-3 rounded-full"
                  style={{ backgroundColor: ['#E7C7F0', '#EDB3C2', '#F68D78', '#EE8572', '#AD9DC4'][Math.floor(Math.random() * 5)] }}
                />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0.3, rotateX: 45, opacity: 0 }}
              animate={{ scale: 1, rotateX: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 50, opacity: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 200 }}
              className="relative w-full max-w-md bg-surface-container-lowest/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center"
            >
              {/* Rotating light effect */}
              <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0,transparent_30deg,rgba(246,141,120,0.1)_90deg,transparent_150deg,rgba(231,199,240,0.1)_210deg,transparent_270deg)] pointer-events-none"
                />
              </div>

              {/* Close button */}
              <button
                onClick={() => setNewlyMintedToken(null)}
                className="absolute top-5 right-5 p-2 bg-surface-container-high hover:bg-surface-container-highest text-secondary rounded-full transition-colors z-20"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>

              {/* 3D Coin */}
              <motion.div
                initial={{ scale: 0, y: 100 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", delay: 0.1, damping: 12, mass: 1 }}
                className="relative mx-auto w-40 h-40 flex items-center justify-center mb-8 mt-4 z-10"
                style={{ transformStyle: "preserve-3d" }}
              >
                <motion.div
                  animate={{ rotateY: 360, y: [0, -15, 0] }}
                  transition={{
                    rotateY: { duration: 5, repeat: Infinity, ease: "linear" },
                    y: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="relative w-32 h-32 brand-gradient rounded-full flex items-center justify-center shadow-[0_20px_50px_rgba(246,141,120,0.6)] border-[6px] border-white/40"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <div className="absolute inset-2 border-[4px] border-white/20 rounded-full" />
                  <span className="material-symbols-outlined text-white text-5xl" style={{ fontVariationSettings: '"FILL" 1' }}>workspace_premium</span>
                </motion.div>

                {/* Floor shadow */}
                <motion.div
                  animate={{ scale: [1, 0.8, 1], opacity: [0.3, 0.1, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -bottom-8 w-24 h-4 bg-on-background/10 rounded-full blur-md"
                />
              </motion.div>

              <motion.h3
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-extrabold mb-2 relative z-10 brand-gradient-text font-[family-name:var(--font-plus-jakarta)]"
              >
                ¡NFT Acuñado!
              </motion.h3>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-secondary mb-6 font-medium relative z-10 text-sm"
              >
                Tu certificado ahora es un activo digital único, asegurado en la blockchain de Verus.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="bg-surface-container-low rounded-2xl p-4 break-all relative z-10"
              >
                <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] mb-2">
                  Hash / Token ID
                </p>
                <p className="text-sm font-mono text-primary font-semibold bg-primary/10 p-2 rounded-xl">
                  #{newlyMintedToken}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-8 relative z-10"
              >
                <button
                  onClick={() => setNewlyMintedToken(null)}
                  className="w-full brand-gradient text-white py-4 rounded-full font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all font-[family-name:var(--font-plus-jakarta)] uppercase tracking-widest"
                >
                  Continuar
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
