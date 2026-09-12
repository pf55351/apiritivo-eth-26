"use client";

import { getSwarmDrive, type SwarmDrive } from "@apiritivo/swarm";
import { useEffect, useState } from "react";
import { useSession } from "./session";
import { invalidateRequest, sharedRequest } from "./shared-request";

const KEY = "swarm-drive";

/**
 * The drive Swarm ID resolved for this app, read once per identity and
 * shared by every panel on the page. `undefined` = loading, `null` = no own
 * drive (subsidised upload) or unreadable. `tick` forces a fresh read.
 */
export function useSwarmDrive(tick = 0): SwarmDrive | null | undefined {
  const session = useSession();
  const identityId = session.identity?.id ?? null;
  const ownStamp = session.uploadMode === "user-stamp";
  const [drive, setDrive] = useState<SwarmDrive | null | undefined>(undefined);
  useEffect(() => {
    if (!identityId || !ownStamp) {
      setDrive(null);
      return;
    }
    let cancelled = false;
    setDrive(undefined);
    if (tick > 0) invalidateRequest(KEY);
    sharedRequest(`${KEY}:${identityId}`, getSwarmDrive)
      .then((d) => {
        if (!cancelled) setDrive(d);
      })
      .catch(() => {
        if (!cancelled) setDrive(null);
      });
    return () => {
      cancelled = true;
    };
  }, [identityId, ownStamp, tick]);
  return drive;
}
