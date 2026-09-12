"use client";

import { getService, listServices, listServicesByProvider } from "@apiritivo/arkiv";
import type { ArkivService } from "@apiritivo/shared";
import { useQuery } from "./use-query";

const loadAll = () => listServices();
const loadByProvider = (providerId: string) => listServicesByProvider(providerId);
const loadOne = (serviceId: string) => getService(serviceId);

export function useMarketplace() {
  return useQuery<ArkivService[]>("all", loadAll, "Could not load services from Arkiv.");
}

export function useProviderServices(providerId: string | null) {
  return useQuery<ArkivService[]>(providerId, loadByProvider, "Could not load your services from Arkiv.");
}

export function useService(serviceId: string | null) {
  return useQuery<ArkivService | null>(serviceId, loadOne, "Could not load this service from Arkiv.");
}
