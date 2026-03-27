import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { XOProvider } from "@/context/XOProvider";
import { MarketplaceProvider } from "@/context/MarketplaceContext";
import { AuthProvider } from "@/context/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FloatingAgent } from "@/components/FloatingAgent";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TalentChain | Conectamos estudiantes con empresas",
  description: "Plataforma de empleo y pasantías para estudiantes y recién graduados con certificación NFT.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className={`${inter.className} min-h-screen bg-slate-50 flex flex-col`}>
        <XOProvider>
            <MarketplaceProvider>
              <AuthProvider>
                <Navbar />
                <main className="flex-1">
                  {children}
                </main>
                <Footer />
                <FloatingAgent />
              </AuthProvider>
            </MarketplaceProvider>
        </XOProvider>
      </body>
    </html>
  );
}
