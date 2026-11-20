# TASK 5H.13 — REPORT 7
## Apps Script Web App Deployment Configuration & Access Decision

- **Task:** 5H.13 — Section 7 Deployment Configuration
- **Target Component:** `AVANI_AI_CRM_TEST_GATEWAY`

---

### 1. Access Configuration Decision Analysis

To integrate Next.js (`Project 2`) with Google Apps Script, two possible access models were evaluated:

| Access Model | Google Authentication Required? | Server-to-Server Feasibility | Security & Risk Assessment |
| :--- | :--- | :--- | :--- |
| **Option 1: Restricted to Google Account** | Yes (Requires Google OAuth User Consent or Service Account) | Extremely complex in Next.js without broad OAuth consent screens and domain verification | High friction, fragile refresh token management, requires Google Cloud OAuth consent screens. |
| **Option 2: Anyone (Anonymous HTTP) + HMAC-SHA256 (Selected)** | No Google login required on HTTP call | Highly reliable server-to-server POST via Next.js backend | Secure when paired with strict HMAC-SHA256 signatures, replay defense, 64 KB ceiling, and spreadsheet allowlisting. |

#### Decision & Risk Disclosure:
Option 2 (**Execute as: Me**, **Who has access: Anyone**) is selected for the isolated test gateway.
- **Exposure:** The Web App `/exec` URL is publicly reachable.
- **Defenses Enforced:**
  1. Every request MUST supply an `X-Signature` calculated as `HMAC_SHA256(secret, timestamp + "." + reqId + "." + body)`.
  2. The gateway rejects any request where `|now - timestamp| > 300` seconds.
  3. Replay attacks are blocked using `CacheService` nonce tracking.
  4. Caller cannot access any sheet other than `ALLOWED_SPREADSHEET_ID`.
  5. The URL is never committed to Git or printed in documentation.

---

### 2. Deployment Instructions for the Owner

Once `Code.gs` is updated with clean JavaScript:

1. In the Apps Script editor, open **Project Settings** (gear icon on left).
2. Scroll to **Script Properties** and click **Add script property**:
   - Property 1: `ALLOWED_SPREADSHEET_ID` = `[Your Isolated Test Spreadsheet ID]`
   - Property 2: `GATEWAY_HMAC_SECRET` = `[Generate a secure 64-character hex string]`
   - Click **Save script properties**.
3. In the top right, click **Deploy** $\rightarrow$ **New deployment**.
4. Click the gear icon next to "Select type" and select **Web app**.
5. Configure:
   - **Description:** `AVANI_AI_CRM_TEST_GATEWAY — Isolated Test v2`
   - **Execute as:** `Me (your-test-account@gmail.com)`
   - **Who has access:** `Anyone`
6. Click **Deploy**.
7. Google will show: **"Deployment successfully created"** with a **Web app URL** (`https://script.google.com/macros/s/.../exec`).
8. Copy the URL and configure it locally in `.env.local` as `GOOGLE_SHEETS_GATEWAY_URL`.
