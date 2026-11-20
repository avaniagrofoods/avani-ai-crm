# TASK 5H.3 — EXECUTIVE SUMMARY
## MINIMAL CUSTOMER-DATA DATABASE DESIGN FOR MONGODB ATLAS M0 FREE-ONLY ARCHITECTURE
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026 (`2026-11-18`)  
**Execution Mode:** Strictly Read-Only Application Schema, Route & Storage Audit  
**Maximum Cloud Cost:** **₹0.00 INR / $0.00 USD (MongoDB Atlas M0 Free Only)**  
**Production Impact:** **ZERO** (No database connections, no schema/index modifications, no code changes, no package installations, no Git commits/pushes)

---

### 1. FORMAL FINAL DECISION (SECTION K)

Based on a complete line-by-line read-only audit of all 18 Mongoose models (`src/models/*.ts`) and 153 TypeScript/React source files (`src/**`) in Project 2 (`3-AVANI AI CRM`), the formal decision is:

$$\mathbf{C\ –\ FILE\text{-}STORAGE\ FEATURES\ FOUND;\ SEPARATE\ REMEDIATION\ REQUIRED.}$$

*(Accompanied by mandatory schema/index optimization recommendations [Decision B scope] to eliminate unbounded arrays, raw webhook/media payload fields, and redundant indexes before operating at scale on an M0 Free Cluster's 512 MB hard limit).*

---

### 2. KEY AUDIT FINDINGS SUMMARY

| Audit Domain | Verified Read-Only Finding | M0 Storage / Compliance Impact |
| :--- | :--- | :--- |
| **1. Binary / GridFS / Base64 File Blobs in Schemas** | **None Found in Mongoose Schema Types:** Zero models define `Buffer`, `GridFSBucket`, or Base64 file columns. | Positive baseline, **but undermined by active document-upload routes, media fields, and Mixed payload fields below.** |
| **2. Document & Media Upload Features Found (Section G)** | **4 File/Document Upload & Media Paths Found:**<br/>1. **`/api/documents/secure-upload` (`src/app/api/documents/secure-upload/route.ts`)** + `generateSecureDocumentUploadLink()` (`src/lib/consent-privacy.ts` & `src/lib/chatbot-flow-engine.ts`): Prompts customers via WhatsApp to upload KYC documents and writes encrypted storage references & unbounded `auditLog[]` entries into `DocumentModel` (`documentmodels`).<br/>2. **WhatsApp Inbound Media Capture (`src/app/api/whatsapp-webhook-worker/route.ts` lines 165–167, 288–298):** Captures inbound `document` and `image` messages (`mediaId`) and calls `Document.create({ leadId, documentType: 'Unknown', fileUrl: mediaId, status: 'UPLOADED' })`.<br/>3. **Media Gallery & Verification Vault UI (`src/app/gallery/page.tsx`):** Provides an `<input type="file">` *"Upload Document"* UI explicitly labeled for *"customer PAN, Aadhaar, salary slips, and property documents."*<br/>4. **Unstructured Media & Recording Fields:** `Message.media` (`Mixed`), `Call.recordingUrl` (`String`), and `Interaction.type = 'DOCUMENT_UPLOADED'`. | **Violates Section B & Section G File Handling Policy.** Must be disabled or removed in a separate Owner-authorized remediation task so customer documents/attachments are never collected or tracked via upload routes in MongoDB. |
| **3. Raw Payloads, Unbounded Arrays & Schema Bloat (Section E)** | **Severe M0 Storage Bloat Risks Found:**<br/>• `WebhookInbox.payload` (`Mixed`) stores full raw webhook JSON indefinitely (no TTL index).<br/>• `Call.transcript` (`Mixed`), `Call.providerResponse` (`Mixed`), and `Call.webhookPayloads[]` (`Mixed[]`) store unbounded raw voice payloads.<br/>• `Message.providerResponse` (`Mixed`) and `Message.media` (`Mixed`) store raw provider responses.<br/>• `Conversation.history[]` (`Array`) and `Conversation.context` (`Object`) duplicate message history.<br/>• `Lead` (110+ fields) contains 5 unbounded embedded arrays (`stageHistory[]`, `assignmentHistory[]`, `followUpTasks[]`, `documentChecklist[]`, `interactions[]`) and duplicate customer/income/loan fields. | Under the **current unoptimized schema**, **5,000 customers (`577.07 MB`)** and **10,000 customers (`1,153.64 MB`)** breach both the **350.00 MB conservative M0 planning target** and the **512.00 MB hard cap**. |
| **4. Minimal Customer-Data Model Capacity on M0 (Section D & E)** | Under the **recommended Minimal Customer-Data Model** (essential structured BSON fields only, zero file/media/raw-payload storage, bounded arrays, 7-day TTL on transient deduplication hashes, and pruned duplicate indexes):<br/>• **500 Customers:** ~**4.40 MB** total (Data + Indexes)<br/>• **1,000 Customers:** ~**8.55 MB** total (Data + Indexes)<br/>• **5,000 Customers:** ~**41.75 MB** total (Data + Indexes)<br/>• **10,000 Customers:** ~**83.24 MB** total (Data + Indexes — **only 16.26% of the 512 MB hard limit** and **23.78% of the 350 MB conservative target**). | **Reduces 10,000-customer M0 footprint by ~92.8%** (from ~1,153.64 MB down to ~83.24 MB). *(Theoretical estimates based on documented BSON assumptions; not a guaranteed capacity claim).* |
| **5. M0 Technical Constraints & Inactivity Correction (Section F)** | Baseline: **512 MB** total storage (data + indexes), **500** max connections, **100** max CRUD ops/sec, **100** max databases / **500** max collections, **₹0 / $0** cost (no paid upgrades or paid backups).<br/>**Inactivity Statement Corrected:** Per Section F directive and current official documentation, inactive Free (M0) clusters are automatically paused after **30 days** of inactivity. | All minimal-design capacity targets are engineered strictly within the 512 MB / 100 ops/sec M0 envelope. |

---

### 3. DELIVERABLES INVENTORY

All 9 required deliverables have been generated in `CHATMITRA_CRM_IMPLEMENTATION/39_TASK_5H_3_MINIMAL_CUSTOMER_DATA_DESIGN/` and mirrored across Project 1 and Project 2:

1. `TASK_5H_3_EXECUTIVE_SUMMARY.md`
2. `TASK_5H_3_EXISTING_DATABASE_SCHEMA_AUDIT.md`
3. `TASK_5H_3_MINIMAL_CUSTOMER_DATA_MODEL.md`
4. `TASK_5H_3_FILE_STORAGE_EXCLUSION_AUDIT.md`
5. `TASK_5H_3_M0_STORAGE_ESTIMATES.xlsx`
6. `TASK_5H_3_INDEX_AND_STORAGE_OPTIMIZATION.md`
7. `TASK_5H_3_PRIVACY_AND_DATA_MINIMIZATION.md`
8. `TASK_5H_3_FINAL_RECOMMENDATION.md`
9. `TASK_5H_3_EVIDENCE_AND_HASH_MANIFEST.md`
