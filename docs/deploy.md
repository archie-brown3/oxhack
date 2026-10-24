# Deploying the Doom Clock web app (Vercel)

- **Project:** `doomclock-web`, scope `archie-browns-projects` (Archie's personal account, user `archie1203brown-6733`, no team).
- **Production URL:** https://doomclock-web.vercel.app (public).
- **Dashboard:** https://vercel.com/archie-browns-projects/doomclock-web
- **Source:** `doomclock/web` (Vite + React + TypeScript). Static build, no server, no secrets, no env vars.
- **Git auto-deploy:** GitHub repository `archie-brown3/oxhack` is linked. Every push to `main` builds production. Vercel Root Directory is `doomclock/web`, framework `vite`, build `npm run build`, output `dist` (confirmed through the live project API, 24 Oct).
- **Settings file:** `doomclock/web/vercel.json`. Run manual CLI deploys from `doomclock/web`.
- **Not committed:** `.vercel/` (local link, in `doomclock/web/.gitignore`) and `.env.local` (a local OIDC token Vercel writes). `.vercelignore` keeps `.env*`, `node_modules` and `dist` out of uploads.

## What's in the build

`tsc -b && vite build` produces `dist/`. `public/cache/*.json` (state, events, market and signal inputs, datacentres, bulletin) is copied in as-is. Refresh and commit the cache before pushing if source data changed. Git builds use committed files. Manual CLI deploys use the working tree.

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
- Git pushes build the linked commit. Manual CLI deploys upload the working tree.
- Earlier Git builds failed with `vite: command not found` while Root Directory was empty. The root setting was corrected on 24 Oct; check the new deployment's status before claiming the push is live.
- Roll back by promoting an earlier deployment in the dashboard, or `vercel rollback`.
