# TASK 5H.3 — FILE STORAGE & UPLOAD EXCLUSION AUDIT
## FORENSIC IDENTIFICATION OF UPLOAD ROUTES, COMPONENTS, MODELS & REMEDIATION PLAN
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026 (`2026-11-18`)  
**Execution Mode:** Strictly Read-Only Code & Route Inspection  
**Code Modifications Made:** **ZERO**  
**Alternative Paid Storage Services Created:** **ZERO (₹0 / $0 Rule)**

---

### 1. EXECUTIVE SUMMARY OF FILE-UPLOAD & ATTACHMENT AUDIT (SECTION B & G)

A complete scan of all **153 source files** in `3-AVANI AI CRM/src/` was executed to detect every file-upload route, UI file input, document model, GridFS binding, Base64 encoder, media handler, and raw payload store:

1. **GridFS / BSON Binary Blobs / Local Disk Uploads:** **NONE FOUND.** The application does not use `GridFSBucket`, Mongoose `Buffer` schema types, `fs.writeFile` for user uploads, or AWS S3/GCS paid buckets.
2. **Active File/Document Upload & Attachment Features Found:** **6 specific features** exist in Project 2 that either collect customer document upload metadata into MongoDB, provide UI upload buttons for customer KYC PDFs/images, capture WhatsApp media attachments into MongoDB, or persist unbounded raw webhook/voice payloads in MongoDB.
3. **Mandatory Governance Action:** Per Section G, **none of these files were modified during this read-only audit**. Each feature is cataloged below with its exact file path, line numbers, current storage mechanism, and recommended remediation for a separate Owner-authorized future implementation task.

---

### 2. COMPLETE INVENTORY OF FILE-UPLOAD, DOCUMENT & MEDIA FEATURES FOUND

