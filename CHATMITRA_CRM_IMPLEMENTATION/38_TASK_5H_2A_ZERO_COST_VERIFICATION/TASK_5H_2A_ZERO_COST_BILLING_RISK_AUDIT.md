# TASK 5H.2A — ZERO-COST BILLING RISK AUDIT & STRICT ₹0 CONDITIONS
## ENFORCEMENT OF THE 12 MANDATORY ₹0 COST CONDITIONS & FEATURE AVAILABILITY AUDIT
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026  
**Execution Mode:** Strictly Read-Only Cost & Billing Risk Audit  
**Hard Cost Ceiling:** **₹0.00 INR / $0.00 USD**

---

### 1. ENFORCEMENT OF THE 12 STRICT ₹0 COST CONDITIONS (TASK C)

Under Section 2 (Task C) of the Master Prompt, the future test architecture must satisfy **all twelve zero-cost conditions** without exception. Any feature that requires payment or billing activation is formally marked **`UNAVAILABLE`**:

| # | Mandatory Task C Zero-Cost Condition | Enforcement Rule & Operational Safeguard | Dependent Features Marked **`UNAVAILABLE`** Under ₹0 Rule | Compliance Status |
| :-: | :--- | :--- | :--- | :---: |
| **1** | **No paid tier** | Strictly prohibit selecting any billable database, hosting, or SaaS tier across all tools. | Dedicated compute, SLA uptime guarantees, custom WiredTiger cache sizing (`UNAVAILABLE`). | **ENFORCED** |
| **2** | **No Flex tier** | Do not select or upgrade to MongoDB Atlas Flex tier ($8–$30/month). | 5 GB dynamic shared storage and 100–500 ops/sec auto-scaling (`UNAVAILABLE`). | **ENFORCED** |
| **3** | **No M10 or higher** | Do not select or provision Atlas M10, M20, M30, or any dedicated cluster ($0.08+/hour). | `SCRAM-SHA-256` on Atlas, customer-managed X.509 CAs, LDAP, dedicated vCPUs (`UNAVAILABLE`). | **ENFORCED** |
| **4** | **No paid backup subscription** | Do not enable Atlas Cloud Backups, continuous snapshots, or paid point-in-time recovery (PITR). | Automated cloud snapshots & PITR on Atlas test database (`UNAVAILABLE` — unnecessary for synthetic ephemeral fixtures). | **ENFORCED** |
| **5** | **No paid support plan** | Use Community/Free documentation only; never activate Atlas Developer/Enterprise Support ($49+/mo). | 24/7 ticketed MongoDB commercial engineering support (`UNAVAILABLE`). | **ENFORCED** |
| **6** | **No paid add-ons** | Keep Atlas Data Federation, Atlas Stream Processing, Atlas Search dedicated nodes, and BI Connector disabled. | Billable Atlas analytical/streaming add-ons (`UNAVAILABLE`). | **ENFORCED** |
| **7** | **No paid network services** | Do not configure AWS VPC Peering, AWS PrivateLink, or paid static NAT gateways. | Private VPC peering & AWS PrivateLink endpoints on test cluster (`UNAVAILABLE` — use `/32` IP Access List + TLS 1.2+ only). | **ENFORCED** |
| **8** | **No billing activation** | Never link an AWS, GCP, or Azure Cloud Marketplace billing account or enable organization billing. | Marketplace consolidated billing (`UNAVAILABLE`). | **ENFORCED** |
| **9** | **No credit-card entry** | Never enter any credit card, debit card, corporate card, or virtual card into Atlas, GitHub, or any testing tool. | Any service or region requiring credit-card identity gating (`UNAVAILABLE`). | **ENFORCED** |
| **10** | **No recurring-payment mandate** | Never authorize an RBI e-Mandate, UPI AutoPay mandate, or international standing instruction. | Auto-renewing cloud subscriptions (`UNAVAILABLE`). | **ENFORCED** |
| **11** | **No free trial that later becomes paid** | Reject all Category 3 time-limited trials or promotional credit programs ($200 Atlas credits, 14-day SaaS trials) that convert to paid billing. | Promotional trial credits for M10+ clusters or paid SaaS tools (`UNAVAILABLE`). | **ENFORCED** |
| **12** | **No automatic paid upgrade** | Keep "Auto-scale tier / storage" permanently non-existent (M0 has no auto-upgrade when no card is on file). | Automatic storage expansion beyond 512 MB (`UNAVAILABLE`). | **ENFORCED** |

