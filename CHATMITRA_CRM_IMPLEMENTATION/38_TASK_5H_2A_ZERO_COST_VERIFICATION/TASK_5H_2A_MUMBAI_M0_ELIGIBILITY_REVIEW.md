# TASK 5H.2A — AWS MUMBAI (`ap-south-1`) M0 FREE-CLUSTER ELIGIBILITY REVIEW
## STRICT SEPARATION OF DEDICATED REGION SUPPORT VS. FREE-TIER (M0) ELIGIBILITY
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date Checked:** 18 November 2026 (`2026-11-18`)  
**Execution Mode:** Strictly Read-Only Documentation Verification  
**Provisioning Authorization:** **NOT GRANTED**

---

### 1. EXECUTIVE DETERMINATION ON AWS MUMBAI (`ap-south-1`) M0

$$\mathbf{STATUS:\ NOT\ VERIFIED\ /\ REQUIRES\ OWNER\ CONFIRMATION}$$

| Verification Question | Audit Finding | Official Source Checked | Status Label |
| :--- | :--- | :--- | :---: |
| **1. Is AWS Mumbai (`ap-south-1`) an officially supported MongoDB Atlas region?** | **Yes.** Listed in the AWS regions table with Atlas API identifier `AP_SOUTH_1` and default CIDR `192.168.0.0/21`. | `https://www.mongodb.com/docs/atlas/reference/amazon-aws/` | **`VERIFIED` (General / Dedicated Region)** |
| **2. Does the official AWS region table prove that Free/M0 clusters are available in Mumbai (`ap-south-1`)?** | **No.** The published AWS region documentation does **not** include a static Free/M0 availability marker per region. Official Free/Shared documentation states Free clusters are offered on a subset of regions determined dynamically in the Atlas UI or Atlas CLI. | `https://www.mongodb.com/docs/atlas/reference/amazon-aws/`<br/>`https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/` | **`NOT VERIFIED`** |
| **3. Has Mumbai (`ap-south-1`) M0 availability been verified on the Owner's live Atlas account at ₹0 without a credit card?** | **No.** Because Task 5G, 5G.1, 5G.2, 5H.1, and 5H.2A strictly prohibit creating or accessing live Atlas projects/clusters, live UI verification has **not** been performed. | Read-Only Execution Constraint (Section 3) | **`REQUIRES OWNER CONFIRMATION`** |
| **4. Is automatic fallback to Singapore (`ap-southeast-1`) or another region authorized if Mumbai M0 is unavailable?** | **No.** Prior statements suggesting automatic fallback to Singapore are **formally retracted**. Region substitution alters data residency outside India and requires a separate, explicit Owner decision. | Task 5H.2A Section 2 (Task F) | **`INCORRECT` (Retracted) $\rightarrow$ `SEPARATE OWNER DECISION REQUIRED`** |

---

### 2. WHY MUMBAI FREE-CLUSTER ELIGIBILITY CANNOT BE INFERRED

1. **Dedicated vs. Multi-Tenant Shared Infrastructure:**
   - Dedicated clusters (`M10+`) provision on-demand single-tenant EC2 instances inside an isolated Atlas VPC in any supported AWS region (`ap-south-1`).
   - Free clusters (`M0`) run as logical tenants inside pre-provisioned, multi-tenant shared replica sets managed by MongoDB. If MongoDB's shared M0 pool in `ap-south-1` reaches capacity or is restricted for new accounts, `ap-south-1` can remain selectable for paid `M10+` or `Flex` tiers while being disabled or grayed out for `M0 Free`.
2. **Project & Organization Quota Rules:**
   - Official documentation (`https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/`) enforces a hard limit of **one Free (M0) cluster per Atlas project**. If an existing Atlas project already contains an M0 cluster in any region, the `M0 Free` option is unavailable in that project until a fresh isolated project (`AVANI-AI-CRM-TESTING`) is used.

---

### 3. RETRACTION OF AUTOMATIC SINGAPORE (`ap-southeast-1`) FALLBACK

In Task 5G.2 (`TASK5G2_MUMBAI_REGION_AVAILABILITY.md`) and Task 5H.1 (`TASK_5H_1_EXECUTIVE_SUMMARY.md`), it was suggested that if AWS Mumbai (`ap-south-1`) M0 were unavailable, the deployment could fall back to AWS Singapore (`ap-southeast-1`).

Under Task 5H.2A (Task F), that automatic fallback is **formally revoked**:
- **Strict Rule:** Even for synthetic test data (`SYNTH_LEAD_001`, `+919999900001`–`05`), deploying outside India (`ap-south-1`) may **never** be done automatically.
- **Mandatory Procedure if Mumbai M0 Is Unavailable at ₹0:**
  1. **STOP provisioning immediately.**
  2. **Do NOT select Flex, M10, or any paid tier in Mumbai.**
  3. **Do NOT select Singapore or any non-Mumbai region.**
  4. **Continue 100% local free-only testing (Option A)** and report the regional availability status to the Project Owner for a separate written decision.
