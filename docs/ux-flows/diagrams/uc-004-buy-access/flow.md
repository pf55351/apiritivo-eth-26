# UC-004 Buy access to a service — flow


```mermaid
graph TD
    Market[Marketplace] -->|open| Service[Service page]
    Service --> Funded{USDC and AVAX enough?}
    Funded -->|no| Fund[[UC-003 Fund wallet]]
    Fund --> Service
    Funded -->|yes| Buy([Buy access])
    Buy --> Approve([approve USDC])
    Approve --> BuyTx([buy on contract])
    BuyTx --> Mined{Receipt ok?}
    Mined -->|rejected / reverted| ErrPay([Payment failed, stay])
    ErrPay --> Service
    Mined -->|yes| Secret([generate + encrypt pass secret])
    Secret --> Mint([POST /api/access-passes])
    Mint --> Verified{Purchased event valid?}
    Verified -->|no| ErrVer([402 / 409 with reason])
    ErrVer --> Service
    Verified -->|yes| Unlocked[Access card: Unlocked + API key]
    Unlocked --> TryBot[[UC-005 Try the bot]]

    classDef screen fill:#e8e8e8,stroke:#999,stroke-width:2px
    classDef decision fill:#fff3cd,stroke:#ffc107,stroke-width:2px
    classDef action fill:#d4edda,stroke:#28a745,stroke-width:1px
    classDef error fill:#f8d7da,stroke:#dc3545,stroke-width:1px
    classDef chain fill:#e7f1ff,stroke:#0d6efd,stroke-width:1px
```
