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

const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";
const TITLE = "APIritivo | Timed access for the AI era";
const DESCRIPTION = "Buy timed API access with USDC, or publish your API and earn. Swarm ID · Swarm · Arkiv.";

// app/opengraph-image.png and app/icon.png are picked up by the App Router; metadataBase makes their URLs absolute for link previews.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "APIritivo", title: TITLE, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${sans.variable} ${heading.variable} ${mono.variable}`}>
      <head>
        {/* Apply the saved choice (dark by default) before first paint. */}
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
