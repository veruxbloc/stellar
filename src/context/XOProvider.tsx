"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { XOConnectProvider } from "xo-connect";

const provider = new XOConnectProvider({ debug: false });

interface XOContextType {
  address: string | null;
  chainId: string;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const XOContext = createContext<XOContextType | undefined>(undefined);

export function XOProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string>("");

  useEffect(() => {
    provider.on("accountsChanged", (accounts: string[]) => {
      setAddress(accounts[0] || null);
    });

    provider.on("chainChanged", (newChainId: string) => {
      setChainId(newChainId);
    });
  }, []);

  async function connect() {
    // Intentar xo-connect (Beexo mobile)
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      if (Array.isArray(accounts) && accounts.length > 0) {
        setAddress(accounts[0]);
        const chain = await provider.request({ method: "eth_chainId" });
        setChainId(chain);
        return;
      }
    } catch {
      // Beexo no disponible, usar MetaMask
    }

    // Fallback: MetaMask / window.ethereum (desktop)
    try {
      const win = window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string[]> } };
      if (win.ethereum) {
        const accounts = await win.ethereum.request({ method: "eth_requestAccounts" });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          const chain = await win.ethereum.request({ method: "eth_chainId" } as never);
          setChainId(chain as unknown as string);
        }
      } else {
        alert("Instalá MetaMask en PC o usá Beexo desde el celular.");
      }
    } catch (error) {
      console.error("Error conectando wallet:", error);
    }
  }

  function disconnect() {
    setAddress(null);
    setChainId("");
  }

  return (
    <XOContext.Provider value={{ address, chainId, isConnected: !!address, connect, disconnect }}>
      {children}
    </XOContext.Provider>
  );
}

export function useXO() {
  const context = useContext(XOContext);
  if (!context) throw new Error("useXO must be used within XOProvider");
  return context;
}
