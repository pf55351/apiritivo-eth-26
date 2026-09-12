# Friction log — implementazione backend

Data: 12 settembre 2026. SDK Arkiv 0.8.1, Swarm ID 0.4.1.

| Osservazione | Impatto | Soluzione adottata |
|---|---|---|
| Il commento TypeScript di createEntity descrive expiresAt come stima, mentre l’implementazione usa l’expiry dell’evento | Countdown e dedup richiedono una fonte precisa | Il nostro adapter decodifica sempre la receipt reale |
| Il cursor della query mantiene lo stesso blocco per tutta la paginazione | Un cursor storico non deve autorizzare chiamate nuove | Query nuova per ogni invoke, nessun cursor di accesso |
| readonly consente ancora al proprietario estensione/cancellazione | Non equivale a immutabilità completa del diritto | Confronto con expiry registrato; no rinnovo attraverso extendEntity |
| createEntity firma e invia internamente prima di restituire | Un retry dopo timeout può creare una seconda entity | Transport viem cattura e persiste raw tx/hash prima del broadcast; ripresa dello stesso hash |
| Il nonce pending può restare libero se il nodo non riceve la tx | Il job successivo potrebbe riutilizzarlo | La coda si ferma su ogni transazione firmata irrisolta, anche durante backoff |
| Nessun evento all’expiry | Un listener eventi non dimostra la scadenza | Lettura corrente e confronto head/expiry, provati nei test |
| Swarm ID è un bundle browser; l’import Node non è supportato nel nostro ambiente | Non utilizzabile come autenticazione server diretta | Import solo di tipi nel backend; proof Ed25519 e helper browser separati |
| Conoscere una reference non garantisce la correttezza della risposta del gateway | Firma valida di un altro documento potrebbe essere restituita sotto il ref sbagliato | Verifica BMT con MerkleTree del client Bee prima di parsare JSON |

Verifica live eseguita: Tiramisu restituisce chain ID corretto e accetta una query `select({key:true}).where(eq('app', str('apiperitivo'))).limit(1)` con il SDK installato. Non sono state eseguite scritture Arkiv: manca un issuer test finanziato nella configurazione locale.
