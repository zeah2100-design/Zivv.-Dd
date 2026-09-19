// Presigned upload/download helper. Uses S3/MinIO when configured, else local stub URLs.
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const endpoint = process.env.S3_ENDPOINT;
const bucket = process.env.S3_BUCKET || 'zivv-media';
const cdn = (process.env.CDN_BASE_URL || '').replace(/\/$/, '');

let s3 = null;
if (endpoint && process.env.S3_ACCESS_KEY) {
  s3 = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
  });
}

async function presignUpload(key, contentType, expiresIn = 900) {
  if (!s3) return { uploadUrl: `/api/media/direct-upload?key=${encodeURIComponent(key)}`, objectKey: key, stub: true };
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn });
  return { uploadUrl, objectKey: key };
}

async function presignDownload(key, expiresIn = 3600) {
  if (!s3) return { url: `/media/${encodeURIComponent(key)}`, stub: true };
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return { url: await getSignedUrl(s3, cmd, { expiresIn }) };
}

function publicUrl(key) {
  if (cdn) return `${cdn}/${key}`;
  return `/media/${encodeURIComponent(key)}`;
}

function isConfigured() { return !!s3; }
function cdnBase() { return cdn || ''; }

// Playback: 'r2:key' -> fresh presigned URL (private bucket, no domain needed).
// Plain http(s)/data URLs pass through untouched.
async function resolveUrl(stored, expiresIn = 21600) {
  if (typeof stored !== 'string' || !stored.startsWith('r2:')) return stored;
  if (!s3) return stored;
  try {
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: stored.slice(3) });
    return await getSignedUrl(s3, cmd, { expiresIn });
  } catch { return stored; }
}

module.exports = { presignUpload, presignDownload, publicUrl, bucket, isConfigured, cdnBase, resolveUrl };
