/**
 * Browser-only ENS writes signed by the user's own wallet (MetaMask, Rabby, Core).
 * The app server never writes ENS; this is the user acting on their own address.
 */
import { type Address, createWalletClient, custom, type Hash } from "viem";
import { ensChain, normalizeEnsName, primaryNameSetter, resolveEnsAddress } from "./index";

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function provider(): Eip1193 {
  const eth = (globalThis as { ethereum?: Eip1193 }).ethereum;
  if (!eth) throw new Error("No EVM wallet found.");
  return eth;
}

/** Switch the injected wallet to the ENS chain, adding it when the wallet does not know it. */
export async function ensureEnsChain(): Promise<void> {
  const chain = ensChain();
  const eth = provider();
  const hex = `0x${chain.id.toString(16)}`;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (err) {
    if ((err as { code?: number })?.code !== 4902) throw new Error(`Switch your wallet to ${chain.name} to continue.`);
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hex,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls.default.http,
          blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : [],
        },
      ],
    });
  }
}

/**
 * Set `name` as the primary name of `owner` (the connected account). The name
 * must already resolve to `owner`, otherwise resolvers ignore the reverse record.
 */
export async function setPrimaryName(owner: Address, name: string): Promise<Hash> {
  const n = normalizeEnsName(name);
  if (!n) throw new Error("Use a .eth name like myname.eth.");
  const forward = await resolveEnsAddress(n);
  if (!forward || forward.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(forward ? `${n} resolves to ${forward}, not to your wallet.` : `${n} has no ETH address record yet.`);
  }
  await ensureEnsChain();
  const setter = primaryNameSetter();
  const client = createWalletClient({ account: owner, chain: ensChain(), transport: custom(provider()) });
  return client.writeContract({ address: setter.address, abi: setter.abi as never, functionName: setter.functionName as never, args: setter.args(owner, n) as never });
}
