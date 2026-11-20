# TASK 5H.10 — CORRECTED TEST ENVIRONMENT ARCHITECTURE
**Corrected Specs:** 20M-cell workbook limit (`support.google.com/drive/answer/37603`), `SpreadsheetApp` quotas (`6 min/exec`, `30 simultaneous/user`, `50k Properties/day`), and `USER_DEPLOYING` + `ANYONE_ANONYMOUS` access model (isolated test only).

```mermaid
flowchart LR
  subgraph Local["Local CRM Test Process (Single-Instance, SAFE_MODE_FORCE_SUPPRESS=true)"]
    A["Next.js CRM (GOOGLE_SHEETS_TRANSPORT_MODE=APPS_SCRIPT_GATEWAY)"]
    B["HMAC Signer (${timestampMs}.${requestId}.${payloadJson})"]
  end
  subgraph AppsScript["AVANI_AI_CRM_TEST_GATEWAY (USER_DEPLOYING + ANYONE_ANONYMOUS)"]
    C["64KB Cap -> Clock Skew <=300s -> Constant-Time HMAC -> CacheService Nonce (Best-Effort)"]
    D["ALLOWED_SPREADSHEET_ID -> EXPECTED_TABS -> LockService.waitLock(10000) -> Formula Guard"]
  end
  subgraph Sheet["AVANI_AI_CRM_ISOLATED_TEST (Restricted Sharing, 20M Cell Cap, 9 Tabs, TEST_* Data)"]
    E["CUSTOMERS | LEADS | APPLICATIONS | FOLLOWUPS | CONSENTS | MESSAGE_EVENTS | WEBHOOK_EVENTS | ADVISORS | SYSTEM_CONFIG"]
  end
  A --> B -->|"HTTPS POST JSON Envelope (Confidential /exec URL)"| C --> D --> E
```
