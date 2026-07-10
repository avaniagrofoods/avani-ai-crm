# Goal: Implement Phase 2 Tools & Vercel Integration

We are proceeding with Phase 2 of the CRM Tools implementation and setting up Vercel integration for the frontend.

## User Review Required

> [!IMPORTANT]
> **Vercel Deployment Details:**
> - Next.js is configured for static export (`output: 'export'`). This means it will build into a fast, static site that is perfect for free Vercel hosting.
> - Because it's static, Vercel will host the frontend, while your NestJS backend will continue running on its server (with API requests securely routed to your backend tunnel or production backend URL).
> - To deploy to Vercel, we can run `npx vercel` from the command line. This will prompt you to log into your Vercel account in the console.

## Proposed Changes

We will execute the following implementations:

### 1️⃣ Phase 2 CRM Tools (Templates, Webhooks, Gallery)
* **WhatsApp Templates:** 
  * Backend: Implement `/templates` CRUD APIs to store, delete, and list templates.
  * Frontend: Replace the placeholder [Templates](file:///C:/Users/ALPHA-1/Desktop/AVANI%20AI%20CRM/frontend/src/app/templates/page.tsx) page with an interactive screen to view, create, and delete WhatsApp templates.
* **Webhook Events:** 
  * Backend: Add `/webhooks` endpoint to list incoming WhatsApp status events.
  * Frontend: Replace the placeholder [Webhooks](file:///C:/Users/ALPHA-1/Desktop/AVANI%20AI%20CRM/frontend/src/app/webhooks/page.tsx) page with a real-time event log viewer.
* **Media Gallery:** 
  * Backend: Add support for media upload and storage retrieval.
  * Frontend: Replace [Gallery](file:///C:/Users/ALPHA-1/Desktop/AVANI%20AI%20CRM/frontend/src/app/gallery/page.tsx) with a responsive media grid to view/download uploaded documents (Aadhar, PAN cards, etc.).

### 2️⃣ Vercel Deployment Configuration
* Create [vercel.json](file:///C:/Users/ALPHA-1/Desktop/AVANI%20AI%20CRM/frontend/vercel.json) in the `frontend` folder to handle routing rules for Next.js static exports.
* Run the initial Vercel setup commands.

---

## Verification Plan

### Automated Verification
* Verify NestJS compilation and Prisma database mapping.
* Run Next.js builds locally to ensure the export bundle compiles without errors.

### Manual Verification
* Access the new Vercel-deployed frontend and check if CRUD operations work.
