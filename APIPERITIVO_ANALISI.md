# APIritivo — analisi e proposta di implementazione

Verifica delle fonti: 12 settembre 2026, Europe/Rome. Base: documento di flow fornito dall’utente. La cartella di progetto era vuota: questa è un’analisi di progetto, non una verifica di codice o integrazioni già funzionanti. Le scelte tecniche sotto sono proposte; nessun deploy, upload o test di rete applicativo è stato eseguito.

Scope aggiornato dopo il confronto con l’utente: marketplace di API premium acquistabili a tempo, senza billing per chiamata. Le specifiche operative e la struttura del progetto sono in [architettura/README.md](architettura/README.md).

## Decisione proposta

Implementare un marketplace con 2–3 servizi API acquistabili a tempo. Il cliente paga una volta in test USDC, invoca le operazioni del piano durante la validità del pass e può conservare ricevute e risultati consentiti nel proprio archivio Swarm. Lo stesso gateway potrà essere usato da uno script agente autorizzato dall’utente. Il primo percorso completo usa un solo provider; gli altri vengono aggiunti tramite adapter. OCR è una capability possibile, non il focus del prodotto.

Priorità bounty: **Arkiv Mission 02 + Best Use**, **Swarm**, **Team1 Track A**. Mission 03 è un’estensione subordinata a un test WebSocket reale. Mission 01 non è coerente con questo progetto nuovo: non esiste una precedente pipeline da migrare.

La proposta di valore da rendere evidente è: **l’accesso al servizio scade; il lavoro ottenuto resta sotto il controllo dell’utente**. Si vende una finestra di utilizzo con budget noto, utile per un task occasionale e per un agente con budget limitato.

## Premi, vincoli e differenze tra le fonti

