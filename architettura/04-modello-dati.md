# Modello dati

## Convenzioni

`serviceId` identifica una capability; `planId` una sua offerta immutabile; `purchaseId` un acquisto. `subject` identifica la chiave applicativa autenticata del beneficiario. Il nome mostrato da Swarm ID non è la chiave di autorizzazione.

Prezzi in unità minime del token, rappresentati come interi. Nei payload JSON gli interi grandi e i blocchi sono stringhe decimali. `manifestRef` è la referenza pubblica del manifest immutabile e non deve incorporare chiavi di decifratura.

La data di scadenza visualizzata e il blocco `expiresAt` di Arkiv sono campi distinti. Il blocco è il riferimento per la validità effettiva.

## Catalogo Arkiv: una entity per offerta

| Attributo | Tipo proposto | Uso |
|---|---|---|
| `app` | str | Namespace `apiperitivo` |
| `entityType` | str | `service_plan` |
| `serviceId`, `planId` | bytes32 | Collegamento al dominio e al contratto |
| `category` | str | Ricerca della capability |
| `paymentChainId` | u64 | Rete su cui acquistare |
| `paymentToken` | addr | Token, necessario per confrontare i prezzi |
| `priceAtomic` | u256 | Filtro prezzo massimo |
| `durationSeconds` | u64 | Durata nominale acquistabile |
| `provider` | addr | Provider registrato e destinatario economico |
| `available` | bool | Visibilità e disponibilità dichiarata |
| `manifestRef` | bytes32 | Termini e operazioni della versione |

Payload: nome, descrizione breve e metadati UI non usati nei filtri. Schema delle operazioni e termini lunghi stanno nel manifest. Nell’MVP l’operatore pubblica i listing per i provider ammessi; creator/owner di sistema devono corrispondere all’account configurato.

Query dimostrativa: categoria richiesta, disponibilità, token e rete corretti, prezzo sotto il budget e durata minima. Filtrare sulle unità numeriche, non sulle stringhe formattate in UI. La vendibilità finale viene verificata dal contratto Fuji.

## Pass Arkiv

| Campo | Tipo / posizione | Significato |
|---|---|---|
| `app`, `entityType` | str / attributi | `apiperitivo`, `entitlement` |
| `purchaseId`, `subject` | bytes32 / attributi | Acquisto e beneficiario |
| `serviceId`, `planId` | bytes32 / attributi | Servizio e piano acquistati |
| `manifestRef` | bytes32 / attributo | Versione delle condizioni |
| `paymentChainId` | u64 / attributo | Contesto della prova di pagamento |
| Prova Fuji | payload | Contratto, transazione e log verificati |
| `expiresAt` | campo di sistema | Blocco di scadenza deciso da Arkiv |
| Creator e owner | campi di sistema | Issuer fidato, non campi dichiarati dal client |

Proposta: record readonly con estensione permissionless disabilitata. L’issuer ne mantiene la proprietà. Readonly non elimina il potere del proprietario di estendere o cancellare: nessun percorso applicativo deve usare l’estensione come rinnovo gratuito.

Il gateway seleziona il pass corrente tramite `purchaseId`, `subject`, `serviceId`, `planId`, `manifestRef` e creator/owner attesi. Un record con gli stessi attributi creato da un’altra chiave è rifiutato.

Riferimenti tecnici verificati nell’analisi: [query](https://docs.arkiv.network/typescript-sdk/querying-data/), [mutazioni e flags](https://docs.arkiv.network/typescript-sdk/mutating-data/). Lo schema effettivo dovrà essere validato sulla versione SDK scelta e riportato in `arkiv/schema.md` alla radice del progetto.

## Manifest Swarm

Documento firmato dal provider registrato, con formato e serializzazione deterministici da fissare prima delle firme. L’onchain `manifestRef` vincola i byte della versione venduta.

```text
schemaVersion
serviceId, planId, provider
name, description
payment: chainId, token, priceAtomic
access: durationSeconds
operations[]:
  operationId, description, inputSchema, outputSchema
limits:
  requestsPerMinute, maxConcurrent, maxBodyBytes, timeoutMs
terms:
  activationRule, renewalRule, failurePolicy, resultStoragePolicy
providerSignature
```

Il manifest espone operazioni del gateway; configurazione upstream e segreti rimangono sul server. I limiti non includono un tetto commerciale di chiamate. Il provider deve scegliere valori sostenibili e il playground deve mostrarli prima dell’acquisto.

## Storage operativo del gateway

| Tabella proposta | Dati principali | Invariante |
|---|---|---|
| `auth_challenges` | nonce, publicKey, origin, scadenza, usedAt | Challenge monouso |
| `sessions` | hash token, subject, scadenza | Nessun token in chiaro nei log |
| `purchase_intents` | intentId, subject, payer, planId | Retry checkout riusa la stessa intenzione |
| `purchases` | purchaseId, prova Fuji, plan snapshot, subject | Unicità purchaseId e chain/contract/tx/log |
| `activation_jobs` | purchaseId, stato, tx Arkiv firmata, txHash, retry | Una scrittura in riconciliazione per acquisto |
| `activations` | purchaseId, entityKey, createdAtBlock, expiresAtBlock | Una sola attivazione, conservata anche dopo expiry |
| `delegated_credentials` | hash token, subject, purchaseId, scope, scadenza, revoca | Credenziale limitata al pass |
| `usage_events` | requestId, purchaseId, operationId, stato, durata | Telemetria senza payload privati o billing |
| `receipt_jobs` | purchaseId, versione, digest, stato upload, ref | Retry senza alterare ricevute pubblicate |

La transazione Arkiv firmata è materiale operativo riservato: viene salvata prima del broadcast per poter riconciliare un crash. Non pubblicarla in evidence. Non memorizzare la chiave privata issuer nel database.

Il registro acquisti non scade insieme al pass: è necessario per impedire che un vecchio pagamento produca un accesso nuovo. Il database non concede accesso se Arkiv non restituisce il pass.

## Ricevute e risultati

Ricevuta d’acquisto: purchaseId, manifestRef, prova Fuji, importo, firma issuer. Dopo l’attivazione: entity key, blocchi effettivi e riferimento alla ricevuta precedente. Il riepilogo finale contiene utilizzo osservato e stato delle richieste, senza cambiare il prezzo.

Ogni versione ha una propria referenza Swarm. La firma identifica l’emittente; non prova che il risultato dell’API sia corretto. Un hash non è una prova di paternità.

Il browser può cifrare e caricare ricevute private e risultati tramite l’account Swarm dell’utente. Un indice personale o export delle referenze permette di recuperarli. Non salvare automaticamente ogni risposta: rispettare la policy del piano e la scelta dell’utente. Le chiavi di decifratura restano fuori da Arkiv e dalle prove pubbliche.
