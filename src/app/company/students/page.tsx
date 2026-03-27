"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";

interface CertifiedStudent {
  id: string;
  name: string;
  university: string;
  career: string;
  certificateCount: number;
  latestTxHash: string | null;
  latestChain: string | null;
}

export default function CompanyStudentsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [students, setStudents] = useState<CertifiedStudent[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [universityFilter, setUniversityFilter] = useState("");
  const [careerFilter, setCareerFilter] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    async function fetchCertifiedStudents() {
      setDataLoading(true);

      const { data: certsData } = await supabase
        .from("certificates")
        .select(
          "student_id, tx_hash, chain, created_at, students(id, name, university, career)"
        )
        .order("created_at", { ascending: false });

      if (!certsData || certsData.length === 0) {
        setStudents([]);
        setDataLoading(false);
        return;
      }

      const studentMap = new Map<
        string,
        {
          studentData: { id: string; name: string; university: string; career: string };
          count: number;
          latestTxHash: string | null;
          latestChain: string | null;
        }
      >();

      for (const cert of certsData) {
        const studentInfo = cert.students as unknown as {
          id: string;
          name: string;
          university: string;
          career: string;
        } | null;

        if (!studentInfo) continue;

        const existing = studentMap.get(cert.student_id);
        if (existing) {
          existing.count += 1;
        } else {
          studentMap.set(cert.student_id, {
            studentData: studentInfo,
            count: 1,
            latestTxHash: cert.tx_hash ?? null,
            latestChain: cert.chain ?? null,
          });
        }
      }

      const result: CertifiedStudent[] = Array.from(studentMap.values()).map(
        ({ studentData, count, latestTxHash, latestChain }) => ({
          id: studentData.id,
          name: studentData.name,
          university: studentData.university,
          career: studentData.career,
          certificateCount: count,
          latestTxHash,
          latestChain,
        })
      );

      setStudents(result);
      setDataLoading(false);
    }

    fetchCertifiedStudents();
  }, [user, supabase]);

  const filtered = students.filter((s) => {
    const uniQuery = universityFilter.trim().toLowerCase();
    const careerQuery = careerFilter.trim().toLowerCase();
    return (
      (uniQuery === "" || s.university.toLowerCase().includes(uniQuery)) &&
      (careerQuery === "" || s.career.toLowerCase().includes(careerQuery))
    );
  });

  function clearFilters() {
    setUniversityFilter("");
    setCareerFilter("");
  }

  function getEtherscanUrl(txHash: string) {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const hasActiveFilters = universityFilter.trim() !== "" || careerFilter.trim() !== "";

  return (
    <div className="min-h-screen bg-surface-container-low">

      <main className="max-w-5xl mx-auto px-6 pt-24 pb-16 space-y-12">
        {/* Navigation back and Title */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-outline-variant/10 pb-8">
          <div className="flex items-center gap-4">
            <Link href="/company/dashboard" className="w-12 h-12 rounded-full glass-premium flex items-center justify-center text-on-surface hover:scale-105 transition-transform shadow-ambient shrink-0">
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-on-background font-[family-name:var(--font-plus-jakarta)] tracking-tight">
                Talento Verificado
              </h1>
              <p className="text-secondary text-sm mt-1 uppercase font-bold tracking-widest hidden sm:block">
                Explora perfiles respaldados por blockchain
              </p>
            </div>
          </div>
        </div>

        <section className="bg-surface-container-lowest rounded-[2.5rem] shadow-ambient p-8 glass-card border flex flex-col items-start gap-4 mb-10 overflow-hidden relative">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#E2C6F8]/20 rounded-full blur-3xl" />
          
          <div className="flex items-center gap-3 relative z-10 w-full mb-2">
            <span className="material-symbols-outlined text-primary text-2xl">person_search</span>
            <h2 className="text-lg font-bold text-on-background">Motor de Búsqueda de Talentos</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full relative z-10">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors">school</span>
              <input
                type="text" value={universityFilter} onChange={(e) => setUniversityFilter(e.target.value)}
                placeholder="Filtrar por Universidad (ej: UTN, UBA)"
                className="w-full bg-surface-container rounded-2xl pl-12 pr-4 py-4 text-on-background text-sm font-bold border-2 border-transparent focus:border-primary/20 focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-inner"
              />
            </div>
            
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors">history_edu</span>
              <input
                type="text" value={careerFilter} onChange={(e) => setCareerFilter(e.target.value)}
                placeholder="Filtrar por Carrera (ej: Sistemas)"
                className="w-full bg-surface-container rounded-2xl pl-12 pr-4 py-4 text-on-background text-sm font-bold border-2 border-transparent focus:border-primary/20 focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-inner"
              />
            </div>
          </div>
          
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-2 text-[10px] font-black uppercase tracking-widest text-[#a44222] bg-[#fdebe4] px-4 py-2 rounded-full hover:scale-105 active:scale-95 transition-transform flex items-center gap-2 relative z-10"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              Limpiar Búsqueda
            </button>
          )}
        </section>

        {/* Results grid */}
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">filter_list</span>
            {filtered.length} Perfiles Encontrados
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-[2.5rem] p-16 text-center border border-outline-variant/10 shadow-ambient glass-card">
            <span className="material-symbols-outlined text-6xl text-surface-container-highest mb-4">search_off</span>
            <p className="text-xl font-bold text-on-background mb-2">Sin coincidencias</p>
            <p className="text-secondary text-sm">
              {students.length === 0 
                ? "Ningún estudiante ha acuñado certificados hasta ahora."
                : "No encontramos talento con esos criterios. Intenta borrar los filtros."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((student) => (
              <div
                key={student.id}
                className="group relative bg-surface-container-lowest rounded-3xl p-6 shadow-ambient hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 border border-transparent hover:border-outline-variant/20 flex flex-col justify-between"
              >
                {/* Holographic accent glow on hover */}
                <div className="absolute inset-0 bg-gradient-to-tr from-[#E2C6F8]/0 to-[#F8A081]/0 group-hover:from-[#E2C6F8]/5 group-hover:to-[#F8A081]/10 rounded-3xl pointer-events-none transition-colors" />

                <div>
                  <div className="flex items-center gap-4 mb-6 relative">
                    <div className="brand-gradient w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg">
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-on-background line-clamp-1">{student.name}</h3>
                      <p className="text-[10px] uppercase font-black tracking-widest text-[#f8a287] border border-[#f8a287]/20 bg-[#f8a287]/10 px-2 py-0.5 rounded-lg mt-1 inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: '"FILL" 1' }}>verified</span>
                        Talento Validado
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 relative">
                    <div className="flex gap-3 items-start">
                      <span className="material-symbols-outlined text-secondary text-lg mt-0.5 opacity-50">school</span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-secondary">Universidad</p>
                        <p className="text-sm font-bold text-on-background leading-tight">{student.university}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 items-start">
                      <span className="material-symbols-outlined text-secondary text-lg mt-0.5 opacity-50">history_edu</span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-secondary">Carrera</p>
                        <p className="text-sm font-bold text-on-background">{student.career}</p>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start">
                      <span className="material-symbols-outlined text-primary text-lg mt-0.5">workspace_premium</span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Credenciales</p>
                        <p className="text-lg font-black text-on-background">
                          {student.certificateCount} <span className="text-[10px] uppercase text-secondary">NFTs</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Etherscan Link Bottom Area */}
                <div className="mt-8 pt-4 border-t border-outline-variant/10 relative z-10 flex justify-between items-center">
                  <span className="text-[8px] font-black tracking-widest uppercase text-secondary">Prueba Blockchain</span>
                  {student.latestTxHash ? (
                    <a
                      href={getEtherscanUrl(student.latestTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/btn flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#1c7841] hover:bg-[#e2f5e8] bg-surface hover:border-[#1c7841] border border-transparent transition-all px-3 py-1.5 rounded-full"
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      Etherscan
                    </a>
                  ) : (
                    <span className="text-[10px] font-bold text-secondary italic">Privado</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
