# Verifiche backend — 12 settembre 2026

Queste prove riguardano la prima implementazione backend. Non costituiscono prova di deploy o upload reali per i bounty.

| Verifica | Esito |
|---|---|
| TypeScript strict (`pnpm typecheck`) | Passato |
| Test applicativi (`pnpm test`) | 22 test passati |
| Solidity (`pnpm test:contracts`) | 6 test passati, inclusi 256 casi fuzz dello split |
| Build (`pnpm build`) | TypeScript e compilazione/ABI Solidity passati |
| Advisory runtime (`pnpm audit --prod`) | Nessuna vulnerabilità nota nel grafo dipendenze risolto |
| Contratto + adapter EVM (`pnpm test:evm`) | Passato su Anvil isolato, chain ID configurato 43113 |
| Avvio processo HTTP | `/health` 200; `/api/services` 503 ARKIV_NOT_CONFIGURED senza issuer |
| Fuji RPC reale | chain ID 43113; blocco osservato 58331540 |
| Arkiv RPC e SDK reali | chain ID 7738577; blocco osservato 350017; query tipizzata riuscita |
| Swarm ID pubblico | HTTP raggiungibile; nessuna sessione browser autenticata provata |
| Bee configurato | Non disponibile su localhost:1633; nessun upload reale eseguito |

I test coprono: firme/challenge monouso e origine, subject diverso dal payer, autenticazione per acquisto, chiamate ripetute senza billing unitario, scadenza esatta in blocchi, rimozione anticipata, outage Arkiv senza esecuzione, scope bearer/revoca, concorrenza, slot rilasciati su errore, blocco delle ammissioni durante finalizzazione, receipt idempotente, restart con raw tx persistita, nessuna riemissione dopo expiry, blocco nonce durante backoff, verifica evento Fuji/split/token/mercato, creator/owner/flags e payload Arkiv, BMT/firma Swarm, upload multi-chunk e cifratura AES-GCM.

Lo script EVM crea un nuovo processo Anvil e account temporanei, installa un token di test all’indirizzo Fuji **solo nella chain locale**, deploya il contratto, registra/acquista un piano e usa FujiMarket per verificare la receipt. Controlla saldi provider 90000 e treasury 10000 unità su prezzo 100000. Il processo viene chiuso al termine.

Restano da provare con configurazione reale: deploy Fuji, pubblicazione Swarm, listing/entitlement Arkiv, scadenza effettiva e upload ricevuta attraverso una sessione Swarm ID. Servono AVAX/test USDC al buyer, GLM all’issuer e storage Swarm disponibile.

L’audit iniziale segnalava 22 advisory nella versione Axios richiesta transitivamente da Bee. È stato applicato un override mirato a `@ethersphere/bee-js>axios=0.33.0`, dopo lettura delle [release notes ufficiali](https://github.com/axios/axios/releases/tag/v0.33.0). Build e suite sono stati rieseguiti dopo l’aggiornamento. L’audit del lockfile non analizza codice incorporato nei bundle precompilati: il flusso browser Swarm ID dovrà essere verificato nello step frontend. Il server usa fetch nativo per HTTP e solo MerkleTree del client Bee per il BMT.
