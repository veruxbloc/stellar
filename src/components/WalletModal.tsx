"use client";

import { useXO } from "@/context/XOProvider";

interface WalletModalProps {
  isOpen?: boolean;
  onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { connectBeexo, connectMetaMask } = useXO();

  const isMobile = /Android|iPhone|iPad|iPod/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );

  if (isOpen === false) return null;

  async function handleBeexo() {
    onClose();
    await connectBeexo();
  }

  async function handleMetaMask() {
    onClose();
    await connectMetaMask();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm mx-4 bg-surface-container border border-outline-variant/30">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-outline-variant/20">
          <div>
            <p className="font-[family-name:var(--font-plus-jakarta)] font-bold uppercase tracking-[0.2em] text-primary text-xs mb-1">
              Web3
            </p>
            <h2 className="font-[family-name:var(--font-plus-jakarta)] font-extrabold text-xl uppercase tracking-tight text-on-surface">
              Conectar Wallet
            </h2>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors text-xl font-bold">
            ✕
          </button>
        </div>

        {/* Opción recomendada según dispositivo */}
        <div className="px-6 pt-6 pb-3">
          <p className="font-[family-name:var(--font-plus-jakarta)] text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
            Recomendado para {isMobile ? "móvil" : "escritorio"}
          </p>

          {isMobile ? (
            <button
              onClick={handleBeexo}
              className="w-full flex items-center gap-5 p-5 bg-primary/10 hover:bg-primary/15 border border-primary/40 transition-all"
            >
              <div className="w-12 h-12 flex items-center justify-center bg-surface-container-low border border-outline-variant/20 shrink-0">
                <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none">
                  <rect width="40" height="40" rx="8" fill="#F5C518"/>
                  <path d="M20 8 L32 26 H8 Z" fill="#1A1A1A"/>
                </svg>
              </div>
              <div className="text-left flex-grow">
                <div className="font-[family-name:var(--font-plus-jakarta)] font-bold uppercase tracking-wide text-on-surface text-sm">Beexo</div>
                <div className="font-[family-name:var(--font-manrope)] text-on-surface-variant text-xs mt-0.5">Wallet móvil nativa</div>
              </div>
              <span className="text-[10px] font-[family-name:var(--font-plus-jakarta)] font-bold uppercase tracking-widest text-primary border border-primary/40 px-2 py-1">
                MEJOR OPCIÓN
              </span>
            </button>
          ) : (
            <button
              onClick={handleMetaMask}
              className="w-full flex items-center gap-5 p-5 bg-primary/10 hover:bg-primary/15 border border-primary/40 transition-all"
            >
              <div className="w-12 h-12 flex items-center justify-center bg-surface-container-low border border-outline-variant/20 shrink-0">
                <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none">
                  <rect width="40" height="40" rx="8" fill="#F6851B"/>
                  <path d="M32 8L22 15.5L24 11L32 8Z" fill="#fff"/>
                  <path d="M8 8L17.8 15.5L16 11L8 8Z" fill="#fff"/>
                  <path d="M20 24L14 21L20 32L26 21Z" fill="#fff"/>
                </svg>
              </div>
              <div className="text-left flex-grow">
                <div className="font-[family-name:var(--font-plus-jakarta)] font-bold uppercase tracking-wide text-on-surface text-sm">MetaMask</div>
                <div className="font-[family-name:var(--font-manrope)] text-on-surface-variant text-xs mt-0.5">Extensión de escritorio</div>
              </div>
              <span className="text-[10px] font-[family-name:var(--font-plus-jakarta)] font-bold uppercase tracking-widest text-primary border border-primary/40 px-2 py-1">
                MEJOR OPCIÓN
              </span>
            </button>
          )}
        </div>

        {/* Separador con otras opciones */}
        <div className="px-6 pb-3">
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-outline-variant/20" />
            <span className="font-[family-name:var(--font-plus-jakarta)] text-[10px] uppercase tracking-widest text-on-surface-variant">o también</span>
            <div className="flex-1 h-px bg-outline-variant/20" />
          </div>

          {isMobile ? (
            <button
              onClick={handleMetaMask}
              className="w-full flex items-center gap-5 p-4 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/20 hover:border-outline-variant transition-all"
            >
              <div className="w-10 h-10 flex items-center justify-center bg-surface-container-low border border-outline-variant/20 shrink-0">
                <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
                  <rect width="40" height="40" rx="8" fill="#F6851B"/>
                  <path d="M32 8L22 15.5L24 11L32 8Z" fill="#fff"/>
                  <path d="M8 8L17.8 15.5L16 11L8 8Z" fill="#fff"/>
                  <path d="M20 24L14 21L20 32L26 21Z" fill="#fff"/>
                </svg>
              </div>
              <div className="text-left">
                <div className="font-[family-name:var(--font-plus-jakarta)] font-bold uppercase tracking-wide text-on-surface text-xs">MetaMask</div>
                <div className="font-[family-name:var(--font-manrope)] text-on-surface-variant text-xs mt-0.5">Extensión de escritorio</div>
              </div>
            </button>
          ) : (
            <button
              onClick={handleBeexo}
              className="w-full flex items-center gap-5 p-4 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/20 hover:border-outline-variant transition-all"
            >
              <div className="w-10 h-10 flex items-center justify-center bg-surface-container-low border border-outline-variant/20 shrink-0">
                <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
                  <rect width="40" height="40" rx="8" fill="#F5C518"/>
                  <path d="M20 8 L32 26 H8 Z" fill="#1A1A1A"/>
                </svg>
              </div>
              <div className="text-left">
                <div className="font-[family-name:var(--font-plus-jakarta)] font-bold uppercase tracking-wide text-on-surface text-xs">Beexo</div>
                <div className="font-[family-name:var(--font-manrope)] text-on-surface-variant text-xs mt-0.5">Wallet móvil</div>
              </div>
            </button>
          )}
        </div>

        <div className="px-8 pb-6 text-center">
          <p className="font-[family-name:var(--font-manrope)] text-on-surface-variant text-xs">
            Al conectar aceptás los términos del protocolo.
          </p>
        </div>
      </div>
    </div>
  );
}
