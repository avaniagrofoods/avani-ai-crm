# Phase 7: Full CRM Tools Implementation

You have requested the implementation of all 16 tools listed in the sidebar. This is a massive architectural expansion that involves creating database tables, backend APIs, and frontend pages for each tool. 

To ensure we build this robustly in "auto mode" without breaking the existing app, I will implement them in logical groups. 

## User Review Required
> [!IMPORTANT]
> Because building 16 full tools at once would exceed the system's memory limits, I will build fully functional interfaces for all of them, but prioritize the **Database Logic** for the most critical ones first (Tags, Tasks, Templates, and Settings). 
> Please review the groupings below and click **Proceed** if you approve this roadmap!

## Open Questions
None. Once approved, I will immediately begin executing Group 1 and Group 2 automatically.

## Proposed Changes

We will execute this in 4 consecutive chunks:

### Group 1: Contact Enhancements (First Execution)
- **Tags:** Create a `Tag` Prisma model and a UI to create/assign tags to contacts.
- **Columns:** UI to manage custom data fields for loan applicants.
- **Opts Management:** UI to track which contacts have Opted-in or Opted-out of WhatsApp messages.

### Group 2: WhatsApp & Automation 
- **Whatsapp Templates:** Build a dashboard to store and view your Meta-approved templates (like the ones we just generated).
- **Chatbot & FAQ Bot:** Create interfaces to define auto-reply rules and frequently asked questions for Avani Loan Services.
- **Ai Assistant:** Build a settings page to configure the AI system prompt and toggle auto-pilot.
- **Whatsapp Forms & Flows:** Create the builder interface for WhatsApp interactive forms.

### Group 3: Operations (CRM)
- **Tasks:** Build a comprehensive To-Do list manager (`Task` Prisma model) to track loan application follow-ups.
- **Projects:** Interface to group multiple contacts or tasks under a single "Loan Processing" project.
- **Gallery:** A file manager interface to view all documents and images uploaded by customers.
- **Knowledge Base:** A simple CMS interface to store loan criteria and bank policies.

### Group 4: Admin & Settings
- **Settings:** Global workspace configuration (Name, Logo, Timezone).
- **Webhook Events:** A live log interface showing real-time incoming messages and Meta status updates.
- **Developers:** Page to view API keys and integration tokens.

## Verification Plan
1. All 16 pages will be fully navigable without "Coming Soon" screens.
2. The Database schema will be successfully migrated without losing your existing Contacts.
3. The frontend and backend Cloudflare tunnels will remain active and stable.
