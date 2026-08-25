(function () {
  const DB = "zivv.media";
  const STORE = "files";

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(id, blob) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function get(id) {
    if (!id) return null;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const q = tx.objectStore(STORE).get(id);
      q.onsuccess = () => resolve(q.result || null);
      q.onerror = () => reject(q.error);
    });
  }

  async function getUrl(id) {
    const blob = await get(id);
    return blob ? URL.createObjectURL(blob) : "";
  }

  function hydrate(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-media]").forEach((el) => {
      const id = el.getAttribute("data-media");
      if (!id) return;
      if (/^(https?:|blob:|data:)/i.test(id)) {
        el.src = id;
      } else {
        getUrl(id)
          .then((url) => {
            if (url) el.src = url;
          })
          .catch(() => {});
      }
      const poster = el.getAttribute("data-poster");
      if (poster && !el.getAttribute("poster")) {
        if (/^(https?:|blob:|data:)/i.test(poster)) el.setAttribute("poster", poster);
        else getUrl(poster).then((url) => {
          if (url) el.setAttribute("poster", url);
        }).catch(() => {});
      }
    });
  }

  function bindSound(scope, post) {
    if (!post) return;
    const root = scope || document;
    const vid = root.tagName === "VIDEO" ? root : root.querySelector("video");
    if (!vid) return;
    if (post.muteOriginal) vid.muted = true;
    if (!post.soundId) return;
    let aud = (root.parentElement || root).querySelector("audio.snd-" + post.id);
    if (!aud) {
      aud = document.createElement("audio");
      aud.className = "snd-" + post.id;
      aud.loop = true;
      vid.insertAdjacentElement("afterend", aud);
      getUrl(post.soundId).then((url) => { if (url) aud.src = url; }).catch(() => {});
    }
    const playAud = () => {
      if (!aud.src) return;
      if (Math.abs((aud.currentTime || 0) - (vid.currentTime || 0)) > 0.45) {
        try { aud.currentTime = vid.currentTime || 0; } catch {}
      }
      aud.play().catch(() => {});
    };
    vid.addEventListener("play", playAud);
    vid.addEventListener("pause", () => aud.pause());
    vid.addEventListener("seeking", () => { try { aud.currentTime = vid.currentTime || 0; } catch {} });
  }

  window.ZIVV_MEDIA = { put, get, getUrl, hydrate, bindSound };
})();
