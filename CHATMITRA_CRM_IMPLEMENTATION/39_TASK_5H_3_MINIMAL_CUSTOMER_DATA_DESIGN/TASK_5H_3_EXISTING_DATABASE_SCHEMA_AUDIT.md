# TASK 5H.3 — EXISTING DATABASE SCHEMA AUDIT
## READ-ONLY AUDIT OF ALL 18 MONGOOSE MODELS IN PROJECT 2 (`3-AVANI AI CRM`)
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026 (`2026-11-18`)  
**Execution Mode:** Strictly Read-Only Source Inspection (`src/models/*.ts` & `CP26_6_INDEX_PARITY.csv`)  
**Schema Modifications:** **ZERO**

---

### 1. MAPPING OF SECTION C FUNCTIONAL CATEGORIES TO ACTUAL PROJECT 2 MODELS

Project 2 (`3-AVANI AI CRM/src/models/`) contains **18 Mongoose model files** (plus 1 internal `system_metadata` collection in CP26.6 parity records):

| Section C Functional Category | Actual Project 2 Mongoose Model(s) | Source File(s) | MongoDB Collection Name(s) |
| :--- | :--- | :--- | :--- |
| **1. Lead Model** | `Lead` | `src/models/Lead.ts` | `leads` |
| **2. Contact Model** | `Contact` | `src/models/Contact.ts` | `contacts` |
| **3. Customer Model (if present)** | *No separate `Customer.ts` model* — customer identity is split across `Lead` and `Contact` | `src/models/Lead.ts`, `src/models/Contact.ts` | `leads`, `contacts` |
| **4. Loan Application Model** | Embedded inside `Lead` (`application`, `sanction`, `disbursement`, `revenue`, product detail sub-objects) + `CrossSellOpportunity` | `src/models/Lead.ts`, `src/models/CrossSellOpportunity.ts` | `leads`, `crosssellopportunities` |
| **5. Message Model** | `Message` + `Conversation` + `Template` + `Broadcast` | `src/models/Message.ts`, `Conversation.ts`, `Template.ts`, `Broadcast.ts` | `messages`, `conversations`, `templates`, `broadcasts` |
| **6. Consent Model** | Embedded inside `Lead` (`consentStatus`, `consentPurpose`, `consentTimestamp`, `isOptedOut`, `optedOutAt`) & `Contact` (`optedIn`) | `src/models/Lead.ts`, `src/models/Contact.ts`, `src/lib/consent-privacy.ts` | `leads`, `contacts` |
| **7. Follow-Up / Activity Model** | Embedded `Lead.followUpTasks[]` & `Lead.interactions[]` + `Interaction` + `Schedule` + `Call` + `WorkflowTrigger` + `ProviderLedger` | `src/models/Interaction.ts`, `Schedule.ts`, `Call.ts`, `WorkflowTrigger.ts`, `ProviderLedger.ts` | `interactions`, `schedules`, `calls`, `workflowtriggers`, `providerledgers` |
| **8. WebhookInbox Model** | `WebhookInbox` | `src/models/WebhookInbox.ts` | `webhookinboxes` |
| **9. Advisor & Assignment Models** | `Advisor` + `Lender` + embedded `Lead.assignedAdvisor`, `Lead.assignmentHistory[]`, `Lead.assignedAgent` + `AuthSession` + `AuthRateLimit` | `src/models/Advisor.ts`, `Lender.ts`, `AuthSession.ts`, `AuthRateLimit.ts` | `advisors`, `lenders`, `authsessions`, `authratelimits` |
| **10. Attachment / Document / Upload Fields** | `DocumentModel` (`Document`) + `Lead.documentChecklist[]` + `Message.media` (`Mixed`) + `Call.recordingUrl` + `Call.webhookPayloads[]` + `WebhookInbox.payload` (`Mixed`) | `src/models/Document.ts`, `Lead.ts`, `Message.ts`, `Call.ts`, `WebhookInbox.ts` | `documentmodels`, `leads`, `messages`, `calls`, `webhookinboxes` |

