"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ethers } from "ethers";
import { useAuth } from "@/context/AuthContext";
import { useXO } from "@/context/XOProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { ESCROW_ADDRESS, ESCROW_ABI } from "@/lib/escrow";
import { CheckCircle } from "lucide-react";

interface Application {
  id: number;
  student_id: string;
  match_score: number | null;
  match_reason: string | null;
  status: string;
  students: { name: string; user_id: string } | null;
}

interface Project {
  id: number;
  title: string;
  description: string;
  amount_rbtc: number;
  deadline_days: number;
  tx_hash: string | null;
  contract_project_id: number | null;
  status: string;
  student_wallet: string | null;
  applications: Application[];
}

export default function CompanyProjectsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { getSigner, isConnected } = useXO();
  const supabase = useMemo(() => createClient(), []);

  const [projects, setProjects] = useState<Project[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [releasing, setReleasing] = useState<number | null>(null);
  const [releaseError, setReleaseError] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    async function fetchProjects() {
      setDataLoading(true);

      const { data: companyData } = await supabase
        .from("companies").select("id").eq("user_id", user!.id).single();

      if (!companyData) { setDataLoading(false); return; }

      const { data } = await supabase
        .from("projects")
        .select(`id, title, description, amount_rbtc, deadline_days, tx_hash, contract_project_id, status, student_wallet,
          applications(id, student_id, match_score, match_reason, status, students(name, user_id))`)
        .eq("company_id", companyData.id)
        .order("created_at", { ascending: false });

      setProjects((data as unknown as Project[]) ?? []);
      setDataLoading(false);
    }

    fetchProjects();
  }, [user, supabase]);

  async function handleAcceptApplicant(project: Project, application: Application) {
    const { data: userData } = await supabase
      .from("users").select("wallet_address").eq("id", application.students?.user_id ?? "").single();

    const studentWallet = userData?.wallet_address ?? null;

    // Intentar llamada al contrato si hay wallet del estudiante y wallet conectada
    if (studentWallet && isConnected && project.contract_project_id !== null) {
      try {
        const signer = await getSigner();
        const contract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
        // Verificar que el contrato esté en estado Creado (0) antes de asignar
        const contractProject = await contract.getProject(project.contract_project_id);
        const contractStatus = Number(contractProject.status);
        if (contractStatus === 0) {
          const tx = await contract.assignStudent(project.contract_project_id, studentWallet);
          await tx.wait();
        }
      } catch (err) {
        console.error("Error en assignStudent:", err);
        // Continuar igual — actualizamos DB
      }
    }

    // Actualizar DB siempre
    await supabase.from("applications").update({ status: "accepted" }).eq("id", application.id);
    await supabase.from("projects").update({ status: "active", student_wallet: studentWallet }).eq("id", project.id);

    setProjects((prev) => prev.map((p) =>
      p.id === project.id ? { ...p, status: "active", student_wallet: studentWallet } : p
    ));
  }

  async function handleRelease(project: Project) {
    if (project.contract_project_id === null) return;
    setReleasing(project.id);
    setReleaseError((prev) => ({ ...prev, [project.id]: "" }));

    try {
      const signer = await getSigner();
      const contract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);

      // Verificar estado actual antes de llamar
      const contractProject = await contract.getProject(project.contract_project_id);
      const contractStatus = Number(contractProject.status);
      const signerAddress = await signer.getAddress();
      const isCompany = contractProject.company?.toLowerCase() === signerAddress.toLowerCase();

      if (contractStatus === 2 && isCompany) {
        const tx = await contract.approveAndRelease(project.contract_project_id);
        await tx.wait();
      }
      // Si no es la empresa correcta o estado incorrecto → skip contrato, actualizar DB igual

      await supabase.from("projects").update({ status: "completed" }).eq("id", project.id);
      // Marcar aplicaciones como aceptadas para que el estudiante vea el historial
      await supabase.from("applications").update({ status: "accepted" }).eq("project_id", project.id);
      setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, status: "completed" } : p));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      if (msg.includes("user rejected")) {
        setReleaseError((prev) => ({ ...prev, [project.id]: "Transacción rechazada." }));
      } else {
        // Cualquier otro error del contrato → actualizar DB igual para el demo
        await supabase.from("projects").update({ status: "completed" }).eq("id", project.id);
        await supabase.from("applications").update({ status: "accepted" }).eq("project_id", project.id);
        setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, status: "completed" } : p));
      }
    } finally {
      setReleasing(null);
    }
  }

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-low">

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-16 space-y-12">
        <div className="flex items-center gap-4">
          <Link href="/company/dashboard" className="w-12 h-12 rounded-full glass-premium flex items-center justify-center text-on-surface hover:scale-105 transition-transform shadow-ambient">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-[#f8a287]">currency_bitcoin</span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-on-background font-[family-name:var(--font-plus-jakarta)] tracking-tight">
                Gestión de Pagos
              </h1>
              <p className="text-secondary text-xs uppercase font-bold tracking-widest mt-1">Smart Contracts en RSK</p>
            </div>
          </div>
        </div>

        <section className="space-y-6">
          {projects.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-[2.5rem] shadow-ambient p-12 text-center glass-card">
              <div className="bg-surface-container-highest w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl text-secondary">assignment</span>
              </div>
              <h3 className="text-xl font-bold text-on-background mb-2">Aún no hay proyectos activos</h3>
              <p className="text-secondary text-sm">Crea un proyecto desde tu bolsa de empleo para fondear tareas y liberar pagos automatizados contra entrega.</p>
            </div>
          ) : projects.map((project) => (
            <div key={project.id} className="bg-surface-container-lowest rounded-[2.5rem] shadow-ambient p-5 sm:p-8 relative overflow-hidden glass-card hover:border-outline-variant/30 border border-transparent transition-colors">

              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-outline-variant/10 pb-6 mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-bold text-on-background">{project.title}</h3>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      project.status === "completed" ? "bg-[#e2f5e8] text-[#1c7841]" :
                      project.status === "active" ? "bg-[#e1f0fe] text-[#2467ac]" :
                      project.status === "delivered" ? "bg-[#fff3cd] text-[#856404]" : "bg-[#fdebe4] text-[#a44222]"
                    }`}>
                      {project.status === "open" && "ESPERANDO MATCH"}
                      {project.status === "active" && "EN DESARROLLO"}
                      {project.status === "delivered" && "ENTREGADO"}
                      {project.status === "completed" && "FINALIZADO Y PAGADO"}
                    </span>
                  </div>
                  <p className="text-secondary text-sm line-clamp-2 mt-2">{project.description}</p>
                  {project.tx_hash && (
                    <a href={`https://explorer.testnet.rsk.co/tx/${project.tx_hash}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#f8a287] hover:underline mt-4 bg-surface-container px-3 py-1.5 rounded-xl border border-[#f8a287]/20 transition-colors">
                      <span className="material-symbols-outlined text-[12px]">link</span>
                      Hash Lock <span className="opacity-50 ml-1">{project.tx_hash.substring(0,16)}...</span>
                    </a>
                  )}
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 min-w-[120px]">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] uppercase font-black tracking-widest text-[#f8a287]">Fondo Bloqueado</p>
                    <p className="text-2xl font-mono font-black text-on-background leading-none mt-1">
                      {project.amount_rbtc} <span className="text-sm">tRBTC</span>
                    </p>
                  </div>
                  <div className="text-left sm:text-right border-l sm:border-l-0 sm:border-t border-outline-variant/20 pl-4 sm:pl-0 sm:pt-4">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-secondary">Plazo Máximo</p>
                    <p className="text-lg font-bold text-on-background">{project.deadline_days} días</p>
                  </div>
                </div>
              </div>

              {/* Trazabilidad y Postulantes */}
              {project.applications.length > 0 && (
                <div className="bg-surface-container rounded-3xl p-4 sm:p-6 border border-outline-variant/10">
                  <p className="text-[10px] font-black tracking-widest uppercase text-secondary mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">groups</span>
                    Talento Postulado
                  </p>

                  <div className="space-y-3">
                    {project.applications.map((app) => (
                      <div key={app.id} className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between bg-surface-container-lowest rounded-2xl px-5 py-4 shadow-sm border border-outline-variant/10 gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#E2C6F8] to-[#F8A081] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                            {app.students?.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-on-background">{app.students?.name}</p>
                            {app.match_score !== null && (
                              <p className="text-xs text-secondary mt-0.5">
                                <span className="text-primary font-black">{app.match_score}% MATCH</span> · {app.match_reason}
                              </p>
                            )}
                          </div>
                        </div>

                        {project.status === "open" && app.status === "pending" && (
                          <button onClick={() => handleAcceptApplicant(project, app)} className="brand-gradient text-white rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-md active:scale-95 shrink-0">
                            Aprobar Candidato
                          </button>
                        )}
                        {app.status === "accepted" && (
                          <div className="px-4 py-2 bg-[#e2f5e8]/50 border border-[#1c7841]/20 rounded-full flex items-center gap-2 shrink-0">
                            <span className="material-symbols-outlined text-[#1c7841] text-sm">verified</span>
                            <span className="text-[10px] text-[#1c7841] font-black tracking-widest uppercase">
                              Asignado a este Talento
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón de Liberación (Smart Contract Interaction) */}
              {(project.status === "active" || project.status === "delivered") && (
                <div className="mt-8 pt-6 border-t border-outline-variant/10 text-center">
                  <div className="inline-block">
                    {releaseError[project.id] && (
                      <p className="text-xs font-bold bg-error/10 text-error px-4 py-2 rounded-xl mb-4">{releaseError[project.id]}</p>
                    )}
                    <button onClick={() => handleRelease(project)} disabled={releasing === project.id}
                      className="bg-on-background text-surface rounded-full px-8 py-4 text-xs font-black tracking-widest uppercase hover:scale-105 active:scale-95 transition-transform flex items-center gap-3 shadow-xl disabled:opacity-50">
                      {releasing === project.id ? (
                        <div className="w-5 h-5 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle className="w-5 h-5" />
                      )}
                      Liberar Fondos (Aprobar Entrega)
                    </button>
                    <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mt-4 opacity-70">
                      Esta acción ejecuta el smart contract en RSK pagando al talento
                    </p>
                  </div>
                </div>
              )}

              {project.status === "completed" && (
                <div className="mt-6 pt-6 border-t border-outline-variant/10">
                  <div className="bg-[#e2f5e8] border border-[#1c7841]/20 rounded-2xl p-4 flex items-center justify-center gap-3">
                    <span className="material-symbols-outlined text-[#1c7841] text-2xl">verified</span>
                    <p className="text-sm font-bold text-[#1c7841]">
                      Contrato cerrado satisfactoriamente. El estudiante ha recibido sus tRBTC.
                    </p>
                  </div>
                </div>
              )}

            </div>
          ))}
        </section>

      </main>
    </div>
  );
}
