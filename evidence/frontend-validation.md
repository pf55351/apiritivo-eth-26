# Verifica frontend e demo — 12 settembre 2026

## Risultato

Frontend React/Vite collegato al gateway: catalogo, login, checkout, ripresa dell’acquisto, pass, playground, ricevute e pubblicazione offerte. Demo locale separata dagli adapter testnet e visibilmente etichettata. Nessun fondo reale o testnet utilizzato durante questa verifica.

## Controlli eseguiti

- `pnpm typecheck`: superato.
- `pnpm test`: 30 test superati in 6 file. Gli 8 nuovi test coprono percorso locale, firme e binding della pubblicazione alla sessione, proprietà degli intenti, ripetizione idempotente, upload interrotto, recupero delle transazioni Arkiv, esclusione degli endpoint demo in testnet/produzione e scadenze indipendenti di catalogo e pass.
- `pnpm build`: superato, inclusi ABI e frontend; dopo gli ultimi ritocchi sono stati ripetuti typecheck, test e `pnpm web:build`.
- `forge test --root contracts --offline`: 6 test superati, incluso fuzz con 256 esecuzioni. Il sandbox segnala soltanto l’impossibilità di aggiornare la cache globale delle firme Foundry.
- `pnpm audit --prod --json`: nessuna vulnerabilità segnalata nelle 156 dipendenze di produzione.
- `git diff --check`: superato.
- Avvio `pnpm demo:built`: verificato con bundle compilato.
- Avvio `pnpm demo`: verificato, Vite e WebSocket condividono la porta HTTP del gateway; nessun errore browser nuovo dopo il riavvio finale.
- Le risposte API hanno `Cache-Control: no-store` e `X-Content-Type-Options: nosniff`.

## Percorso browser verificato

1. Homepage desktop, due servizi iniziali dal catalogo backend e condizioni del piano.
2. Login con identità locale, challenge e sessione; sessione e acquisti conservati dopo riavvio del gateway e reload della pagina.
3. Acquisto simulato di JSON Tonic, attivazione, richiesta `json.transform`, restituzione dei record con i soli campi selezionati.
4. Pubblicazione dal form di **Copywriter’s Spritz**, offerta testuale da 30 secondi; conferma di pubblicazione e reperibilità tramite ricerca del catalogo.
5. Acquisto della nuova offerta e chiamata `text.analyze`: 11 parole, 9 parole uniche, frequenze e tempo di lettura restituiti dal provider adapter.
6. Scadenza osservata nel browser: stato expired e invocazione disabilitata. Il test gateway verifica anche il rifiuto HTTP esattamente al blocco di scadenza.
7. Download della ricevuta finale firmata dalla UI. Verifica crittografica e conteggi verificati nei test.
8. Layout mobile a 390 × 844, homepage e playground; nessun overflow orizzontale (`scrollWidth === clientWidth === 390`). Viewport ripristinato al termine.

## Design e caricamento

Carta chiara, arancio e oliva, serif Instrument Serif e DM Sans locali, elementi di menu e illustrazione SVG. Controlli con etichette, focus visibile, link per saltare al contenuto, stati di errore, reduced motion e form responsive.

Bundle iniziale JavaScript circa 245 KB minificato / 77,4 KB gzip; CSS circa 28,6 KB / 6,8 KB gzip. Studio, pass, wallet, crittografia e Swarm ID vengono caricati separatamente quando servono. Nessun font o immagine esterno richiesto dalla homepage della demo.

## Limiti della verifica

Il flusso reale è cablato, ma non è stato eseguito end-to-end con Swarm ID, fondi Fuji/Arkiv o batch Bee: l’utente ha scelto di preparare la demo locale perché tali risorse non sono ancora disponibili. La registrazione frontend in testnet richiede il proprietario di AccessMarket; altri wallet possono esportare un draft. Le operazioni disponibili sono `text.analyze` e `json.transform`; aggiungere un upstream diverso richiede un adapter. Non è stato svolto un audit di sicurezza esterno né un test di carico.

## Revisione del codice

Esaminati correttezza, gestione degli errori, confini tra simulazione e rete, proprietà della sessione, firme, persistenza delle transazioni e peso del frontend. Risolti durante la revisione: replay delle firme pubbliche per rivendicare una pubblicazione, blocco dell’issuer dopo una risposta persa senza ripresa automatica, riuso del vecchio dettaglio durante un cambio offerta, recupero ambiguo delle transazioni wallet e trasporto WebSocket di sviluppo. Nessuna chiave privata reale, `.env`, database locale o artefatto compilato incluso nei commit.
