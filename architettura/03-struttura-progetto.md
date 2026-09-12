# Struttura proposta del progetto

Monorepo pnpm con TypeScript condiviso. Questo albero descrive i file da creare durante l’implementazione; in questa fase sono presenti solo i documenti.

```text
APIperitivo/
├── README.md                         # Avvio, demo, integrazioni e prove
├── APIPERITIVO_ANALISI.md               # Analisi dei bounty e fonti
├── architettura/                      # Documentazione di questa cartella
├── arkiv/
│   └── schema.md                     # Schema effettivo per la submission
├── friction.md                       # Feedback realmente raccolto su Arkiv
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
├── .env.example                      # Nomi e valori pubblici; nessun segreto
├── .gitignore
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── app/                  # Router, bootstrap e provider UI
│   │       ├── features/
│   │       │   ├── identity/         # Swarm ID e sessione gateway
│   │       │   ├── catalog/          # Servizi, filtri, piani e termini
│   │       │   ├── checkout/         # Preparazione, approvazione token e acquisto
│   │       │   ├── passes/           # Stato, countdown e rinnovo
│   │       │   ├── playground/       # Invocazione di operazioni API
│   │       │   └── vault/            # Upload/download ricevute e risultati
│   │       ├── components/
│   │       └── lib/                  # Client API e config pubblica
│   └── gateway/
│       ├── package.json
│       └── src/
│           ├── server.ts
│           ├── config/              # Validazione configurazione server
│           ├── routes/              # auth, catalog, purchases, passes, invoke
│           ├── middleware/          # Sessione, scope, limiti input e rate limit
│           ├── services/            # Casi d’uso applicativi
│           ├── workers/             # Activation e ripresa dei job
│           ├── repositories/        # Interfacce dello storage operativo
│           ├── db/
│           │   ├── migrations/
│           │   └── sqlite.ts
│           └── observability/       # Log redatti, requestId, metriche
├── packages/
│   ├── domain/src/                  # Tipi, schemi dati, errori e stati
│   ├── auth/src/                    # Challenge e verifica chiave applicativa
│   ├── arkiv/src/                   # Query, creazione pass, verifica issuer
│   ├── avalanche/src/               # ABI, rete, eventi, verifica acquisti
│   ├── swarm/src/
│   │   ├── browser/                 # Swarm ID e vault dell’utente
│   │   └── shared/                  # Formato manifest/ricevute e integrità
│   ├── provider-adapters/src/       # Adapter con input/output validati
│   └── client/src/                  # Client API per web e script agenti
├── contracts/
│   ├── foundry.toml
│   ├── src/AccessMarket.sol
│   ├── test/AccessMarket.t.sol
│   └── script/Deploy.s.sol
├── scripts/
│   ├── publish-service.ts           # Manifest Swarm, piano Fuji, listing Arkiv
│   ├── verify-purchase.ts
│   └── demo-agent.ts                # Consumo di un pass autorizzato
├── tests/
│   ├── integration/                 # Worker, auth, gateway e provider
│   ├── e2e/                         # Acquisto → uso → scadenza
│   └── fixtures/                    # Payload sintetici e manifest di test
├── deployments/
│   └── fuji.json                    # Indirizzi pubblici e blocco di deployment
├── evidence/                        # Tx, entity key, query e prove riproducibili
└── var/                             # Ignorata da Git: DB e stato operativo
```

## Regole di dipendenza

- `domain` è indipendente da UI, database e SDK di rete.
- `client` conosce il contratto HTTP e `domain`; non contiene chiavi del provider.
- `web` importa solo moduli compatibili con il browser. I package server non devono entrare nel bundle.
- `gateway` coordina i casi d’uso e usa adapter di rete e repository tramite interfacce.
- `provider-adapters` risolve esclusivamente provider e operazioni registrati; nessun URL upstream arbitrario fornito dal consumer.
- I package non dipendono dalle applicazioni. Gli adapter non dipendono direttamente dalla UI.
- L’ABI pubblicata in `avalanche` viene generata dall’artefatto del contratto; niente copie modificate a mano.

## Configurazione

Config pubblica: origine API, chain ID Fuji, indirizzo mercato e token, origine Swarm ID, URL gateway di storage previsto. Config server: RPC Arkiv/Fuji, eventuali access key, chiave issuer, credenziali provider e percorso del database.

Non usare prefissi frontend per variabili segrete. `.env`, chiavi, database e payload privati non entrano nel repository. `deployments/fuji.json` e le prove pubbliche contengono solo riferimenti verificabili e dati dimostrativi.
