# AVANI LOAN SERVICES — CP-26 ROLLBACK PLAN

**Project:** AVANI LOAN SERVICES — AVANI AI CRM  
**Date:** 2026-11-10T21:30:00+05:30  
**Baseline Recovery Checkpoint:** CP-25.3.3  
**Known Stable Git Commit:** `e1cd117`  
**Known Stable Vercel Deployment:** `dpl_GNqXYSJPvzUSpx3fjikrfbM2RwbM`  

---

## 1. ROLLBACK TRIGGERS

Rollback will be immediately initiated if:
1. Existing WhatsApp inbound webhooks or message captures fail.
2. MongoDB Atlas connections fail or schema changes cause validation exceptions on legacy records.
3. Automated regression tests fall below 100% pass rate.
4. Any credential or sensitive client data is exposed in logs or endpoints.
5. Production Next.js build fails on Vercel.

---

## 2. CODE ROLLBACK PROCEDURE

### Step 1: Revert Git Branches
```bash
git checkout main
git reset --hard e1cd117
git push origin main --force

git checkout release/stage1-hardening
git reset --hard e1cd117
git push origin release/stage1-hardening --force
```

### Step 2: Instant Vercel Redeployment / Rollback
In the Vercel Dashboard or via Vercel CLI:
```bash
npx vercel rollback dpl_GNqXYSJPvzUSpx3fjikrfbM2RwbM
```
Or redeploy from commit `e1cd117`:
```bash
npx vercel --prod
```

---

## 3. DATABASE RECOVERY PROCEDURE

Because all CP-26 schema additions are strictly additive (optional fields on existing documents and new standalone collections), rollback does not require dropping databases or data restoration:
- Legacy fields (`status`, `name`, `phone`, `loanType`) remain untouched and valid.
- Any CP-26 specific fields (`qualificationScore`, `application`, `sanction`, `disbursement`) are safely ignored by earlier code versions.
- MongoDB backup snapshot was verified in `backups/test_mongodump.bson.gz`.
