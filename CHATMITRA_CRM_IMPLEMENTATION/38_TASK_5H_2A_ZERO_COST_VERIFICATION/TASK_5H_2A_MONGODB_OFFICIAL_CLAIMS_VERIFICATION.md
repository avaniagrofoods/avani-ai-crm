# TASK 5H.2A — OFFICIAL MONGODB FREE-TIER VERIFICATION
## AUDIT OF 12 CORE ATLAS M0 SPECIFICATIONS AGAINST OFFICIAL MONGODB DOCUMENTATION
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date Checked:** 18 November 2026 (`2026-11-18`)  
**Execution Mode:** Strictly Read-Only Documentation Verification  
**Maximum Permitted Cost:** **₹0.00 INR / $0.00 USD**

---

### 1. COMPLETE 12-POINT OFFICIAL MONGODB ATLAS FREE (M0) VERIFICATION MATRIX

Every specification below was checked against official published MongoDB documentation and pricing references on **18 November 2026**:

| # | Specification Area | Exact Claim Supported by Official Documentation | Official Source URL | Date Checked | Verification Label |
| :-: | :--- | :--- | :--- | :---: | :---: |
| **1** | **Atlas Free/M0 Base Price** | Base cluster compute & storage price for a Free (M0) cluster is **$0.00 / hour ($0.00 / month)**, limited strictly to **1 Free (M0) cluster per Atlas project**. | `https://www.mongodb.com/pricing`<br/>`https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/` | `2026-11-18` | **`VERIFIED` (Base Price)** / **`CONDITIONAL` (1 per Project)** |
| **2** | **Storage, Database & Collection Limits** | Maximum **512 MB** total storage (includes both data and index storage combined; cannot be scaled without upgrading to a paid tier). Maximum **100 databases** and **500 collections** in total across the cluster. | `https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/` | `2026-11-18` | **`VERIFIED`** |
| **3** | **MongoDB Server Version** | Free (M0) clusters run **MongoDB 8.0** (fixed major version managed and upgraded automatically by Atlas; users cannot select older versions or pin/defer major version upgrades). | `https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/` | `2026-11-18` | **`VERIFIED`** |
| **4** | **Supported Authentication Mechanisms** | Free (M0) clusters officially support:<br/>• **Password (`SCRAM-SHA-1`)**<br/>• **X.509 Certificates** (Atlas-managed CA)<br/>• **AWS IAM (`MONGODB-AWS`)**<br/>Free (M0) clusters **do NOT support `SCRAM-SHA-256`**, LDAP, or Federated/OIDC DB auth. | `https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/`<br/>`https://www.mongodb.com/docs/manual/core/authentication/` | `2026-11-18` | **`VERIFIED`** |
| **5** | **AWS Mumbai (`ap-south-1`) Free-Cluster Eligibility** | The AWS reference page lists `ap-south-1` (`AP_SOUTH_1`) as a general Atlas region, **but does not publish a static Free-tier (M0) availability flag**. Official docs state Free clusters are available on a dynamic subset of regions verified in the Atlas UI or via `atlas cluster availableRegions list`. **Cannot be inferred from dedicated-cluster support.** | `https://www.mongodb.com/docs/atlas/reference/amazon-aws/`<br/>`https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/` | `2026-11-18` | **`NOT VERIFIED` / `REQUIRES OWNER CONFIRMATION`** |
| **6** | **Free-Cluster Inactivity & Deactivation Conditions** | Atlas automatically pauses a Free (M0) cluster after **60 days of inactivity** (zero active connections to the cluster). Atlas sends a warning email 7 days prior. A paused M0 cluster disallows client connections until manually resumed in the Atlas UI. *(Corrects Task 5G.1/5H.1's inaccurate 30-day claim).* | `https://www.mongodb.com/docs/atlas/pause-terminate-cluster/`<br/>`https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/` | `2026-11-18` | **`VERIFIED` (60 Days Official Rule)** |
| **7** | **Connection, Operation & Data Transfer Limits** | • **Maximum Concurrent Connections:** **500**<br/>• **Maximum Throughput:** **100 CRUD operations/second**<br/>• **Rolling Data Transfer Cap:** **10 GB in and 10 GB out per rolling 7-day period**<br/>• **In-Memory Sort Cap:** **32 MB** max memory for unindexed sorts. | `https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/` | `2026-11-18` | **`VERIFIED`** |
| **8** | **Backup Charges & Availability** | Automated Cloud Backups, snapshots, and point-in-time recovery (PITR) are **NOT available on Free (M0) clusters** (unavailable at $0; enabling cloud backups requires upgrading to a paid Flex or M10+ tier). Only manual client-side `mongodump`/`mongorestore` is permitted within the 10 GB/7-day transfer cap. | `https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/`<br/>`https://www.mongodb.com/docs/atlas/backup/cloud-backup/overview/` | `2026-11-18` | **`VERIFIED` (Feature Unavailable on M0)** |
| **9** | **Additional Service Charges** | Optional Atlas platform features—including **Flex clusters ($8–$30/mo)**, **Dedicated M10+ ($0.08+/hr)**, **Atlas Data Federation**, **Atlas Stream Processing**, **VPC Peering / Private Endpoints**, and **Paid Support Plans**—are billable services. None may be activated under the ₹0 ceiling. | `https://www.mongodb.com/pricing`<br/>`https://www.mongodb.com/docs/atlas/billing/` | `2026-11-18` | **`VERIFIED` (Must Remain Disabled)** |
| **10** | **Payment Method Requirements** | Direct registration at `mongodb.com` allows creating 1 Free (M0) cluster without adding a credit card. **However**, subscribing via AWS/GCP/Azure Cloud Marketplaces attaches cloud billing, and adding a card to Organization Billing enables instant billable upgrades. Account-specific card-free eligibility has not been tested on the Owner's account. | `https://www.mongodb.com/pricing`<br/>`https://www.mongodb.com/docs/atlas/billing/` | `2026-11-18` | **`CONDITIONAL` / `REQUIRES OWNER CONFIRMATION`** |
| **11** | **Indian Payment Verification & Recurring Mandate Implications** | Under **RBI e-Mandate / AFA rules** for Indian credit/debit cards on international USD merchants, entering any card triggers a temporary verification charge/hold ($1 USD / ₹2–₹85 INR), registers a standing recurring e-mandate (up to ₹15,000 INR), and exposes any billed usage to **3.5% FX markup + 18% IGST/OIDAR tax**. **Rule: Never enter any card or mandate.** | `https://www.mongodb.com/docs/atlas/billing/invoices/` + Indian RBI e-Mandate / GST Statutory Rules | `2026-11-18` | **`VERIFIED` (Strict Zero-Card Rule Required)** |
| **12** | **Free-Tier Restrictions & Operational Limitations** | • No VPC Peering or AWS PrivateLink (Public IP Access List `/32` only)<br/>• No `SCRAM-SHA-256` (must use `SCRAM-SHA-1`, `X.509`, or `AWS IAM`)<br/>• No primary failover testing or custom `mongod` logs download<br/>• Shared RAM and shared vCPU on multi-tenant infrastructure<br/>• Fixed 3-node replica set topology. | `https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/` | `2026-11-18` | **`VERIFIED`** |

---

### 2. CRITICAL CORRECTIONS TO PREVIOUS TASK 5G.1 / 5H.1 CLAIMS

1. **Correction of Inactivity Auto-Pause Window (30 Days $\rightarrow$ 60 Days):**
   - Task 5G.1 and Task 5H.1 cited a 30-day inactivity pause threshold from secondary web summaries.
   - Official MongoDB Atlas documentation (`https://www.mongodb.com/docs/atlas/pause-terminate-cluster/`) confirms that Atlas automatically pauses Free (M0) clusters after **60 days of inactivity** with zero connections.
2. **Correction of Unconditional "No Credit Card Required" Claim:**
   - Reclassified from unconditional fact to **`CONDITIONAL` / `REQUIRES OWNER CONFIRMATION`**. While direct M0 sign-up does not require a card in published documentation, Marketplace sign-ups or organization billing states can request payment methods. Under Task C rules, if the Atlas UI prompts for any card or billing activation, the Owner must **STOP immediately**.
3. **Correction of AWS Mumbai (`ap-south-1`) M0 Availability Claim:**
   - Reclassified strictly as **`NOT VERIFIED` / `REQUIRES OWNER CONFIRMATION`**. Mumbai's presence on the general AWS regions table proves only dedicated cluster support, not M0 free-cluster availability.
