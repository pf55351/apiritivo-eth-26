import Fastify, { type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { z, ZodError } from 'zod';
import { randomBytes, randomUUID } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { AppError, address, hex32, nonzero32, operationId, receiptMessage, canonical, type Purchase } from '../../../packages/domain/src/index.ts';
import type { ArkivPort, MarketPort, SwarmPort } from '../../../packages/domain/src/ports.ts';
import { subjectFor, verifyChallenge } from '../../../packages/auth/src/proof.ts';
import { operations as defaultOperations, type Operation } from '../../../packages/provider-adapters/src/index.ts';
import { ActivationWorker } from './workers/activation.ts';
import { Purchases, purchaseView } from './services/purchases.ts';
import type { Config } from './config.ts';
import type { Store } from './db/store.ts';
import { operationSchemas } from '../../../packages/domain/src/operations.ts';
import { Offers } from './services/offers.ts';
import type { DemoNetwork } from './demo/network.ts';

export type Dependencies = { config: Config; store: Store; arkiv?: ArkivPort; market?: MarketPort; swarm: SwarmPort; operations?: Record<string, Operation>; demo?: DemoNetwork; marketOwner?: () => Promise<Hex> };
export async function createApp(deps: Dependencies) {
  const { config, store, arkiv, market, swarm } = deps;
  if (deps.demo && config.NODE_ENV === 'production') throw new Error('Demo adapters cannot run in production');
  const api = Fastify({ logger: { level: config.NODE_ENV === 'test' ? 'silent' : 'info', redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'] }, bodyLimit: 131072, requestTimeout: 35000 });
  await api.register(cookie);
  await api.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  const purchases = arkiv && market ? new Purchases(store, market, arkiv, swarm) : undefined;
  const offers = arkiv && market && (deps.demo || deps.marketOwner) ? new Offers(store, market, arkiv, swarm, deps.marketOwner) : undefined;
  const worker = arkiv && market ? new ActivationWorker(store, arkiv, market, async () => { await offers?.recoverPending(); }) : undefined;
  const operations = deps.operations ?? defaultOperations;
  const requirePurchases = () => { if (!purchases) throw new AppError('PAYMENTS_NOT_CONFIGURED', 503); return purchases; };
  const requireArkiv = () => { if (!arkiv) throw new AppError('ARKIV_NOT_CONFIGURED', 503); return arkiv; };
  const session = (request: FastifyRequest): Hex => {
    const subject = request.cookies.apiperitivo_session && store.session(request.cookies.apiperitivo_session);
    if (!subject) throw new AppError('AUTH_REQUIRED', 401);
    return subject;
  };
  const ownedPurchase = (id: Hex, subject: Hex) => {
    const purchase = store.getPurchase(id);
    if (!purchase || purchase.intent.subject !== subject) throw new AppError('PURCHASE_NOT_FOUND', 404);
    return purchase;
  };
  const check = async (p: Purchase) => {
    if (!p.activation || p.status !== 'active') throw new AppError('ACCESS_NOT_ACTIVE', 403);
    try { return await requireArkiv().checkEntitlement(p.entitlement, p.activation); }
    catch { throw new AppError('ACCESS_CHECK_UNAVAILABLE', 503); }
  };
  api.addHook('onRequest', async request => {
    const path = request.url.split('?')[0];
    const bearerInvoke = /^\/api\/passes\/0x[0-9a-fA-F]{64}\/invoke\//.test(path) && request.headers.authorization?.startsWith('Bearer ');
    // Bearer-only invocation is safe without cookies. All cookie mutations require the exact origin.
    if (['POST', 'DELETE', 'PUT', 'PATCH'].includes(request.method)) {
      if (!bearerInvoke && request.headers.origin !== config.APP_ORIGIN) throw new AppError('ORIGIN_REJECTED', 403);
    }
    // Only login bootstrap is public. Direct catalog/schema requests must authenticate too.
    const loginRoutes = ['/api/config', '/api/auth/challenge', '/api/auth/verify', '/api/auth/session'];
    if (path.startsWith('/api/') && !loginRoutes.includes(path) && !bearerInvoke) session(request);
  });
  api.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
  });
  api.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const appError = error instanceof AppError ? error : error instanceof ZodError
      ? new AppError('INVALID_INPUT', 400) : new AppError(error.statusCode === 429 ? 'RATE_LIMITED' : error.statusCode === 413 ? 'BODY_TOO_LARGE' : error.statusCode === 400 ? 'INVALID_INPUT' : 'DEPENDENCY_UNAVAILABLE', error.statusCode && error.statusCode < 500 ? error.statusCode : 503);
    if (appError.status === 429) reply.header('Retry-After', '60');
    // Avoid dumping SDK errors: their diagnostic objects can contain signed transaction material.
    request.log.warn({ code: appError.code }, 'Request rejected');
    reply.code(appError.status).send({ error: { code: appError.code, message: appError.message }, requestId: request.id });
  });
  api.get('/health', async () => ({ app: 'apiperitivo', status: 'running', configured: { arkiv: !!arkiv, payments: !!market, swarmUpload: !!config.SWARM_POSTAGE_BATCH_ID, activationSigner: !!config.ARKIV_PRIVATE_KEY } }));
  api.get('/api/config', async request => {
    if (!request.cookies.apiperitivo_session || !store.session(request.cookies.apiperitivo_session)) return {
      appOrigin: config.APP_ORIGIN, swarmIdUrl: config.SWARM_ID_URL, mode: deps.demo ? 'demo' : 'testnet', feeBps: 0,
      ready: { catalog: false, checkout: false, publishing: false, receipts: false },
    };
    return { appOrigin: config.APP_ORIGIN, swarmIdUrl: config.SWARM_ID_URL, chainId: 43113, market: market?.address, arkivIssuer: arkiv?.issuer,
    mode: deps.demo ? 'demo' : 'testnet', treasury: config.TREASURY_ADDRESS ?? deps.demo?.issuer, feeBps: 1000,
    publisher: await deps.marketOwner?.().catch(() => undefined),
    ready: { catalog: !!arkiv, checkout: !!market && !!arkiv && (!!deps.demo || !!config.ARKIV_PRIVATE_KEY), publishing: !!offers && (!!deps.demo || !!config.SWARM_POSTAGE_BATCH_ID) && (!!deps.demo || !!config.ARKIV_PRIVATE_KEY), receipts: !!config.RECEIPT_PRIVATE_KEY },
  }; });
  api.get('/api/auth/session', async request => ({ subject: session(request) }));
  api.get('/api/offers', async request => { const subject = session(request); return { offers: offers?.list(subject) ?? [] }; });
  api.post('/api/offers', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async request => {
    const subject = session(request);
    if (!offers) throw new AppError('PUBLISHING_NOT_CONFIGURED', 503);
    return offers.prepare(subject, request.body);
  });
  api.post('/api/offers/:planId/publish', async request => {
    const subject = session(request), { planId } = z.strictObject({ planId: nonzero32 }).parse(request.params);
    if (!offers || !worker) throw new AppError('PUBLISHING_NOT_CONFIGURED', 503);
    return offers.publish(subject, planId, worker);
  });
  api.post('/api/offers/:planId/prepare', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async request => {
    const subject = session(request), { planId } = z.strictObject({ planId: nonzero32 }).parse(request.params);
    if (!offers) throw new AppError('PUBLISHING_NOT_CONFIGURED', 503);
    return offers.resume(subject, planId);
  });
  if (deps.demo) {
    api.post('/api/demo/pay', async request => {
      const subject = session(request), { purchaseIntentId } = z.strictObject({ purchaseIntentId: nonzero32 }).parse(request.body);
      const intent = store.getIntent(purchaseIntentId);
      if (!intent || intent.subject !== subject) throw new AppError('PURCHASE_NOT_FOUND', 404);
      return deps.demo!.pay(intent);
    });
    api.post('/api/demo/register', async request => {
      const subject = session(request), { planId } = z.strictObject({ planId: nonzero32 }).parse(request.body);
      const offer = offers!.get(planId, subject);
      if (!offer.reference) throw new AppError('MANIFEST_NOT_UPLOADED', 409);
      deps.demo!.register(offer.signed.manifest, offer.reference); return { registered: true };
    });
  }
  api.get('/api/operations', async () => Object.fromEntries(Object.entries(operationSchemas).map(([id, schemas]) => [id, {
    input: z.toJSONSchema(schemas.input), output: z.toJSONSchema(schemas.output),
  }])));
  api.post('/api/auth/challenge', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async request => {
    const { publicKey } = z.strictObject({ publicKey: hex32 }).parse(request.body);
    const challenge = { id: randomUUID(), publicKey, nonce: `0x${randomBytes(32).toString('hex')}` as Hex, audience: config.APP_ORIGIN, expiresAt: Date.now() + 120000 };
    store.challenge(challenge); return challenge;
  });
  api.post('/api/auth/verify', async (request, reply) => {
    const body = z.strictObject({ challengeId: z.uuid(), signature: z.string().regex(/^0x[0-9a-fA-F]{128}$/) }).parse(request.body);
    const challenge = store.getChallenge(body.challengeId);
    if (!challenge || challenge.expiresAt <= Date.now() || challenge.audience !== config.APP_ORIGIN || !verifyChallenge(challenge, body.signature as Hex) || !store.consumeChallenge(challenge.id, Date.now())) throw new AppError('INVALID_PROOF', 401);
    const subject = subjectFor(challenge.publicKey), token = store.createSession(subject);
    reply.setCookie('apiperitivo_session', token, { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 86400 });
    return { subject };
  });
  api.delete('/api/auth/session', async (request, reply) => {
    if (request.cookies.apiperitivo_session) store.logout(request.cookies.apiperitivo_session);
    reply.clearCookie('apiperitivo_session', { path: '/' }); return { ok: true };
  });
  api.get('/api/services', async request => {
    const query = z.strictObject({ category: z.enum(['text', 'data', 'utilities']).optional(), maxPriceAtomic: z.string().regex(/^\d{1,77}$/).optional() }).parse(request.query);
    return { services: await requireArkiv().listServices(query), limit: 100 };
  });
  api.get('/api/plans/:planId', async request => requirePurchases().plan(z.strictObject({ planId: nonzero32 }).parse(request.params).planId));
  api.post('/api/purchases/prepare', async request => {
    const body = z.strictObject({ planId: nonzero32, payer: address }).parse(request.body);
    return requirePurchases().prepare(session(request), body.payer, body.planId);
  });
  api.post('/api/purchases/confirm', async (request, reply) => {
    const body = z.strictObject({ purchaseIntentId: nonzero32, txHash: nonzero32 }).parse(request.body);
    const purchase = await requirePurchases().confirm(session(request), body.purchaseIntentId, body.txHash);
    reply.code(202); return purchaseView(purchase);
  });
  api.get('/api/purchases/:purchaseId', async request => purchaseView(ownedPurchase(z.strictObject({ purchaseId: nonzero32 }).parse(request.params).purchaseId, session(request))));
  api.get('/api/passes', async request => {
    const result = [];
    for (const p of store.purchases(session(request))) {
      let access = 'pending', remainingSeconds: number | undefined;
      if (p.activation) {
        try { const live = await check(p); access = live.active ? 'active' : live.head >= BigInt(p.activation.expiresAtBlock) ? 'expired' : 'inactive'; remainingSeconds = Math.max(0, Number(BigInt(p.activation.expiresAtBlock) - live.head) * 2); }
        catch { access = 'unavailable'; }
      }
      result.push({ ...purchaseView(p), access, remainingSeconds, checkedAt: Date.now() });
    }
    return { passes: result };
  });
  api.post('/api/passes/:purchaseId/credentials', async request => {
    const subject = session(request), { purchaseId } = z.strictObject({ purchaseId: nonzero32 }).parse(request.params);
    const body = z.strictObject({ operations: z.array(operationId).min(1).max(2), ttlSeconds: z.number().int().min(10).max(3600).default(300) }).parse(request.body);
    const p = ownedPurchase(purchaseId, subject);
    if (!body.operations.every(op => p.manifest.operations.includes(op))) throw new AppError('OPERATION_NOT_ALLOWED', 403);
    if (!(await check(p)).active) throw new AppError('ACCESS_NOT_ACTIVE', 403);
    return store.createCredential(subject, purchaseId, body.operations, Date.now() + body.ttlSeconds * 1000);
  });
  api.delete('/api/credentials/:credentialId', async request => {
    const { credentialId } = z.strictObject({ credentialId: z.uuid() }).parse(request.params);
    store.revokeCredential(credentialId, session(request)); return { ok: true };
  });
  api.post('/api/passes/:purchaseId/invoke/:operationId', async request => {
    const params = z.strictObject({ purchaseId: nonzero32, operationId }).parse(request.params);
    const token = request.headers.authorization;
    let subject: Hex;
    if (token) {
      const credential = /^Bearer [a-f0-9]{64}$/.test(token) ? store.credential(token.slice(7)) : undefined;
      if (!credential) throw new AppError('AUTH_REQUIRED', 401);
      if (credential.purchaseId !== params.purchaseId || !credential.operations.includes(params.operationId)) throw new AppError('OPERATION_NOT_ALLOWED', 403);
      subject = credential.subject;
    } else subject = session(request);
    const p = ownedPurchase(params.purchaseId, subject), operation = operations[params.operationId];
    if (!operation || !p.manifest.operations.includes(params.operationId)) throw new AppError('OPERATION_NOT_ALLOWED', 403);
    if (Buffer.byteLength(JSON.stringify(request.body) ?? '') > p.manifest.limits.bodyBytes) throw new AppError('BODY_TOO_LARGE', 413);
    const input = operation.input.parse(request.body);
    const live = await check(p);
    if (!live.active) throw new AppError(live.head >= BigInt(p.activation!.expiresAtBlock) ? 'ACCESS_EXPIRED' : 'ACCESS_NOT_ACTIVE', 403);
    const usageId = store.admit(params.purchaseId, params.operationId, p.manifest.limits.requestsPerMinute, p.manifest.limits.concurrency);
    const abort = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    let outcome = 'error';
    try {
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(new AppError('PROVIDER_TIMEOUT', 504)); }, p.manifest.limits.timeoutMs); });
      const output = await Promise.race([operation.run(input, abort.signal), timeout]);
      outcome = 'success'; return { data: output, purchaseId: params.purchaseId };
    } catch (error) { throw error instanceof AppError ? error : new AppError('PROVIDER_ERROR', 502); }
    finally { clearTimeout(timer); store.finishUsage(usageId, outcome); }
  });
  api.post('/api/purchases/:purchaseId/receipt', async request => {
    const { purchaseId } = z.strictObject({ purchaseId: nonzero32 }).parse(request.params), p = ownedPurchase(purchaseId, session(request));
    const existing = store.receipt(purchaseId); if (existing) return existing;
    const live = await check(p);
    if (live.active || live.head < BigInt(p.activation!.expiresAtBlock) || store.usage(purchaseId).inflight) throw new AppError('RECEIPT_NOT_FINAL', 409);
    if (!config.RECEIPT_PRIVATE_KEY) throw new AppError('RECEIPT_SIGNER_NOT_CONFIGURED', 503);
    const signer = privateKeyToAccount(config.RECEIPT_PRIVATE_KEY);
    const usage = store.closeAdmissions(purchaseId);
    const receipt = { schemaVersion: 1, app: 'apiperitivo', type: 'final-receipt', purchaseId, subject: p.intent.subject,
      planId: p.intent.planId, manifestRef: p.intent.manifestRef, payment: p.payment, payer: p.intent.payer,
      priceAtomic: p.manifest.priceAtomic, token: p.manifest.token, chainId: p.manifest.chainId, market: market!.address,
      activation: p.activation, usage, finalizedAt: new Date().toISOString() };
    const signed = { receipt, signer: signer.address.toLowerCase(), signature: await signer.signMessage({ message: receiptMessage(receipt) }) };
    store.putReceipt(purchaseId, signed); return store.receipt(purchaseId);
  });
  api.post('/api/purchases/:purchaseId/receipt-reference', async request => {
    const { purchaseId } = z.strictObject({ purchaseId: nonzero32 }).parse(request.params);
    ownedPurchase(purchaseId, session(request));
    const { reference } = z.strictObject({ reference: nonzero32 }).parse(request.body), expected = store.receipt(purchaseId);
    if (!expected || canonical(await swarm.readJson(reference)) !== canonical(expected)) throw new AppError('RECEIPT_MISMATCH', 409);
    store.receiptReference(purchaseId, reference); return { verified: true, reference, visibility: 'public', verifiedBy: 'gateway' };
  });
  return { api, worker };
}
