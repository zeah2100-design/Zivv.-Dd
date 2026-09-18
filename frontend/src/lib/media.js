import { useEffect, useState } from 'react';
import api from './api';

// Lazy media: lists return NO blobs (tiny JSON); the bytes load on demand.
// Module-level caches dedupe requests across the whole session.
const postCache = new Map(); // postId -> media array | null (failed/empty)
const postPending = new Map();
const listingCache = new Map(); // listingId -> image string | null
const listingPending = new Map();

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
