# Deploying the Doom Clock web app (Vercel)

- **Project:** `doomclock-web`, scope `archie-browns-projects` (Archie's personal account, user `archie1203brown-6733`, no team).
- **Production URL:** https://doomclock-web.vercel.app (public).
- **Dashboard:** https://vercel.com/archie-browns-projects/doomclock-web
- **Source:** `doomclock/web` (Vite + React + TypeScript). Static build, no server, no secrets, no env vars.
- **Settings:** `doomclock/web/vercel.json` (framework `vite`, build `npm run build`, output `dist`). The project's Root Directory is empty, so always run `vercel` from `doomclock/web`.
- **Not committed:** `.vercel/` (local link, in `doomclock/web/.gitignore`) and `.env.local` (a local OIDC token Vercel writes). `.vercelignore` keeps `.env*`, `node_modules` and `dist` out of uploads.

## What's in the build

`tsc -b && vite build` produces `dist/`. `public/cache/*.json` (state, events, market and signal inputs, datacentres, bulletin) is copied in as-is. Refresh it before every deploy, because the deploy ships whatever is in the working tree.

## Redeploy

```sh
cd doomclock/web
npm run publish:cache      # refresh public/cache from the pipeline output
npm test                   # optional gate
vercel deploy              # preview
vercel deploy --prod       # production (aliases doomclock-web.vercel.app)
```

First time on a new machine: `vercel login`, then `vercel link --yes --project doomclock-web` from `doomclock/web`.

## Things to know

- **Preview URLs are behind Vercel Deployment Protection** (`all_except_custom_domains`). Anonymous requests get a 302 to Vercel SSO login, so only signed-in Vercel users can open them. The production alias is public.
- To make previews public, change Deployment Protection in the project's Settings. Archie's call.
- Deploys upload the working tree, not a git commit. There is no git remote link.
- Roll back by promoting an earlier deployment in the dashboard, or `vercel rollback`.
