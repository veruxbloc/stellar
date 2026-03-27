"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { XOConnect, XOConnectProvider } from "xo-connect";
import { ethers } from "ethers";

const xoProvider = new XOConnectProvider({
  debug: false,
  rpcs: {
    "0x1f": "https://public-node.testnet.rsk.co", // RSK Testnet
  },
  defaultChainId: "0x1f",
});

interface XOContextType {
  address: string | null;
  chainId: string;
  isConnected: boolean;
  clientAlias: string | null;
  clientImage: string | null;
  connect: () => Promise<void>;
  connectBeexo: () => Promise<void>;
  connectMetaMask: () => Promise<void>;
  disconnect: () => void;
  getSigner: () => Promise<ethers.Signer>;
}

const XOContext = createContext<XOContextType | undefined>(undefined);

export function XOProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string>("");
  const [clientAlias, setClientAlias] = useState<string | null>(null);
  const [clientImage, setClientImage] = useState<string | null>(null);

  useEffect(() => {
    xoProvider.on("accountsChanged", (accounts: string[]) => {
      setAddress(accounts[0] || null);
    });
    xoProvider.on("chainChanged", (newChainId: string) => {
      setChainId(newChainId);
    });

    // Detectar si estamos dentro de Beexo / xo-connect disponible
    xoProvider.request({ method: "eth_accounts" })
      .then((accounts) => {
        if (Array.isArray(accounts) && accounts.length > 0) {
          setAddress(accounts[0]);
          xoProvider.request({ method: "eth_chainId" }).then((c) => setChainId(c as string));
        }
      })
      .catch(() => {});
  }, []);

  // Conectar con Beexo (mobile)
  async function connectBeexo() {
    try {
      const { client } = await XOConnect.connect();
      if (client.alias) setClientAlias(client.alias);
      if (client.image) setClientImage(client.image);
      const currency = client.currencies?.find((c) => c.address) as { id: string; address: string; chainId?: string } | undefined;
      if (currency?.address) {
        setAddress(currency.address);
        if (currency.chainId) setChainId(currency.chainId);
        return;
      }
      const accounts = await xoProvider.request({ method: "eth_requestAccounts" });
      if (Array.isArray(accounts) && accounts.length > 0) {
        setAddress(accounts[0]);
        const chain = await xoProvider.request({ method: "eth_chainId" });
        setChainId(chain as string);
      }
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      if (e?.message?.includes("No connection available")) {
        alert("Instalá la app Beexo en tu celular para conectar tu wallet.");
      } else if (e?.code !== 4001) {
        console.warn("Beexo:", e?.message ?? err);
      }
    }
  }

  // Conectar con MetaMask (desktop)
  async function connectMetaMask() {
    try {
      const win = window as unknown as { ethereum?: ethers.Eip1193Provider & { request: (a: { method: string }) => Promise<string[]> } };
      if (!win.ethereum) {
        alert("MetaMask no está instalado. Descargalo en metamask.io");
        return;
      }
      const accounts = await win.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        const chain = await win.ethereum.request({ method: "eth_chainId" } as never);
        setChainId(chain as unknown as string);
      }
    } catch (error: unknown) {
      const e = error as { code?: number };
      if (e?.code === -32002) {
        alert("Abrí la extensión de MetaMask, hay una solicitud pendiente.");
      } else if (e?.code !== 4001) {
        console.error("MetaMask:", error);
      }
    }
  }

  // connect: auto-detecta dispositivo
  async function connect() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      await connectBeexo();
    } else {
      await connectMetaMask();
    }
  }

  // Devuelve un Signer de ethers usando el provider correcto
  async function getSigner(): Promise<ethers.Signer> {
    const win = window as unknown as { ethereum?: ethers.Eip1193Provider };
    if (win.ethereum) {
      const provider = new ethers.BrowserProvider(win.ethereum);
      return provider.getSigner();
    }
    const provider = new ethers.BrowserProvider(xoProvider as unknown as ethers.Eip1193Provider);
    return provider.getSigner();
  }

  function disconnect() {
    XOConnect.disconnect();
    setAddress(null);
    setChainId("");
    setClientAlias(null);
    setClientImage(null);
  }

  return (
    <XOContext.Provider value={{
      address,
      chainId,
      isConnected: !!address,
      clientAlias,
      clientImage,
      connect,
      connectBeexo,
      connectMetaMask,
      disconnect,
      getSigner,
    }}>
      {children}
    </XOContext.Provider>
  );
}

export function useXO() {
  const context = useContext(XOContext);
  if (!context) throw new Error("useXO must be used within XOProvider");
  return context;
}
