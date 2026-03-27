"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/auth/login"); return; }

    // Redirect based on role stored in users table
    async function redirect() {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase.from("users").select("role").eq("id", user!.id).single();
      if (data?.role === "company") router.replace("/company/dashboard");
      else router.replace("/student/dashboard");
    }
    redirect();
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Redirigiendo...</p>
    </div>
  );
}
