# TASK 5H.1 — EVIDENCE AND VERIFICATION LOG
## QUALITY CONTROL, EXCEL FORMULA VERIFICATION, SHA-256 CHECKSUMS & GIT INTEGRITY
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026  
**Execution Mode:** Strictly Read-Only Verification  
**Hard Cost Ceiling:** **₹0.00 INR / $0.00 USD**

---

### 1. SECTION 6 QUALITY CONTROL CHECKLIST VERIFICATION

| # | Quality Control Requirement | Verification Method & Evidence | Final Status |
| :-: | :--- | :--- | :---: |
| **1** | **Verify every recommended tool against official pricing or licensing documentation** | All 24 installed tools verified via `package.json` / CLI `--version` as open-source (`MIT`, `Apache-2.0`, `GPL-2.0`, `PSF`, `Artistic-2.0`, `ISC`) or built-in Windows OS binaries. Atlas M0 and GitHub Free verified against official free-tier documentation. | **PASS** |
| **2** | **Separate verified facts from assumptions** | Documented in Section 2 below; AWS Mumbai (`ap-south-1`) M0 free-tier availability explicitly separated as `REQUIRES ATLAS UI CONFIRMATION`. | **PASS** |
| **3** | **Identify outdated or uncertain pricing** | Identified and excluded legacy Atlas M2/M5 shared tiers (replaced by paid Flex tier at $8–$30/mo) and M10 dedicated tier (~$85–$105/mo estimated with backup & 18% GST). | **PASS** |
| **4** | **Confirm the ₹0 cost requirement** | All 26 approved tools/services have an expected monthly cost of **₹0.00 INR / $0.00 USD**. | **PASS** |
| **5** | **Check that no paid service is presented as free** | Atlas M0 and GitHub Free are explicitly classified as **Category 2 (Permanent Free Tier with Strict Limits)** with full documentation of caps and overage avoidance. All 8 paid/infeasible tools are isolated in Sheet 2 (`Excluded_Paid_And_Infeasible`). | **PASS** |
| **6** | **Confirm that no production data or credentials were accessed** | Zero connections to `rhpn2gh.mongodb.net` or `avani_ai_crm_prod`; zero `.env` credentials read or exposed. | **PASS** |
| **7** | **Verify all generated documents** | All 11 files in `37_TASK_5H_1_FREE_TOOLS_FEASIBILITY/` inspected and mirrored across Project 1 and Project 2. | **PASS** |
| **8** | **Verify Excel formulas and totals** | Verified programmatically via `exceljs` read-back (`SUM(D2:D27)=0`, `SUM(E2:E27)=0`, `MAX(D2:D27)=0`, `COUNTA(A2:A27)=26`, `SUM(C2:C9)=18228`, `SUM(D2:D9)=217`). | **PASS** |
| **9** | **Record SHA-256 hashes for deliverables** | Recorded in Section 4 below via `Get-FileHash -Algorithm SHA256`. | **PASS** |
| **10** | **Confirm source-code Git status is unchanged** | Verified via `git status --short` and `git diff --stat` in Project 1 and Project 2; protected source file SHA-256 checksums match Task 5F.2/5F.3 baseline 100%. | **PASS** |
| **11** | **Confirm no external customer communication occurred** | Zero HTTP calls to Meta WhatsApp, ChatMitra, Vapi, or Twilio. | **PASS** |
| **12** | **Do not claim a test was performed if only planned** | S45–S50 live integration tests are explicitly marked as **PLANNED / NOT EXECUTED**. Offline tests (175/175) are cited from verified Task 5F.2/5F.3 execution evidence. | **PASS** |

---

### 2. SEPARATION OF VERIFIED FACTS VS. UNRESOLVED / GATED ITEMS

