# ZIVV Media Pipeline

## Upload flow
1. Client asks `POST /media/presign {contentType, kind, bytes, durationSec}`.
2. Server validates (allowlist, caps, feed-video ≤300s) → returns presigned PUT URL + object key.
3. Client uploads **directly to S3/MinIO** (no binary through API).
4. Client calls `POST /media/complete` → job enqueued (BullMQ/Redis).

## Pipeline (worker)
- Validate + virus scan + MIME sniff + safety/NSFW score + copyright fingerprint (audio).
- Images: resize (thumb/sm/md), WebP/AVIF, strip EXIF location, blurhash.
- Video: transcode 1080/720/480 + HLS, poster, preview clip (reels), subtitles (ASR),
  loudness normalize; feed videos hard-capped at 5:00.
- Audio: normalize, waveform, 30s preview for store/sounds.
- Write metadata to Postgres; purge CDN; notify owner (AI tab: “ready ✓”).

## Delivery
- Public: CDN URLs. Private: presigned GET (short TTL) from API after authz check.
- Reels: preload next item, adaptive HLS, pause on hidden tab.