---

### 2. INDIAN PAYMENT VERIFICATION, RBI E-MANDATE & TAX RISKS

A specific audit of Indian banking, payment gateway, and tax regulations identifies four concrete financial risks that occur **even when a service advertises a "$0 tier" if a payment card is attached**:

1. **Card Verification Charge / Hold:**
   - International cloud providers (including MongoDB Atlas, AWS, and GitHub) validate newly entered payment cards by placing a **$1.00 USD (approx. ₹84–₹90 INR)** or **₹2.00 INR** pre-authorization charge. Even if refunded days later, this violates a strict ₹0.00 cash-outflow rule and can leave non-refundable foreign-exchange conversion spreads.
2. **RBI Recurring e-Mandate (Additional Factor of Authentication — AFA):**
   - Under Reserve Bank of India (RBI) directives on recurring card transactions, registering an Indian credit or debit card with an overseas merchant creates an active **Standing Instruction (SI) / e-Mandate** (commonly authorized up to ₹15,000 INR per transaction without requiring a fresh OTP). Once an e-mandate is active, any accidental click on "Upgrade to Flex ($8/mo)" or "Enable Backup" will auto-debit the card without an OTP challenge.
3. **Foreign Currency (FX) Markup + GST on Markup:**
   - Indian banks levy a **2.0% to 3.5% cross-border currency markup** on USD-denominated cloud charges, plus **18% GST on the bank markup fee**.
4. **18% IGST / OIDAR Tax on Overseas Cloud Invoices:**
   - Under Indian GST law (Online Information Database Access and Retrieval — OIDAR services), foreign cloud vendors charge **18% IGST** on B2C invoices or require reverse-charge compliance (RCM) for B2B GSTIN holders.

> [!CAUTION]
> **ABSOLUTE PREVENTION RULE:**
> The **only** mathematically guaranteed defence against verification holds, RBI e-mandates, FX markups, and IGST charges is **zero payment-method entry**. Under no circumstances may any card, bank account, or UPI handle be entered. If the Atlas UI requests a payment method during M0 setup, the user must **ABORT AND STOP IMMEDIATELY**.

---

### 3. RETRACTION OF TASK 5H.1'S "₹18,228 / $217 MONTHLY SAVINGS" CLAIM

In Task 5H.1 (`TASK_5H_1_COMPLETE_COST_AUDIT.xlsx`, Sheet 2), an aggregate "Monthly Cost Avoided" of **₹18,228.00 INR ($217.00 USD)** was reported. Upon critical audit in Task 5H.2A, this figure is classified as **`INCORRECT` and formally retracted** for three reasons:

1. **Double-Counting Mutually Exclusive Database Tiers:** Sheet 2 summed *both* MongoDB Atlas M10 ($95/mo) *and* MongoDB Atlas Flex ($30/mo) simultaneously. A single test environment would never deploy both M10 and Flex at the same time.
2. **Unverified Hypothetical Usage Assumptions:** The figures for Live Paid WhatsApp/Vapi/Twilio ($50/mo), Paid Postman + ngrok ($22/mo), and Vercel Pro ($20/mo) were illustrative estimates rather than verified quotes or actual historical invoices.
3. **Corrected Accounting Standard:** In `TASK_5H_2A_CORRECTIONS_REGISTER.xlsx`, only verified ₹0.00 local tool costs and individually documented official starting prices (e.g., Atlas Flex starting at $8/mo up to $30/mo; Atlas M10 starting at $0.08/hr) are recorded separately without summing mutually exclusive options into an inflated savings total.
