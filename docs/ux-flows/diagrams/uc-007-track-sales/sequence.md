# UC-007 Track sales and verify on Arkiv — sequence


```mermaid
sequenceDiagram
    actor Creator
    participant App
    participant Fuji
    participant Arkiv
    participant DE as Arkiv Data Explorer

    Creator->>App: open Provider
    App->>Arkiv: service where provider_id = me · sale where provider_id = me
    Arkiv-->>App: listings, receipts → earnings = Σ paid_usdc
    App->>Fuji: watchContractEvent(Purchased, provider = my payout) every 4 s
    Fuji-->>App: new log
    App-->>Creator: toast New sale
    App->>Arkiv: re-query sales
    Creator->>DE: open receipt ($key = key(saleKey))
    DE-->>Creator: buyer_id, buyer_address, tx_hash, paid_usdc, pass_key
```
