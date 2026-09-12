import { readConfig } from './config.ts';
import { Store } from './db/store.ts';
import { acquireLock } from './db/lock.ts';
import { createApp } from './app.ts';
import { ArkivNetwork } from '../../../packages/arkiv/src/client.ts';
import { FujiMarket } from '../../../packages/avalanche/src/client.ts';
import { BeeStorage } from '../../../packages/swarm/src/server.ts';
import { privateKeyToAccount } from 'viem/accounts';

const config = readConfig();
const release = acquireLock(config.DATABASE_PATH);
const store = new Store(config.DATABASE_PATH);
store.recoverInterruptedUsage();
const issuer = config.ARKIV_ISSUER_ADDRESS ?? (config.ARKIV_PRIVATE_KEY ? privateKeyToAccount(config.ARKIV_PRIVATE_KEY).address : undefined);
const { api, worker } = await createApp({ config, store,
  arkiv: issuer ? new ArkivNetwork(config.ARKIV_RPC_URL, issuer, config.ARKIV_PRIVATE_KEY) : undefined,
  market: config.MARKET_ADDRESS ? new FujiMarket(config.FUJI_RPC_URL, config.MARKET_ADDRESS, config.PAYMENT_CONFIRMATIONS) : undefined,
  swarm: new BeeStorage(config.SWARM_BEE_URL, config.SWARM_POSTAGE_BATCH_ID),
});
let timer: ReturnType<typeof setInterval> | undefined;
if (config.ARKIV_PRIVATE_KEY && worker) {
  const tick = () => { void worker.tick().catch(() => api.log.error('Activation worker failed; retrying next interval')); };
  timer = setInterval(tick, 5000); timer.unref(); tick();
}
api.addHook('onClose', async () => { clearInterval(timer); await worker?.drain(); store.close(); release(); });
let closing = false;
const shutdown = async () => { if (!closing) { closing = true; await api.close(); } };
process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
try { await api.listen({ host: config.HOST, port: config.PORT }); }
catch (error) { await shutdown(); throw error; }
