"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useXO } from "@/context/XOProvider";
import { WalletModal } from "@/components/WalletModal";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";

interface StudentProfile {
  id: string;
  name: string;
  university: string;
  career: string;
  bio: string;
}

interface Certificate {
  id: string;
  nft_token_id: string | null;
  verified?: boolean;
  name: string;
  institution?: string;
  year?: number;
}

function subscribe() {
  return () => {};
}

const CACHE_KEY = "verux_minted_nfts";

function getCachedMints(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { address, isConnected, disconnect } = useXO();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [certCount, setCertCount] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);
  const [walletSaved, setWalletSaved] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [selectedNft, setSelectedNft] = useState<Certificate | null>(null);

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

  // Fetch student profile, certificates and count
  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      setProfileLoading(true);
      const { data: studentData } = await supabase
        .from("students")
        .select("id, name, university, career, bio")
        .eq("user_id", user!.id)
        .single();

      if (studentData) {
        setProfile(studentData as StudentProfile);

        const { data: certsData, count } = await supabase
          .from("certificates")
          .select("id, nft_token_id, verified, name, institution, year", { count: "exact" })
          .eq("student_id", studentData.id)
          .order("created_at", { ascending: false });

        setCertificates(hydrateCachedMints((certsData as Certificate[]) ?? []));
        setCertCount(count ?? 0);
      }

      setProfileLoading(false);
    }

    fetchData();
  }, [user, supabase, hydrateCachedMints]);

  // Save wallet
  useEffect(() => {
    if (!user || !isConnected || !address || walletSaved) return;

    async function saveWallet() {
      setWalletError("");
      const { error } = await supabase
        .from("users")
        .update({ wallet_address: address })
        .eq("id", user!.id);

      if (error) {
        setWalletError("No se pudo guardar la wallet. Intentá de nuevo.");
      } else {
        setWalletSaved(true);
      }
    }

    saveWallet();
  }, [isConnected, address, user, walletSaved, supabase]);

  const verifiedCerts = certificates.filter(c => c.verified || c.nft_token_id);
  const pendingCerts = certificates.filter(c => !c.verified && !c.nft_token_id);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-low">
      {showWalletModal && <WalletModal onClose={() => setShowWalletModal(false)} />}
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-16 space-y-12">

        {/* ═══════════════════════════════════════
            Verified Profile Section
            ═══════════════════════════════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Profile Card */}
          <div className="lg:col-span-4 bg-surface-container-lowest p-8 rounded-3xl shadow-ambient">
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Avatar with verified badge */}
              <div className="relative">
                <div className="w-32 h-32 rounded-3xl overflow-hidden shadow-xl rotate-3 bg-surface-container-high">
                  {/* Initials avatar */}
                  <div className="w-full h-full flex items-center justify-center brand-gradient text-white text-4xl font-extrabold tracking-tight">
                    {profileLoading
                      ? "..."
                      : profile
                        ? profile.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
                        : "??"
                    }
                  </div>
                </div>
                <div className="absolute -bottom-2 -right-2 brand-gradient p-1.5 rounded-full shadow-lg">
                  <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>verified</span>
                </div>
              </div>

              {/* Name & Details */}
              <div className="pt-4">
                {profileLoading ? (
                  <div className="space-y-2">
                    <div className="h-8 bg-surface-container-high rounded-lg animate-pulse w-48 mx-auto" />
                    <div className="h-4 bg-surface-container-high rounded-lg animate-pulse w-32 mx-auto" />
                  </div>
                ) : profile ? (
                  <>
                    <h1 className="text-3xl font-extrabold tracking-tight text-on-background font-[family-name:var(--font-plus-jakarta)]">
                      {profile.name}
                    </h1>
                    <p className="text-primary font-semibold text-sm">{profile.career}</p>
                  </>
                ) : (
                  <p className="text-secondary text-sm">Sin perfil registrado</p>
                )}
              </div>

              {profile?.bio && (
                <p className="text-secondary text-sm leading-relaxed max-w-xs">
                  {profile.bio}
                </p>
              )}

              {/* Tags */}
              {profile && (
                <div className="flex gap-2 pt-2 flex-wrap justify-center">
                  <span className="px-3 py-1 bg-surface-container-high rounded-full text-[10px] font-bold uppercase tracking-wider text-primary">
                    {profile.university}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Billetera de Insignias – NFT Wallet */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-bold text-on-background font-[family-name:var(--font-plus-jakarta)]">
                  Billetera de Insignias
                </h2>
                <p className="text-secondary text-sm">Tus logros verificados en la blockchain.</p>
              </div>
              <Link
                href="/student/certificates"
                className="text-primary font-bold text-sm flex items-center gap-1 hover:underline"
              >
                Ver todos
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Verified NFTs */}
              {verifiedCerts.slice(0, 3).map((cert) => (
                <button
                  key={cert.id}
                  onClick={() => setSelectedNft(cert)}
                  className="group relative aspect-square bg-surface-container-lowest rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  <div className="w-16 h-16 rounded-2xl brand-gradient flex items-center justify-center relative shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-white text-3xl">
                      {cert.name?.toLowerCase().includes("ux") ? "design_services" : "workspace_premium"}
                    </span>
                    <div className="absolute -bottom-2 -right-2 bg-[#ff8f71] rounded-full w-6 h-6 flex items-center justify-center border-2 border-surface-container-lowest">
                      <span className="material-symbols-outlined text-white text-xs" style={{ fontVariationSettings: '"FILL" 1' }}>verified</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <h5 className="text-[10px] font-extrabold text-on-background uppercase tracking-wider truncate w-full px-2">{cert.name}</h5>
                    <p className="text-[8px] font-medium text-secondary mt-0.5 opacity-60">ID #{cert.id.substring(0,4)}</p>
                  </div>
                </button>
              ))}

              {/* Placeholder – Next badge */}
              <Link
                href="/student/certificates"
                className="aspect-square bg-surface-container-low/50 border-2 border-dashed border-outline-variant/30 rounded-2xl flex flex-col items-center justify-center text-outline-variant hover:border-primary/40 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-2xl">add_circle</span>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-2">
                  {verifiedCerts.length === 0 ? "Acuñar" : "Próxima"}
                </p>
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════
            Wallet Connection
            ═══════════════════════════════════════ */}
        <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-ambient">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-on-secondary-container text-2xl">account_balance_wallet</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-background font-[family-name:var(--font-plus-jakarta)]">Wallet</h2>
              <p className="text-sm text-secondary">Conectá tu wallet para acuñar certificados NFT</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {mounted ? (
              isConnected ? (
                <div className="flex items-center gap-3 px-5 py-3 bg-surface-container-low rounded-2xl">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-mono text-on-surface text-sm font-medium">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  <button
                    onClick={disconnect}
                    className="ml-2 text-secondary hover:text-error transition-colors text-xs uppercase tracking-widest font-bold"
                  >
                    Desconectar
                  </button>
                </div>
              ) : (
                <Button size="md" onClick={() => setShowWalletModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                  Conectar Wallet
                </Button>
              )
            ) : (
              <div className="w-44 h-12 bg-surface-container-high animate-pulse rounded-2xl" />
            )}

            {mounted && isConnected && (
              <div className="flex items-center gap-2">
                {walletSaved ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-on-background bg-surface-container-high px-4 py-2 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Wallet guardada
                  </span>
                ) : walletError ? (
                  <span className="text-sm text-error bg-error-container/20 px-4 py-2 rounded-full font-medium">
                    {walletError}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-primary bg-primary/10 px-4 py-2 rounded-full font-medium">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Guardando wallet…
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════
            Resumen – Metrics Row
            ═══════════════════════════════════════ */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Total certs */}
          <div className="glass-card p-8 rounded-3xl shadow-ambient relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-9xl">school</span>
            </div>
            <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] mb-4 font-[family-name:var(--font-plus-jakarta)]">
              Certificados Totales
            </p>
            {profileLoading ? (
              <div className="h-16 w-20 bg-surface-container-high rounded-lg animate-pulse" />
            ) : (
              <div className="flex items-baseline gap-2">
                <h2 className="text-6xl font-extrabold text-primary">{certCount}</h2>
              </div>
            )}
            <div className="mt-8 h-2 w-full bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full brand-gradient transition-all duration-1000"
                style={{ width: `${Math.min((certCount / 10) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Verified */}
          <div className="glass-card p-8 rounded-3xl shadow-ambient relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-9xl">verified</span>
            </div>
            <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] mb-4 font-[family-name:var(--font-plus-jakarta)]">
              NFTs Acuñados
            </p>
            {profileLoading ? (
              <div className="h-16 w-20 bg-surface-container-high rounded-lg animate-pulse" />
            ) : (
              <div className="flex items-baseline gap-2">
                <h2 className="text-6xl font-extrabold text-on-surface">{verifiedCerts.length}</h2>
              </div>
            )}
            <div className="mt-8 flex gap-3">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                Verificados: {verifiedCerts.length}
              </span>
              <span className="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-bold">
                Pendientes: {pendingCerts.length}
              </span>
            </div>
          </div>

          {/* Wallet status */}
          <div className="glass-card p-8 rounded-3xl shadow-ambient relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-9xl">account_balance_wallet</span>
            </div>
            <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] mb-4 font-[family-name:var(--font-plus-jakarta)]">
              Estado Wallet
            </p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-extrabold text-on-surface">
                {mounted
                  ? isConnected
                    ? "Conectada"
                    : "Desconectada"
                  : "..."
                }
              </h2>
            </div>
            {mounted && isConnected && address && (
              <p className="mt-4 text-xs text-secondary font-mono break-all bg-surface-container-low px-3 py-2 rounded-xl">
                {address}
              </p>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════
            Quick Actions – Navigation Cards
            ═══════════════════════════════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Certificates */}
          <Link
            href="/student/certificates"
            className="group bg-surface-container-lowest p-8 rounded-3xl shadow-ambient hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl brand-gradient flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: '"FILL" 1' }}>workspace_premium</span>
                </div>
                <h3 className="text-xl font-bold text-on-background font-[family-name:var(--font-plus-jakarta)]">
                  Carga de Certificados
                </h3>
              </div>
              <p className="text-secondary text-sm leading-relaxed mb-8">
                Arrastrá tus documentos académicos para transformarlos en activos digitales verificados e inmutables en la blockchain.
              </p>
            </div>
            <div className="flex items-center text-sm font-[family-name:var(--font-plus-jakarta)] font-bold text-primary uppercase tracking-widest group-hover:gap-3 gap-2 transition-all">
              Ir a certificados
              <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </div>
          </Link>

          {/* Projects */}
          <Link
            href="/student/projects"
            className="group bg-surface-container-lowest p-8 rounded-3xl shadow-ambient hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-tertiary flex items-center justify-center text-on-tertiary shadow-lg group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: '"FILL" 1' }}>work</span>
                </div>
                <h3 className="text-xl font-bold text-on-background font-[family-name:var(--font-plus-jakarta)]">
                  Bolsa de Proyectos
                </h3>
              </div>
              <p className="text-secondary text-sm leading-relaxed mb-8">
                Postulate a proyectos freelance y asegurá tu cobro con contratos inteligentes Escrow en RSK Testnet.
              </p>
            </div>
            <div className="flex items-center text-sm font-[family-name:var(--font-plus-jakarta)] font-bold text-tertiary uppercase tracking-widest group-hover:gap-3 gap-2 transition-all">
              Explorar trabajos
              <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </div>
          </Link>
        </section>

      </div>

      {/* NFT Inspection Modal */}
      <AnimatePresence>
        {selectedNft && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-on-background/30 backdrop-blur-md"
            onClick={() => setSelectedNft(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 50, rotateX: 20 }}
              animate={{ scale: 1, y: 0, rotateX: 0 }}
              exit={{ scale: 0.8, y: 50, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm glass-premium rounded-[2.5rem] p-8 overflow-hidden shadow-2xl flex flex-col items-center text-center"
            >
              {/* Cierre icon */}
              <button
                onClick={() => setSelectedNft(null)}
                className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface hover:scale-110 transition-transform"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>

              {/* Glowing aura */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#e4c4fc]/40 rounded-full blur-3xl pointer-events-none" />

              <h3 className="text-xl font-extrabold text-on-background font-[family-name:var(--font-plus-jakarta)] mb-1">
                Certificado Digital
              </h3>
              <p className="text-xs text-secondary font-medium tracking-widest uppercase mb-8">
                Blockchain Verux
              </p>

              {/* Animación de la Insignia Gigante */}
              <motion.div
                whileHover={{ scale: 1.05, rotateY: 15, rotateX: -15 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="relative w-40 h-40 rounded-3xl brand-gradient shadow-2xl flex items-center justify-center transform-gpu preserve-3d cursor-grab mb-8 z-10"
              >
                {/* Reflejo de cristal sobre la chapa */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 rounded-3xl pointer-events-none" />

                <span className="material-symbols-outlined text-white text-[80px] drop-shadow-md">
                  {selectedNft.name?.toLowerCase().includes("ux") ? "design_services" : "workspace_premium"}
                </span>

                {/* Sello de verificación gigante */}
                <div className="absolute -bottom-3 -right-3 bg-[#ff8f71] rounded-2xl w-14 h-14 flex items-center justify-center border-4 border-white shadow-xl">
                  <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: '"FILL" 1' }}>verified</span>
                </div>
              </motion.div>

              <div className="w-full bg-surface-container-lowest/50 backdrop-blur-sm rounded-2xl p-5 border border-white/40 space-y-4">
                <div>
                  <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mb-1">Logro Otorgado</p>
                  <p className="text-lg font-bold text-on-background leading-tight">{selectedNft.name}</p>
                </div>

                <div className="h-px w-full bg-outline-variant/20" />

                <div className="flex justify-between items-center text-left">
                  <div>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mb-1">Emisor</p>
                    <p className="text-sm font-semibold text-on-background line-clamp-1">{selectedNft.institution || "TalentChain"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mb-1">Año</p>
                    <p className="text-sm font-semibold text-on-background">{selectedNft.year || new Date().getFullYear()}</p>
                  </div>
                </div>

                {selectedNft.nft_token_id && (
                  <>
                    <div className="h-px w-full bg-outline-variant/20" />
                    <div className="text-left">
                      <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mb-1">Hash del Token (Verux/Sepolia)</p>
                      <p className="text-[10px] font-mono text-primary bg-primary/10 p-2 rounded-lg truncate break-all border border-primary/20">
                        {selectedNft.nft_token_id}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
