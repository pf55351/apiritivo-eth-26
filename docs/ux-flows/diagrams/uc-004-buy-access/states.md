# UC-004 Buy access to a service — states


```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Approving: Buy access
    Approving --> Paying: approve mined
    Approving --> Failed: rejected
    Paying --> Confirming: buy sent
    Paying --> Failed: rejected / reverted
    Confirming --> Minting: receipt ok
    Minting --> Done: 201 pass + sale
    Minting --> MintFailed: 402 / 409 / 502
    Failed --> Idle: try again
    MintFailed --> Idle: retry (same tx is safe)
    Done --> [*]
```
