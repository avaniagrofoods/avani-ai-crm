# AVANI AI CRM — VERCEL PROJECT & TEAM OWNERSHIP AUDIT
**Audit Date:** 31 October 2026  
**Application:** AVANI AI CRM  
**Organization:** AVANI LOAN SERVICES  
**Workspace:** `C:\Users\ALPHA-1\Downloads\21MAY2026\SACHIN SHINDE DOCUMENTS\DEVELOPEMENT TOOLS\3-AVANI AI CRM`

---

## 1. VERCEL PROJECT TOPOLOGY & IDENTITY

Direct querying of the Vercel API (`/v9/projects/prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ`) produced the following telemetry:

| Property | Value | Evidence Source |
| :--- | :--- | :--- |
| **Project Name** | `avani-ai-crm` | Vercel API & `.vercel/project.json` |
| **Project ID** | `prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ` | Vercel API & `.vercel/project.json` |
| **Team ID** | `team_vUTeKhQxcSPYtztYtoLMWinO` | Vercel API |
| **Team Slug** | `avaniagrofoods1356-4705s-projects`| Vercel API |
| **Account Owner** | `avaniagrofoods1356@gmail.com` | Vercel API Creator UID `q6R0BHQXYX7RwMlhihNc2QGW` |
| **Framework** | Next.js 16.2.10 (Turbopack) | Vercel API & `package.json` |
| **Connected GitHub Repo**| `avaniagrofoods/avani-ai-crm` | Vercel Targets Meta |
| **Target Production Aliases**| `https://avani-ai-crm.vercel.app` | Vercel Target Production |

---

## 2. ACTIVE DEPLOYMENT COMPARISON

### 1. Production Deployment (`targets.production`):
- **Deployment ID:** `dpl_BpKkmTmjZNnyULZ7XXhgNvTSSMU6`
- **State:** `● Ready` (`readySubstate: PROMOTED`)
- **Source Branch:** `main`
- **Source Commit:** `4f3ba9925ae646802ef579c40c4c593ba91fa638`
- **Built Timestamp:** 14 Aug 2026, 20:23:22 IST (78 days ago)
- **Live Health Status:** `503 DEGRADED` (Database connection readyState: 0)
- **Root Cause:** Environment variable `MONGODB_URI` points to `cluster0.mlcxcp.mongodb.net`, which was decommissioned.

### 2. Preview / Staging Deployment (`targets.preview`):
- **Deployment ID:** `dpl_6hopz4n3MuU4Dd8V6TQPbTmaWoFb`
- **State:** `● Ready` (`readySubstate: STAGED`)
- **Source Branch:** `release/stage1-hardening`
- **Source Commit:** `c1fd8551c6eb8ba8ef25f9d3e67a376a77399ffc`
- **Built Timestamp:** 31 Oct 2026, 11:18:29 IST
- **Preview URL:** `https://avani-ai-bmlvrna3z-avaniagrofoods1356-4705s-projects.vercel.app`
- **Live Health Status:** `200 HEALTHY` (Database connected to `avani_ai_crm_test`)
- **Deployment Protection:** Vercel Team SSO Protection is active on preview URLs. Automated tests bypass via internal project token.

---

## 3. VERCEL TEAM RECONCILIATION

The user noted that the preview URL includes the slug `avaniagrofoods1356-4705s-projects`.
- **Finding:** This is the default Vercel Team slug created for the Google Workspace / Gmail account `avaniagrofoods1356@gmail.com`.
- **Assessment:** This is the legitimate, authorized owner account for AVANI AI CRM. The project was created within this team on 14 Aug 2026.
- **Recommendation:** No team migration is required unless the owner specifically creates an independent Vercel Enterprise or Pro team for `avani-loan-services`.

---

## 4. AUDIT CONCLUSION

The Vercel project linkage is verified, legitimate, and in exact alignment with GitHub repository `avaniagrofoods/avani-ai-crm`.
