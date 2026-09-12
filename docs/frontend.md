# Frontend e demo locale

## Avvio e percorso

```sh
pnpm install --frozen-lockfile
pnpm demo
```

Apri `http://localhost:3002`. Il server resta in ascolto solo sul loopback. La demo ignora `.env`, usa `var/demo.sqlite` e non contatta Fuji, Arkiv, Bee o Swarm ID. Non è abilitabile con `NODE_ENV=production`. Le chiavi dimostrative servono esclusivamente a firmare dati locali e non devono essere finanziate.

1. **Sign in**: è l’unica schermata accessibile senza una sessione. Inserisci un nome facoltativo e scegli **Enter the demo**. Il browser genera una chiave Ed25519 locale e risponde alla challenge del gateway. Il cookie di sessione è HttpOnly e SameSite Strict.
2. **Explore APIs**: dopo il login, catalogo effettivo del backend, ricerca per nome, filtro per categoria, prezzo, durata e limiti prima dell’acquisto. All’avvio vengono inseriti due esempi firmati, senza duplicarli ai riavvii. Anche le richieste HTTP dirette a catalogo, dettagli e schemi richiedono autenticazione.
3. **Try this API**: prepara un intento, registra il pagamento simulato, conferma e attiva il pass attraverso lo stesso servizio acquisti e worker usati in testnet.
4. **My passes**: esegui `text.analyze` oppure `json.transform`, visualizza/esporta la risposta, genera o revoca una credenziale temporanea per chiamare l’API dal codice. Il contatore è indicativo: il controllo del gateway decide ogni ammissione.
5. Alla scadenza le nuove chiamate vengono respinte. Le richieste ammesse prima della scadenza possono terminare. Quando non rimangono richieste in corso, **Download receipt** esporta la ricevuta finale firmata.
6. **Create an offer**: scegli una delle due operazioni già implementate, nome, descrizione, categoria, prezzo, durata, limiti e condizioni. Pubblica e ritrova l’offerta nel catalogo. Il prezzo riguarda l’intera finestra; non introduce addebiti a consumo.

**Text Spritz** conta caratteri, parole, parole uniche, frequenze e tempo di lettura. **JSON Tonic** seleziona campi da record JSON. Entrambi gli esempi iniziali costano 0,1 USDC dimostrativi per circa 60 secondi, con 60 richieste/minuto e 2 richieste concorrenti. Non sono integrazioni con API premium esterne. Una nuova operazione richiede schema e provider adapter nel gateway: il form non accetta URL arbitrari.

`pnpm web:build && pnpm demo:built` prova il bundle compilato. `DEMO_PORT=3003 pnpm demo` cambia la porta; `DEMO_DATABASE_PATH=var/altra-demo.sqlite pnpm demo` usa uno stato separato. La URL deve usare `localhost`, come `APP_ORIGIN`, perché le mutazioni richiedono la stessa origine.

## Dati persistenti e scadenze

| Dato | Demo locale | Testnet configurata |
| --- | --- | --- |
| Identità | Seed per scheda in sessionStorage | Secret applicativo derivato da Swarm ID |
| Manifest firmato | Archivio locale con reference BMT | Bee/Swarm, firma e reference verificate |
| Piano e pagamento | Registro locale simulato | AccessMarket e USDC su Avalanche Fuji |
| Catalogo | Listing locale con scadenza | Listing Arkiv di 7 giorni |
| Pass | Blocchi locali da 2 secondi | Entitlement Arkiv con TTL |
| Sessioni e recovery | SQLite `var/demo.sqlite` | SQLite configurato in `.env` |
| Ricevuta | JSON firmato scaricabile | JSON scaricabile e archivio privato Swarm |

La scadenza del **pass** chiude l’accesso; non cancella il manifest. La scadenza del **catalogo** rimuove la reperibilità in Arkiv. La reference resta nel piano e nei record della pubblicazione. Questa versione mantiene il flusso originale: non aggiunge Swarm Feed o rinnovi automatici dei listing.

I pass locali persistono al riavvio. L’identità di demo resta nella scheda del browser: chiudendola o cancellandone lo storage si può perdere il modo di accedere a quella stessa identità. Non usare la demo come archivio personale. Su testnet l’identità è recuperabile tramite Swarm ID.

## Passaggio alle reti degli sponsor

Occorrente da configurare in `.env` (non inviare chiavi in chat):

