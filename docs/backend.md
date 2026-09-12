# Backend APIritivo

Il flow segue il TXT iniziale: identità → discovery Arkiv → manifest Swarm → pagamento Fuji → pass Arkiv → gateway → scadenza → ricevuta Swarm. La modifica concordata elimina il billing e il limite totale per chiamata. Frequenza, concorrenza, dimensione e timeout proteggono il servizio.

## 1. Ambiente

Nella cartella `APIperitivo`, eseguire `pnpm install --frozen-lockfile` e `pnpm env:init`. Quest’ultimo crea `.env` senza sovrascriverlo se esiste.

| Variabile | Contenuto |
|---|---|
| `FUJI_RPC_URL` | RPC Avalanche Fuji, chain 43113 |
| `FUJI_PRIVATE_KEY` | Wallet operatore finanziato con AVAX di test; usato dagli script, mai richiesto al cliente |
| `MARKET_ADDRESS` | Contratto AccessMarket dopo il deploy |
| `ARKIV_RPC_URL` | RPC Tiramisu, chain 7738577 |
| `ARKIV_PRIVATE_KEY` | Issuer finanziato con GLM di test |
| `ARKIV_ISSUER_ADDRESS` | Indirizzo pubblico dell’issuer; derivato dalla chiave se omesso |
| `SWARM_BEE_URL` | Root API Bee con `/bytes`; default locale `http://localhost:1633` |
| `SWARM_POSTAGE_BATCH_ID` | Batch di upload, 64 caratteri hex senza `0x`; non è il riferimento di un file |
| `PROVIDER_PRIVATE_KEY` | Firma il manifest come provider; può coincidere con l’operatore nella demo |
| `TREASURY_ADDRESS` | Destinatario della fee di piattaforma |
| `RECEIPT_PRIVATE_KEY` | Chiave issuer per firmare le ricevute finali |
| `APP_ORIGIN` | Origine esatta del browser, default `http://localhost:3001` |
| `DATABASE_PATH` | SQLite operativo, default `var/apiperitivo.sqlite` |

`pnpm check:networks` verifica chain ID, head, query SDK Arkiv, raggiungibilità Swarm ID e Bee. Un RPC raggiungibile non significa wallet finanziato. Swarm ID richiede una sessione browser e capacità di upload (`connectionInfo.canUpload`); non equivale a un endpoint di scrittura pubblico gratuito.

Il backend non importa a runtime il bundle browser Swarm ID. Usa Bee per i manifest pubblici e mette a disposizione helper browser dedicati per login e ricevute private.

## 2. Contratto e pubblicazione

```sh
pnpm build
pnpm test:contracts
pnpm deploy:fuji
# Impostare MARKET_ADDRESS in .env con l'indirizzo stampato.
pnpm services:publish
pnpm start
```

Il deploy usa esclusivamente Fuji e il test USDC Circle `0x5425890298aed601595a70AB815c96711a31Bc65`. Scrive la prova pubblica in `deployments/fuji.json`. Il buyer usa un proprio wallet per `approve` e `purchase`; la sua chiave privata non passa dal gateway.

La pubblicazione crea **Text Spritz** (`text.analyze`) e **JSON Tonic** (`json.transform`): 0,1 test USDC per 60 secondi nominali / 30 blocchi Arkiv, split 90/10. Si tratta di API effettive eseguite dal gateway. Provider esterni possono essere aggiunti con adapter a URL fisso e supporto ad `AbortSignal`.

Lo script firma il manifest, lo carica su Swarm, verifica byte e BMT, registra il piano immutabile su Fuji e pubblica il listing Arkiv per 7 giorni. La reference è trasferita automaticamente tra tutti i componenti.

Per un manifest JSON personalizzato:

```sh
pnpm services:publish percorso/manifest.json
```

Gli esempi in `examples/` contengono indirizzi dimostrativi: sostituirli con provider e treasury reali della demo. Una modifica ai termini richiede un **nuovo planId**.

Se hai **già una reference Swarm** di un documento `{ manifest, signature }` nel formato APIritivo:

```sh
pnpm services:publish --reference 0xREFERENCE_DI_64_CARATTERI_HEX
```

Questa modalità verifica il contenuto esistente e lo collega ad Arkiv/Fuji. Non richiede un nuovo batch né la chiave privata del provider. Il contenuto deve essere pubblico e firmato correttamente; un hash qualsiasi o un semplice JSON non firmato non è accettato.

Ferma il gateway prima della pubblicazione: entrambi condividono l’issuer e acquisiscono lo stesso lock. `var/publications/` conserva i journal per riprendere dopo errori senza inviare una nuova attivazione. Se il listing è scaduto dopo una pubblicazione già conclusa, crea una nuova versione del piano: lo script non prolunga implicitamente una precedente registrazione.

## 3. Identità e checkout HTTP

Nel browser creare `SwarmIdClient` con `iframeOrigin: 'https://swarm-id.snaha.net'`, eseguire `initialize()` e `connect()` secondo il relativo SDK, quindi usare `swarmIdentity(client)` da `packages/swarm/src/browser.ts`.

1. `POST /api/auth/challenge` con `{ "publicKey": "0x…" }`.
2. Firmare la challenge con `identity.signChallenge(challenge)`.
3. `POST /api/auth/verify` con `{ "challengeId": "…", "signature": "0x…" }`.
4. Il cookie HttpOnly identifica il subject. Per richieste browser usare `credentials: 'include'`.

