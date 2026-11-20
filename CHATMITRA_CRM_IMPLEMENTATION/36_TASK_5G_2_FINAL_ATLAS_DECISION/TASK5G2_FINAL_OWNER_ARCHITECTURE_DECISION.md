# TASK 5G.2 — FINAL OWNER ARCHITECTURAL DECISION & RECOMMENDATION
## ATLAS ARCHITECTURE, AUTHENTICATION SELECTION & PRE-PROVISIONING GOVERNANCE

**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Execution Mode:** STRICTLY READ-ONLY ARCHITECTURAL RECOMMENDATION  
**Authority:** Task 5G.2 Final Architectural Audit  

---

### 1. FORMAL ARCHITECTURAL DECISION SELECTION

In strict compliance with Section 8 of the Master Instruction, Antigravity formally selects and records:

$$\mathbf{FINAL\ DECISION:\ A.\ M0\ +\ SCRAM-SHA-1\ APPROVED\ FOR\ OWNER\ CONSIDERATION}$$

> [!IMPORTANT]
> **GOVERNANCE NOTICE:**  
> This document constitutes an **architectural recommendation only**. It **DOES NOT** authorize provisioning of any MongoDB Atlas resources, opening of network sockets, modification of application code, or creation of cloud accounts.

---

### 2. SUMMARY OF CORE FINDINGS & CORRECTIONS (TASK 5G.2)

1. **Authentication Capabilities Corrected:**
   - Official MongoDB documentation confirms that **Free/M0 clusters support SCRAM-SHA-1, X.509 Certificates, and AWS IAM**.
   - Free/M0 clusters **do not support SCRAM-SHA-256**.
   - Dedicated clusters (**M10+**) support **SCRAM-SHA-1, SCRAM-SHA-256, X.509 Certificates, and AWS IAM**.
2. **Application Compatibility Verified:**
   - Inspection of `src/lib/db.ts` confirms that **SCRAM-SHA-1** and **SCRAM-SHA-256** are **100% compatible immediately with zero application code changes**.
   - Both **X.509** and **AWS IAM** require modifying `src/lib/db.ts` to inject client certificate file paths or credential provider chains, which violates the current change freeze.
3. **AWS Mumbai Region Availability:**
   - Documented as **`REQUIRES ATLAS UI CONFIRMATION`** because MongoDB dynamically manages Free/M0 cluster capacity and does not maintain static Free-tier markers on the AWS region documentation page.
4. **M10 Pricing Calculation Corrected:**
   - The starting rate of $0.08/hour covers the **entire 3-node replica set**, not individual nodes.
   - The estimated all-inclusive monthly operating cost for an M10 cluster in Mumbai (including backups, egress, and 18% Indian GST) is **~$85.00 to $105.00 / month** (~₹7,100 to ₹8,800 INR/month), not $175–$210/month.
   - This figure is explicitly labeled an **ESTIMATE** requiring confirmation in the Atlas pricing calculator prior to any deployment.

---

### 3. THE ARCHITECTURAL TRADE-OFF AT A GLANCE

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ARCHITECTURAL PATHWAYS                          │
├────────────────────────────────────────────────────────────────────────┤
│  OPTION A (RECOMMENDED): M0 Free Tier + SCRAM-SHA-1                   │
│  • Cost:            $0.00 / month                                      │
│  • Code Impact:     0 lines modified in src/lib/db.ts                  │
│  • Security:        TLS 1.2+ mandatory; 100% isolated project & DB    │
│  • Prerequisite:    Requires Atlas UI confirmation of Mumbai M0       │
│                                                                        │
│  OPTION D (FORMAL PAID ALTERNATIVE): M10 Dedicated + SCRAM-SHA-256     │
│  • Cost:            ~$85.00 – $105.00 / month (~₹7,500 INR/mo)        │
│  • Code Impact:     0 lines modified in src/lib/db.ts                  │
│  • Security:        Native SCRAM-SHA-256 + Continuous Cloud Backups    │
│  • Prerequisite:    Requires billing setup & pricing calculator check  │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 4. MASTER DELIVERABLES INVENTORY

All seven architectural, security, and pricing reports have been compiled in:
`CHATMITRA_CRM_IMPLEMENTATION/36_TASK_5G_2_FINAL_ATLAS_DECISION/`