---

### 2. MODEL-BY-MODEL FORENSIC AUDIT (ALL 18 MODELS)

#### MODEL 1: `Lead` (`src/models/Lead.ts`)
- **Collection Name:** `leads`
- **Required Fields (3 + subdocument required fields):** `name`, `phone`, `loanType` (plus `stageHistory[].stage`, `followUpTasks[].taskId`, `followUpTasks[].title`, `followUpTasks[].dueDate`, `documentChecklist[].code`, `documentChecklist[].name`).
- **Stored & Optional Fields (110+ fields across 16 sub-groups):**
  - *Core Identity:* `leadId`, `name` (req), `firstName`, `lastName`, `phone` (req), `normalizedMobile`, `email`, `city`, `state`, `country`, `preferredLanguage`.
  - *Qualification & Financials:* `loanType` (req), `employmentType`, `profession`, `monthlyIncomeRange`, `income`, `monthlyIncome`, `annualIncome`, `requestedAmount`, `requiredLoanAmount`, `preferredTenure`, `existingLoans`, `cibilScore`, `qualificationScore`, `qualificationBreakdown` (9 subfields), `financialProfile` (4 subfields), `emiCalculationLog` (9 subfields).
  - *Product-Specific Sub-Objects (6 sub-schemas):* `doctorLoanDetails` (4 fields), `businessLoanDetails` (5 fields including `gstNumber`), `homeLoanDetails` (4 fields), `lapDetails` (3 fields), `educationLoanDetails` (4 fields), `institutionalFundingDetails` (4 fields).
  - *Pipeline, Application, Sanction, Disbursement & Revenue:* `stage`, `stageHistory[]`, `status`, `application` (8 fields), `sanction` (7 fields), `disbursement` (5 fields including `utrNumber`), `revenue` (8 fields).
  - *Advisor & Tasks:* `assignedAdvisor` (6 fields), `assignmentHistory[]`, `assignedAgent` (3 legacy fields), `followUpTasks[]` (10 fields per task), `documentChecklist[]` (8 fields per item), `followUpCount`.
  - *DPDP Consent & Opt-Out:* `consentStatus`, `consentPurpose`, `consentTimestamp`, `isOptedOut`, `optedOutAt`.
  - *AI Workflow & Attribution:* `idempotencyKey`, `aiAgentStatus`, `questionProgress`, `documentStatus`, `callStatus`, `followUpStatus`, `currentWorkflowState`, `leadSource`, `source`, `channel`, `correlationId`, `provider`, `providerMessageId`, `providerCallId`, `sourcePlatform`, `campaign`, `campaignId`, `adSet`, `ad`, `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`, `metaLeadId`, `hubSpotContactId`, `hubSpotDealId`, `whatsappMessageId`, `aiSensyMessageId`, `conversationId`, `callId`, `callSummary`, `callDuration`, `interactions[]` (7 fields per interaction), `createdAt`, `updatedAt`, `lastInteractionAt`.
