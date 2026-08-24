(function () {
  const PRODUCTS = [];

  function userCatalog() {
    try { return JSON.parse(localStorage.getItem("zivv.myProducts") || "[]"); }
    catch { return []; }
  }
  function allProducts() {
    const list = PRODUCTS.concat(userCatalog());
    if (!window.ZIVV_CORE || !ZIVV_CORE.canViewUser) return list;
    return list.filter((p) => ZIVV_CORE.canViewUser(p.sellerUser || p.user || ""));
  }
  function cats() {
    return ["الكل"].concat([...new Set(allProducts().map((p) => p.cat).filter(Boolean))]);
  }
  function byId(id) {
    return allProducts().find((p) => p.id === id) || null;
  }
  function byCat(cat) {
    const list = allProducts();
    if (!cat || cat === "الكل") return list.slice();
    return list.filter((p) => p.cat === cat);
  }
  function bySeller(user) {
    const u = String(user || "").toLowerCase();
    return allProducts().filter((p) => (p.sellerUser || "").toLowerCase() === u);
  }
  function addUserProduct(p) {
    const list = userCatalog();
    list.unshift(p);
    localStorage.setItem("zivv.myProducts", JSON.stringify(list));
    return list;
  }

  window.ZIVV_STORE = { PRODUCTS, cats, byId, byCat, bySeller, addUserProduct, allProducts };
})();
