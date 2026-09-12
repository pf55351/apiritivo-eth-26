"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { formatPriceUsdc } from "@apiritivo/shared";
import { AVAX_FAUCET_URL, USDC_FAUCET_URL, explorerAddressUrl, explorerTokenUrl, explorerTxUrl, isContractMode, PAYMENT_CHAIN_NAME } from "@apiritivo/payments";
import { claimEarnings, readProviderStats, transferUsdc, type ProviderStats } from "@apiritivo/payments/browser";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { copyText } from "@/lib/format";
import { Button, ErrorNotice } from "./ui";

const fieldCls = "field-control font-mono";

/**
 * Provider wallet section: the EVM account derived from the Swarm ID.
 * Shows balances, lets the provider reveal/export the private key, claim
 * contract earnings into this wallet (contract mode) and send USDC anywhere.
 */
export function SwarmWalletPanel() {
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
  }, [contractMode, loadStats]);

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
    <section className="card rounded-3xl p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">Your Swarm wallet · {PAYMENT_CHAIN_NAME}</p>
      <h2 className="mt-1 text-xl font-semibold">Payout wallet derived from your Swarm ID</h2>
      <p className="mt-1 text-sm text-ink-300">
        Deterministically derived from your identity (Swarm ID <code className="font-mono">deriveAppSecret</code>). Same identity, same address, on every device. It receives USDC from sales and you can move the funds wherever you like.
      </p>

      {wallet.status === "deriving" ? <p className="mt-4 text-sm text-ink-400">Deriving wallet from Swarm ID…</p> : null}
      {wallet.status === "error" && wallet.error ? <div className="mt-4"><ErrorNotice message={wallet.error.message} detail={wallet.error.detail} /></div> : null}

      {wallet.address ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-white/15 bg-ink-900/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-ink-400">Address</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <a href={explorerAddressUrl(wallet.address)} target="_blank" rel="noreferrer" className="break-all font-mono text-xs text-ink-100 hover:text-spritz-300">
                {wallet.address} ↗
              </a>
              <button type="button" onClick={() => copy("address", wallet.address!)} className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-ink-300 hover:text-ink-100">
                {copied === "address" ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <a href={explorerTokenUrl()} target="_blank" rel="noreferrer" className="text-[11px] uppercase tracking-wider text-ink-400 hover:text-ink-200">
                  USDC ↗
                </a>
                <p className="font-semibold text-olive-400">{wallet.balances ? formatPriceUsdc(wallet.balances.usdc) : "…"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-400">AVAX (gas)</p>
                <p className="font-semibold">{wallet.balances ? Number(wallet.balances.avax).toFixed(4) : "…"}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-ink-400">
              Gas needed to move funds: <a className="underline hover:text-ink-200" href={AVAX_FAUCET_URL} target="_blank" rel="noreferrer">AVAX faucet</a> · test USDC:{" "}
              <a className="underline hover:text-ink-200" href={USDC_FAUCET_URL} target="_blank" rel="noreferrer">USDC faucet</a>
              <button type="button" onClick={() => void wallet.refreshBalances()} className="ml-2 underline hover:text-ink-200">refresh</button>
            </p>
          </div>

          {/* Private key */}
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-rose-100">Private key</p>
              <Button variant="danger" size="sm" onClick={() => setRevealed(revealed ? null : wallet.revealPrivateKey())}>
                {revealed ? "Hide" : "Reveal private key"}
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-rose-200/80">
              Import it into MetaMask to control this wallet outside APIritivo. Anyone with this key controls the funds. Testnet only.
            </p>
            {revealed ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="break-all rounded-lg bg-ink-900/80 px-2 py-1 font-mono text-[11px] text-rose-100">{revealed}</code>
                <button type="button" onClick={() => copy("key", revealed)} className="rounded-full border border-rose-400/40 px-2 py-0.5 text-[11px] text-rose-100 hover:bg-rose-400/10">
                  {copied === "key" ? "Copied ✓" : "Copy"}
                </button>
              </div>
            ) : null}
          </div>

          {/* Step 1 (contract mode): contract -> Swarm wallet */}
          {contractMode ? (
            <div className="rounded-2xl border border-spritz-300/30 bg-spritz-300/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Earnings held by the contract</p>
                <p className="font-semibold text-olive-400">{stats ? formatPriceUsdc(stats.claimableUsdc) : "…"}</p>
              </div>
              <p className="mt-1 text-[11px] text-ink-400">
                Sales go into the payments contract. Claim moves them to this Swarm wallet, signed with its key.
                {stats ? ` Lifetime earned: ${formatPriceUsdc(stats.totalEarnedUsdc)}.` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={claim} disabled={busy !== null || !stats || Number(stats.claimableUsdc) <= 0}>
                  {busy === "claim" ? "Claiming…" : "Claim to my Swarm wallet"}
                </Button>
                <button type="button" onClick={() => void loadStats()} className="text-xs text-ink-400 underline hover:text-ink-200">refresh</button>
              </div>
              {claimTx ? (
                <a href={explorerTxUrl(claimTx)} target="_blank" rel="noreferrer" className="mt-2 block break-all font-mono text-[11px] text-olive-400 hover:underline">
                  tx {claimTx} ↗
                </a>
              ) : null}
              {claimError ? <p className="mt-2 text-xs text-rose-300">{claimError}</p> : null}
            </div>
          ) : null}

          {/* Step 2: Swarm wallet -> any address */}
          <div className="rounded-2xl border border-white/15 bg-ink-900/40 p-3">
            <p className="text-sm font-semibold">Send USDC from this wallet</p>
            <p className="mt-1 text-[11px] text-ink-400">Signed with the Swarm wallet key. Use it to move funds to MetaMask or any other address.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <input className={fieldCls} placeholder="destination 0x… (e.g. your MetaMask)" value={to} onChange={(e) => setTo(e.target.value)} spellCheck={false} />
              <input className={fieldCls} placeholder="amount USDC" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={withdraw} disabled={busy !== null || !/^0x[0-9a-fA-F]{40}$/.test(to.trim()) || !/^\d+(\.\d{1,6})?$/.test(amount.trim())}>
                {busy === "withdraw" ? "Sending…" : "Send USDC"}
              </Button>
              {wallet.balances && Number(wallet.balances.usdc) > 0 ? (
                <button type="button" onClick={() => setAmount(wallet.balances!.usdc)} className="text-xs text-ink-400 underline hover:text-ink-200">send all</button>
              ) : null}
            </div>
            {sendTx ? (
              <a href={explorerTxUrl(sendTx)} target="_blank" rel="noreferrer" className="mt-2 block break-all font-mono text-[11px] text-olive-400 hover:underline">
                tx {sendTx} ↗
              </a>
            ) : null}
            {sendError ? <p className="mt-2 text-xs text-rose-300">{sendError}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