- **Indexes (8 total in CP26.6 parity):** `_id_`, `leadId_1` (**unique**), `phone_1` (**unique**), `stage_1`, `idempotencyKey_1`, `correlationId_1`, `providerMessageId_1`, `providerCallId_1`.
- **Unique Indexes (2):** `leadId_1` (`{ leadId: 1 }`), `phone_1` (`{ phone: 1 }`).
- **Approximate Record-Size Risks:** **HIGH (4.5 KB – 18.0 KB per lead; average ~6.5 KB).** Contains **5 unbounded embedded arrays** (`stageHistory[]`, `assignmentHistory[]`, `followUpTasks[]`, `documentChecklist[]`, `interactions[]`) plus 6 product sub-objects that allocate BSON keys even when unused, and triplicate/quadruplicate fields (`income` / `monthlyIncome` / `annualIncome` / `monthlyIncomeRange`; `requestedAmount` / `requiredLoanAmount` / `financialProfile.requestedLoanAmount`; `assignedAdvisor` / `assignedAgent`).
- **Personal Information (PII) Stored:** Full name (`name`, `firstName`, `lastName`), mobile phone (`phone`, `normalizedMobile`), email (`email`), location (`city`, `state`, `propertyLocation`), income/turnover, credit score (`cibilScore`), GST number (`businessLoanDetails.gstNumber`), bank UTR reference (`disbursement.utrNumber`).
- **CRM Essentiality Verdict:**
  - **Essential (~18 fields):** `leadId`, `name`, `phone`, `city`, `leadSource`, `loanType`, `employmentType`, `requiredLoanAmount`, `monthlyIncomeRange`, `stage`, `status`, `assignedAdvisor.id`/`name`, `consentStatus`, `consentTimestamp`, `isOptedOut`, `optedOutAt`, `nextFollowUpAt`, `createdAt`, `updatedAt`.
  - **Non-Essential / Redundant (~90+ fields):** Duplicate income/amount fields, `emiCalculationLog`, `assignedAgent` (legacy), 15 marketing/UTM/HubSpot attribution fields, embedded `interactions[]` (duplicates `messages`/`interactions` collections), and unbounded history arrays.

---

#### MODEL 2: `Contact` (`src/models/Contact.ts`)
- **Collection Name:** `contacts`
- **Stored Fields (8):** `phone`, `name`, `email`, `city`, `optedIn`, `leadId` (`ObjectId` ref `Lead`), `createdAt`, `updatedAt`.
- **Required Fields (1):** `phone`.
- **Optional Fields (7):** `name`, `email`, `city`, `optedIn`, `leadId`, `createdAt`, `updatedAt`.
- **Indexes (2):** `_id_`, `phone_1` (**unique**).
- **Unique Indexes (1):** `phone_1` (`{ phone: 1 }`).
- **Approximate Record-Size Risks:** **LOW (~280 – 380 bytes per document)**, **but 100% duplicates customer PII already stored in `Lead`!** Every inbound WhatsApp message upserts *both* a `Lead` and a `Contact` with the same `phone`, `name`, `city`, and opt-in flag.
- **Personal Information (PII) Stored:** `phone`, `name`, `email`, `city`.
- **CRM Essentiality Verdict:** **Redundant Collection if unified with `Lead`** (or keep minimal 4-field lookup index if Inbox UI requires it; eliminates duplicate `name`/`email`/`city` storage).

---

#### MODEL 3: `DocumentModel` / `Document` (`src/models/Document.ts`)
- **Collection Name:** `documentmodels`
- **Stored Fields (10):** `leadId`, `product`, `customerType`, `requiredDocuments[]`, `receivedDocuments[]`, `missingDocuments[]`, `status`, `auditLog[]` (`{ action, timestamp, detail }`), `createdAt`, `updatedAt`. *(Note: `whatsapp-webhook-worker/route.ts` line 289 also attempts to write undeclared fields `documentType`, `fileUrl: mediaId`, `uploadedAt`)*.
- **Required Fields (2):** `leadId`, `product`.
- **Optional Fields (8):** `customerType`, `requiredDocuments`, `receivedDocuments`, `missingDocuments`, `status`, `auditLog`, `createdAt`, `updatedAt`.
- **Indexes (2):** `_id_`, `leadId_1`.
- **Unique Indexes (0):** None (`leadId_1` is non-unique).
- **Approximate Record-Size Risks:** **MODERATE TO HIGH (1.2 KB – 8.0 KB per record)** due to unbounded `auditLog[]` array and duplicate checklist arrays (`requiredDocuments`, `receivedDocuments`, `missingDocuments`) that already exist inside `Lead.documentChecklist[]`!
- **Personal Information (PII) Stored:** Encrypted document storage references (`ENCv1:...`) and document submission logs linked to `leadId`.
- **CRM Essentiality Verdict:** **NON-ESSENTIAL / EXCLUDE FILE-UPLOAD TRACKING.** Document upload tracking and `fileUrl: mediaId` must be disabled per Section B & G. If a simple boolean/enum readiness flag is needed (`docReadinessStatus: 'PENDING' | 'READY'`), it belongs on the Application/Lead record in 1 field (~20 bytes).

