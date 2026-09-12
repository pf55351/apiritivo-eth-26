import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { manifestSchema, signedManifestSchema, listingSchema, entitlementSchema, listingFromManifest, namedId } from '../packages/domain/src/index.ts';
import { sampleManifests } from './sample-manifests.ts';
import { operationSchemas } from '../packages/domain/src/operations.ts';
await mkdir('packages/domain/schemas', { recursive: true });
for (const [name, schema] of Object.entries({ manifest: manifestSchema, 'signed-manifest': signedManifestSchema, listing: listingSchema, entitlement: entitlementSchema })) {
  await writeFile(`packages/domain/schemas/${name}.json`, JSON.stringify(z.toJSONSchema(schema, { io: 'input' }), null, 2) + '\n');
}
for (const [operation, schemas] of Object.entries(operationSchemas)) {
  for (const [direction, schema] of Object.entries(schemas)) {
    await writeFile(`packages/domain/schemas/${operation}.${direction}.json`, JSON.stringify(z.toJSONSchema(schema), null, 2) + '\n');
  }
}
await mkdir('examples', { recursive: true });
const [manifest] = sampleManifests('0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222');
await writeFile('examples/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
await writeFile('examples/arkiv-listing.json', JSON.stringify(listingFromManifest(manifest, namedId('example-only-not-uploaded')), null, 2) + '\n');
