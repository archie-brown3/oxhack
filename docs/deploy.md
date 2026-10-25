# Deploying the Doom Clock web app (Vercel)

- **Project:** `doomclock-web`, scope `archie-browns-projects` (Archie's personal account, user `archie1203brown-6733`, no team).
- **Production URL:** https://doomclock-web.vercel.app (public).
- **Dashboard:** https://vercel.com/archie-browns-projects/doomclock-web
- **Source:** `doomclock/web` (Vite + React + TypeScript). Static build, no server, no secrets, no env vars.
- **Git auto-deploy:** GitHub repository `archie-brown3/oxhack` is linked. Every push to `main` builds production.
- **Root Directory `.` (dashboard, since about 02:28 GMT on 25 Oct):** the project reads the repo root. `package.json` and `vercel.json` there install and build `doomclock/web`, publish `doomclock/web/dist`, and set `Content-Security-Policy: frame-ancestors *`. Framework is Other, so the build does not look for a Vite binary at the repo root. Node is `22.x` (`engines` in the root `package.json`; Vite 8 needs `^20.19.0` or `>=22.12.0`).
- **Root Directory `doomclock/web`:** Vercel reads `doomclock/web/vercel.json` instead (framework Vite, build `npm run build`, output `dist`, the same frame policy). The repo-root files are outside that directory.
- **Checked 05:43 GMT on 25 Oct:** https://doomclock-web.vercel.app returned the older app shell (`/assets/index-CdjOzVza.js`) with no `content-security-policy` header. A push to `main` that contains the root files is what updates production while the dashboard root stays `.`. Agents do not run `vercel deploy`.
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
- Git pushes to `main` build the linked commit. Manual CLI deploys upload the working tree.
- A green local build is `npm run build` from the repo root, or `cd doomclock/web && npm test && npm run build`. After that commit is on `main`, `curl -sSI https://doomclock-web.vercel.app` should include `content-security-policy: frame-ancestors *`.
- On 24 Oct, Git builds failed with `vite: command not found` while Root Directory was empty, and the dashboard was then set to `doomclock/web`. On 25 Oct it is `.` again. The root `vercel.json` is the build for that setting.
- Roll back by promoting an earlier deployment in the dashboard, or `vercel rollback`.
