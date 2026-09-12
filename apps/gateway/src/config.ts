import { z } from 'zod';
import { address, hex32 } from '../../../packages/domain/src/index.ts';
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(v => v === '' ? undefined : v, schema.optional());
export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'), PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.url().default('http://localhost:3001'), DATABASE_PATH: z.string().default('var/apiperitivo.sqlite'),
  FUJI_RPC_URL: z.url().default('https://api.avax-test.network/ext/bc/C/rpc'),
  MARKET_ADDRESS: optional(address), FUJI_PRIVATE_KEY: optional(hex32),
  PAYMENT_CONFIRMATIONS: z.coerce.number().int().min(1).max(100).default(2),
  ARKIV_RPC_URL: z.url().default('https://rpc.tiramisu.db-chain.testnet.arkiv.network'),
  ARKIV_PRIVATE_KEY: optional(hex32), ARKIV_ISSUER_ADDRESS: optional(address),
  SWARM_BEE_URL: z.url().default('http://localhost:1633'), SWARM_POSTAGE_BATCH_ID: optional(z.string().regex(/^[a-fA-F0-9]{64}$/)),
  SWARM_ID_URL: z.url().default('https://swarm-id.snaha.net'),
  PROVIDER_PRIVATE_KEY: optional(hex32), TREASURY_ADDRESS: optional(address), RECEIPT_PRIVATE_KEY: optional(hex32),
}).superRefine((value, ctx) => {
  if (new URL(value.APP_ORIGIN).origin !== value.APP_ORIGIN) ctx.addIssue({ code: 'custom', path: ['APP_ORIGIN'], message: 'Use an exact origin without path or trailing slash' });
  if (value.NODE_ENV === 'production' && !value.APP_ORIGIN.startsWith('https://')) ctx.addIssue({ code: 'custom', path: ['APP_ORIGIN'], message: 'Production requires HTTPS' });
});
export const readConfig = () => configSchema.parse(process.env);
export type Config = z.infer<typeof configSchema>;
