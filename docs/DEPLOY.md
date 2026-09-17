# ZIVV Deploy & Mobile

## Environments
- `dev`: docker-compose (db, redis, minio, api, worker) + `frontend/npm run dev`.
- `staging`: mirror of prod with sanitized data; run E2E + load tests.
- `prod`: managed Postgres + Redis + S3 + CDN + K8s/ECS; secrets in manager; CI required.

## CI/CD (suggested GitHub Actions)
1. Lint + unit/API tests + `prisma validate`.
2. Secret scan (gitleaks) — fail on keys in diff.
3. Build frontend; build + push API/worker images (SBOM + tag).
4. Migrate (reviewed SQL) → rolling deploy → smoke tests → rollback on failure.

## Production checklist
- [ ] Strong `JWT/REFRESH/SESSION` secrets; admin hash + TOTP enforced
- [ ] TLS everywhere; HSTS; WAF rate rules; CORS allowlist = app domains only
- [ ] TURN server for calls; Socket.io sticky/adapter; CDN signed-URL policy
- [ ] Backups (DB PITR, S3 versioning), retention + legal-hold policy
- [ ] Observability: logs, metrics, traces, uptime, abuse dashboards
- [ ] Payment webhooks verified by signature; Gold/entitlement reconciliation job
- [ ] Moderation SLAs + report queues staffed; King audit reviewed

## Mobile (APK/AAB/IPA)
- Phase 1: Capacitor wrapper around this web app (same UI, push via FCM/APNs,
  secure storage for tokens, biometric unlock for Private vault).
- Phase 2: React Native / Flutter for fully native reels camera + calls.
- Never bake API keys or admin secrets into the binary; use backend + remote config.
