# APIritivo

Marketplace per acquistare accesso temporaneo a API premium: un pagamento, una finestra di utilizzo, nessun addebito per singola chiamata.

Avalanche Fuji regola il pagamento in test USDC, Arkiv conserva il pass con scadenza nativa e Swarm ospita manifest, ricevute e risultati archiviati dall’utente. Swarm ID gestisce l’identità e l’accesso allo storage personale.

## Stato del progetto

Frontend marketplace disponibile: catalogo con ricerca e filtri, login, acquisto e attivazione dei pass, playground API, scadenza, ricevute e studio per creare offerte. React/Vite e gateway Fastify condividono la stessa origine. Grafica leggera, responsive, in inglese per la demo ETHRome.

`pnpm start` usa gli adapter reali. `pnpm demo` avvia una demo locale separata, con pagamenti, Arkiv e Swarm simulati e dichiarati nella UI; le operazioni API vengono eseguite realmente dal gateway. Per pubblicare e attivare pass sulle reti degli sponsor servono wallet testnet finanziati e un nodo/gateway Bee con batch disponibile.

## Prova subito la demo

Servono Node.js 24+ e pnpm 10.8.1; nessun wallet, chiave o token.

```sh
pnpm install --frozen-lockfile
pnpm demo
```

Apri **http://localhost:3002**. Entra con **Sign in → Enter the demo**, scegli **Text Spritz** o **JSON Tonic** e premi **Try this API**. In **My passes** esegui richieste vere; dopo 60 secondi l’accesso viene bloccato e puoi scaricare la ricevuta firmata. Da **Create an offer** puoi pubblicare un nuovo piano per una delle operazioni implementate, anche da 30 secondi.

La demo non legge `.env` e usa `var/demo.sqlite`, separato dallo stato testnet. L’identità locale rimane nella scheda del browser; sessioni, piani, manifest e pass persistono ai riavvii del server. Per un’identità portabile si usa Swarm ID in modalità testnet. Dettagli e procedure di recupero nella [guida frontend](docs/frontend.md).

Per provare il bundle compilato: `pnpm web:build && pnpm demo:built`. Puoi cambiare porta con `DEMO_PORT=3003 pnpm demo`; apri sempre l’URL `localhost` indicato nel terminale.

## Avvio con integrazioni testnet

Node.js 24+, pnpm 10.8.1 e Foundry.

```sh
pnpm install --frozen-lockfile
pnpm env:init
pnpm start
```

Frontend e gateway rispondono su `http://localhost:3001`; il controllo di stato è `/health`. Senza configurazione, le integrazioni mancanti restituiscono `503`; questo avvio non crea offerte simulate. `pnpm dev` abilita il riavvio automatico del gateway. In produzione esegui prima `pnpm build` e configura un’origine HTTPS: il server serve il frontend compilato.

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
├── apps/web/               # Catalogo, login, pass, playground e studio React
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

Il nome pubblico è **APIritivo**; il namespace tecnico è `apiperitivo`.
