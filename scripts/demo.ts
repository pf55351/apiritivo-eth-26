import { configSchema } from "../apps/gateway/src/config.ts";
import { Store } from "../apps/gateway/src/db/store.ts";
import { acquireLock } from "../apps/gateway/src/db/lock.ts";
import { createApp } from "../apps/gateway/src/app.ts";
import { DemoNetwork, DEMO_KEY } from "../apps/gateway/src/demo/network.ts";
import { registerWeb } from "../apps/gateway/src/web.ts";

if (process.env.NODE_ENV === "production")
  throw new Error("Local demo is disabled in production");
const port = Number(process.env.DEMO_PORT ?? 3002);
const config = configSchema.parse({
  NODE_ENV: "development",
  PORT: port,
  APP_ORIGIN: `http://localhost:${port}`,
  DATABASE_PATH: process.env.DEMO_DATABASE_PATH ?? "var/demo.sqlite",
  RECEIPT_PRIVATE_KEY: DEMO_KEY,
});
const release = acquireLock(config.DATABASE_PATH),
  store = new Store(config.DATABASE_PATH);
store.recoverInterruptedUsage();
const demo = new DemoNetwork(store);
await demo.initialize();
const { api, worker } = await createApp({
  config,
  store,
  arkiv: demo,
  market: demo,
  swarm: demo,
  demo,
});
await registerWeb(api, !process.argv.includes("--built"));
const timer = setInterval(() => {
  void worker!.tick().catch(() => api.log.error("Demo activation failed"));
}, 500);
api.addHook("onClose", async () => {
  clearInterval(timer);
  await worker?.drain();
  store.close();
  release();
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void api.close();
  });
try {
  await api.listen({ port, host: "127.0.0.1" });
} catch (error) {
  await api.close();
  throw error;
}
console.log(
  `Local demo: http://localhost:${port} — payments, Arkiv and Swarm are simulated; API operations run locally.`,
);
