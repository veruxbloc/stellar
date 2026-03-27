"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useXO } from "@/context/XOProvider";
import { GraduationCap, BookOpen, Award, ChevronRight, Wallet, Coins, Bot } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface StudentProfile {
  id: string;
  name: string;
  university: string;
  career: string;
  bio: string;
}

function subscribe() {
  return () => {};
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { address, isConnected, connect, disconnect } = useXO();
  const supabase = useMemo(() => createClient(), []);

  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [certCount, setCertCount] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);
  const [walletSaved, setWalletSaved] = useState(false);
  const [walletError, setWalletError] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  // Fetch student profile and certificate count
  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      setProfileLoading(true);
      const { data: studentData } = await supabase
        .from("students")
        .select("id, name, university, career, bio")
        .eq("user_id", user!.id)
        .single();

      if (studentData) {
        setProfile(studentData as StudentProfile);

        const { count } = await supabase
          .from("certificates")
          .select("id", { count: "exact", head: true })
          .eq("student_id", studentData.id);

        setCertCount(count ?? 0);
      }

      setProfileLoading(false);
    }

    fetchData();
  }, [user, supabase]);

  // Save wallet address to Supabase when connected
  useEffect(() => {
    if (!user || !isConnected || !address || walletSaved) return;

    async function saveWallet() {
      setWalletError("");
      const { error } = await supabase
        .from("users")
        .update({ wallet_address: address })
        .eq("id", user!.id);

      if (error) {
        setWalletError("No se pudo guardar la wallet. Intentá de nuevo.");
      } else {
        setWalletSaved(true);
      }
    }

    saveWallet();
  }, [isConnected, address, user, walletSaved, supabase]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Panel del estudiante</h1>
          <p className="text-slate-500 mt-1">Gestioná tu perfil, wallet y certificados</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">

          {/* Profile card */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <GraduationCap className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Mi perfil</h2>
            </div>

            {profileLoading ? (
              <div className="space-y-3">
                <div className="h-5 bg-slate-100 rounded-lg animate-pulse w-3/4" />
                <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-1/2" />
                <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-2/3" />
                <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            ) : profile ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Nombre</p>
                  <p className="text-base font-semibold text-slate-800">{profile.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Universidad</p>
                    <p className="text-sm text-slate-700">{profile.university}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Carrera</p>
                    <p className="text-sm text-slate-700">{profile.career}</p>
                  </div>
                </div>
                {profile.bio && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Sobre mí</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{profile.bio}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No se encontró perfil de estudiante.</p>
            )}
          </div>

          {/* Summary card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
                <Award className="h-5 w-5 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Resumen</h2>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center py-4">
              {profileLoading ? (
                <div className="h-12 w-16 bg-slate-100 rounded-lg animate-pulse" />
              ) : (
                <>
                  <span className="text-5xl font-bold text-blue-600">{certCount}</span>
                  <span className="text-sm text-slate-500 mt-1">
                    {certCount === 1 ? "certificado" : "certificados"}
                  </span>
                </>
              )}
            </div>

            <Link href="/student/certificates" className="mt-auto">
              <Button variant="outline" size="sm" className="w-full gap-2 mt-4">
                <BookOpen className="h-4 w-4" />
                Ver certificados
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Wallet section */}
        <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
              <Wallet className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Wallet Beexo</h2>
              <p className="text-sm text-slate-500">Conectá tu wallet para acuñar certificados NFT</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {mounted ? (
              isConnected ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-mono text-slate-700 text-sm">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  <Button variant="ghost" size="sm" onClick={disconnect} className="ml-2 text-slate-500 hover:text-red-500">
                    Desconectar
                  </Button>
                </div>
              ) : (
                <Button size="md" onClick={connect} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                  Conectar Wallet
                </Button>
              )
            ) : (
              <div className="w-36 h-10 bg-slate-100 animate-pulse rounded-xl" />
            )}

            {mounted && isConnected && (
              <div className="flex items-center gap-2">
                {walletSaved ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-xl border border-green-200">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Wallet guardada en tu perfil
                  </span>
                ) : walletError ? (
                  <span className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-xl border border-red-200">
                    {walletError}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    Guardando wallet…
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick link to certificates */}
        <div className="mt-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Mis certificados NFT</h3>
            <p className="text-blue-100 text-sm mt-0.5">Subí PDFs y acuñalos como NFTs en Sepolia</p>
          </div>
          <Link href="/student/certificates">
            <Button
              variant="secondary"
              size="md"
              className="gap-2 whitespace-nowrap"
            >
              <Award className="h-4 w-4" />
              Ir a certificados
            </Button>
          </Link>
        </div>


        {/* Projects escrow link */}
        <Link
          href="/student/projects"
          className="mt-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white flex items-center justify-between"
        >
          <div>
            <h3 className="text-lg font-semibold">Proyectos disponibles</h3>
            <p className="text-orange-100 text-sm mt-0.5">Encontrá proyectos con escrow en RSK</p>
          </div>
          <div className="flex items-center gap-2">
            <Coins className="h-6 w-6 text-white/80" />
            <ChevronRight className="h-5 w-5 text-white/80" />
          </div>
        </Link>

      </div>
    </div>
  );
}
