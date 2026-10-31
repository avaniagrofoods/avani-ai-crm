# AVANI AI CRM — WEBHOOK INTEGRATION & VERIFICATION EVIDENCE AUDIT
**Audit Date:** 31 October 2026  
**Application:** AVANI AI CRM  
**Organization:** AVANI LOAN SERVICES

---

## 1. WEBHOOK ENDPOINT INVENTORY & ROUTE REGISTRY

The AVANI AI CRM maintains 5 distinct webhook endpoints designed for external provider event ingestion:

| Webhook Route | Provider / Source | Supported Methods | Signature Authentication | Handler Implementation |
| :--- | :--- | :--- | :--- | :--- |
| **`/api/chatmitra-webhook`** | ChatMitra Primary | `GET`, `POST` | HMAC-SHA256 (`timingSafeEqual`)| `src/app/api/chatmitra-webhook/route.ts` |
| **`/api/chatmantra-webhook`**| ChatMantra Alias | `GET`, `POST` | HMAC-SHA256 (`timingSafeEqual`)| `src/app/api/chatmantra-webhook/route.ts` |
| **`/api/whatsapp-webhook`** | Meta Cloud API | `GET`, `POST` | HMAC-SHA256 (`x-hub-sig`) | `src/app/api/whatsapp-webhook/route.ts` |
| **`/api/meta-webhook`** | Meta Lead Ads | `GET`, `POST` | HMAC-SHA256 (`appsecret_proof`)| `src/app/api/meta-webhook/route.ts` |
| **`/api/omnidim-webhook`** | Omnidim Voice AI | `POST` | Webhook Secret / Bearer Auth | `src/app/api/omnidim-webhook/route.ts` |

---

## 2. GET VERIFICATION HANDSHAKE PROTOCOL

When registering webhooks in the ChatMitra dashboard or Meta Developer portal, the platform sends a verification challenge:

```http
GET /api/chatmitra-webhook?hub.mode=subscribe&hub.challenge=CHALLENGE_STRING_12345&hub.verify_token=CONFIGURED_TOKEN
```

### Handler Contract:
- Validates that `hub.mode === 'subscribe'`.
- Compares `hub.verify_token` against `process.env.CHATMITRA_VERIFY_TOKEN`.
- Upon match, returns HTTP 200 with plaintext `CHALLENGE_STRING_12345`.
- Upon mismatch, returns HTTP 403 Forbidden (`Verification token mismatch`).

---

## 3. POST PAYLOAD PROCESSING & TIMING-SAFE HMAC-SHA256

Incoming messages and delivery events are processed through a 4-step security filter:

```
Inbound POST Request
        │
        ▼ Step 1: Missing Signature or Secret Check
[Fail -> HTTP 401 Unauthorized]
        │
        ▼ Step 2: Timing-Safe HMAC-SHA256 Digest Validation
[Fail -> HTTP 401 Invalid Signature]
        │
        ▼ Step 3: Database Readiness Assertion (readyState === 1)
[Fail -> HTTP 503 Database Offline: Schedule Retry]
        │
        ▼ Step 4: Event Deduplication & Atomic Ingestion (Lead / Message Ledger)
[Success -> HTTP 200 { success: true }]
```

### Fail-Closed Database Behavior:
A critical security requirement is that if MongoDB Atlas is temporarily unreachable, the webhook endpoint MUST NOT acknowledge the message with HTTP 200 (which would cause the provider to consider the message delivered and drop it). Instead, it returns **HTTP 503 Service Unavailable**, which instructs ChatMitra / Meta to re-queue and retry the webhook with exponential backoff.

---

## 4. ACCEPTANCE & REGRESSION EVIDENCE

Automated tests across `test_chatmantra_integration.test.cjs` and `test_chatmitra_migration.test.cjs` validated:

1. **Plain Hex Signature Acceptance:** PASS
2. **`sha256=` Prefix Acceptance:** PASS
3. **Tampered Body Mutation Detection:** PASS
4. **Malformed / Truncated JSON Rejection:** PASS (HTTP 400)
5. **Missing Message ID Rejection:** PASS (HTTP 400)
6. **DB Disconnected Fail-Closed Check:** PASS (Returns HTTP 503)
7. **Idempotent Re-delivery Handling:** PASS (Prevents duplicate ledger rows)

**Webhook Security Verification Status: FULLY COMPLIANT**
