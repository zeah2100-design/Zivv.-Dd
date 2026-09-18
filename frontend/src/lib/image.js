// Client-side photo compression so phone pictures (3-12MB) just work:
// downscale to max 1600px + JPEG ~85%. Falls back to the original file
// when compression fails or isn't smaller (small PNGs, GIFs stay untouched).
function canvasToJpeg(source, sx, sy, sw, sh, dw, dh, quality) {
  const cv = document.createElement('canvas');
  cv.width = dw;
  cv.height = dh;
  cv.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh);
  return cv.toDataURL('image/jpeg', quality);
}

export function processImage(file, { maxDim = 1600, quality = 0.85 } = {}) {
  return new Promise((resolve) => {
    if (!file || !file.type?.startsWith('image/')) return resolve(null);
    // Small files: keep as-is (preserves PNG transparency, GIF, etc.)
    if (file.size <= 400 * 1024) {
      const rd = new FileReader();
      rd.onload = () => resolve(rd.result);
      rd.onerror = () => resolve(null);
      rd.readAsDataURL(file);
      return;
    }
    (async () => {
      // Fast path: native decode + downscale (no full-res bitmap in JS heap).
      try {
        if (window.createImageBitmap) {
          const probe = await createImageBitmap(file);
          const scale = Math.min(1, maxDim / Math.max(probe.width || 1, probe.height || 1));
          const dw = Math.max(1, Math.round(probe.width * scale));
          const dh = Math.max(1, Math.round(probe.height * scale));
          probe.close();
          const bmp = await createImageBitmap(file, {
            resizeWidth: dw,
            resizeHeight: dh,
            resizeQuality: 'high',
          });
          const out = canvasToJpeg(bmp, 0, 0, bmp.width, bmp.height, dw, dh, quality);
          bmp.close();
          // Compare against original size (base64 ≈ file size × 1.37).
          if (out.length < file.size * 1.37) return resolve(out);
        }
      } catch {
        /* fall through to legacy path */
      }
      // Legacy path: <img> decode + canvas.
      try {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          try {
            const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
            const dw = Math.max(1, Math.round(img.width * scale));
            const dh = Math.max(1, Math.round(img.height * scale));
            const out = canvasToJpeg(img, 0, 0, img.width, img.height, dw, dh, quality);
            URL.revokeObjectURL(url);
            resolve(out);
          } catch {
            URL.revokeObjectURL(url);
            fallbackOriginal();
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          fallbackOriginal();
        };
        img.src = url;
      } catch {
        fallbackOriginal();
      }
      function fallbackOriginal() {
        const rd = new FileReader();
        rd.onload = () => resolve(rd.result);
        rd.onerror = () => resolve(null);
        rd.readAsDataURL(file);
      }
    })();
  });
}

// Absolute ceiling: hosting (Vercel) rejects bodies over ~4.5MB,
// so uploads must stay under ~4MB including JSON overhead.
export const MAX_UPLOAD_CHARS = 4.0e6;
