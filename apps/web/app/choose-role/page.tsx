"use client";

import { AuthGate } from "@/components/auth-gate";
import { RoleChooser } from "@/components/role-chooser";
import { useSession } from "@/lib/session";

export default function ChooseRolePage() {
  const session = useSession();
  return (
    <AuthGate title="Sign in to choose a role">
      <div className="mx-auto max-w-3xl animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">Welcome {session.identity?.name}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">How do you want to use APIritivo?</h1>
        <p className="mt-2 text-sm text-ink-300">Your choice only sets your default experience. You can switch any time from the header.</p>
        <div className="mt-8">
          <RoleChooser />
        </div>
      </div>
    </AuthGate>
  );
}
