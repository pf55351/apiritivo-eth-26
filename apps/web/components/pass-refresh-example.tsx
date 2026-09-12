"use client";

import type { AccessPass } from "@apiritivo/shared";
import { useState } from "react";
import { useQuery } from "@/lib/use-query";
import { ApiKeyBox } from "./api-key-box";
import { PassesView } from "./passes-view";

const EXAMPLE_PASSES: AccessPass[] = ["Example market API", "Example weather API"].map((name, index) => ({
  passKey: `0x${String(index + 1).repeat(64)}`,
  serviceId: `example-api-${index + 1}`,
  serviceName: name,
  buyerId: "example-buyer",
  providerId: "example-provider",
  txHash: `0x${"0".repeat(64)}`,
  paidUsdc: "0.50",
  chainId: 43113,
  expiresAtBlock: "302500",
}));
const readExampleTiming = async () => ({ currentBlock: 100n, currentBlockTime: 200, blockDuration: 2 });

export function PassRefreshExample() {
  const [fail, setFail] = useState(false);
  const { data, initialLoading, refreshing, error, timing, reload } = useQuery<AccessPass[]>(
    "pass-refresh-example",
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_800));
      if (fail) throw new Error("Example refresh failure.");
      return EXAMPLE_PASSES.map((pass) => ({ ...pass }));
    },
    "Example refresh failed.",
    readExampleTiming,
  );

  return (
    <section className="mt-8 border-t border-line pt-6">
      <p className="mb-3 text-xs text-subtle">Example passes. Refresh waits briefly without contacting a network.</p>
      <label className="mb-5 flex min-h-11 items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} /> Simulate refresh failure
      </label>
      <PassesView
        title="Pass refresh example"
        data={data}
        initialLoading={initialLoading}
        refreshing={refreshing}
        error={error}
        timing={timing}
        reload={reload}
        renderApiKey={(pass) => <ApiKeyBox serviceId={pass.serviceId} bearer={{ status: "ready", bearer: "Example credential only" }} />}
      />
    </section>
  );
}
