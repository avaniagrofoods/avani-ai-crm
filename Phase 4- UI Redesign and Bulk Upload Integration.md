# Phase 4: UI Redesign and Bulk Upload Integration

## Goal Description
Redesign the dashboard UI to match the provided references (Navy blue background, off-white colors, and a comprehensive sidebar). Implement a new feature to bulk upload contacts via CSV/XLS files.

## Proposed Changes

### 1. UI Redesign (Frontend)
- **Sidebar Component**: Update `src/components/Sidebar.tsx` to include all the requested navigation items (Whatsapp Templates, Forms, Tags, FAQ Bot, Chatbot, AI Assistant, etc.). Style it with a dark navy theme and green active states.
- **Global Theme**: Update `globals.css` and layout files to enforce a navy blue background with off-white text/containers to match the visual reference.

### 2. File Upload API (Backend)
- **Dependencies**: Install `@nestjs/platform-express`, `multer`, and `csv-parser` in the NestJS backend.
- **Upload Endpoint**: Create `POST /contacts/upload` in the `ContactsController` that accepts a multipart/form-data file upload.
- **Processing Logic**: Parse the CSV file and use Prisma `createMany` or iterate to bulk-insert contacts into the database.

### 3. File Upload UI (Frontend)
- **Contacts Page**: Add an "Upload Contacts" button to the `/contacts` page.
- **Upload Modal/Form**: Create a simple file input that posts the selected CSV/XLS file to the new backend endpoint.

## Verification Plan
1. Ensure the UI closely mirrors the provided screenshots.
2. Upload a sample CSV file and verify that the contacts are correctly populated in the database and displayed in the frontend table.
