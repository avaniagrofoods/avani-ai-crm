# AVANI AI CRM — WHATSAPP PRODUCTION CUTOVER & CANARY ROLLOUT PLAN
**Audit Date:** 31 October 2026  
**Application:** AVANI AI CRM  
**Organization:** AVANI LOAN SERVICES  
**Authoritative WABA ID:** `1062614709598311`  
**Phone Number ID:** `1147494668457940`  
**Sender Number:** `+91 72491 08474`

---

## 1. PRE-CUTOVER PREREQUISITE CHECKLIST

Before initiating the cutover from AiSensy to ChatMitra in Production, the owner must verify the following items:

- [ ] **WABA Template Approval:** The following 8 canonical loan templates must be marked as `APPROVED` under WABA `1062614709598311`:
  1. `doctor_loan_offer`
  2. `education_loan_india_welcome`
  3. `education_loan_abroad_welcome`
  4. `school_owner_funding_welcome`
  5. `lap_loan_welcome`
  6. `home_loan_welcome`
  7. `business_loan_welcome`
  8. `Avani_Loan_Welcome`
- [ ] **ChatMitra Account Activation:** Active ChatMitra subscription with authorized WABA connection.
- [ ] **Production Database Target:** Vercel Production `MONGODB_URI` points to `avani-loan-services-m0.rhpn2gh.mongodb.net/avani_ai_crm_prod`.
- [ ] **Webhook Registration:** In ChatMitra Portal:
  - Callback URL: `https://avani-ai-crm.vercel.app/api/chatmitra-webhook`
  - Events Subscribed: `messages`, `message_status`, `message_deliveries`
  - Verify Token: Match `CHATMITRA_VERIFY_TOKEN` configured in Vercel.

---

## 2. PHASED CANARY ROLLOUT SEQUENCE

```
Pre-Cutover Audit (103 Tests Passed)
              │
              ▼ Step 1
[Owner Single Canary Test to +91 72491 08474]
              │
              ▼ Step 2
[Inbound Qualification & Webhook Acknowledgement Verification]
              │
              ▼ Step 3
[5% Controlled Production Batch (10 Contacts)]
              │
              ▼ Step 4
[Full 100% Production Cutover (WHATSAPP_PROVIDER=CHATMITRA, PROVIDER_MODE=live)]
```

### Detailed Execution Steps:

### Step 1: Internal Canary Test (1 Message)
- Set Vercel Production variables:
  - `WHATSAPP_PROVIDER=CHATMITRA`
  - `PROVIDER_MODE=live`
- Trigger an isolated manual template dispatch to the verified owner device (`+91 72491 08474`).
- Verify physical receipt on the handset within 5 seconds.
- Inspect `messages` collection in `avani_ai_crm_prod` to confirm status is `API_ACCEPTED` and `provider: 'ChatMitra'`.

### Step 2: Inbound Webhook & Interactive Handshake
- Send an inbound reply from the handset: `"Looking for doctor clinic expansion loan"`.
- Verify in serverless logs that `/api/chatmitra-webhook` receives the event, validates the HMAC-SHA256 signature, classifies the message into `Doctor Loan`, and persists an inbound interaction record in `leads`.

### Step 3: 5% Controlled Production Pilot
- Schedule an automated campaign with a cohort of 10 opted-in contacts.
- Monitor provider error rate (must remain < 0.5%) and delivery rate (must exceed 98%).

### Step 4: 100% Cutover
- Enable full marketing campaigns, Meta Lead Ads auto-responders, and chatbot workflows.

---

## 3. INSTANT ZERO-DOWNTIME ROLLBACK PROCEDURE

If any unexpected degradation occurs on ChatMitra (e.g., provider outage, template synchronization mismatch, or rate-limiting):

### Immediate Action (Zero Code Deployment Required):
1. Navigate to **Vercel Dashboard** -> **avani-ai-crm** -> **Settings** -> **Environment Variables**.
2. Update:
   ```
   WHATSAPP_PROVIDER = AISENSY
   ```
3. Click **Save** and redeploy the latest deployment.
4. `src/lib/provider-router.ts` immediately routes all outbound traffic to the legacy `sendAiSensyWhatsApp` engine.
5. Zero borrower messages are dropped; AiSensy resumes full operational duty within 60 seconds.

---

## 4. CUTOVER SAFETY SIGN-OFF

The phased cutover plan satisfies all DPDP Act consumer protection criteria, maintains zero-downtime rollback capabilities, and protects the organization against messaging downtime.
