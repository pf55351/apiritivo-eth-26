"use client";

import { arkivEntityUrl } from "@apiritivo/arkiv";
import type { AccessPass, ArkivService } from "@apiritivo/shared";
import { downloadPrivateFile, getGranteeKey } from "@apiritivo/swarm";
import { useState } from "react";
import { type FriendlyError, toFriendlyError } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { useGrantForKey } from "@/lib/use-access";
import { CodeBlock } from "./code-panel";
import { RefreshButton } from "./refresh-button";
import { Button, Disclosure, ErrorNotice } from "./ui";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Buyer side of a service's private file (Swarm ACT). The file is decrypted
 * by the Swarm ID, never by the paying wallet: at purchase the wallet signed
 * which Swarm ID key may receive it and the provider granted that key. So the
 * lock follows the signed-in Swarm ID (is there a grant for its key?); the
 * wallet's pass only says whether a purchase is waiting for approval.
 */
export function PrivateFilesPanel({ service, activePass }: { service: ArkivService; activePass: AccessPass | undefined }) {
  const session = useSession();
  const file = service.privateAttachment;
  const swarmKey = session.identity ? (getGranteeKey() ?? null) : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const isPublisher = session.identity?.id === service.providerId;
  const clientView = session.role !== "provider";
  // Keyed by service + Swarm ID key: a slow answer for another identity can never show here.
  const grantQuery = useGrantForKey(file ? service.serviceId : null, swarmKey);
  const grant = grantQuery.loading && grantQuery.data === null ? undefined : grantQuery.data;
  const loadGrant = grantQuery.reload;

  if (!file) return null;

  async function download() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      // The provider reads with the refs from upload; a buyer with the refs from their grant.
      const refs = grant
        ? { encryptedRef: grant.encryptedRef, historyRef: grant.historyRef, publisherPubKey: grant.publisherPubKey }
        : { encryptedRef: file.encryptedRef, historyRef: file.historyRef, publisherPubKey: file.publisherPubKey };
      const bytes = await downloadPrivateFile(refs);
      const type = file.contentType || "application/octet-stream";
      if (bytes.byteLength <= 20_000 && /^(text\/|application\/json)/.test(type)) setPreview(new TextDecoder().decode(bytes));
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } catch (err) {
      setError(toFriendlyError(err, "Private file could not be downloaded."));
    } finally {
      setBusy(false);
    }
  }

  // Publisher or grantee: exactly who Swarm ACT lets decrypt. Both imply a Swarm ID session.
  const unlocked = isPublisher || Boolean(grant);
  const swarmName = session.identity?.name ?? "your Swarm ID";
  const state = isPublisher
    ? "You published this file."
    : !session.identity
      ? activePass
        ? "Opens with the Swarm ID that was signed in when you bought. Sign in to check."
        : "Buy access to unlock it. It opens with the Swarm ID signed in at purchase."
      : grant === undefined
        ? "Checking access…"
        : grant
          ? `Access granted to ${swarmName}.`
          : activePass
            ? "Waiting for provider approval."
            : `No access for ${swarmName} yet. Buy access while signed in with it.`;

  return (
    <section className="min-w-0 border-t border-line pt-5">
      <p className="text-xs font-normal text-success">Private file</p>
      <h2 className="mt-2 break-words text-base font-medium">{file.name}</h2>
      <p className="mt-1 text-sm text-muted">{formatBytes(file.bytes)} · Encrypted</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-normal ${unlocked ? "text-success" : "text-subtle"}`}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d={unlocked ? "M8 10V6a4 4 0 0 1 8 0" : "M8 10V6a4 4 0 0 1 8 0v4"} />
            <path d="M12 14v3" />
          </svg>
          {unlocked ? "Unlocked" : "Locked"}
        </span>
        <span className="text-xs text-muted">{state}</span>
        {session.identity && !grant && !isPublisher ? <RefreshButton variant="subtle" label="Refresh file access" refreshing={grant === undefined} onClick={loadGrant} /> : null}
      </div>
      {isPublisher && clientView ? (
        <p className="mt-3 text-xs text-warning" role="note">
          You are signed in as the provider of this API, so the file opens for you whether or not this wallet bought it. To test the paywall, sign in with another Swarm ID.
        </p>
      ) : null}
      {unlocked ? (
        <div className="mt-4">
          <Button onClick={download} disabled={busy}>
            {busy ? "Decrypting…" : "Download file"}
          </Button>
        </div>
      ) : !session.identity && activePass ? (
        <div className="mt-4">
          <Button onClick={session.connect} disabled={session.status !== "ready" || session.connecting}>
            Sign in with Swarm ID
          </Button>
        </div>
      ) : null}
      <div className="mt-4">
        <Disclosure title="File details">
          {grant ? (
            <p className="mt-2 text-[11px] text-subtle">
              grant{" "}
              <a href={arkivEntityUrl(grant.grantKey)} target="_blank" rel="noreferrer" className="font-mono hover:text-content-secondary">
                {grant.grantKey.slice(0, 10)}… ↗
              </a>{" "}
              · history {grant.historyRef.slice(0, 10)}…
            </p>
          ) : null}
          <p className="mt-3 text-[11px] text-subtle">
            encrypted ref <span className="font-mono">{file.encryptedRef.slice(0, 12)}…</span> · publisher key{" "}
            <span className="font-mono">{file.publisherPubKey.slice(0, 12)}…</span>
          </p>
        </Disclosure>
      </div>
      {error ? (
        <div className="mt-3">
          <ErrorNotice message={error.message} detail={error.detail} />
        </div>
      ) : null}
      {preview ? (
        <CodeBlock label="File preview" className="mt-3 max-h-64 overflow-auto rounded-control bg-surface p-4 font-mono text-xs leading-relaxed text-content">
          {preview}
        </CodeBlock>
      ) : null}
    </section>
  );
}