| # | Feature / Capability | Exact Route / Component / Library File Path & Lines | Associated Mongoose Model & Collection | Current Storage Mechanism | Risk Under M0 Minimal Customer-Data Policy | Recommended Remediation (Future Task) |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Secure Document Upload Portal API** | `src/app/api/documents/secure-upload/route.ts` (Lines 19–142: `GET` & `POST /api/documents/secure-upload`) | `DocumentModel` (`src/models/Document.ts` $\rightarrow$ collection `documentmodels`) | Stores `requiredDocuments[]`, `receivedDocuments[]`, `missingDocuments[]`, and appends AES-256-GCM encrypted `storageReference` (`ENCv1:...`) strings into an unbounded `auditLog[]` array in **MongoDB**. | Collects customer KYC document upload records and grows `auditLog[]` indefinitely in MongoDB. | **Disable/Remove POST upload endpoint** (return HTTP `410 Gone` or static advisory message: *"Document uploads are not collected online; share physical/verified copies directly with your assigned loan advisor during bank processing"*). |
| **2** | **Chatbot Secure Document Upload Link Generator** | `src/lib/consent-privacy.ts` (Lines 128–189: `generateSecureDocumentUploadLink`, `verifySecureDocumentUploadToken`) & `src/lib/chatbot-flow-engine.ts` (Lines 289–301, 580–606) | `DocumentModel` (`documentmodels`) & `Lead` (`leads`) | Generates Base64URL-encoded HMAC-SHA256 tokens pointing customers to `/api/documents/secure-upload?token=...` during WhatsApp chat. | Actively instructs WhatsApp customers to use an online document upload portal link. | **Remove upload link generation** from `chatbot-flow-engine.ts`; retain only the privacy warning (*"Do not send Aadhaar, PAN, or bank statements in WhatsApp chat"*). |
| **3** | **WhatsApp Inbound Media / Document Attachment Capture** | `src/app/api/whatsapp-webhook-worker/route.ts` (Lines 155–167 & 288–298) | `Document` (`src/models/Document.ts` $\rightarrow$ `documentmodels`) & `Message` (`src/models/Message.ts` $\rightarrow$ `messages`) | When an inbound WhatsApp message has `type === 'document'` or `'image'`, extracts `mediaId` and executes `Document.create({ leadId, documentType: 'Unknown', fileUrl: mediaId, status: 'UPLOADED' })` in **MongoDB**. Also `MessageSchema` defines `media: Mixed` (line 35). | Writes inbound media attachment records into MongoDB and allows `Message.media` (`Mixed`) to store arbitrary media objects. | **Disable media DB persistence** in `whatsapp-webhook-worker/route.ts` (delete lines 288–298 `Document.create` call; ignore inbound media binaries/IDs and reply with text-only policy notice; remove `media: Mixed` from `MessageSchema`). |
| **4** | **Media Gallery & Verification Vault UI Page** | `src/app/gallery/page.tsx` (Lines 13–133: `GalleryPage`, `handleFileUpload`, `<input type="file">`) | Client-side React state (`useState` array with mock PAN, Doctor Registration, GST, and Property Registry PDFs) | In-memory browser React state (does not currently persist to MongoDB, but presents an *"Upload Document"* button for *"customer PAN, Aadhaar, salary slips, and property documents"*). | Violates Section B & G prohibition against collecting or uploading customer KYC/property PDFs and images in the CRM. | **Disable or remove `/gallery` page and sidebar navigation link** in a separate future task. |
| **5** | **Voice Call Recording URL, Transcript & Raw Webhook Array** | `src/models/Call.ts` (Lines 25, 27, 38, 39) & `src/app/api/omnidim-webhook/route.ts` (Line 146) | `Call` (`src/models/Call.ts` $\rightarrow$ collection `calls`) | Stores `recordingUrl: String`, `transcript: Mixed`, `providerResponse: Mixed`, and `webhookPayloads: [{ type: Mixed }]` directly in **MongoDB**. | Unbounded raw voice webhook payloads and full transcripts can consume 10–45 KB per call, rapidly exhausting M0 512 MB storage. | **Remove `recordingUrl`, `transcript`, `providerResponse`, and `webhookPayloads[]`** from `Call` persistence; store only call status, duration, and a short $\le 250$-char summary. |
| **6** | **Raw Webhook Payload Persistence & Admin CSV Import Routes** | • `src/models/WebhookInbox.ts` (Line 8: `payload: Mixed`) across `whatsapp-webhook`, `meta-webhook`, `chatmitra-webhook`<br/>• `src/app/api/contacts/upload/route.ts` (`req.formData()`) & `src/app/api/leads/upload/route.ts` | `WebhookInbox` (`webhookinboxes`), `Contact` (`contacts`), `Lead` (`leads`) | • `WebhookInbox` stores full raw inbound webhook JSON in **MongoDB** permanently with no TTL.<br/>• CSV upload routes parse `.csv` text in RAM (`await file.text()`) and upsert structured `Contact`/`Lead` BSON documents (raw CSV file is not stored). | Raw `WebhookInbox.payload` directly violates Section B (*"Explicitly prohibit: Unnecessary raw webhook payload storage"*). Uncapped CSV imports risk hitting M0 100 ops/sec & 512 MB limits. | • **Stop storing `WebhookInbox.payload` (`Mixed`)** (store only 64-byte `payloadHash` + `eventId` with a 7-day TTL index).<br/>• Enforce a strict row cap (e.g., max 200 rows/request) and batch throttle on CSV contact/lead import routes. |

---

### 3. VERIFICATION OF BASE64 USAGE IN CODEBASE (NON-FILE CRYPTO ONLY)

Our regex audit also inspected all occurrences of `base64` / `base64url` across `src/lib/` to verify whether Base64 is used for file storage:
- `src/lib/auth.ts` (lines 130–135): Base64URL encoding of HMAC-SHA256 JWT session tokens (< 250 bytes).
- `src/lib/consent-privacy.ts` (lines 149–181): Base64URL encoding of signed token metadata (< 200 bytes).
- `src/lib/integrations.ts` (lines 242, 439): Standard HTTP Basic Auth header encoding (`accountSid:authToken` in transit only; not stored in DB).
- `src/lib/s2s-ecosystem.ts` & `src/lib/s2s-node-adapter.cjs`: Base64URL JWT signature encoding.

**Conclusion:** **Zero Base64-encoded files or images are stored in MongoDB.**

---

### 4. ZERO-COST (₹0 / $0) NON-STORAGE WORKFLOW FOR CUSTOMER DOCUMENTS

In accordance with Section G (*"The CRM must not collect or upload customer documents into MongoDB... Do not create an alternative paid storage service"*):
1. **No Cloud Blob Storage Needed (₹0 / $0):** Do not provision AWS S3, Google Cloud Storage, Cloudinary, Firebase Storage, or Vercel Blob.
2. **Checklist Metadata Only (Optional 1-Field Status):** The CRM should track only a single structured enum on the loan application (`docReadinessStatus: 'PENDING' | 'ADVISOR_VERIFIED'`), while actual KYC/financial documents are handled directly between the customer, the assigned loan advisor, and the partner bank/NBFC's official loan processing portal outside the CRM.
