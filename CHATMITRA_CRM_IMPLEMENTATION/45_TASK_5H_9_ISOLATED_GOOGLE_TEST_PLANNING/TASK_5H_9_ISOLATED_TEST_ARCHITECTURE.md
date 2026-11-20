# TASK 5H.9 — ISOLATED TEST ARCHITECTURE
**Proposed Environment:** `GOOGLE_SHEETS_TEST` (100% Isolated from Production)

---

## 1. Proposed Naming & Isolation Convention (Not Created Yet)
- **Test Spreadsheet:** `AVANI_AI_CRM_ISOLATED_TEST`
- **Apps Script Project:** `AVANI_AI_CRM_TEST_GATEWAY` (bound to `AVANI_AI_CRM_ISOLATED_TEST`)
- **Synthetic Record Prefixes:** `TEST_CUST_`, `TEST_AVL_`, `TEST_APP_`, `TEST_FUP_`, `TEST_EVENT_`
- **Test Secret Scope:** Dedicated test-only `GOOGLE_SHEETS_GATEWAY_SECRET` (>=32 chars, never shared with production)

## 2. Isolated Architecture Diagram

```mermaid
flowchart LR
  subgraph Local["Local CRM Test Client (GOOGLE_SHEETS_TEST)"]
    C["Next.js CRM + GoogleSheetsClient"]
    S["HMAC Signer (${timestampMs}.${requestId}.${payloadJson})"]
    M["sheetsWriteMutex + Outbound Safe Mode Suppress"]
  end

  subgraph GoogleTest["Isolated Google Test Boundary (₹0)"]
    G["AVANI_AI_CRM_TEST_GATEWAY (Apps Script doPost)"]
    V["64KB Cap + Clock Skew (300s) + Constant-Time HMAC"]
    N["CacheService Nonce Check + ALLOWED_SPREADSHEET_ID"]
    L["LockService.waitLock(10000) + Tab/Formula Guards"]
    T["AVANI_AI_CRM_ISOLATED_TEST (9 Tabs, TEST_* Synthetic Data Only)"]
  end

  subgraph Prod["Production Boundary (INACCESSIBLE / BLOCKED)"]
    P["Production DB / Live Customers / Live WhatsApp"]
  end

  C --> M --> S -->|"HTTPS POST JSON Envelope"| G
  G --> V --> N --> L --> T
  Local -.->|"Strictly Prohibited"| Prod
  GoogleTest -.->|"Zero Access"| Prod
```
