# Implementazione APIperitivo

Percorso concordato: marketplace di API a tempo. Nessun billing per chiamata. Branch di lavoro: `develop`.

| Step | Obiettivo verificabile | Stato |
|---|---|---|
| 1 | Workspace, configurazione e dominio validato | Implementato, schemi esportati |
| 2 | AccessMarket: acquisto, split e protezione da replay | Implementato, test Foundry e Anvil passati |
| 3 | Sessioni, intenzioni e storage operativo durevole | Implementato, test replay e persistenza passati |
| 4 | Adapter Fuji/Arkiv e attivazione recuperabile | Implementato; letture reali verificate; scritture testnet da eseguire |
| 5 | Gateway protetto, operazioni e limiti | Implementato, scadenza/outage/concorrenza verificati |
| 6 | Swarm ID, manifest e vault | Adapter, cifratura e verifica reference implementati; UI vault e login reale da completare |
| 7 | Catalogo, checkout, pass e playground web | Da fare |
| 8 | Test completi, demo e documentazione di avvio | Suite backend e guida disponibili; demo completa con UI/testnet da fare |

Le prove locali e quelle su testnet vengono riportate separatamente. Deploy e storage reali richiedono rete disponibile, wallet test finanziati e batch/gateway Swarm utilizzabile. Nessuna integrazione viene dichiarata riuscita senza una relativa verifica.

Priorità richiesta: backend, schemi, smart contract, interazione Arkiv e Swarm. Per completare la demo: configurare `.env`, deploy Fuji, pubblicare i due servizi, acquistare un pass, osservare la scadenza reale e archiviare la ricevuta tramite Swarm ID; quindi costruire catalogo, checkout e vault web.
