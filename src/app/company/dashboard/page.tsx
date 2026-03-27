"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Building2, Briefcase, GraduationCap, ChevronRight, LogOut, Coins } from "lucide-react";

interface Company {
  id: string;
  name: string;
  industry: string;
  description: string;
}

export default function CompanyDashboardPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [company, setCompany] = useState<Company | null>(null);
  const [jobPostsCount, setJobPostsCount] = useState(0);
  const [certifiedStudentsCount, setCertifiedStudentsCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      setDataLoading(true);

      // Fetch company profile
      const { data: companyData } = await supabase
        .from("companies")
        .select("id, name, industry, description")
        .eq("user_id", user!.id)
        .single();

      if (companyData) {
        setCompany(companyData);

        // Fetch job posts count for this company
        const { count: postsCount } = await supabase
          .from("job_posts")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyData.id);

        setJobPostsCount(postsCount ?? 0);
      }

      // Fetch total certified students in the platform (students with at least 1 certificate)
      const { data: certifiedData } = await supabase
        .from("certificates")
        .select("student_id");

      if (certifiedData) {
        const uniqueStudents = new Set(certifiedData.map((c) => c.student_id));
        setCertifiedStudentsCount(uniqueStudents.size);
      }

      setDataLoading(false);
    }

    fetchData();
  }, [user, supabase]);

  async function handleSignOut() {
    await signOut();
    router.push("/auth/login");
  }

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-slate-500 text-sm">Cargando panel...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-slate-900 text-lg">Panel de Empresa</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
            <LogOut className="h-4 w-4" />
            Salir
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Bienvenida{company ? `, ${company.name}` : ""}
          </h1>
          <p className="text-slate-500 mt-1">Gestioná tus ofertas laborales y encontrá talento certificado.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-4">
            <div className="bg-blue-100 rounded-xl p-3">
              <Briefcase className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Ofertas publicadas</p>
              <p className="text-3xl font-bold text-slate-900">{jobPostsCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-4">
            <div className="bg-emerald-100 rounded-xl p-3">
              <GraduationCap className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Estudiantes certificados</p>
              <p className="text-3xl font-bold text-slate-900">{certifiedStudentsCount}</p>
            </div>
          </div>
        </div>

        {/* Company info card */}
        {company && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Perfil de la empresa</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Nombre</p>
                <p className="text-slate-800 font-medium mt-0.5">{company.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Industria</p>
                <p className="text-slate-800 mt-0.5">{company.industry}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Descripción</p>
                <p className="text-slate-700 mt-0.5 leading-relaxed">{company.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/company/jobs"
            className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 rounded-xl p-2.5">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Ofertas laborales</p>
                  <p className="text-sm text-slate-500 mt-0.5">Publicá empleos y pasantías</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
            </div>
          </Link>

          <Link
            href="/company/projects"
            className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-orange-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 rounded-xl p-2.5">
                  <Coins className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Proyectos escrow</p>
                  <p className="text-sm text-slate-500 mt-0.5">Gestioná pagos en RSK</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-orange-500 transition-colors" />
            </div>
          </Link>

          <Link
            href="/company/students"
            className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 rounded-xl p-2.5">
                  <GraduationCap className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Estudiantes</p>
                  <p className="text-sm text-slate-500 mt-0.5">Explorá talento con NFT</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
