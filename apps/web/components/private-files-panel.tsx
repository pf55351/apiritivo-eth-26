"use client";

import { arkivEntityUrl, findGrant } from "@apiritivo/arkiv";
import type { AccessPass, ArkivService, Grant } from "@apiritivo/shared";
import { downloadPrivateFile } from "@apiritivo/swarm";
import { useCallback, useEffect, useState } from "react";
import { type FriendlyError, toFriendlyError } from "@/lib/errors";
import { useActiveIdentity } from "@/lib/identity";
import { useSession } from "@/lib/session";
import { CodeBlock } from "./code-panel";
import { RefreshButton } from "./refresh-button";
import { Button, Disclosure, ErrorNotice } from "./ui";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Buyer side of a service's private file (Swarm ACT). Locked until the buyer
 * holds a pass and the provider has granted their key; then the file is
 * downloaded and decrypted in the browser with the buyer's own Swarm ID.
 */
export function PrivateFilesPanel({ service, activePass }: { service: ArkivService; activePass: AccessPass | undefined }) {
  const session = useSession();
  const identity = useActiveIdentity();
  const file = service.privateAttachment;
  const buyerId = identity?.id ?? null;
  // Decryption runs inside Swarm ID; a wallet buyer signs in with Swarm ID only for this.
  const canDecrypt = Boolean(session.identity);
  const [grant, setGrant] = useState<Grant | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const isProvider = session.identity?.id === service.providerId;

  const loadGrant = useCallback(async () => {
    if (!buyerId || !file) return;
    setGrant(undefined);
    setGrant(await findGrant(service.serviceId, buyerId).catch(() => null));
  }, [buyerId, file, service.serviceId]);

  useEffect(() => {
    void loadGrant();
  }, [loadGrant]);

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

  const unlocked = isProvider || (Boolean(activePass) && Boolean(grant));
  const canRead = unlocked && canDecrypt;
  const state = isProvider
    ? "You published this file."
    : !buyerId
      ? "Connect and buy access to unlock it."
      : !activePass
        ? "Buy access to unlock it."
        : grant === undefined
          ? "Checking access…"
          : grant
            ? canDecrypt
              ? "Access granted."
              : "Access granted. Sign in with Swarm ID to open it."
            : "Waiting for provider approval.";

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
        {activePass && !grant && !isProvider ? <RefreshButton variant="subtle" label="Refresh file access" refreshing={grant === undefined} onClick={loadGrant} /> : null}
      </div>
      {canRead ? (
        <div className="mt-4">
          <Button onClick={download} disabled={busy}>
            {busy ? "Decrypting…" : "Download file"}
          </Button>
        </div>
      ) : unlocked ? (
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
