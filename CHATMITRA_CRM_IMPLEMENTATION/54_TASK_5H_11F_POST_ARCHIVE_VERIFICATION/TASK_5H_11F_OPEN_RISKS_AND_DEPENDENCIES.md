# TASK 5H.11F — REPORT 10
## Open Risks, Environmental Dependencies & Mitigation Strategies

- **Task:** 5H.11F — Risk Assessment & Dependency Audit
- **Project Scope:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

---

### 1. Risk Matrix

| Risk ID | Risk Description | Severity | Likelihood | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | **Premature Web App Deployment:** Deploying the Apps Script gateway before Gate 3 leaves an exposed public `/exec` URL. | HIGH | LOW | Strict Gate 2 boundary prohibits clicking Deploy. Script remains undeployed in Gate 2. |
| **RSK-02** | **Google Account Confusion:** Creating test resources inside personal or production Google accounts instead of dedicated test account. | HIGH | LOW | Owner connects/authenticates only the dedicated test account via Plugins Manager or creates sheet under test Google profile. |
| **RSK-03** | **Unauthenticated Plugin Operation:** If Antigravity `gsheets` plugin is not authenticated by the user, automated sheet creation via MCP tool fails. | MEDIUM | MEDIUM | Two supported paths: (A) User connects plugin via IDE Plugins Manager, OR (B) User creates sheet manually in browser and provides sheet ID. |
| **RSK-04** | **Google Apps Script Quota Caps:** Rapid batch requests during future Gate 4 testing exceeding daily quota. | LOW | LOW | Batching limits ($\le 500$ rows) and rate-limiting throttling implemented in `gateway-client.ts`. |
| **RSK-05** | **Formula Injection via Inbound Data:** Webhook strings containing malicious spreadsheet formulas. | MEDIUM | LOW | Fully mitigated by `sanitizeFormula()` escaping all leading `=, +, -, @` characters. |

---

### 2. Environmental Dependencies

1. **Google Account Access:** Requires an authenticated Google account session (via Plugins Manager or browser).
2. **Offline Local Toolchain:** Requires Node.js 18+ and TypeScript compiler (both verified working, exit code 0).
3. **Owner Approval Workflow:** Requires explicit, staged owner authorizations across Gate 2 (Creation), Gate 3 (Deployment), Gate 4 (Testing), and Gate 5 (Production).
