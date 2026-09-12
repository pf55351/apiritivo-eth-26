"use client";

import type { PrivateAttachment, PublishServiceResult, ServiceManifest } from "@apiritivo/shared";
import { uploadPrivateFile, uploadServiceManifest } from "@apiritivo/swarm";
import { useCallback, useState } from "react";
import { type FriendlyError, toFriendlyError } from "./errors";

export type PublishStep = "idle" | "uploading" | "uploading-private" | "publishing" | "done";

export type PublishProgress = {
  step: PublishStep;
  manifestRef?: string;
  manifestBytes?: number;
  manifestVia?: "swarm-id" | "gateway";
  privateFile?: PrivateAttachment;
  result?: PublishServiceResult;
  error?: FriendlyError & { at: "swarm" | "arkiv" | "form" };
};

/** What the server needs besides the manifest reference and the private file. */
export type PublishListing = {
  serviceId: string;
  category: string;
  providerId: string;
  providerName: string;
  name: string;
  description: string;
  priceUsdc: string;
  accessSeconds: number;
  payoutAddress: string;
  ensName?: string;
};

/**
 * The publish sequence, in the only order that is safe: manifest to Swarm,
 * optional private file to Swarm (ACT), then the listing to Arkiv through the
 * server writer. Each failure reports where it happened so the form can say
 * what was and was not written.
 */
export function usePublishService() {
  const [progress, setProgress] = useState<PublishProgress>({ step: "idle" });
  const busy = progress.step === "uploading" || progress.step === "uploading-private" || progress.step === "publishing";

  const publish = useCallback(async (manifest: ServiceManifest, listing: PublishListing, privateFile: File | null) => {
    // 1) Upload manifest to Swarm — must succeed before touching Arkiv.
    setProgress({ step: "uploading" });
    let manifestRef: string;
    let manifestBytes: number;
    let manifestVia: "swarm-id" | "gateway";
    try {
      const uploaded = await uploadServiceManifest(manifest);
      manifestRef = uploaded.reference;
      manifestBytes = uploaded.bytes;
      manifestVia = uploaded.via;
    } catch (err) {
      setProgress({ step: "idle", error: { ...toFriendlyError(err, "Manifest upload failed."), at: "swarm" } });
      return;
    }

    // 1b) Optional private file: encrypted on Swarm with ACT, nobody can read it yet.
    let privateAttachment: PrivateAttachment | undefined;
    if (privateFile) {
      setProgress({ step: "uploading-private", manifestRef, manifestBytes, manifestVia });
      try {
        const bytes = new Uint8Array(await privateFile.arrayBuffer());
        const uploaded = await uploadPrivateFile(bytes);
        privateAttachment = {
          name: privateFile.name,
          bytes: uploaded.bytes,
          contentType: privateFile.type || undefined,
          encryptedRef: uploaded.encryptedRef,
          historyRef: uploaded.historyRef,
          publisherPubKey: uploaded.publisherPubKey,
        };
      } catch (err) {
        setProgress({ step: "idle", manifestRef, manifestBytes, manifestVia, error: { ...toFriendlyError(err, "Private file upload failed."), at: "swarm" } });
        return;
      }
    }

    // 2) Publish the service entity to Arkiv via the server writer.
    setProgress({ step: "publishing", manifestRef, manifestBytes, manifestVia, privateFile: privateAttachment });
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...listing, manifestRef, privateAttachment }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<PublishServiceResult> & { error?: string; reason?: string; detail?: string; issues?: string[] };
      if (!res.ok || !json.entityKey || !json.txHash) {
        const detail = [json.reason, json.detail, ...(json.issues ?? [])].filter(Boolean).join("\n");
        setProgress({
          step: "idle",
          manifestRef,
          manifestBytes,
          error: { message: json.reason ?? json.error ?? "Arkiv publication failed.", detail: detail || undefined, at: "arkiv" },
        });
        return;
      }
      setProgress({
        step: "done",
        manifestRef,
        manifestBytes,
        manifestVia,
        privateFile: privateAttachment,
        result: { entityKey: json.entityKey, txHash: json.txHash, serviceId: json.serviceId ?? listing.serviceId },
      });
    } catch (err) {
      setProgress({ step: "idle", manifestRef, manifestBytes, error: { ...toFriendlyError(err, "Arkiv publication failed."), at: "arkiv" } });
    }
  }, []);

  return { progress, busy, publish };
}
