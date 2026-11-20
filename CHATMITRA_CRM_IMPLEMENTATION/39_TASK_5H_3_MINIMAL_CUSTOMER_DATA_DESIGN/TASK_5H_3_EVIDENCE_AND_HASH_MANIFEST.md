# TASK 5H.3 — EVIDENCE AND HASH MANIFEST
## CRYPTOGRAPHIC SHA-256 CHECKSUMS, EXCEL FORMULA VERIFICATION & GIT INTEGRITY LOG
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026 (`2026-11-18`)  
**Execution Mode:** Strictly Read-Only Audit & Documentation  
**Maximum Cloud Cost:** **₹0.00 INR / $0.00 USD (MongoDB Atlas M0 Free Only)**

---

### 1. CRYPTOGRAPHIC SHA-256 MANIFEST OF TASK 5H.3 DELIVERABLES (1–8)

All deliverables generated in `CHATMITRA_CRM_IMPLEMENTATION/39_TASK_5H_3_MINIMAL_CUSTOMER_DATA_DESIGN/` were verified and hashed via `Get-FileHash -Algorithm SHA256`:

| # | Deliverable Filename | SHA-256 Checksum | Verification Status |
| :-: | :--- | :--- | :---: |
| **1** | `TASK_5H_3_EXECUTIVE_SUMMARY.md` | `2A99D2EA83B1314258673BD057855BB8234BF6C69F53850EE6600EDBB3A9B13D` | **`VERIFIED`** |
| **2** | `TASK_5H_3_EXISTING_DATABASE_SCHEMA_AUDIT.md` | `14CE6088C9E3B737381F6408F7529CAC4E8B12F2B9A7B01496705849E37B047C` | **`VERIFIED`** |
| **3** | `TASK_5H_3_MINIMAL_CUSTOMER_DATA_MODEL.md` | `53BC684A05BFAD16D894434C2AE49686A45C6094CC3A2C6DC314DF9388C97EB2` | **`VERIFIED`** |
| **4** | `TASK_5H_3_FILE_STORAGE_EXCLUSION_AUDIT.md` | `C9F7E0C675BFA156644047E6EC8D65E526C1D2AA84DC3626913714361B96ABBB` | **`VERIFIED`** |
| **5** | `TASK_5H_3_M0_STORAGE_ESTIMATES.xlsx` | `AE2A16D66C033E6EEAFAA29DAD2E85A021D68C57AE1BDF83189F079571AAB041` | **`VERIFIED`** |
| **6** | `TASK_5H_3_INDEX_AND_STORAGE_OPTIMIZATION.md` | `E8F4052CA60C4D38C237CE9E79A7BA7FD32BF4C6144FAEBABD5A8C89E22ED856` | **`VERIFIED`** |
| **7** | `TASK_5H_3_PRIVACY_AND_DATA_MINIMIZATION.md` | `4DDFA30649D2507E40A22E483DF4F37562CE18764B1DE4600F50481F9DA1C68F` | **`VERIFIED`** |
| **8** | `TASK_5H_3_FINAL_RECOMMENDATION.md` | `210B462E4DC3BFCC8724C330C0D2DCB08DE16D4A19B13EF331871BE0A575363E` | **`VERIFIED`** |

---

### 2. PROTECTED APPLICATION SOURCE & TEST FILES BASELINE CHECKSUMS

Zero application source files, Mongoose schema files, test files, package manifests, or environment files were modified during Task 5H.3:

| Protected File Path | Verified SHA-256 Checksum | Match with Task 5F.2 / 5F.3 Baseline |
| :--- | :--- | :---: |
| `3-AVANI AI CRM/src/lib/db.ts` | `A98D4B8AFFE7FD6414D7E42781FE72FA9ACC9A3462C40CA80FB9AAF96BB69904` | **`VERIFIED` (100% Match)** |
| `3-AVANI AI CRM/src/lib/db.ts.bak.pre_task5f` | `15491D1DD5221CB96CA30C7A11DC2203C56847CDF53F3EDD966B20369BBDCA9D` | **`VERIFIED` (100% Match)** |
| `3-AVANI AI CRM/src/lib/db.ts.bak.pre_task5f2` | `E5F4292E8DB528167BC4AE0130B747C7958CD19F0852A2C7920ADCA8E1FE6F0F` | **`VERIFIED` (100% Match)** |
| `3-AVANI AI CRM/tests/test_database_isolation_hardening.test.cjs` | `D43C023F5E255392D158891377B2581348E6C0C4EBE99CDF5109CE89C385C91B` | **`VERIFIED` (100% Match)** |
| `3-AVANI AI CRM/src/lib/optout-engine.ts` | `6856EA2815CF61262A37986AA5A246855A2DBBDFA9D986E5343301FCF6BFB804` | **`VERIFIED` (100% Match)** |

---

### 3. EXCEL WORKBOOK (`TASK_5H_3_M0_STORAGE_ESTIMATES.xlsx`) VERIFICATION LOG

Read-back verification of `TASK_5H_3_M0_STORAGE_ESTIMATES.xlsx` via `exceljs` confirmed:
- **Worksheet 1 (`Per_Customer_BSON_Model` — 12 rows):**
  - Subtotal Raw BSON + Indexes per Customer (Row 10): Current = `85.05 KB` data + `17.63 KB` index = **`102.68 KB`** (`=SUM(D2:D9)`); Minimal M0 Design = `4.88 KB` data + `2.51 KB` index = **`7.39 KB`** (`=SUM(G2:G9)`).
  - Effective Storage with 15% WiredTiger Block Padding Reserve (Row 12): Current = **`118.082 KB` / customer** (`=D10+D11`); Minimal M0 Design = **`8.4985 KB` / customer** (`=G10+G11` — **92.8% reduction**).
- **Worksheet 2 (`M0_Capacity_Projections` — 5 rows):**
  - **500 Customers (Row 2):** Current = `58.16 MB` (`11.36%` of 512 MB); Minimal = **`4.40 MB`** (`2.92 MB` data + `1.48 MB` index; **`1.26%` of 350 MB target / `0.86%` of 512 MB cap**).
  - **1,000 Customers (Row 3):** Current = `115.81 MB` (`22.62%` of 512 MB); Minimal = **`8.55 MB`** (`5.66 MB` data + `2.89 MB` index; **`2.44%` of 350 MB target / `1.67%` of 512 MB cap**).
  - **5,000 Customers (Row 4):** Current = `577.07 MB` (**`112.71%` — OVERFLOW!**); Minimal = **`41.75 MB`** (`27.58 MB` data + `14.17 MB` index; **`11.93%` of 350 MB target / `8.15%` of 512 MB cap**).
  - **10,000 Customers (Row 5):** Current = `1,153.64 MB` (**`225.32%` — CRITICAL OVERFLOW!**); Minimal = **`83.24 MB`** (`54.98 MB` data + `28.26 MB` index; **`23.78%` of 350 MB target / `16.26%` of 512 MB cap**).
- **Worksheet 3 (`M0_Technical_Constraints` — 8 rows):**
  - Verified all official M0 limits (`512 MB` storage, `500` connections, `100` CRUD ops/sec, `100` DBs / `500` collections, `30 days` inactivity auto-pause per Section F correction, and `₹0 / $0` cost).
