"use client";

import { useEffect, useRef } from "react";
import { publicEnv } from "@/lib/env";
import { SWARM_ID_FRAME_CONTAINER_ID, useSession } from "@/lib/session";
import { Button } from "./ui";

/** Keep the SDK iframe mounted: remounting it would lose the popup's receiver. */
export function SwarmSignIn() {
  const session = useSession();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (session.connecting && !dialog.open) dialog.showModal();
    if (!session.connecting && dialog.open) dialog.close();
  }, [session.connecting]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="swarm-sign-in-title"
      onCancel={session.cancelConnect}
      className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-3xl border border-white/15 bg-ink-950 p-6 text-ink-100 shadow-2xl backdrop:bg-black/70 sm:p-8"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">Swarm ID</p>
      <h2 id="swarm-sign-in-title" className="mt-2 text-2xl font-semibold">Connect your identity</h2>
      <p className="mt-3 text-sm text-ink-300">
        Use the Swarm ID button below, then approve {publicEnv.appName} in the window that opens.
      </p>
      <div id={SWARM_ID_FRAME_CONTAINER_ID} className="my-6 h-20 w-full" />
      <p className="text-xs text-ink-400">Keep this page open. This dialog closes once your identity is connected.</p>
      <div className="mt-6 flex justify-end">
        <Button variant="ghost" onClick={session.cancelConnect}>Close</Button>
      </div>
    </dialog>
  );
}