| Item | Classification | Source / Required Verification Step |
| :--- | :---: | :--- |
| 24 Free tools installed on workstation & Project 1/2 `node_modules` | **VERIFIED FACT** | Direct local CLI & `node_modules` inspection (`Node v26.13.1`, `Python 3.14.5`, `Git 2.56.1`, `gh 2.104.0`, `curl 8.13.0`, `mongoose 9.7.3`, `mongodb 7.2.0`, `typescript 5.9.3`, `puppeteer 25.4.0`, `exceljs 4.4.0`, etc.). |
| Workstation RAM (`3.90 GB` total, `~268–426 MB` free) & Drive D: (`3.25 MB` free) | **VERIFIED FACT** | Measured via `Get-CimInstance Win32_OperatingSystem` and `Get-PSDrive`. |
| Atlas M0 supports `SCRAM-SHA-1`, `X.509`, `AWS IAM` and disables `SCRAM-SHA-256` | **VERIFIED FACT** | Official MongoDB Atlas Free/Shared Limitations documentation (`free-shared-limitations`). |
| `src/lib/db.ts` supports `SCRAM-SHA-1` via URI parameter with 0 code edits | **VERIFIED FACT** | Direct code audit of `src/lib/db.ts` (`SHA-256: A98D4B8A...`). |
| AWS Mumbai (`ap-south-1`) M0 Free Tier availability at ₹0 at exact moment of provisioning | **REQUIRES ATLAS UI CONFIRMATION** | Static AWS region table does not publish real-time M0 capacity markers. Must be confirmed in Atlas UI when Owner authorizes provisioning; if unavailable at ₹0, **STOP immediately**. |
| Live execution of S45–S50 against an isolated M0 cluster | **PLANNED ONLY (NOT EXECUTED)** | Blocked by read-only directive; requires explicit Owner approval for Task 5H.2. |

---

### 3. EXCEL WORKBOOK (`TASK_5H_1_COMPLETE_COST_AUDIT.xlsx`) FORMULA VERIFICATION LOG

Read-back verification of `TASK_5H_1_COMPLETE_COST_AUDIT.xlsx` via `exceljs` confirmed:

- **Worksheet 1 (`Approved_Free_Tools_Audit` — 29 rows, 26 tool rows `A2:K27`):**
  - Cell `D28` (Total Monthly Cost INR): Formula `=SUM(D2:D27)` $\rightarrow$ Evaluated Total: **`₹0.00`**
  - Cell `E28` (Total Monthly Cost USD): Formula `=SUM(E2:E27)` $\rightarrow$ Evaluated Total: **`$0.00`**
  - Cell `C29` (Approved Tool Count): Formula `=COUNTA(A2:A27)` $\rightarrow$ Evaluated Result: **`26`**
  - Cell `D29` (Max Single Tool Cost INR): Formula `=MAX(D2:D27)` $\rightarrow$ Evaluated Result: **`₹0.00`**
  - Cell `E29` (Max Single Tool Cost USD): Formula `=MAX(E2:E27)` $\rightarrow$ Evaluated Result: **`$0.00`**
- **Worksheet 2 (`Excluded_Paid_And_Infeasible` — 10 rows, 8 excluded rows `A2:F9`):**
  - Cell `C10` (Total Monthly Cost Avoided INR): Formula `=SUM(C2:C9)` $\rightarrow$ Evaluated Total: **`₹18,228.00`**
  - Cell `D10` (Total Monthly Cost Avoided USD): Formula `=SUM(D2:D9)` $\rightarrow$ Evaluated Total: **`$217.00`**
- **Worksheet 3 (`Executive_Cost_Summary` — 9 rows):**
  - Cell `C2` (Installed Cat-1 Free Tools): **`24`**
  - Cell `C3` (Additional Cat-2 Free Services): **`2`**
  - Cell `C4` (Total Approved Free Options): Formula `=SUM(C2:C3)` $\rightarrow$ **`26`**
  - Cell `C5` (Excluded Paid/Infeasible Options): Formula `=COUNTA(Excluded_Paid_And_Infeasible!A2:A9)` $\rightarrow$ **`8`**
  - Cell `C6` (Total Expected Monthly Cost INR): Formula `=Approved_Free_Tools_Audit!D28` $\rightarrow$ **`₹0.00`**
  - Cell `C7` (Total Expected Monthly Cost USD): Formula `=Approved_Free_Tools_Audit!E28` $\rightarrow$ **`$0.00`**
  - Cell `C8` (Total Monthly Cost Avoided INR): Formula `=Excluded_Paid_And_Infeasible!C10` $\rightarrow$ **`₹18,228.00`**
  - Cell `C9` (Total Monthly Cost Avoided USD): Formula `=Excluded_Paid_And_Infeasible!D10` $\rightarrow$ **`$217.00`**

