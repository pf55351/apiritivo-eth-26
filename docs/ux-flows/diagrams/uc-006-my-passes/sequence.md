# UC-006 Review my passes and expiry — sequence


```mermaid
sequenceDiagram
    actor Buyer
    participant App
    participant Arkiv
    participant SID as Swarm ID key

    Buyer->>App: open My passes
    App->>Arkiv: select access_pass where app, entity_type, buyer_id = me
    App->>Arkiv: getBlockTiming()
    Arkiv-->>App: entities + {currentBlock, blockDuration}
    App->>App: secondsLeft = (expiresAtBlock − currentBlock) × blockDuration
    App-->>Buyer: rows with countdown
    Buyer->>App: Copy API key
    App->>SID: decrypt encryptedSecret with K_buyer
    App-->>Buyer: clipboard = <passKey>.<secret>
```
