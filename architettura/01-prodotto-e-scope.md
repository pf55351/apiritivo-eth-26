# Prodotto e scope

## Proposta di valore

APIritivo permette a persone e agenti software di affittare accesso a endpoint API premium per il tempo necessario a un task. L’acquisto non richiede un abbonamento e non genera un pagamento per ogni chiamata.

Esempio illustrativo: un utente compra un’ora di accesso a un servizio di estrazione dati, lo usa da dashboard o script e perde la possibilità di invocarlo quando il pass scade. Le ricevute e i risultati archiviati restano accessibili secondo le condizioni di conservazione dichiarate.

## Attori

| Attore | Azioni |
|---|---|
| Consumer | Cerca servizi, acquista un piano, usa le operazioni ammesse, conserva ricevute |
| Agente software | Usa una credenziale delegata a uno specifico pass e alle sue operazioni |
| Provider | Offre un servizio, dichiara condizioni e protegge il proprio endpoint |
| Operatore APIritivo | Registra i provider ammessi, gestisce gateway e issuer, riceve la fee |

Il pagatore e il beneficiario possono essere diversi. L’acquisto deve vincolare il `subject` del beneficiario; il wallet pagante non viene usato implicitamente come identità del consumer.

## Servizio, operazione, piano e pass

- **Service:** capability di un provider, per esempio dati di mercato.
- **Operation:** endpoint logico con schema input/output, per esempio `getQuote` o `getHistory`.
- **Plan:** offerta versionata con prezzo, durata, operazioni e limiti tecnici.
- **Pass:** diritto rilasciato a un subject dopo un acquisto verificato.

Un service può avere più plan. Ogni pass copre esattamente il manifest del plan acquistato; le versioni successive non cambiano diritti o limiti già venduti.

## Semantica commerciale

| Voce | Decisione MVP |
|---|---|
| Prezzo | Importo fisso in test USDC, indicato prima del pagamento |
| Durata | Finestra relativa all’attivazione, con scadenza Arkiv in blocchi |
| Utilizzo | Chiamate durante la validità, entro rate limit e concorrenza dichiarati |
| Quantità totale | Nessun `maxRequests` commerciale |
| Rinnovo | Nuovo pagamento e nuovo pass; nessun accumulo automatico di durate |
| Pass sovrapposti | Sono acquisti indipendenti; il client sceglie quale usare |
| Interruzioni provider | Errore esplicito; nessun prolungamento implicito della durata |
| Rimborso | Non automatizzato nell’MVP con split immediato |

Il prezzo non cambia in funzione del contatore d’uso. Le statistiche delle chiamate servono a diagnostica e ricevute. Evitare la dicitura “illimitato” quando esistono limiti operativi.

## Scope della prima demo

Catalogo iniziale di 2–3 API, con adapter server separati. Candidati: dati di mercato, trasformazione di testo, estrazione strutturata da documenti. OCR è una possibile operazione, non il dominio del marketplace.

La scelta dei provider dipende dalla disponibilità di credenziali, dalla possibilità di offrire accesso tramite gateway e dai costi sostenibili. I dati sintetici possono aiutare i test, ma la demo deve distinguere chiaramente un servizio dimostrativo da un’integrazione con un provider esterno.

Implementare prima un percorso reale completo; aggiungere gli altri servizi riutilizzando lo stesso sistema di pagamento e accesso.

## Fuori scope

Marketplace permissionless, tokenizzazione/NFT del pass, billing per chiamata, abbonamenti ricorrenti, streaming e job lunghi, bridge, nuova L1, escrow complesso e acquisti autonomi da agenti senza un budget esplicito. La prima API del gateway è una facciata con adapter: non promette compatibilità trasparente con qualsiasi API esistente.
