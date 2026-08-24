(function () {
  function ensureHead() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const l = document.createElement("link");
      l.rel = "manifest";
      l.href = "manifest.webmanifest";
      document.head.appendChild(l);
    }
    function meta(name, content) {
      if (document.querySelector('meta[name="' + name + '"]')) return;
      const m = document.createElement("meta");
      m.name = name;
      m.content = content;
      document.head.appendChild(m);
    }
    meta("theme-color", "#000000");
    meta("mobile-web-app-capable", "yes");
    meta("apple-mobile-web-app-capable", "yes");
    meta("apple-mobile-web-app-status-bar-style", "black");
    meta("apple-mobile-web-app-title", "ZIVV");
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const a = document.createElement("link");
      a.rel = "apple-touch-icon";
      a.href = "brand/icon-192.png";
      document.head.appendChild(a);
    }
    if (!document.querySelector('link[rel="icon"]')) {
      const i = document.createElement("link");
      i.rel = "icon";
      i.href = "brand/icon-192.png";
      document.head.appendChild(i);
    }
  }

  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    window.dispatchEvent(new CustomEvent("zivv-pwa"));
  });

  function standalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }
  function canInstall() {
    return !!deferred && !standalone();
  }
  async function install() {
    if (!deferred) return false;
    deferred.prompt();
    const r = await deferred.userChoice;
    deferred = null;
    window.dispatchEvent(new CustomEvent("zivv-pwa"));
    return r && r.outcome === "accepted";
  }
  function register() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  window.ZIVV_PWA = { install, canInstall, standalone, iosHint: /iphone|ipad|ipod/i.test(navigator.userAgent) };
  ensureHead();
  register();
})();
