import { readConfig } from '../apps/gateway/src/config.ts';
import { createPublicClient, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient as arkivClient, str } from '@arkiv-network/sdk';
import { eq } from '@arkiv-network/sdk/query';
const config = readConfig();
let failed = false;
const checks = await Promise.allSettled([
  ...[{ name: 'avalanche-fuji', url: config.FUJI_RPC_URL, chain: avalancheFuji, key: config.FUJI_PRIVATE_KEY },
    { name: 'arkiv-tiramisu', url: config.ARKIV_RPC_URL, chain: tiramisu, key: config.ARKIV_PRIVATE_KEY }].map(async network => {
    const client = createPublicClient({ chain: network.chain, transport: http(network.url, { timeout: 10000, retryCount: 0 }) });
    const [chainId, block] = await Promise.all([client.getChainId(), client.getBlockNumber()]);
    if (chainId !== network.chain.id) throw new Error(`${network.name}: unexpected chain ${chainId}`);
    const query = network.name === 'arkiv-tiramisu'
      ? await arkivClient({ chain: tiramisu, transport: http(network.url, { timeout: 10000, retryCount: 0 }) }).select({ key: true }).where(eq('app', str('apiperitivo'))).limit(1).fetch()
      : undefined;
    const address = network.key ? privateKeyToAccount(network.key).address : undefined;
    return { network: network.name, chainId, block: block.toString(), connected: true, sdkQueryVerified: query ? true : undefined, signer: address ?? 'not configured', balanceAtomic: address ? (await client.getBalance({ address })).toString() : undefined };
  }),
  (async () => { const response = await fetch(config.SWARM_ID_URL, { signal: AbortSignal.timeout(10000) }); if (!response.ok) throw new Error('Swarm ID unavailable'); return { network: 'swarm-id', reachable: true, note: 'Reachability only; login and uploads require a browser session' }; })(),
  (async () => { const response = await fetch(`${config.SWARM_BEE_URL.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(5000) }); if (!response.ok) throw new Error('Configured Bee node unavailable'); return { network: 'swarm-bee', reachable: true, uploadBatchConfigured: !!config.SWARM_POSTAGE_BATCH_ID }; })(),
]);
for (const [index, check] of checks.entries()) {
  if (check.status === 'fulfilled') console.log(JSON.stringify(check.value));
  else { failed = true; console.log(JSON.stringify({ network: ['avalanche-fuji', 'arkiv-tiramisu', 'swarm-id', 'swarm-bee'][index], connected: false, error: check.reason instanceof Error ? check.reason.message.split('\n')[0] : 'Connection failed' })); }
}
process.exitCode = failed ? 1 : 0;
