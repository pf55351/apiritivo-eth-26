# UC-007 Track sales and verify on Arkiv — states


```mermaid
stateDiagram-v2
    state Dashboard {
        state "Arkiv lists" as Lists {
            [*] --> ListsLoading
            ListsLoading --> ListsReady: services + sales
            ListsLoading --> ListsEmpty: nothing yet
            ListsReady --> ListsLoading: Refresh / onSale
        }
        --
        state "Fuji watcher" as Watch {
            [*] --> Polling
            Polling --> NewSale: Purchased log
            NewSale --> Polling: toast shown, lists refreshed
            Polling --> Offline: RPC error
            Offline --> Polling: reconnect
        }
    }
```
