"use client";

import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { AgentChat } from "@/components/AgentChat";

export default function AgentPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/student/dashboard" className="text-slate-400 hover:text-slate-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Bot className="h-5 w-5 text-blue-600" />
          <span className="font-bold text-slate-900">Agente IA</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-slate-500 text-sm mb-6">
          Preguntale al agente sobre proyectos disponibles, estadísticas de la plataforma o estudiantes con habilidades específicas.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {[
            "¿Qué proyectos hay disponibles?",
            "Dame las estadísticas de la plataforma",
            "Buscá estudiantes de React",
          ].map((q) => (
            <span key={q} className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-full cursor-default">
              {q}
            </span>
          ))}
        </div>

        <AgentChat />
      </main>
    </div>
  );
}
