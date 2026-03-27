"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ethers } from "ethers";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { ESCROW_ADDRESS, ESCROW_ABI } from "@/lib/escrow";
import { ArrowLeft, Coins, ExternalLink, CheckCircle } from "lucide-react";

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
    const win = window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } };
    if (!win.ethereum || project.contract_project_id === null) return;

    const { data: userData } = await supabase
      .from("users").select("wallet_address").eq("id", application.students?.user_id ?? "").single();

    const studentWallet = userData?.wallet_address;
    if (!studentWallet) {
      alert("El estudiante no tiene wallet conectada.");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(win.ethereum as ethers.Eip1193Provider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);

      const tx = await contract.assignStudent(project.contract_project_id, studentWallet);
      await tx.wait();

      await supabase.from("applications").update({ status: "accepted" }).eq("id", application.id);
      await supabase.from("projects").update({ status: "active", student_wallet: studentWallet }).eq("id", project.id);

      setProjects((prev) => prev.map((p) =>
        p.id === project.id ? { ...p, status: "active", student_wallet: studentWallet } : p
      ));
    } catch (err) {
      console.error(err);
      alert("Error al asignar estudiante.");
    }
  }

  async function handleRelease(project: Project) {
    if (project.contract_project_id === null) return;
    setReleasing(project.id);
    setReleaseError((prev) => ({ ...prev, [project.id]: "" }));

    try {
      const win = window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } };
      if (!win.ethereum) throw new Error("Instalá MetaMask o usá Beexo.");

      const provider = new ethers.BrowserProvider(win.ethereum as ethers.Eip1193Provider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);

      const tx = await contract.approveAndRelease(project.contract_project_id);
      await tx.wait();

      await supabase.from("projects").update({ status: "completed" }).eq("id", project.id);
      setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, status: "completed" } : p));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      setReleaseError((prev) => ({ ...prev, [project.id]: msg.includes("user rejected") ? "Rechazado." : msg }));
    } finally {
      setReleasing(null);
    }
  }

  if (loading || dataLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-500">Cargando...</p></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/company/dashboard" className="text-slate-400 hover:text-slate-600"><ArrowLeft className="h-5 w-5" /></Link>
          <Coins className="h-5 w-5 text-orange-500" />
          <span className="font-bold text-slate-900">Gestionar proyectos escrow</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <Coins className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No tenés proyectos todavía. Creá uno desde Ofertas laborales.</p>
          </div>
        ) : projects.map((project) => (
          <div key={project.id} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-slate-900">{project.title}</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                project.status === "completed" ? "bg-green-100 text-green-700" :
                project.status === "active" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
              }`}>{project.status}</span>
            </div>
            <p className="text-sm font-medium text-orange-600">{project.amount_rbtc} tRBTC</p>
            {project.tx_hash && (
              <a href={`https://explorer.testnet.rsk.co/tx/${project.tx_hash}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                <ExternalLink className="h-3 w-3" />Ver TX en RSK Explorer
              </a>
            )}

            {project.applications.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Postulantes</p>
                <div className="space-y-2">
                  {project.applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{app.students?.name}</p>
                        {app.match_score !== null && (
                          <p className="text-xs text-violet-600">Match: {app.match_score}/100 · {app.match_reason}</p>
                        )}
                      </div>
                      {project.status === "open" && app.status === "pending" && (
                        <Button size="sm" onClick={() => handleAcceptApplicant(project, app)}>Aceptar</Button>
                      )}
                      {app.status === "accepted" && (
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" />Aceptado
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(project.status === "active" || project.status === "delivered") && (
              <div className="mt-4">
                {releaseError[project.id] && (
                  <p className="text-xs text-red-600 mb-2">{releaseError[project.id]}</p>
                )}
                <Button onClick={() => handleRelease(project)} isLoading={releasing === project.id}
                  className="bg-green-600 hover:bg-green-700 gap-1.5">
                  <CheckCircle className="h-4 w-4" />Aprobar y liberar pago
                </Button>
              </div>
            )}

            {project.status === "completed" && (
              <p className="mt-4 text-sm text-green-600 font-medium flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />Pago liberado al estudiante
              </p>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
