# Migration and API Integration Plan

## Goal Description

The user has three web applications currently hosted on Render (which has discontinued its free tier). They want to know if the sites have been shifted to Vercel or any other free hosting options, and they also provided an AISENcy WABA API key that needs to be set up in **auto mode** for bulk broadcast messaging.

## User Review Required

> [!IMPORTANT]
> The plan involves modifying environment files and optionally redeploying services. Please confirm:
> - Whether you want **all three projects** migrated to Vercel (including both frontend and backend).
> - If you have an existing Vercel account with sufficient quotas, or if you need guidance to create one.
> - Which project(s) should use the provided AISENcy WABA API key (e.g., AVANI CRM, Loan Agents, or both).
>
> Also confirm if you are comfortable storing the API key in `.env` files (local) and setting it as a Vercel environment variable.

## Open Questions

- Do you have any custom backend services (e.g., databases, Prisma) that rely on Render-specific resources?
- Are there any domain bindings or custom DNS records that need to be preserved?
- Should we keep the current **Render** deployments as fallback, or remove them entirely?
- Do you need CI/CD integration (GitHub actions) with Vercel for automatic deployments?

## Proposed Changes

---
### Project: 4-AVANI LOAN AGENTS

- Review `render.yaml` to understand current Render service configuration.
- Add a Vercel configuration (`vercel.json`) for the frontend if not present.
- Create a Vercel project and link the repository (or local folder) using the Vercel CLI.
- Migrate environment variables:
  - Add `AISENCY_WABA_API_KEY` with the provided key to `.env.local` and Vercel dashboard.
- Update any backend endpoints to point to the new Vercel deployment URLs.

---
### Project: 3-AVANI AI CRM

- Existing `.vercel/project.json` indicates a previous Vercel deployment.
- Verify `vercel.json` for frontend and backend (if using Serverless Functions).
- Ensure the frontend is correctly linked to Vercel (`frontend-liart-gamma-68.vercel.app`).
- Add the `AISENCY_WABA_API_KEY` to `.env` and Vercel env variables.
- If backend still on Render, consider moving API routes to Vercel Serverless Functions or keep Render for DB.

---
### Project: 2-AVANI AGRO FOODS (and related folders)

- Check for any `.vercel` or `render.yaml` files (none found). Determine hosting method.
- If not deployed, set up a new Vercel project with `npm run build` and `npm start`.
- Add the API key if the project uses the WABA API.

---
### General Steps

1. **Audit current deployments** – run `grep` for `onrender.com` across all projects to confirm any remaining Render URLs.
2. **Create Vercel projects** using `npx -y vercel@latest` (non‑interactive) in each project root.
3. **Add environment variables**:
   - Local: update `.env.local` (or `.env.production`).
   - Vercel: use `vercel env add AISENCY_WABA_API_KEY production`.
4. **Deploy**:
   - Run `vercel --prod` for each project.
   - Verify URLs are live.
5. **Update DNS** (if custom domains are used) to point to the new Vercel URLs.
6. **Document** the new deployment URLs in a `DEPLOYMENT.md` file for each project.

## Verification Plan

### Automated Tests
- Run `npm run build` for each project to ensure no compile errors.
- Execute `vercel --prebuilt` in CI to confirm successful build.

### Manual Verification
- Access the new Vercel URLs in a browser and confirm functionality (login, dashboard, API calls).
- Send a test broadcast using the WABA API key (curl request) to verify the key works.
- Check that environment variables are correctly loaded (`process.env.AISENCY_WABA_API_KEY`).

---
*Please review the plan and answer the open questions so we can proceed with the migration and API key integration.*
