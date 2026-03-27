"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
type Role = "student" | "company";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
  const [career, setCareer] = useState("");
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role, name, university, career, industry }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Error al registrarse");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push(role === "student" ? "/student/dashboard" : "/company/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 pt-20 pb-10">
      <div className="w-full max-w-md">

        <div className="mb-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-[1px] w-8 bg-primary" />
            <span className="font-[family-name:var(--font-plus-jakarta)] font-bold uppercase tracking-[0.3em] text-primary text-xs">
              Registro
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-plus-jakarta)] font-extrabold text-4xl uppercase tracking-tighter text-on-surface mb-2">
            Crear cuenta
          </h1>
          <p className="font-[family-name:var(--font-manrope)] text-on-surface-variant text-sm">
            Elegí tu rol para comenzar.
          </p>
        </div>

        {/* Selector de rol */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setRole("student")}
            className={`flex flex-col items-center gap-2 p-5 border-2 transition-all font-[family-name:var(--font-plus-jakarta)] font-bold uppercase text-xs tracking-widest ${
              role === "student"
                ? "border-primary bg-primary/10 text-primary"
                : "border-outline-variant/30 bg-surface-container text-on-surface-variant hover:border-outline-variant"
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
            </svg>
            Estudiante
          </button>
          <button
            type="button"
            onClick={() => setRole("company")}
            className={`flex flex-col items-center gap-2 p-5 border-2 transition-all font-[family-name:var(--font-plus-jakarta)] font-bold uppercase text-xs tracking-widest ${
              role === "company"
                ? "border-primary bg-primary/10 text-primary"
                : "border-outline-variant/30 bg-surface-container text-on-surface-variant hover:border-outline-variant"
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
            Empresa
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-container border border-outline-variant/20 p-8 space-y-5">
          <div>
            <label className="block font-[family-name:var(--font-plus-jakarta)] text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              {role === "student" ? "Nombre completo" : "Nombre de la empresa"}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors"
              placeholder={role === "student" ? "Juan Pérez" : "Acme Corp"}
            />
          </div>

          <div>
            <label className="block font-[family-name:var(--font-plus-jakarta)] text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block font-[family-name:var(--font-plus-jakarta)] text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {role === "student" && (
            <>
              <div>
                <label className="block font-[family-name:var(--font-plus-jakarta)] text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                  Universidad
                </label>
                <input
                  type="text"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors"
                  placeholder="UBA, UTN, UADE..."
                />
              </div>
              <div>
                <label className="block font-[family-name:var(--font-plus-jakarta)] text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                  Carrera
                </label>
                <input
                  type="text"
                  value={career}
                  onChange={(e) => setCareer(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors"
                  placeholder="Ingeniería en Sistemas..."
                />
              </div>
            </>
          )}

          {role === "company" && (
            <div>
              <label className="block font-[family-name:var(--font-plus-jakarta)] text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                Industria
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors"
                placeholder="Tecnología, Finanzas..."
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-error bg-error-container/20 border border-error/20 px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary py-4 font-[family-name:var(--font-plus-jakarta)] font-extrabold tracking-widest uppercase text-sm hover:bg-primary-fixed-dim transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
          >
            {loading ? "CREANDO CUENTA..." : "CREAR CUENTA"}
          </button>

          <p className="text-center font-[family-name:var(--font-manrope)] text-sm text-on-surface-variant">
            ¿Ya tenés cuenta?{" "}
            <Link href="/auth/login" className="text-primary font-semibold hover:text-primary-fixed-dim transition-colors">
              Iniciar sesión
            </Link>
          </p>
        </form>

      </div>
    </div>
  );
}
