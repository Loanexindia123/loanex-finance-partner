# LoanEx Admin Web

Angular 20 admin portal for LoanEx (staff / dealers / agents).

Production API: `https://loanex-api.vercel.app`  
Vercel project: `loanex-admin-web` (already linked via `.vercel/`)

## Scripts

```bash
npm start              # local dev (proxies /api → deployed API)
npm run build          # production build → dist/admin-web/browser
npm run preview        # serve the production build locally on :4300
npm run deploy:preview # Vercel preview URL
npm run deploy         # production deploy to Vercel
```

## Fast deploy (Vercel)

From this folder (`admin-web/`):

```bash
npm install
npm run deploy
```

First time on a new machine only:

```bash
npx vercel login
npx vercel link   # pick existing project: loanex-admin-web
npm run deploy
```

After deploy, open the URL Vercel prints (e.g. `https://loanex-admin-web.vercel.app`).  
CORS for that origin is already allowed on the API.

## Local production check

```bash
npm run build
npm run preview
# → http://localhost:4300
```

## Notes

- SPA routes are handled by `vercel.json` rewrite → `index.html`.
- Hashed assets get long-cache headers; `index.html` is always revalidated.
- Env: `src/environments/environment.ts` (prod) points at the shared LoanEx API.
