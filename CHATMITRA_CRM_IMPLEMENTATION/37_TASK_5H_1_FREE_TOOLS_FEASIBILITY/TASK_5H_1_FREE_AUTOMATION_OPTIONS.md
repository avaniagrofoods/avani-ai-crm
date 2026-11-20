# TASK 5H.1D — FREE AUTOMATION AND INTEGRATION OPTIONS
## ZERO-COST (₹0 / $0) AUTOMATION, SYNTHETIC WEBHOOK & REPORTING ARCHITECTURE
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026  
**Execution Mode:** Strictly Read-Only Evaluation  
**Hard Cost Ceiling:** **₹0.00 INR / $0.00 USD**  
**Zero External Communication Rule:** No WhatsApp messages sent, no voice calls placed, no real CRM customer records created, and no external provider endpoints called.

---

### 1. CLASSIFICATION TAXONOMY FOR AUTOMATION TOOLS

Every evaluated tool is strictly classified into one of four governance categories:

| Category ID | Category Name | Governance Policy in Task 5H.1 |
| :---: | :--- | :--- |
| **Category 1** | **Permanently Free / Open-Source** | **APPROVED & PREFERRED** (₹0 / $0 forever; no billing account, no usage overage risk). |
| **Category 2** | **Permanent Free Tier with Strict Limits** | **CONDITIONALLY APPROVED AT ₹0** (Only if credit card is not required or hard free cap prevents any charge; all limits and billing risks must be documented). |
| **Category 3** | **Time-Limited Trial** | **STRICTLY EXCLUDED** (Creates deferred cost cliff and renewal lock-in). |
| **Category 4** | **Paid Service / Subscription** | **STRICTLY EXCLUDED** (Violates ₹0 / $0 cost ceiling). |

---

### 2. EVALUATION ACROSS ALL 10 AUTOMATION & INTEGRATION DOMAINS

| # | Automation Domain | Recommended Free Solution (Already Installed) | Category Classification | Limitations & Billing Risk Mitigation | Excluded Paid / Trial Alternatives (Cat 3 & 4) |
| :-: | :--- | :--- | :---: | :--- | :--- |
| **1** | **API Testing** | **Node.js `http`/`fetch` + `axios` (`1.18.1`) + `curl.exe` (`8.13.0`)** | **Category 1** (Permanently Free / Open-Source) | Zero cost, unlimited local calls, scripts stored directly in Git (`tests/*.test.cjs`). Zero billing risk. | Postman Paid Teams ($14–$49/user/mo — Cat 4); Insomnia Paid Plans (Cat 4). |
| **2** | **Webhook Testing** | **Local Node.js Synthetic Webhook Harness (`node:http` + `node:crypto` + direct route invocation)** | **Category 1** (Permanently Free / Open-Source) | Tests webhook handlers directly in-process or over `127.0.0.1` without exposing public ports. Zero billing risk. | Paid ngrok Pro ($8–$20/mo — Cat 4); Hookdeck Paid / Svix Paid (Cat 4); Webhook.site Pro (Cat 4). |
| **3** | **WhatsApp Webhook Development (Synthetic Requests)** | **Offline Meta/ChatMitra HMAC-SHA256 Payload Generator (`node:crypto.createHmac('sha256', mockSecret)`)** | **Category 1** (Permanently Free / Open-Source) | Generates RFC-compliant `x-hub-signature-256` signatures and synthetic WhatsApp inbound payloads (`tests/test_task3_chatmitra_webhook_hardening.test.cjs` & `test_task4_meta_webhook_verification.test.cjs`). **Sends 0 outbound messages.** | Live Meta WhatsApp Conversation Billing (Per-conversation INR charges — Cat 4); Paid BSP Sandbox Add-ons (Cat 4). |
| **4** | **CRM Workflow & Opt-Out Testing** | **Node.js Native Test Runner (`node:test`) + TypeScript In-Memory Compiler (`ts.transpileModule`)** | **Category 1** (Permanently Free / Open-Source) | Exercises actual TypeScript business logic (`optout-engine.ts`, lead triage, RBAC, rate-limiting) offline with synthetic fixtures (`+919999900001`–`05`). **Places 0 Vapi/Twilio calls.** | Live Vapi AI Voice Minutes ($0.05–$0.15/min — Cat 4); Live Twilio Voice/SMS charges (Cat 4); Cypress Cloud Paid Dashboard (Cat 4). |
| **5** | **Local Scheduled Automation** | **Windows Task Scheduler (`schtasks.exe`) + PowerShell 5.1 (`.ps1`) + `node-cron` (`4.2.1`)** | **Category 1** (Permanently Free / Built-in OS & ISC Open-Source) | Runs only when the local workstation is powered on; zero cloud compute cost. | Paid Cloud Cron / Vercel Pro Cron limits ($20/mo — Cat 4); Zapier / Make Paid Subscriptions (Cat 3/4). |
| **6** | **CSV and Excel Processing** | **Python 3.14.5 (`csv`, `json`, `zipfile`, `xml`) + Installed `exceljs` (`4.4.0`) + `papaparse` (`5.5.4`)** | **Category 1** (Permanently Free / PSF & MIT Open-Source) | Creates and validates multi-sheet `.xlsx` files with formulas (`exceljs`) and parses large CSV files (`papaparse`/`csv`) locally at ₹0. | Microsoft 365 Paid License / Excel Desktop Subscription (Cat 4); Paid Cloud ETL Tools (Cat 4). |
| **7** | **Log Analysis & Forensics** | **Python 3.14.5 (`json`, `re`) + PowerShell (`Select-String`, `ConvertFrom-Json`)** | **Category 1** (Permanently Free / Built-in OS & PSF Open-Source) | Parses JSONL transcripts, diagnostic logs, and test outputs locally with zero ingestion cost. | Datadog Log Management (Cat 3/4); Splunk / New Relic / Logtail Paid tiers (Cat 4). |
| **8** | **Git Backup & Integrity Verification** | **Git CLI (`2.56.1`) + PowerShell `Get-FileHash` (SHA-256) + GitHub Free Remote** | **Category 1** (Git/PS) + **Category 2** (GitHub Free Tier) | Git CLI & SHA-256 checks are 100% free offline. **GitHub Free (Cat 2) Limit:** Free repo hosting; avoid automated cloud GitHub Actions runs to stay well below the 2,000 free Actions minutes/month cap. | Paid GitHub Team/Enterprise ($4–$21/user/mo — Cat 4); Paid Cloud Backup SaaS (Cat 4). |
| **9** | **Documentation Generation** | **Native GitHub-Flavored Markdown (`.md`) + Mermaid Diagrams + `jspdf` (`4.2.1`) + HTML Reports** | **Category 1** (Permanently Free / Open-Source) | Version-controlled in Git, readable in any editor or browser, zero licensing fees. | Confluence Paid Plans (Cat 4); Notion Plus/Business (Cat 4); GitBook Paid (Cat 3/4). |
| **10** | **Test Reporting & Evidence Auditing** | **Node `node:test` Reporter + Markdown Evidence Tables + `exceljs` Audit Workbooks + SHA-256 Checksum Logs** | **Category 1** (Permanently Free / Open-Source) | Deterministic, reproducible test logs and cryptographic SHA-256 verification manifests stored in `CHATMITRA_CRM_IMPLEMENTATION/`. | TestRail Paid (Cat 3/4); BrowserStack / SauceLabs Paid Cloud Grids (Cat 3/4). |

