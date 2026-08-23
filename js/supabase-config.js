(function () {
  let url = "";
  let anon = "";
  try {
    const saved = JSON.parse(localStorage.getItem("zivv.supabase") || "null");
    if (saved && saved.url && saved.anon) {
      url = saved.url;
      anon = saved.anon;
    }
  } catch {}
  window.ZIVV_SUPABASE_CFG = { url: url.trim(), anon: anon.trim() };
})();
