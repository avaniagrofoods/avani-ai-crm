# TASK 5F.2 — BACKUP AND ROLLBACK RUNBOOK
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Auditor:** Senior Application Security Engineer & Systems Architect  
**Status:** **AUTHORITATIVE RECOVERY PROCEDURE**

---

## 1. Executive Summary

This document specifies the exact backup file locations, cryptographic hashes, and step-by-step procedures required to restore `src/lib/db.ts` to either the pristine Git baseline (commit `8e4c011`) or the pre-Task 5F.2 state.

---

## 2. Backup File Inventory & Checksums

Both backup files are stored locally on disk within `3-AVANI AI CRM/src/lib/`:

| Backup File Path | Role | Source Commit / State | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| `3-AVANI AI CRM/src/lib/db.ts.bak.pre_task5f` | Pristine Baseline Backup | Git Commit `8e4c011` | `15491D1DD5221CB96CA30C7A11DC2203C56847CDF53F3EDD966B20369BBDCA9D` |
| `3-AVANI AI CRM/src/lib/db.ts.bak.pre_task5f2` | Pre-Remediation Backup | Task 5F State | `E5F4292E8DB528167BC4AE0130B747C7958CD19F0852A2C7920ADCA8E1FE6F0F` |

---

## 3. Rollback Procedure A: Restore to Task 5F Pre-Remediation State

If the owner directs rollback of Task 5F.2 remediations while preserving Task 5F changes:

### Step 1: Copy Backup File
```powershell
cd "C:\Users\ALPHA-1\Downloads\21MAY2026\SACHIN SHINDE DOCUMENTS\DEVELOPEMENT TOOLS\3-AVANI AI CRM"
Copy-Item "src\lib\db.ts.bak.pre_task5f2" "src\lib\db.ts" -Force
```

### Step 2: Verify SHA-256 Checksum
```powershell
(Get-FileHash "src\lib\db.ts" -Algorithm SHA256).Hash
# Must output: E5F4292E8DB528167BC4AE0130B747C7958CD19F0852A2C7920ADCA8E1FE6F0F
```

---

## 4. Rollback Procedure B: Full Rollback to Pristine Git Baseline (`8e4c011`)

If the owner directs complete restoration of `src/lib/db.ts` to the pre-Task 5F pristine baseline:

### Option 1 (Via Backup File):
```powershell
cd "C:\Users\ALPHA-1\Downloads\21MAY2026\SACHIN SHINDE DOCUMENTS\DEVELOPEMENT TOOLS\3-AVANI AI CRM"
Copy-Item "src\lib\db.ts.bak.pre_task5f" "src\lib\db.ts" -Force
```

### Option 2 (Via Git Checkout):
```powershell
cd "C:\Users\ALPHA-1\Downloads\21MAY2026\SACHIN SHINDE DOCUMENTS\DEVELOPEMENT TOOLS\3-AVANI AI CRM"
git checkout src/lib/db.ts
```

### Verification Command:
```powershell
(Get-FileHash "src\lib\db.ts" -Algorithm SHA256).Hash
# Must output: 15491D1DD5221CB96CA30C7A11DC2203C56847CDF53F3EDD966B20369BBDCA9D
```

---

## 5. Rollback Impact on Other Components

1. **Task 3B Hindi Opt-Out Fix (`src/lib/optout-engine.ts`):**  
   Neither rollback procedure modifies or touches `src/lib/optout-engine.ts`. The Task 3B fix (`रोकें`) remains permanently intact.
2. **Git Commit History:**  
   Because Task 5F.2 executed in local controlled mode with **zero Git commits**, rolling back working tree files leaves the Git commit history 100% clean and identical to origin.
3. **Database Impact:**  
   Zero database writes or network socket connections were initiated. No database rollback or state reconciliation is required.
