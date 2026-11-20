# TASK 5E.1E: ROLLBACK AND CHANGE CONTROL PLAN
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 2026-11-17  
**Status:** APPROVED CHANGE CONTROL & CONTINGENCY RUNBOOK  
**Target:** Safe Execution of Task 5F Implementation

---

## 1. Change Control Policy & Strict Constraints
1. **Zero Production Risk:** No code changes are applied directly to production branches without passing 100% of the offline unit regression suite.
2. **Preservation of Prior Fixes:** The fix applied in Task 3B (`3-AVANI AI CRM/src/lib/optout-engine.ts`) must remain completely undisturbed.
3. **Atomic Modification:** All database isolation changes are confined to `src/lib/db.ts` and corresponding test files in `tests/`.

---

## 2. Pre-Implementation Backup Protocol
Immediately prior to making any edits to `src/lib/db.ts`:
```powershell
# In 3-AVANI AI CRM:
Copy-Item "src/lib/db.ts" "src/lib/db.ts.bak.pre_task5e1e"
git diff src/lib/optout-engine.ts > "scratch/optout_engine_preserved.patch"
```

---

## 3. Step-by-Step Implementation Sequence (Task 5F)
1. **Step 1:** Create pre-change backup of `src/lib/db.ts`.
2. **Step 2:** Implement type definitions and `classifyRuntimeEnvironment()`.
3. **Step 3:** Implement `parseAndSanitizeConnectionUri()` and `extractHostnamesFromUri()`.
4. **Step 4:** Implement `validateClusterHostnames()` and `validateDatabaseName()`.
5. **Step 5:** Implement `verifySrvDnsTopology()` and `verifyPostConnectionTopology()`.
6. **Step 6:** Implement `verifySameConnectionIdentity()` and `verifyIndexSafety()`.
7. **Step 7:** Update `evaluateDatabaseIsolation()` to orchestrate all checks.
8. **Step 8:** Wrap `connectToDatabase()` to execute preflight and post-connection checks.
9. **Step 9:** Execute offline unit tests S01–S44. Ensure 100% pass rate.
10. **Step 10:** Verify `git diff` to confirm zero unexpected changes.

---

## 4. Emergency Rollback Runbook (Execution Time: < 60 seconds)
If any failure occurs during testing or deployment:

### Rollback Step 1: Immediate Git Restore
```powershell
# Restore src/lib/db.ts to HEAD
git checkout HEAD -- src/lib/db.ts
```

### Rollback Step 2: Fallback File Restore
```powershell
# If git restore is unavailable:
Copy-Item "src/lib/db.ts.bak.pre_task5e1e" "src/lib/db.ts" -Force
```

### Rollback Step 3: Verify Integrity & Opt-Out Engine Preservation
```powershell
git status
git diff src/lib/optout-engine.ts
```
*Expected Output:* Exactly 1 file modified (`src/lib/optout-engine.ts`), exactly matching the Task 3B baseline.
