"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ethers } from "ethers";
import { XOConnectProvider } from "xo-connect";
import { useAuth } from "@/context/AuthContext";
import { useXO } from "@/context/XOProvider";
import { createClient } from "@/lib/supabase/client";

const xoProvider = new XOConnectProvider({ debug: false });
import { Button } from "@/components/ui/Button";
import { ESCROW_ADDRESS, ESCROW_ABI, RSK_TESTNET_CHAIN_ID } from "@/lib/escrow";
import { ExternalLink } from "lucide-react";

interface JobPost {
  id: string;
  title: string;
  description: string;
  type: "job" | "internship";
  created_at: string;
}

export default function CompanyJobsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { getSigner, isConnected } = useXO();
  const supabase = useMemo(() => createClient(), []);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"job" | "internship">("job");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Escrow project state
  interface EscrowProject {
    id: number;
    title: string;
    description: string;
    amount_rbtc: number;
    deadline_days: number;
    tx_hash: string | null;
    contract_project_id: number | null;
    status: string;
    created_at: string;
  }

  const [escrowProjects, setEscrowProjects] = useState<EscrowProject[]>([]);
  const [showEscrowForm, setShowEscrowForm] = useState(false);
  const [escrowTitle, setEscrowTitle] = useState("");
  const [escrowDescription, setEscrowDescription] = useState("");
  const [escrowAmount, setEscrowAmount] = useState("0.0001");
  const [escrowDays, setEscrowDays] = useState("30");
  const [escrowSubmitting, setEscrowSubmitting] = useState(false);
  const [escrowError, setEscrowError] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    async function fetchCompanyAndJobs() {
      setDataLoading(true);

      const { data: companyData } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      if (!companyData) {
        setDataLoading(false);
        return;
      }

      setCompanyId(companyData.id);

      const { data: jobsData } = await supabase
        .from("job_posts")
        .select("id, title, description, type, created_at")
        .eq("company_id", companyData.id)
        .order("created_at", { ascending: false });

      setJobs((jobsData as JobPost[]) ?? []);

      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, title, description, amount_rbtc, deadline_days, tx_hash, contract_project_id, status, created_at")
        .eq("company_id", companyData.id)
        .order("created_at", { ascending: false });

      setEscrowProjects((projectsData as EscrowProject[]) ?? []);
      setDataLoading(false);
    }

    fetchCompanyAndJobs();
  }, [user, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;

    setSubmitting(true);
    setFormError("");

    const { data, error } = await supabase
      .from("job_posts")
      .insert({
        company_id: companyId,
        title: title.trim(),
        description: description.trim(),
        type,
      })
      .select("id, title, description, type, created_at")
      .single();

    if (error || !data) {
      setFormError("Error al publicar la oferta. Intentá de nuevo.");
      setSubmitting(false);
      return;
    }

    setJobs((prev) => [data as JobPost, ...prev]);
    setTitle("");
    setDescription("");
    setType("job");
    setShowForm(false);
    setSubmitting(false);
  }

  async function handleDelete(jobId: string) {
    setDeletingId(jobId);

    const { error } = await supabase
      .from("job_posts")
      .delete()
      .eq("id", jobId);

    if (!error) {
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    }

    setDeletingId(null);
  }

  async function handleCreateEscrow(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    setEscrowSubmitting(true);
    setEscrowError("");

    try {
      if (!isConnected) throw new Error("Conectá tu wallet primero (Beexo o MetaMask).");

      // Intentar cambiar a RSK Testnet
      try {
        await xoProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: RSK_TESTNET_CHAIN_ID }],
        });
      } catch {
        // Si falla el switch, continuar igual (Beexo puede tener RSK configurado)
      }

      const signer = await getSigner();
      const contract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);

      const deadlineTimestamp = Math.floor(Date.now() / 1000) + parseInt(escrowDays) * 86400;
      const amountWei = ethers.parseEther(escrowAmount);

      const tx = await contract.createProject(
        ethers.ZeroAddress,
        deadlineTimestamp,
        escrowTitle.trim(),
        escrowDescription.trim(),
        { value: amountWei }
      );

      const receipt = await tx.wait();
      const iface = new ethers.Interface(ESCROW_ABI);
      let contractProjectId: number | null = null;
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "ProjectCreated") {
            contractProjectId = Number(parsed.args[0]);
            break;
          }
        } catch { /* skip */ }
      }

      const { data, error } = await supabase
        .from("projects")
        .insert({
          company_id: companyId,
          title: escrowTitle.trim(),
          description: escrowDescription.trim(),
          amount_rbtc: parseFloat(escrowAmount),
          deadline_days: parseInt(escrowDays),
          tx_hash: receipt.hash,
          contract_project_id: contractProjectId,
          status: "open",
        })
        .select()
        .single();

      if (error || !data) throw new Error("Error guardando en base de datos.");

      setEscrowProjects((prev) => [data as EscrowProject, ...prev]);
      setEscrowTitle("");
      setEscrowDescription("");
      setEscrowAmount("0.0001");
      setEscrowDays("30");
      setShowEscrowForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setEscrowError(msg.includes("user rejected") ? "Transacción rechazada." : msg);
    } finally {
      setEscrowSubmitting(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-surface-container-low">

      <main className="max-w-4xl mx-auto px-6 pt-24 pb-16 space-y-12">
        {/* Navigation back and Title */}
        <div className="flex items-center gap-4">
          <Link href="/company/dashboard" className="w-12 h-12 rounded-full glass-premium flex items-center justify-center text-on-surface hover:scale-105 transition-transform shadow-ambient">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-3xl font-extrabold text-on-background font-[family-name:var(--font-plus-jakarta)] tracking-tight">
            Ofertas & Proyectos
          </h1>
        </div>

        {/* --- Job Offers Section --- */}
        <section className="bg-surface-container-lowest rounded-[2.5rem] shadow-ambient p-8">
          <div className="flex justify-between items-center mb-8 border-b border-outline-variant/20 pb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-primary">work</span>
              <h2 className="text-2xl font-bold text-on-background">Bolsa de Empleo</h2>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="brand-gradient text-white px-5 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest shadow-md hover:brightness-110 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">{showForm ? "close" : "add"}</span>
              {showForm ? "Cancelar" : "Publicar Empleo"}
            </button>
          </div>

          {showForm && (
            <div className="bg-surface-container rounded-3xl p-6 mb-8 border border-outline-variant/10 shadow-inner">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Posición</label>
                    <input
                      type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ej: Ingeniero Solidity Ssr"
                      className="w-full bg-surface-container-lowest rounded-2xl px-4 py-3 text-on-background focus:ring-2 focus:ring-primary outline-none transition-shadow"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Descripción del rol</label>
                    <textarea
                      required value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                      placeholder="Responsabilidades y requisitos..."
                      className="w-full bg-surface-container-lowest rounded-2xl px-4 py-3 text-on-background focus:ring-2 focus:ring-primary outline-none transition-shadow resize-none"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Modalidad</label>
                    <select
                      value={type} onChange={(e) => setType(e.target.value as "job" | "internship")}
                      className="w-full bg-surface-container-lowest rounded-2xl px-4 py-3 text-on-background focus:ring-2 focus:ring-primary outline-none transition-shadow appearance-none"
                    >
                      <option value="job">Tiempo Completo</option>
                      <option value="internship">Pasantía / Trainee</option>
                    </select>
                  </div>
                </div>

                {formError && <p className="text-xs font-bold bg-error/10 text-error p-3 rounded-xl">{formError}</p>}
                
                <div className="pt-4 text-right">
                  <Button type="submit" isLoading={submitting} className="brand-gradient text-white rounded-full px-8 py-3 text-xs tracking-widest uppercase">
                    Lanzar Oferta
                  </Button>
                </div>
              </form>
            </div>
          )}

          {jobs.length === 0 ? (
            <div className="text-center py-10 opacity-60">
              <span className="material-symbols-outlined text-6xl mb-4">work_off</span>
              <p className="text-sm font-bold tracking-widest uppercase">Sin ofertas activas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {jobs.map((job) => (
                <div key={job.id} className="bg-surface-container rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start gap-4 border border-outline-variant/10 hover:border-primary/30 transition-colors group">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-on-background">{job.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        job.type === "internship" ? "bg-secondary-container text-on-secondary-container" : "bg-primary/10 text-primary"
                      }`}>
                        {job.type}
                      </span>
                    </div>
                    <p className="text-sm text-secondary line-clamp-2">{job.description}</p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] text-secondary/60 font-bold uppercase tracking-widest">
                      <span className="material-symbols-outlined text-sm">calendar_today</span>
                      {formatDate(job.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(job.id)}
                    disabled={deletingId === job.id}
                    className="w-10 h-10 rounded-full bg-surface-container-highest text-error flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                  >
                    <span className="material-symbols-outlined">{deletingId === job.id ? "hourglass_empty" : "delete"}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>


        {/* --- Escrow Projects Section --- */}
        <section className="bg-surface-container-lowest rounded-[2.5rem] shadow-ambient p-8 relative overflow-hidden glass-card">
          {/* Fondo decorativo cripto */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#f8a287]/10 rounded-full blur-3xl" />

          <div className="flex justify-between items-center mb-8 border-b border-outline-variant/20 pb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="bg-[#f8a287]/20 p-2 rounded-xl text-[#f8a287] flex">
                <span className="material-symbols-outlined text-3xl">currency_bitcoin</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-on-background">Proyectos Escrow</h2>
                <p className="text-xs text-secondary tracking-widest font-bold uppercase">Contratos Inteligentes en RSK</p>
              </div>
            </div>
            <button
              onClick={() => setShowEscrowForm(!showEscrowForm)}
              className="bg-[#f8a287] text-white px-5 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest shadow-md hover:brightness-110 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">{showEscrowForm ? "close" : "add"}</span>
              {showEscrowForm ? "Cancelar" : "Crear Pago"}
            </button>
          </div>

          {showEscrowForm && (
            <div className="glass-premium rounded-3xl p-6 mb-8 border border-white/20 relative z-10">
              <form onSubmit={handleCreateEscrow} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Nombre del Proyecto</label>
                    <input type="text" required value={escrowTitle} onChange={(e) => setEscrowTitle(e.target.value)} placeholder="App descentralizada XYZ"
                      className="w-full bg-surface-container-lowest/50 rounded-2xl px-4 py-3 text-on-background focus:ring-2 focus:ring-[#f8a287] outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Entregable Requerido</label>
                    <textarea required value={escrowDescription} onChange={(e) => setEscrowDescription(e.target.value)} rows={3}
                      className="w-full bg-surface-container-lowest/50 rounded-2xl px-4 py-3 text-on-background focus:ring-2 focus:ring-[#f8a287] outline-none resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Presupuesto (tRBTC)</label>
                    <input type="number" step="0.0001" min="0.0001" required value={escrowAmount} onChange={(e) => setEscrowAmount(e.target.value)}
                      className="w-full bg-surface-container-lowest/50 rounded-2xl px-4 py-3 text-on-background focus:ring-2 focus:ring-[#f8a287] outline-none font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Plazo (Días)</label>
                    <input type="number" min="1" required value={escrowDays} onChange={(e) => setEscrowDays(e.target.value)}
                      className="w-full bg-surface-container-lowest/50 rounded-2xl px-4 py-3 text-on-background focus:ring-2 focus:ring-[#f8a287] outline-none" />
                  </div>
                </div>
                {escrowError && <p className="text-xs font-bold bg-error/10 text-error p-3 rounded-xl">{escrowError}</p>}
                <div className="pt-4 text-right">
                  <Button type="submit" isLoading={escrowSubmitting} className="bg-[#f8a287] text-white rounded-full px-8 py-3 text-xs tracking-widest uppercase hover:bg-[#e89075]">
                    Bloquear Fondos en Smart Contract
                  </Button>
                </div>
              </form>
            </div>
          )}

          {escrowProjects.length === 0 ? (
            <div className="text-center py-10 opacity-60 relative z-10">
              <span className="material-symbols-outlined text-6xl mb-4">account_balance_wallet</span>
              <p className="text-sm font-bold tracking-widest uppercase">Sin Contratos Abiertos</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 relative z-10">
              {escrowProjects.map((p) => (
                <div key={p.id} className="bg-surface-container rounded-2xl p-5 flex flex-col lg:flex-row justify-between gap-4 border border-outline-variant/10">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-on-background">{p.title}</h3>
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-secondary-container text-on-secondary-container">
                        {p.status}
                      </span>
                    </div>
                    <p className="text-sm text-secondary line-clamp-2">{p.description}</p>
                    {p.tx_hash && (
                      <a href={`https://explorer.testnet.rsk.co/tx/${p.tx_hash}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-[#f8a287] hover:underline mt-4 bg-[#f8a287]/10 px-3 py-1.5 rounded-lg border border-[#f8a287]/20">
                        <span className="material-symbols-outlined text-[10px]">link</span>
                        {p.tx_hash.substring(0,20)}...
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-6 lg:border-l lg:border-outline-variant/20 lg:pl-6">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Monto</p>
                      <p className="text-xl font-black text-on-background font-mono">{p.amount_rbtc} <span className="text-xs">tRBTC</span></p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Plazo</p>
                      <p className="text-xl font-black text-on-background">{p.deadline_days} <span className="text-xs">días</span></p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
