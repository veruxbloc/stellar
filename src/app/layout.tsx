import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Manrope } from "next/font/google";
import "./globals.css";
import { XOProvider } from "@/context/XOProvider";
import { MarketplaceProvider } from "@/context/MarketplaceContext";
import { AuthProvider } from "@/context/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FloatingAgent } from "@/components/FloatingAgent";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Verux | Portal Web3",
  description: "Tokeniza el potencial humano a través de un ecosistema descentralizado diseñado para la excelencia y la transparencia institucional.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`light ${plusJakartaSans.variable} ${manrope.variable}`}>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />
      </head>
      <body className="min-h-screen bg-background text-on-background flex flex-col selection:bg-primary-container selection:text-on-primary-container">
        <XOProvider>
          <MarketplaceProvider>
            <AuthProvider>
              <Navbar />
              <main className="flex-1">
                {children}
              </main>
              <FloatingAgent />
            </AuthProvider>
          </MarketplaceProvider>
        </XOProvider>
      </body>
    </html>
  );
}
