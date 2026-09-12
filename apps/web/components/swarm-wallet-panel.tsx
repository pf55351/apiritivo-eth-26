"use client";

import { ensChainLabel } from "@apiritivo/ens";
import { type Address, explorerAddressUrl, explorerTxUrl, PAYMENT_CHAIN_NAME } from "@apiritivo/payments";
import { claimEarnings, transferUsdc } from "@apiritivo/payments/browser";
import { formatPriceUsdc } from "@apiritivo/shared";
import { useState } from "react";
import { friendlyMessage } from "@/lib/errors";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { useCopy } from "@/lib/use-copy";
import { useResolvedRecipient } from "@/lib/use-ens";
import { useProviderStats } from "@/lib/use-provider-stats";
import { AddressLabel } from "./address-label";
import { RefreshButton } from "./refresh-button";
import { Button, Disclosure, ErrorNotice } from "./ui";
import { WalletBalances } from "./wallet-balances";

const fieldCls = "field-control font-mono";

/**
 * Earnings of the provider, on the Sales page: what the contract holds for
 * the Swarm-derived wallet and the Claim that moves it there, then the wallet
 * balance. Sending USDC elsewhere and exporting the key sit under Advanced.
 */
export function EarningsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const wallet = useSwarmWallet();
  const { copied, copy } = useCopy();
  const address = wallet.address;
  const { stats, reload: reloadStats, contractMode } = useProviderStats(address, refreshKey);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<"withdraw" | "claim" | null>(null);
  const [claimTx, setClaimTx] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [sendTx, setSendTx] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  // The recipient may be typed as an ENS name: the transfer goes to what it resolves to.
  const recipient = useResolvedRecipient(to);
  const recipientAddress: Address | null = recipient.status === "address" || recipient.status === "resolved" ? recipient.address : null;

  async function withdraw() {
    if (!wallet.signer || !recipientAddress) return;
    setBusy("withdraw");
    setSendError(null);
    setSendTx(null);
    try {
      const hash = await transferUsdc(wallet.signer, recipientAddress, amount.trim());
      setSendTx(hash);
      setAmount("");
      await wallet.refreshBalances();
    } catch (err) {
      setSendError(friendlyMessage(err, "USDC transfer failed."));
    } finally {
      setBusy(null);
    }
  }

  async function claim() {
    if (!wallet.signer || !address) return;
    setBusy("claim");
    setClaimError(null);
    setClaimTx(null);
    try {
      // Always pull contract earnings into the Swarm wallet; moving them elsewhere is the next step.
      const hash = await claimEarnings(wallet.signer, address);
      setClaimTx(hash);
      await Promise.all([wallet.refreshBalances(), reloadStats()]);
    } catch (err) {
      setClaimError(friendlyMessage(err, "Claim failed."));
    } finally {
      setBusy(null);
    }
  }

  if (wallet.status === "deriving" || !address) {
    return (
      <div className="pt-4">
        {wallet.status === "error" && wallet.error ? (
          <ErrorNotice message={wallet.error.message} detail={wallet.error.detail} />
        ) : (
          <p role="status" className="text-sm text-subtle">
            Preparing your Swarm wallet…
          </p>
        )}
      </div>
    );
  }

  return (
    <section className="min-w-0 pt-4" aria-label="Earnings">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-medium">Earnings</h2>
        <RefreshButton variant="subtle" onClick={async () => void (await Promise.all([wallet.refreshBalances(), reloadStats()]))} />
      </div>
      <div className="mt-4 grid gap-6 border-b border-line pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        {contractMode ? (
          <div>
            <p className="text-xs text-subtle">Ready to claim</p>
            <p className="mt-1 text-3xl font-medium text-accent-text">{stats ? formatPriceUsdc(stats.claimableUsdc) : "…"}</p>
            <p className="mt-1 text-xs text-subtle">Held by the contract until you claim it into your Swarm wallet.</p>
          </div>
        ) : (
          <p className="text-sm text-muted">Direct-transfer mode: every purchase is paid straight into your Swarm wallet.</p>
        )}
        {contractMode ? (
          <div className="sm:text-right">
            <Button size="lg" onClick={claim} disabled={busy !== null || !stats || Number(stats.claimableUsdc) <= 0}>
              {busy === "claim" ? "Claiming…" : "Claim USDC"}
            </Button>
            {claimTx ? (
              <a href={explorerTxUrl(claimTx)} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-success">
                Claim confirmed ↗
              </a>
            ) : null}
            {claimError ? (
              <p role="alert" className="mt-2 text-xs text-danger">
                {claimError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Swarm wallet · {PAYMENT_CHAIN_NAME}</p>
          <span className="flex flex-wrap items-center gap-2">
            <a href={explorerAddressUrl(address)} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-content">
              <AddressLabel address={address} /> ↗
            </a>
            <Button variant="subtle" size="sm" onClick={() => void copy("address", address)}>
              {copied === "address" ? "Copied" : "Copy address"}
            </Button>
          </span>
        </div>
        <div className="mt-4">
          <WalletBalances balances={wallet.balances} />
        </div>
      </div>
      <div className="mt-4">
        <Disclosure title="Advanced">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium">Send USDC</p>
              <p className="mt-1 mb-3 text-xs text-subtle">Transfer from the Swarm wallet to any address or ENS name on {PAYMENT_CHAIN_NAME}.</p>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">Recipient</span>
                  <input
                    className={fieldCls}
                    placeholder="0x… or name.eth"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    spellCheck={false}
                    aria-invalid={recipient.status === "unresolved" || recipient.status === "invalid" || undefined}
                    aria-describedby="send-recipient-hint"
                  />
                  <span id="send-recipient-hint" className={`mt-1 block min-h-4 text-[11px] ${recipient.status === "unresolved" ? "text-danger" : "text-subtle"}`}>
                    {recipient.status === "resolving"
                      ? `Resolving ${recipient.name}…`
                      : recipient.status === "resolved"
                        ? `${recipient.name} → ${recipient.address}`
                        : recipient.status === "unresolved"
                          ? `${recipient.name} has no address on ${ensChainLabel()}.`
                          : recipient.status === "invalid"
                            ? "Enter a 0x address or a .eth name."
                            : ""}
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">Amount in USDC</span>
                  <input className={fieldCls} placeholder="0.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={withdraw} disabled={busy !== null || !recipientAddress || !/^\d+(\.\d{1,6})?$/.test(amount.trim())}>
                  {busy === "withdraw" ? "Sending…" : "Send USDC"}
                </Button>
                {wallet.balances && Number(wallet.balances.usdc) > 0 ? (
                  <Button variant="subtle" size="sm" onClick={() => setAmount(wallet.balances!.usdc)}>
                    Max
                  </Button>
                ) : null}
              </div>
              {sendTx ? (
                <a href={explorerTxUrl(sendTx)} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center text-xs text-success">
                  Transfer confirmed ↗
                </a>
              ) : null}
              {sendError ? (
                <p role="alert" className="mt-2 text-xs text-danger">
                  {sendError}
                </p>
              ) : null}
            </div>
            <div className="border-t border-line pt-5">
              <p className="text-sm font-medium">Export wallet</p>
              <p className="mt-1 mb-3 text-xs text-subtle">Anyone with this private key controls your funds. Testnet only.</p>
              <Button variant="danger" size="sm" onClick={() => setRevealed(revealed ? null : wallet.revealPrivateKey())}>
                {revealed ? "Hide key" : "Reveal private key"}
              </Button>
              {revealed ? (
                <div className="mt-3 space-y-2">
                  <code className="block break-all font-mono text-xs text-muted">{revealed}</code>
                  <Button variant="subtle" size="sm" onClick={() => void copy("key", revealed)}>
                    {copied === "key" ? "Copied" : "Copy key"}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </Disclosure>
      </div>
    </section>
  );
}