---

### 3. SYNTHETIC WHATSAPP & CRM WORKFLOW ISOLATION PROTOCOL

To guarantee **₹0 cost** and **100% customer safety** during all webhook and CRM workflow testing:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│        100% OFFLINE SYNTHETIC WEBHOOK & WORKFLOW TESTING ARCHITECTURE       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Local Node Test Script]                                                   │
│     │                                                                       │
│     ├─► 1. Generates Synthetic Payload (Phone: +919999900001, ID: SYNTH_01) │
│     ├─► 2. Signs Payload with Mock Secret via node:crypto HMAC-SHA256       │
│     ├─► 3. Invokes Webhook Route / Opt-Out Engine In-Process (Offline)      │
│     └─► 4. Asserts Response, State Transition & DB Isolation Guard          │
│                                                                             │
│  =========================================================================  │
│  EXTERNAL NETWORK BOUNDARY (STRICTLY BLOCKED / NEVER CALLED IN TESTS):      │
│    ✗ graph.facebook.com (Meta WhatsApp Cloud API)                           │
│    ✗ api.chatmitra.com  (ChatMitra Outbound Dispatch)                       │
│    ✗ api.vapi.ai        (Vapi Voice AI Calling)                             │
│    ✗ api.twilio.com     (Twilio SMS / Voice Telephony)                      │
│    ✗ rhpn2gh.mongodb.net (Production MongoDB Atlas Cluster)                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Zero Outbound Provider Dispatch:** Inbound webhook tests verify signature authentication, idempotency deduplication, opt-out keyword detection (including Hindi `रोकें`), and dead-letter handling using mocked or dry-run dispatch interfaces.
2. **Reserved Synthetic Identifiers Only:** All automated workflow tests must use the non-routable synthetic phone block `+919999900001` through `+919999900005` and synthetic IDs (`SYNTH_LEAD_001`, `SYNTH_MSG_001`).
3. **Zero Cost Guarantee:** Because no external telecom, WhatsApp BSP, or voice AI API is ever contacted during automated testing, per-message and per-minute usage charges are mathematically **₹0.00 / $0.00**.
