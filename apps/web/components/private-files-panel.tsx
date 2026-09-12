"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccessPass, ArkivService, Grant } from "@apiritivo/shared";
import { arkivEntityUrl, findGrant } from "@apiritivo/arkiv";
import { downloadPrivateFile } from "@apiritivo/swarm";
import { useSession } from "@/lib/session";
import { toFriendlyError, type FriendlyError } from "@/lib/errors";
import { Button, ErrorNotice } from "./ui";

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
  const file = service.privateAttachment;
  const buyerId = session.identity?.id ?? null;
  const [grant, setGrant] = useState<Grant | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const isProvider = buyerId !== null && buyerId === service.providerId;

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
      const refs = grant ? { encryptedRef: grant.encryptedRef, historyRef: grant.historyRef, publisherPubKey: grant.publisherPubKey } : { encryptedRef: file.encryptedRef, historyRef: file.historyRef, publisherPubKey: file.publisherPubKey };
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

  const canRead = isProvider || (Boolean(activePass) && Boolean(grant));
  const state = isProvider ? "You published this file." : !session.identity ? "Sign in and buy access to unlock it." : !activePass ? "Buy access to unlock it." : grant === undefined ? "Checking your grant on Arkiv…" : grant ? "Granted to your Swarm ID." : "Waiting for the provider to grant your key.";

  return (
    <section className="card rounded-3xl p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-olive-400">Private file · Swarm ACT</p>
      <h2 className="mt-1 text-xl font-semibold">{file.name}</h2>
      <p className="mt-1 text-sm text-ink-300">
        {formatBytes(file.bytes)} on Swarm, encrypted with an Access Control Trie. Only the provider and the buyers it granted can decrypt it. The references are public; the content is not.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${canRead ? "border-olive-400/30 bg-olive-400/10 text-olive-400" : "border-white/15 bg-white/5 text-ink-400"}`}>
          {canRead ? "🔓 unlocked" : "🔒 locked"}
        </span>
        <span className="text-xs text-ink-300">{state}</span>
        {activePass && grant === null && !isProvider ? (
          <button type="button" onClick={() => void loadGrant()} className="text-xs text-ink-400 underline hover:text-ink-200">
            check again
          </button>
        ) : null}
      </div>
      {canRead ? (
        <div className="mt-4">
          <Button onClick={download} disabled={busy}>
            {busy ? "Decrypting with your Swarm ID…" : `Download ${file.name}`}
          </Button>
        </div>
      ) : null}
      {grant ? (
        <p className="mt-2 text-[11px] text-ink-400">
          grant{" "}
          <a href={arkivEntityUrl(grant.grantKey)} target="_blank" rel="noreferrer" className="font-mono hover:text-ink-200">
            {grant.grantKey.slice(0, 10)}… ↗
          </a>{" "}
          · history {grant.historyRef.slice(0, 10)}…
        </p>
      ) : null}
      {error ? <div className="mt-3"><ErrorNotice message={error.message} detail={error.detail} /></div> : null}
      {preview ? <pre className="mt-3 max-h-64 overflow-auto rounded-2xl border border-white/15 bg-ink-900/70 p-4 font-mono text-xs leading-relaxed text-ink-100">{preview}</pre> : null}
      <p className="mt-3 text-[11px] text-ink-400">
        encrypted ref <span className="font-mono">{file.encryptedRef.slice(0, 12)}…</span> · publisher key <span className="font-mono">{file.publisherPubKey.slice(0, 12)}…</span>
      </p>
    </section>
  );
}