---

#### MODEL 4: `Message` (`src/models/Message.ts`)
- **Collection Name:** `messages`
- **Stored Fields (20):** `leadId`, `correlationId`, `idempotencyKey`, `providerMessageId`, `messageId`, `direction`, `channel`, `provider`, `recipientPhone`, `senderPhone`, `phone`, `status`, `templateName`, `templateParams` (`Mixed`), `text`, `media` (`Mixed`), `failureReason`, `providerResponse` (`Mixed`), `createdAt`, `updatedAt`, `deliveredAt`, `readAt`.
- **Required Fields (1):** `direction`.
- **Optional Fields (19):** All other fields.
- **Indexes (6):** `_id_`, `leadId_1`, `correlationId_1`, `idempotencyKey_1` (**unique** in CP26.6 parity, sparse in schema), `providerMessageId_1`, `messageId_1`.
- **Unique Indexes (1 in CP26.6):** `idempotencyKey_1`.
- **Approximate Record-Size Risks:** **HIGH (1.5 KB – 6.0 KB per message, multiplied by 10–30 messages per customer!).**
  - Stores three duplicate phone fields (`recipientPhone`, `senderPhone`, `phone`) on every message instead of referencing `leadId`.
  - Stores three overlapping ID fields (`messageId`, `providerMessageId`, `idempotencyKey`) with **3 separate indexes**!
  - Stores `media: Mixed` (attachment metadata) and `providerResponse: Mixed` (full raw provider HTTP response JSON).
- **Personal Information (PII) Stored:** Customer mobile numbers (`phone`, `senderPhone`, `recipientPhone`), free-text message content (`text`), and `templateParams`.
- **CRM Essentiality Verdict:**
  - **Essential (7 fields):** `leadId`, `providerMessageId` (single unique deduplication key), `direction`, `messageType` (`templateName` or `'TEXT'`), `status`, `text` (truncated to $\le 500$ chars, no KYC data), `createdAt`.
  - **Non-Essential / Prohibit (13 fields):** `media` (**prohibited attachment field**), `providerResponse` (**unnecessary raw payload**), `templateParams`, duplicate `phone`/`senderPhone`/`recipientPhone`, duplicate `messageId`/`idempotencyKey`/`correlationId`.

---

#### MODEL 5: `Conversation` (`src/models/Conversation.ts`)
- **Collection Name:** `conversations`
- **Stored Fields (25):** `conversationId`, `leadId`, `customerPhone`, `currentStage`, `currentState`, `currentSubStage`, `product`, `language`, `lastInboundAt`, `lastOutboundAt`, `lastInboundMessageId`, `lastTemplate`, `lastProviderMessageId`, `qualificationStatus`, `documentStatus`, `advisorStatus`, `applicationStatus`, `optOutStatus`, `nextActionAt`, `assignedAdvisor`, `leadScore`, `history` (`Array`), `context` (`Object`), `createdAt`, `updatedAt`.
- **Required Fields (3):** `conversationId`, `leadId`, `customerPhone`.
- **Optional Fields (22):** All remaining fields.
- **Indexes (5):** `_id_`, `conversationId_1` (**unique**), `leadId_1`, `customerPhone_1`, `currentStage_1`.
- **Unique Indexes (1):** `conversationId_1`.
- **Approximate Record-Size Risks:** **HIGH (2.0 KB – 15.0 KB per conversation)** because `history: Array` and `context: Object` are unbounded and duplicate stage/message state already stored in `Lead` and `Message`.
- **Personal Information (PII) Stored:** `customerPhone` and any customer answers cached inside `context` / `history`.
- **CRM Essentiality Verdict:** **Mostly Redundant with `Lead`.** `currentStage`, `optOutStatus`, `assignedAdvisor`, `leadScore`, and status flags duplicate `Lead`. If retained for state-machine routing, `history[]` and bulky `context` objects must be capped or omitted.

