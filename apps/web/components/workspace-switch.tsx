"use client";

import { ROLE_HOME } from "@apiritivo/shared";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { useSession } from "@/lib/session";
import { useView } from "@/lib/view";

export function WorkspaceSwitch() {
  const { setRole } = useSession();
  const { view: active, loaded: roleLoaded } = useView();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const next = active === "client" ? "provider" : "client";

  return (
    <div className="workspace-switch" aria-busy={pending} data-view={active}>
      <button
        type="button"
        role="switch"
        aria-label="Provider workspace"
        aria-checked={active === "provider"}
        title={`Switch to ${next === "provider" ? "Provider" : "Client"}`}
        disabled={!roleLoaded}
        aria-disabled={pending || !roleLoaded}
        onClick={() => {
          if (pending) return;
          startTransition(() => {
            setRole(next);
            // Keep the API open when switching between its provider overview
            // and client purchase actions. Other routes open the new workspace.
            if (!pathname.startsWith("/services/")) router.push(ROLE_HOME[next]);
          });
        }}
      >
        <span className="workspace-switch-track" aria-hidden="true">
          <span className="workspace-switch-thumb" />
        </span>
        <span className="workspace-switch-label" aria-hidden="true">
          <span data-role="client" data-active={active === "client"}>
            Client
          </span>
          <span data-role="provider" data-active={active === "provider"}>
            Provider
          </span>
        </span>
      </button>
      <span className="sr-only" role="status">
        {pending ? "Switching workspace…" : `${active === "provider" ? "Provider" : "Client"} workspace`}
      </span>
    </div>
  );
}
