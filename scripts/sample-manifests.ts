import { APP, FUJI_USDC, manifestSchema, namedId, type Manifest } from '../packages/domain/src/index.ts';
import type { Hex } from 'viem';
export function sampleManifests(provider: Hex, treasury: Hex): Manifest[] {
  return [
    { slug: 'text', name: 'Text Spritz', category: 'text', description: 'Word counts, reading time and word frequencies for your text.', operations: ['text.analyze'] },
    { slug: 'json', name: 'JSON Tonic', category: 'utilities', description: 'Select fields from JSON records through a protected API.', operations: ['json.transform'] },
  ].map(service => manifestSchema.parse({
    schemaVersion: 1, app: APP, serviceId: namedId(`${provider.toLowerCase()}:${service.slug}`),
    planId: namedId(`${provider.toLowerCase()}:${treasury.toLowerCase()}:${service.slug}:v1:60s:100000`),
    name: service.name, version: '1.0.0', category: service.category, description: service.description,
    provider, treasury, chainId: 43113, token: FUJI_USDC, priceAtomic: '100000', durationSeconds: 60, feeBps: 1000,
    operations: service.operations, limits: { requestsPerMinute: 60, concurrency: 2, bodyBytes: 65536, timeoutMs: 5000 },
    terms: 'Fuji demo. Access starts when the Arkiv entitlement is created and lasts 30 Arkiv blocks (approximately 60 seconds). Price is per time window. Rate and concurrency limits apply. Payments are test USDC. Activation is asynchronous; no automatic refund.',
  }));
}
