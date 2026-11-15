# ALS & CRM FINAL BLOCKER REGISTER

**Date:** 2026-11-16  
**Scope:** Authorized Projects Only (`1-AVANI LOAN SERVICE FY 26-27` & `3-AVANI AI CRM`)

---

## Resolved Blockers (Fixed in This Session)

| ID | Project | Blocker Description | Resolution | Verification |
|---|---|---|---|---|
| **BLK-01** | Both | Git CLI missing after Windows 10 reset | Installed `Git.MinGit` `2.56.1.windows.1` via `winget` (`Successfully verified installer hash`) | `git --version`, `git fsck` (`exit 0`) |
| **BLK-02** | ALS -> CRM | `1-AVANI LOAN SERVICE FY 26-27/api/save-lead.js` & `src/routes/formTracking.cjs` posted to session-protected `${CRM_BASE_URL}/api/leads` instead of `/api/public/enquiry` | Updated both to target `${CRM_BASE_URL}/api/public/enquiry` with `consent: true`, `privacyPolicyVersion`, HTTP `200`/`201` handling, and `leadId` propagation | `scripts/test_website_crm_contract.mjs` (`6/6` pass), ALS `npm run build` (`exit 0`) |
| **BLK-03** | CRM | `/api/public/enquiry` lacked explicit `idempotencyKey` deduplication and attribution field persistence | Added `idempotencyKey` lookup (returns `200` `idempotencyHit: true`) and persisted `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`, `consentPurpose` in `src/app/api/public/enquiry/route.ts` | `tests/test_cp28_remediation_contracts.test.cjs` (`4/4` pass), `tsc --noEmit` (`exit 0`) |
| **BLK-04** | CRM | `src/app/login/page.tsx` still displayed `Authorized Staff Access` and `advisor@avanifinserv.com` placeholder | Updated to `AVANI AI CRM — Secure Owner Access` and `Enter owner email` | `tests/test_cp28_remediation_contracts.test.cjs` (`4/4` pass), `npm run build` |
| **BLK-05** | CRM | ESLint `react-hooks/purity` error in `src/app/inbox/page.tsx` (`Date.now()` inside component render/callback) | Extracted `const nextTempId = () => \`temp_${Date.now()}\`;` outside `InboxPage` | `npm run lint` (`0` errors, 134 warnings) |

---

## Open / Remaining Blockers

| ID | Project | Severity | Blocker Description | Impact | Owner / Next Action |
|---|---|---|---|---|---|
| **OPEN-01** | CRM | **Medium (Local Dev/Test)** | Local MongoDB (`mongod.exe` on `127.0.0.1:27017`) is not installed after the Windows 10 reset, and `mongodb-memory-server` is not installed (`C:` has `10.51 GB` free). | Blocks local execution of the 8 DB-backed E2E suites (including `test_cp26_8_critical_safeguards.test.cjs` and `test_cp28_1_single_owner_auth.test.cjs`) against `avani_ai_crm_test`. Production Vercel uses Atlas `MONGODB_URI` (live `/api/health` is `200 HEALTHY`). | Owner may either install MongoDB Community Server locally when ready, or approve release based on the passing non-DB unit/contract/reconcile/build suites + live Atlas health, followed by post-deploy smoke verification. |
| **OPEN-02** | ALS | **Low (Config Check)** | `vercel env ls` for `avani-loan-service-fy-26-27` does not list `CRM_BASE_URL` explicitly (`api/save-lead.js` falls back to `https://avani-ai-crm.vercel.app`). | Works as long as the default production CRM URL is `https://avani-ai-crm.vercel.app`, which is currently live and healthy (`200`). | Optional: explicitly set `CRM_BASE_URL=https://avani-ai-crm.vercel.app` in ALS Vercel Production env if custom domain changes later. |
| **OPEN-03** | Both | **Gate (Governance)** | Phase 13 Owner Approval Gate: uncommitted local fixes in both repos have not been committed, pushed to GitHub, or deployed to Vercel yet. | Live production does not yet have the remediated `save-lead.js`, `formTracking.cjs`, `/api/public/enquiry`, `login/page.tsx`, or `inbox/page.tsx`. | Present `AVANI_MASTER_PRODUCTION_RELEASE_SIGNOFF.md` and wait for explicit owner approval before `git commit`, `git push`, and `vercel --prod`. |
