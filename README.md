# Maison Meka — website + dashboard

## Live (Vercel)

- Website: https://maison-meka-lemon.vercel.app
- Dashboard: https://maison-meka-lemon.vercel.app/admin — sign in with the dashboard account (change it in Settings → Account)

On Vercel the data lives in an **Upstash Redis** database. Uploaded product photos and videos go to
**Cloudinary** (`CLOUDINARY_URL` environment variable); Vercel Blob is only a fallback when Cloudinary
is not configured. Every push to the `main` branch on GitHub deploys automatically.

Deploy a new version: `git push` (or `vercel deploy --prod` by hand)

## Run it on this machine

```
node server.js
```

Website http://localhost:3000 · Dashboard http://localhost:3000/admin. Locally the data is kept
in `data/` and uploads in `assets/uploads/` — separate from the live store.

## Where things live

| | |
|---|---|
| `lib/app.js` | all the API logic (same code locally and on Vercel) |
| `lib/store.js` | storage: files locally, Redis on Vercel |
| `api/index.js` | the Vercel function |
| `server.js` | local server |
| `admin/` | the dashboard |
| `tools/build-static.js` | Vercel build: copies only public files into `public/` |
| `tools/seed.js` | demo data |
| `tools/reset.js` | clear orders + statistics |

## Before launch — start from zero

Dashboard → Settings → **Start from zero**. Or from this folder:

```
node --env-file=.env.local tools/reset.js        # live store: clear orders, customers, statistics
node --env-file=.env.local tools/reset.js --all  # live store: also remove products and coupons
node --env-file=.env.local tools/seed.js         # live store: put the demo data back
```

Without `--env-file=.env.local` the same commands work on the local files instead.
`.env.local` holds the database keys — never share or publish it.
