"use client";

import { shortAddress } from "@/lib/identity";
import { useEnsName } from "@/lib/use-ens";

/**
 * An EVM address as people read it: its ENS primary name when the address has
 * one on the ENS chain, otherwise the shortened hex. The full address stays in
 * the tooltip so it can always be checked.
 */
export function AddressLabel({ address, className = "" }: { address: string; className?: string }) {
  const name = useEnsName(address);
  return (
    <span title={address} className={`${name ? "" : "font-mono"} ${className}`.trim()}>
      {name ?? shortAddress(address)}
    </span>
  );
}
