# CLAUDE.md — APIperitivo Phase 1

You are implementing APIperitivo Phase 1.

Read `README.md` and `AGENTS.md` completely before editing code.

## Product

APIperitivo is a machine-readable service marketplace.

Phase 1 is intentionally limited to:

```text
Swarm ID login
→ role selection
→ client marketplace from Arkiv
→ provider manifest upload to Swarm
→ provider service publication to Arkiv
```

No payments.

## Core UX

### Login

Use Swarm ID.

After successful login:

```text
Welcome <identity>

How do you want to use APIperitivo?

[ CLIENT ]
Discover services

[ PROVIDER ]
Publish services
```

Persist role in localStorage using Swarm identity id.

### Client

Default route:

```text
/marketplace
```

Load real services from Arkiv.

Render polished service cards.

### Provider

Default route:

```text
/provider
```

Show own services queried from Arkiv.

CTA:

```text
+ Publish Service
```

Publish flow:

```text
form
→ build manifest
→ preview
→ Swarm upload
→ returned reference
→ server Arkiv create
→ success
```

## Schemas

Put schemas in `packages/shared`.

### Service manifest

```ts
type OperationInputType = "string" | "number" | "boolean";

type ServiceManifest = {
  v: 1;
  operations: Record<
    string,
    {
      input: Record<string, OperationInputType>;
    }
  >;
};
```

Validate with Zod.

### Arkiv service

Conceptual:

```ts
type ArkivService = {
  serviceId: string;
  category: string;
  providerId: string;
  providerName?: string;
  available: boolean;
  version: number;
  manifestRef: string;
  name: string;
  description: string;
};
```

## Provider service id

Generate a stable unique id at publish time.

Use a slug + short random id, for example:

```text
market-data-a81f
```

Do not rely only on name slug uniqueness.

## Server write route

Recommended:

```text
POST /api/services
```

Input:

```json
{
  "serviceId": "...",
  "category": "...",
  "providerId": "...",
  "providerName": "...",
  "manifestRef": "...",
  "name": "...",
  "description": "..."
}
```

Validate using Zod.

Server writes to Arkiv using server-only credentials.

For the hackathon, provider identity supplied from current Swarm ID session may be treated as a trusted demo boundary.

Clearly document this trust assumption.

## Reads

Prefer direct Arkiv read adapter where supported.

Do not store service copies in a database.

## Swarm adapter

Expose clean functions like:

```ts
getConnectionInfo()
connect()
disconnect()
uploadServiceManifest(manifest)
downloadServiceManifest(reference)
```

These names are OUR adapter names.

Internally use exact current Swarm ID SDK methods after inspecting package types.

If `canUpload === false`:
- Client can still browse.
- Provider can view provider dashboard.
- Publishing CTA should explain upload is unavailable.
- Do not crash.

## Arkiv adapter

Expose OUR clean functions:

```ts
listServices()
getService(serviceId)
listServicesByProvider(providerId)
publishService(input)
```

Internally use exact current Arkiv SDK.

Do not leak vendor-specific response shapes into React components.

## UI

Use Next.js App Router + TypeScript + Tailwind.

Focus on beautiful cards, category pills, provider avatar/initial, search, filter, empty state, loading skeleton, manifest proof chip and Arkiv proof chip.

### Marketplace card

Must show:

```text
category
name
description
provider
Arkiv ✓
Swarm ✓
View service
```

### Provider form

Friendly fields first.

Do not make raw JSON mandatory.

Operations builder:

```text
operation name
input fields
```

Allow add/remove operation, add/remove input field and select type.

Generate manifest preview live.

## App shell

Header:

```text
APIperitivo
Marketplace
Provider
role badge
Swarm ID identity
Switch role / logout
```

Do not hide both modes.

## Error handling

Provide clear errors:

```text
Swarm ID login failed.
Swarm upload unavailable for this identity.
Manifest upload failed.
Arkiv publication failed.
Manifest could not be downloaded.
No services published yet.
```

Keep raw SDK errors in a collapsible debug area only in development.

## Definition of done

Do not stop at static UI.

P0 must use real Swarm ID auth, real Swarm manifest upload, real Arkiv publish, real Arkiv query and real Swarm manifest download.

If credentials block one integration, isolate it behind the adapter and continue the rest, but clearly report the blocker.
