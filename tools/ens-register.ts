/**
 * Register the platform's ENS name on Sepolia (ENSv2 beta) and set the records
 * that make it describe a service. Signs with the Arkiv writer key from
 * apps/web/.env.local (never printed). Registration is paid in MockUSDC, a test
 * token anyone can mint; gas is Sepolia ETH.
 *
 *   bun tools/ens-register.ts status   <label>                        # availability, price, balances (read-only)
 *   bun tools/ens-register.ts register <label> [--dry-run]            # mint + approve MockUSDC, commit, wait, register 1 year
 *   bun tools/ens-register.ts resolver <label> [--dry-run]            # deploy APIritivoResolver (owner = writer) and set it on the name
 *   bun tools/ens-register.ts records  <name.eth> --addr 0x… [--service <id>] [--manifest <ref>] [--dry-run]
 *
 * The shared PublicResolverV2 refuses record writes on the Sepolia beta (canModifyName is false even
 * for owners), so the platform name uses its own resolver: contracts/src/APIritivoResolver.sol.
 *
 * Contracts (docs.ens.domains/learn/deployments, "Sepolia ENSv2 Beta"); ABIs recovered from bytecode selectors.
 */
import { existsSync, readFileSync } from "node:fs";
import { swarmContenthash } from "@apiritivo/ens";
import { type Address, createPublicClient, createWalletClient, encodeFunctionData, erc20Abi, formatUnits, type Hex, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { namehash, normalize } from "viem/ens";

const REGISTRAR: Address = "0xa88553f454b77203b0d036a05c894d555eaaa2cc"; // ETHRegistrar (v2)
const RESOLVER: Address = "0xe7b9a25607e02da8145e4eb1836ca539e53f11f7"; // PublicResolverV2
const MOCK_USDC: Address = "0x768f42455a2d082e23ceef7d51e5787c82d67a39"; // test payment token, open mint
const ZERO: Address = "0x0000000000000000000000000000000000000000";
const ZERO32 = `0x${"0".repeat(64)}` as Hex;
const ONE_YEAR = 31_536_000n;
const TEXT_KEY = "com.apiritivo.service";

const ETH_REGISTRY: Address = "0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2"; // ETHRegistry (v2)
const registryAbi = parseAbi([
  "function findTokenId(string label) view returns (uint256)",
  "function getResolver(string label) view returns (address)",
  "function setResolver(uint256 tokenId, address resolver)",
]);
const registrarAbi = parseAbi([
  "function isAvailable(string label) view returns (bool)",
  "function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)",
  "function MIN_COMMITMENT_AGE() view returns (uint256)",
  "function commitmentAt(bytes32) view returns (uint256)",
  "function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) view returns (bytes32)",
  "function commit(bytes32 commitment)",
  "function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer)",
]);
const resolverAbi = parseAbi([
  "function setAddr(bytes32 node, address a)",
  "function setText(bytes32 node, string key, string value)",
  "function setContenthash(bytes32 node, bytes hash)",
  "function multicall(bytes[] data) returns (bytes[] results)",
  "function addr(bytes32 node) view returns (address)",
  "function text(bytes32 node, string key) view returns (string)",
  "function contenthash(bytes32 node) view returns (bytes)",
]);
const mintAbi = parseAbi(["function mint(address to, uint256 amount)"]);

const args = process.argv.slice(2);
const cmd = args[0];
const target = args[1];
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dryRun = args.includes("--dry-run");
if (!cmd || !target) {
  console.error("usage: see header of tools/ens-register.ts");
  process.exit(2);
}

const envPath = new URL("../apps/web/.env.local", import.meta.url).pathname;
const env: Record<string, string> = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]!] = m[2]!.trim();
  }
}
const pk = env.ARKIV_WRITER_PRIVATE_KEY;
if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
  console.error("ARKIV_WRITER_PRIVATE_KEY missing in apps/web/.env.local");
  process.exit(2);
}
const account = privateKeyToAccount(pk as Hex);
const rpc = env.ENS_RPC_URL || env.NEXT_PUBLIC_ENS_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const pub = createPublicClient({ chain: sepolia, transport: http(rpc) });
const wallet = createWalletClient({ chain: sepolia, transport: http(rpc), account });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function send(desc: string, tx: { to: Address; data: Hex; value?: bigint }) {
  if (dryRun) {
    const gas = await pub.estimateGas({ account: account.address, ...tx });
    console.log(`  [dry-run] ${desc}: gas ≈ ${gas}`);
    return null;
  }
  const hash = await wallet.sendTransaction(tx);
  console.log(`  ${desc}: https://sepolia.etherscan.io/tx/${hash}`);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${desc} reverted`);
  return hash;
}

const label = target.replace(/\.eth$/, "");
const name = normalize(`${label}.eth`);
const node = namehash(name);

if (cmd === "status" || cmd === "register") {
  const [avail, price, minAge, eth, usdc] = await Promise.all([
    pub.readContract({ address: REGISTRAR, abi: registrarAbi, functionName: "isAvailable", args: [label] }),
    pub.readContract({ address: REGISTRAR, abi: registrarAbi, functionName: "getRegisterPrice", args: [label, ONE_YEAR, MOCK_USDC] }),
    pub.readContract({ address: REGISTRAR, abi: registrarAbi, functionName: "MIN_COMMITMENT_AGE" }),
    pub.getBalance({ address: account.address }),
    pub.readContract({ address: MOCK_USDC, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
  ]);
  const total = price[0] + price[1];
  console.log(`${name} · owner-to-be ${account.address} (ENSv2 beta, Sepolia)`);
  console.log(
    `  available: ${avail} · price 1y: ${formatUnits(total, 6)} MockUSDC · balances: ${formatUnits(eth, 18)} ETH, ${formatUnits(usdc, 6)} MockUSDC · min commitment age: ${minAge}s`,
  );
  if (cmd === "status") process.exit(0);
  if (!avail) throw new Error("name not available");
  if (eth < 5_000_000_000_000_000n) throw new Error("need at least 0.005 Sepolia ETH for gas");

  const need = (total * 110n) / 100n;
  if (usdc < need)
    await send(`mint ${formatUnits(need, 6)} MockUSDC`, { to: MOCK_USDC, data: encodeFunctionData({ abi: mintAbi, functionName: "mint", args: [account.address, need] }) });
  await send("approve registrar", { to: MOCK_USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [REGISTRAR, need] }) });

  const secret = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
  const commitment = await pub.readContract({
    address: REGISTRAR,
    abi: registrarAbi,
    functionName: "makeCommitment",
    args: [label, account.address, secret, ZERO, RESOLVER, ONE_YEAR, ZERO32],
  });
  console.log(`  commitment ${commitment}`);
  await send("commit", { to: REGISTRAR, data: encodeFunctionData({ abi: registrarAbi, functionName: "commit", args: [commitment] }) });
  if (dryRun) {
    console.log("  [dry-run] register skipped (needs a mined commitment)");
    process.exit(0);
  }
  const wait = Number(minAge) + 15;
  console.log(`  waiting ${wait}s for the commitment to age…`);
  await sleep(wait * 1000);
  await send("register", {
    to: REGISTRAR,
    data: encodeFunctionData({ abi: registrarAbi, functionName: "register", args: [label, account.address, secret, ZERO, RESOLVER, ONE_YEAR, MOCK_USDC, ZERO32] }),
  });
  console.log(`  ✓ ${name} registered for 1 year, owner ${account.address}`);
  console.log(`  https://app.ens.dev/${name}`);
  process.exit(0);
}

