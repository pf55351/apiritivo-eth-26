# Schema Arkiv implementato

SDK `@arkiv-network/sdk@0.8.1`, Tiramisu `7738577`. Sorgente effettiva: `packages/arkiv/src/client.ts`. Gli attributi usano i costruttori tipizzati del SDK; non stringhe formattate per i prezzi.

## Listing del marketplace

| Attributo | Tipo | Valore |
|---|---|---|
| app | str | apiperitivo |
| type | str | service |
| planId, serviceId, manifestRef | bytes32 | Identificativi e reference pubblica |
| category | str | text / data / utilities |
| provider | addr | Provider del manifest |
| priceAtomic | u256 | Prezzo test USDC in unità minime |
| durationSeconds | u64 | Durata nominale, multiplo di 2 |
| chainId | u64 | 43113 |
| token | addr | Indirizzo test USDC Fuji |

Payload `listingSchema`: nomi, identità, prezzi, durata e reference. Esempio eseguibile in `examples/arkiv-listing.json`; gli indirizzi e la reference di quel file sono dimostrativi e non pubblicati.

La query combina `$owner`, `$creator`, app e type, poi categoria e prezzo massimo. Un lookup per piano richiede un solo risultato, altrimenti fallisce `AMBIGUOUS_LISTING`. La vendibilità finale è stabilita dal piano Fuji attivo; l’assenza di una flag `available` su Arkiv non sostituisce quel controllo.

## Entitlement

| Attributo | Tipo |
|---|---|
| app, type | str (`apiperitivo`, `entitlement`) |
| subject, purchaseId | bytes32 |
| planId, serviceId, manifestRef | bytes32 |
| chainId | u64 (43113) |

Payload `entitlementSchema`: purchaseId/intenzione/subject, termini identificativi, pagatore, tx/blocco pagamento, mercato/rete e durata. I dati sono pubblici: nessun seed, API key, input dell’utente o token bearer.

Entrambe le entity usano `readonly: true`, `permissionlessExtension: false`. Issuer = `$owner` = `$creator`. L’issuer mantiene poteri amministrativi sulla scadenza; il gateway rifiuta un expiry modificato rispetto alla creazione registrata e il codice non usa `extendEntity` come rinnovo.

Il pass è creato con `ExpirationTime.fromSeconds(durationSeconds)`. L’expiry effettivo è letto dall’evento `EntityCreated` emesso dal precompile `0x4400000000000000000000000000000000000044`. Il campo `expiresAtBlock` è una stringa decimale nel backend.

Ogni chiamata avvia una nuova query senza cursori né cache positiva. Oltre ai filtri, vengono confrontati l’intero payload, gli attributi tipizzati, la entity key, creator, owner, flags ed expiry. Al blocco `head >= expiresAtBlock`, il diritto non è più valido. I dati locali non possono sostituire una query Arkiv riuscita.

Una scadenza non emette un evento. Nessun cron cancella entitlement e nessun WebSocket viene presentato come prova di una feature non implementata.

## Differenze rispetto alla proposta iniziale

Il codice adotta `type=service`, `chainId`, `token`; i precedenti nomi proposti `entityType=service_plan`, `paymentChainId`, `paymentToken` non sono gli attributi finali. Job e attivazione sono conservati nel documento dell’acquisto SQLite, senza tabelle duplicate. Gli schemi JSON esportati e questo documento prevalgono sugli esempi preliminari dell’architettura.
