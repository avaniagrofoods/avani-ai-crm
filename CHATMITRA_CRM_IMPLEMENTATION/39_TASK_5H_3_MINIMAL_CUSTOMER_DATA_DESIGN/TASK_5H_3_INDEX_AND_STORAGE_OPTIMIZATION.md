# TASK 5H.3 — INDEX AND STORAGE OPTIMIZATION AUDIT
## M0 STORAGE AUDIT, INDEX RATIONALIZATION & CAPACITY PROJECTIONS (500 TO 10,000 CUSTOMERS)
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026 (`2026-11-18`)  
**Execution Mode:** Strictly Read-Only Audit & Theoretical Storage Modeling  
**Hard Storage Cap:** **512.00 MB (Data + Indexes Combined)**  
**Conservative Planning Target:** **350.00 MB (68.36% of Hard Limit; 162.00 MB Safety Buffer)**

---

### 1. OFFICIAL ATLAS FREE/M0 TECHNICAL CONSTRAINTS BASELINE (SECTION F)

All storage and index calculations use the official MongoDB Atlas Free/M0 limits:

| M0 Technical Parameter | Official Atlas Free/M0 Limit | AVANI Conservative Planning Target | Operational Guardrail |
| :--- | :--- | :--- | :--- |
| **Total Storage (Data + Indexes)** | **512.00 MB** hard limit | **350.00 MB** maximum target | Leave $\ge 162$ MB (31.6%) free for WiredTiger block padding, index rebuilds, and metadata. |
| **Maximum Concurrent Connections** | **500** connections | **$\le 50$** total connections | `src/lib/db.ts` enforces `maxPoolSize: 10` per runtime worker instance. |
| **Maximum Throughput** | **100** CRUD operations/sec | **$\le 40$** CRUD operations/sec | Throttle bulk CSV imports and batch updates to avoid 100 ops/sec throttling. |
| **Maximum Databases & Collections** | **100** DBs / **500** Collections | **1** DB (`avani_ai_crm_test`) / **$\le 12$** Collections | Consolidate redundant collections (`Contact`, `Interaction`, `DocumentModel`). |
| **Inactivity Auto-Pause** | **30 days** of zero connections | Connect / ping every **14–21 days** | *Section F Correction:* Official documentation currently states that inactive Free clusters are automatically paused after **30 days** of inactivity. |
| **Cost & Add-Ons** | **₹0 / $0** | **₹0 / $0** | No paid upgrades (Flex/M10+) and no paid backup add-ons permitted. |

---

### 2. TEN-POINT STORAGE & INDEX BLOAT AUDIT (SECTION E)

| # | Audit Category | Verified Issue Found in Project 2 (`src/models/*.ts`) | Estimated Storage Waste (at 10,000 Customers) | Recommended Optimization (For Separate Future Task) |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Existing Indexes Inventory** | **62 total indexes** across 17 collections in `CP26_6_INDEX_PARITY.csv` (17 `_id_` + 45 secondary/unique indexes). | ~202.75 MB index overhead at 10k customers under current high-volume tables. | Prune redundant/unused indexes down to ~22 essential indexes (~28.87 MB at 10k customers). |
| **2** | **Duplicate / Overlapping Indexes** | • `messages` has **3 separate indexes** on message identifiers (`messageId_1`, `providerMessageId_1`, `idempotencyKey_1`) plus `correlationId_1`.<br/>• `workflowtriggers` has **2 unique indexes** on identical event keys (`eventId_1` and `idempotencyKey_1`) plus `correlationId_1`. | ~65.00 MB of duplicate B-tree index entries across `messages` and `workflowtriggers`. | Keep **1 unique deduplication index** per collection (`providerMessageId_1` on `messages`; `eventId_1` on `webhookinboxes`). |
| **3** | **Unnecessary Indexes** | • `leads`: `providerCallId_1`, `providerMessageId_1`, `correlationId_1`, `idempotencyKey_1` (rarely queried on `leads` once created).<br/>• `authsessions`: single-field boolean index `revoked_1` (low-cardinality boolean index; already lookup by `jti_1`). | ~18.50 MB unnecessary B-tree index pages. | Drop low-cardinality (`revoked_1`) and write-once trace indexes (`correlationId_1`, `providerCallId_1`) on `leads`. |
| **4** | **Large Text & `Mixed` Fields** | `WebhookInbox.payload` (`Mixed`), `Call.transcript` (`Mixed`), `Call.providerResponse` (`Mixed`), `Message.providerResponse` (`Mixed`), `Message.media` (`Mixed`), `Schedule.executionResult` (`Mixed`). | ~610.00 MB of unstructured JSON dumps at 10k customers. | **Prohibit storing raw `Mixed` payloads**; cap `Message.text` to $\le 240$ chars and `Call.summary` to $\le 250$ chars. |
| **5** | **Repeated Customer Information** | Customer `phone`, `name`, `email`, and `city` are duplicated across `Lead`, `Contact`, `Conversation` (`customerPhone`), `Message` (`phone`, `senderPhone`, `recipientPhone`), and `Call` (`recipientPhone`). | ~38.00 MB of repeated phone/name strings + extra indexes. | Store customer profile **once** on `Lead`; reference solely via `leadId` in `Message` and `Call`. |
| **6** | **Duplicate Webhook Events** | Every inbound WhatsApp message writes to `WebhookInbox`, `WorkflowTrigger`, `ProviderLedger`, `Interaction`, `Message`, and `Lead.interactions[]` (6 separate writes for 1 event!). | ~480.00 MB of multi-table event duplication + 6x write ops/sec penalty. | Consolidate to `WebhookInbox` (lightweight hash with 7-day TTL) + `Message` (1 record per message). |
| **7** | **Unnecessary Historical Payloads** | `WebhookInbox` retains `ARCHIVED_HISTORICAL` and `COMPLETED` raw webhook bodies forever (zero TTL index). | ~393.00 MB at 10k customers (avg 15 webhook events/customer). | Store only 64-byte SHA-256 `payloadHash` + `eventId` and attach a **7-day TTL index** (`expireAfterSeconds: 604800`). |
| **8** | **Excessive Message History** | `Conversation.history[]` duplicates the `messages` collection, and outbound delivery status updates store full `providerResponse` payloads. | ~317.50 MB across `messages` and `conversations`. | Remove `Conversation.history[]`; keep only the latest 10–15 compact message records per customer in `messages`. |
| **9** | **Unbounded Embedded Arrays** | **9 unbounded arrays** across models: `Lead.stageHistory[]`, `Lead.assignmentHistory[]`, `Lead.followUpTasks[]`, `Lead.documentChecklist[]`, `Lead.interactions[]`, `Document.auditLog[]`, `Conversation.history[]`, `Call.webhookPayloads[]`, `Template.components[]`. | Causes BSON document relocation fragmentation and 4–18 KB `Lead` documents. | Eliminate `Call.webhookPayloads[]`, `Document.auditLog[]`, `Conversation.history[]`, and `Lead.interactions[]`; cap any remaining status array with `$slice: -5`. |
| **10** | **Unnecessary Audit Records** | `ProviderLedger`, `WorkflowTrigger`, and `Interaction` retain all historical attempts forever without TTL expiration. | ~88.00 MB at 10k customers. | Apply a **7-day to 14-day TTL index** on transient operational logs (`ProviderLedger`, `WorkflowTrigger`) and drop duplicate `Interaction` writes. |

