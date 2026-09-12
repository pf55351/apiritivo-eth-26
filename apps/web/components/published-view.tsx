"use client";

import { arkivEntityUrl, arkivTxUrl } from "@apiritivo/arkiv";
import { formatAccessDuration, formatPriceUsdc } from "@apiritivo/shared";
import { swarmReferenceUrl } from "@apiritivo/swarm";
import type { PublishProgress } from "@/lib/use-publish-service";
import { type ProofLink, ProofPanel } from "./proofs";
import { Button } from "./ui";

/** The success screen after a listing lands on Arkiv: one action, then the proofs. */
export function PublishedView({
  name,
  priceUsdc,
  accessSeconds,
  progress,
}: {
  name: string;
  priceUsdc: string;
  accessSeconds: number;
  progress: PublishProgress & { result: NonNullable<PublishProgress["result"]> };
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-up">
      <div className="py-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-3xl text-success">✓</div>
        <p className="mt-4 text-xs font-normal text-success">API published</p>
        <h2 className="mt-1 break-words text-3xl font-medium">{name}</h2>
        <p className="mt-2 text-sm text-muted">Your API is now in the marketplace.</p>
        {progress.privateFile ? <p className="mt-2 text-xs text-subtle">Private file encrypted. Grant access after each purchase.</p> : null}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button href={`/services/${progress.result.serviceId}`}>View API</Button>
      </div>
      <ProofPanel
        columns={2}
        title="Publication details"
        proofs={[
          {
            network: "Swarm · public gateway",
            label: `manifestRef · ${progress.manifestBytes ?? 0} bytes · via ${progress.manifestVia === "gateway" ? "public gateway" : "Swarm ID"}`,
            value: progress.manifestRef ?? "",
            href: swarmReferenceUrl(progress.manifestRef ?? ""),
            hrefLabel: "Swarm gateway",
          },
          {
            network: "Arkiv · Tiramisu testnet",
            label: "entity key",
            value: progress.result.entityKey,
            href: arkivEntityUrl(progress.result.entityKey),
            hrefLabel: "Arkiv explorer",
          },
          { network: "Arkiv · Tiramisu testnet", label: "transaction", value: progress.result.txHash, href: arkivTxUrl(progress.result.txHash), hrefLabel: "Transaction" },
          ...(progress.privateFile
            ? [
                {
                  network: "Swarm · public gateway",
                  label: `private file · ${progress.privateFile.name} · ${progress.privateFile.bytes} bytes · ACT encrypted, no public link`,
                  value: progress.privateFile.encryptedRef,
                } satisfies ProofLink,
              ]
            : []),
          { network: "Arkiv · Tiramisu testnet", label: "serviceId", value: progress.result.serviceId },
          { network: "Arkiv · Tiramisu testnet", label: "access terms", value: `${formatPriceUsdc(priceUsdc.trim())} · ${formatAccessDuration(accessSeconds)}` },
        ]}
      />
    </div>
  );
}
