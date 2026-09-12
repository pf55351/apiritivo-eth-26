"use client";

import { getSwarmDrive, type SwarmConnectionInfo, type SwarmDrive } from "@apiritivo/swarm";
import { type ReactNode, useEffect, useState } from "react";
import { publicEnv } from "@/lib/env";
import { formatTtl } from "@/lib/format";
import { DRIVE_WARN_BELOW_SECONDS } from "@/lib/readiness";
import { useSession } from "@/lib/session";
import { Disclosure, RefField } from "./ui";

export type WriterStatus = {
  writerConfigured: boolean;
  address?: string;
  balance?: string;
  funded?: boolean;
  explorerUrl?: string;
  dataExplorerUrl?: string;
  faucetUrl: string;
} | null;

function ConnectionLink({ href, children, title }: { href: string; children: ReactNode; title?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" title={title} className="inline-flex min-h-11 items-center gap-1 rounded-control text-xs text-accent-text hover:underline">
      {children} <span aria-hidden="true">↗</span>
    </a>
  );
}

function ConnectionState({ children, tone }: { children: ReactNode; tone: "success" | "warning" | "subtle" }) {
  const color = { success: "text-success", warning: "text-warning", subtle: "text-subtle" }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${color}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
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
            <ConnectionState tone={!usable || expiring ? "warning" : "success"}>{!usable ? "Unavailable" : expiring ? "Renew soon" : "Ready"}</ConnectionState>
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
            <ConnectionState tone={!writer ? "subtle" : !writer.writerConfigured || writer.funded === false ? "warning" : writer.funded ? "success" : "subtle"}>
              {!writer ? "Unavailable" : !writer.writerConfigured ? "Not configured" : writer.funded === undefined ? "Balance unavailable" : writer.funded ? "Funded" : "Needs GLM"}
            </ConnectionState>
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

export function ProviderConnectionDetails({ writer }: { writer: WriterStatus }) {
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
      .then((value) => {
        if (!cancelled) setDrive(value);
      })
      .catch(() => {
        if (!cancelled) setDrive(null);
      });
    return () => {
      cancelled = true;
    };
  }, [identityId, ownStamp]);

  if (!session.identity) return null;
  return (
    <ConnectionDetails
      identity={session.identity}
      canUpload={session.canUpload}
      uploadMode={session.uploadMode}
      drive={drive}
      writer={writer}
      manageUrl={`${publicEnv.swarmIframeOrigin.replace(/\/+$/, "")}/`}
    />
  );
}
