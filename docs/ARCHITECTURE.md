# ZIVV Architecture

## Topology (production)

```
Client (Web PWA / Android APK-AAB / iOS)
   │ HTTPS/WSS
   ▼
CDN + WAF (static, HLS segments, images)
   ▼
API Gateway / LB
   ├─ API pods (Node/Express, stateless, HPA 3–50)
   ├─ Realtime pods (Socket.io + Redis adapter, sticky or pub/sub)
   ├─ AI gateway (provider abstraction, guardrails, audit)
   └─ Workers (BullMQ: media pipeline, notifications, ranking jobs)
        ▼
Postgres (RDS/Cloud SQL, read replicas) • Redis (cache, queues, presence)
S3-compatible object storage (originals + derivatives) • Audit log store
```

## Data rules

- Postgres: users, metadata, relations, permissions, transactions, messages metadata,
  content metadata, subscriptions, ads, moderation, AI chats/tool-runs, audit.
- Object storage: originals + derivatives (thumbs, 480/720/1080, HLS, waveforms, posters).
- CDN: public media cached at edge; private media via **short-lived signed URLs**.
- Never store large binaries in Postgres (`BYTEA` only for tiny secrets like TOTP seeds).

## Ranking (Feed/Reels/Explore)

`score = f(engagement, watch-time, follows, freshness, quality, safety, aiMix, diversity)`
- Popularity alone never decides; freshness + follows + quality + safety weighted.
- `aiMix` user preference blends AI/normal/following buckets (classification probabilistic).
- Controls: not-interested, show more/less, mute topics, reset.

## Realtime

- Socket.io rooms per conversation; Redis adapter for scale.
- Presence + typing + read receipts; message states sent→delivered→read.
- Calls: WebRTC (P2P or SFU at scale) + TURN; signaling over sockets.

## Scaling notes

- Stateless API; sessions in Redis; read replicas for feed/search.
- Search: Postgres FTS → OpenSearch/Typesense; semantic: pgvector/embedding service.
- Media: async pipeline; never block publish on transcode.
