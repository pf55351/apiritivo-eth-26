# PROMPT_CLAUDE_CODE.md

Build APIperitivo Phase 1 from this repository.

Read these files completely first:

- README.md
- CLAUDE.md
- AGENTS.md

Then inspect the current Swarm ID and Arkiv packages/documentation available in the environment.

Do not invent SDK methods.

## Objective

Implement exactly this product:

```text
LOGIN WITH SWARM ID
        ↓
CHOOSE ROLE
CLIENT / PROVIDER
        ↓
CLIENT:
query all services from Arkiv
render polished marketplace cards
open service detail
download manifest from Swarm

PROVIDER:
open provider dashboard
publish service
build reduced manifest
upload manifest to Swarm
publish service metadata + manifestRef to Arkiv
new service appears in marketplace
```

No wallet.
No Avalanche.
No payment.
No smart contract.

## Architecture

Use a Bun monorepo:

```text
apps/web
packages/shared
packages/swarm
packages/arkiv
```

Use Next.js App Router, TypeScript strict mode, Tailwind, Zod, Swarm ID and Arkiv SDK.

Do not add a database.

## Login

The first useful action should be:

```text
Enter with Swarm ID
```

After login show role chooser.

Persist:

```text
apiperitivo:role:<identity-id>
```

Values:

```text
client
provider
```

Always allow role switching.

## Marketplace

Query Arkiv for:

```text
app = apiperitivo
entityType = service
available = true
```

Do not hard-code final services.

Build beautiful responsive cards.

Required:
- search;
- category filter;
- loading skeleton;
- empty state.

Card:
- category
- name
- description
- provider
- Arkiv badge
- Swarm badge
- View Service

## Service detail

Read Arkiv entity.

Take `manifestRef`.

Download manifest from Swarm.

Validate it.

Render operations in human-readable form.

Also provide raw manifest inspector.

## Provider dashboard

Query Arkiv by current `providerId`.

Show provider's services.

CTA:

```text
+ Publish Service
```

## New service form

Fields:

```text
name
description
category
```

Operations builder:

```text
operationId

input fields:
field name
type: string | number | boolean
```

Support multiple operations.

Generate this reduced manifest:

```json
{
  "v": 1,
  "operations": {
    "getQuote": {
      "input": {
        "symbol": "string"
      }
    }
  }
}
```

Show live preview.

## Publish action

On Publish:

1. validate form;
2. build manifest;
3. upload manifest to Swarm using Swarm ID adapter;
4. receive reference;
5. POST Arkiv service data to server route;
6. server publishes entity;
7. show success state;
8. route to provider dashboard or service detail;
9. invalidate/refetch marketplace.

Arkiv entity:

```json
{
  "attributes": {
    "app": "apiperitivo",
    "entityType": "service",
    "serviceId": "<slug-random>",
    "category": "<category>",
    "providerId": "<swarm identity id>",
    "providerName": "<display name>",
    "available": true,
    "version": 1,
    "manifestRef": "<swarm ref>"
  },
  "payload": {
    "name": "<name>",
    "description": "<description>"
  },
  "contentType": "application/json"
}
```

Keep the service long-lived.

Do not add TTL to service entities in Phase 1.

## Swarm ID behavior

Use Swarm ID as app identity.

If authenticated but:

```text
canUpload = false
```

the user can still browse marketplace, inspect service and use provider dashboard.

But publishing must show:

```text
Publishing requires Swarm upload capability for this identity.
```

Do not block login.

## Arkiv writer

Use server-only Arkiv writer configuration.

Never put Arkiv private key in browser code.

Implement:

```text
POST /api/services
```

Validate input with Zod.

Document that Phase 1 trusts the current frontend Swarm identity metadata as a hackathon boundary.

## UI direction

Make it feel like a real service marketplace.

Aim for:
- warm dark / premium devtool aesthetic;
- crisp typography;
- service cards with depth;
- colorful but restrained category badges;
- prominent search;
- strong empty states;
- polished provider publish flow.

Do not make it look like a blockchain explorer, raw JSON dashboard or admin CRUD panel.

## Files to produce/update

At minimum:

```text
README.md
CLAUDE.md
AGENTS.md
.env.example

apps/web
packages/shared
packages/swarm
packages/arkiv
```

Also document:

```text
bun install
bun dev
bun build
```

and environment variables.

## Work order

1. Scaffold monorepo.
2. Swarm ID session + role selection.
3. Static marketplace UI.
4. Shared schemas.
5. Arkiv read adapter.
6. Real marketplace data.
7. Swarm manifest download.
8. Provider form.
9. Swarm manifest upload.
10. Arkiv server publish.
11. Provider own-services query.
12. Polish and build verification.

Do not wait for confirmation after the plan.

First give me a concise implementation plan, then start implementing immediately.
