# UC-008 Claim earnings and move funds — states


```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Claiming: Claim to my Swarm wallet
    Claiming --> Idle: Claimed event, balances refreshed
    Claiming --> ClaimError: no gas / reverted
    ClaimError --> Idle: dismiss
    Idle --> Sending: Send USDC
    Sending --> Idle: transfer mined
    Sending --> SendError: invalid / reverted
    SendError --> Idle: dismiss
```