---

#### MODEL 6: `WebhookInbox` (`src/models/WebhookInbox.ts`)
- **Collection Name:** `webhookinboxes`
- **Stored Fields (14):** `eventId`, `provider`, `eventType`, `payloadHash`, `payload` (`Mixed`), `status`, `receivedAt`, `processingStartedAt`, `processedAt`, `attemptCount`, `lastError`, `leaseExpiresAt`, `correlationId`, `archiveOnly`, `suppressAutoReply`.
- **Required Fields (3):** `eventId`, `provider`, `eventType`.
- **Optional Fields (11):** All remaining fields.
- **Indexes (2):** `_id_`, `eventId_1` (**unique**).
- **Unique Indexes (1):** `eventId_1`.
- **Approximate Record-Size Risks:** **CRITICAL M0 BLOAT RISK (2.5 KB – 12.0 KB per webhook event; 20–50 events per customer = 50 KB – 600 KB per customer!).**
  - `payload: { type: mongoose.Schema.Types.Mixed }` stores the **entire raw webhook JSON payload** permanently with **zero TTL expiration index**!
  - Directly violates Section B (*"Explicitly prohibit: Unnecessary raw webhook payload storage"*).
- **Personal Information (PII) Stored:** Full raw WhatsApp/Meta/OmniDM webhook payloads containing customer phone numbers, profile names, message bodies, and media metadata.
- **CRM Essentiality Verdict:**
  - **Essential for Idempotency (5 lightweight fields + TTL):** `eventId` (unique), `provider`, `status`, `payloadHash` (SHA-256 string, 64 bytes), `receivedAt` (with a **7-day or 14-day TTL index** so processed idempotency keys auto-expire).
  - **Prohibited on M0:** Storing raw `payload` (`Mixed`) permanently.

---

#### MODEL 7: `Call` (`src/models/Call.ts`)
- **Collection Name:** `calls`
- **Stored Fields (21):** `leadId`, `correlationId`, `providerCallId`, `provider`, `agentId`, `recipientPhone`, `status`, `duration`, `recordingUrl`, `summary`, `transcript` (`Mixed`), `languageDetected`, `professionIdentified`, `loanProductIdentified`, `monthlyIncomeIdentified`, `cityIdentified`, `failureReason`, `providerResponse` (`Mixed`), `webhookPayloads` (`Mixed[]`), `createdAt`, `updatedAt`, `answeredAt`, `completedAt`.
- **Required Fields (1):** `leadId`.
- **Optional Fields (20):** All remaining fields.
- **Indexes (4):** `_id_`, `leadId_1`, `correlationId_1`, `providerCallId_1`.
- **Unique Indexes (0):** None.
- **Approximate Record-Size Risks:** **CRITICAL M0 BLOAT RISK (5.0 KB – 45.0 KB per call).**
  - Stores `recordingUrl` (audio link), `transcript` (`Mixed` full call dialog), `providerResponse` (`Mixed`), and `webhookPayloads: [{ type: Mixed }]` (unbounded array of every raw voice webhook!).
- **Personal Information (PII) Stored:** `recipientPhone`, voice call transcript (`transcript`), `recordingUrl`, extracted income/city/profession.
- **CRM Essentiality Verdict:**
  - **Essential (7 fields):** `leadId`, `providerCallId`, `status`, `duration`, `summary` ($\le 300$ chars), `createdAt`, `completedAt`.
  - **Prohibited / Non-Essential on M0:** `webhookPayloads[]`, `providerResponse`, full raw `transcript`, `recordingUrl`.

---

