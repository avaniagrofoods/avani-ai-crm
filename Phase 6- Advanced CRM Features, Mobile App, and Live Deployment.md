# Phase 6: Advanced CRM Features, Mobile App, and Live Deployment

## Goal Description
Implement advanced error handling for CSV uploads, a two-way live chat dashboard to see replies, generate a dedicated Android App for the CRM, and deploy the system to a live URL.

## User Review Required
> [!IMPORTANT]
> Because you requested an **Android App** and a **Live Site Link**, I need your approval on the following technical approach:
> 1. **Android App**: I will use Capacitor to wrap your existing Next.js web dashboard into an Android APK. You will be able to install this `.apk` directly on your phone.
> 2. **Live Site Link**: Since your database is currently running locally on your computer, the fastest way to give you a live link right now without migrating your database to a paid cloud provider is to use **LocalTunnel**. I will generate a live `loca.lt` link that tunnels to your machine. Is this acceptable for testing, or do you want me to deploy the database and backend to a public cloud server (which requires account setups)?

## Proposed Changes

### 1. CSV Upload Success/Failure Dashboard
- **Backend (`ContactsService`)**: Modify the CSV upload and bulk message functions to validate phone numbers. It will return two arrays: `successful` and `failed` (for numbers that are invalid or fail WhatsApp delivery).
- **Frontend (`ContactsPage`)**: Update the UI alert to display a detailed breakdown of which contacts were successfully imported and which ones failed.

### 2. Live Chat Inbox (Two-Way Chat)
- **Frontend (`InboxPage`)**: Create a new `/inbox` page (linked from the "Chatbot" menu item) that displays a WhatsApp-style chat interface.
- **Backend**: Ensure the webhook properly saves incoming messages to the Prisma database, and create a `GET /messages/:contactId` endpoint to fetch the chat history for the UI.

### 3. CRM Operations Guide
- **Artifact**: I will generate a comprehensive, downloadable `avani_crm_operations_guide.md` file containing the exact step-by-step procedures for operating all 16 tools in your left sidebar.

### 4. Android App Generation
- **Build Step**: I will install `@capacitor/core` and `@capacitor/android`, build your Next.js project, and generate an Android project.
- **Output**: I will compile the Android project into a standard `.apk` file that you can transfer to your Android phone and install.

### 5. Live Deployment
- **LocalTunnel**: I will run `npx localtunnel --port 3000` to expose your frontend, and `npx localtunnel --port 4000` to expose your backend/webhook to the public internet so you can access it from your phone.

## Verification Plan
- Upload a CSV with a mix of valid and invalid numbers to verify the success/fail UI.
- Send a WhatsApp message from a phone and verify it appears in the new `/inbox` live chat dashboard.
- Provide the generated `.apk` file path and the Live LocalTunnel URL.
