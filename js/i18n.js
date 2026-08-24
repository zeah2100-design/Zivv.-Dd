(function () {
  const AR = {
    home: "الرئيسية",
    explore: "اكتشف",
    reels: "الشريط",
    profile: "حسابي",
    publish: "نشر منشور",
    creators: "صناع المحتوى",
    settings: "الإعدادات",
    chat: "الدردشة",
    private: "دردشة خاصة",
    store: "المتجر الإلكتروني",
    ai: "دردشة الذكاء",
    alerts: "الإشعارات",
    friends: "الأصدقاء",
    music: "الموسيقى",
    stories: "الحالات",
    search: "بحث",
    pages: "الصفحات",
    feedOpts: "خيارات الفيد",
    hideAI: "تقليل منشورات الذكاء الاصطناعي",
    mix: "خوارزمية زيفي: ٦٠٪ متابعة · ٢٩٪ عشوائي · ١١٪ هاشتاج",
    hideVideos: "لا أريد رؤية الفيديوهات",
    photosOnly: "لا أريد رؤية إلا الصور",
    backHome: "الرجوع للصفحة الرئيسية",
    chatsLog: "سجل المحادثات",
    locked: "الحساب مقفول",
    lockedHint: "صاحب الحساب قفله. الأصدقاء بس اللي يقدروا يشوفوا الملف والمنشورات.",
    requestFriend: "طلب صداقة",
    friendSent: "طلب صداقة اتبعت",
    friendsNow: "أصدقاء",
    lockOn: "الحساب مقفول — الأصدقاء بس",
    lockOff: "الحساب مفتوح للكل",
    lockTitle: "قفل الحساب",
    lockHelp: "لو قفلت الحساب، محدش هيشوف بروفايلك ولا منشوراتك غير الأصدقاء.",
    follow: "متابعة",
    unfollow: "إلغاء المتابعة",
    message: "رسالة",
    block: "حظر",
    posts: "منشور",
    followers: "متابع",
    products: "منتج",
  };
  const EN = {
    home: "Home",
    explore: "Explore",
    reels: "Reels",
    profile: "Profile",
    publish: "New post",
    creators: "Creators",
    settings: "Settings",
    chat: "Chat",
    private: "Private chat",
    store: "Store",
    ai: "Zivvy AI",
    alerts: "Notifications",
    friends: "Friends",
    music: "Music",
    stories: "Stories",
    search: "Search",
    pages: "Pages",
    feedOpts: "Feed options",
    hideAI: "Hide AI posts",
    mix: "Zivvy mix: 60% following · 29% random · 11% tags",
    hideVideos: "Hide videos",
    photosOnly: "Photos only",
    backHome: "Back to Home",
    chatsLog: "Chat history",
    locked: "This account is locked",
    lockedHint: "Only accepted friends can see this profile and its posts.",
    requestFriend: "Add friend",
    friendSent: "Request sent",
    friendsNow: "Friends",
    lockOn: "Locked — friends only",
    lockOff: "Public account",
    lockTitle: "Lock account",
    lockHelp: "If you lock it, only friends can see your profile and posts.",
    follow: "Follow",
    unfollow: "Unfollow",
    message: "Message",
    block: "Report",
    posts: "posts",
    followers: "followers",
    products: "products",
  };

  const TITLES = {
    "home.html": { ar: "ZIVV — الرئيسية", en: "ZIVV — Home" },
    "explore.html": { ar: "ZIVV — اكتشف", en: "ZIVV — Explore" },
    "reels.html": { ar: "ZIVV — الشريط", en: "ZIVV — Reels" },
    "profile.html": { ar: "ZIVV — الملف الشخصي", en: "ZIVV — Profile" },
    "publish.html": { ar: "ZIVV — نشر منشور", en: "ZIVV — New post" },
    "creators.html": { ar: "ZIVV — صناع المحتوى", en: "ZIVV — Creators" },
    "settings.html": { ar: "ZIVV — الإعدادات", en: "ZIVV — Settings" },
    "chat.html": { ar: "ZIVV — الدردشة", en: "ZIVV — Chat" },
    "private.html": { ar: "ZIVV — دردشة خاصة", en: "ZIVV — Private chat" },
    "store.html": { ar: "ZIVV — المتجر", en: "ZIVV — Store" },
    "ai.html": { ar: "ZIVV — زيفي", en: "ZIVV — Zivvy AI" },
    "alerts.html": { ar: "ZIVV — الإشعارات", en: "ZIVV — Notifications" },
    "friends.html": { ar: "ZIVV — الأصدقاء", en: "ZIVV — Friends" },
    "music.html": { ar: "ZIVV — الموسيقى", en: "ZIVV — Music" },
    "stories.html": { ar: "ZIVV — الحالات", en: "ZIVV — Stories" },
    "search.html": { ar: "ZIVV — بحث", en: "ZIVV — Search" },
    "index.html": { ar: "ZIVV", en: "ZIVV" },
  };

  function lang() {
    return localStorage.getItem("zivv.lang") === "en" ? "en" : "ar";
  }
  function dict() {
    return lang() === "en" ? EN : AR;
  }
  function t(key) {
    const d = dict();
    return d[key] || AR[key] || key;
  }
  function applyDir() {
    const en = lang() === "en";
    document.documentElement.lang = en ? "en" : "ar";
    document.documentElement.dir = en ? "ltr" : "rtl";
    const file = String(location.pathname.split("/").pop() || "home.html").toLowerCase();
    const title = TITLES[file];
    if (title) document.title = en ? title.en : title.ar;
  }
  function apply() {
    applyDir();
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const k = el.getAttribute("data-i18n");
      if (k) el.textContent = t(k);
    });
    const mapHref = {
      "home.html": "home",
      "explore.html": "explore",
      "reels.html": "reels",
      "profile.html": "profile",
      "publish.html": "publish",
      "creators.html": "creators",
      "settings.html": "settings",
      "chat.html": "chat",
      "private.html": "private",
      "store.html": "store",
      "ai.html": "ai",
      "alerts.html": "alerts",
      "friends.html": "friends",
      "music.html": "music",
      "stories.html": "stories",
      "search.html": "search",
    };
    document.querySelectorAll(".nav a").forEach((a) => {
      const href = (a.getAttribute("href") || "").split("?")[0];
      const key = mapHref[href];
      const span = a.querySelector("span:not(.plus)");
      if (key && span) span.textContent = t(key);
    });
    document.querySelectorAll(".panel.apps h3").forEach((h) => (h.textContent = t("pages")));
    document.querySelectorAll(".panel.filters h3").forEach((h) => {
      if (document.body.getAttribute("data-page") === "ai") h.textContent = t("chatsLog");
      else h.textContent = t("feedOpts");
    });
    const hideAi = document.querySelector("#pref-hide-ai");
    if (hideAi && hideAi.nextElementSibling) hideAi.nextElementSibling.textContent = t("hideAI");
    const mix = document.querySelector("#pref-mix");
    if (mix && mix.nextElementSibling) mix.nextElementSibling.textContent = t("mix");
    const hv = document.querySelector("#pref-hide-videos");
    if (hv && hv.nextElementSibling) hv.nextElementSibling.textContent = t("hideVideos");
    const po = document.querySelector("#pref-photos-only");
    if (po && po.nextElementSibling) po.nextElementSibling.textContent = t("photosOnly");
    const hm = document.querySelector("a.home-mark span:last-child");
    if (hm) hm.textContent = t("backHome");
    const filterBtn = document.getElementById("btn-filters");
    if (filterBtn) {
      filterBtn.title = document.body.getAttribute("data-page") === "ai" ? t("chatsLog") : t("feedOpts");
    }
    const appsBtn = document.getElementById("btn-apps");
    if (appsBtn) appsBtn.title = t("pages");
    const searchIco = document.querySelector('a.ico[href="search.html"]');
    if (searchIco) searchIco.title = t("search");
    document.querySelectorAll("a.tile").forEach((a) => {
      const href = (a.getAttribute("data-href") || a.getAttribute("href") || "").split("?")[0];
      const key = mapHref[href];
      if (!key) return;
      const icon = a.querySelector("i");
      const label = t(key);
      a.innerHTML = (icon ? icon.outerHTML : "") + label;
    });
  }

  window.ZIVV_I18N = { t, lang, apply, AR, EN };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
  window.addEventListener("zivv-lang", apply);
})();
