# AVANI AI CRM — PROVIDER CAPABILITY & INTEGRATION MATRIX
**Audit Date:** 31 October 2026  
**Application:** AVANI AI CRM  
**Organization:** AVANI LOAN SERVICES

---

## 1. COMPREHENSIVE PROVIDER CAPABILITY MATRIX

The AVANI AI CRM incorporates a multi-tiered provider architecture managed centrally through `src/lib/provider-router.ts`.

| Capability / Attribute | ChatMitra (Primary) | AiSensy (Rollback) | Meta Cloud API (Direct) | Twilio (SMS/WhatsApp Fallback) | Omnidim (Voice AI) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Role in Architecture** | **Primary Outbound/Inbound** | **Immediate Rollback** | **Direct Cloud Fallback** | **Emergency Outbound** | **Automated Loan Calling** |
| **Active Selection Flag** | `WHATSAPP_PROVIDER=CHATMITRA` | `WHATSAPP_PROVIDER=AISENSY` | `WHATSAPP_PROVIDER=META_CLOUD` | Dynamic Code Fallback | `OMNIDM_LIVE_ENABLED=true` |
| **Protocol** | HTTPS REST JSON | HTTPS REST JSON | Graph API v20.0 | HTTPS REST Basic Auth | Webhook / SIP Trunk |
| **Authentication** | Bearer API Key | Body `apiKey` | Bearer System Token | Basic Auth SID:Token | API Secret Header |
| **Webhook Signature** | HMAC-SHA256 (`timingSafeEqual`) | None (Unsigned) | HMAC-SHA256 (`x-hub-sig`) | HMAC-SHA1 (`X-Twilio-Sig`) | Bearer Token / Secret |
| **Template Support** | Multi-param array | Fixed campaign name | Component parameters | Body text only | Text-to-Speech Script |
| **Direct Text (Session)** | Yes | No (Campaign Only) | Yes (24h window) | Yes | N/A |
| **Media Attachments** | PDF, Image, Video | Image, PDF | All MIME types | MediaUrl parameter | Audio Stream |
| **Idempotency Enforcement**| ProviderRouter Lock | ProviderRouter Lock | Client ID Deduplication | Twilio SID Ledger | Call UUID Lock |
| **Mock Safety Interceptor**| Native Mock Provider | Native Mock Provider | Mock Guard | Mock Guard | Guard (`OMNIDM_LIVE_ENABLED`)|
| **Fail-Closed DB Guard** | Yes (HTTP 503) | Yes (HTTP 503) | Yes (HTTP 503) | Yes (HTTP 503) | Yes (HTTP 503) |

---

## 2. CENTRAL DISPATCH RESOLUTION ORDER

In `src/lib/provider-router.ts`, provider selection follows a deterministic priority order:

```
Options Override (options.provider)
       │
       ▼ (if null)
Process Environment (WHATSAPP_PROVIDER)
       │
       ▼ (if undefined)
Default Constant: 'CHATMITRA'
```

### Supported Provider Keys:
1. `CHATMITRA` (or alias `CHATMANTRA`): Dispatches via `sendChatMitraMessage`
2. `AISENSY`: Dispatches via `sendAiSensyWhatsApp` (Preserved rollback option)
3. `META_CLOUD`: Dispatches via direct Graph API `messages` endpoint

---

## 3. FAILOVER & CIRCUIT BREAKER RULES

1. **Balance Exhaustion:** If a provider returns a balance exhaustion error (e.g., AiSensy wallet depleted), the status is tagged as `BALANCE_BLOCKED` and the system alerts the operator without thrashing retries.
2. **Transient Network Timeouts:** Retries are queued with exponential backoff (2s -> 4s -> 8s) up to 3 attempts.
3. **Database Unavailability:** If the database `readyState !== 1`, all dispatch operations immediately reject with HTTP 503, preserving uncorrupted transaction ledgers.
