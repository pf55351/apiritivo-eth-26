# UC-005 Call a purchased API — flow


```mermaid
graph TD
    Service[Service page] --> HasPass{Live pass for me?}
    HasPass -->|no| Buy[[UC-004 Buy access]]
    HasPass -->|yes| TryBot[Try the bot]
    TryBot --> Fill([pick operation, fill inputs])
    Fill --> Run([Run])
    Term[Terminal: call-service.ts] --> Run
    Run --> Verify([server: getEntity + hash check])
    Verify --> OK{Valid?}
    OK -->|401 no key| E1([Missing access pass])
    OK -->|403 expired / wrong| E2([Denied])
    OK -->|yes| Answer[Result + Pass verified on Arkiv ✓]
    E1 --> TryBot
    E2 --> TryBot

    classDef screen fill:#e8e8e8,stroke:#999,stroke-width:2px
    classDef decision fill:#fff3cd,stroke:#ffc107,stroke-width:2px
    classDef action fill:#d4edda,stroke:#28a745,stroke-width:1px
    classDef error fill:#f8d7da,stroke:#dc3545,stroke-width:1px
    classDef chain fill:#e7f1ff,stroke:#0d6efd,stroke-width:1px
```
