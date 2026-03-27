"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useXO } from "@/context/XOProvider";
import { Award, Upload, FileText, ExternalLink, AlertCircle, CheckCircle2, Wallet } from "lucide-react";
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
    // Remove the student-id prefix subfolder segment, keep the timestamped filename
    const raw = parts[parts.length - 1];
    // Strip leading timestamp_  e.g. "1711234567890_MiCert.pdf" → "MiCert.pdf"
    const match = raw.match(/^\d+_(.+)$/);
    return match ? decodeURIComponent(match[1]) : decodeURIComponent(raw);
  } catch {
    return "certificado.pdf";
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [successTxHash, setSuccessTxHash] = useState("");

  // Redirect if not authenticated
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

      setCertificates((certsData as Certificate[]) ?? []);
      setCertsLoading(false);
    }

    fetchData();
  }, [user, supabase]);

  async function handleMintNFT(certId: string) {
    const nftTokenId = `verus-nft-${certId}`;
    const { error } = await supabase
      .from("certificates")
      .update({ verified: true, nft_token_id: nftTokenId })
      .eq("id", certId);

    if (!error) {
      setCertificates((prev) =>
        prev.map((c) => c.id === certId ? { ...c, verified: true, nft_token_id: nftTokenId } : c)
      );
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
      // 1. Upload PDF to Supabase Storage
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

      // 2. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("certificates")
        .getPublicUrl(storagePath);

      const pdfUrl = publicUrlData.publicUrl;

      // 3. Call mint API
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

      // 4. Reload certificate list
      const { data: certsData } = await supabase
        .from("certificates")
        .select("id, pdf_url, nft_token_id, tx_hash, chain, verified, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

      setCertificates((certsData as Certificate[]) ?? []);

      // Reset form
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Mis certificados</h1>
            <p className="text-slate-500 mt-1">Subí PDFs y acuñalos como NFTs en la red Sepolia</p>
          </div>
          <Link href="/student/dashboard" className="text-sm font-medium text-blue-600 hover:underline">
            ← Volver al panel
          </Link>
        </div>

        {/* Upload form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Subir nuevo certificado</h2>
              <p className="text-sm text-slate-500">El PDF se almacena y se acuña como NFT automáticamente</p>
            </div>
          </div>

          {/* Wallet gate */}
          {mounted && !isConnected ? (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <Wallet className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Wallet no conectada</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Para subir y acuñar certificados, primero conectá tu wallet desde el{" "}
                  <Link href="/student/dashboard" className="underline font-medium">
                    panel principal
                  </Link>
                  .
                </p>
              </div>
            </div>
          ) : !mounted ? (
            <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* File input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Archivo PDF
                </label>
                <div
                  className="relative flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileText className="h-8 w-8 text-slate-300" />
                  {selectedFile ? (
                    <p className="text-sm font-medium text-slate-700">{selectedFile.name}</p>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Hacé clic para seleccionar un PDF
                    </p>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {/* Error */}
              {uploadError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              )}

              {/* Success */}
              {successTxHash && (
                <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      ¡Certificado acuñado exitosamente!
                    </p>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${successTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-green-700 underline mt-1"
                    >
                      Ver en Etherscan
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                isLoading={uploading}
                disabled={!selectedFile}
                size="md"
                className="w-full sm:w-auto gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Procesando…" : "Subir y acuñar NFT"}
              </Button>
            </form>
          )}
        </div>

        {/* Certificates list */}
        <div>
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            Certificados emitidos
          </h2>

          {certsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-24 bg-white rounded-2xl border border-slate-200 animate-pulse"
                />
              ))}
            </div>
          ) : certificates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
              <Award className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Todavía no tenés certificados.</p>
              <p className="text-slate-400 text-xs mt-1">
                Subí tu primer PDF para acuñarlo como NFT.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 shrink-0">
                      <FileText className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate max-w-xs">
                        {getFilenameFromUrl(cert.pdf_url)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDate(cert.created_at)}
                      </p>
                      {cert.nft_token_id && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          Token ID: #{cert.nft_token_id}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* PDF link */}
                    <a
                      href={cert.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      <FileText className="h-3 w-3" />
                      Ver PDF
                    </a>

                    {/* Etherscan link */}
                    {cert.tx_hash && (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${cert.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Etherscan
                      </a>
                    )}

                    {/* Chain badge */}
                    <span className="inline-flex items-center text-xs text-slate-400 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                      {cert.chain ?? "sepolia"}
                    </span>

                    {/* NFT badge */}
                    {!cert.verified ? (
                      <Button size="sm" variant="secondary" onClick={() => handleMintNFT(cert.id)}
                        className="gap-1 text-violet-600 border-violet-200 hover:bg-violet-50 text-xs px-3 py-1.5">
                        🏅 Recibir NFT
                      </Button>
                    ) : (
                      <span className="inline-flex items-center text-xs text-violet-600 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-xl font-medium">
                        🏅 NFT verificado
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
