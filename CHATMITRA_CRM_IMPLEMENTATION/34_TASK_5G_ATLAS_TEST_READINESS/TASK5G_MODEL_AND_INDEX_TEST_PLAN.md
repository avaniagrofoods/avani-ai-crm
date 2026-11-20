# TASK 5G — MODEL & INDEX INVENTORY FRAMEWORK & PARITY TEST PLAN
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Role:** Database Reliability Engineer & MongoDB Architect  
**Status:** **AUTHORITATIVE SCHEMA & INDEX INVENTORY**

---

## 1. Executive Summary & Inventory Scope

This framework establishes the comprehensive schema catalog for all **18 Mongoose Models** and **42 declared secondary/unique indexes** in AVANI AI CRM.

In production, automatic index building (`autoIndex`) is strictly disabled to prevent performance degradation and table locking on live clusters. Therefore, the isolated test environment must verify that:
1. Every index required by application business logic exists with exact options (uniqueness, sparsity, TTL).
2. Unique indexes reliably throw `E11000` duplicate key exceptions when duplicate synthetic payloads arrive.
3. Sparse indexes permit multiple null/missing fields without uniqueness violations.
4. TTL indexes automatically expire ephemeral records (sessions and rate limits).

---

## 2. Complete Model & Index Parity Catalog (18 Models, 42 Declared Indexes)