L’[hub Arkiv per ETHRome](https://hub.arkiv.network/ethrome) indica EUR 500 per ciascuna missione e EUR 1.000 per Best Use, con un solo premio per team. Il suo scoring è: motivazione dell’uso di Arkiv 30%, esecuzione 25%, utilità/adozione 20%, feedback 25%. Include un [form Arkiv dedicato](https://tally.so/r/vGZ98v).

Il [manuale ETHRome](https://www.ethrome.org/hackermanual/prizes.html) riporta invece Arkiv in USD/USDC e pesi 30/20/20/20/10 per query, riproducibilità, fit, friction e craft. Richiede: repo pubblico, `/arkiv/schema.md`, `friction.md`, missioni dichiarate e colloquio di dieci minuti entro sabato 20:00. Conservare questi requisiti; far chiarire valuta e griglia al team.

Sempre dal manuale: Swarm assegna due premi da $500; richiede repo, README, demo e prossimo sviluppo. Contano utilità, upload/download reali e ragione d’uso; Swarm ID è raccomandato, facoltativo. Per Mission 02 mostrare la stessa query prima/dopo senza delete; Mission 03 richiede WebSocket senza start block e prova di riconnessione. Non sommare i premi Arkiv.

Per [Team1](https://academy.avax.network/events/73a939b1-6d35-4847-9388-320024638249), scegliere Track A: $400 al primo, $200 al secondo. Serve un flusso stablecoin verificabile su Fuji, repo pubblico con istruzioni, demo e prove Avalanche. Valutazione: utilità 35%, demo completa 30%, integrazione 20%, UX 15%. Un solo track per progetto; il portale richiede anche slide e submission propria. Track B richiederebbe un diverso focus su asset tokenizzati e relative regole.

### Scadenze operative

- **Sabato 12 settembre, entro 20:00:** colloquio Arkiv e consegna URL repo, come da manuale. Interlocutori indicati: Santiago e Shantelle.
- **Domenica 13 settembre, entro 10:00:** submission ETHRome; selezionare Arkiv, Swarm e Team1. Repo aperto per quattro settimane, video massimo tre minuti, indirizzi dei contratti e contatto team. Il link al form risulta ancora TBD nella [pagina submission](https://www.ethrome.org/hackermanual/submissions.html): recuperarlo dagli organizzatori/Telegram.
- **Arkiv:** compilare anche il form collegato dall’hub. Preparare tutto per le 10:00; non assumere proroghe.
- **Team1:** il portale indica le 16:00 del 13 settembre, ma ciò non sposta la deadline ETHRome delle 10:00. Completare entrambe le submission prima delle 10:00 elimina l’ambiguità.
- Preparare demo in presenza e riferimenti consultabili dai giudici.

Il contenuto web presenta differenze e placeholder: le conferme organizzative restano da ottenere. Non sono stati contattati sponsor né inviati form.

## Perché ogni componente serve

| Componente | Responsabilità proposta | Evidenza nella demo |
|---|---|---|
| Swarm ID | Identità dell’utente e accesso al suo storage | Login effettivo, disponibilità upload verificata |
| Swarm | Manifest versionato, risultati scelti dall’utente, ricevute firmate | Upload e recupero dagli hash, anche a pass scaduto |
| Avalanche Fuji | Acquisto, prezzo e split provider/treasury | Transazione, evento e trasferimenti test USDC |
| Arkiv | Catalogo interrogabile e pass con scadenza nativa | Filtro composto e scomparsa del pass dalle query |
| Gateway APIritivo | Autenticazione, controllo del pass, limiti tecnici, invocazione API | Risposta consentita/rifiutata dal server |
| Worker di attivazione | Verifica pagamento Fuji e scrittura Arkiv | Stato pending recuperabile e attivazione unica |

Il vantaggio Arkiv da sostenere non è che una scadenza sia impossibile in SQL: è avere un registro condiviso, firmato e interrogabile, dal quale più gateway autorizzati possano leggere gli stessi pass senza replicare un database privato. Nell’MVP issuer e gateway restano componenti fidati: chiamarlo protocollo interamente trustless sarebbe prematuro.

## Correzioni necessarie al flow

### 1. Il pagamento non crea il pass da solo

Fuji e Arkiv sono reti distinte. Serve un servizio che controlli la transazione e pubblichi l’entitlement. Non esiste atomicità automatica tra incasso e attivazione.

Proposta: `purchaseId` unico; verifica di chain, contratto, esito, evento e termini acquistati; registro persistente delle attivazioni. Il retry dello stesso acquisto restituisce lo stesso pass e non ricomincia la durata. Un doppio click deve riutilizzare la medesima intenzione di acquisto. Anche dopo la scadenza il pagamento non deve diventare riutilizzabile.

Mostrare `payment_pending → paid → activation_pending → active`. Se Arkiv non risponde dopo l’incasso, mostrare il pagamento ricevuto e riprovare l’attivazione. Non suggerire un secondo pagamento. Nell’MVP con split immediato non esiste un rimborso trustless automatico: escrow/refund sono eventuali sviluppi successivi.

### 2. Identità dichiarata e autenticazione sono cose diverse

Il gateway non può accettare `consumer=user_ABC` come prova di identità. Il wallet pagante può essere distinto dall’identità Swarm; l’acquisto deve legare esplicitamente il diritto al beneficiario corretto.

La [API Swarm ID](https://swarm.snaha.net/docs/api/) espone `deriveAppSecret(label)` e dati della chiave applicativa. Proposta da validare con uno spike: ricavare materiale per una chiave applicativa con separazione di dominio, firmare una challenge monouso del gateway e usare il digest della chiave pubblica come `subject`. Il gateway emette una sessione e controlla quel subject nelle richieste. Non assumere che il solo callback di login fornisca un token server già verificabile.

Il pagamento vincola `subject`, servizio e versione; non basta allegare dopo un qualsiasi hash di transazione. Non esportare chiavi Swarm o segreti principali allo script agente: se serve, emettere una credenziale delegata limitata al singolo pass.

### 3. Entitlement autentico, non semplicemente esistente

Chiunque può creare record con gli stessi attributi. La query deve controllare anche il creatore fidato e il proprietario previsto. La documentazione distingue attributi di sistema `$creator` e `$owner`: un campo applicativo chiamato `issuer` non è equivalente. [Query Arkiv](https://docs.arkiv.network/typescript-sdk/querying-data/)

Nell’MVP l’issuer mantiene la proprietà dei pass; non trasferirli al consumer, che potrebbe estenderli. Disabilitare estensioni permissionless. La logica dell’issuer non rinnova automaticamente un accesso acquistato a durata fissa. La fiducia nell’issuer va documentata.

### 4. La scadenza è in blocchi e non produce un evento

Arkiv risolve la durata in un blocco di scadenza; il tempo visualizzato è una stima. Una durata relativa parte dal blocco di creazione del pass. Usare il valore `expiresAt` effettivamente restituito. [Mutation ed expiry](https://docs.arkiv.network/typescript-sdk/mutating-data/)

Il gateway esegue una query nuova sullo stato corrente per ogni richiesta; una cache positiva o una vecchia pagina di query non deve mantenere aperto il pass. Distinguere pass assente da errore RPC: `403 ACCESS_EXPIRED` quando verificato, `503 ACCESS_CHECK_UNAVAILABLE` se non si riesce a controllare, senza inoltro al provider.

La scadenza non emette un evento; il relativo handler di delete riguarda una cancellazione esplicita. [Live Events](https://docs.arkiv.network/typescript-sdk/live-events/)

Per la demo usare 60–120 secondi nominali e dimostrare la stessa query prima/dopo il confine, senza transazione di cancellazione. Il countdown è indicativo; la prova è la lettura di Arkiv. Definire nei termini che la validità si controlla all’ammissione della richiesta: un’elaborazione già ammessa può terminare dopo la scadenza.

### 5. I limiti tecnici non determinano il prezzo

Nel modello concordato non esiste un pacchetto `maxRequests=100`: il cliente compra tempo. Le singole chiamate non generano pagamenti e non consumano un saldo commerciale di richieste.

Il piano dichiara frequenza massima, concorrenza, dimensione degli input e timeout. Il gateway applica questi limiti prima di inoltrare, con prenotazione atomica degli slot. Per più istanze servirebbe un coordinamento condiviso; l’MVP usa una singola istanza con stato operativo durevole.

Le statistiche di utilizzo servono a diagnostica e ricevute, non al billing. Evitare la promessa “illimitato” e mostrare le condizioni tecniche prima dell’acquisto. Arkiv rimane la fonte del diritto temporaneo.

### 6. Le ricevute vanno salvate prima di perdere lo stato operativo

Una query al pass ormai scaduto non restituisce il riepilogo delle richieste. Salvare subito una ricevuta d’acquisto firmata e registrare gli esiti durante l’uso. Generare il riepilogo finale dall’ultimo stato persistente alla prima richiesta successiva alla scadenza o quando l’utente apre la ricevuta. È finalizzazione su richiesta, da descrivere così.

Se in futuro si vuole una ricevuta finale automatica anche con tutti i client chiusi, serve un worker durevole. La promessa corretta è “nessun job necessario per revocare gli entitlement”; l’archiviazione può avere una propria orchestrazione.

Il content hash prova l’integrità dei byte, non chi li ha prodotti né la correttezza dell’output API. Firmare manifest e ricevute; il riepilogo d’uso è un’attestazione del gateway, mentre il pagamento è verificabile su Fuji.

### 7. Persistenza Swarm e privacy

“Receipt permanente” va sostituito con “ricevuta indipendente dalla durata del pass, conservata su Swarm”. Il finanziamento e la durata del postage batch condizionano la disponibilità dello storage. [Postage batches](https://docs.ethswarm.org/docs/develop/tools-and-features/buy-a-stamp-batch/)

Per rafforzare il prodotto, permettere di salvare risultati API consentiti nel vault dell’utente, con possibilità di ritrovarli da un indice/feed personale o da un export delle referenze. Il test significativo è recuperare un risultato a pass scaduto senza dipendere dal gateway di autorizzazione APIritivo. L’archiviazione non è automatica per ogni risposta: dipende dalla scelta dell’utente e dalle condizioni del servizio.

Non pubblicare documenti personali, chiavi API o segreti in Arkiv. Un commitment riduce l’esposizione diretta, ma non garantisce anonimato e può restare collegabile al pagamento. Cifrare i risultati prima dell’upload e tenere le chiavi sotto il controllo dell’utente. Se si usano referenze Swarm cifrate, la referenza completa può includere la chiave: non inserirla nel catalogo pubblico o in un explorer link. [Cifratura Swarm](https://docs.ethswarm.org/docs/develop/tools-and-features/store-with-encryption/)

La scadenza del pass limita nuove chiamate al servizio. Non revoca copie di risultati già scaricati. Inoltre la sparizione da Arkiv non va presentata come cancellazione confidenziale dei dati storici.

### 8. Il provider deve applicare davvero il controllo

Se il manifest pubblica un endpoint direttamente utilizzabile senza autenticazione, si aggira il gateway. Il provider deve accettare solo richieste autenticate dal gateway oppure validare il pass in proprio. Nell’MVP pubblicare la rotta del gateway e mantenere le credenziali del provider sul server.

## Modello dati proposto

Questa è la base progettuale del futuro `/arkiv/schema.md`, non uno schema già implementato.

**Service listing**, una entity per piano; attributi interrogabili: `app`, `entityType`, `serviceId`, `planId`, `category`, `paymentChainId`, `paymentToken`, `priceAtomic`, `durationSeconds`, `provider`, `available`, `manifestRef`. Numeri con tipi coerenti; prezzo in unità minime del token. Owner/creator verificati tramite metadati di sistema. Payload: dettagli brevi non usati nei filtri. Testi lunghi, termini, operazioni e limiti tecnici nel manifest Swarm.

Esempio di domanda utile: “API di dati disponibili, pagabili su Fuji con questo USDC, sotto 2 USDC e con almeno 30 minuti di accesso”. Il filtro su token e chain impedisce confronti numerici privi di senso. Usare offerte dimostrative con prezzi e durate diversi per rendere osservabile il risultato del filtro.

**Entitlement**, attributi: `app`, `entityType`, `purchaseId`, `subject`, `serviceId`, `planId`, `manifestRef`, `paymentChainId`. Payload: riferimento transazione/log e termini acquistati. Scadenza nativa Arkiv. Telemetria e deduplicazione nel registro operativo del gateway; niente segreti nel payload pubblico.

Query di autorizzazione concettuale:

```text
creatore = issuer fidato
AND proprietario = issuer previsto
AND app = apiperitivo
AND entityType = entitlement
AND subject = identità autenticata
AND serviceId = servizio richiesto
AND purchaseId = acquisto selezionato
AND planId = piano acquistato
AND manifestRef = versione acquistata
```

Un risultato valido consente il successivo controllo di operazione e limiti tecnici. Nessun risultato nega l’accesso. Il listing può scadere e fermare nuove vendite senza invalidare un pass già venduto: il pass conserva i termini della versione acquistata.

**Swarm manifest:** identificativi e versione, prezzo/token/chain, durata, provider, operazioni, limiti tecnici e termini. La referenza viene vincolata all’acquisto: modificare il catalogo non cambia ciò che un utente ha già comprato.

**Swarm receipt:** `purchaseId`, referenza manifest, prova Fuji, blocchi di attivazione/scadenza Arkiv, statistiche d’uso, eventuale commitment del risultato, firma dell’emittente. L’accesso ai dettagli privati passa dal vault dell’utente.

## Contratto e integrazioni minime

`AccessMarket.sol` valida un piano registrato immutabile; importi e destinatari non possono essere scelti liberamente dal frontend. L’acquisto vincola piano, servizio, manifest, subject e durata; produce un `purchaseId` e trasferisce test USDC al provider e alla treasury nella stessa transazione. L’evento deve permettere al worker di ricostruire senza ambiguità l’offerta pagata. Un rinnovo è un nuovo acquisto con un nuovo pass.

Il contratto non conserva il contatore delle chiamate API: ogni invocazione controlla il pass ma non genera un nuovo pagamento o una transazione. Test mirati: pagamento e split, rifiuto piano errato, duplicazione dell’acquisto, attivazione unica, pass contraffatto, scadenza, limiti concorrenti e gestione errore RPC.

Reti e librerie verificate nella documentazione:

- Arkiv Tiramisu: chain ID `7738577`, gas test GLM; RPC HTTP e WebSocket disponibili in documentazione. Package `@arkiv-network/sdk` con `viem`; fissare le versioni effettivamente provate nel lockfile. [Rete](https://docs.arkiv.network/networks/tiramisu/), [SDK](https://docs.arkiv.network/start-here/installation/)
- Swarm ID: `@snaha/swarm-id`, `initialize()`, `connect()`, controllo `canUpload`, upload e download. Preparare storage prima della demo; login riuscito non implica possibilità di upload. [Quick Start](https://swarm.snaha.net/docs/getting-started/)
- Fuji: test USDC Circle `0x5425890298aed601595a70AB815c96711a31Bc65`. Verificare rete, bytecode e decimali nell’implementazione. [Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses)

Mission 03: non copiare l’esempio HTTP del watcher presumendo che sia una subscription socket. Fare uno spike sul trasporto effettivo e sulla versione SDK installata; ispezionare traffico e comportamento in riconnessione. Separare eventuale recupero storico finito dalla subscription live senza `fromBlock`. Dimostrare creazione/modifica del catalogo tra due sessioni; non attendere un evento di scadenza inesistente. Se non funziona, completare Mission 02 senza rivendicare Mission 03.

## Ordine di costruzione e demo

1. Spike delle tre integrazioni: login/upload/download Swarm, creazione/query/expiry Arkiv, trasferimento test USDC su Fuji.
2. Contratto, prova del pagamento e attivazione idempotente.
3. Gateway autenticato con una API realmente eseguita; usare input sintetici nella demo.
4. Catalogo di 2–3 servizi tramite adapter, filtro composto e manifest acquistato vincolato alla transazione.
5. Risultato e ricevuta salvati su Swarm e recuperabili dall’utente.
6. Limiti tecnici atomici, errori recuperabili e prove automatiche essenziali.
7. Eventuale script agente con budget esplicito e credenziale limitata; eventuale Mission 03.
8. README, schema, feedback onesto, prove, video, slide e submission.

Nel README spiegare chi paga, chi usa il servizio, chi emette il pass e cosa bisogna ancora fidarsi che funzioni. Per l’adozione proporre un primo pubblico concreto: sviluppatori di automazioni e agenti che necessitano di API premium per task brevi, con pochi provider iniziali. È una strategia proposta, non adozione già ottenuta.

**Demo entro tre minuti:** ricerca di una API con vincoli; apertura dei termini da Swarm; acquisto test USDC e split su explorer; pass attivo; più invocazioni senza nuovi pagamenti e salvataggio di un risultato consentito; query ripetuta dopo la scadenza e richiesta negata; recupero del risultato e della ricevuta da Swarm. Prefinanziare wallet e storage, mostrare il confine di scadenza con un pass di breve durata e conservare una registrazione funzionante.

Il pannello tecnico per i giudici dovrebbe collegare `purchaseId`, transazione Fuji, entity key Arkiv e referenza Swarm. Questa catena di evidenze vale più di molte capability simulate.

**Fuori MVP:** marketplace permissionless completo, più modelli AI, GPU marketplace, NFT trasferibili, L1 personalizzata, bridge, escrow complesso, revoca di dati già scaricati e garanzia di storage perpetuo. La qualità da raggiungere è un percorso riproducibile, con le integrazioni realmente responsabili delle funzioni dichiarate.

**Pitch proposto:** “APIritivo permette a persone e agenti di acquistare una finestra di accesso alle API con stablecoin. Avalanche regola il pagamento, Arkiv rende verificabile l’accesso temporaneo e Swarm conserva termini e risultati sotto il controllo dell’utente.”
