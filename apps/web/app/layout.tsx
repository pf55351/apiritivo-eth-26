import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import { SwarmWalletProvider } from "@/lib/swarm-wallet";
import { AppShell } from "@/components/app-shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "APIperitivo — machine-readable service marketplace",
  description: "Discover and publish APIs that machines can understand. Swarm ID · Swarm · Arkiv.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
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
