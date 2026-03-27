"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";

interface Company {
  id: string;
  name: string;
  industry: string;
  description: string;
}

export default function CompanyDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
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

      const { data: companyData } = await supabase
        .from("companies")
        .select("id, name, industry, description")
        .eq("user_id", user!.id)
        .single();

      if (companyData) {
        setCompany(companyData);

        const { count: postsCount } = await supabase
          .from("job_posts")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyData.id);

        setJobPostsCount(postsCount ?? 0);
      }

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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-16 space-y-8">
        
        {/* Header / Welcome */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-on-background tracking-tight font-[family-name:var(--font-plus-jakarta)]">
              Bienvenida{company ? `, ${company.name}` : ""}
            </h1>
            <p className="text-secondary text-sm mt-1">Gestioná tus ofertas laborales y encontrá talento certificado.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="glass-card bg-surface-container-lowest rounded-3xl p-4 sm:p-6 shadow-ambient flex items-center gap-5 hover:translate-y-[-4px] transition-transform duration-300">
            <div className="brand-gradient rounded-2xl w-14 h-14 flex items-center justify-center shrink-0 shadow-lg text-white">
              <span className="material-symbols-outlined text-3xl">work</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Ofertas publicadas</p>
              <p className="text-4xl font-black text-on-background tracking-tight">{jobPostsCount}</p>
            </div>
          </div>

          <div className="glass-card bg-surface-container-lowest rounded-3xl p-4 sm:p-6 shadow-ambient flex items-center gap-5 hover:translate-y-[-4px] transition-transform duration-300">
            <div className="brand-gradient rounded-2xl w-14 h-14 flex items-center justify-center shrink-0 shadow-lg text-white">
              <span className="material-symbols-outlined text-3xl">school</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Alumnos Certificados</p>
              <p className="text-4xl font-black text-on-background tracking-tight">{certifiedStudentsCount}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Company info card */}
          {company && (
            <div className="lg:col-span-1 bg-surface-container-lowest rounded-3xl shadow-ambient p-4 sm:p-8 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-surface-container-high flex items-center justify-center text-4xl mb-4 font-[family-name:var(--font-plus-jakarta)] font-black text-primary border-4 border-white shadow-xl">
                {company.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-xl font-bold text-on-background">{company.name}</h2>
              <span className="mt-1 px-3 py-1 bg-secondary-container text-on-secondary-container text-[10px] uppercase font-bold tracking-widest rounded-full">
                {company.industry}
              </span>
              <p className="text-sm text-secondary mt-6 leading-relaxed">
                {company.description}
              </p>
            </div>
          )}

          {/* Navigation Hub */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <Link
              href="/company/jobs"
              className="bg-surface-container-lowest rounded-3xl shadow-ambient p-4 sm:p-6 hover:translate-y-[-4px] transition-all group flex flex-col justify-between"
            >
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                <span className="material-symbols-outlined">work_history</span>
              </div>
              <div>
                <p className="font-extrabold text-lg text-on-background font-[family-name:var(--font-plus-jakarta)]">Ofertas laborales</p>
                <p className="text-sm text-secondary mt-1">Publicá empleos y pasantías</p>
              </div>
            </Link>

            <Link
              href="/company/projects"
              className="bg-surface-container-lowest rounded-3xl shadow-ambient p-4 sm:p-6 hover:translate-y-[-4px] transition-all group flex flex-col justify-between"
            >
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface mb-4 group-hover:bg-[#f6896c] group-hover:text-white transition-colors">
                <span className="material-symbols-outlined">monetization_on</span>
              </div>
              <div>
                <p className="font-extrabold text-lg text-on-background font-[family-name:var(--font-plus-jakarta)]">Proyectos escrow</p>
                <p className="text-sm text-secondary mt-1">Gestioná pagos en RSK</p>
              </div>
            </Link>

            <Link
              href="/company/students"
              className="bg-surface-container-lowest rounded-3xl shadow-ambient p-4 sm:p-6 hover:translate-y-[-4px] transition-all group flex flex-col justify-between sm:col-span-2"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface group-hover:brand-gradient group-hover:text-white transition-colors shadow-sm group-hover:shadow-lg">
                  <span className="material-symbols-outlined">group</span>
                </div>
                <div>
                  <p className="font-extrabold text-lg text-on-background font-[family-name:var(--font-plus-jakarta)]">Explorar Estudiantes</p>
                  <p className="text-sm text-secondary mt-0.5">Buscador y verificación de talento con NFTs</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}