| Report # | Title | Purpose |
| :---: | :--- | :--- |
| **1** | [TASK5G2_CORRECTED_AUTHENTICATION_MATRIX.md](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/CHATMITRA_CRM_IMPLEMENTATION/36_TASK_5G_2_FINAL_ATLAS_DECISION/TASK5G2_CORRECTED_AUTHENTICATION_MATRIX.md) | Corrected official Atlas authentication matrix across tiers. |
| **2** | [TASK5G2_M0_X509_AWS_IAM_FEASIBILITY.md](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/CHATMITRA_CRM_IMPLEMENTATION/36_TASK_5G_2_FINAL_ATLAS_DECISION/TASK5G2_M0_X509_AWS_IAM_FEASIBILITY.md) | Technical and operational feasibility analysis of X.509 and AWS IAM. |
| **3** | [TASK5G2_APPLICATION_COMPATIBILITY.md](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/CHATMITRA_CRM_IMPLEMENTATION/36_TASK_5G_2_FINAL_ATLAS_DECISION/TASK5G2_APPLICATION_COMPATIBILITY.md) | Read-only inspection of Mongoose 9.7, Driver 7.2 and `src/lib/db.ts`. |
| **4** | [TASK5G2_MUMBAI_REGION_AVAILABILITY.md](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/CHATMITRA_CRM_IMPLEMENTATION/36_TASK_5G_2_FINAL_ATLAS_DECISION/TASK5G2_MUMBAI_REGION_AVAILABILITY.md) | Rigorous audit of AWS Mumbai `ap-south-1` documentation status. |
| **5** | [TASK5G2_M10_COST_BREAKDOWN.md](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/CHATMITRA_CRM_IMPLEMENTATION/36_TASK_5G_2_FINAL_ATLAS_DECISION/TASK5G2_M10_COST_BREAKDOWN.md) | Corrected cost calculation: base cluster compute vs. total operating costs. |
| **6** | [TASK5G2_SECURITY_TRADEOFFS.md](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/CHATMITRA_CRM_IMPLEMENTATION/36_TASK_5G_2_FINAL_ATLAS_DECISION/TASK5G2_SECURITY_TRADEOFFS.md) | Comparative evaluation of authentication strength, TLS, and isolation. |
| **7** | [TASK5G2_FINAL_OWNER_ARCHITECTURE_DECISION.md](file:///C:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/CHATMITRA_CRM_IMPLEMENTATION/36_TASK_5G_2_FINAL_ATLAS_DECISION/TASK5G2_FINAL_OWNER_ARCHITECTURE_DECISION.md) | Final executive decision and pre-provisioning governance report. |

- **Primary Brain Artifact:** [TASK5G2_FINAL_OWNER_ARCHITECTURE_DECISION.md](file:///C:/Users/ALPHA-1/.gemini/antigravity/brain/4642e33b-9788-4cca-b4c6-d2d386121745/TASK5G2_FINAL_OWNER_ARCHITECTURE_DECISION.md)

---

### 5. REQUIRED OWNER APPROVAL GATES PRIOR TO ANY PROVISIONING

To advance to provisioning, the Project Owner must review these findings and provide explicit written instruction on:

1. **Architecture Decision:**
   - **Option A:** Approve Atlas M0 Free Tier with `SCRAM-SHA-1` over TLS 1.2+ ($0.00/month, pending UI confirmation of Mumbai).
     *OR*
   - **Option D:** Approve Atlas M10 Dedicated Tier with `SCRAM-SHA-256` (~$85.00–$105.00/month).
2. **Task 5H.1 Provisioning Scope:**
   - Authorize creation of dedicated Atlas Project (`AVANI-AI-CRM-TESTING`), database (`avani_ai_crm_test`), and scoped user (`als_crm_test_worker`).
3. **Task 5H.2 Live Integration Scope:**
   - Authorize read-only live tests (S45–S48).
   - Separately authorize write-gated synthetic CRUD (S49) and teardown (S50).

---

### 6. MANDATORY STOP NOTICE

In strict compliance with Section 10 of the Master Instruction:
- **All operations are completely HALTED.**
- No cloud accounts, projects, clusters, or databases have been created.
- No database connections or DNS queries have been initiated.
- No application source code or tests have been modified.
- No Git commits or pushes have been made.

**Awaiting Project Owner instruction.**
