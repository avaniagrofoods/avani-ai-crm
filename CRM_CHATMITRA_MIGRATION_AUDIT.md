# AVANI AI CRM — CHATMITRA MIGRATION & ADAPTER FORENSIC AUDIT
**Audit Date:** 31 October 2026  
**Application:** AVANI AI CRM  
**Organization:** AVANI LOAN SERVICES  
**Legacy Provider:** AiSensy (WABA API v2)  
**Target Provider:** ChatMitra (Unified WhatsApp Cloud & Business API)  
**Aliases Supported:** ChatMantra (Full backwards compatibility)

---

## 1. MIGRATION RATIONALE & ARCHITECTURAL ADVANTAGES

AVANI LOAN SERVICES migrated its primary messaging infrastructure from AiSensy to ChatMitra for the following architectural and operational reasons:

1. **Native Webhook Signature Verification:** ChatMitra provides cryptographic HMAC-SHA256 request signing on all inbound events, eliminating the spoofing risks present in legacy token-only webhook handlers.
2. **Deterministic Status Lifecycle:** Inbound status updates follow clean WABA-standard states (`sent` -> `delivered` -> `read` -> `failed`) with exact message IDs.
3. **Multi-Template Parameter Arrays:** Direct support for dynamic loan variables (applicant name, loan amount, monthly EMI, interest rate, branch location).
4. **Idempotency Safeguards:** Integrated deduplication keys prevent double-charging or dual-sending on transient network retries.
5. **Seamless Rollback Guarantee:** The AiSensy integration is preserved 100% intact as a standby adapter, switchable instantly via `WHATSAPP_PROVIDER=aisensy`.

---

## 2. API CONTRACT COMPARISON

| Feature / Capability | Legacy AiSensy Integration | New ChatMitra Integration |
| :--- | :--- | :--- |
| **REST Endpoint** | `https://backend.aisensy.com/campaign/t1/api/v2` | `https://api.chatmitra.com/v2/client/send_template` |
| **Direct Text Dispatch** | Limited to open 24h service session | Supported via `/developer/api/send_message` |
| **Webhook Verification** | Token parameter check only | HMAC-SHA256 (`timingSafeEqual`) |
| **Signature Header** | None | `x-webhook-signature` / `x-hub-signature-256` |
| **Phone Format** | 91XXXXXXXXXX | Normalizes 10-digit, 0-prefix, +91 to 91XXXXXXXXXX |
| **Mock Mode Safety Gate** | Partial | Complete (`PROVIDER_MODE !== 'live'` blocks external HTTP) |
| **Loan Qualification** | Basic regex | 8 Canonical AVANI Loan Products with priority hierarchy |

---

## 3. SECURITY IMPLEMENTATION & TIMING-SAFE HMAC-SHA256

The ChatMitra webhook handler implements strict timing-safe comparison to prevent side-channel timing attacks:

```typescript
export function verifyChatMitraSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;
  try {
    const rawString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = crypto.createHmac('sha256', secret).update(rawString).digest('hex');
    const cleanSignature = signatureHeader.replace(/^sha256=/, '').trim();
    if (cleanSignature.length !== expected.length) return false;

    const signatureBuffer = Buffer.from(cleanSignature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (signatureBuffer.length !== expectedBuffer.length) return false;

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
```

---

## 4. LOAN PRODUCT CLASSIFICATION ENGINE

Inbound messages from prospective borrowers are automatically qualified into AVANI LOAN SERVICES' 8 canonical product categories with strict priority ordering:

1. **Doctor Loan** (MBBS, clinic, hospital, medical practice, pharma, MD, Dr)
2. **Education Loan — Global Studies** (Abroad, overseas, USA, UK, Canada, Germany, Australia, GRE, IELTS)
3. **Education Loan — India** (Tuition, college fees, engineering, MBA, university, study)
4. **School and College Owners Funding** (School owner, campus funding, institutional trust, hostel construction)
5. **Mortgage Loan / Loan Against Property (LAP)** (LAP, mortgage, property, commercial plot)
6. **Home Loan** (Flat, house, apartment, construction, residential)
7. **Business Loan** (MSME, GST, working capital, OD, CC, machinery, firm, pvt ltd)
8. **Personal Loan** (Default catch-all for general financing requests)

---

## 5. BACKWARD COMPATIBILITY VERIFICATION

To prevent breaking existing scripts or documentation referencing "ChatMantra":
1. `src/lib/chatmantra.ts` exports all symbols from `src/lib/chatmitra.ts`.
2. Aliases `formatChatMantraPhone`, `verifyChatMantraSignature`, and `validateChatMantraInboundPayload` are exported.
3. Webhook endpoint `/api/chatmantra-webhook` proxies directly to `/api/chatmitra-webhook`.

---

## 6. MIGRATION ACCEPTANCE RESULTS

The dedicated migration test suite (`tests/test_chatmitra_migration.test.cjs`) verified:
- Phone normalization: PASS
- Signature verification (plain hex & sha256=): PASS
- Tamper detection: PASS
- 8-category qualification: PASS
- Inbound payload validation: PASS
- Central provider resolution: PASS
- Mock safety gate: PASS
- Idempotency formulation: PASS
- Fail-closed DB contract: PASS
- Single-active provider isolation: PASS
- Backward compatibility: PASS
- Config validation: PASS

**Final Result: 12 / 12 TESTS PASSED (100%)**
