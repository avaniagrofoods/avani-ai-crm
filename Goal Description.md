# Goal Description

The objective is to implement two major feature updates based on your latest requirements:
1. **CRM Campaign UI Update**: Enhance the CSV upload screen in the CRM so that instead of just showing a progress bar, it displays a detailed list of all uploaded phone numbers along with their call trigger status (e.g., Success, Failed).
2. **WhatsApp AI Agent Logic**: Completely overhaul the Gemini AI System Prompt in the `avani-loan-agents` backend. The new prompt will follow your exact step-by-step conversational flow (Basic Info -> Income -> Loan Details -> Document Checklist) and include the highly detailed document checklists you provided for all loan types (Personal, Business, Doctor, CA, Education, and Home).

## User Review Required

Please review the proposed conversational flow for the WhatsApp AI agent to ensure it matches your exact expectations. The AI will strictly follow the checklists you provided.

## Open Questions

- For the Campaign UI, when you mention "which nos received, failed, and not seen msgs", please note that our current script triggers the *Voice Call* first via Bland AI. We can immediately show if the call was *successfully triggered* or *failed to trigger*. Real-time WhatsApp delivery statuses (like "read" or "not seen") require a more complex webhook integration with Meta to track read receipts. For now, I will build the table to show if the system successfully triggered the call/message process for each number. Is this acceptable for Phase 1?

## Proposed Changes

---

### CRM Frontend (3-AVANI AI CRM)

#### [MODIFY] FileUpload.tsx
- Update the `FileUpload` React component to maintain an array of results instead of just a success count.
- Once the upload finishes, instead of a simple "Campaign Completed!" checkmark, render a clean, scrollable table displaying each Lead Name, Phone Number, and their Status (e.g., ✅ Triggered, ❌ Failed).

---

### WhatsApp AI Agent Backend (4-AVANI LOAN AGENTS)

#### [MODIFY] whatsapp-webhook/route.ts
- Rewrite the `SYSTEM_PROMPT` string entirely to match your new logic.
- **Phase 1 (Basic Info)**: Full Name -> Mobile Number -> Email -> City.
- **Phase 2 (Employment Profile)**: Ask if Salaried, Self Employed, Business Owner, or Professional.
- **Phase 3 (Income & Loan)**: Ask Monthly Income bracket -> Required Loan Amount.
- **Phase 4 (Documents)**: Deliver the exact, highly detailed document checklists based on their Loan Type and Employment Profile (e.g., Salaried vs Business vs Farmer for Education Loan).

## Verification Plan

### Automated Tests
- Test the `FileUpload` component with a dummy CSV to ensure the table renders the correct statuses.

### Manual Verification
- Deploy both repositories to Render via GitHub push.
- You can manually test the WhatsApp AI by messaging the bot and answering its questions to verify it follows the exact new sequence and provides the correct documents.
