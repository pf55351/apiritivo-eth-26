# API applicativa e contratto

Le rotte e il contratto qui descritti sono ora implementati nella prima versione backend, con dettagli e limiti in [docs/backend.md](../docs/backend.md). I payload sono validati con gli schemi condivisi in `packages/domain` e gli schemi HTTP del gateway. Ricevute intermedie e UI completa rimangono nella roadmap.

## HTTP del gateway

| Metodo e rotta | Accesso | Responsabilità |
|---|---|---|
| `GET /api/services` | Pubblico | Filtri categoria, chain, token, prezzo e durata |
| `GET /api/plans/:planId` | Pubblico | Listing verificato, manifest e termini |
| `POST /api/auth/challenge` | Pubblico, limitato | Challenge breve per una chiave applicativa |
| `POST /api/auth/verify` | Challenge firmata | Verifica nonce/origine/scadenza e crea sessione |
| `DELETE /api/auth/session` | Sessione | Logout |
| `POST /api/purchases/prepare` | Sessione | Intenzione unica; dati per il wallet |
| `POST /api/purchases/confirm` | Sessione | Segnala tx hash; il server verifica la prova |
| `GET /api/purchases/:purchaseId` | Subject beneficiario | Stato pagamento/attivazione e prove |
| `GET /api/passes` | Sessione | Pass del subject, con stato verificato o indicato non disponibile |
| `POST /api/passes/:purchaseId/credentials` | Sessione | Credenziale delegata limitata a quel pass |
| `DELETE /api/credentials/:credentialId` | Sessione proprietaria | Revoca la credenziale delegata |
| `POST /api/passes/:purchaseId/invoke/:operationId` | Sessione o credenziale | Autorizzazione e inoltro tramite adapter |
| `POST /api/purchases/:purchaseId/receipt` | Sessione beneficiaria | Prepara/richiede il riepilogo firmato |
| `POST /api/purchases/:purchaseId/receipt-reference` | Sessione beneficiaria | Verifica e registra la referenza Swarm di una ricevuta pubblica dimostrativa |

Per ricevute private cifrate, l’indice delle referenze complete rimane nel vault utente; non inviare al server o rendere pubblico il materiale di decifratura.

`prepare` riceve `planId` e `payer`; `subject` deriva dalla sessione. Restituisce `purchaseIntentId`, rete, mercato, token, importo e argomenti dell’acquisto. Nessuna chiave wallet viene inviata al gateway. `confirm` non può cambiare beneficiario o piano dell’intenzione.

Una singola rotta `invoke` può rappresentare upstream GET o POST: l’adapter traduce `operationId` e input validato. È una facciata API uniforme, non un proxy verso URL scelti dal client.

## Autenticazione e credenziali

Proposta: derivare materiale applicativo con il meccanismo Swarm ID documentato, usarlo come seed per una chiave di firma tramite una libreria consolidata e autenticare una challenge del gateway. Algoritmo, serializzazione e derivazione di `subject` vanno fissati dopo lo spike e condivisi tra client/server. Non inviare il seed al backend.

La challenge include nonce, audience/origine APIperitivo, scopo e scadenza. Il backend verifica la firma, consuma il nonce e rilascia una sessione tramite cookie HttpOnly, Secure in produzione, con protezione CSRF per le mutazioni. Una chiave inventata dal client non può usare acquisti legati a un altro subject.

Per lo script agente: bearer token casuale, conservato come hash, vincolato a subject, purchaseId, operazioni e scadenza breve. La credenziale non può comprare, rinnovare, accedere al vault o emettere altre credenziali. Anche un token non ancora scaduto richiede un pass Arkiv valido a ogni chiamata.

## Risposte e codici

Risposta d’errore uniforme: `error.code`, `error.message`, `requestId`, opzionale `retryAfterSeconds`. Nessun dettaglio sensibile del provider.

| HTTP | Codice | Condizione |
|---|---|---|
| 400 | `INVALID_INPUT` | Input o identificativo non valido |
| 401 | `AUTH_REQUIRED` | Sessione o credenziale non valida |
| 403 | `ACCESS_NOT_ACTIVE` | Nessun diritto verificabile per quel subject e acquisto |
| 403 | `ACCESS_EXPIRED` | Pass noto assente dopo il blocco expiry verificato |
| 403 | `OPERATION_NOT_ALLOWED` | Operazione fuori dal piano acquistato |
| 409 | `PURCHASE_MISMATCH` | Prova incompatibile con l’intenzione |
| 429 | `RATE_LIMITED` | Frequenza o concorrenza superata; include Retry-After |
| 502 | `PROVIDER_ERROR` | Fallimento dell’upstream |
| 503 | `ACCESS_CHECK_UNAVAILABLE` | Lettura Arkiv non riuscita; nessun inoltro |
| 504 | `PROVIDER_TIMEOUT` | Timeout dell’operazione |

Operazioni asincrone come conferma acquisto e generazione ricevuta possono rispondere `202` con lo stato corrente. Le rotte non rivelano dettagli di pass appartenenti ad altri subject.

## AccessMarket.sol

Scelta MVP: piani registrati dall’operatore, non offerte arbitrarie del frontend. Configurazione iniziale: token di test ammesso, account amministrativo e mercato su Fuji.

```text
Plan:
  serviceId, manifestRef
  provider, treasury
  priceAtomic, durationSeconds, feeBps
  active

registerPlan(planId, plan)                  # solo operatore
setPlanActive(planId, active)              # solo operatore, nuove vendite
purchase(planId, purchaseIntentId, subject)
```

Le condizioni economiche, la durata, i destinatari e il manifest di un `planId` non vengono modificati. Una modifica richiede un piano nuovo. La fee è inclusa nel prezzo mostrato; per l’esempio 90/10, providerAmount = priceAtomic - feeAmount.

L’acquisto controlla piano attivo, durata ammessa, indirizzi validi, token previsto e intenzione non già consumata. Trasferimenti ERC-20 sicuri e protezione da rientranza. Validazione della durata coerente con la conversione in blocchi Arkiv e con i limiti di prodotto.

`purchaseId` deve essere univoco per chain, contratto, pagatore e intenzione. La stessa intenzione dello stesso pagatore non incassa due volte; un nuovo acquisto richiede una nuova intenzione. Il beneficiario è il subject passato e registrato, non il mittente dedotto in seguito.

L’evento `AccessPurchased` espone purchaseId, planId, buyer, subject e i dati necessari a ricostruire il pagamento; gli altri termini sono recuperabili dal piano immutabile. Il worker accetta solo log del mercato e della rete configurati, con receipt riuscita e finalità verificata. Un semplice evento ERC-20 Transfer non autorizza il pass.

Il contratto non esegue operazioni su Arkiv e non registra le singole chiamate API. Lo split immediato non garantisce un rimborso automatico se l’attivazione fallisce: l’MVP si basa sul recupero dell’attivazione e deve dichiarare questo limite.
