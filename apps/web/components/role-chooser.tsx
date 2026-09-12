"use client";

import { useRouter } from "next/navigation";
import { ROLE_HOME, type Role } from "@apiperitivo/shared";
import { useSession } from "@/lib/session";

const OPTIONS: { role: Role; title: string; subtitle: string; icon: string; blurb: string }[] = [
  {
    role: "client",
    title: "I'm a Client",
    subtitle: "Discover services",
    icon: "◎",
    blurb: "Browse the Arkiv registry, inspect Swarm manifests, find APIs your agents can call.",
  },
  {
    role: "provider",
    title: "I'm a Provider",
    subtitle: "Publish services",
    icon: "◈",
    blurb: "Describe your API, upload its manifest to Swarm and publish it to Arkiv in one flow.",
  },
];

export function RoleChooser({ compact = false }: { compact?: boolean }) {
  const session = useSession();
  const router = useRouter();

  return (
    <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
      {OPTIONS.map((opt) => {
        const active = session.role === opt.role;
        return (
          <button
            key={opt.role}
            type="button"
            onClick={() => {
              session.setRole(opt.role);
              router.push(ROLE_HOME[opt.role]);
            }}
            className={`card group flex flex-col items-start gap-3 rounded-3xl p-6 text-left ${
              active ? "border-spritz-400/60 shadow-glow" : ""
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-spritz-500/30 to-rose-400/20 text-2xl text-spritz-300 transition group-hover:scale-105">
              {opt.icon}
            </span>
            <span>
              <span className="block text-lg font-semibold">{opt.title}</span>
              <span className="block text-sm text-spritz-300">{opt.subtitle}</span>
            </span>
            <span className="text-sm text-ink-300">{opt.blurb}</span>
            {active ? <span className="text-[11px] font-semibold uppercase tracking-wider text-olive-400">Current role</span> : null}
          </button>
        );
      })}
    </div>
  );
}
