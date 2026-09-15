(function () {
  // Real Database Config - Supabase Postgres
  // Production uses real tables via API (lib/database.js) — لا يحتاج أي مفتاح هنا.
  // هذا الملف للتشغيل المباشر (fallback) فقط.
  //
  // طريقة ضبط المفاتيح (env first):
  //   1) localStorage: zivv.supabase = { "url": "...", "anon": "..." }
  //   2) أو عبر window.ZIVV_ENV (يُحقن من السيرفر/قالب HTML)
  //   3) المفاتيح الحساسة (service_role) توضع على السيرفر فقط:
  //      SUPABASE_SERVICE_ROLE_KEY في Vercel > Environment Variables
  const ENV = window.ZIVV_ENV || {};
  const HARD = {
    url: "https://ldionpdfplvbnpoelkqe.supabase.co",
    anon: "sb_publishable_ZoiDkuZpyQ0AYSWb0TAj_Q_wfc7w0sx"
  };
  // Allow override from localStorage
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem("zivv.supabase") || "null"); } catch {}
  window.ZIVV_SUPABASE_CFG = {
    url: (stored && stored.url) || ENV.SUPABASE_URL || HARD.url,
    anon: (stored && stored.anon) || ENV.SUPABASE_ANON_KEY || HARD.anon,
    realDb: true, // Flag that we have real DB now
    version: "2.0-real-db"
  };
})();
