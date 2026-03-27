"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !data.user) {
      setError(signInError?.message ?? "Credenciales incorrectas");
      setLoading(false);
      return;
    }

    // Obtener rol del usuario desde la DB
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", data.user.id)
      .single();

    router.push(userData?.role === "company" ? "/company/dashboard" : "/student/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 pt-20">
      <div className="w-full max-w-md">

        <div className="mb-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-[1px] w-8 bg-primary" />
            <span className="font-[family-name:var(--font-plus-jakarta)] font-bold uppercase tracking-[0.3em] text-primary text-xs">
              Acceso
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-plus-jakarta)] font-extrabold text-4xl uppercase tracking-tighter text-on-surface mb-2">
            Iniciar sesión
          </h1>
          <p className="font-[family-name:var(--font-manrope)] text-on-surface-variant text-sm">
            Ingresá con tu cuenta para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-container border border-outline-variant/20 p-8 space-y-6">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors"
              placeholder="Tu contraseña"
            />
          </div>

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
            {loading ? "INGRESANDO..." : "INGRESAR"}
          </button>

          <p className="text-center font-[family-name:var(--font-manrope)] text-sm text-on-surface-variant">
            ¿No tenés cuenta?{" "}
            <Link href="/auth/register" className="text-primary font-semibold hover:text-primary-fixed-dim transition-colors">
              Registrarse
            </Link>
          </p>
        </form>

      </div>
    </div>
  );
}
