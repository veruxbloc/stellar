"use client";

import { useSyncExternalStore, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useXO } from "@/context/XOProvider";
import { useAuth } from "@/context/AuthContext";
import { WalletModal } from "./WalletModal";

function subscribe() {
  return () => {};
}

export function Navbar() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const { address, isConnected, disconnect } = useXO();
  const { user, role, signOut } = useAuth();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const truncated = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 md:px-10 h-16 bg-white/70 backdrop-blur-xl shadow-[0_20px_50px_rgba(82,38,20,0.06)] border-b border-white/20">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform overflow-hidden">
              <img src="/logo.jpg" alt="Verux Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-extrabold text-on-background font-[family-name:var(--font-plus-jakarta)] tracking-tight group-hover:text-primary transition-colors">
              VeruxBloc
            </span>
          </Link>

          <nav className="hidden md:flex gap-6 font-[family-name:var(--font-plus-jakarta)] font-medium text-sm">
            {user && role === "student" && (
              <>
                <Link href="/student/dashboard" className="text-secondary hover:text-on-background transition-colors py-1">MI PANEL</Link>
                <Link href="/student/certificates" className="text-secondary hover:text-on-background transition-colors py-1">CERTIFICADOS</Link>
              </>
            )}
            {user && role === "company" && (
              <>
                <Link href="/company/dashboard" className="text-secondary hover:text-on-background transition-colors py-1">MI EMPRESA</Link>
                <Link href="/company/jobs" className="text-secondary hover:text-on-background transition-colors py-1">OFERTAS</Link>
                <Link href="/company/students" className="text-secondary hover:text-on-background transition-colors py-1">ESTUDIANTES</Link>
              </>
            )}
            {!user && (
              <Link href="/auth/login" className="text-secondary hover:text-on-background transition-colors py-1">EXPLORE</Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {!user && (
            <>
              <Link href="/auth/login">
                <button className="border border-outline-variant/30 text-primary px-6 py-2 font-[family-name:var(--font-plus-jakarta)] font-bold text-xs tracking-widest uppercase hover:bg-surface-container-high transition-all active:scale-95 rounded-full">
                  INGRESAR
                </button>
              </Link>
              <Link href="/auth/register">
                <button className="brand-gradient text-white px-6 py-2 font-[family-name:var(--font-plus-jakarta)] font-bold text-xs tracking-widest uppercase hover:brightness-110 transition-all active:scale-95 rounded-full shadow-lg">
                  REGISTRARSE
                </button>
              </Link>
            </>
          )}

          {user && (
            <button
              onClick={handleSignOut}
              className="border border-outline-variant/30 text-primary px-6 py-2 font-[family-name:var(--font-plus-jakarta)] font-bold text-xs tracking-widest uppercase hover:bg-surface-container-high transition-all rounded-full"
            >
              SALIR
            </button>
          )}

          {user && mounted ? (
            isConnected ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-full text-xs">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-mono text-on-surface-variant">{truncated}</span>
                </div>
                <button
                  onClick={disconnect}
                  className="text-secondary hover:text-error transition-colors text-xs uppercase tracking-widest font-bold"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowModal(true)}
                className="brand-gradient text-white px-6 py-2 font-[family-name:var(--font-plus-jakarta)] font-bold text-xs tracking-widest uppercase hover:brightness-110 transition-all active:scale-95 rounded-full shadow-lg"
              >
                CONNECT WALLET
              </button>
            )
          ) : null}

          <button
            className="text-primary p-2 hover:bg-surface-container-high transition-colors md:hidden rounded-xl"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Abrir menú"
          >
            <span className="material-symbols-outlined">{menuOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="md:hidden fixed top-16 left-0 w-full z-40 bg-white/95 backdrop-blur-xl border-b border-white/20 shadow-lg flex flex-col px-6 py-4 gap-3 font-[family-name:var(--font-plus-jakarta)] font-medium text-sm">
          {user && role === "student" && (
            <>
              <Link href="/student/dashboard" onClick={() => setMenuOpen(false)} className="text-secondary hover:text-on-background transition-colors py-2">MI PANEL</Link>
              <Link href="/student/certificates" onClick={() => setMenuOpen(false)} className="text-secondary hover:text-on-background transition-colors py-2">CERTIFICADOS</Link>
            </>
          )}
          {user && role === "company" && (
            <>
              <Link href="/company/dashboard" onClick={() => setMenuOpen(false)} className="text-secondary hover:text-on-background transition-colors py-2">MI EMPRESA</Link>
              <Link href="/company/jobs" onClick={() => setMenuOpen(false)} className="text-secondary hover:text-on-background transition-colors py-2">OFERTAS</Link>
              <Link href="/company/students" onClick={() => setMenuOpen(false)} className="text-secondary hover:text-on-background transition-colors py-2">ESTUDIANTES</Link>
            </>
          )}
          {!user && (
            <Link href="/auth/login" onClick={() => setMenuOpen(false)} className="text-secondary hover:text-on-background transition-colors py-2">EXPLORE</Link>
          )}
          <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/20">
            {!user && (
              <>
                <Link href="/auth/login" onClick={() => setMenuOpen(false)}>
                  <button className="w-full border border-outline-variant/30 text-primary px-6 py-2 font-bold text-xs tracking-widest uppercase hover:bg-surface-container-high transition-all active:scale-95 rounded-full">
                    INGRESAR
                  </button>
                </Link>
                <Link href="/auth/register" onClick={() => setMenuOpen(false)}>
                  <button className="w-full brand-gradient text-white px-6 py-2 font-bold text-xs tracking-widest uppercase hover:brightness-110 transition-all active:scale-95 rounded-full shadow-lg">
                    REGISTRARSE
                  </button>
                </Link>
              </>
            )}
            {user && (
              <button
                onClick={() => { setMenuOpen(false); handleSignOut(); }}
                className="w-full border border-outline-variant/30 text-primary px-6 py-2 font-bold text-xs tracking-widest uppercase hover:bg-surface-container-high transition-all rounded-full"
              >
                SALIR
              </button>
            )}
            {user && mounted && (
              isConnected ? (
                <div className="flex items-center gap-3 py-1">
                  <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-full text-xs">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-mono text-on-surface-variant">{truncated}</span>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); disconnect(); }}
                    className="text-secondary hover:text-error transition-colors text-xs uppercase tracking-widest font-bold"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setMenuOpen(false); setShowModal(true); }}
                  className="w-full brand-gradient text-white px-6 py-2 font-bold text-xs tracking-widest uppercase hover:brightness-110 transition-all active:scale-95 rounded-full shadow-lg"
                >
                  CONNECT WALLET
                </button>
              )
            )}
          </div>
        </div>
      )}

      {showModal && <WalletModal onClose={() => setShowModal(false)} />}
    </>
  );
}
