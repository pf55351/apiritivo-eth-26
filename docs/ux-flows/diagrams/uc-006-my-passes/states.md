# UC-006 Review my passes and expiry — states


```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Empty: 0 passes
    Loading --> Listed: n passes + block timing
    Loading --> Error: RPC error
    Error --> Loading: Refresh
    Listed --> Listed: countdown ticks
    Listed --> Loading: Refresh
    Empty --> Loading: Refresh
```
