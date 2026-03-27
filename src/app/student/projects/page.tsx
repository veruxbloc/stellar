"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ethers } from "ethers";
import { useAuth } from "@/context/AuthContext";
import { useXO } from "@/context/XOProvider";
import { createClient } from "@/lib/supabase/client";
import { ESCROW_ADDRESS, ESCROW_ABI } from "@/lib/escrow";
import { CheckCircle } from "lucide-react";

interface Project {
  id: number;
  title: string;
  description: string;
  amount_rbtc: number;
  deadline_days: number;
  tx_hash: string | null;
  contract_project_id: number | null;
  status: string;
  companies: { name: string } | null;
}

interface MatchResult {
  score: number;
  reason: string;
}

export default function StudentProjectsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { getSigner, isConnected } = useXO();
  const supabase = useMemo(() => createClient(), []);

  const [openProjects, setOpenProjects] = useState<Project[]>([]);
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [completedProjects, setCompletedProjects] = useState<Project[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<{ name?: string; institution?: string; year?: number; pdf_url?: string }[]>([]);
  const [matches, setMatches] = useState<Record<number, MatchResult>>({});
  const [matchingId, setMatchingId] = useState<number | null>(null);
  const [applying, setApplying] = useState<number | null>(null);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [delivering, setDelivering] = useState<number | null>(null);
  const [deliverError, setDeliverError] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      setDataLoading(true);

      const { data: studentData } = await supabase
        .from("students").select("id").eq("user_id", user!.id).single();

      if (studentData) {
        setStudentId(studentData.id);

        const { data: certs } = await supabase
          .from("certificates").select("name, institution, year, pdf_url").eq("student_id", studentData.id);
        setCertificates(certs ?? []);

        const { data: myApps } = await supabase
          .from("applications").select("project_id").eq("student_id", studentData.id);
        if (myApps) setApplied(new Set(myApps.map((a) => a.project_id)));

        // Proyectos activos asignados al estudiante
        const { data: myAppsAccepted } = await supabase
          .from("applications")
          .select("project_id, projects(id, title, description, amount_rbtc, deadline_days, tx_hash, contract_project_id, status, companies(name))")
          .eq("student_id", studentData.id)
          .in("status", ["accepted", "pending"]);

        if (myAppsAccepted) {
          const allAssigned = myAppsAccepted.map((a) => a.projects as unknown as Project).filter(Boolean);
          setActiveProjects(allAssigned.filter((p) => p.status === "active" || p.status === "delivered"));
          setCompletedProjects(allAssigned.filter((p) => p.status === "completed"));
        }
      }

      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, title, description, amount_rbtc, deadline_days, tx_hash, contract_project_id, status, companies(name)")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      setOpenProjects((projectsData as unknown as Project[]) ?? []);
      setDataLoading(false);
    }

    fetchData();
  }, [user, supabase, refreshKey]);

  async function handleMatch(project: Project) {
    setMatchingId(project.id);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectDescription: project.description, certificates }),
      });
      const data: MatchResult = await res.json();
      setMatches((prev) => ({ ...prev, [project.id]: data }));
    } finally {
      setMatchingId(null);
    }
  }

  async function handleApply(project: Project) {
    if (!studentId) return;
    setApplying(project.id);

    const match = matches[project.id];
    await supabase.from("applications").insert({
      project_id: project.id,
      student_id: studentId,
      match_score: match?.score ?? null,
      match_reason: match?.reason ?? null,
      status: "pending",
    });

    setApplied((prev) => new Set([...prev, project.id]));
    setApplying(null);
  }

  async function handleDeliver(project: Project) {
    if (project.status === "delivered") return;
    setDelivering(project.id);
    setDeliverError((prev) => ({ ...prev, [project.id]: "" }));

    // deliverWork es llamado por la empresa al aprobar — el estudiante solo actualiza la DB

    // Actualizar estado en DB
    await supabase.from("projects").update({ status: "delivered" }).eq("id", project.id);
    setActiveProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, status: "delivered" } : p));
    setDelivering(null);
  }

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-low">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-16 space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight font-[family-name:var(--font-plus-jakarta)]">
              Tablero de Proyectos
            </h1>
            <p className="text-secondary text-sm mt-1">Encontrá proyectos con escrow en RSK y postulate</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/student/dashboard"
              className="text-primary font-bold text-sm flex items-center gap-1 hover:underline font-[family-name:var(--font-plus-jakarta)] uppercase tracking-widest"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Panel
            </Link>
            <div className="flex bg-surface-container-low p-1 rounded-full text-xs font-bold uppercase tracking-widest">
              <button
                onClick={() => setActiveTab("active")}
                className={`px-4 py-2 rounded-full transition-all ${activeTab === "active" ? "bg-white text-on-background shadow-sm" : "text-secondary"}`}
              >
                Activos
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-4 py-2 rounded-full transition-all ${activeTab === "history" ? "bg-white text-on-background shadow-sm" : "text-secondary"}`}
              >
                Historial
              </button>
            </div>
          </div>
        </div>

        {/* HISTORIAL TAB */}
        {activeTab === "history" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-secondary uppercase tracking-widest">Proyectos completados</h2>
              <button
                onClick={() => setRefreshKey(k => k + 1)}
                className="flex items-center gap-1 text-xs text-primary font-bold uppercase tracking-widest hover:underline"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Actualizar
              </button>
            </div>
            {completedProjects.length === 0 ? (
              <div className="bg-surface-container-lowest rounded-3xl p-10 text-center">
                <span className="material-symbols-outlined text-5xl text-outline-variant/20 mb-3">history</span>
                <p className="text-secondary">Todavía no completaste ningún proyecto.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {completedProjects.map((project) => (
                  <div key={project.id} className="bg-surface-container-lowest p-4 sm:p-6 rounded-3xl shadow-ambient border border-green-200/40">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-bold text-on-background">{project.title}</h3>
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#e2f5e8] text-[#1c7841]">
                        Completado
                      </span>
                    </div>
                    <p className="text-xs text-secondary">{project.companies?.name}</p>
                    <p className="text-sm font-bold text-[#f8a287] mt-1">{project.amount_rbtc} tRBTC recibidos</p>
                    {project.tx_hash && (
                      <a href={`https://explorer.testnet.rsk.co/tx/${project.tx_hash}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-tertiary hover:underline mt-2 font-medium">
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        Ver en RSK Explorer
                      </a>
                    )}
                    <p className="mt-4 text-sm text-[#1c7841] font-medium flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Pago liberado por la empresa
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE TAB — Proyectos activos asignados */}
        {activeTab === "active" && activeProjects.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-secondary uppercase tracking-widest mb-4">Proyectos asignados</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeProjects.map((project) => (
                <div key={project.id} className="bg-surface-container-lowest p-4 sm:p-6 rounded-3xl shadow-ambient border border-blue-200/40">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-bold text-on-background">{project.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      project.status === "delivered" ? "bg-[#e2f5e8] text-[#1c7841]" : "bg-[#e1f0fe] text-[#2467ac]"
                    }`}>
                      {project.status === "delivered" ? "Entregado" : "Activo"}
                    </span>
                  </div>
                  <p className="text-xs text-secondary">{project.companies?.name}</p>
                  <p className="text-sm font-bold text-[#f8a287] mt-1">{project.amount_rbtc} tRBTC</p>

                  {project.tx_hash && (
                    <a href={`https://explorer.testnet.rsk.co/tx/${project.tx_hash}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-tertiary hover:underline mt-2 font-medium">
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      Ver escrow en RSK
                    </a>
                  )}

                  {deliverError[project.id] && (
                    <p className="text-xs text-error mt-2">{deliverError[project.id]}</p>
                  )}

                  {project.status === "active" ? (
                    <button
                      onClick={() => handleDeliver(project)}
                      disabled={delivering === project.id}
                      className="mt-4 brand-gradient text-white rounded-full px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-50"
                    >
                      {delivering === project.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-sm">inventory_2</span>
                      )}
                      Marcar como entregado
                    </button>
                  ) : (
                    <p className="mt-4 text-sm text-[#1c7841] font-medium flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Trabajo entregado — esperando aprobación de la empresa
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Proyectos abiertos — solo en tab activos */}
        {activeTab === "active" && (
        <div>
          <h2 className="text-sm font-bold text-secondary uppercase tracking-widest mb-4">Proyectos disponibles</h2>
          {openProjects.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-3xl shadow-ambient p-10 text-center">
              <span className="material-symbols-outlined text-5xl text-outline-variant/20 mb-3">work_off</span>
              <p className="text-secondary">No hay proyectos disponibles por ahora.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {openProjects.map((project) => {
                const match = matches[project.id];
                const isApplied = applied.has(project.id);

                return (
                  <div
                    key={project.id}
                    className="bg-surface-container-lowest p-4 sm:p-6 rounded-3xl shadow-ambient hover:translate-y-[-4px] transition-transform duration-300 flex flex-col"
                  >
                    {/* Top */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface">
                        <span className="material-symbols-outlined">architecture</span>
                      </div>
                      {isApplied ? (
                        <span className="material-symbols-outlined text-green-500" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                      ) : (
                        <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2 py-1 rounded-full uppercase">
                          Nuevo
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h4 className="font-bold text-lg leading-tight text-on-background">{project.title}</h4>
                    <p className="text-xs text-secondary mt-1">{project.companies?.name}</p>
                    <p className="text-secondary text-sm mt-3 line-clamp-3 flex-1">{project.description}</p>

                    {/* Escrow link */}
                    {project.tx_hash && (
                      <a
                        href={`https://explorer.testnet.rsk.co/tx/${project.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-tertiary hover:underline mt-2 font-medium"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        Ver escrow en RSK
                      </a>
                    )}

                    {/* Match result */}
                    {match && (
                      <div className="mt-3 p-4 bg-secondary-container/30 rounded-2xl">
                        <p className="text-sm font-semibold text-on-secondary-container">Match: {match.score}/100</p>
                        <p className="text-xs text-secondary mt-0.5">{match.reason}</p>
                      </div>
                    )}

                    {/* Bottom — Amount & Actions */}
                    <div className="mt-6 pt-4 border-t border-outline-variant/10">
                      <div className="flex items-end justify-between mb-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">Garantizado</p>
                          <p className="text-xl font-black brand-gradient-text">{project.amount_rbtc} tRBTC</p>
                        </div>
                        <p className="text-xs text-secondary font-medium">{project.deadline_days} días</p>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {!match && (
                          <button
                            onClick={() => handleMatch(project)}
                            disabled={matchingId === project.id}
                            className="flex-1 bg-surface-container-high text-on-surface px-4 py-3 rounded-full text-[10px] font-extrabold uppercase tracking-widest hover:bg-surface-container-highest transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">auto_awesome</span>
                            {matchingId === project.id ? "Analizando..." : "Ver match"}
                          </button>
                        )}
                        <button
                          onClick={() => handleApply(project)}
                          disabled={isApplied || applying === project.id}
                          className={`flex-1 px-4 py-3 rounded-full text-[10px] font-extrabold uppercase tracking-widest transition-all flex items-center justify-center gap-1 ${
                            isApplied
                              ? "bg-surface-container text-secondary cursor-not-allowed"
                              : "brand-gradient text-white shadow-lg hover:scale-105 active:scale-95"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">{isApplied ? "check" : "arrow_forward"}</span>
                          {isApplied
                            ? "Postulado"
                            : applying === project.id
                              ? "Enviando..."
                              : "Postularme"
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
