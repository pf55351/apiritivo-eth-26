# APIperitivo

Marketplace per acquistare accesso temporaneo a API premium: un pagamento, una finestra di utilizzo, nessun addebito per singola chiamata.

Avalanche Fuji regola il pagamento in test USDC, Arkiv conserva il pass con scadenza nativa e Swarm ospita manifest, ricevute e risultati archiviati dall’utente. Swarm ID gestisce l’identità e l’accesso allo storage personale.

## Stato del progetto

Prima implementazione backend disponibile: schemi Zod/JSON Schema, `AccessMarket.sol`, gateway Fastify, SQLite, autenticazione con chiave derivata da Swarm ID, adapter Fuji/Arkiv/Bee, worker recuperabile e ricevute firmate. Il frontend marketplace è lo step successivo.

Il server usa integrazioni reali. I test usano adapter simulati dichiarati e una blockchain Anvil isolata; non rappresentano scritture sulle reti degli sponsor. Per pubblicare e attivare pass reali servono wallet testnet finanziati e un nodo/gateway Bee con batch disponibile.

## Avvio backend

Node.js 24+, pnpm 10.8.1 e Foundry.

```sh
pnpm install --frozen-lockfile
pnpm env:init
pnpm start
```

Il gateway risponde su `http://localhost:3001/health`. Senza configurazione, segnala le integrazioni mancanti con `503`; non crea dati fittizi. `pnpm dev` abilita il riavvio automatico.

La configurazione è in `.env`, nella cartella del progetto. `SWARM_POSTAGE_BATCH_ID` è la credenziale del batch per gli upload. La **reference del contenuto** è invece `manifestRef`: viene generata dall’upload e inserita automaticamente nel piano Fuji e nel listing Arkiv.

```sh
pnpm build
pnpm test
pnpm test:contracts
pnpm test:evm
pnpm check:networks
```

`test:evm` avvia e chiude un’istanza Anvil locale; `check:networks` effettua solo letture reali. Vedi [guida backend](docs/backend.md) per deploy, pubblicazione e API, e [prove eseguite](evidence/backend-validation.md).

## Da dove iniziare

- [Analisi del progetto e dei bounty ETHRome](APIPERITIVO_ANALISI.md)
- [Indice dell’architettura](architettura/README.md)
- [Struttura proposta del codice](architettura/03-struttura-progetto.md)
- [Piano di implementazione e prove per la demo](architettura/08-piano-mvp-e-bounty.md)

## Struttura implementata

```text
APIperitivo/
├── apps/gateway/src/       # HTTP, sessioni, acquisti, worker, SQLite
├── packages/
│   ├── domain/            # Schemi condivisi, tipi, identificativi
│   ├── auth/              # Challenge Ed25519 e subject
│   ├── avalanche/         # ABI generata e verifica pagamenti Fuji
│   ├── arkiv/             # Catalogo, TTL, provenienza, recupero tx
│   ├── swarm/             # Bee, firme, BMT e cifratura browser
│   └── provider-adapters/ # text.analyze e json.transform
├── contracts/             # AccessMarket e test Foundry
├── scripts/               # Deploy, pubblicazione, query reti, agente
├── tests/                 # Flussi gateway, recovery, crypto e adapter
├── examples/              # Manifest e listing di esempio (non pubblicati)
├── arkiv/                 # Schema effettivo e friction log
├── docs/                  # Guida operativa backend
├── evidence/              # Risultati delle verifiche, senza segreti
└── architettura/          # Specifica e roadmap del progetto completo
```

Il nome pubblico è **APIperitivo**; il namespace tecnico è `apiperitivo`.