#### MODEL 8: `Interaction` (`src/models/Interaction.ts`)
- **Collection Name:** `interactions`
- **Stored Fields (11):** `interactionId`, `leadId` (`ObjectId`), `type` (includes `'DOCUMENT_UPLOADED'`), `channel`, `provider`, `providerEventId`, `direction`, `status`, `message`, `metadata` (`Mixed`), `createdAt`.
- **Required Fields (3):** `interactionId`, `leadId`, `type`.
- **Optional Fields (8):** `channel`, `provider`, `providerEventId`, `direction`, `status`, `message`, `metadata`, `createdAt`.
- **Indexes (2):** `_id_`, `interactionId_1` (**unique**).
- **Unique Indexes (1):** `interactionId_1`.
- **Approximate Record-Size Risks:** **MODERATE (500 bytes – 3.0 KB per interaction)**; duplicates `Message`, `Call`, and embedded `Lead.interactions[]`, and includes an unconstrained `metadata: Mixed` field.
- **Personal Information (PII) Stored:** `message` text and `metadata` contents.
- **CRM Essentiality Verdict:** **Redundant with `Message` and `Call` collections.** Removing duplicate logging across 3 places (`Lead.interactions[]`, `Interaction`, and `Message`) saves massive M0 storage and write ops.

---

#### MODEL 9: `WorkflowTrigger` (`src/models/WorkflowTrigger.ts`)
- **Collection Name:** `workflowtriggers`
- **Stored Fields (12):** `eventId`, `leadId`, `stage`, `triggerType`, `templateName`, `provider`, `correlationId`, `idempotencyKey`, `status`, `metadata` (`Object`), `processedAt`, `createdAt`, `updatedAt`.
- **Required Fields (6):** `eventId`, `leadId`, `stage`, `triggerType`, `correlationId`, `idempotencyKey`.
- **Optional Fields (6):** `templateName`, `provider`, `status`, `metadata`, `processedAt`.
- **Indexes (6):** `_id_`, `eventId_1` (**unique**), `idempotencyKey_1` (**unique**), `leadId_1`, `stage_1`, `correlationId_1`.
- **Unique Indexes (2):** `eventId_1`, `idempotencyKey_1`.
- **Approximate Record-Size Risks:** **MODERATE (~600 bytes data + ~600 bytes across 6 indexes = ~1.2 KB per trigger; no TTL index).** Having 6 indexes on a transient workflow log table creates ~100% index-to-data overhead.
- **Personal Information (PII) Stored:** Minimal (`leadId` and any fields inside `metadata`).
- **CRM Essentiality Verdict:** **Transient Operational Log.** Should have a 14-day TTL index and at most 2 indexes (`_id_`, `idempotencyKey_1`).

---

#### MODEL 10: `ProviderLedger` (`src/models/ProviderLedger.ts`)
- **Collection Name:** `providerledgers`
- **Stored Fields (12):** `correlationId`, `idempotencyKey`, `provider`, `operation`, `attempt`, `requestHash`, `providerMessageId`, `startedAt`, `completedAt`, `httpStatus`, `result`, `errorCode`.
- **Required Fields (0):** None marked `required: true`.
- **Optional Fields (12):** All 12 fields.
- **Indexes (3):** `_id_`, `correlationId_1`, `idempotencyKey_1`.
- **Unique Indexes (0):** None.
- **Approximate Record-Size Risks:** **MODERATE (~450 bytes per API attempt; accumulates indefinitely without TTL).** Duplicates delivery status already tracked on `Message`.
- **Personal Information (PII) Stored:** None directly (stores hashes and IDs).
- **CRM Essentiality Verdict:** **Non-Essential Audit Log for M0** (or retain only for 7 days via TTL index).

---

