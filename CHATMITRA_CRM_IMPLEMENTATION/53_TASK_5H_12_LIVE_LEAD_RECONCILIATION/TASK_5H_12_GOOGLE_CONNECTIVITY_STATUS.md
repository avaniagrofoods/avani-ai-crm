# TASK 5H.12 — GOOGLE CONNECTIVITY STATUS REPORT
## AUTHENTICATION STATUS, GATEWAY ENDPOINTS & RESOURCE REACHABILITY

**Document Version:** 1.0.0  
**Date:** 2026-11-19T16:55:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Google Sheets Integration Engineer & Security Engineer  

---

### 1. GOOGLE ACCOUNT & SPREADSHEET INVENTORY

| Environment Dimension | Production Live Source | Isolated Test Destination |
|---|---|---|
| **Spreadsheet Title** | `AVANI LOAN SERVICE FY26-27` | `AVANI_AI_CRM_ISOLATED_TEST` |
| **Google Drive Owner** | `avaniloanservicelatur@gmail.com` | Authenticated Google session (`sachin.shinde...`) |
| **Spreadsheet ID** | `1iwWWEB3nJnboJv8nKteOni1bhNgdE-mLlhOhkNSg4Zw` | `1onRvXrdwiEYwLxCMYnHjRiJ4FtOri1Hs74LC...` |
| **Container-Bound Script** | `AKfycbyoAmAabpO9PUDH-AXatZm5Td7pO...` | `AVANI_AI_CRM_TEST_GATEWAY` |
| **Active Deployment ID** | Legacy v1 (archived / disabled) | Web App v2 (`AKfycbwadPvvLiVgLOUbIcnQm7Ze...`) |
| **Access Control** | Restrictive (Google OAuth) | HMAC-SHA256 Secret + Request Nonce |
| **Direct Application Connectivity** | Read-only forensic export / local archive | Fully operational bi-directional HTTPS Gateway |

---

### 2. GATEWAY AUTHENTICATION & HEALTH VERIFICATION

1. **Authentication Mode:** The isolated Apps Script Web App executes as the spreadsheet owner (`Execute as: Me`) and restricts invocation to authorized clients presenting a valid `X-Gateway-Signature` (HMAC-SHA256).
2. **Health Check Probe:**
   - Action: `HEALTH_CHECK`
   - Response: `{"ok": true, "status": 200, "code": "OK", "data": {"status": "HEALTHY", "version": "2026.11.5H13"}}`
3. **Multi-Tab Snapshot Probe:**
   - Action: `GET_SNAPSHOT` across all 9 tabs.
   - Response: Returns headers and row counts for `CUSTOMERS`, `LEADS`, `APPLICATIONS`, `FOLLOWUPS`, `CONSENTS`, `MESSAGE_EVENTS`, `WEBHOOK_EVENTS`, `ADVISORS`, and `SYSTEM_CONFIG`.
4. **Connectivity Verdict:** **ACTIVE, HEALTHY, AND FULLY REPRODUCIBLE.**
