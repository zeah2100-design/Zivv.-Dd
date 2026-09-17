# ZIVV Mobile plan

Phase 1 — Capacitor (fastest to APK/AAB):
1. `npm run build` in `frontend/`, sync web assets into Capacitor shell.
2. Native: splash, icons (ZV mark), push (FCM/APNs), secure storage, biometric vault unlock.
3. Build signed AAB/APK via Gradle; Play Internal testing track.

Phase 2 — Native reels camera + calls (RN/Flutter) reusing the same `/api` + sockets.

Security: no secrets in the binary; tokens in secure storage; cert pinning in prod.