---

### 3. THEORETICAL M0 STORAGE ESTIMATES (500 TO 10,000 CUSTOMERS)

> [!NOTE]
> **Explicit Modeling Disclaimer (Section E):**
> The storage figures below are **theoretical planning estimates** based on BSON field sizes, secondary index key widths, and a 15% WiredTiger block/allocation padding reserve. Actual MongoDB Atlas M0 storage consumption depends on live document lengths, string encodings, and WiredTiger checkpoint states; **these capacities are not guaranteed**.

#### A. PER-CUSTOMER BSON & INDEX FOOTPRINT ASSUMPTIONS
1. **Current Unoptimized Schema (`118.08 KB` / customer effective):**
   - Raw BSON Data: **`85.05 KB`** / customer (`Lead` 6.50 KB + `Contact` 0.35 KB + `Conversation` 4.20 KB + `DocumentModel` 1.80 KB + 12 `Message` records [19.20 KB] + 15 `WebhookInbox` raw payloads [36.00 KB] + 1.5 `Call` records [12.00 KB] + 10 transient logs [5.00 KB]).
   - Index Overhead: **`17.63 KB`** / customer across 62 indexes.
   - WiredTiger 15% Block Padding Reserve: **`15.40 KB`** / customer.
   - Fixed Baseline Metadata (`advisors`, `lenders`, `templates`, `schedules`, `broadcasts`, `auth*`): **`512.00 KB`** (0.50 MB).
2. **Recommended Minimal Customer-Data Model (`8.50 KB` / customer effective — 92.8% reduction):**
   - Raw BSON Data: **`4.88 KB`** / customer (`Customer/Lead + Application + Consent` 0.86 KB + 10 compact `Message` records [3.20 KB] + 1.5 compact `Call` summaries [0.42 KB] + rolling 7-day TTL `WebhookInbox` hash [0.40 KB] + `0.00 KB` file/document storage).
   - Index Overhead: **`2.51 KB`** / customer across essential indexes (~51.4% index-to-data ratio).
   - WiredTiger 15% Block Padding Reserve: **`1.11 KB`** / customer (`5.612 KB` effective data + `2.8865 KB` effective index = `8.4985 KB`).
   - Fixed Baseline Metadata: **`256.00 KB`** (0.25 MB).

#### B. CAPACITY PROJECTION TABLE (CURRENT VS. MINIMAL M0 DESIGN)

| Customer Count | Current Unoptimized Total (MB) | Current % of 512 MB Hard Cap | Current Status vs. 350 MB Target | Minimal Design Data + WT (MB) | Minimal Design Indexes + WT (MB) | Minimal Design Total (MB) | Minimal % of 350 MB Target | Minimal % of 512 MB Hard Cap | Minimal Design M0 Verdict |
| :-: | :-: | :-: | :--- | :-: | :-: | :-: | :-: | :-: | :--- |
| **500** | **58.16 MB** | 11.36% | Safe (< 350 MB) | 2.92 MB | 1.48 MB | **4.40 MB** | **1.26%** | **0.86%** | **SAFE (>98% M0 Headroom)** |
| **1,000** | **115.81 MB** | 22.62% | Safe (< 350 MB) | 5.66 MB | 2.89 MB | **8.55 MB** | **2.44%** | **1.67%** | **SAFE (>97% M0 Headroom)** |
| **5,000** | **577.07 MB** | **112.71%** | **BREACHES 350 MB & 512 MB!** | 27.58 MB | 14.17 MB | **41.75 MB** | **11.93%** | **8.15%** | **SAFE (88% Below 350 MB Target)** |
| **10,000** | **1,153.64 MB** | **225.32%** | **CRITICAL 2.25x OVERFLOW!** | 54.98 MB | 28.26 MB | **83.24 MB** | **23.78%** | **16.26%** | **SAFE (266.76 MB Below 350 MB Target)** |
