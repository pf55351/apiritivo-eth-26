"use client";

import { AuthGate } from "@/components/auth-gate";
import { RoleChooser } from "@/components/role-chooser";
import { useSession } from "@/lib/session";

export default function ChooseRolePage() {
  const session = useSession();
  return (
    <AuthGate title="Sign in to continue">
      <div className="mx-auto max-w-3xl animate-fade-up">
        <p className="break-words text-sm text-subtle">Welcome {session.identity?.name}</p>
        <h1 className="mt-1 text-3xl font-medium sm:text-4xl">Choose your view</h1>
        <p className="mt-2 text-sm text-muted">Switch anytime from the header.</p>
        <div className="mt-8">
          <RoleChooser />
        </div>
      </div>
    </AuthGate>
  );
}
