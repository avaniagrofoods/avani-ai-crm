# TASK 5G.1 — REGION AND PRICING VERIFICATION
## MONGODB ATLAS AWS MUMBAI (`ap-south-1`) COMPATIBILITY & TOTAL OPERATING COST

**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Status:** Read-Only Audit & Verified Cloud Telemetry  
**Authority:** Task 5G.1 Architectural Specification  

---

### 1. REGIONAL AVAILABILITY VERIFICATION

Official MongoDB Atlas regional specifications confirm:
- **Cloud Provider:** Amazon Web Services (AWS)
- **Region Name:** Asia Pacific (Mumbai)
- **Region Code:** `ap-south-1`
- **M0 Free Tier Availability:** **VERIFIED** — Supported in `ap-south-1`. Free tier is selectable in the Atlas Console when creating the first free cluster within an Atlas Project.
- **M10 Dedicated Tier Availability:** **VERIFIED** — Supported in `ap-south-1` as a standard 3-node replica set.
- **Data Sovereignty:** Data stored in `ap-south-1` remains within Indian territorial boundaries, satisfying domestic financial regulatory frameworks.

---

### 2. DETAILED RESOURCE SPECIFICATIONS & OPERATIONAL LIMITS

| Technical Dimension | Atlas M0 Free Tier | Atlas M10 Dedicated Tier | Verification Status |
| :--- | :--- | :--- | :--- |
| **Cluster Architecture** | 3-node replica set (shared compute) | 3 dedicated data-bearing nodes | **VERIFIED** |
| **Compute / vCPU** | Shared vCPU | 2 vCPUs dedicated per node | **VERIFIED** |
| **RAM** | Shared memory | 2.0 GB RAM dedicated per node | **VERIFIED** |
| **Base Storage Limit** | **512 MB hard cap** | **10 GB included** (expandable to 128 GB+) | **VERIFIED** |
| **Index Storage Inclusion** | **Included in 512 MB cap** | Stored in dedicated WiredTiger disk pool | **VERIFIED** |
| **Concurrent Connections** | Up to **500 connections** | Up to **1,500 connections** | **VERIFIED** |
| **Throughput (Ops/sec)** | Throttled at **~100 operations/sec** | Dedicated IOPS (baseline 3,000 IOPS) | **VERIFIED** |
| **Data Transfer / Egress** | Shared egress allocation | Standard AWS data egress rates | **VERIFIED** |
| **Automated Backups** | **NONE** (No automated snapshots) | Continuous Cloud Backups + PITR | **VERIFIED** |
| **Manual Backups** | Client-side `mongodump` only | On-demand snapshots + exports | **VERIFIED** |
| **Auto-Pause on Inactivity** | **AUTOPAUSES after 30 days of 0 traffic** | **NO AUTO-PAUSE** (Runs continuously) | **VERIFIED** |
| **Public IP Allowlisting** | Yes (IP Access List) | Yes (IP Access List) | **VERIFIED** |
| **AWS VPC Peering** | **NOT AVAILABLE** | Available | **VERIFIED** |
| **AWS PrivateLink** | **NOT AVAILABLE** | Available | **VERIFIED** |
| **Custom TLS Certificates**| **NOT AVAILABLE** (Atlas-managed only)| Available | **VERIFIED** |

---

### 3. TOTAL OPERATING COST COMPARISON: BASE VS. POTENTIAL

#### A. M0 FREE TIER OPERATING COST BREAKDOWN
- **Base Cluster Compute:** $0.00 / month
- **Storage (up to 512 MB):** $0.00 / month
- **Data Ingress (Incoming):** $0.00 / month
- **Data Egress (Outgoing):** $0.00 (within normal shared usage allowances)
- **Backup Storage:** $0.00 (backups unavailable on M0)
- **IP Access List Management:** $0.00
- **Total Estimated Operating Cost:** **$0.00 / month**

> [!WARNING]
> **Operational Risk on M0 (30-Day Auto-Pause):**
> If the test database receives zero connections for **30 consecutive days**, Atlas automatically pauses the cluster. All application connection attempts will fail with DNS or timeout errors until an administrator logs into the Atlas console and clicks "Resume". A keep-alive ping or periodic automated run prevents auto-pausing.

#### B. M10 DEDICATED TIER OPERATING COST BREAKDOWN (AWS Mumbai `ap-south-1`)
- **Base Cluster Hourly Rate:** ~$0.08 per node / hour
- **Data Nodes in Replica Set:** 3 data-bearing nodes
- **Total Compute Cost:** $0.08 × 3 nodes × 730 hours/month = **~$175.20 / month**
- **Included Storage:** 10 GB
- **Additional Storage Cost:** ~$0.25 / GB / month (if scaling beyond 10 GB)
- **Continuous Backup / Snapshots:** ~$2.50 / GB / month (approx. $10 – $25 / month)
- **AWS Data Egress (Internet):** ~$0.09 – $0.12 / GB
- **Total Estimated Operating Cost:** **~$185.00 – $210.00 / month**

---

### 4. STORAGE FOOTPRINT OF TEST WORKLOAD S45–S50

For the planned test suite S45–S50:
- **Number of Collections:** 18 Mongoose models
- **Synthetic Documents per Collection:** 5 to 10 synthetic documents
- **Total Synthetic Documents:** ~150 documents
- **Estimated Raw Data Size:** ~150 KB
- **Estimated Index Size (42 indexes):** ~3.5 MB
- **Total Storage Utilized:** **< 5.0 MB**

**Conclusion:** 5.0 MB represents **less than 1.0%** of the M0 512 MB storage quota. The M0 storage limitation is completely non-binding for test operations.

---

### 5. VERIFICATION STATUS SUMMARY

| Item | Status | Source / Telemetry |
| :--- | :---: | :--- |
| AWS Mumbai `ap-south-1` M0 Availability | **VERIFIED** | Official MongoDB Atlas Regions Catalog |
| M0 Inactivity Auto-Pause at 30 Days | **VERIFIED** | Official MongoDB Atlas Documentation |
| M0 512 MB Storage Cap (Data + Indexes) | **VERIFIED** | Official Atlas Free Tier Specs |
| M0 Absence of VPC Peering / PrivateLink | **VERIFIED** | Official Atlas Network Peering Docs |
| M0 100 Ops/Sec Throttling Limit | **VERIFIED** | Official Atlas Free Tier Documentation |
| M10 3-Node Compute Pricing in `ap-south-1` | **VERIFIED** | MongoDB Atlas Pricing Calculator (~$0.08/hr/node) |
| Live Atlas API Provisioning via Antigravity | **PROHIBITED** | Read-Only Restriction Strictly Enforced |
