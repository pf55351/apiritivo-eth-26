"use client";

import { AVAX_FAUCET_URL, explorerAddressUrl, explorerTokenUrl, explorerTxUrl, isContractMode, PAYMENT_CHAIN_NAME, USDC_FAUCET_URL } from "@apiritivo/payments";
import { claimEarnings, type ProviderStats, readProviderStats, transferUsdc } from "@apiritivo/payments/browser";
import { formatPriceUsdc } from "@apiritivo/shared";
import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { copyText } from "@/lib/format";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { Button, Disclosure, ErrorNotice } from "./ui";

const fieldCls = "field-control font-mono";

/**
 * Provider wallet section: the EVM account derived from the Swarm ID.
 * Shows balances, lets the provider reveal/export the private key, claim
 * contract earnings into this wallet (contract mode) and send USDC anywhere.
 */
export function SwarmWalletPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const wallet = useSwarmWallet();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<"withdraw" | "claim" | null>(null);
  const [claimTx, setClaimTx] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [sendTx, setSendTx] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const contractMode = isContractMode();

  const copy = async (label: string, value: string) => {
    if (await copyText(value)) {
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    }
  };

  const loadStats = useCallback(async () => {
    if (!wallet.address) return;
    setStats(await readProviderStats(wallet.address).catch(() => null));
  }, [wallet.address]);

  // Contract mode: show what is waiting in the contract as soon as the wallet is known.
  useEffect(() => {
    if (contractMode) void loadStats();
  }, [contractMode, loadStats, refreshKey]);

  async function withdraw() {
    if (!wallet.signer) return;
    setBusy("withdraw");
    setSendError(null);
    setSendTx(null);
    try {
      const hash = await transferUsdc(wallet.signer, to.trim() as Address, amount.trim());
      setSendTx(hash);
      setAmount("");
      await wallet.refreshBalances();
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function claim() {
    if (!wallet.signer) return;
    setBusy("claim");
    setClaimError(null);
    setClaimTx(null);
    try {
      // Always pull contract earnings into the Swarm wallet; moving them elsewhere is the next step.
      const hash = await claimEarnings(wallet.signer, wallet.address as Address);
      setClaimTx(hash);
      await Promise.all([wallet.refreshBalances(), loadStats()]);
    } catch (err) {
      setClaimError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-medium">Wallet</h2>
        <Button
          variant="subtle"
          size="sm"
          onClick={() => {
            void wallet.refreshBalances();
            if (contractMode) void loadStats();
          }}
        >
          Refresh
        </Button>
      </div>
      <p className="mt-1 text-xs text-subtle">{PAYMENT_CHAIN_NAME}</p>
      {wallet.status === "deriving" ? (
        <p role="status" className="mt-4 text-sm text-subtle">
          Preparing wallet…
        </p>
      ) : null}
      {wallet.status === "error" && wallet.error ? (
        <div className="mt-4">
          <ErrorNotice message={wallet.error.message} detail={wallet.error.detail} />
        </div>
      ) : null}
      {wallet.address ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <a href={explorerAddressUrl(wallet.address)} target="_blank" rel="noreferrer" title={wallet.address} className="font-mono text-xs text-muted hover:text-content">
              {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)} ↗
            </a>
            <Button variant="subtle" size="sm" onClick={() => copy("address", wallet.address!)}>
              {copied === "address" ? "Copied" : "Copy address"}
            </Button>
          </div>
          <div className="my-5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-subtle">Balance</p>
              <p className="mt-1 text-lg font-medium">{wallet.balances ? formatPriceUsdc(wallet.balances.usdc) : "…"}</p>
            </div>
            <div>
              <p className="text-xs text-subtle">AVAX for gas</p>
              <p className="mt-1 text-lg font-medium">{wallet.balances ? Number(wallet.balances.avax).toFixed(4) : "…"}</p>
            </div>
          </div>
          {contractMode ? (
            <div className="mb-5 border-t border-line pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-subtle">Ready to claim</p>
                  <p className="mt-1 text-xl font-medium text-accent-text">{stats ? formatPriceUsdc(stats.claimableUsdc) : "…"}</p>
                </div>
                <Button onClick={claim} disabled={busy !== null || !stats || Number(stats.claimableUsdc) <= 0}>
                  {busy === "claim" ? "Claiming…" : "Claim USDC"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-subtle">Moves earnings to this wallet.</p>
              {claimTx ? (
                <a href={explorerTxUrl(claimTx)} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center text-xs text-success">
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
          <Disclosure title="Send USDC">
            <p className="mb-4 text-xs text-subtle">Transfer from this wallet on {PAYMENT_CHAIN_NAME}.</p>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Recipient</span>
                <input className={fieldCls} placeholder="0x…" value={to} onChange={(e) => setTo(e.target.value)} spellCheck={false} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Amount in USDC</span>
                <input className={fieldCls} placeholder="0.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={withdraw} disabled={busy !== null || !/^0x[0-9a-fA-F]{40}$/.test(to.trim()) || !/^\d+(\.\d{1,6})?$/.test(amount.trim())}>
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
          </Disclosure>
          <Disclosure title="Add funds">
            <p className="break-all font-mono text-xs leading-6 text-muted">{wallet.address}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-subtle">
              <a className="py-2 hover:text-content" href={USDC_FAUCET_URL} target="_blank" rel="noreferrer">
                USDC faucet ↗
              </a>
              <a className="py-2 hover:text-content" href={AVAX_FAUCET_URL} target="_blank" rel="noreferrer">
                AVAX faucet ↗
              </a>
              <a className="py-2 hover:text-content" href={explorerTokenUrl()} target="_blank" rel="noreferrer">
                USDC contract ↗
              </a>
            </div>
          </Disclosure>
          <details
            className="ui-disclosure"
            onToggle={(event) => {
              if (!event.currentTarget.open) setRevealed(null);
            }}
          >
            <summary>
              Export wallet{" "}
              <span className="disclosure-chevron" aria-hidden="true">
                ⌄
              </span>
            </summary>
            <div className="pb-5">
              <p className="mb-3 text-xs text-subtle">Anyone with this private key controls your funds. Testnet only.</p>
              <Button variant="danger" size="sm" onClick={() => setRevealed(revealed ? null : wallet.revealPrivateKey())}>
                {revealed ? "Hide key" : "Reveal private key"}
              </Button>
              {revealed ? (
                <div className="mt-3 space-y-2">
                  <code className="block break-all font-mono text-xs text-muted">{revealed}</code>
                  <Button variant="subtle" size="sm" onClick={() => copy("key", revealed)}>
                    {copied === "key" ? "Copied" : "Copy key"}
                  </Button>
                </div>
              ) : null}
            </div>
          </details>
        </div>
      ) : null}
    </section>
  );
}
