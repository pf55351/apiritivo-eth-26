/**
 * Pre-demo readiness check. Run from the repo root: `bun demo:check`
 * Reads apps/web/.env.local, then pings every external dependency the demo
 * needs through the same adapters the app uses.
 */
import { existsSync, readFileSync } from "node:fs";
import { PAYMENT_CHAIN, paymentsAbi, USDC_ADDRESS, unitsToUsdc } from "@apiritivo/payments";
import { createPublicClient, erc20Abi, http } from "viem";

const envPath = new URL("../apps/web/.env.local", import.meta.url).pathname;
const env: Record<string, string> = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]!] = m[2]!.trim();
  }
}
// The adapters read their configuration from process.env, like the app does.
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
const { listServices, trustedWriterAddress } = await import("@apiritivo/arkiv");
const { getWriterStatus } = await import("@apiritivo/arkiv/server");
const { uploadBytesToGateway } = await import("@apiritivo/swarm/gateway");

let failures = 0;
const ok = (label: string, detail = "") => console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
const warn = (label: string, detail = "") => console.log(`  ! ${label}${detail ? `  ${detail}` : ""}`);
const fail = (label: string, detail = "") => {
  failures += 1;
  console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
};
const firstLine = (err: unknown) => String((err as Error)?.message ?? err).split("\n")[0] ?? "";

console.log("\nAPIritivo demo check\n");

// 1. env
console.log("Environment (apps/web/.env.local)");
if (!existsSync(envPath)) fail("file missing", "copy .env.example to apps/web/.env.local");
else ok("file present");
const pk = env.ARKIV_WRITER_PRIVATE_KEY;
if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) fail("ARKIV_WRITER_PRIVATE_KEY missing/invalid");

// 2. Arkiv
console.log("\nArkiv · Tiramisu");
try {
  const writer = await getWriterStatus();
  if (!writer.configured) fail("writer not configured");
  else {
    const glm = Number(writer.balance ?? "0");
    if (writer.balance === undefined) fail("writer balance unavailable", "RPC unreachable");
    else (glm > 0.01 ? ok : fail)("writer funded", `${writer.address} · ${glm.toFixed(4)} GLM${glm <= 0.01 ? ` → ${writer.faucetUrl}` : ""}`);
    (writer.ownerMismatch ? fail : ok)(
      "reads trust this writer",
      writer.ownerMismatch ? `writes go to ${writer.address} but reads trust ${writer.trustedOwner}: set NEXT_PUBLIC_ARKIV_WRITER_ADDRESS` : trustedWriterAddress(),
    );
  }
  const services = await listServices();
  (services.length > 0 ? ok : warn)("services published", `${services.length} (publish one from /provider/new if 0)`);
  const missingPayout = services.filter((s) => !s.payoutAddress).length;
  if (missingPayout > 0) warn("services without payout wallet", `${missingPayout} (not purchasable, republish them)`);
  const oddDurations = services.filter((s) => s.accessSeconds !== undefined && s.accessSeconds % 2 !== 0).length;
  if (oddDurations > 0) warn("services with an odd duration", `${oddDurations} (Arkiv cannot mint their passes)`);
} catch (err) {
  fail("Arkiv unreachable", firstLine(err));
}

// 3. Swarm gateway
console.log("\nSwarm · public gateway");
const gateway = (env.NEXT_PUBLIC_SWARM_GATEWAY_URL || "https://api.gateway.ethswarm.org").replace(/\/+$/, "");
try {
  const res = await fetch(`${gateway}/health`, { signal: AbortSignal.timeout(10_000) });
  (res.ok ? ok : fail)("gateway reachable", `${gateway} → ${res.status}`);
  const reference = await uploadBytesToGateway(new TextEncoder().encode('{"v":1,"operations":{"ping":{"input":{}}}}'), { gatewayUrl: gateway });
  ok("unstamped upload works", `ref ${reference.slice(0, 12)}…`);
} catch (err) {
  fail("gateway error", firstLine(err));
}
ok("subsidised gateway for Swarm ID", env.NEXT_PUBLIC_SWARM_SUBSIDISED_GATEWAY_URL || "(default) https://api.gateway.ethswarm.org/");

// 4. Avalanche Fuji
console.log(`\nPayments · ${PAYMENT_CHAIN.name}`);
try {
  const fuji = createPublicClient({ chain: PAYMENT_CHAIN, transport: http(env.AVALANCHE_FUJI_RPC_URL || undefined) });
  ok("RPC reachable", `chain ${await fuji.getChainId()}`);
  const symbol = await fuji.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "symbol" });
  ok("USDC contract", `${USDC_ADDRESS} (${symbol})`);
  const contract = env.NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS;
  if (contract && /^0x[0-9a-fA-F]{40}$/.test(contract)) {
    const token = await fuji.readContract({ address: contract as `0x${string}`, abi: paymentsAbi, functionName: "token" });
    const count = await fuji.readContract({ address: contract as `0x${string}`, abi: paymentsAbi, functionName: "purchaseCount" });
    const fees = await fuji.readContract({ address: contract as `0x${string}`, abi: paymentsAbi, functionName: "feesAccrued" });
    (token.toLowerCase() === USDC_ADDRESS.toLowerCase() ? ok : fail)("APIritivoPayments", `${contract} · ${count} purchases · fees ${unitsToUsdc(fees)} USDC`);
  } else {
    warn("contract not configured", "direct-transfer mode (deploy with contracts/script/Deploy.s.sol when ready)");
  }
} catch (err) {
  fail("Fuji error", firstLine(err));
}

// 5. ENS (read-only, optional)
console.log("\nENS · name resolution");
try {
  const { ensChain, ensChainLabel, resolveEnsAddress } = await import("@apiritivo/ens");
  const chain = ensChain();
  const eth = createPublicClient({ chain, transport: http(env.ENS_RPC_URL || env.NEXT_PUBLIC_ENS_RPC_URL || undefined) });
  ok("RPC reachable", `${ensChainLabel()} · chain ${await eth.getChainId()}`);
  const probe = env.ENS_DEMO_NAME || (chain.id === 1 ? "vitalik.eth" : "apiritivo.eth");
  const addr = await resolveEnsAddress(probe);
  (addr ? ok : warn)("universal resolver answers", `${probe} → ${addr ?? "no address record"}`);
} catch (err) {
  warn("ENS check skipped", firstLine(err));
}

console.log(`\n${failures === 0 ? "READY — go present." : `${failures} blocker(s) to fix before the demo.`}\n`);
process.exit(failures === 0 ? 0 : 1);
