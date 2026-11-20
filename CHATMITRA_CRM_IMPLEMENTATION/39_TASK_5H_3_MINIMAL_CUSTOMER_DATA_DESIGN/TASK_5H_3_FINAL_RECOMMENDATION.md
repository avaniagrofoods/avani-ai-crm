# TASK 5H.3 — FINAL RECOMMENDATION & OWNER DECISION REPORT
## MINIMAL CUSTOMER-DATA DATABASE DESIGN FOR MONGODB ATLAS M0 FREE-ONLY ARCHITECTURE
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026 (`2026-11-18`)  
**Execution Mode:** Strictly Read-Only Audit & Design Specification  
**Maximum Cloud Cost:** **₹0.00 INR / $0.00 USD (MongoDB Atlas M0 Free Only)**  
**Production Impact:** **ZERO** (No database connections, no schema/index changes, no code edits, no package installs, no Git commits/pushes)

---

### 1. FORMAL FINAL DECISION (SECTION K)

In strict compliance with Section K of the Master Prompt, the formal audit decision is:

$$\mathbf{C\ –\ FILE\text{-}STORAGE\ FEATURES\ FOUND;\ SEPARATE\ REMEDIATION\ REQUIRED.}$$

---

### 2. WHY DECISION C IS SELECTED (AND HOW IT INCORPORATES SCHEMA OPTIMIZATION)

1. **Active File/Document Upload & Media Persistence Paths Exist in Project 2 (`Decision C` Trigger):**
   - **`src/app/api/documents/secure-upload/route.ts` (`GET` & `POST /api/documents/secure-upload`)** and **`src/lib/consent-privacy.ts` / `src/lib/chatbot-flow-engine.ts`**: Generate signed upload portal links sent via WhatsApp and persist document checklist arrays, encrypted storage references (`ENCv1:...`), and unbounded `auditLog[]` entries into MongoDB (`DocumentModel` / `documentmodels`).
   - **`src/app/api/whatsapp-webhook-worker/route.ts` (Lines 165–167, 288–298)**: Captures inbound WhatsApp `document` and `image` messages (`mediaId`) and writes `Document.create({ leadId, documentType: 'Unknown', fileUrl: mediaId, status: 'UPLOADED' })` into MongoDB.
   - **`src/app/gallery/page.tsx` (`GalleryPage`)**: Exposes a *"Media Gallery & Verification Vault"* UI with an `<input type="file">` *"Upload Document"* button explicitly prompting for *"customer PAN, Aadhaar, salary slips, and property documents."*
   - **`src/models/Message.ts` (`media: Mixed`)** and **`src/models/Call.ts` (`recordingUrl`, `transcript: Mixed`, `webhookPayloads: Mixed[]`)**: Define schema fields for media attachments, call recordings, and raw voice webhook payloads.
2. **Schema & Index Optimization Is Also Required Before M0 Scale (`Decision B` Scope Included):**
   - Under the current unoptimized 18-model schema (specifically `WebhookInbox.payload: Mixed` with no TTL, `Call.webhookPayloads[]`, `Message.providerResponse`, `Conversation.history[]`, 110+ field `Lead` documents with 5 unbounded arrays, and 62 indexes), **5,000 customers (`577.07 MB`)** and **10,000 customers (`1,153.64 MB`)** overflow the **512.00 MB M0 hard limit**.
   - Applying the **Minimal Customer-Data Model** reduces the theoretical 10,000-customer footprint (including index overhead and 15% WiredTiger padding) from **`1,153.64 MB` down to `83.24 MB` (16.26% of the 512 MB hard limit and 23.78% of the 350 MB conservative target)**.

---

### 3. SEPARATE FUTURE REMEDIATION ROADMAP (REQUIRES EXPLICIT OWNER AUTHORIZATION)

None of the changes below were executed in Task 5H.3. They are organized into a gated remediation plan for a separate future Owner-authorized implementation task:

| Phase | Remediation Item | Target Files (For Future Task Only) | Expected M0 Storage & Security Benefit |
| :---: | :--- | :--- | :--- |
| **Phase 1 (File & Media Exclusion)** | 1. Disable `POST /api/documents/secure-upload` (return static advisory notice; stop writing to `DocumentModel`).<br/>2. Remove `generateSecureDocumentUploadLink()` dispatch from `src/lib/chatbot-flow-engine.ts`.<br/>3. Remove `Document.create({ fileUrl: mediaId })` from `src/app/api/whatsapp-webhook-worker/route.ts` (lines 288–298).<br/>4. Disable `/gallery` upload UI (`src/app/gallery/page.tsx`). | `src/app/api/documents/secure-upload/route.ts`, `src/lib/chatbot-flow-engine.ts`, `src/app/api/whatsapp-webhook-worker/route.ts`, `src/app/gallery/page.tsx` | **100% compliance with Section B & G** (zero file, document, or media attachment metadata collected into MongoDB; ₹0 cost). |
| **Phase 2 (Raw Payload & Array Pruning)** | 1. Stop storing raw `WebhookInbox.payload` (`Mixed`); store only 64-byte `payloadHash` + `eventId` and add a 7-day TTL index.<br/>2. Omit `Message.media`, `Message.providerResponse`, `Call.recordingUrl`, `Call.transcript`, `Call.providerResponse`, and `Call.webhookPayloads[]`.<br/>3. Cap or omit `Conversation.history[]` and `Lead.interactions[]`. | `src/models/WebhookInbox.ts`, `src/models/Message.ts`, `src/models/Call.ts`, `src/models/Conversation.ts`, `src/models/Lead.ts` | Eliminates **>85% of per-customer BSON bloat**, preventing M0 512 MB storage exhaustion. |
| **Phase 3 (Index & Import Guardrails)** | 1. Consolidate duplicate message/trigger indexes (`messageId_1` / `providerMessageId_1` / `idempotencyKey_1`).<br/>2. Add a 200-row batch cap and rate throttle to `/api/contacts/upload` and `/api/leads/upload` CSV routes. | `src/models/Message.ts`, `src/models/WorkflowTrigger.ts`, `src/app/api/contacts/upload/route.ts`, `src/app/api/leads/upload/route.ts` | Protects M0's **100 CRUD ops/sec limit** and cuts index storage overhead from ~202.75 MB to ~28.26 MB at 10k customers. |

---

### 4. MANDATORY STOP

Execution has **STOPPED** in strict compliance with Section I and Section K. No database connections were made, no schemas or indexes were modified, no source code was changed, and no cloud resources were created. Awaiting separate Owner authorization before implementing any changes.
