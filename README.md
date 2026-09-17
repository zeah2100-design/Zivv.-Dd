# ZIVV — Professional Social Network + AI-Native Platform

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zeah2100-design/Zivv.-Dd)

> Premium, mobile-first, AI-native social platform. Own visual identity (ZV monogram + signature gradient).

## Monorepo layout

```
zivv/
├── backend/          # Node.js + Express + Socket.io API + realtime + workers
│   ├── prisma/       # Full relational schema (users, posts, reels, chat, marketplace, ads, gold, moderation…)
│   └── src/          # Routes, middleware, realtime, media pipeline, AI proxy
├── frontend/         # React + Vite + Tailwind (light/dark, mobile-first, PWA-ready)
├── ai-service/       # AI agent tool-layer spec, prompts, permission model
├── docs/             # Architecture, API, security, media, AI agent, deploy guides
├── mobile/           # Capacitor/React-Native packaging plan (APK/AAB/IPA from same web app)
└── docker-compose.yml# Postgres + Redis + MinIO (S3-compatible) + API + worker
```

## Quick start (local dev)

```bash
cp .env.example .env          # fill secrets LOCALLY, never commit
docker compose up -d db redis minio
cd backend && npm install && npx prisma migrate dev && npm run dev
cd ../frontend && npm install && npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:4000
- MinIO console: http://localhost:9001

## Deploy to Vercel (frontend + API)

`vercel.json` is ready at the repo root — just import the repo in Vercel.
Set env vars: `AI_PROVIDER`, `OPENAI_API_KEY` or `GEMINI_API_KEY`,
`JWT_SECRET`, `REFRESH_SECRET`, `FRONTEND_URL`, `NODE_ENV=production`.
Full guide: `docs/VERCEL.md`.

## Real AI (OpenAI / Gemini)

Keys live **server-side only**. Set `AI_PROVIDER=openai|gemini` + the matching key
and restart — the ZIVV AI header flips from `Demo mode` to `● Live`.
Without keys, the app runs on a built-in demo brain. Chat, vision
(image understanding), and image generation all switch automatically.

## Core principles (enforced)

1. **No large binaries in relational DB** — Postgres holds metadata; MinIO/S3 holds media; CDN delivers.
2. **No secrets in client** — all keys server-side; frontend only gets `VITE_API_URL`.
3. **AI is platform-native** — assistant, caption/subtitle/translation, enhancement, agent actions via permissioned tools.
4. **Marketplace = listing + communication only** — ZIVV never sells, collects price, ships, or guarantees.
5. **AI-generated marketplace listings forbidden as genuine products** — provenance + declaration + review.
6. **Private chat** — extra password (Argon2/bcrypt + salt), rate-limit, auto-lock, no lock-screen content leak.
7. **E2EE-aware** — if E2EE enabled, AI touches private messages only on explicit user trigger.
8. **Admin "King"** — hidden UX only; real security = server hash + 2FA + roles + audit + rate-limit.

## Scripts

| Command | Where | Purpose |
|---|---|---|
| `npm run dev` | backend | API + Socket.io (nodemon) |
| `npm run worker` | backend | Media pipeline worker |
| `npm test` | backend | API tests |
| `npm run dev` | frontend | Vite dev server |
| `npm run build` | frontend | Production build |

## Documentation

- `docs/ARCHITECTURE.md` — system design, scaling, realtime, CDN
- `docs/API.md` — REST + WebSocket contract
- `docs/SECURITY.md` — auth, 2FA, E2EE, King admin, uploads, abuse
- `docs/MEDIA.md` — storage, transcoding, streaming, signed URLs
- `docs/AI_AGENT.md` — agent tools, permission tiers, confirmations, audit
- `docs/DEPLOY.md` — production deploy, CI/CD, mobile builds