---

### 4. CRYPTOGRAPHIC SHA-256 CHECKSUM REGISTER

#### A. TASK 5H.1 DELIVERABLES (1–10)
| # | Deliverable Filename | SHA-256 Hash |
| :-: | :--- | :--- |
| **1** | `TASK_5H_1_EXECUTIVE_SUMMARY.md` | `5D7945C60063B7E3F5377A088E3DFB31B94F0E095146133414F457A75D02B3B9` |
| **2** | `TASK_5H_1_EXISTING_TOOLS_INVENTORY.md` | `5F67A1FDAC25494059C3F615ABD9BAA100FBB3832BDF396DF54D80C6F7D6C933` |
| **3** | `TASK_5H_1_FREE_MONGODB_OPTIONS.md` | `18AEBAACEAC36B30A6FC4C564903A13BA0D6BAC22D14DF798416357A09AE48F7` |
| **4** | `TASK_5H_1_FREE_DEVELOPMENT_STACK.md` | `092F6A0D106D4E186CF775D07B097959A34A9DA3DF7455490D1A534D58B635C8` |
| **5** | `TASK_5H_1_FREE_AUTOMATION_OPTIONS.md` | `610AB97C4DD779B470D270CD5E4B2EFE8A73CF0AB74B9002D3AEACBA1761CE42` |
| **6** | `TASK_5H_1_COMPLETE_COST_AUDIT.xlsx` | `0B109995340FFBBED7F912124D55E7A8107C17E9ABAD00DEF106F1863666EED5` |
| **7** | `TASK_5H_1_SECURITY_AND_PRIVACY_REVIEW.md` | `B8A0F1079B85EBC11CAA3DE7084C2F980444CE654B1E5BBAFE828704DAB29EA3` |
| **8** | `TASK_5H_1_TASK_5F_TO_5G_COMPATIBILITY_REVIEW.md` | `2848C8DD33FC0E95694383B65C4F5686E2E7D3013EEE3A61DFC3DC255F93CA8B` |
| **9** | `TASK_5H_1_OPTIONS_COMPARISON.md` | `BFCB70FBDEEC90318AEF2218F541013BDA2ED9E11C231566619CFE549B57C120` |
| **10** | `TASK_5H_1_FINAL_RECOMMENDATION.md` | `7A285A73B25ADE3695832FE4DF0905FF261AB5A42D28C6DF35DA8DD00AA112BA` |

#### B. PROTECTED APPLICATION SOURCE & TEST FILES (100% UNCHANGED)
| Protected File | SHA-256 Hash | Baseline Match |
| :--- | :--- | :---: |
| `3-AVANI AI CRM/src/lib/db.ts` | `A98D4B8AFFE7FD6414D7E42781FE72FA9ACC9A3462C40CA80FB9AAF96BB69904` | **EXACT MATCH** |
| `3-AVANI AI CRM/src/lib/db.ts.bak.pre_task5f` | `15491D1DD5221CB96CA30C7A11DC2203C56847CDF53F3EDD966B20369BBDCA9D` | **EXACT MATCH** |
| `3-AVANI AI CRM/src/lib/db.ts.bak.pre_task5f2` | `E5F4292E8DB528167BC4AE0130B747C7958CD19F0852A2C7920ADCA8E1FE6F0F` | **EXACT MATCH** |
| `3-AVANI AI CRM/tests/test_database_isolation_hardening.test.cjs` | `D43C023F5E255392D158891377B2581348E6C0C4EBE99CDF5109CE89C385C91B` | **EXACT MATCH** |
| `3-AVANI AI CRM/src/lib/optout-engine.ts` | `6856EA2815CF61262A37986AA5A246855A2DBBDFA9D986E5343301FCF6BFB804` | **EXACT MATCH** |
