"use client";

import { ROLE_HOME, type Role } from "@apiritivo/shared";
import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { useSession } from "@/lib/session";

const OPTIONS: { role: Role; title: string; subtitle: string }[] = [
  {
    role: "client",
    title: "Client",
    subtitle: "Find APIs. Buy access. Build.",
  },
  {
    role: "provider",
    title: "Provider",
    subtitle: "Publish APIs. Manage earnings.",
  },
];

export function RoleChooser() {
  const session = useSession();
  const router = useRouter();

  return (
    <div className="divide-y divide-line border-y border-line">
      {OPTIONS.map((opt) => {
        const active = (session.role ?? "client") === opt.role;
        return (
          <button
            key={opt.role}
            type="button"
            disabled={!session.roleLoaded}
            onClick={() =>
              startTransition(() => {
                session.setRole(opt.role);
                router.push(ROLE_HOME[opt.role]);
              })
            }
            aria-pressed={active}
            className="group flex w-full items-center gap-4 py-6 text-left transition-colors hover:text-accent-text disabled:opacity-50"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-medium">{opt.title}</span>
              <span className="mt-1 block text-xs text-subtle">{opt.subtitle}</span>
            </span>
            <span className="text-xs text-accent-text">{active ? "Current" : <span aria-hidden="true">↗</span>}</span>
          </button>
        );
      })}
    </div>
  );
}
