# Piano MVP e prove per i bounty

## Stato e ordine di lavoro

È completata la base documentale in questa cartella. Tutte le integrazioni, gli artefatti di submission e le verifiche sotto sono ancora da realizzare.

| Fase | Risultato atteso | Criterio di completamento |
|---|---|---|
| 0 — Spike | Connessioni reali alle tre integrazioni | Swarm login/upload/download, Arkiv create/query/expiry, pagamento Fuji verificati |
| 1 — Dominio e contratto | Piani immutabili e pagamento a tempo | Acquisto test USDC con split e purchaseId; test contratto passati |
| 2 — Identità e attivazione | Sessione verificata e worker recuperabile | Un acquisto crea un solo pass anche dopo crash/retry |
| 3 — Gateway | Primo servizio realmente utilizzabile | API consentita prima di expiry e negata dopo; upstream protetto |
| 4 — Catalogo multi-API | 2–3 servizi e filtri composti | Ogni adapter riusa il controllo del pass; prezzo/durata funzionano nei filtri |
| 5 — Vault | Ricevuta e risultato recuperabili su Swarm | Retrieval verificato anche a pass scaduto; stato upload corretto |
| 6 — Demo e submission | Repository riproducibile e prove | Avvio documentato, video, slide, contratti e query collegati |

Priorità successive: credenziale delegata e script agente; aggiornamento del catalogo via WebSocket per Mission 03. Non compromettere il percorso completo per aggiungere queste estensioni.

## Condizioni da risolvere negli spike

- Autenticazione backend con chiave applicativa Swarm ID: confermare derivazione, algoritmo e interoperabilità; il callback UI non sostituisce questa prova.
- Firma e broadcast Arkiv recuperabili: acquisire tx hash e receipt senza rischiare una doppia creazione.
- Verificare network, token, gas, access key e storage per tutta la demo.
- Confermare provider utilizzabili, protezione upstream, limiti e policy di archiviazione.
- Verificare il WebSocket reale solo se si intende rivendicare Mission 03.

## Matrice delle evidenze

| Candidatura | Evidenza da produrre | Dove documentarla |
|---|---|---|
| Arkiv Mission 02 | Query identica prima/dopo expiry senza delete; effetto sul gateway | `evidence/`, `arkiv/schema.md`, video |
| Arkiv Best Use | Modello dati motivato, query composte, flusso completo e feedback preciso | `arkiv/schema.md`, `friction.md`, README |
| Swarm | Manifest e ricevuta realmente caricati/recuperati; storage utente utile | README, referenze pubbliche dimostrative, video |
| Team1 Track A | Stablecoin che acquista accesso, contratto e split verificabili | `deployments/fuji.json`, tx, README, slide |
| Arkiv Mission 03, opzionale | Stream WebSocket reale e riconnessione documentata | Codice trasporto, prova tra due sessioni, friction |

Non creare bug report fittizi. `friction.md` raccoglie problemi realmente osservati con versione, passaggi, atteso, effettivo e workaround. Distinguere incompatibilità runtime da ambiguità di documentazione.

Le scadenze e le discrepanze tra i regolamenti sono riportate nell’[analisi dei bounty](../APIPERITIVO_ANALISI.md). Verificare i requisiti organizzativi con gli sponsor prima della consegna; nessuna submission è stata effettuata da questa documentazione.

## Scaletta della demo

1. Presentare un task concreto e cercare un’API per categoria, prezzo e durata.
2. Aprire da Swarm il manifest con operazioni e limiti.
3. Pagare una volta in test USDC; mostrare split e purchaseId su Fuji.
4. Mostrare l’attivazione Arkiv e invocare più volte senza nuovi pagamenti.
5. Salvare un risultato consentito e una ricevuta tramite Swarm ID.
6. Superare il blocco di scadenza: stessa query senza risultati e nuova chiamata rifiutata.
7. Recuperare dal vault ciò che è stato archiviato; mostrare un secondo servizio nello stesso catalogo.

Pass dimostrativo di 60–120 secondi nominali e input sintetici. Mostrare stato della rete e blocco effettivo; non simulare l’expiry con un timer locale. Per restare nel video di tre minuti, provare in anticipo tempi wallet, storage e provider.

## Decisioni da mantenere nel README finale

Accesso a tempo, pagamento singolo, nessun billing per chiamata; rate limit espliciti; attivazione dopo conferma Arkiv; ruolo del worker fidato; storage operativo persistente; rinnovo tramite nuovo acquisto; differenza tra ricevuta pronta e ricevuta effettivamente salvata su Swarm.

## Fonti di riferimento

Fonti già consultate nell’analisi del 12 settembre 2026, non evidenze di esecuzione:

- [Manuale premi ETHRome](https://www.ethrome.org/hackermanual/prizes.html)
- [Arkiv ETHRome](https://hub.arkiv.network/ethrome)
- [Team1 ETHRome](https://academy.avax.network/events/73a939b1-6d35-4847-9388-320024638249)
- [SDK Arkiv](https://docs.arkiv.network/start-here/installation/)
- [Swarm ID](https://swarm.snaha.net/docs/getting-started/)
- [USDC testnet Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses)
