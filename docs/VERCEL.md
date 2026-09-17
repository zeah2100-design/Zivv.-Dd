# Deploy ZIVV to Vercel + Real AI Setup

## What runs where

| Part | Vercel | Notes |
|---|---|---|
| Frontend (Vite → static) | ✅ `frontend/dist` | SPA fallback to `/index.html` included |
| API (Express → serverless) | ✅ `api/index.js` | Same code as local; HTTP only |
| Socket.io realtime | ⚠️ Not on serverless | Chat works via REST; add Pusher/Ably or a small realtime VPS later |
| Demo data | ⚠️ Resets per cold start | Set `DATABASE_URL` (Neon/Supabase) for persistence — see below |
| AI (OpenAI/Gemini) | ✅ Works | Just add keys as env vars |

## Deploy steps (5 minutes)

1. Push this repo to GitHub (done: `main` branch).
2. Vercel → **Add New Project** → Import the repo.
3. Vercel auto-detects `vercel.json` (install → build frontend → serverless API). No changes needed.
4. **Environment Variables** → add:
   - `AI_PROVIDER` = `openai` (or `gemini`)
   - `OPENAI_API_KEY` = `sk-...` (or `GEMINI_API_KEY` = `...`)
   - `JWT_SECRET` = random 64-hex (generate: `openssl rand -hex 32`)
   - `REFRESH_SECRET` = another random 64-hex
   - `FRONTEND_URL` = `https://YOUR-APP.vercel.app`
   - `NODE_ENV` = `production`
5. **Deploy.** Open the URL → ZIVV AI header shows **● Live (openai/gemini)**.

## Get API keys

- **OpenAI:** platform.openai.com → API keys → Create. Needs billing for `gpt-4o-mini` +
  `dall-e-3` (cheap: a few dollars covers heavy testing).
- **Gemini:** aistudio.google.com → Get API key (free tier available — best for starting).

## Recommended production add-ons

- **Database:** Neon or Supabase Postgres → set `DATABASE_URL`, run `npx prisma migrate deploy`
  (schema is ready in `backend/prisma/`; routes currently use the demo store — swap
  route-by-route, starting with users/auth).
- **Media:** Cloudflare R2 or AWS S3 → set `S3_*` vars so uploads persist + serve via CDN.
- **Realtime:** Pusher Channels / Ably (drop-in for typing/presence/live messages),
  or keep a $5 VPS running `backend/src/index.js` with Socket.io.

## Local AI test

```bash
export AI_PROVIDER=gemini GEMINI_API_KEY=...   # or OPENAI_API_KEY
cd backend && node src/index.js
curl -X POST localhost:4000/api/ai/chats/a1/messages -H 'Content-Type: application/json' -d '{"text":"ازيك؟"}'
```