#### MODEL 11: `Advisor` (`src/models/Advisor.ts`)
- **Collection Name:** `advisors`
- **Stored Fields (10):** `advisorId`, `name`, `email`, `phone`, `role`, `activeLeadsCount`, `specializations[]`, `isActive`, `createdAt`, `updatedAt`.
- **Required Fields (4):** `advisorId`, `name`, `email`, `phone`.
- **Optional Fields (6):** `role`, `activeLeadsCount`, `specializations`, `isActive`, `createdAt`, `updatedAt`.
- **Indexes (3):** `_id_`, `advisorId_1` (**unique**), `email_1` (**unique**).
- **Unique Indexes (2):** `advisorId_1`, `email_1`.
- **Approximate Record-Size Risks:** **NEGLIGIBLE (< 10 documents total; ~400 bytes each = < 5 KB total).**
- **Personal Information (PII) Stored:** Staff advisor name, work email, work phone.
- **CRM Essentiality Verdict:** **ESSENTIAL** (Core staff directory & RBAC assignment target).

---

#### MODEL 12: `Lender` (`src/models/Lender.ts`)
- **Collection Name:** `lenders`
- **Stored Fields (13):** `lenderId`, `name`, `shortCode`, `categories[]`, `minAmount`, `maxAmount`, `indicativeRoi`, `maxTenureMonths`, `processingFee`, `contactPerson` (`{ name, phone, email }`), `isActive`, `createdAt`, `updatedAt`.
- **Required Fields (4):** `lenderId`, `name`, `shortCode`, `categories[]`.
- **Optional Fields (9):** `minAmount`, `maxAmount`, `indicativeRoi`, `maxTenureMonths`, `processingFee`, `contactPerson`, `isActive`, `createdAt`, `updatedAt`.
- **Indexes (2):** `_id_`, `lenderId_1` (**unique**).
- **Unique Indexes (1):** `lenderId_1`.
- **Approximate Record-Size Risks:** **NEGLIGIBLE (6–20 partner banks/NBFCs total; ~500 bytes each = < 15 KB total).**
- **Personal Information (PII) Stored:** Optional lender relationship manager contact details.
- **CRM Essentiality Verdict:** **ESSENTIAL** (Reference catalog for loan product matching).

---

#### MODEL 13: `Schedule` (`src/models/Schedule.ts`)
- **Collection Name:** `schedules`
- **Stored Fields (15):** `scheduleId`, `title`, `type`, `scheduledAt`, `date`, `time`, `targetAudience`, `templateName`, `messageText`, `status`, `executedAt`, `executionResult` (`Mixed`), `idempotencyKey`, `createdAt`, `updatedAt`.
- **Required Fields (3):** `scheduleId`, `title`, `scheduledAt`.
- **Optional Fields (12):** All remaining fields.
- **Indexes (5):** `_id_`, `scheduleId_1` (**unique**), `idempotencyKey_1` (**unique, sparse**), `scheduledAt_1`, `status_1`.
- **Unique Indexes (2):** `scheduleId_1`, `idempotencyKey_1` (sparse).
- **Approximate Record-Size Risks:** **LOW (~500 bytes per schedule, unless `executionResult: Mixed` stores large arrays).**
- **Personal Information (PII) Stored:** None (unless `executionResult` logs recipient phones).
- **CRM Essentiality Verdict:** **ESSENTIAL for Follow-Up Scheduling** (omit bulky `executionResult: Mixed`).

---

#### MODEL 14: `CrossSellOpportunity` (`src/models/CrossSellOpportunity.ts`)
- **Collection Name:** `crosssellopportunities`
- **Stored Fields (10):** `leadId`, `referringLeadId`, `sourceProduct`, `targetProduct`, `reason`, `score`, `status`, `template`, `createdAt`, `updatedAt`.
- **Required Fields (5):** `leadId`, `sourceProduct`, `targetProduct`, `reason`, `template`.
- **Optional Fields (5):** `referringLeadId`, `score`, `status`, `createdAt`, `updatedAt`.
- **Indexes (3 declared in schema):** `_id_`, `leadId_1`, `referringLeadId_1`.
- **Unique Indexes (0):** None.
- **Approximate Record-Size Risks:** **LOW (~350 bytes per record).**
- **Personal Information (PII) Stored:** None (references `leadId`).
- **CRM Essentiality Verdict:** **Optional Secondary CRM Feature** (low storage footprint).

---

