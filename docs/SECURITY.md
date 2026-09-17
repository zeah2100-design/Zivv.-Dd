# ZIVV Security

## Auth & sessions
- Argon2/bcrypt (cost ≥12), JWT access 30m + rotating refresh 30d, device list, logout-all.
- 2FA TOTP for users (security settings) and **mandatory for King admin**.
- Login alerts, security activity log, rate limits + progressive lockouts.

## Private Chat vault
- Extra password, **never stored raw** — KDF + per-user salt.
- Rate-limit + temporary lockout after 5 bad attempts; audit suspicious events.
- Auto-lock on leave / 30s–5m timeout; notifications hide content (user-controlled).
- E2EE-ready: if enabled, server search/backup/AI/moderation limits must be disclosed;
  AI touches private content only on explicit trigger.

## King admin
- Hidden UX (60s long-press) is **not** a control. Real controls: server-side hash,
  2FA, role checks on every route, session security, rate limits, full audit log.
- Never hardcode credentials; bootstrap via env hash, rotate immediately.

## Uploads & abuse
- MIME allowlist + size caps + extension/MIME match + AV scan (ClamAV) + safety scoring.
- Signed URLs for private media; short TTL; no public bucket listing.
- Spam/fake-account detection, friend-request privacy (everyone/friends-of-friends/nobody),
  contact-sync only with explicit consent, report/block everywhere.

## Secrets & payments
- All keys server-side (`.env`, secret manager). Frontend gets only public URLs.
- Payments verified via **provider webhook/status**, never screenshots/claims.
- No secrets in APKs, bundles, logs, or client-visible config. CI scans for leaks.
