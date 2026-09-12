# Architettura APIperitivo

Base progettuale del marketplace di accesso temporaneo a API premium. Scope aggiornato il 12 settembre 2026: un pagamento acquista una finestra di utilizzo; ogni chiamata verifica il pass, senza nuovi addebiti.

**Stato:** documentazione di progetto. Le applicazioni, i contratti, gli endpoint e i test descritti devono ancora essere implementati. La struttura futura del repository non coincide con le cartelle attualmente presenti.

## Documenti

| Documento | Contenuto |
|---|---|
| [01 — Prodotto e scope](01-prodotto-e-scope.md) | Utenti, servizi, piani a tempo e confini dell’MVP |
| [02 — Architettura del sistema](02-architettura-sistema.md) | Componenti, responsabilità e confini di fiducia |
| [03 — Struttura del progetto](03-struttura-progetto.md) | Monorepo proposto, cartelle e dipendenze |
| [04 — Modello dati](04-modello-dati.md) | Catalogo, entitlement, manifest e stato operativo |
| [05 — Flussi e stati](05-flussi-e-stati.md) | Pubblicazione, acquisto, utilizzo, scadenza e recupero errori |
| [06 — API e contratto](06-api-e-contratto.md) | Interfacce applicative e responsabilità di AccessMarket |
| [07 — Sicurezza e limiti](07-sicurezza-e-limiti.md) | Autenticazione, anti-replay, protezione provider e privacy |
| [08 — Piano MVP e bounty](08-piano-mvp-e-bounty.md) | Ordine di lavoro, criteri di completamento e prove per i giudici |

## Decisioni di riferimento

- Prezzo fisso per piano e durata. Nessun prezzo per chiamata e nessun pacchetto di richieste nell’MVP.
- Un servizio può esporre più operazioni; il piano definisce quali sono autorizzate.
- Pagamento in test USDC su Avalanche Fuji; pass con scadenza nativa su Arkiv.
- Durata a partire dall’attivazione confermata su Arkiv, espressa effettivamente in blocchi. Il countdown è una stima.
- Nuovo acquisto per rinnovare. Nessuna estensione automatica o sovrascrittura del pass precedente.
- Swarm ID per identità/storage; credenziale del gateway distinta dal wallet che paga.
- Swarm per manifest e ricevute; archiviazione dei risultati scelta dall’utente quando consentita dal servizio.
- Gateway unico nell’MVP, con worker di attivazione e storage operativo durevole sul server.
- Rate limit, concorrenza, dimensione input e timeout sono condizioni tecniche visibili del piano.

L’[analisi dei bounty](../APIPERITIVO_ANALISI.md) conserva fonti, scadenze e differenze rilevate tra le pagine degli sponsor. Le specifiche di questa cartella sono la base operativa per l’implementazione.
