# UC-001 Sign in with Swarm ID and choose a role — sequence


```mermaid
sequenceDiagram
    actor User
    participant App
    participant SID as Swarm ID (iframe + popup)
    participant LS as localStorage

    User->>App: click Enter with Swarm ID
    App->>SID: open dialog (iframe already mounted)
    User->>SID: click SDK button → popup
    alt popup blocked
        App-->>User: "Nothing appeared?" + retry
    else identity chosen
        SID-->>App: connectionInfo {identity, canUpload, uploadMode}
        App->>SID: deriveAppSecret("apiperitivo:wallet:v1")
        SID-->>App: 32-byte secret → EVM address
        App->>SID: deriveAppSecret("apiritivo:pass-crypt:v1")
        SID-->>App: 32-byte key (pass secrets)
        App->>LS: read role for identity id
        alt no role
            App-->>User: Role chooser
            User->>App: pick Client / Provider
            App->>LS: store role
        end
        App-->>User: Marketplace or Provider
    end
```