L’algoritmo è Ed25519 sul seed applicativo di 32 byte ottenuto da `deriveAppSecret('apiperitivo-login-ed25519-v1')`; subject = keccak256(publicKey). La prova dimostra possesso della chiave applicativa, **non un’attestazione server dell’origine Swarm ID della chiave**. Il browser fornisce il percorso Swarm ID; nessuno può spendere pass legati alla chiave di un altro utente.

Tutte le mutazioni con cookie richiedono l’header `Origin` uguale ad `APP_ORIGIN`. In produzione usare HTTPS e `NODE_ENV=production` per i cookie Secure. Il frontend futuro deve passare dal medesimo origin (oppure da un reverse proxy); non è configurato CORS permissivo.

5. `GET /api/services?category=text&maxPriceAtomic=100000` interroga Arkiv.
6. `GET /api/plans/:planId` verifica manifest e termini on-chain.
7. `POST /api/purchases/prepare` con `{ "planId": "0x…", "payer": "0x…" }` restituisce calldata `approve` e `purchase`.
8. Il wallet invia le due transazioni su Fuji; poi `POST /api/purchases/confirm` con `{ "purchaseIntentId": "0x…", "txHash": "0x…" }`.
9. Il gateway verifica evento del mercato, subject, pagatore, importo, split, blocco canonico e conferme. Risponde `202`.
10. Il worker attiva su Arkiv; `GET /api/purchases/:purchaseId` e `GET /api/passes` mostrano lo stato.

Conservare intenzione e hash pagamento se `confirm` fallisce temporaneamente e ripetere la stessa conferma. **Non effettuare un nuovo pagamento per risolvere un errore RPC.**

## 4. Utilizzo e ricevuta

```http
POST /api/passes/0xPURCHASE_ID/invoke/text.analyze
Content-Type: application/json
Origin: http://localhost:3001
Cookie: apiperitivo_session=…

{"text":"Un aperitivo per le API"}
```

`GET /api/operations` espone gli schemi input/output. I JSON Schema sono anche in `packages/domain/schemas/`, rigenerabili con `pnpm schemas:export`.

Ogni invocazione valida scope/input, legge il pass corrente da Arkiv, verifica creator/owner/payload/attributi/expiry e riserva atomicamente il limite di concorrenza. Nessun positive cache. Nessuna coda di esecuzione. Una richiesta ammessa può finire dopo il TTL entro il proprio timeout.

| Risposta | Significato |
|---|---|
| 401 `AUTH_REQUIRED` | Sessione/credenziale mancante o scaduta |
| 403 `ACCESS_NOT_ACTIVE` | Pass non ancora attivo o rimosso prima dell’expiry |
| 403 `ACCESS_EXPIRED` | Pass assente al blocco di scadenza o successivo |
| 403 `OPERATION_NOT_ALLOWED` | Scope non autorizzato |
| 429 `RATE_LIMITED` | Frequenza/concorrenza; non è una quota commerciale |
| 503 `ACCESS_CHECK_UNAVAILABLE` | Arkiv indisponibile, nessuna esecuzione |
| 504 `PROVIDER_TIMEOUT` | Tempo massimo dell’operazione superato |

`POST /api/passes/:purchaseId/credentials` con `{ "operations": ["text.analyze"], "ttlSeconds": 300 }` emette un bearer per quel solo pass. Il database salva solo l’hash. Il bearer non può acquistare, delegare o leggere ricevute. Dopo revoca (`DELETE /api/credentials/:id`) o expiry Arkiv non concede accesso.

Per `scripts/demo-agent.ts`, impostare `AGENT_TOKEN` e `PURCHASE_ID` nell’ambiente, poi eseguire `pnpm demo:agent`. Il token viene stampato soltanto nella risposta iniziale di emissione, non nei log del server.

A pass scaduto, `POST /api/purchases/:purchaseId/receipt` chiude atomicamente le nuove ammissioni, attende che non ci siano richieste in corso e restituisce la ricevuta finale firmata. Nessun payload degli utenti compare nella telemetria. Il riepilogo è idempotente.

- **Archivio privato:** `savePrivateReceipt(client, signedReceipt)` cifra AES-GCM nel browser, carica con Swarm ID, verifica BMT/readback/decrittazione e restituisce `{ reference, visibility: 'private', verifiedBy: 'browser' }`. Conservare l’entry nel vault utente. Non inviarla a `receipt-reference`.
- **Ricevuta pubblica per demo:** caricare il JSON firmato in chiaro e inviare `{ "reference": "0x…" }` a `POST /api/purchases/:purchaseId/receipt-reference`. Il server verifica la reference e l’uguaglianza del contenuto. L’endpoint è riservato a questo caso.

La disponibilità Swarm dipende dal postage e dalla conservazione dei dati; la parola “permanente” del flow iniziale non è una garanzia di storage infinito.

## Persistenza e limiti dell’MVP

SQLite conserva acquisti, deduplica, raw transaction già firmate, pass, sessioni, credenziali e utilizzi; Arkiv resta l’autorità per l’accesso corrente. Preservare il volume `var/` attraverso i restart. La perdita del database non è una procedura di reset supportata.

Un unico processo gateway/issuer per volume è imposto con lock SQLite separato. Nessun altro processo o wallet deve inviare transazioni con la chiave issuer mentre il worker opera. Un broadcast incerto viene ripreso con **gli stessi byte e hash**; finché non è risolto blocca nuove firme. Un revert definitivo porta a `manual_review`, senza nuova emissione automatica o rimborso. Il pagamento Fuji e la scrittura Arkiv sono asincroni, non atomici.

Il catalogo restituisce al massimo 100 listing per query. Paginazione UI, vault persistente nel browser, ricevute intermedie di pagamento/attivazione e demo completa su testnet restano step successivi. Gli output API non sono automaticamente archiviati.
