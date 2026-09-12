# APIperitivo

Marketplace per acquistare accesso temporaneo a API premium: un pagamento, una finestra di utilizzo, nessun addebito per singola chiamata.

Avalanche Fuji regola il pagamento in test USDC, Arkiv conserva il pass con scadenza nativa e Swarm ospita manifest, ricevute e risultati archiviati dall’utente. Swarm ID gestisce l’identità e l’accesso allo storage personale.

## Stato del progetto

Sono disponibili analisi dei bounty, architettura, struttura proposta del codice, modello dati, flussi, specifiche delle interfacce e piano MVP. Applicazioni, contratti e integrazioni devono ancora essere implementati.

## Da dove iniziare

- [Analisi del progetto e dei bounty ETHRome](APIPERITIVO_ANALISI.md)
- [Indice dell’architettura](architettura/README.md)
- [Struttura proposta del codice](architettura/03-struttura-progetto.md)
- [Piano di implementazione e prove per la demo](architettura/08-piano-mvp-e-bounty.md)

## Contenuto attuale

```text
APIperitivo/
├── README.md
├── APIPERITIVO_ANALISI.md
└── architettura/
    ├── README.md
    ├── 01-prodotto-e-scope.md
    ├── 02-architettura-sistema.md
    ├── 03-struttura-progetto.md
    ├── 04-modello-dati.md
    ├── 05-flussi-e-stati.md
    ├── 06-api-e-contratto.md
    ├── 07-sicurezza-e-limiti.md
    └── 08-piano-mvp-e-bounty.md
```

Il nome pubblico è **APIperitivo**; il namespace tecnico proposto è `apiperitivo`.
