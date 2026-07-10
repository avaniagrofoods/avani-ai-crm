# Goal: Full Setup of All 16 CRM Tools

The goal is to take the 16 newly created dashboard interfaces and fully wire them up to the database so they are completely functional (Create, Read, Update, Delete capabilities). Because this requires building 16 separate API modules and hundreds of frontend components, we must break this down into manageable implementation phases to ensure everything works perfectly.

## User Review Required

> [!IMPORTANT]
> Fully developing 16 full-stack software tools takes considerable time and code. To ensure maximum stability and prevent system crashes, I propose we implement them in **4 Phases**. 
> 
> If you approve this plan, I will immediately begin executing **Phase 1** in full auto-mode.

## Open Questions

> [!WARNING]  
> Are you okay with me prioritizing **Tags, Tasks, and Projects** in the very first phase? (These are the easiest to build and test quickly to give you immediate organizational tools).

## Proposed Changes

We will execute the implementation in the following phases:

### Phase 1: Core Organization (Tags, Tasks, Projects)
**Backend (NestJS + Prisma):**
* Update `schema.prisma` to add the `Project` model and link it to tasks and contacts.
* Generate full REST APIs (`GET`, `POST`, `PATCH`, `DELETE`) for Tags, Tasks, and Projects.
**Frontend (Next.js):**
* Build interactive data tables to list items.
* Build "Add New" popup modals to create new Tags, assign Tasks, and create Projects.
* Wire up real-time API fetching.

---

### Phase 2: Communication Core (Templates, Webhooks, Gallery)
**Backend:**
* Create APIs to upload media (Gallery).
* Create APIs to save and sync WhatsApp Templates with Meta.
* Build a Webhook logging system to track message delivery status (Sent/Delivered/Failed).
**Frontend:**
* Build a Template Editor interface.
* Build a Media Grid for the Gallery.
* Build a live log viewer for Webhook Events.

---

### Phase 3: Automation & AI (FAQ Bot, Chatbot, AI Assistant)
**Backend:**
* Create database models for FAQ rules, keyword triggers, and AI Prompts.
* Update the WhatsApp Webhook handler to intercept messages and trigger automated replies.
**Frontend:**
* Build a rule builder for the FAQ Bot (e.g. "If message contains 'loan', reply with X").
* Build an AI settings page to define the Assistant's personality and instructions.

---

### Phase 4: Advanced CRM (Columns, Opts, Forms, Knowledge Base, Developers, Settings)
* Expand the database to support dynamic custom columns.
* Build the document upload system for the Knowledge Base.
* Build the drag-and-drop WhatsApp Form builder.
* Finalize Workspace Settings and Developer API key generation.

## Verification Plan

### Automated Tests
* I will run `npx prisma db push` to verify database integrity after every schema change.
* I will monitor the NestJS dev server logs to ensure no routes crash.

### Manual Verification
* After each phase, I will invite you to test the live web URL. You will be able to click "Add New" on the respective tools and verify that the data appears instantly.
