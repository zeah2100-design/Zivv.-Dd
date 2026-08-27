(function () {
  if (window.ZIVV_ADS && ZIVV_ADS.mount) return;

  const CFG = "zivv.adnet";
  const VISITS = "zivv.visits";

  function read(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }
  function write(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function pageName() {
    return (location.pathname.split("/").pop() || "").toLowerCase();
  }

  function config() {
    return Object.assign(
      {
        network: "exoclick",
        pub: "",
        slot: "",
        zone: "",
        snippet: "",
        on: false,
        every: 3,
        sticky: true,
        reels: true,
      },
      read(CFG, {})
    );
  }

  function saveConfig(next) {
    write(CFG, Object.assign(config(), next || {}));
  }

  function ready() {
    return false;
  }

  function viewerGold() {
    try {
      if (window.ZIVV_CORE && ZIVV_CORE.isGold) return !!ZIVV_CORE.isGold();
      const s = JSON.parse(localStorage.getItem("zivv.session") || "{}");
      const u = String(s.username || (s.email || "").split("@")[0] || "")
        .replace(/^@/, "")
        .toLowerCase();
      if (!u) return false;
      const cr = JSON.parse(localStorage.getItem("zivv.creator") || "{}");
      if (cr[u] && cr[u].gold) return true;
      const reqs = JSON.parse(localStorage.getItem("zivv.goldReqs") || "[]");
      return reqs.some((x) => x.user === u && x.status === "accepted");
    } catch {
      return false;
    }
  }

  function skipPage() {
    const f = pageName();
    return f === "king.html" || f === "index.html" || f === "setup.html";
  }

  function trackVisit() {
    const day = new Date().toISOString().slice(0, 10);
    const all = read(VISITS, { total: 0, pages: 0, impressions: 0, days: {} });
    all.pages = (Number(all.pages) || 0) + 1;
    if (!sessionStorage.getItem("zivv.u:" + day)) {
      sessionStorage.setItem("zivv.u:" + day, "1");
      all.total = (Number(all.total) || 0) + 1;
      all.days = all.days || {};
      all.days[day] = (all.days[day] || 0) + 1;
    }
    write(VISITS, all);
    return all;
  }

  function hitImpression() {
    const all = read(VISITS, { total: 0, pages: 0, impressions: 0, days: {} });
    all.impressions = (Number(all.impressions) || 0) + 1;
    write(VISITS, all);
  }

  function visits() {
    return read(VISITS, { total: 0, pages: 0, impressions: 0, days: {} });
  }

  function weave(items, every) {
    const step = every || Number(config().every) || 3;
    const list = items || [];
    if (!ready() || !list.length || viewerGold()) return list.map((p) => ({ kind: "post", item: p }));
    const out = [];
    let n = 0;
    list.forEach((p, i) => {
      out.push({ kind: "post", item: p });
      if ((i + 1) % step === 0) {
        n += 1;
        out.push({ kind: "ad", item: { id: "net-" + n } });
      }
    });
    return out;
  }

  function cardHtml(ad) {
    const id = (ad && ad.id) || "net";
    return `<article class="post ad" data-ad="${id}">
      <div class="post-h">
        <div class="ava"><img src="brand/logo-sm.png" alt=""></div>
        <div>
          <div class="who">إعلان<span class="ad-tag">إعلان</span></div>
          <div class="meta">شبكة إعلانية · حسب الزيارات</div>
        </div>
      </div>
      <div class="ad-slot" id="adslot-${id}"></div>
    </article>`;
  }

  function runScripts(box) {
    box.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      Array.from(old.attributes).forEach((a) => s.setAttribute(a.name, a.value));
      s.text = old.textContent || "";
      old.parentNode.replaceChild(s, old);
    });
  }

  function fillSlot(el) {
    if (!el || el.getAttribute("data-filled") === "1") return;
    if (!ready()) return;
    el.setAttribute("data-filled", "1");
    hitImpression();
    const c = config();
    if (c.snippet) {
      el.innerHTML = c.snippet;
      runScripts(el);
      return;
    }
    if (c.network === "adsense" && c.pub) {
      if (!document.querySelector("script[src*='adsbygoogle']")) {
        const s = document.createElement("script");
        s.async = true;
        s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(c.pub);
        s.crossOrigin = "anonymous";
        document.head.appendChild(s);
      }
      el.innerHTML =
        '<ins class="adsbygoogle" style="display:block;min-height:250px" data-ad-client="' +
        c.pub +
        '"' +
        (c.slot ? ' data-ad-slot="' + c.slot + '"' : "") +
        ' data-ad-format="auto" data-full-width-responsive="true"></ins>';
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {}
      return;
    }
    if ((c.network === "exoclick" || !c.network) && c.zone) {
      if (!document.querySelector('script[src*="ad-provider.js"]')) {
        const s = document.createElement("script");
        s.async = true;
        s.src = "https://a.magsrv.com/ad-provider.js";
        document.head.appendChild(s);
      }
      const ins = document.createElement("ins");
      ins.className = "eas6a97888e2";
      ins.setAttribute("data-zoneid", c.zone);
      el.appendChild(ins);
      try {
        (window.AdProvider = window.AdProvider || []).push({ serve: {} });
      } catch {}
      return;
    }
    if (c.zone) {
      const s = document.createElement("script");
      s.async = true;
      s.setAttribute("data-zone", c.zone);
      s.setAttribute("data-cfasync", "false");
      if (c.network === "propeller") s.src = "https://propu.sh/" + encodeURIComponent(c.zone) + "/invoke.js";
      else if (c.network === "adsterra") s.src = "https://www.highperformanceformat.com/" + encodeURIComponent(c.zone) + "/invoke.js";
      else s.src = "https://alwingulla.com/88/tag.min.js";
      el.appendChild(s);
    }
  }

  function bind(root) {
    if (!root) return;
    root.querySelectorAll(".ad-slot").forEach(fillSlot);
  }

  function mosaicHtml() {
    if (!ready() || viewerGold()) return "";
    return `<div class="cell ad-cell"><div class="ad-slot" id="adslot-explore"></div><span class="badge">إعلان</span></div>`;
  }

  function ensureCss() {
    if (document.getElementById("zivv-ads-css")) return;
    const s = document.createElement("style");
    s.id = "zivv-ads-css";
    s.textContent =
      ".zivv-ad-sticky{position:fixed;left:0;right:0;bottom:62px;z-index:11;background:#ffffff;border-top:1px solid #e6e8ec;min-height:70px}" +
      ".zivv-ad-sticky span{position:absolute;top:4px;inset-inline-start:8px;font-size:10px;color:#9ad67a}" +
      ".zivv-ad-sticky .ad-slot{min-height:70px}" +
      "body.has-ad-sticky{padding-bottom:140px}" +
      ".ad-slot{min-height:250px;background:#f1f3f5;border:1px solid #e6e8ec;border-radius:12px}" +
      ".ad-clip{display:grid;place-items:center;background:#f1f3f5}" +
      ".ad-clip .ad-slot{width:min(360px,92%);min-height:250px}";
    document.head.appendChild(s);
  }

  function mountSticky() {
    const c = config();
    if (!ready() || !c.sticky || skipPage() || viewerGold()) return;
    if (document.querySelector(".zivv-ad-sticky")) return;
    const bar = document.createElement("div");
    bar.className = "zivv-ad-sticky";
    bar.innerHTML = '<span>إعلان</span><div class="ad-slot" id="adslot-sticky"></div>';
    document.body.appendChild(bar);
    document.body.classList.add("has-ad-sticky");
    fillSlot(bar.querySelector(".ad-slot"));
  }

  function mount() {
    ensureCss();
    if (skipPage()) return;
    trackVisit();
    mountSticky();
    bind(document);
  }

  window.ZIVV_ADS = {
    config,
    saveConfig,
    ready,
    weave,
    cardHtml,
    bind,
    fillSlot,
    visits,
    trackVisit,
    mosaicHtml,
    mount,
    active() {
      return ready() ? [{ id: "net" }] : [];
    },
    all() {
      return ready() ? [{ id: "net" }] : [];
    },
    view() {},
    click() {},
    statsOf() {
      return { views: 0, clicks: 0 };
    },
    moneyOf() {
      return 0;
    },
    totals() {
      const v = visits();
      return { views: v.pages || 0, clicks: 0, egp: 0, ads: ready() ? 1 : 0 };
    },
    upsert() {},
    setActive() {},
    remove() {},
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
