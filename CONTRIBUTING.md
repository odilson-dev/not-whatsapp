# Contributing to Not WhatsApp

Thanks for helping improve this project. This guide covers how to set up a local environment, how to contribute changes, and what to do when something breaks.

## Prerequisites

- **Node.js** 20+
- **pnpm** (or npm/yarn — examples below use pnpm)
- A free [Clerk](https://clerk.com) application
- A free [Convex](https://convex.dev) account

## Local setup

1. **Fork and clone** the repo, then install dependencies:

   ```bash
   git clone https://github.com/<your-username>/not-whatsapp.git
   cd not-whatsapp
   pnpm install
   ```

2. **Environment variables** — copy the example file and fill in your keys:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Where to get it |
   |----------|-----------------|
   | `NEXT_PUBLIC_CONVEX_URL` | Printed by `npx convex dev`, or Convex dashboard → Settings |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API Keys |
   | `CLERK_SECRET_KEY` | Clerk → API Keys |

   In the **Convex dashboard** (Settings → Environment variables), also set:

   | Variable | Where to get it |
   |----------|-----------------|
   | `CLERK_FRONTEND_API_URL` | Clerk Frontend API URL (e.g. `https://your-app.clerk.accounts.dev`) |

3. **Clerk ↔ Convex JWT** — in Clerk, create (or confirm) a JWT template named **`convex`**. Convex auth will fail without this exact name.

4. **Run both processes** (two terminals):

   ```bash
   # Terminal 1 — Convex backend (watches and syncs functions)
   npx convex dev

   # Terminal 2 — Next.js frontend
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000), sign up, and try sending a message.

6. **Optional: admin access** — after signing up, promote your user via the Convex dashboard (`admin:makeAdminByEmail`) or the internal mutation with your email. Then visit `/admin`.

## How to contribute

### Report a bug

Open a GitHub issue and include:

- What you expected vs what happened
- Steps to reproduce
- Browser / OS (and Node version if relevant)
- Relevant console or terminal errors (redact secrets)

### Suggest a feature

Open an issue describing the use case and why it fits a WhatsApp-style messaging demo. Keep scope focused — this is a portfolio/educational app, not a full WhatsApp clone.

### Submit a pull request

1. Create a branch from `main`:

   ```bash
   git checkout -b fix/short-description
   ```

2. Make focused changes. Prefer small PRs over large ones.

3. Before opening a PR, run:

   ```bash
   pnpm lint
   pnpm typecheck
   ```

   Fix any issues those commands report.

4. Push your branch and open a PR. Describe:

   - **What** changed
   - **Why** (link an issue if there is one)
   - **How you tested** it locally

### Code guidelines

- **Frontend:** Next.js App Router, React client components where needed, existing Tailwind / shadcn patterns
- **Backend:** Convex queries/mutations with `args` and `returns` validators; always authenticate before touching user data
- **Auth:** use existing helpers in `convex/lib/` — do not skip `getCurrentUser` / membership checks
- **Dev vs prod:** use `npx convex dev` while developing; never use `npx convex deploy` unless intentionally shipping to production
- Match the style of nearby files; avoid drive-by refactors unrelated to your change

## Troubleshooting common errors

### Setup and env

| Symptom | Likely cause | What to try |
|---------|--------------|-------------|
| `Missing NEXT_PUBLIC_CONVEX_URL` | `.env.local` missing or incomplete | Copy `.env.example` → `.env.local`, set the Convex URL, restart `pnpm dev` |
| Convex CLI asks to log in / create a project | First-time Convex setup | Complete the `npx convex dev` prompts; then paste the URL into `.env.local` |
| Env changes seem ignored | Next.js only reads env at startup | Stop and restart `pnpm dev` after editing `.env.local` |
| Port 3000 already in use | Another process is bound | Stop the other app, or run `pnpm dev -- -p 3001` |

### Authentication (Clerk + Convex)

| Symptom | Likely cause | What to try |
|---------|--------------|-------------|
| Convex: **Not authenticated** | JWT / Clerk domain mismatch | Confirm Convex env `CLERK_FRONTEND_API_URL` matches your Clerk Frontend API URL; JWT template must be named `convex` |
| Redirect loop on sign-in | Clerk allowed origins / redirect URLs | In Clerk, add `http://localhost:3000` (and your prod URL) under allowed origins / redirect URLs |
| Signed in but no user in Convex | User sync mutation failed | Check the browser console for errors from `StoreUserInDatabase`; ensure Convex is running and auth works |
| Google / SSO fails | Callback URL not allowed | Ensure `/sso-callback` is reachable and configured in Clerk |

### Chat and realtime

| Symptom | Likely cause | What to try |
|---------|--------------|-------------|
| Messages don’t appear live | Only Next.js is running | Keep `npx convex dev` running in another terminal |
| Can’t start a chat / send messages | Banned account or block | Check admin ban state; for DMs, confirm you aren’t blocked |
| Image upload fails | Storage / auth | Confirm you’re signed in and Convex storage is available on your deployment |
| Admin pages return unauthorized | Missing admin role | Promote your user with `admin:makeAdminByEmail` in the Convex dashboard |

### Build and TypeScript

| Symptom | Likely cause | What to try |
|---------|--------------|-------------|
| `pnpm typecheck` fails | Type errors in changed files | Fix reported errors; regenerate Convex types by running `npx convex dev` once |
| `pnpm lint` fails | ESLint rules | Run `pnpm lint` and fix the listed files |
| Import / API type errors for `api.*` | Stale `_generated` types | Run `npx convex dev` so codegen updates `convex/_generated/` |

### Production deploy

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Vercel + Convex production steps. Common prod issues:

| Symptom | Fix |
|---------|-----|
| Not authenticated in production | Set `CLERK_FRONTEND_API_URL` on the **production** Convex deployment |
| Clerk redirect loop | Add the production URL to Clerk allowed origins |
| Build fails on Vercel | Ensure all `NEXT_PUBLIC_*` and Clerk secret env vars are set in the Vercel project |

## Still stuck?

1. Search existing [GitHub Issues](https://github.com/odilson-dev/whatsapp-clone/issues) for the same error.
2. Open a new issue with the checklist under **Report a bug**.
3. Double-check you are not pasting secrets (API keys, `.env.local`) into issues or PRs.

## License

By contributing, you agree that your contributions are licensed under the same MIT license as the project.
