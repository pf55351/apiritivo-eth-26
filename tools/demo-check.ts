/**
 * Pre-demo readiness check. Run from the repo root: `bun demo:check`
 * Reads apps/web/.env.local, then pings every external dependency the demo needs.
 */
import { existsSync, readFileSync } from "node:fs";
import { PAYMENT_CHAIN, paymentsAbi, USDC_ADDRESS, unitsToUsdc } from "@apiritivo/payments";
import { createPublicClient as createArkivClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { and, eq } from "@arkiv-network/sdk/query";
import { createPublicClient, erc20Abi, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const envPath = new URL("../apps/web/.env.local", import.meta.url).pathname;
const env: Record<string, string> = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]!] = m[2]!.trim();
  }
}

let failures = 0;
const ok = (label: string, detail = "") => console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
const warn = (label: string, detail = "") => console.log(`  ! ${label}${detail ? `  ${detail}` : ""}`);
const fail = (label: string, detail = "") => {
  failures += 1;
  console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
};

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
  const arkiv = createArkivClient({ chain: tiramisu, transport: http(env.NEXT_PUBLIC_ARKIV_RPC_URL || undefined) });
  const chainId = await arkiv.getChainId();
  ok("RPC reachable", `chain ${chainId}`);
  if (pk && /^0x[0-9a-fA-F]{64}$/.test(pk)) {
    const writer = privateKeyToAccount(pk as `0x${string}`);
    const bal = await arkiv.getBalance({ address: writer.address });
    const glm = Number(formatEther(bal));
    (glm > 0.01 ? ok : fail)("writer funded", `${writer.address} · ${glm.toFixed(4)} GLM${glm <= 0.01 ? " → https://hub.arkiv.network/faucet" : ""}`);
  }
  const services = await arkiv
    .select({ key: true, attributes: true })
    .where(and(eq("app", "apiritivo"), eq("entity_type", "service")))
    .limit(50)
    .fetch();
  (services.entities.length > 0 ? ok : warn)("services published", `${services.entities.length} (publish one from /provider/new if 0)`);
  const missingPayout = services.entities.filter((e) => !e.attributes?.payout_address).length;
  if (missingPayout > 0) warn("services without payout wallet", `${missingPayout} (not purchasable, republish them)`);
  const passes = await arkiv
    .select({ key: true })
    .where(and(eq("app", "apiritivo"), eq("entity_type", "access_pass")))
    .limit(50)
    .fetch();
  ok("live access passes", String(passes.entities.length));
} catch (err) {
  fail("Arkiv unreachable", (err as Error).message.split("\n")[0]);
}

// 3. Swarm gateway
console.log("\nSwarm · public gateway");
const gateway = (env.NEXT_PUBLIC_SWARM_GATEWAY_URL || "https://api.gateway.ethswarm.org").replace(/\/+$/, "");
try {
  const res = await fetch(`${gateway}/health`, { signal: AbortSignal.timeout(10_000) });
  (res.ok ? ok : fail)("gateway reachable", `${gateway} → ${res.status}`);
  const up = await fetch(`${gateway}/bytes`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: new TextEncoder().encode('{"v":1,"operations":{"ping":{"input":{}}}}'),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await up.json().catch(() => ({}))) as { reference?: string };
  (up.ok && json.reference ? ok : fail)("unstamped upload works", json.reference ? `ref ${json.reference.slice(0, 12)}…` : `HTTP ${up.status}`);
} catch (err) {
  fail("gateway error", (err as Error).message);
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
  fail("Fuji error", (err as Error).message.split("\n")[0]);
}

// 5. ENS (read-only, optional)
console.log("\nENS · name resolution");
try {
  const { ensChain, ensChainLabel, resolveEnsAddress } = await import("@apiritivo/ens");
  const chain = ensChain();
  const eth = createPublicClient({ chain, transport: http(env.ENS_RPC_URL || env.NEXT_PUBLIC_ENS_RPC_URL || undefined) });
  ok("RPC reachable", `${ensChainLabel()} · chain ${await eth.getChainId()}`);
  const probe = env.ENS_DEMO_NAME || (chain.id === 1 ? "vitalik.eth" : "nick.eth");
  const addr = await resolveEnsAddress(probe);
  (addr ? ok : warn)("universal resolver answers", `${probe} → ${addr ?? "no address record"}`);
} catch (err) {
  warn("ENS check skipped", (err as Error).message.split("\n")[0]);
}

console.log(`\n${failures === 0 ? "READY — go present." : `${failures} blocker(s) to fix before the demo.`}\n`);
process.exit(failures === 0 ? 0 : 1);
