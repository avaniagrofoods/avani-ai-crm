# Implement Dynamic API URL Configuration and Refine Broadcast Redirect Logic

We will implement a dynamically configurable Backend API URL via the settings page to allow the user to easily update their Cloudflare Tunnel URL. We will also update all frontend pages to fetch the backend URL from `localStorage` dynamically. Finally, we will refine the broadcast campaign wizard's redirect logic so that it only auto-redirects to the dashboard homepage on a 100% successful run, letting the user see logs if there are failures.

## User Review Required

> [!IMPORTANT]
> **Dynamic Backend API URL:**
> - A new field **"Backend API URL (Cloudflare Tunnel)"** will be added to the settings page.
> - The value will be saved locally in the browser's `localStorage` as `AVANI_API_URL` to ensure instant effect across all client-side API requests.
> - By default, if no custom URL is saved, it will fall back to `http://localhost:4000` (on localhost) or `https://headlines-greene-throughout-champagne.trycloudflare.com`.
>
> **Redirect Logic Refinement:**
> - When running a broadcast campaign, the wizard will only auto-redirect back to the dashboard homepage if `failedCount === 0`. If there are any failed dispatches, the wizard will stay open, showing the failed logs in the terminal so the user can inspect what went wrong.

## Proposed Changes

### Frontend Configuration & Pages

#### [MODIFY] [settings/page.tsx](file:///c:/Users/ALPHA-1/Desktop/AVANI%20AI%20CRM/frontend/src/app/settings/page.tsx)
- Define a new state variable `backendApiUrl`.
- Initialize `backendApiUrl` from `localStorage.getItem('AVANI_API_URL')` on client load.
- Add an input field for "Backend API URL (Cloudflare Tunnel)" in the General Config section.
- On saving settings, write the updated URL value back to `localStorage.setItem('AVANI_API_URL', value)`.
- Use a dynamic `getApiUrl()` helper for API requests.

#### [MODIFY] [broadcasts/page.tsx](file:///c:/Users/ALPHA-1/Desktop/AVANI%20AI%20CRM/frontend/src/app/broadcasts/page.tsx)
- Refine the redirect logic at the end of `handleSendNow` so it only runs `setTimeout` to redirect/close the wizard when `failedCount === 0`.
- Update the API URL definition to dynamically use `localStorage.getItem('AVANI_API_URL')`.

#### [MODIFY] all other pages
- Run a migration script (`make_dynamic_api.js`) to convert hardcoded backend URLs across all frontend pages to the dynamic `localStorage`-based expression.

---

## Verification Plan

### Automated Tests
- Run `npm run build` inside `frontend/` to verify that Next.js successfully compiles without TypeScript or build errors.

### Manual Verification
- Deploy to Vercel production by running `npx vercel --prod --yes` inside `frontend/`.
- Open the settings page, verify the Backend API URL is loaded, change it, and check that it's persisted in `localStorage`.
- Run a broadcast campaign with a mock CSV or real contacts and verify redirect logic on success vs. failure.
