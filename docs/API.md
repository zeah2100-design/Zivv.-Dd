# ZIVV API Contract (v1 — `/api`)

Auth: `Authorization: Bearer <access>` (30m) + `/auth/refresh` rotation. Demo mode injects `u-you` when no token (dev only).

| Area | Endpoint | Notes |
|---|---|---|
| Auth | `POST /auth/register|login|refresh`, `GET /auth/me` | bcrypt, rate-limited login |
| Feed | `GET /feed?page`, `POST /feed`, `POST /feed/:id/like|save` | ranked, ≤5min feed video enforced at upload |
| Reels | `GET /reels`, `POST /reels/:id/like`, `GET /reels/sounds/:id` | vertical, preload-next client-side |
| Search | `GET /search?q&tab`, `/search/suggest`, `/search/explore`, `POST /search/ai`, `/search/history` | tabs: top/users/reels/posts/music/hashtags/store |
| Users | `GET /users/:username`, `POST /users/:id/follow`, `PATCH /users/me` | |
| Friends | `GET /friends/requests`, `POST /friends/requests`, `POST /friends/requests/:id/:action` | confirm/delete/cancel |
| Chat | `GET /chat/conversations`, `GET|POST /chat/conversations/:id/messages` | socket `message:new` |
| Vault | `POST /chat/vault/setup`, `POST /chat/vault/unlock` | hash+salt, attempts, lockout |
| AI-chat | `POST /chat/ai-assist {mode,text}` | reply/translate/summary/improve — explicit only |
| Market | `GET|POST /marketplace`, `GET /marketplace/:id`, `POST /marketplace/:id/report` | listing-only; fabricated-AI listings rejected (422) |
| Ads | `GET|POST /ads`, `POST /ads/:id/pause|resume` | DRAFT→…→ACTIVE→COMPLETED |
| Gold | `GET /gold/packages|status`, `POST /gold/request` | review→payment(verified)→active |
| Notif | `GET /notifications?tab`, `POST /notifications/read-all` | all/social/messages/system/ai/ads |
| AI | `GET|POST /ai/chats`, `POST /ai/chats/:id/messages`, `POST /ai/image`, `POST /ai/agent/plan|execute` | plan→preview→confirm→execute→audit |
| Media | `POST /media/presign`, `POST /media/complete` | allowlist MIME + size; feed-video ≤300s |
| Admin | `POST /admin/login`, `GET /admin/stats|review-queue`, `POST /admin/ads/:id/:decision` | role ADMIN+, rate-limited, audited |

## WebSocket events

`join(conversationId)`, `message:new`, `typing`, `presence`, `call:signal`.

## Errors

`{ error: code }` — `unauthorized|bad_credentials|not_found|too_large|unsupported_type|feed_video_max_5min|ai_fabricated_listing_blocked|confirmation_required|locked_out|forbidden`.
