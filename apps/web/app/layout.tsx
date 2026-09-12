import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import { SwarmWalletProvider } from "@/lib/swarm-wallet";
import { AppShell } from "@/components/app-shell";

const sans = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code", display: "swap" });

export const metadata: Metadata = {
  title: "APIritivo — machine-readable service marketplace",
  description: "Discover and publish APIs that machines can understand. Swarm ID · Swarm · Arkiv.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <SessionProvider>
          <SwarmWalletProvider>
            <AppShell>{children}</AppShell>
          </SwarmWalletProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
