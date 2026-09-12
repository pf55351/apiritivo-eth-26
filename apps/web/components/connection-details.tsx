"use client";

import { AVAX_FAUCET_URL, explorerAddressUrl, PAYMENT_CHAIN_NAME, USDC_FAUCET_URL } from "@apiritivo/payments";
import { formatPriceUsdc } from "@apiritivo/shared";
import type { SwarmConnectionInfo, SwarmDrive } from "@apiritivo/swarm";
import type { ReactNode } from "react";
import { publicEnv } from "@/lib/env";
import { formatTtl } from "@/lib/format";
import { DRIVE_WARN_BELOW_SECONDS } from "@/lib/readiness";
import { useSession } from "@/lib/session";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { useCopy } from "@/lib/use-copy";
import { useSwarmDrive } from "@/lib/use-swarm-drive";
import { useWriterStatus, type WriterStatus as WriterStatusValue } from "@/lib/use-writer-status";
import { AddressLabel } from "./address-label";
import { Disclosure, RefField, StatusDot } from "./ui";

/** Writer health as shown here: `null` = unreachable. */
export type WriterStatus = WriterStatusValue | null;

function ConnectionLink({ href, children, title }: { href: string; children: ReactNode; title?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" title={title} className="inline-flex min-h-11 items-center gap-1 rounded-control text-xs text-accent-text hover:underline">
      {children} <span aria-hidden="true">↗</span>
    </a>
  );
}

/** Flat presentation shared with the UI library; all values come from the active session. */
export function ConnectionDetails({
  identity,
  canUpload,
  uploadMode,
  drive,
  writer,
  manageUrl,
}: {
  identity: { id: string; name: string };
  canUpload: boolean;
  uploadMode?: SwarmConnectionInfo["uploadMode"];
  drive: SwarmDrive | null | undefined;
  writer: WriterStatus;
  manageUrl: string;
}) {
  const ownDrive = uploadMode === "user-stamp";
  const expiring = drive?.ttlSeconds !== undefined && drive.ttlSeconds < DRIVE_WARN_BELOW_SECONDS;
  const usable = canUpload && (!ownDrive || drive?.usable !== false);
  const balance = writer?.balance !== undefined && Number.isFinite(Number(writer.balance)) ? Number(writer.balance).toFixed(3) : null;

  return (
    <Disclosure title="Connection details">
      <div className="divide-y divide-line">
        <div className="grid min-w-0 gap-x-8 gap-y-2 py-4 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-center">
          <p className="text-sm font-medium">Swarm ID</p>
          <p className="min-w-0 break-words text-sm text-muted">{identity.name}</p>
          <RefField label="Identity ID" value={identity.id} />
        </div>
        <div className="grid min-w-0 gap-x-8 gap-y-2 py-4 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-center">
          <p className="text-sm font-medium">Swarm storage</p>
          <div className="min-w-0 space-y-1">
            <StatusDot tone={!usable || expiring ? "warning" : "success"}>{!usable ? "Unavailable" : expiring ? "Renew soon" : "Ready"}</StatusDot>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums text-muted">
              {ownDrive ? (
                drive ? (
                  <>
                    <span className="max-w-full truncate" title={`Drive ${drive.batchId}`}>
                      {drive.label || "Own drive"}
                    </span>
                    <span>{drive.usedPercent}% used</span>
                    {drive.ttlSeconds !== undefined ? (
                      <span className={expiring ? "text-warning" : undefined}>{drive.ttlSeconds <= 0 ? "Expired" : `${formatTtl(drive.ttlSeconds)} left`}</span>
                    ) : null}
                  </>
                ) : (
                  <span>{drive === undefined ? "Loading drive…" : "Drive details unavailable"}</span>
                )
              ) : uploadMode === "subsidised" ? (
                <span>Shared gateway</span>
              ) : null}
            </div>
          </div>
          <div>
            <ConnectionLink href={manageUrl}>Manage storage</ConnectionLink>
          </div>
        </div>
        <div className="grid min-w-0 gap-x-8 gap-y-2 py-4 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-center">
          <p className="text-sm font-medium">Arkiv writer</p>
          <div className="min-w-0 space-y-1">
            <StatusDot tone={!writer ? "subtle" : !writer.writerConfigured || writer.funded === false ? "warning" : writer.funded ? "success" : "subtle"}>
              {!writer ? "Unavailable" : !writer.writerConfigured ? "Not configured" : writer.funded === undefined ? "Balance unavailable" : writer.funded ? "Funded" : "Needs GLM"}
            </StatusDot>
            {balance !== null ? (
              <p className="text-sm font-medium tabular-nums" title={`${writer?.balance} GLM`}>
                {balance} GLM
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4">
            {writer?.explorerUrl ? (
              <ConnectionLink href={writer.explorerUrl} title={writer.address}>
                Address
              </ConnectionLink>
            ) : null}
            {writer?.dataExplorerUrl ? <ConnectionLink href={writer.dataExplorerUrl}>Registry</ConnectionLink> : null}
            {writer?.writerConfigured && writer.funded === false ? <ConnectionLink href={writer.faucetUrl}>Fund writer</ConnectionLink> : null}
          </div>
        </div>
      </div>
    </Disclosure>
  );
}

function MenuLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1 text-accent-text hover:underline">
      {children} <span aria-hidden="true">↗</span>
    </a>
  );
}

