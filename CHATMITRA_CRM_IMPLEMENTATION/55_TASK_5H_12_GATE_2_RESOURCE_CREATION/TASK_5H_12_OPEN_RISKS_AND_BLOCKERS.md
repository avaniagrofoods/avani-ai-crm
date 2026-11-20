# TASK 5H.12 — REPORT 11
## Open Risks, Technical Blockers & Remediation Strategies

- **Task:** 5H.12 — Blocker & Risk Audit
- **Project Scope:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

---

### 1. Active Primary Blocker: Google Authentication Unavailable

| Attribute | Details |
| :--- | :--- |
| **Blocker ID** | **BLK-01** |
| **Component** | Google Workspace / Google Sheets API & Browser DevTools Session |
| **Description** | Neither the official Antigravity `gsheets` plugin (`accounts: []`) nor the automated browser session (`chrome-devtools-mcp` on `about:blank` redirected to `accounts.google.com/signin`) possesses an authenticated Google user session. |
| **Impact** | Creation of Google Spreadsheet `AVANI_AI_CRM_ISOLATED_TEST` and Apps Script project `AVANI_AI_CRM_TEST_GATEWAY` cannot proceed programmatically. |
| **Remediation Options** | **Option A (Preferred):** User signs into the dedicated test account via Antigravity IDE **Settings $\rightarrow$ Plugins $\rightarrow$ Google Sheets $\rightarrow$ Connect Account**.<br>**Option B (Manual UI):** User opens `sheets.google.com` in their authenticated personal browser, creates `AVANI_AI_CRM_ISOLATED_TEST`, spawns the container script `AVANI_AI_CRM_TEST_GATEWAY`, and provides the spreadsheet ID for automated schema verification. |

---

### 2. Secondary Risk Tracking

| Risk ID | Description | Severity | Likelihood | Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | Premature deployment before Gate 3 | HIGH | LOW | Hard prohibition enforced. Script remains strictly undeployed. |
| **RSK-02** | Accidental use of personal/production Google account | HIGH | LOW | Explicit verification required; dedicated test Google account only. |
| **RSK-03** | Formula injection in cell inputs | MEDIUM | LOW | Fully mitigated by `sanitizeFormula()` escaping all leading `=, +, -, @` characters. |