if (cmd === "resolver") {
  const artifact = JSON.parse(readFileSync(new URL("../contracts/out/APIritivoResolver.sol/APIritivoResolver.json", import.meta.url).pathname, "utf8")) as {
    abi: unknown[];
    bytecode: { object: Hex };
  };
  const tokenId = await pub.readContract({ address: ETH_REGISTRY, abi: registryAbi, functionName: "findTokenId", args: [label] });
  const current = await pub.readContract({ address: ETH_REGISTRY, abi: registryAbi, functionName: "getResolver", args: [label] });
  console.log(`${name} · current resolver ${current}`);
  if (dryRun) {
    const gas = await pub.estimateGas({ account: account.address, data: `${artifact.bytecode.object}${account.address.slice(2).padStart(64, "0")}` as Hex });
    console.log(`  [dry-run] deploy APIritivoResolver: gas ≈ ${gas}`);
    process.exit(0);
  }
  const hash = await wallet.deployContract({ abi: artifact.abi as never, bytecode: artifact.bytecode.object, args: [account.address] as never });
  console.log(`  deploy: https://sepolia.etherscan.io/tx/${hash}`);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("deploy failed");
  console.log(`  ✓ APIritivoResolver at ${receipt.contractAddress} (owner ${account.address})`);
  await send("setResolver on ETHRegistry", {
    to: ETH_REGISTRY,
    data: encodeFunctionData({ abi: registryAbi, functionName: "setResolver", args: [tokenId, receipt.contractAddress] }),
  });
  console.log(`  ✓ ${name} now resolves through ${receipt.contractAddress}`);
  process.exit(0);
}

if (cmd === "records") {
  const resolverAddr =
    (flag("--resolver") as Address | undefined) ?? (await pub.readContract({ address: ETH_REGISTRY, abi: registryAbi, functionName: "getResolver", args: [label] }));
  if (!resolverAddr || /^0x0{40}$/.test(resolverAddr)) throw new Error("name has no resolver; run `resolver <label>` first");
  const addr = flag("--addr");
  const serviceId = flag("--service");
  const manifest = flag("--manifest");
  const calls: Hex[] = [];
  const plan: string[] = [];
  if (addr) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error("--addr must be an EVM address");
    calls.push(encodeFunctionData({ abi: resolverAbi, functionName: "setAddr", args: [node, addr as Address] }));
    plan.push(`addr → ${addr}`);
  }
  if (serviceId) {
    calls.push(encodeFunctionData({ abi: resolverAbi, functionName: "setText", args: [node, TEXT_KEY, serviceId] }));
    plan.push(`text ${TEXT_KEY} → ${serviceId}`);
  }
  if (manifest) {
    calls.push(encodeFunctionData({ abi: resolverAbi, functionName: "setContenthash", args: [node, swarmContenthash(manifest)] }));
    plan.push(`contenthash → bzz://${manifest}`);
  }
  if (calls.length === 0) throw new Error("nothing to set: pass --addr, --service and/or --manifest");
  console.log(`${name} (node ${node}) · resolver ${resolverAddr}\n  ${plan.join("\n  ")}`);
  await send("records (multicall)", { to: resolverAddr, data: encodeFunctionData({ abi: resolverAbi, functionName: "multicall", args: [calls] }) });
  if (!dryRun) {
    const [a, t, c] = await Promise.all([
      pub.readContract({ address: resolverAddr, abi: resolverAbi, functionName: "addr", args: [node] }),
      pub.readContract({ address: resolverAddr, abi: resolverAbi, functionName: "text", args: [node, TEXT_KEY] }),
      pub.readContract({ address: resolverAddr, abi: resolverAbi, functionName: "contenthash", args: [node] }),
    ]);
    console.log(`  now: addr=${a} · text=${t || "(empty)"} · contenthash=${c === "0x" ? "(empty)" : `${c.slice(0, 24)}…`}`);
  }
  process.exit(0);
}
console.error(`unknown command ${cmd}`);
process.exit(2);
