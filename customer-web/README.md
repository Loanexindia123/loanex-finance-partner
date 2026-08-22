# LoanEx Customer Web

Angular 20 customer storefront for LoanEx (browse, EMI, checkout, orders).

Production API: `https://loanex-api.vercel.app`  
Vercel project: `customer-web` (already linked via `.vercel/`)

## Scripts

```bash
npm start              # local dev (proxies /api → deployed API)
npm run build          # production build → dist/LoanEx/browser
npm run preview        # serve the production build locally on :4400
npm run deploy:preview # Vercel preview URL
npm run deploy         # production deploy to Vercel
npm run serve:ssr:LoanEx  # optional local SSR server (Node)
```

## Fast deploy (Vercel)

From this folder (`customer-web/`):

```bash
npm install
npm run deploy
```

First time on a new machine only:

```bash
npx vercel login
npx vercel link   # pick existing project: customer-web
npm run deploy
```

After deploy, open the URL Vercel prints (e.g. `https://www.mrloanex.com` / your Vercel domain).  
CORS for production customer origins is already allowed on the API.

## Local production check

```bash
npm run build
npm run preview
# → http://localhost:4400
```

## Notes

- Build includes SSR artifacts; Vercel serves the **browser** output statically.
- SPA routes rewrite to `index.csr.html` (Angular CSR entry for static hosts).
- Hashed assets get long-cache headers; `index.csr.html` is always revalidated.
- Env: `src/environments/environment.ts` (prod) points at the shared LoanEx API.
