# Automated Stable Tunnel Deployment & Fallback API Resolution

We will implement a permanent solution to prevent future backend connection failures. The backend will automatically start a `localtunnel` tunnel with a stable, custom subdomain (`avaniloanservices`) on startup. The frontend pages will be updated to use this new stable URL `https://avaniloanservices.loca.lt` as the default fallback. This eliminates the need for manually starting tunnels and copy-pasting new URLs.

## User Review Required

> [!IMPORTANT]
> **No More Manual Tunnels:**
> - Starting the NestJS backend via `npm run start:dev` will now automatically launch the tunnel in the background.
> - The stable URL for your backend will always be **`https://avaniloanservices.loca.lt`**.
> - The Vercel frontend will connect to this stable URL by default. You will not need to change the Backend API URL in Settings unless you choose to use a different custom tunnel.
> - **Meta Developers Webhook:** In your Meta Developers Console, please update your Webhook Callback URL to point to **`https://avaniloanservices.loca.lt/whatsapp/webhook`** once. This URL will remain permanent!

## Proposed Changes

### Backend Startup Configuration

#### [MODIFY] [main.ts](file:///c:/Users/ALPHA-1/Desktop/AVANI%20AI%20CRM/backend/src/main.ts)
- Update the bootstrap function to spawn `npx localtunnel --port 4000 --subdomain avaniloanservices` as a background child process on startup.
- Log the tunnel URL directly in the console.

### Frontend API URL Fallback Migration

#### [MODIFY] all pages
- Run a migration script to replace the old expired fallback URL (`https://headlines-greene-throughout-champagne.trycloudflare.com`) with `https://avaniloanservices.loca.lt` in all frontend pages.

---

## Verification Plan

### Automated Tests
- Run `npm run build` inside `frontend/` to ensure static pages compile successfully.

### Manual Verification
- Deploy the updated frontend to Vercel using `npx vercel --prod --yes` inside `frontend/`.
- Restart the backend to confirm the localtunnel process spawns automatically and outputs `https://avaniloanservices.loca.lt`.
- Open `https://frontend-liart-gamma-68.vercel.app/settings` and verify the settings are loaded successfully from the stable tunnel.
