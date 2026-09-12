"use client";

import { ensAppUrl, ensChainLabel } from "@apiritivo/ens";
import { setPrimaryName } from "@apiritivo/ens/browser";
import type { Address } from "@apiritivo/payments";
import { useState } from "react";
import { forgetEnsName } from "@/lib/use-ens";
import { Button } from "./ui";

const fieldCls = "field-control font-mono";

/**
 * Let the connected wallet pick the ENS name it is shown as. The name must
 * already resolve to the wallet; the wallet signs the reverse record itself.
 */
export function EnsClaimName({ address, onDone }: { address: Address; onDone?: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const hash = await setPrimaryName(address, name);
      setTx(hash);
      forgetEnsName(address);
      window.dispatchEvent(new Event("apiritivo:ens-name-changed"));
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-3 py-2 text-xs">
      <p className="text-muted">Show a name instead of the address</p>
      <div className="mt-2 flex gap-2">
        <input
          className={`${fieldCls} min-w-0 flex-1`}
          placeholder="yourname.eth"
          value={name}
          onChange={(e) => setName(e.target.value)}
          spellCheck={false}
          autoCapitalize="none"
        />
        <Button size="sm" onClick={submit} disabled={busy || !/\.eth$/i.test(name.trim())}>
          {busy ? "Confirm…" : "Set"}
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-subtle">The name must already point to this wallet on {ensChainLabel()}. Your wallet signs one transaction there.</p>
      {tx ? (
        <p className="mt-1.5 text-[11px] text-olive-400">
          Sent. The name appears once the block is mined.{" "}
          <a href={ensAppUrl(name.trim().toLowerCase())} target="_blank" rel="noreferrer" className="underline">
            ENS app ↗
          </a>
        </p>
      ) : null}
      {error ? <p className="mt-1.5 text-[11px] text-rose-300">{error}</p> : null}
    </div>
  );
}
