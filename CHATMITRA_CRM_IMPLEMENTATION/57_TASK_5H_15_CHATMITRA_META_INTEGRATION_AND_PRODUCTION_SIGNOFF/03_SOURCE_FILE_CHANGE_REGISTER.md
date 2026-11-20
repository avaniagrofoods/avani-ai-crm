# 03 — SOURCE FILE CHANGE REGISTER
## AUDITED APPLICATION SOURCE INVENTORY & CODE CHANGE EVIDENCE

**Document Version:** 1.0.0  
**Date:** 2026-11-19T21:20:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Lead Software Architect & QA Lead  
**Repository:** `https://github.com/avaniagrofoods/avani-ai-crm.git` (branch `main`)  

---

### 1. CODEBASE INVENTORY ACROSS WEBHOOK & CRM MODULES

| Component Path | Function & Role | Lines of Code | Verification Status |
|---|---|---|---|
| `src/app/api/whatsapp-webhook/route.ts` | Dual-provider inbound webhook handler (ChatMitra & Meta) | 402 | **VERIFIED & TESTED** |
| `src/app/api/whatsapp-webhook-worker/route.ts` | Async webhook worker, CRM entity resolution, opt-out guard | 344 | **VERIFIED & TESTED** |
| `src/app/api/chatmitra-webhook/route.ts` | Dedicated ChatMitra endpoint with verification handshake | 219 | **VERIFIED & TESTED** |
| `src/lib/chatmitra.ts` | ChatMitra official API adapter, payload validator, signature verifier | 409 | **VERIFIED & TESTED** |
| `src/lib/optout-engine.ts` | Multi-lingual regex engine (English, Hindi, Marathi keywords) | 120 | **VERIFIED & TESTED** |
| `src/lib/message-status.ts` | Monotonic status progression validator (`sent` $\rightarrow$ `delivered` $\rightarrow$ `read`) | 85 | **VERIFIED & TESTED** |
| `src/lib/google-sheets/sheet-schema.ts` | Canonical 9-tab schema definitions and column validator | 227 | **VERIFIED & TESTED** |
| `src/lib/google-sheets/client.ts` | Apps Script HMAC-SHA256 client with backoff retry logic | 175 | **VERIFIED & TESTED** |
| `src/lib/google-sheets/service.ts` | CRM business entity operations (`CUSTOMERS`, `LEADS`, `CONSENTS`) | 310 | **VERIFIED & TESTED** |
| `src/lib/db/database-isolation.ts` | DNS-SRV production cluster blocker for MongoDB isolation | 145 | **VERIFIED & TESTED** |

---

### 2. PRESERVATION OF EXISTING PRE-TASK FUNCTIONALITY

All modifications strictly preserve:
1. **Zero MongoDB Customer Data Fallback:** Inbound leads fail safely with HTTP 503 if Google Sheets is unavailable, preserving master data sovereignty.
2. **Zero Inbound Media Storage:** Media attachments are rejected at the worker level under Task 5H.4 data minimisation rules.
3. **Backup Parity:** All `.bak` files created in prior tasks (`.bak.pre_task5h4`, `.bak.pre_task5h7`) remain completely intact in the repository.
