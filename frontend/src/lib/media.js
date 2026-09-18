import { useEffect, useState } from 'react';
import api from './api';

// Lazy media: lists return NO blobs (tiny JSON); the bytes load on demand.
// Module-level caches dedupe requests across the whole session.
const postCache = new Map(); // postId -> media array | null (failed/empty)
const postPending = new Map();
const listingCache = new Map(); // listingId -> image string | null
const listingPending = new Map();
const reelCache = new Map(); // reelId -> mediaUrl string | null
const reelPending = new Map();

export function primePostMedia(id, media) {
  if (id && Array.isArray(media) && media.length) postCache.set(id, media);
}

function fetchPostMedia(id) {
  if (postCache.has(id)) return Promise.resolve(postCache.get(id));
  if (!postPending.has(id)) {
    postPending.set(
      id,
      api.get(`/feed/${id}/media`)
        .then((r) => {
          const m = r.data.media || [];
          postCache.set(id, m.length ? m : null);
          return m;
        })
        .catch(() => {
          postCache.set(id, null);
          return [];
        })
        .finally(() => postPending.delete(id))
    );
  }
  return postPending.get(id);
}

function fetchListing(id) {
  if (listingCache.has(id)) return Promise.resolve(listingCache.get(id));
  if (!listingPending.has(id)) {
    listingPending.set(
      id,
      api.get(`/marketplace/${id}`)
        .then((r) => {
          const img = r.data.image || null;
          listingCache.set(id, img);
          return img;
        })
        .catch(() => {
          listingCache.set(id, null);
          return null;
        })
        .finally(() => listingPending.delete(id))
    );
  }
  return listingPending.get(id);
}

function fetchReel(id) {
  if (reelCache.has(id)) return Promise.resolve(reelCache.get(id));
  if (!reelPending.has(id)) {
    reelPending.set(
      id,
      api.get(`/reels/${id}/media`)
        .then((r) => {
          const v = r.data.mediaUrl || null;
          reelCache.set(id, v);
          return v;
        })
        .catch(() => {
          reelCache.set(id, null);
          return null;
        })
        .finally(() => reelPending.delete(id))
    );
  }
  return reelPending.get(id);
}

// Returns: mediaUrl string | null (loading) — '' means none/failed.
// Fetches only when `active` (reels feed passes visibility).
export function useReelMedia(reel, active = true) {
  const id = reel?.id;
  const embedded = reel?.mediaUrl || null;
  const [src, setSrc] = useState(embedded);
  useEffect(() => {
    if (embedded) {
      reelCache.set(id, embedded);
      setSrc(embedded);
      return;
    }
    if (!id || !reel?.hasMedia) {
      setSrc('');
      return;
    }
    if (reelCache.has(id)) {
      setSrc(reelCache.get(id) || '');
      return;
    }
    if (!active) return;
    let on = true;
    setSrc(null);
    fetchReel(id).then((v) => {
      if (on) setSrc(v || '');
    });
    return () => {
      on = false;
    };
  }, [id, active]);
  return src;
}

// Returns: media array | null (loading) — [] means none/failed.
export function usePostMedia(post) {
  const id = post?.id;
  const embedded = post?.media?.length ? post.media : null;
  const [media, setMedia] = useState(embedded);
  useEffect(() => {
    if (embedded) {
      primePostMedia(id, embedded);
      setMedia(embedded);
      return;
    }
    if (!id || !post?.hasMedia) {
      setMedia([]);
      return;
    }
    if (postCache.has(id)) {
      setMedia(postCache.get(id) || []);
      return;
    }
    let on = true;
    setMedia(null);
    fetchPostMedia(id).then((m) => {
      if (on) setMedia(m || []);
    });
    return () => {
      on = false;
    };
  }, [id]);
  return media;
}

// Returns: image string | null (loading) — '' means none/failed.
export function useListingImage(listing) {
  const id = listing?.id;
  const embedded = listing?.image || null;
  const [img, setImg] = useState(embedded);
  useEffect(() => {
    if (embedded) {
      listingCache.set(id, embedded);
      setImg(embedded);
      return;
    }
    if (!id || !listing?.hasImage) {
      setImg('');
      return;
    }
    if (listingCache.has(id)) {
      setImg(listingCache.get(id) || '');
      return;
    }
    let on = true;
    setImg(null);
    fetchListing(id).then((v) => {
      if (on) setImg(v || '');
    });
    return () => {
      on = false;
    };
  }, [id]);
  return img;
}
