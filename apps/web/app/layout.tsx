import type { Metadata } from "next";
import { Inter, Manrope, Source_Code_Pro } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ReadinessBeacon } from "@/components/readiness-beacon";
import { InjectedWalletProvider } from "@/lib/injected-wallet";
import { SessionProvider } from "@/lib/session";
import { SwarmWalletProvider } from "@/lib/swarm-wallet";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const heading = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const mono = Source_Code_Pro({ subsets: ["latin"], variable: "--font-code", display: "swap" });

export const metadata: Metadata = {
  title: "APIritivo | APIs for agents",
  description: "Discover and publish APIs that machines can understand. Swarm ID · Swarm · Arkiv.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${sans.variable} ${heading.variable} ${mono.variable}`}>
      <head>
        {/* Apply the saved choice or computer theme before first paint. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: no user data is interpolated */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <SessionProvider>
          <SwarmWalletProvider>
            <InjectedWalletProvider>
              <AppShell>{children}</AppShell>
              <ReadinessBeacon />
            </InjectedWalletProvider>
          </SwarmWalletProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
