"use client";

import {
  type BlockTiming,
  findGrant,
  findGrantForKey,
  getBlockTiming,
  listAccessPassesByBuyer,
  listAccessPassesForService,
  listSalesByProvider,
  secondsUntilBlock,
} from "@apiritivo/arkiv";
import type { AccessPass, Grant, Sale } from "@apiritivo/shared";
import { useEffect, useRef, useState } from "react";
import { watchPassTiming } from "./pass-timing";
import { newerBlockTiming } from "./query-state";
import { useQuery } from "./use-query";

function useLivePassTiming(key: string | null, passes: AccessPass[] | null, initialTiming: BlockTiming | null) {
  const [live, setLive] = useState<{ key: string | null; timing: BlockTiming } | null>(null);
  const timing = newerBlockTiming(initialTiming, live?.key === key ? live.timing : null);
  const timingRef = useRef(timing);
  timingRef.current = timing;
  useEffect(() => watchPassTiming(passes ?? [], timingRef.current, (next) => setLive({ key, timing: next })), [key, passes, initialTiming]);
  return timing;
}

const loadPassesForService = (k: string) => {
  const [s, b] = k.split("::");
  return listAccessPassesForService(s!, b!);
};

export function usePassesForService(serviceId: string | null, buyerId: string | null) {
  const key = serviceId && buyerId ? `${serviceId}::${buyerId}` : null;
  const query = useQuery<AccessPass[]>(key, loadPassesForService, "Could not load your access passes from Arkiv.", getBlockTiming);
  const timing = useLivePassTiming(key, query.data, query.timing);
  return { ...query, timing };
}

export function useMyPasses(buyerId: string | null) {
  const query = useQuery<AccessPass[]>(buyerId, listAccessPassesByBuyer, "Could not load your access passes from Arkiv.", getBlockTiming);
  const timing = useLivePassTiming(buyerId, query.data, query.timing);
  return { ...query, timing };
}

export function useProviderSales(providerId: string | null) {
  return useQuery<Sale[]>(providerId, listSalesByProvider, "Could not load your sales from Arkiv.", getBlockTiming);
}

const loadGrant = (k: string) => {
  const [s, b] = k.split("::");
  return findGrant(s!, b!);
};

/** The grant a buyer holds for a service's private file; `null` data = none yet. */
export function useGrant(serviceId: string | null, buyerId: string | null) {
  const key = serviceId && buyerId ? `${serviceId}::${buyerId}` : null;
  return useQuery<Grant | null>(key, loadGrant, "Could not check private file access on Arkiv.");
}

const loadGrantForKey = (k: string) => {
  const [s, pk] = k.split("::");
  return findGrantForKey(s!, pk!);
};

/**
 * The grant held by a Swarm ID key (ACT grantee) for a service's private
 * file. This, not the wallet, decides whether the signed-in Swarm ID can
 * decrypt; `null` data = none yet.
 */
export function useGrantForKey(serviceId: string | null, swarmKey: string | null) {
  const key = serviceId && swarmKey ? `${serviceId}::${swarmKey}` : null;
  return useQuery<Grant | null>(key, loadGrantForKey, "Could not check private file access on Arkiv.");
}

export function remainingSeconds(pass: AccessPass, timing: BlockTiming | null): number | null {
  return timing ? secondsUntilBlock(pass.expiresAtBlock, timing) : null;
}
