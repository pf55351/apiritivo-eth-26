"use client";

import { getSwarmDrive, type SwarmDrive } from "@apiritivo/swarm";
import { useEffect, useState } from "react";
import { publicEnv } from "@/lib/env";
import { formatTtl, shortRef } from "@/lib/format";
import { useSession } from "@/lib/session";

const WARN_BELOW_SECONDS = 7 * 86_400;

/**
 * The drive (postage stamp) Swarm ID resolved for this app. Read-only by
 * design: the SDK only exposes the one stamp the app may spend, so the user
 * picks or renews drives in Swarm ID's Storage tab, which the link opens.
 */
export function SwarmDriveChip() {
  const session = useSession();
  const identityId = session.identity?.id ?? null;
  const ownStamp = session.uploadMode === "user-stamp";
  const [drive, setDrive] = useState<SwarmDrive | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setDrive(undefined);
    if (!identityId || !ownStamp) {
      setDrive(null);
      return;
    }
    getSwarmDrive()
      .then((d) => {
        if (!cancelled) setDrive(d);
      })
      .catch(() => {
        if (!cancelled) setDrive(null);
      });
    return () => {
      cancelled = true;
    };
  }, [identityId, ownStamp]);

  if (!ownStamp || drive === null) return null;

  const manageUrl = `${publicEnv.swarmIframeOrigin.replace(/\/+$/, "")}/`;
  const expiring = drive?.ttlSeconds !== undefined && drive.ttlSeconds < WARN_BELOW_SECONDS;
  const tone = expiring ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : "border-olive-400/30 bg-olive-400/10 text-olive-400";

  return (
    <a
      href={manageUrl}
      target="_blank"
      rel="noreferrer"
      title={drive ? `Drive ${drive.batchId} · manage in Swarm ID` : "Loading drive…"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] hover:opacity-80 ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {drive === undefined ? (
        <span>drive …</span>
      ) : (
        <span>
          drive {drive.label ? `${drive.label} · ` : ""}
          {shortRef(drive.batchId)} · {drive.usedPercent}% used
          {drive.ttlSeconds !== undefined ? ` · ${formatTtl(drive.ttlSeconds)} left` : ""}
          {expiring ? " ⚠" : ""}
        </span>
      )}
      <span aria-hidden="true">↗</span>
    </a>
  );
}
