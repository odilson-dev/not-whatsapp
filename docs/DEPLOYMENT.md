# Deployment guide

Deploy **Not WhatsApp** to production with Vercel (frontend) and Convex (backend).

## 1. Convex production deployment

```bash
npx convex deploy
```

Note the production deployment URL (e.g. `https://your-project.convex.cloud`).

### Set Convex environment variables

In the [Convex dashboard](https://dashboard.convex.dev) → Settings → Environment variables:

| Variable | Description |
|----------|-------------|
| `CLERK_FRONTEND_API_URL` | Clerk Frontend API URL (e.g. `https://your-app.clerk.accounts.dev`) |

Find this in Clerk → **Configure** → **JWT templates** → Convex template, or under **API keys** → Frontend API URL.

## 2. Clerk production setup

1. Create a production Clerk instance (or use existing).
2. Add the **Convex** JWT template if not already present.
3. Under **Domains**, add your production URL (e.g. `https://not-whatsapp.vercel.app`).
4. Copy these keys for Vercel:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

## 3. Vercel deployment

1. Import the GitHub repo in [Vercel](https://vercel.com).
2. Set environment variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CONVEX_URL` | Production Convex URL from step 1 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |

3. Deploy. Vercel runs `pnpm build` by default.

### Build command (if needed)

```bash
pnpm build
```

## 4. Post-deploy checks

- [ ] Sign up / sign in works on production URL
- [ ] Convex dashboard shows authenticated function calls
- [ ] Send a message — appears in real time in another browser tab
- [ ] Image upload works (Convex storage)
- [ ] Admin dashboard accessible for admin role

## 5. Optional: custom domain

Add your domain in Vercel, then update Clerk allowed origins and any redirect URLs.

## 6. Update portfolio README

Replace the placeholder live demo link in `README.md`:

```markdown
> **Live demo:** https://your-app.vercel.app
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Convex returns "Not authenticated" | Verify `CLERK_FRONTEND_API_URL` in Convex matches Clerk; check JWT template name is `convex` |
| Clerk redirect loop | Add production URL to Clerk allowed origins |
| `Missing NEXT_PUBLIC_CONVEX_URL` | Set env var in Vercel and redeploy |
| User not in database after sign-in | `StoreUserInDatabase` runs on layout mount; check browser console for mutation errors |
