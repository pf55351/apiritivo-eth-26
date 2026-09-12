# UC-008 Claim earnings and move funds — flow


```mermaid
graph TD
    Prov[Provider dashboard] --> Wallet[Wallet panel]
    Wallet --> Mode{Contract mode?}
    Mode -->|no| Send
    Mode -->|yes| Claimable{claimable > 0?}
    Claimable -->|no| Wait([button disabled])
    Claimable -->|yes| Claim([Claim to my Swarm wallet])
    Claim --> Gas{AVAX for gas?}
    Gas -->|no| Faucet[[UC-003 AVAX faucet]]
    Faucet --> Wallet
    Gas -->|yes| ClaimTx([claim(swarmWallet, 0)])
    ClaimTx --> Claimed[USDC in Swarm wallet · tx link]
    Claimed --> Send([Send USDC: destination + amount])
    Send --> SendTx([USDC transfer])
    SendTx --> Done>Funds in MetaMask / anywhere]
    Wallet --> Reveal([Reveal private key])

    classDef screen fill:#e8e8e8,stroke:#999,stroke-width:2px
    classDef decision fill:#fff3cd,stroke:#ffc107,stroke-width:2px
    classDef action fill:#d4edda,stroke:#28a745,stroke-width:1px
    classDef error fill:#f8d7da,stroke:#dc3545,stroke-width:1px
    classDef chain fill:#e7f1ff,stroke:#0d6efd,stroke-width:1px
```
