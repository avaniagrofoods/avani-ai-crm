# Phase 5: Profile Update and Bulk Messaging Integration

## Goal Description
Update the sidebar profile details to match "Sachin Shinde / Avani Loan Services" and build out the Bulk Messaging functionality so you can upload a CSV and broadcast messages to those contacts.

## Proposed Changes

### 1. Sidebar Profile Updates
- **File**: `frontend/src/components/layout/sidebar.tsx`
- **Changes**: Update the user initials to "SS", name to "Sachin Shinde", and email to "enquiry@avanifinserv.com".

### 2. Bulk Message Sending (Backend)
- **File**: `backend/src/contacts/contacts.controller.ts` & `backend/src/whatsapp/whatsapp.service.ts`
- **Changes**: Add a `POST /contacts/bulk-message` endpoint that accepts a message body, retrieves all contacts from the database (or accepts a list of IDs), and iterates through them to send a WhatsApp template/text message using the `WhatsappService`.

### 3. Bulk Message Sending (Frontend)
- **File**: `frontend/src/app/contacts/page.tsx`
- **Changes**: Add a "Send Bulk Message" button that opens a prompt/modal for the message body, then calls the backend API to broadcast the message to all loaded contacts.

## Verification
- Verify the sidebar displays the correct user details.
- Verify the bulk message function correctly triggers multiple WhatsApp send events.
