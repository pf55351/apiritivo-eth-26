# Sicurezza, limiti e verifiche

## Invarianti

| Rischio | Regola da implementare | Prova mirata |
|---|---|---|
| Consumer falsificato | Subject da firma verificata; mai da un header identità libero | Firma/nonce alterati rifiutati |
| Replay di login | Nonce monouso con scadenza e audience | Secondo uso rifiutato |
| Pagamento riutilizzato | Registro durevole indipendente dal TTL del pass | Vecchia tx non crea un pass nuovo dopo expiry |
| Doppio incasso | Unicità intenzione nel contratto | Doppio click non trasferisce altri fondi |
| Pass contraffatto | Creator, owner, subject, piano e manifest verificati | Record copiato da altro wallet rifiutato |
| Termini cambiati | Piano immutabile e manifest vincolato all’acquisto | Catalogo aggiornato non modifica un pass attivo |
| Cache oltre expiry | Query fresca per ogni invocazione | Prima passa, dopo expiry blocca |
| Errore RPC mascherato | Stato non verificabile → 503 senza inoltro | RPC interrotto, provider non chiamato |
| Bypass gateway | Upstream autenticato e credenziali solo server | Chiamata diretta senza credenziale rifiutata |
| SSRF tramite input | Allowlist upstream, redirect controllati, schema input | URL/rete privata non raggiungibili dal client |
| Costi incontrollati | Rate limit, concorrenza, input e timeout dichiarati | Sovraccarico rifiutato prima dell’upstream |
| Segreti nei dati pubblici | Redazione log, cifratura e separazione referenze/chiavi | Bundle, evidence e payload pubblici ispezionati |

## Rate limit e concorrenza

Limiti per pass e operation, più un limite globale per provider. Un soggetto non deve aggirare le protezioni del provider aprendo molte connessioni. Riservare la capacità atomicamente nel processo unico e rilasciare gli slot a ogni esito; gestire anche disconnessioni e timeout.

Un rate limit in memoria si resetta al riavvio: è accettabile solo se dichiarato e affiancato ai limiti globali dell’upstream. Per limiti che devono persistere, usare lo storage operativo. Con più repliche serve un coordinamento condiviso.

I limiti non generano addebiti aggiuntivi e non riducono un contatore di chiamate acquistate. Un piano privo di limiti sostenibili non viene pubblicato.

## Privacy e controllo dei dati

Manifest pubblici privi di segreti. Subject e prove onchain possono essere collegabili: non promettere anonimato. Il gateway vede gli input che inoltra; la cifratura del risultato archiviato non rende privata l’elaborazione upstream.

Salvare solo metadati minimi di uso. Niente payload completi per default. Il consumer decide quali risultati archiviare; cifratura prima dell’upload per i dati privati, con chiavi sotto il suo controllo. I test pubblici usano dati sintetici.

Una referenza cifrata Swarm può includere materiale di decifratura. Il vault deve distinguerla da un hash pubblico prima di costruire link, log o record Arkiv. La conservazione dipende dal finanziamento dello storage: nessuna promessa di permanenza indefinita.

La scadenza del pass blocca nuove chiamate. Non cancella copie già scaricate, non revoca conoscenze acquisite e non garantisce la sparizione di dati storici pubblici.

## Confini dell’MVP

Issuer, gateway e provider rimangono fidati. Le ricevute d’uso sono attestazioni dell’issuer/gateway; il pagamento è verificabile su Fuji. La soluzione non certifica il risultato dell’API e non offre settlement atomico con Arkiv.

Il provider deve essere autorizzato a offrire il servizio tramite APIritivo e dichiarare eventuali restrizioni sui risultati. La selezione di 2–3 provider si chiude dopo gli spike, senza introdurre un proxy aperto o un servizio di scraping arbitrario nell’MVP.

## Verifica minima prima della demo

Test contratto su importi, fee, piani disattivati e doppia intenzione; test integrazione su auth, pagamento contraffatto e crash del worker; test del confine di scadenza sulla rete Arkiv; test del provider protetto e dei limiti concorrenti; upload/retrieval Swarm effettivo. La sola simulazione locale non costituisce prova dell’integrazione sponsor.
