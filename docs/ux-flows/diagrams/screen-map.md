# Master screen map

All screens of the web app and how they connect. Nav bar (Marketplace · My passes · Provider) is reachable from every signed-in screen.

```mermaid
graph TD
    Start((Open app)) --> Home[Home / Sign in]
    Home -->|Enter with Swarm ID| Popup[[Swarm ID popup]]
    Popup -->|identity| Role{Role stored?}
    Role -->|no| RoleChooser[Role chooser]
    Role -->|yes, client| Marketplace[Marketplace]
    Role -->|yes, provider| Provider[Provider dashboard]
    RoleChooser -->|Client| Marketplace
    RoleChooser -->|Provider| Provider

    Marketplace -->|open card| Service[Service page]
    Service --> TryBot[Try the bot]
    Service -->|Buy access| Service
    Passes[My passes] -->|Open service| Service

    Provider -->|Publish a service| Publish[Publish form]
    Publish -->|Publish| Success[Publish success]
    Success -->|Open service| Service
    Success -->|Back| Provider
    Provider --> Wallet[Wallet panel]

    Marketplace -.nav.- Passes
    Passes -.nav.- Provider

    classDef screen fill:#e8e8e8,stroke:#999,stroke-width:2px
    classDef decision fill:#fff3cd,stroke:#ffc107,stroke-width:2px
    classDef action fill:#d4edda,stroke:#28a745,stroke-width:1px
    classDef error fill:#f8d7da,stroke:#dc3545,stroke-width:1px
    classDef chain fill:#e7f1ff,stroke:#0d6efd,stroke-width:1px
    class Home,RoleChooser,Marketplace,Service,TryBot,Passes,Provider,Publish,Success,Wallet screen
    class Role decision
```

External proof pages (open in a new tab, not part of the app): Arkiv Data Explorer (listing, pass, receipt), Tiramisu block explorer (Arkiv tx, writer balance), Snowtrace (payment, claim, send), Swarm gateway (manifest bytes).
