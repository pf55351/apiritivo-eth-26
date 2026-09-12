import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readConfig } from '../apps/gateway/src/config.ts';
import { acquireLock } from '../apps/gateway/src/db/lock.ts';
import { BeeStorage } from '../packages/swarm/src/server.ts';
import { ArkivNetwork } from '../packages/arkiv/src/client.ts';
import { FujiMarket, assertPlan } from '../packages/avalanche/src/client.ts';
import { accessMarketAbi } from '../packages/avalanche/src/abi.ts';
import { canonical, listingFromManifest, manifestMessage, manifestSchema, nonzero32, type Manifest, type SignedTransaction, type Activation } from '../packages/domain/src/index.ts';
import { sampleManifests } from './sample-manifests.ts';

const config = readConfig();
const existingReference = process.argv[2] === '--reference' ? nonzero32.parse(process.argv[3]) : undefined;
if (!config.FUJI_PRIVATE_KEY || !config.MARKET_ADDRESS || !config.ARKIV_PRIVATE_KEY) throw new Error('Configure Fuji operator, market and Arkiv issuer in .env');
if (!existingReference && (!config.PROVIDER_PRIVATE_KEY || !config.TREASURY_ADDRESS || !config.SWARM_POSTAGE_BATCH_ID)) throw new Error('Creating manifests requires provider signer, treasury and Swarm upload batch in .env');
const operator = privateKeyToAccount(config.FUJI_PRIVATE_KEY), provider = config.PROVIDER_PRIVATE_KEY ? privateKeyToAccount(config.PROVIDER_PRIVATE_KEY) : undefined, issuer = privateKeyToAccount(config.ARKIV_PRIVATE_KEY);
const market = new FujiMarket(config.FUJI_RPC_URL, config.MARKET_ADDRESS, config.PAYMENT_CONFIRMATIONS);
const arkiv = new ArkivNetwork(config.ARKIV_RPC_URL, config.ARKIV_ISSUER_ADDRESS ?? issuer.address, config.ARKIV_PRIVATE_KEY);
const swarm = new BeeStorage(config.SWARM_BEE_URL, config.SWARM_POSTAGE_BATCH_ID);
const rpc = createPublicClient({ chain: avalancheFuji, transport: http(config.FUJI_RPC_URL) });
const wallet = createWalletClient({ account: operator, chain: avalancheFuji, transport: http(config.FUJI_RPC_URL) });
if (await rpc.getChainId() !== 43113) throw new Error('Wrong Fuji chain');
if ((await rpc.readContract({ address: config.MARKET_ADDRESS, abi: accessMarketAbi, functionName: 'owner' })).toLowerCase() !== operator.address.toLowerCase()) throw new Error('FUJI_PRIVATE_KEY must be the market operator');
const manifests: Manifest[] = existingReference ? [(await swarm.readManifest(existingReference)).manifest] : process.argv[2]
  ? [manifestSchema.parse(JSON.parse(await readFile(process.argv[2], 'utf8')))]
  : sampleManifests(provider!.address, config.TREASURY_ADDRESS!);
const release = acquireLock(config.DATABASE_PATH);
try {
  await mkdir('var/publications', { recursive: true });
  for (const manifest of manifests) {
    if (!existingReference && manifest.provider !== provider!.address.toLowerCase()) throw new Error('Provider signer does not match manifest');
    const path = `var/publications/${manifest.planId.slice(2)}.json`;
    let journal: { manifest: Manifest; manifestRef?: Hex; arkivTransaction?: SignedTransaction; activation?: Activation } = { manifest, manifestRef: existingReference };
    try { journal = JSON.parse(await readFile(path, 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (canonical(journal.manifest) !== canonical(manifest)) throw new Error('Plan terms changed: use a new planId');
    if (existingReference && journal.manifestRef !== existingReference) throw new Error('Existing publication has a different reference');
    const save = async () => { await writeFile(`${path}.tmp`, JSON.stringify(journal, null, 2), { mode: 0o600 }); const { rename } = await import('node:fs/promises'); await rename(`${path}.tmp`, path); };
    if (!journal.manifestRef) {
      const signed = { manifest, signature: await provider!.signMessage({ message: manifestMessage(manifest) }) };
      journal.manifestRef = await swarm.uploadJson(signed); await save();
    }
    const ref = journal.manifestRef;
    const plan = await market.getPlan(manifest.planId);
    if (/^0x0{40}$/.test(plan.provider)) {
      const { request } = await rpc.simulateContract({ account: operator, address: config.MARKET_ADDRESS, abi: accessMarketAbi, functionName: 'registerPlan', args: [manifest.planId, {
        serviceId: manifest.serviceId, manifestRef: ref, provider: manifest.provider, treasury: manifest.treasury,
        priceAtomic: BigInt(manifest.priceAtomic), durationSeconds: manifest.durationSeconds, feeBps: manifest.feeBps, active: true,
      }] });
      const tx = await wallet.writeContract(request);
      if ((await rpc.waitForTransactionReceipt({ hash: tx, confirmations: config.PAYMENT_CONFIRMATIONS })).status !== 'success') throw new Error('Plan registration reverted');
    } else assertPlan(manifest, plan, ref);
    const listing = listingFromManifest(manifest, ref);
    if (!journal.activation) {
      if (journal.arkivTransaction) journal.activation = await arkiv.recoverEntitlement(journal.arkivTransaction);
      else {
        const existing = await arkiv.getListing(manifest.planId);
        if (existing) {
          if (canonical(existing) !== canonical(listing)) throw new Error('Listing mismatch');
          console.log(JSON.stringify({ name: manifest.name, planId: manifest.planId, manifestRef: ref, listing: 'already exists' }));
          continue;
        }
        journal.activation = await arkiv.publishListing(listing, 7 * 86400, tx => {
          journal.arkivTransaction = tx;
          // Must be synchronously durable before the transport can broadcast.
          const serialized = JSON.stringify(journal, null, 2);
          persistSignedJournal(path, serialized);
        });
      }
      await save();
    }
    console.log(JSON.stringify({ name: manifest.name, planId: manifest.planId, manifestRef: ref, arkiv: journal.activation }));
  }
} finally { release(); }

import { openSync, writeFileSync, fsyncSync, closeSync, renameSync } from 'node:fs';
function persistSignedJournal(path: string, value: string) {
  const fd = openSync(`${path}.tmp`, 'w', 0o600);
  try { writeFileSync(fd, value); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(`${path}.tmp`, path);
}
