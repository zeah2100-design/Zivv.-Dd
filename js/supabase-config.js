(function () {
  const HARD = {
    url: "https://ldionpdfplvbnpoelkqe.supabase.co",
    anon: "sb_publishable_ZoiDkuZpyQ0AYSWb0TAj_Q_wfc7w0sx"
  };
  let url = HARD.url;
  let anon = HARD.anon;
  try {
    const saved = JSON.parse(localStorage.getItem("zivv.supabase") || "null");
    if (saved && saved.url && saved.anon) {
      url = saved.url;
      anon = saved.anon;
    }
  } catch {}
  window.ZIVV_SUPABASE_CFG = {
    url: String(url || "").trim().replace(/\/$/, ""),
    anon: String(anon || "").trim()
  };
})();