| # | Model Name | Index Name / Fields | Index Type | Unique | Sparse | TTL | Purpose & Duplicate Risk | Parity Test Assertion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `Advisor` | `advisorId_1` (`advisorId`) | Secondary | **YES** | No | — | Canonical advisor identifier. Prevents duplicate staff IDs. | Duplicate `advisorId` throws `E11000` |
| **2** | `Advisor` | `email_1` (`email`) | Secondary | **YES** | No | — | Staff login & notifications. Prevents collision. | Duplicate `email` throws `E11000` |
| **3** | `AuthRateLimit` | `key_1` (`key`) | Secondary | **YES** | No | — | Client IP / action rate-limit bucket. | Key collision throttles duplicate request |
| **4** | `AuthRateLimit` | `expireAt_1` (`expireAt`) | TTL | No | No | `0s` | Automated eviction of expired rate-limit windows. | Document pruned after `expireAt` |
| **5** | `AuthSession` | `jti_1` (`jti`) | Secondary | **YES** | No | — | JWT ID tracking to prevent token replay. | Duplicate `jti` throws `E11000` |
| **6** | `AuthSession` | `email_1` (`email`) | Secondary | No | No | — | Session lookup by staff user email. | Fast retrieval of user sessions |
| **7** | `AuthSession` | `revoked_1` (`revoked`) | Secondary | No | No | — | Active vs revoked session filtering. | Fast filtering of revoked tokens |
| **8** | `AuthSession` | `expireAt_1` (`expireAt`) | TTL | No | No | `0s` | Automated eviction of expired user sessions. | Session pruned after `expireAt` |
| **9** | `Call` | `correlationId_1` (`correlationId`) | Secondary | No | No | — | Distributed trace correlation for voice calls. | Fast trace retrieval |
| **10** | `Call` | `leadId_1` (`leadId`) | Secondary | No | No | — | Foreign key mapping call to customer lead. | Fast call history lookup by lead |
| **11** | `Call` | `providerCallId_1` (`providerCallId`)| Secondary | No | No | — | CallKaro / Vapi provider call identifier. | Fast webhook call match |
| **12** | `Contact` | `phone_1` (`phone`) | Secondary | **YES** | No | — | Canonical customer phone. Prevents duplicate contacts. | Duplicate `phone` throws `E11000` |
| **13** | `Conversation` | `conversationId_1` (`conversationId`)| Secondary | **YES** | No | — | Unique multi-turn dialog session identifier. | Duplicate `conversationId` throws `E11000` |
| **14** | `Conversation` | `currentStage_1` (`currentStage`) | Secondary | No | No | — | Pipeline stage filtering for conversations. | Stage-based triage |
| **15** | `Conversation` | `customerPhone_1` (`customerPhone`)| Secondary | No | No | — | Customer phone lookup for inbox routing. | Phone-based conversation match |
| **16** | `Conversation` | `leadId_1` (`leadId`) | Secondary | No | No | — | Foreign key link from dialog to lead record. | Lead conversation history |
| **17** | `CrossSellOpportunity` | `leadId_1` (`leadId`) | Secondary | No | No | — | Lead cross-sell tracking. | Cross-sell lookup |
| **18** | `CrossSellOpportunity` | `referringLeadId_1` (`referringLeadId`)| Secondary | No | No | — | Referral tracking between borrowers. | Referral hierarchy |
| **19** | `DocumentModel`| `leadId_1` (`leadId`) | Secondary | No | No | — | Document store reference by borrower lead ID. | Fast document retrieval |
| **20** | `Interaction` | `interactionId_1` (`interactionId`) | Secondary | **YES** | No | — | Atomic interaction event log identifier. | Duplicate interaction ID blocked |
| **21** | `Lead` | `leadId_1` (`leadId`) | Secondary | **YES** | No | — | Canonical loan lead ID (`ALS-YYYY-XXXXXX`). | Duplicate `leadId` throws `E11000` |
| **22** | `Lead` | `phone_1` (`phone`) | Secondary | **YES** | No | — | Customer mobile number. Prevents duplicate leads. | Duplicate `phone` throws `E11000` |
| **23** | `Lead` | `stage_1` (`stage`) | Secondary | No | No | — | 20-stage canonical pipeline querying. | Fast stage aggregation |
| **24** | `Lead` | `idempotencyKey_1` (`idempotencyKey`)| Secondary | No | No | — | Lead generation request deduplication. | Fast request deduplication |
| **25** | `Lead` | `correlationId_1` (`correlationId`) | Secondary | No | No | — | Cross-system transaction correlation. | Trace query performance |
| **26** | `Lead` | `providerMessageId_1` | Secondary | No | No | — | Inbound message attribution. | Provider match performance |
| **27** | `Lead` | `providerCallId_1` | Secondary | No | No | — | Inbound voice call attribution. | Provider match performance |
| **28** | `Lender` | `lenderId_1` (`lenderId`) | Secondary | **YES** | No | — | Institutional lending partner identifier. | Duplicate `lenderId` throws `E11000` |
| **29** | `Message` | `messageId_1` (`messageId`) | Secondary | No | No | — | Internal message sequence ID. | Message query performance |
| **30** | `Message` | `leadId_1` (`leadId`) | Secondary | No | No | — | Foreign key to lead record. | Thread history performance |
| **31** | `Message` | `correlationId_1` (`correlationId`) | Secondary | No | No | — | Distributed trace ID across webhook hops. | Fast trace retrieval |
| **32** | `Message` | `providerMessageId_1` | Secondary | No | No | — | Meta/ChatMitra/AiSensy message identifier. | Webhook status match |
| **33** | `Message` | `idempotencyKey_1` (`idempotencyKey`)| Secondary | **YES** | **YES** | — | Critical message deduplication. Prevents double dispatch. | Duplicate `idempotencyKey` throws `E11000` |
| **34** | `ProviderLedger`| `correlationId_1` (`correlationId`) | Secondary | No | No | — | Outbound provider billing & audit ledger. | Fast ledger retrieval |
| **35** | `ProviderLedger`| `idempotencyKey_1` (`idempotencyKey`)| Secondary | No | No | — | Ledger transaction deduplication. | Prevents double billing entry |
| **36** | `Schedule` | `scheduleId_1` (`scheduleId`) | Secondary | **YES** | No | — | Scheduled follow-up job identifier. | Duplicate schedule ID blocked |
| **37** | `Schedule` | `scheduledAt_1` (`scheduledAt`) | Secondary | No | No | — | Cron worker time-window query index. | Cron queue polling performance |
| **38** | `Schedule` | `status_1` (`status`) | Secondary | No | No | — | Cron worker status query (`SCHEDULED`, `PROCESSING`).| Queue processing performance |
| **39** | `Schedule` | `idempotencyKey_1` (`idempotencyKey`)| Secondary | **YES** | **YES** | — | Prevents duplicate follow-up job creation. | Duplicate schedule job blocked |
| **40** | `Template` | `templateId_1` (`templateId`) | Secondary | **YES** | No | — | WhatsApp HSM template identifier. | Duplicate template ID blocked |
| **41** | `Template` | `providerTemplateId_1` | Secondary | No | No | — | Provider-side template registry ID. | Fast provider template match |
| **42** | `Template` | `templateName_1` (`templateName`) | Secondary | No | No | — | Human-readable template lookup. | Fast template search |
| **43** | `WebhookInbox` | `eventId_1` (`eventId`) | Secondary | **YES** | No | — | Webhook ingestion deduplication & worker lease. | Duplicate `eventId` throws `E11000` |
| **44** | `WorkflowTrigger`| `eventId_1` (`eventId`) | Secondary | **YES** | No | — | Trigger event deduplication. | Duplicate trigger event blocked |
| **45** | `WorkflowTrigger`| `idempotencyKey_1` (`idempotencyKey`)| Secondary | **YES** | No | — | Workflow step idempotency key. | Duplicate step execution blocked |
| **46** | `WorkflowTrigger`| `leadId_1` (`leadId`) | Secondary | No | No | — | Lead workflow progression. | Fast trigger lookup by lead |
| **47** | `WorkflowTrigger`| `stage_1` (`stage`) | Secondary | No | No | — | Workflow stage query. | Fast trigger stage filtering |
| **48** | `WorkflowTrigger`| `correlationId_1` (`correlationId`) | Secondary | No | No | — | Workflow trace correlation. | Fast trace retrieval |

*(Note: In addition to the default `_id_` primary index present on every collection, the table above enumerates the complete declared secondary index inventory).*

---

## 3. Non-Destructive Index Verification Process

When the isolated test database is provisioned, `verifyIndexSafety()` (implemented in `src/lib/db.ts` lines 652–680) will be executed for each model:

```typescript
export async function verifyIndexSafety(
  model: mongoose.Model<any>,
  conn: mongoose.Connection
): Promise<{ safe: boolean; missingIndexes: string[]; extraIndexes: string[] }>
```

- **Safety Guarantee:** Compares declared schema indexes against live database indexes via `collection.indexes()`.
- **Zero Drops:** Never executes `dropIndex()` or `dropDatabase()`.
- **Pre-Flight Validation:** If any required unique or secondary index is missing on the live test database, integration tests halt before data generation.
