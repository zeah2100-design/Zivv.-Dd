(function () {
  // Real Database Config - Supabase Postgres
  // Production uses real tables via API (lib/database.js)
  // This config is for direct Supabase mode fallback
  const HARD = {
    url: "https://ldionpdfplvbnpoelkqe.supabase.co",
    anon: "sb_publishable_ZoiDkuZpyQ0AYSWb0TAj_Q_wfc7w0sx"
  };
  // Allow override from localStorage
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem("zivv.supabase") || "null"); } catch {}
  window.ZIVV_SUPABASE_CFG = {
    url: (stored && stored.url) || HARD.url,
    anon: (stored && stored.anon) || HARD.anon,
    realDb: true, // Flag that we have real DB now
    version: "2.0-real-db"
  };
})();