| Risorsa | Configurazione |
| --- | --- |
| Wallet dedicato ai test, con test AVAX e test USDC su Fuji | `FUJI_PRIVATE_KEY` per il deploy; wallet del browser per gli acquisti. `MARKET_ADDRESS` viene prodotto dal deploy. [Istruzioni ufficiali Fuji](https://build.avax.network/academy/blockchain/x402-payment-infrastructure/04-x402-on-avalanche/02-network-setup). |
| Wallet issuer con test GLM su Arkiv Tiramisu | `ARKIV_PRIVATE_KEY`, `ARKIV_ISSUER_ADDRESS`. Può essere lo stesso wallet dedicato ai test, finanziato su entrambe le reti. [Rete e faucet Arkiv](https://docs.arkiv.network/networks/tiramisu/). |
| Nodo Bee raggiungibile e batch di storage attivo | `SWARM_BEE_URL`, `SWARM_POSTAGE_BATCH_ID`. Un gateway di sola lettura non basta. [Upload Swarm](https://docs.ethswarm.org/docs/develop/upload-and-download/). |
| Account Swarm ID, con upload abilitato per l’archivio | Collegamento dal browser; `SWARM_ID_URL` è già configurato. |
| Indirizzo che riceve la quota della piattaforma | `TREASURY_ADDRESS`; il provider riceve la propria quota sull’indirizzo firmatario. |

`PROVIDER_PRIVATE_KEY` serve per pubblicare gli esempi tramite CLI; nello studio firma il wallet del browser. `RECEIPT_PRIVATE_KEY` è una chiave separata generabile localmente, senza fondi, per le ricevute. Le URL RPC sono già presenti nel template. Per provare le integrazioni si può restare su localhost; per esporre l’app online servono hosting Node.js con disco persistente e `APP_ORIGIN` HTTPS.

Segui [backend.md](backend.md) per wallet, deploy e variabili `.env`. `pnpm start` espone la UI su `http://localhost:3001`, nella modalità **Testnet edition**.

- Il login usa il popup di Swarm ID. Le firme dell’identità non vengono sostituite da un semplice indirizzo wallet.
- Il checkout richiede un wallet Ethereum compatibile EIP-1193 e la rete Avalanche Fuji. Chiede l’approve dell’importo esatto e poi l’acquisto, verificando l’account prima di ogni transazione.
- La pubblicazione frontend è riservata al wallet proprietario di AccessMarket, in accordo con `registerPlan`. Un altro provider può esportare un draft firmato da passare all’operatore; il contratto corrente non offre registrazione pubblica permissionless.
- Il provider firma il manifest pubblico e una distinta autorizzazione legata al subject della sessione. Una firma copiata da un manifest pubblico non permette di rivendicarne la pubblicazione da un’altra sessione. Solo il manifest firmato va su Swarm.
- Il gateway carica il manifest su Bee, il wallet registra il piano su Fuji e il gateway pubblica il listing su Arkiv. I termini sono confrontati prima della pubblicazione.
- L’archivio delle ricevute cifra il documento con AES-GCM usando un secret derivato da Swarm ID. Dopo upload, reference, bytes e decifratura sono verificati. La UI scarica un backup della reference e conserva un indice locale. **Back up all references** esporta l’indice; **Open saved receipt** recupera una reference anche dopo la perdita dell’indice del browser.

Servono test AVAX, test USDC, fondi per l’issuer Arkiv e un batch Swarm valido. Nessuna scrittura reale è stata eseguita durante la preparazione di questa demo. L’accesso e la disponibilità dello storage testnet devono essere verificati quando tali risorse saranno configurate.

## Recupero senza un secondo pagamento

L’intento è salvato prima di richiedere il pagamento. Il browser salva l’hash appena il wallet lo restituisce. Un errore di conferma lascia **Resume purchase** in My passes: riutilizza quell’intento e quell’hash.

Se il browser viene interrotto durante la richiesta al wallet e l’hash non è ancora disponibile, l’app chiede di recuperarlo dalla cronologia del wallet. Non invia automaticamente una seconda purchase. Usa **Discard unsent purchase** solo quando il wallet conferma che non è stata trasmessa una transazione; viene esportato un record di recupero. Non cancellare il localStorage mentre una transazione è in corso.

Le offerte vengono registrate nel journal SQLite prima dell’upload. In caso di errore, **Finish publishing** riprende lo stesso piano; il gateway può ricaricare il manifest già firmato. Il browser conserva anche l’eventuale hash della registrazione Fuji. Il worker riconcilia gli esatti bytes firmati delle pubblicazioni Arkiv prima di usare un altro nonce. Una transazione ambigua blocca le successive scritture dell’issuer fino alla riconciliazione: non genera una nuova entità alla cieca.

## Nuove API HTTP

Tutte le mutazioni con cookie richiedono l’header Origin configurato. Catalogo, schemi, dettagli e workspace richiedono una sessione. La sola invocazione può usare una credenziale bearer valida al posto del cookie. Senza sessione `/api/config` restituisce soltanto il bootstrap del login, senza indirizzi di contratto, provider o issuer.

| Route | Uso |
| --- | --- |
| `GET /api/auth/session` | Ripristina lo stato del login |
| `GET /api/config` | Modalità e capacità configurate; nessuna chiave privata |
| `GET /api/offers` | Pubblicazioni della propria identità |
| `POST /api/offers` | `{ manifest, signature, authorization }`, firma manifest e autorizzazione del subject |
| `POST /api/offers/:planId/prepare` | Riprende l’upload della propria offerta |
| `POST /api/offers/:planId/publish` | Verifica piano/manifest e pubblica il listing |
| `POST /api/demo/pay` | Solo demo: pagamento idempotente dell’intento della sessione |
| `POST /api/demo/register` | Solo demo: registra il proprio piano preparato |

Le API esistenti di pass, credenziali, invoke e ricevute sono descritte in [backend.md](backend.md). Nessuna risposta HTTP include transazioni Arkiv raw firmate.