#### MODEL 15: `Broadcast` (`src/models/Broadcast.ts`)
- **Collection Name:** `broadcasts`
- **Stored Fields (17):** `name`, `templateName`, `broadcastType`, `testMode`, `mode`, `environment`, `status`, `totalContacts`, `validContacts`, `invalidContacts`, `queuedCount`, `sentCount`, `deliveredCount`, `readCount`, `failedCount`, `createdAt`, `updatedAt`.
- **Required Fields (2):** `name`, `templateName`.
- **Optional Fields (15):** Counters and status fields.
- **Indexes (1):** `_id_` only.
- **Unique Indexes (0):** None.
- **Approximate Record-Size Risks:** **NEGLIGIBLE (~350 bytes per broadcast campaign summary; stores aggregate counters only).**
- **Personal Information (PII) Stored:** None.
- **CRM Essentiality Verdict:** **Acceptable Lightweight Summary Table** (< 100 KB for hundreds of campaigns).

---

#### MODEL 16: `Template` (`src/models/Template.ts`)
- **Collection Name:** `templates`
- **Stored Fields (17):** `templateId`, `providerTemplateId`, `templateName`, `displayName`, `language`, `category`, `status`, `providerStatus`, `providerSource`, `components[]`, `variables[]`, `productMapping[]`, `campaignName`, `campaignStatus`, `lastSyncedAt`, `createdAt`, `updatedAt`.
- **Required Fields (3):** `templateId`, `providerTemplateId`, `templateName`.
- **Optional Fields (14):** All remaining fields.
- **Indexes (4):** `_id_`, `templateId_1` (**unique**), `providerTemplateId_1`, `templateName_1`.
- **Unique Indexes (1):** `templateId_1`.
- **Approximate Record-Size Risks:** **NEGLIGIBLE (~34 templates in CP26.6; ~800 bytes each = ~30 KB total).**
- **Personal Information (PII) Stored:** None.
- **CRM Essentiality Verdict:** **ESSENTIAL** (Approved WhatsApp HSM template catalog).

---

#### MODEL 17: `AuthSession` (`src/models/AuthSession.ts`)
- **Collection Name:** `authsessions`
- **Stored Fields (8):** `jti`, `sub`, `email`, `role`, `revoked`, `revokedAt`, `issuedAt`, `expireAt`.
- **Required Fields (5):** `jti`, `sub`, `email`, `role`, `expireAt`.
- **Optional Fields (3):** `revoked`, `revokedAt`, `issuedAt`.
- **Indexes (5):** `_id_`, `jti_1` (**unique**), `email_1`, `revoked_1`, `expireAt_1` (**TTL index: `expireAfterSeconds: 0`**).
- **Unique Indexes (1):** `jti_1`.
- **Approximate Record-Size Risks:** **NEGLIGIBLE (< 10 KB total; self-cleaning via TTL index on `expireAt`).**
- **Personal Information (PII) Stored:** Staff advisor/admin login email.
- **CRM Essentiality Verdict:** **ESSENTIAL** (JWT revocation & RBAC session security).

---

#### MODEL 18: `AuthRateLimit` (`src/models/AuthRateLimit.ts`)
- **Collection Name:** `authratelimits`
- **Stored Fields (6):** `key`, `attempts`, `lockedUntil`, `expireAt`, `createdAt`, `updatedAt`.
- **Required Fields (2):** `key`, `expireAt`.
- **Optional Fields (4):** `attempts`, `lockedUntil`, `createdAt`, `updatedAt`.
- **Indexes (3):** `_id_`, `key_1` (**unique**), `expireAt_1` (**TTL index: `expireAfterSeconds: 0`**).
- **Unique Indexes (1):** `key_1`.
- **Approximate Record-Size Risks:** **NEGLIGIBLE (< 10 KB total; self-cleaning via TTL index on `expireAt`).**
- **Personal Information (PII) Stored:** Hashed IP or login throttle key.
- **CRM Essentiality Verdict:** **ESSENTIAL** (Brute-force login protection).
