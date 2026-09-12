# AGENTS.md — APIperitivo Phase 1

Read in this order before coding:

1. `README.md`
2. `CLAUDE.md`
3. this file

## Goal

Ship a polished Phase 1:

```text
Swarm ID login
→ choose Client / Provider
→ Client queries Arkiv marketplace
→ Provider uploads reduced manifest to Swarm
→ Provider publishes service entity to Arkiv
```

No wallet. No payment. No smart contract.

## Non-negotiable architecture

### Swarm ID

Swarm ID is the application identity.

Use it for:
- login;
- identity id;
- display identity;
- provider ownership metadata;
- provider upload capability.

Do not treat role as part of Swarm ID.

Role is a local app preference keyed by identity id.

### Swarm

Swarm contains ONLY the technical manifest.

Target shape:

```json
{
  "v": 1,
  "operations": {
    "operationName": {
      "input": {
        "field": "string"
      }
    }
  }
}
```

Do not duplicate service name, description, category, provider or availability.

### Arkiv

Arkiv is the live queryable service registry.

Entity public attributes:

```text
app
entityType
serviceId
category
providerId
providerName
available
version
manifestRef
```

Payload:

```text
name
description
```

Service entities should be long-lived in Phase 1.

## Publish invariant

The order MUST be:

```text
build manifest
→ upload to Swarm
→ obtain manifestRef
→ create Arkiv entity
```

Never publish Arkiv first.

## Arkiv writer

For Phase 1 use an app-owned server-side writer.

Never expose Arkiv writer private key in browser code.

Create a thin server adapter.

## SDK rule

Do not invent Arkiv or Swarm ID SDK methods.

Before implementing an adapter:
- inspect installed package types;
- inspect README/docs available in repo;
- use exact API signatures.

## UI quality

The frontend must look like a product.

Marketplace cards are the primary experience.

Avoid raw tables, JSON everywhere, developer-console aesthetic and huge forms.

JSON is allowed only in inspectors/advanced preview.

## Role UX

After login show:

```text
I'm a Client
I'm a Provider
```

Persist choice locally.

Always allow switching.

Role is navigation preference, not access control.

## No extra scope

Do not add chain code, payments, wallets, access passes or API gateway.

## Quality gate

Before finishing:

```text
bun lint
bun typecheck
bun test
bun build
```

Manually verify login, role selection, publish, marketplace refresh, service detail and manifest download.
