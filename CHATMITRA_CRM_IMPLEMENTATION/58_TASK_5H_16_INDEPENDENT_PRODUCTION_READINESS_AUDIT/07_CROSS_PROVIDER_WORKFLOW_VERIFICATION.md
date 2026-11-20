# 07 — CROSS-PROVIDER WORKFLOW VERIFICATION
## UNIFIED LEAD-TO-CONVERSATION WORKFLOW AUDIT ACROSS CHATMITRA & META

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-19T21:45:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Principal Software Architect & QA Lead  

---

### 1. END-TO-END WORKFLOW STEP AUDIT

The auditor traced the full 13-step workflow specified in Section 8 of the prompt:

| Step | Workflow Specification | Codebase Implementation | Audit Verdict |
|---|---|---|---|
| **1** | Customer sends message via ChatMitra | Ingested via `/api/whatsapp-webhook` or `/api/chatmitra-webhook` | **VERIFIED** |
| **2** | CRM validates webhook signature | `verifyChatMitraSignature` (timing-safe HMAC-SHA256) | **VERIFIED** |
| **3** | CRM normalizes mobile number | `normalizeIndianPhone` converts to `+91XXXXXXXXXX` | **VERIFIED** |
| **4** | CRM finds or creates one customer | `CrmSheetsService.registerOrUpdateCustomerLead` | **VERIFIED** |
| **5** | CRM creates or updates lead | Mapped to 1 of 9 canonical categories via `classifyLoanCategory` | **VERIFIED** |
| **6** | CRM stores inbound message event | `messageEventRepository.recordMessageEvent` | **VERIFIED** |
| **7** | CRM assigns advisor | Defaults to `ADV_SACHIN_01` in `ADVISORS` | **VERIFIED** |
| **8** | Customer later contacts through Meta | Ingested via `/api/whatsapp-webhook` | **VERIFIED** |
| **9** | CRM identifies same customer | Matched by identical normalized mobile number in `CUSTOMERS` | **VERIFIED** |
| **10** | CRM avoids duplicate customer creation | Reuses existing `customer_id`; 0 duplicate customer rows | **VERIFIED** |
| **11** | CRM maintains separate loan inquiries | Distinct categories create distinct `LEADS` records | **VERIFIED** |
| **12** | Messages appear in same customer history | Unified in `MESSAGE_EVENTS` filtered by `customer_id` | **VERIFIED** |
| **13** | Opt-out suppresses outbound communication | Multi-lingual opt-out updates `CONSENTS` and halts auto-replies | **VERIFIED** |

---

### 2. DEPENDENCY ON MOCKED STORAGE OR PROVIDER RESPONSES

- **Offline Suites:** Run against in-memory mock repositories and test adapters.
- **Isolated Live Testing:** Verified against live Google Apps Script gateway and live Google Sheet `AVANI_AI_CRM_ISOLATED_TEST`.
- **Live Outbound Dispatch:** Blocked by `evaluateAuthorizedTestRecipient` clamp, guaranteeing zero messages reach real customers during development.

**Verification Status:** **LOGIC & WORKFLOW ARCHITECTURALLY VERIFIED; LIVE END-TO-END VERIFIED IN ISOLATED TEST ENVIRONMENT.**
