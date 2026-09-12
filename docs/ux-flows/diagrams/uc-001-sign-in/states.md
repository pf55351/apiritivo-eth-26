# UC-001 Sign in with Swarm ID and choose a role — states


```mermaid
stateDiagram-v2
    [*] --> SignedOut
    SignedOut --> Connecting: click Enter with Swarm ID
    Connecting --> PopupBlocked: no popup within timeout
    PopupBlocked --> Connecting: retry
    Connecting --> SignedOut: popup closed
    Connecting --> Connected: identity received
    state Connected {
        [*] --> DerivingWallet
        DerivingWallet --> WalletReady: secret derived
        DerivingWallet --> WalletError: SDK error
        WalletError --> DerivingWallet: retry
    }
    Connected --> RoleChoice: no stored role
    Connected --> Routed: stored role
    RoleChoice --> Routed: pick role
    Routed --> SignedOut: sign out
```
