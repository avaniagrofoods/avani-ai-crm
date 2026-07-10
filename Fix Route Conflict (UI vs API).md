# Fix Route Conflict (UI vs API)

### The Issue
Currently, both your User Interface page and your Database API share the exact same URL path (`/settings`). 
- When you click a link in the sidebar, the UI loads normally.
- When you **refresh** the page, the server gets confused and sends you the raw database JSON instead of the webpage UI.

### The Fix
We will separate the API routes from the UI routes by adding an `/api` prefix to all backend data endpoints.

### Proposed Changes
1. **Backend (`main.ts`)**: Add `app.setGlobalPrefix('api');` so the database endpoint becomes `/api/settings`.
2. **Frontend (`*.tsx` files)**: Update the frontend to fetch data from `/api` instead of the root path.
3. **Rebuild & Push**: I will automatically rebuild the UI and push these changes to GitHub so Render updates immediately.

Please click **Proceed** to apply this permanent routing fix!
