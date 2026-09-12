# APIritivo — pitch demo da 3 minuti (ETH Rome 2026)

Parlato: ~430 parole, ritmo normale. Demo live in parallelo al parlato.
Prima di salire: `bun demo:check`, due profili browser già loggati (provider / client),
un servizio **già pubblicato** come rete di sicurezza, USDC e AVAX nei due Swarm wallet.

---

## 0:00 – 0:35 · Il problema

> Oggi un agente software non può "iscriversi" a un'API.
> Deve trovarla leggendo documentazione scritta per umani, qualcuno deve creare
> un account, copiare una API key, inserire una carta di credito.
> E dall'altra parte, chi vuole vendere un servizio deve prima costruire un backend,
> un sistema di billing e un archivio di chiavi. Prima ancora di incassare un centesimo.
>
> Nel momento in cui gli agenti diventano i principali consumatori di API,
> questo modello non regge: serve un marketplace che una macchina possa leggere,
> pagare e usare da sola.

## 0:35 – 0:55 · L'idea

> APIritivo è un marketplace di servizi leggibile dalle macchine.
> Nessun account, nessuna API key da custodire, nessun database.
> Quattro domande, quattro primitive decentralizzate:
> chi sei → **Swarm ID**; come ti chiamo → manifest su **Swarm**;
> cosa esiste e a che prezzo → registro su **Arkiv**; come pago → **USDC su Avalanche**.
>
> Il trucco è uno: **il pass di accesso è un'entità Arkiv con scadenza.
> La sua chiave è la API key.** Quando scade, Arkiv la cancella e il servizio smette
> di rispondere. Niente da revocare, niente da archiviare.

## 0:55 – 2:30 · Demo live

| Tempo | Schermo | Fai | Di' |
| --- | --- | --- | --- |
| 0:55 | `/` (provider) | Entra con Swarm ID | "Login con Swarm ID: nessun wallet, nessuna seed phrase nell'app." |
| 1:05 | `/provider` | Mostra i chip di stato e *Your Swarm wallet* | "Il wallet è **derivato** dall'identità Swarm: stessa identità, stesso indirizzo ovunque. Lo storage è il drive Swarm dell'utente." |
| 1:15 | `/provider/new` | Nome, 0.50 USDC, 7 giorni, payout = Swarm wallet, operazione `getQuote(symbol)`. **Publish** | "Prima il manifest tecnico su Swarm, poi la listing su Arkiv con prezzo e wallet. Sempre in quest'ordine." |
| 1:35 | successo | Click su link Swarm gateway + Arkiv explorer | "Byte reali su Swarm, entità e transazione reali su Tiramisu." |
| 1:45 | `/marketplace` (client) | Apri il servizio | "Ogni card è una query live su Arkiv. Zero cache." |
| 1:55 | pagina servizio | **Buy access** dal Swarm wallet: pay → confirm → mint | "USDC su Avalanche direttamente al provider. Il server verifica la transazione on-chain e conia un pass a scadenza su Arkiv." |
| 2:10 | stessa pagina | **Try the bot** → `getQuote` / `BTC` → *Pass verified on Arkiv ✓* | "Ogni risposta inizia con una lettura del pass. Scaduto = cancellato = negato." |
| 2:20 | `/provider` (provider) | Earnings, vendite recenti, wallet +0.50 USDC | "Le ricevute di vendita sono permanenti su Arkiv; i fondi sono già nel wallet del provider." |

Se il tempo stringe: salta la pubblicazione (1:15–1:35) e usa il servizio pre-pubblicato.
Guadagni 20 secondi e la parte più rischiosa della demo sparisce.

## 2:30 – 3:00 · Perché conta e chiusura

> Tutto quello che avete visto è reale: identità, storage, registro e pagamento
> sono su tre reti pubbliche, senza un solo record nel nostro backend.
> Il contratto `APIritivoPayments` è deployato su Fuji con 28 test Foundry:
> revenue per servizio leggibile on-chain.
>
> Per un provider significa vendere un'API con un form, senza scrivere una riga
> di codice di autenticazione: c'è un gateway che verifica il pass e inoltra la chiamata.
> Per un agente significa scoprire, pagare e chiamare un servizio in tre passaggi,
> tutti verificabili.
>
> Il prossimo passo è un SDK: una singola `fetch` che cerca su Arkiv, paga e chiama con il pass.
> APIritivo. Le API si servono da sole.

---

## Piano B

- Popup Swarm ID bloccato → la card di login mostra il retry. Non usare Brave.
- Upload Swarm ID fallisce → fallback automatico sul gateway diretto, nessuna azione.
- USDC insufficienti → link ai faucet dentro il pannello di acquisto (meglio verificarlo prima).
- Arkiv lento nella conferma → parla del contratto su Snowtrace mentre attendi.
- Se tutto si blocca: il servizio pre-pubblicato ha già un pass valido nel profilo client, vai dritto a **Try the bot**.

## Numeri da tenere a mente

| Cosa | Valore |
| --- | --- |
| Prezzo demo | 0.50 USDC per 7 giorni |
| Contratto Fuji | `0x4e98f464dc8c667e3b0fd3092e0f2d4585702fa3` |
| Test Foundry | 28 |
| Database usati | 0 |
