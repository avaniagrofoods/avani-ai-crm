# Migrate Settings to Postgres (Cloud-Ready)

To deploy your backend to the cloud, we must ensure it is "stateless". Currently, your API keys and configuration are saved to a local file (`settings.json`). Cloud servers erase local files upon restart. 

This plan upgrades your database to securely store these settings so your backend can be safely deployed anywhere.

## Proposed Changes

### Database Schema
#### [MODIFY] `schema.prisma`
- Add settings columns to the existing `Workspace` model:
  - `timezone`, `currency`, `autoReply`, `whatsappToken`, `whatsappPhoneNumberId`, `whatsappBusinessAccountId`, `geminiApiKey`.

### Settings Service
#### [MODIFY] `settings.service.ts`
- Remove `fs` file operations.
- Update `findAll()` to fetch the first `Workspace` from Prisma.
- Update `create()` to update the first `Workspace` via Prisma.

### WhatsApp Service
#### [MODIFY] `whatsapp.service.ts`
- Update `getCredentials()` to read directly from the `Workspace` database row instead of reading `settings.json`.
- Keep environment variables (`process.env`) as a fallback.

## Verification Plan

### Automated Steps
- Run `npx prisma db push` to safely update the live Supabase schema without losing existing data.
- Run `npm run build` to verify there are no TypeScript compilation errors.

### Manual Verification
- Start the server and verify the UI settings page loads correctly.
- Update a setting in the UI and verify it persists to the database.
