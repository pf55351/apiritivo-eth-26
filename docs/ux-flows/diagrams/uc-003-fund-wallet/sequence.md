# UC-003 Fund the Swarm wallet — sequence


```mermaid
sequenceDiagram
    actor Buyer
    participant App
    participant Faucets as AVAX + USDC faucets
    participant Fuji

    App-->>Buyer: Swarm wallet address + balances (USDC 0 · AVAX 0)
    Buyer->>Faucets: paste address, request funds
    Faucets->>Fuji: transfer AVAX / USDC
    loop until funded
        Buyer->>App: refresh
        App->>Fuji: getBalance + USDC balanceOf
        Fuji-->>App: balances
    end
    App-->>Buyer: Buy access enabled
```
