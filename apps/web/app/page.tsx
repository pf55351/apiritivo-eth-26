"use client";

import { arkivDataExplorerUrl } from "@apiritivo/arkiv";
import { explorerAddressUrl, explorerTokenUrl, paymentsContractAddress } from "@apiritivo/payments";
import { ROLE_HOME } from "@apiritivo/shared";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ApiExample } from "@/components/api-example";
import { Button, ErrorNotice, Eyebrow } from "@/components/ui";
import { publicEnv } from "@/lib/env";
import { useSession } from "@/lib/session";

const contractAddress = paymentsContractAddress();
const PILLARS = [
  { name: "Swarm ID", href: publicEnv.swarmIframeOrigin, link: "Identity" },
  { name: "Swarm", href: publicEnv.swarmGatewayUrl, link: "API manifests" },
  { name: "Arkiv", href: arkivDataExplorerUrl(), link: "API registry" },
  {
    name: "Avalanche",
    href: contractAddress ? explorerAddressUrl(contractAddress) : explorerTokenUrl(),
    link: contractAddress ? "contract on SnowTrace" : "USDC on SnowTrace",
  },
];

const JOURNEYS = {
  client: [
    ["Choose an API", "Review operations, price, and duration."],
    ["Get an access pass", "Pay in USDC on Avalanche Fuji."],
    ["Make your request", "Use your API key in any client."],
  ],
  provider: [
    ["Define operations", "Name each operation and its inputs."],
    ["Set your access", "Choose a USDC price and duration."],
    ["Publish your API", contractAddress ? "Claim earnings to your Swarm wallet." : "Receive USDC in your Swarm wallet."],
  ],
};

export default function HomePage() {
  const session = useSession();
  const router = useRouter();
  const pendingLogin = useRef(false);

  // Wait for this identity's saved view before completing a login from home.
  useEffect(() => {
    if (session.connecting) pendingLogin.current = true;
    if (pendingLogin.current && session.identity && session.roleLoaded) {
      pendingLogin.current = false;
      router.push(ROLE_HOME[session.role ?? "client"]);
    } else if (!session.connecting && !session.identity) {
      pendingLogin.current = false;
    }
  }, [session.connecting, session.identity, session.role, session.roleLoaded, router]);

  const loggedIn = Boolean(session.identity);
  const view = session.role ?? "client";
  const isProvider = view === "provider";

  if (!session.roleLoaded) {
    return (
      <p role="status" className="py-16 text-center text-sm text-subtle">
        Loading view…
      </p>
    );
  }

  return (
    <div>
      <section className="grid items-center gap-8 pb-10 pt-4 sm:pb-16 sm:pt-8 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pb-20 lg:pt-10">
        <div className="min-w-0">
          <Eyebrow>{isProvider ? "Publish on APIritivo" : "The API marketplace"}</Eyebrow>
          <h1 className="landing-title mt-5">
            {isProvider ? (
              <>
                Your APIs.<span className="block text-accent">Ready to earn.</span>
              </>
            ) : (
              <>
                APIs for the<span className="block text-accent">agent era.</span>
              </>
            )}
          </h1>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-muted">
            {isProvider ? "Publish your API, price your access, and earn USDC." : "Discover APIs. Buy access with USDC. Build with a single key."}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" href={isProvider ? "/provider/new" : "/marketplace"}>
              {isProvider ? "Publish API" : "Explore APIs"}
              <span aria-hidden="true">↗</span>
            </Button>
            {!loggedIn ? (
              <Button size="lg" variant="ghost" onClick={session.connect} disabled={session.status !== "ready" || session.connecting}>
                {session.status !== "ready" ? "Connecting…" : session.connecting ? "Complete sign in" : "Sign in"}
              </Button>
            ) : (
              <Button size="lg" variant="subtle" href={isProvider ? "/provider" : "/passes"}>
                {isProvider ? "My APIs" : "My passes"}
              </Button>
            )}
          </div>
          {session.status === "error" || session.error ? (
            <div className="mt-5">
              <ErrorNotice message={session.error ?? "Swarm ID login failed."} detail={session.errorDetail} onRetry={session.retry} />
            </div>
          ) : null}
        </div>
        <div className="landing-art relative min-w-0 overflow-hidden" aria-hidden="true">
          <Image
            src="/images/api-connection.png"
            alt=""
            width={1536}
            height={1024}
            priority
            sizes="(min-width: 1280px) 580px, (min-width: 1024px) 48vw, 100vw"
            className="h-auto w-full"
          />
        </div>
      </section>

      <section aria-labelledby="infrastructure-title" className="flex flex-col gap-5 border-y border-line py-6 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="infrastructure-title" className="text-sm font-normal text-subtle">
          Open infrastructure
        </h2>
        <div className="flex flex-wrap gap-x-7 gap-y-3 lg:gap-x-10">
          {PILLARS.map((pillar) => (
            <a
              key={pillar.name}
              href={pillar.href}
              title={pillar.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-2 text-sm font-medium text-muted hover:text-content"
            >
              {pillar.name}{" "}
              <span aria-hidden="true" className="text-sm text-subtle">
                ↗
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="grid gap-10 pt-12 sm:pt-16 lg:grid-cols-[0.8fr_1fr] lg:gap-20" aria-labelledby="workflow-title">
        <div className="min-w-0">
          <h2 id="workflow-title" className="max-w-sm text-2xl font-medium sm:text-3xl">
            {isProvider ? "Make your API discoverable." : "From discovery to request."}
          </h2>
          <ol className="mt-8 space-y-6">
            {JOURNEYS[view].map(([title, description]) => (
              <li key={title}>
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="mt-1 text-sm text-subtle">{description}</p>
              </li>
            ))}
          </ol>
          <Link href="/docs" className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-content">
            Read the docs <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <ApiExample key={view} initialFormat={isProvider ? "manifest" : "request"} />
      </section>
    </div>
  );
}
