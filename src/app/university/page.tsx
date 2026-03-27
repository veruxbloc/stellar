"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { GraduationCap } from "lucide-react";

const SKILL_GAP_DATA = [
  { skill: "React", demand: 85 },
  { skill: "Solidity", demand: 70 },
  { skill: "UI/UX", demand: 65 },
  { skill: "Python/IA", demand: 90 },
  { skill: "Node.js", demand: 75 },
];

const RETENTION_DATA = [
  { month: "Oct", rate: 60 },
  { month: "Nov", rate: 65 },
  { month: "Dic", rate: 70 },
  { month: "Ene", rate: 72 },
  { month: "Feb", rate: 78 },
  { month: "Mar", rate: 82 },
];

export default function UniversityPage() {
  const supabase = useMemo(() => createClient(), []);
  const [totalProjects, setTotalProjects] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [completedProjects, setCompletedProjects] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [{ count: total }, { count: completed }, { data: students }] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("certificates").select("student_id"),
      ]);

      setTotalProjects(total ?? 0);
      setCompletedProjects(completed ?? 0);
      if (students) {
        const unique = new Set(students.map((s) => s.student_id));
        setActiveStudents(unique.size);
      }
      setLoading(false);
    }
    fetchStats();
  }, [supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-blue-600" />
          <span className="font-bold text-slate-900 text-lg">Dashboard Universidad</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total proyectos", value: totalProjects },
            { label: "Estudiantes activos", value: activeStudents },
            { label: "Proyectos completados", value: completedProjects },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
              <p className="text-3xl font-bold text-slate-900">{kpi.value}</p>
              <p className="text-sm text-slate-500 mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Skill gap */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-6">Demanda de skills del mercado</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={SKILL_GAP_DATA}>
              <XAxis dataKey="skill" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="demand" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Retención */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-6">Retención de estudiantes (%)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={RETENTION_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </main>
    </div>
  );
}
