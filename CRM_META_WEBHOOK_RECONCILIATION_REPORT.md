# AVANI AI CRM — META BUSINESS & WEBHOOK RECONCILIATION REPORT
**Audit Date:** 31 October 2026  
**Application:** AVANI AI CRM  
**Organization:** AVANI LOAN SERVICES  
**Authoritative WABA ID:** `1062614709598311`  
**Phone Number ID:** `1147494668457940`  
**Sender Number:** `+91 72491 08474`

---

## 1. META ASSET & ENDPOINT RECONCILIATION

The AVANI AI CRM architecture supports both direct Meta Cloud API integration and intermediate BSP (ChatMitra) integration:

| Channel / Feature | Provider Service | Target Webhook Callback URL | Authentication & Verification Method |
| :--- | :--- | :--- | :--- |
| **ChatMitra Events** | ChatMitra BSP | `https://avani-ai-crm.vercel.app/api/chatmitra-webhook` | HMAC-SHA256 (`x-webhook-signature` or `x-hub-signature-256`) |
| **ChatMantra Legacy**| ChatMantra Alias | `https://avani-ai-crm.vercel.app/api/chatmantra-webhook` | HMAC-SHA256 (`x-webhook-signature`) |
| **Direct Meta WABA** | Meta Cloud API | `https://avani-ai-crm.vercel.app/api/whatsapp-webhook` | Meta App Secret Proof & HMAC-SHA256 (`x-hub-signature-256`) |
| **Meta Lead Ads** | Facebook / IG Ads | `https://avani-ai-crm.vercel.app/api/meta-webhook` | Meta Webhook Verify Token + `x-hub-signature-256` |
| **Voice AI Calls** | Omnidim | `https://avani-ai-crm.vercel.app/api/omnidim-webhook` | Bearer Token / Webhook Secret |

---

## 2. WEBHOOK HANDSHAKE & VERIFICATION RECONCILIATION

### 1. Subscription Challenge (GET Request):
Both ChatMitra and Meta utilize the standard Hub subscription handshake:
```http
GET /api/chatmitra-webhook?hub.mode=subscribe&hub.challenge=1158201236&hub.verify_token=avani_verify_token
```
- **Handler Implementation:** Validates that `hub.mode === 'subscribe'` and `hub.verify_token` matches configured environment secret.
- **Preview Runtime Test:** Verified live on `avani-ai-bmlvrna3z...app`, returning HTTP 200 with raw challenge string.

### 2. Event Dispatch (POST Request):
Incoming events are verified against potential payload forgery:
- Computes SHA256 HMAC of raw request body.
- Uses `crypto.timingSafeEqual` to avoid side-channel timing attacks.
- Enforces `readyState === 1` on MongoDB before returning HTTP 200. If the database is offline, returns **HTTP 503**, causing the provider to retry delivery rather than discarding the message.

---

## 3. ASSET PRESERVATION & MIGRATION RULES

To prevent any disruption to live customer inquiries or marketing campaigns:
1. **Never Delete Existing Webhooks:** The legacy `/api/whatsapp-webhook` route must remain active alongside `/api/chatmitra-webhook`.
2. **Never Unregister Phone Numbers:** The phone number ID `1147494668457940` must remain permanently registered under WABA `1062614709598311`.
3. **Dual Subscription During Canary:** During initial testing, configure ChatMitra to forward delivery statuses while leaving Meta Lead Ads subscribed to `/api/meta-webhook`.

---

## 4. RECONCILIATION CONCLUSION

The webhook endpoints are properly segregated, timing-safe, and backward-compatible.
