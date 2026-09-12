import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  type Hex,
  type EIP1193Provider,
} from "viem";
import { avalancheFuji } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { accessMarketAbi } from "../../../packages/avalanche/src/abi.ts";
import type { Manifest } from "../../../packages/domain/src/index.ts";
import { saved } from "./api.ts";

export function demoAccount() {
  let key = sessionStorage.getItem("apiperitivo.demo-wallet") as Hex | null;
  if (!key) {
    key = generatePrivateKey();
    sessionStorage.setItem("apiperitivo.demo-wallet", key);
  }
  return privateKeyToAccount(key);
}
export async function connectWallet() {
  const provider = (window as unknown as { ethereum?: EIP1193Provider })
    .ethereum;
  if (!provider)
    throw new Error(
      "Install an Ethereum wallet such as MetaMask to use Fuji testnet. The local demo needs no wallet.",
    );
  const wallet = createWalletClient({
    chain: avalancheFuji,
    transport: custom(provider),
  });
  const [account] = await wallet.requestAddresses();
  if (!account) throw new Error("Choose a wallet account to continue.");
  try {
    await wallet.switchChain({ id: avalancheFuji.id });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await wallet.addChain({ chain: avalancheFuji });
    await wallet.switchChain({ id: avalancheFuji.id });
  }
  return {
    wallet,
    account,
    rpc: createPublicClient({ chain: avalancheFuji, transport: http() }),
  };
}
export async function sendCall(call: { to: Hex; data: Hex }, payer: Hex) {
  const { wallet, account } = await connectWallet();
  if (account.toLowerCase() !== payer.toLowerCase())
    throw new Error(
      "Select the wallet that started this purchase, then retry.",
    );
  return wallet.sendTransaction({ account, ...call });
}
export async function waitForTransaction(hash: Hex) {
  const receipt = await createPublicClient({
    chain: avalancheFuji,
    transport: http(),
  }).waitForTransactionReceipt({ hash, timeout: 120000 });
  if (receipt.status !== "success")
    throw new Error(
      "The wallet transaction reverted. Check it in your wallet before continuing.",
    );
}
export async function registerPlan(
  market: Hex,
  manifest: Manifest,
  reference: Hex,
) {
  const { wallet, account, rpc } = await connectWallet();
  if (account.toLowerCase() !== manifest.provider)
    throw new Error("Select the wallet that signed this offer.");
  const existing = await rpc.readContract({
    address: market,
    abi: accessMarketAbi,
    functionName: "getPlan",
    args: [manifest.planId],
  });
  const key = `apiperitivo.registration.${market}.${manifest.planId}`;
  if (!/^0x0{40}$/.test(existing.provider)) {
    localStorage.removeItem(key);
    return;
  }
  const pending = saved<{ requested: boolean; hash?: Hex }>(key);
  const settle = async (hash: Hex) => {
    const receipt = await rpc.waitForTransactionReceipt({
      hash,
      timeout: 120000,
    });
    localStorage.removeItem(key);
    if (receipt.status !== "success")
      throw new Error(
        "Registration reverted. Review the transaction in your wallet, then retry publication.",
      );
  };
  if (pending?.hash) {
    await settle(pending.hash);
    return;
  }
  if (pending?.requested)
    throw new Error(
      "Registration was already requested. Check your wallet and retry after it confirms. No second transaction has been sent.",
    );
  const { request } = await rpc.simulateContract({
    account,
    address: market,
    abi: accessMarketAbi,
    functionName: "registerPlan",
    args: [
      manifest.planId,
      {
        serviceId: manifest.serviceId,
        manifestRef: reference,
        provider: manifest.provider,
        treasury: manifest.treasury,
        priceAtomic: BigInt(manifest.priceAtomic),
        durationSeconds: manifest.durationSeconds,
        feeBps: manifest.feeBps,
        active: true,
      },
    ],
  });
  localStorage.setItem(key, JSON.stringify({ requested: true }));
  let hash: Hex;
  try {
    hash = await wallet.writeContract(request);
  } catch (error) {
    // Only an explicit wallet rejection proves that a transaction was not submitted.
    let cause: unknown = error;
    while (cause && typeof cause === "object") {
      if ((cause as { code?: number }).code === 4001) {
        localStorage.removeItem(key);
        break;
      }
      cause = (cause as { cause?: unknown }).cause;
    }
    throw error;
  }
  localStorage.setItem(key, JSON.stringify({ requested: true, hash }));
  await settle(hash);
}