/** Storage and writer health of the session, shared by the rows and the tab that summarises them. */
function useConnectionHealth() {
  const session = useSession();
  const drive = useSwarmDrive();
  const writer = useWriterStatus(Boolean(session.identity)) ?? null;
  const ownDrive = session.uploadMode === "user-stamp";
  const expiring = drive?.ttlSeconds !== undefined && drive.ttlSeconds < DRIVE_WARN_BELOW_SECONDS;
  const usable = session.canUpload && (!ownDrive || drive?.usable !== false);
  const writerTone: "subtle" | "warning" | "success" = !writer ? "subtle" : !writer.writerConfigured || writer.funded === false ? "warning" : writer.funded ? "success" : "subtle";
  return { session, drive, writer, ownDrive, expiring, usable, writerTone };
}

/** Whether the Connection tab should flag something: storage unusable or expiring, writer missing or unfunded. */
export function useConnectionAttention(): boolean {
  const { usable, expiring, writerTone } = useConnectionHealth();
  return !usable || expiring || writerTone === "warning";
}

/**
 * The same facts as `ConnectionDetails`, as narrow rows for the account
 * dropdown of the Provider workspace: identity id, Swarm storage, Arkiv writer.
 */
export function ConnectionRows() {
  const { session, drive, writer, ownDrive, expiring, usable, writerTone } = useConnectionHealth();
  const { copied, copy } = useCopy();
  const identity = session.identity;
  if (!identity) return null;

  const balance = writer?.balance !== undefined && Number.isFinite(Number(writer.balance)) ? Number(writer.balance).toFixed(3) : null;
  const storage = ownDrive
    ? drive
      ? [
          drive.label || "Own drive",
          `${drive.usedPercent}% used`,
          drive.ttlSeconds !== undefined ? (drive.ttlSeconds <= 0 ? "expired" : `${formatTtl(drive.ttlSeconds)} left`) : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : drive === undefined
        ? "Loading drive…"
        : "Drive details unavailable"
    : session.uploadMode === "subsidised"
      ? "Shared gateway"
      : "No storage";
  const manageUrl = `${publicEnv.swarmIframeOrigin.replace(/\/+$/, "")}/`;

  const writerState = !writer ? "Unavailable" : !writer.writerConfigured ? "Not configured" : writer.funded === undefined ? "Unknown" : writer.funded ? "Funded" : "Needs GLM";
  const head = "flex items-center justify-between gap-3";
  const detail = "mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-subtle";
  const dot = <span aria-hidden="true">·</span>;

  return (
    <div className="px-3 py-2">
      <dl className="space-y-4 text-xs">
        <div>
          <dt className={head}>
            <span className="font-medium text-content">Swarm ID</span>
          </dt>
          <dd className={detail}>
            <span className="font-mono text-muted" title={identity.id}>
              {identity.id.slice(0, 8)}…{identity.id.slice(-4)}
            </span>
            {dot}
            <button type="button" className="min-h-9 rounded-control text-accent-text hover:underline" onClick={() => void copy("id", identity.id)}>
              {copied === "id" ? "Copied" : "Copy id"}
            </button>
          </dd>
        </div>
        <div>
          <dt className={head}>
            <span className="font-medium text-content">Storage</span>
            <StatusDot tone={!usable || expiring ? "warning" : "success"}>{!usable ? "Unavailable" : expiring ? "Renew soon" : "Ready"}</StatusDot>
          </dt>
          <dd className={detail}>
            <span className={`tabular-nums ${expiring ? "text-warning" : ""}`} title={drive?.batchId ? `Drive ${drive.batchId}` : undefined}>
              {storage}
            </span>
            {dot}
            <MenuLink href={manageUrl}>Manage</MenuLink>
          </dd>
        </div>
        <div>
          <dt className={head}>
            <span className="font-medium text-content">Arkiv writer</span>
            <StatusDot tone={writerTone}>{writerState}</StatusDot>
          </dt>
          <dd className={detail}>
            {balance !== null ? (
              <>
                <span className="tabular-nums" title={`${writer?.balance} GLM`}>
                  {balance} GLM
                </span>
                {dot}
              </>
            ) : null}
            {writer?.writerConfigured && writer.funded === false ? (
              <>
                <MenuLink href={writer.faucetUrl}>Fund</MenuLink>
                {dot}
              </>
            ) : null}
            {writer?.explorerUrl ? <MenuLink href={writer.explorerUrl}>Address</MenuLink> : null}
            {writer?.explorerUrl && writer?.dataExplorerUrl ? dot : null}
            {writer?.dataExplorerUrl ? <MenuLink href={writer.dataExplorerUrl}>Registry</MenuLink> : null}
            {!writer ? <span>Server status unreachable</span> : null}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * The Swarm-derived wallet as narrow rows for the Provider account dropdown:
 * address, balances and faucets. Claiming and sending live on the Sales page.
 */
export function SwarmWalletRows() {
  const wallet = useSwarmWallet();
  const { copied, copy } = useCopy();
  const address = wallet.address;
  const dot = <span aria-hidden="true">·</span>;
  return (
    <div className="px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-subtle">{PAYMENT_CHAIN_NAME}</p>
      {address ? (
        <dl className="mt-3 space-y-4 text-xs">
          <div>
            <dt className="font-medium text-content">Address</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-subtle">
              <AddressLabel address={address} className="text-muted" />
              {dot}
              <button type="button" className="min-h-9 rounded-control text-accent-text hover:underline" onClick={() => void copy("wallet", address)}>
                {copied === "wallet" ? "Copied" : "Copy"}
              </button>
              {dot}
              <MenuLink href={explorerAddressUrl(address)}>Explorer</MenuLink>
            </dd>
          </div>
          <div>
            <dt className="flex items-center justify-between gap-3">
              <span className="font-medium text-content">USDC</span>
              <span className="tabular-nums text-content">{wallet.balances ? formatPriceUsdc(wallet.balances.usdc) : "…"}</span>
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-x-2 text-subtle">
              <span>Where your earnings land</span>
              {dot}
              <MenuLink href={USDC_FAUCET_URL}>Faucet</MenuLink>
            </dd>
          </div>
          <div>
            <dt className="flex items-center justify-between gap-3">
              <span className="font-medium text-content">AVAX</span>
              <span className="tabular-nums text-content">{wallet.balances ? Number(wallet.balances.avax).toFixed(4) : "…"}</span>
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-x-2 text-subtle">
              <span>Gas to claim</span>
              {dot}
              <MenuLink href={AVAX_FAUCET_URL}>Faucet</MenuLink>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-xs text-subtle">{wallet.status === "error" ? (wallet.error?.message ?? "Wallet unavailable.") : "Preparing wallet…"}</p>
      )}
    </div>
  );
}
