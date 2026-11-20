# TASK 5G.2 — ATLAS M10 DETAILED COST BREAKDOWN
## OFFICIAL PRICING AUDIT, 3-NODE REPLICA SET ARCHITECTURE & TAX ESTIMATES

**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Execution Mode:** STRICTLY READ-ONLY PRICING CALCULATION  
**Authority:** Task 5G.2 Cost Verification  
**Official Reference:** https://www.mongodb.com/pricing  

---

### 1. OFFICIAL BASE PRICING MECHANICS FOR ATLAS M10

On the official MongoDB Atlas pricing portal (`https://www.mongodb.com/pricing`), the entry-level dedicated tier is specified as:
- **Tier:** M10 Dedicated
- **RAM:** 2.0 GB per node
- **vCPU:** 2 vCPUs per node
- **Storage:** 10 GB included (expandable)
- **Base Rate:** **Starting at $0.08 / hour**

#### CLARIFICATION OF TASK 5G.1 PRICING ASSUMPTION:
In Task 5G.1, the report calculated $0.08 × 3 nodes = $0.24/hour ($175.20/month) based on the assumption that Atlas billed per node. 
Official MongoDB Atlas billing documentation establishes that:
- **The $0.08/hour rate is the base hourly cluster rate for the standard 3-node replica set deployment.**
- It encompasses all three underlying data nodes (1 primary, 2 secondaries), automated failover orchestration, and baseline monitoring.
- Therefore, the base monthly compute cost for an M10 cluster is:
  $$\$0.08 \times 730\text{ hours} = \mathbf{\$58.40\ /\ \text{month}}$$
  (rather than $175/month for compute alone).

---

### 2. DETAILED COST BREAKDOWN: AWS MUMBAI (`ap-south-1`)

Because cloud infrastructure costs in AWS Mumbai (`ap-south-1`) carry a slight regional factor compared to US baseline regions, and because production-grade dedicated clusters incur backup and egress fees, the comprehensive cost breakdown is calculated below:

| Cost Component | Baseline / Calculation | Monthly Cost (USD) | Verification Status |
| :--- | :--- | :---: | :---: |
| **M10 Base Compute (3 Nodes)** | $0.08 – $0.095 / hour × 730 hours (Mumbai regional rate) | **$58.40 – $69.35** | **ESTIMATE** (Pricing page lists $0.08 starting) |
| **Included Storage** | 10 GB SSD storage included in base price | **$0.00** | **VERIFIED** |
| **Additional Storage** | 0 GB needed (Test suite S45–S50 requires < 5.0 MB) | **$0.00** | **VERIFIED** |
| **Continuous Cloud Backup** | Minimum retention package (Daily snapshots + 7-day logs) | **$10.00 – $15.00** | **ESTIMATE** (Depends on snapshot size) |
| **Data Transfer / Egress** | Local test runner egress (< 5 GB/month @ ~$0.09/GB) | **$0.50 – $2.00** | **ESTIMATE** (AWS data egress rate) |
| **Total Pre-Tax Monthly Cost** | Compute + Backup + Egress | **$68.90 – $86.35** | **ESTIMATE** |
| **Indian GST (18%)** | 18% Integrated GST on cloud services (if invoiced in India) | **$12.40 – $15.54** | **ESTIMATE** (Statutory tax rate) |
| **TOTAL ESTIMATED MONTHLY COST** | **All inclusive (Compute + Backup + Egress + GST)** | **~$81.30 – $101.90** | **ESTIMATE** |

---

### 3. CURRENCY CONVERSION (INDIAN RUPEES — INR)

Based on a prevailing reference exchange rate of approximately **₹84.00 INR per USD**:

$$\text{Base Compute Only: } \$58.40 \times ₹84.00 = \mathbf{₹4,905.60\ \text{INR / month}}$$
$$\text{Total Monthly Estimated Cost (with Backup \& GST): } \$95.00 \times ₹84.00 = \mathbf{₹7,980.00\ \text{INR / month}}$$

**Annual Estimated Commitment for M10:**
$$\approx \mathbf{₹95,000\ \text{to}\ ₹1,00,000\ \text{INR / year}}$$

---

### 4. BASE PRICE VS. TOTAL OPERATING COST SUMMARY

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ATLAS M10 PRICING REALITY                       │
├────────────────────────────────────────────────────────────────────────┤
│  Base Cluster Hourly Rate:                $0.08 / hour                 │
│  Base Monthly Compute (3-Node Replica):   ~$58.40 / month (₹4,900 INR) │
│  Backups, Network Egress & Multipliers:   ~$15.00 – $25.00 / month     │
│  Indian Statutory GST (18%):              ~$12.00 – $15.00 / month     │
│  --------------------------------------------------------------------- │
│  TOTAL OPERATING COST:                    ~$85.00 – $105.00 / month    │
│                                           (~₹7,100 – ₹8,800 INR/month) │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 5. PRICING AUDIT CONCLUSION & MANDATORY SAFEGUARD

1. **Correction of Previous Estimate:** Task 5G.1's estimate of $175–$210/month was based on per-node billing. The corrected total monthly cost for M10 with backups and taxes is **~$85.00 to $105.00 / month** (~₹7,100 to ₹8,800 INR/month).
2. **Pricing Calculator Mandate:** Because regional pricing and tax treatments can vary based on the specific billing profile entered, **this figure is strictly labeled as an ESTIMATE**.
3. **Mandatory Action Before Provisioning:** If the Owner decides to provision an M10 cluster, the exact price must be formally reviewed and confirmed within the **MongoDB Atlas Pricing Calculator** prior to confirming deployment.
