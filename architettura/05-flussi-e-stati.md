# Flussi e stati

## Pubblicazione di un servizio

1. Il provider ammesso configura l’adapter e protegge l’endpoint upstream.
2. Definisce un piano a tempo con operazioni, prezzo e limiti; firma e pubblica il manifest su Swarm.
3. L’operatore registra su Fuji il piano e la sua referenza immutabile.
4. Pubblica il listing Arkiv con attributi interrogabili.
5. Lo script di pubblicazione verifica corrispondenza tra manifest, piano onchain e listing.

Un listing non basta a rendere acquistabile un piano assente o disattivato nel contratto. Disattivare nuove vendite non modifica i termini dei pass già venduti.

## Identità e acquisto

1. Il consumer entra con Swarm ID. Una challenge firmata dalla chiave applicativa crea la sessione gateway e il suo `subject`.
2. Sceglie un piano e legge manifest e limiti.
3. Il backend prepara un’intenzione di acquisto legata a piano, pagatore e subject autenticato.
4. Il wallet su Fuji approva il token se necessario e invia l’acquisto. L’approvazione ERC-20 da sola non è un pagamento.
5. AccessMarket effettua split ed emette l’evento acquisto.
6. Il worker verifica receipt riuscita, chain, contratto, log e termini; attende il criterio di finalità configurato.
7. Crea una sola entity su Arkiv e registra entity key e scadenza effettiva.
8. La UI mostra il pass attivo dopo conferma di Arkiv. Il periodo di acquisto non include l’attesa precedente all’attivazione.

Il worker riceve il tx hash dal client per accelerare il percorso, ma recupera anche gli eventi del mercato dal blocco di deployment con un cursore durevole. La chiusura del browser non deve far perdere l’acquisto.

## Stati dell’acquisto e del pass

| Stato | Significato | Azione successiva |
|---|---|---|
| `prepared` | Intenzione pronta, nessun incasso provato | Firma wallet |
| `payment_pending` | Transazione inviata | Attendere receipt |
| `payment_failed` | Revert o rifiuto verificato | Correggere e riprovare senza dichiarare un pass |
| `paid` | Pagamento verificato | Accodare attivazione |
| `activation_pending` | Scrittura Arkiv da inviare o riconciliare | Retry controllato |
| `active` | Entitlement confermato e presente alla lettura corrente | Consentire operazioni autorizzate |
| `expired` | Entitlement assente dopo il blocco di scadenza noto | Proporre nuovo acquisto |

`active` ed `expired` nel DB sono proiezioni per UI e recupero, non permessi sufficienti. Se la lettura Arkiv fallisce, l’accesso è temporaneamente non verificabile. Un’entità assente prima del blocco atteso può essere stata cancellata: non etichettarla automaticamente come scaduta.

## Attivazione idempotente e crash recovery

- Deduplicare il pagamento per identificativi onchain verificati e `purchaseId`.
- Un job per acquisto prende in carico la scrittura. Serializzare i nonce dell’issuer.
- Preparare, firmare e salvare la transazione e il suo hash prima del broadcast.
- Dopo un crash, ritrasmettere la stessa transazione o cercarne la receipt; non richiamare ciecamente `createEntity`.
- Salvare entity key ed expiry dalla receipt risultante. La sola deduplicazione con una query ai pass live non basta, perché dopo la scadenza il record non compare più.
- Una nuova transazione di creazione è ammessa soltanto dopo aver provato che il tentativo precedente non può avere creato un pass. Un esito ambiguo resta in riconciliazione.
- Un acquisto già attivato non produce nuovi diritti, neppure se il pass è ormai scaduto.

Questo richiede uno spike sul percorso firma/broadcast/receipt del SDK. Se non si può ricostruire l’esito con certezza, segnalare l’attivazione per intervento invece di duplicarla.

## Invocazione API

1. Autenticare sessione o credenziale delegata.
2. Risolvere il pass richiesto per quel subject e il manifest acquistato.
3. Validare operazione e input; applicare limiti globali di ingresso.
4. Eseguire una query Arkiv nuova, sullo stato corrente, con issuer e tutti i vincoli del pass.
5. Riservare capacità di rate limit e concorrenza; non accodare una richiesta in attesa di capacità dopo il controllo del pass.
6. Inoltrare subito all’adapter autorizzato, con timeout.
7. Rilasciare lo slot in `finally`, registrare metadati minimi e restituire il risultato.

La validità si controlla all’ammissione, non alla fine dell’elaborazione. Una richiesta già ammessa può completarsi dopo expiry entro il timeout del piano. Ogni retry è una nuova ammissione e deve ricontrollare Arkiv. Nell’MVP le operazioni sono di lettura o trasformazione senza effetti esterni: niente retry automatici di operazioni mutanti.

## Scadenza, rinnovo e ricevuta

La scadenza Arkiv non emette un evento. Il countdown può provocare una lettura puntuale per aggiornare la UI; il server continua a controllare il pass a ogni invocazione. Nessun job cancella il pass per far scattare il blocco.

Il rinnovo è un acquisto indipendente. Non aggiornare `expiresAt` del vecchio entitlement, non trasferire credenziali al nuovo pass e non sommare automaticamente il tempo residuo.

Stati ricevuta separati: `draft → signed → upload_pending → stored`. Il riepilogo finale viene preparato su richiesta dopo la scadenza; se ci sono invocazioni ancora in corso attende il completamento o timeout e segnala lo stato provvisorio. Il browser salva il documento firmato su Swarm e conferma la referenza dopo retrieval di verifica.

Se il browser si chiude prima dell’upload, la ricevuta rimane scaricabile dal gateway e l’upload viene riproposto all’accesso successivo. Non chiamarla “salvata su Swarm” prima della verifica. L’archiviazione completamente automatica a client chiusi richiederebbe un flusso aggiuntivo di storage autorizzato.

## Errori da dimostrare

Pagamento riuscito con RPC Arkiv temporaneamente indisponibile; crash dopo broadcast e prima del salvataggio entity key; credenziale di un altro subject; chiamata oltre il rate limit; API lenta; assenza del pass dopo expiry; upload Swarm fallito e ripetuto. Il client deve mostrare lo stato verificato e l’azione recuperabile.
