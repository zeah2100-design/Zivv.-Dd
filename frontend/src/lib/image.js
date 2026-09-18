// Client-side photo compression so phone pictures (3-12MB) just work:
// downscale to max 1600px + JPEG ~85%. Falls back to the original file
// when compression fails or isn't smaller (small PNGs, GIFs stay untouched).
export function processImage(file, { maxDim = 1600, quality = 0.85 } = {}) {
  return new Promise((resolve) => {
    if (!file || !file.type?.startsWith('image/')) return resolve(null);
    const rd = new FileReader();
    rd.onload = () => {
      const original = rd.result;
      if (file.size <= 400 * 1024) return resolve(original);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          const out = cv.toDataURL('image/jpeg', quality);
          resolve(out.length < original.length ? out : original);
        } catch {
          resolve(original);
        }
      };
      img.onerror = () => resolve(original);
      img.src = original;
    };
    rd.onerror = () => resolve(null);
    rd.readAsDataURL(file);
  });
}

// Absolute ceiling: hosting (Vercel) rejects bodies over ~4.5MB,
// so uploads must stay under ~4MB including JSON overhead.
export const MAX_UPLOAD_CHARS = 4.0e6;
