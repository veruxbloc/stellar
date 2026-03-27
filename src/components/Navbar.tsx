"use client";


import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Building2, LogOut, Briefcase } from "lucide-react";
import { useXO } from "@/context/XOProvider";
import { useAuth } from "@/context/AuthContext";
import { Button } from "./ui/Button";

function subscribe() {
  return () => {};
}

export function Navbar() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const { address, isConnected, connect, disconnect } = useXO();
  const { user, role, signOut } = useAuth();
  const router = useRouter();

  const truncated = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
            <Briefcase className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Talent<span className="text-blue-600">Chain</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {user && role === "student" && (
            <>
              <Link href="/student/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden sm:flex items-center gap-1">
                <GraduationCap className="h-4 w-4" /> Mi Panel
              </Link>
              <Link href="/student/certificates" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
                Certificados
              </Link>
            </>
          )}

          {user && role === "company" && (
            <>
              <Link href="/company/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden sm:flex items-center gap-1">
                <Building2 className="h-4 w-4" /> Mi Empresa
              </Link>
              <Link href="/company/jobs" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
                Ofertas
              </Link>
              <Link href="/company/students" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
                Estudiantes
              </Link>
            </>
          )}

          {!user && (
            <>
              <Link href="/auth/login">
                <Button variant="outline" size="sm">Ingresar</Button>
              </Link>
              <Link href="/auth/register">
                <Button size="sm">Registrarse</Button>
              </Link>
            </>
          )}

          {user && (
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-slate-500 hover:text-red-500 gap-1">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          )}

          {mounted ? (
            isConnected ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-mono text-slate-700 text-xs">{truncated}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={disconnect} className="text-slate-500 hover:text-red-500">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={connect} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                Conectar Wallet
              </Button>
            )
          ) : (
            <div className="w-32 h-10 bg-slate-100 animate-pulse rounded-xl" />
          )}
        </div>
      </div>
    </nav>
  );
}
