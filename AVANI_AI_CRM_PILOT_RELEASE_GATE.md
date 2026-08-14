# AVANI AI CRM — PILOT RELEASE GATE

```text
============================================================
AVANI LOAN SERVICES — PILOT RELEASE GATE SPECIFICATION
============================================================
DATE & TIMESTAMP            : 2026-08-14 20:29:45 IST
PRIMARY CRM SOURCE OF TRUTH : AVANI AI CRM (3-AVANI AI CRM)
PRODUCTION DEPLOYMENT URL   : https://avani-ai-crm.vercel.app
GITHUB REPOSITORY           : https://github.com/avaniagrofoods/avani-ai-crm.git
ACTIVE BRANCH               : release/stage1-hardening

PILOT CAMPAIGN IDENTIFIER   : DOCTOR_LOAN_PILOT_01
PILOT RECIPIENT COUNT       : Exactly 3 Eligible Candidates (CONTACT_LIMIT=3)
APPROVED WABA TEMPLATE      : doctor_loan_offer / Avani_Loan_Welcome [en] [APPROVED]
VOICE CALL ADAPTER GATE     : READY_DISABLED (OMNIDM_LIVE_ENABLED=false)

PILOT GATE STATUS           : 🛑 BLOCKED (Awaiting Controlled Number Customer Reply Verification)
============================================================
```

## 1. Pilot Candidate Allocation (3 Leads)

1. `AVL-20260811-000008` \| `DR. BHARAT THADKAR SIR` \| `+919822856969`
2. `AVL-20260811-000009` \| `DR. RAJESH KULKARNI SIR` \| `+918055169202`
3. `AVL-20260811-000010` \| `DR. B.B. BAHETI SIR` \| `+919423775666`

---

## 2. Mandatory Gate Unlocking Criteria

`DOCTOR_LOAN_PILOT_01` may only be executed when:

1. Controlled Test Number (`+919175635165`) receives an inbound WhatsApp reply (`"Hi"` / `"Hi, I need a doctor loan"`).
2. `WebhookInbox` records the inbound event.
3. `whatsapp-webhook-worker` executes `AgentEngine.processMessage()`.
4. AI generates outbound response and records `Message` + `ProviderLedger` persistence.
5. HubSpot, Google Sheets (`AKfycbyoAmAabpO9PUDH...`), and Zapier log the transaction cleanly.

---

## 3. Post-Pilot Safety Directives

- **NO AUTOMATIC BULK BROADCASTS**: Pilot batch limited to 3 contacts.
- **STAGE 2 REMAINS LOCKED**: Remaining 49 Doctor Loan contacts locked.
- **OMNIDM LIVE CALLS BLOCKED**: `OMNIDM_LIVE_ENABLED=false` (₹0.00 spent).
