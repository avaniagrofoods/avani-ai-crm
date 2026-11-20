# 07 — AVANI AI CRM AUDIT REPORT
## CRM APPLICATION ARCHITECTURE, DATA LAYER & CLIENT ISOLATION

**Document Version:** 1.0.0  
**Date:** 2026-11-19T17:15:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Senior CRM Integration Architect & Data Protection Auditor  

---

### 1. APPLICATION DATA LAYER ARCHITECTURE

The AVANI AI CRM data layer operates with strict data sovereignty rules:

```
[Inbound Webhook / Public Form / Partner Desk]
                     │
                     ▼
       [CRM Application Data Router]
                     │
     ┌───────────────┴───────────────┐
     ▼                               ▼
[Google Sheets Client]    [Database Isolation Guard]
  (src/lib/google-sheets)    (src/lib/db/database-isolation.ts)
     │                               │
     ▼                               ▼
[Apps Script Gateway]     [BLOCKS MongoDB Writes for Customer Data]
  (HMAC-SHA256 Auth)        (Zero Silent MongoDB Fallback)
     │
     ▼
[AVANI_AI_CRM_ISOLATED_TEST]
  (9 Canonical Worksheets)
```

---

### 2. CORE CRM CLIENT MODULES AUDITED

1. **`src/lib/google-sheets/client.ts`:**
   - Implements robust HTTPS POST communication with Google Apps Script Web App.
   - Computes canonical signature string: `${timestampMs}.${requestId}.${payloadJson}`.
   - Includes automatic retry with exponential backoff on HTTP 429 / 5xx errors.
2. **`src/lib/google-sheets/sheet-schema.ts`:**
   - Authoritative source of truth for all 9 worksheet tab names and column arrays.
   - Rejects any mismatch in column sequence, casing, or extra unexpected columns.
3. **`src/lib/google-sheets/service.ts`:**
   - Provides business operations: `upsertCustomer`, `upsertLead`, `recordApplication`, `recordFollowup`, `recordConsent`, `recordMessageEvent`.
4. **`src/lib/db/database-isolation.ts`:**
   - Hard blocks connections to production MongoDB clusters (`rhpn2gh.mongodb.net`) in non-production environments.
   - Enforces DNS-SRV resolution check and blocks rogue external nodes.

---

### 3. CRM FAILURE & RESILIENCE AUDIT

| Failure Mode Simulated | System Handling & Defense | Test Status |
|---|---|---|
| **Gateway Unavailable / Network Timeout** | Throws typed `GOOGLE_SHEETS_NETWORK_ERROR`; triggers 3x backoff retry. | **PASS** |
| **Invalid HMAC Signature** | Gateway returns HTTP 401 `GATEWAY_SIGNATURE_MISMATCH`; request dropped. | **PASS** |
| **Timestamp Replay (> 300s drift)** | Gateway returns HTTP 400 `GATEWAY_TIMESTAMP_EXPIRED`; replay defeated. | **PASS** |
| **Sheet Schema Header Mismatch** | Schema validator detects column deviation; halts write to protect integrity. | **PASS** |
| **Duplicate Event Ingestion** | Primary key lookup via `INSERT_IF_ABSENT` skips row; zero duplicate rows. | **PASS** |
| **LockService Timeout** | Gateway attempts LockService acquisition up to 10s before returning error. | **PASS** |

**Audit Verdict:** **STAGE C6 AND E-SERIES CRM MODULES COMPLETED AND VERIFIED.**
