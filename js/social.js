(function () {
  const css = `
    .zivv-scrim { display:none; position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:80; }
    .zivv-scrim.open { display:block; }
    .zivv-sheet {
      display:none; position:fixed; left:0; right:0; bottom:0; z-index:81;
      background:#121212; border-radius:16px 16px 0 0; max-height:72dvh;
      direction:rtl; color:#fff; font-family:"Segoe UI", Tahoma, Arial, sans-serif;
      box-shadow:0 -12px 40px rgba(0,0,0,.5);
    }
    .zivv-sheet.open { display:flex; flex-direction:column; }
    .zivv-sheet .hd {
      display:flex; align-items:center; justify-content:space-between;
      padding:12px 14px; border-bottom:1px solid #262626; font-weight:800;
    }
    .zivv-sheet .hd button { background:none; border:0; color:#fff; font-size:20px; }
    .zivv-sheet .body { overflow:auto; padding:10px 12px 8px; flex:1; }
    .zivv-c {
      display:grid; grid-template-columns:40px 1fr auto; gap:8px;
      margin-bottom:12px; align-items:start;
    }
    .zivv-c.reply { margin-right:48px; }
    .zivv-c img { width:36px; height:36px; border-radius:50%; object-fit:cover; }
    .zivv-c .nm { font-weight:800; font-size:13px; }
    .zivv-c .tm { color:#888; font-size:11px; font-weight:400; }
    .zivv-c .tx { font-size:14px; line-height:1.5; margin-top:2px; }
    .zivv-c .row { color:#888; font-size:12px; margin-top:4px; display:flex; gap:12px; }
    .zivv-c .row button { background:none; border:0; color:#888; font-size:12px; padding:0; }
    .zivv-c .heart { background:none; border:0; color:#888; font-size:16px; }
    .zivv-c .heart.on { color:#fe2c55; }
    .zivv-add {
      display:flex; gap:8px; padding:10px 12px 14px; border-top:1px solid #262626; align-items:center;
    }
    .zivv-add img { width:32px; height:32px; border-radius:50%; object-fit:cover; }
    .zivv-add input {
      flex:1; background:#000; border:1px solid #333; color:#fff;
      border-radius:999px; padding:10px 12px; outline:none;
    }
    .zivv-add button {
      border:0; background:none; color:#fe2c55; font-weight:800;
    }
    .zivv-person {
      display:flex; width:100%; align-items:center; gap:10px; text-align:right;
      background:#1a1a1a; border:0; color:#fff; border-radius:12px; padding:10px; margin-bottom:8px;
    }
    .zivv-person img { width:40px; height:40px; border-radius:50%; object-fit:cover; }
    .zivv-heartpop {
      position:absolute; inset:0; display:grid; place-items:center;
      font-size:84px; color:#fe2c55; pointer-events:none; animation:zivvPop .7s ease forwards;
      text-shadow:0 8px 24px #000;
    }
    @keyframes zivvPop { 0%{transform:scale(.4);opacity:0} 30%{transform:scale(1.15);opacity:1} 100%{transform:scale(1);opacity:0} }
  `;

  function mount() {
    if (document.getElementById("zivv-social")) return;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    const wrap = document.createElement("div");
    wrap.id = "zivv-social";
    wrap.innerHTML = `
      <div class="zivv-scrim" id="zivv-scrim"></div>
      <div class="zivv-sheet" id="zivv-comments">
        <div class="hd"><span id="zivv-ctitle">التعليقات</span><button type="button" id="zivv-cx">×</button></div>
        <div class="body" id="zivv-clist"></div>
        <form class="zivv-add" id="zivv-cform">
          <img id="zivv-cava" alt="">
          <input id="zivv-cinput" maxlength="400" placeholder="أضف تعليق…" />
          <button type="submit">نشر</button>
        </form>
      </div>
      <div class="zivv-sheet" id="zivv-share">
        <div class="hd"><span>مشاركة لشخص</span><button type="button" id="zivv-sx">×</button></div>
        <div class="body" id="zivv-slist"></div>
      </div>
    `;
    document.body.appendChild(wrap);
    const me = ZIVV_CORE.author();
    document.getElementById("zivv-cava").src = me.avatar || "brand/logo-sm.png";
    document.getElementById("zivv-scrim").onclick = close;
    document.getElementById("zivv-cx").onclick = close;
    document.getElementById("zivv-sx").onclick = close;
    document.getElementById("zivv-cform").onsubmit = (e) => {
      e.preventDefault();
      const v = document.getElementById("zivv-cinput").value.trim();
      if (!v || !state.post) return;
      ZIVV_CORE.addComment(state.post.id, v, state.replyTo);
      document.getElementById("zivv-cinput").value = "";
      state.replyTo = null;
      document.getElementById("zivv-cinput").placeholder = "أضف تعليق…";
      paintComments();
      if (state.onChange) state.onChange();
    };
  }

  const state = { post: null, replyTo: null, onChange: null };

  function close() {
    document.getElementById("zivv-scrim").classList.remove("open");
    document.getElementById("zivv-comments").classList.remove("open");
    document.getElementById("zivv-share").classList.remove("open");
    state.replyTo = null;
  }

  function ago(at) {
    if (!at) return "";
    const m = Math.max(1, Math.round((Date.now() - at) / 60000));
    if (m < 60) return m + " د";
    const h = Math.round(m / 60);
    if (h < 24) return h + " س";
    return Math.round(h / 24) + " ي";
  }

  function paintComments() {
    const post = state.post;
    const all = ZIVV_CORE.commentsOf(post);
    const roots = all.filter((c) => !c.parentId);
    const kids = (id) => all.filter((c) => c.parentId === id);
    document.getElementById("zivv-ctitle").textContent = "التعليقات · " + all.length;
    const row = (c, reply) => {
      const liked = ZIVV_CORE.commentLiked(post.id, c.id);
      const n = ZIVV_CORE.commentLikeCount(post.id, c.id);
      const ava = c.avatar || (ZIVV_CORE.personOf && ZIVV_CORE.personOf(c.byUser || c.by).avatar) || "brand/logo-sm.png";
      return `<div class="zivv-c ${reply ? "reply" : ""}" data-cid="${c.id}">
        <img src="${ava}" alt="">
        <div>
          <div class="nm">${c.name} <span class="tm">${ago(c.at)}</span></div>
          <div class="tx">${c.text}</div>
          <div class="row">
            <button type="button" data-reply="${c.id}">رد</button>
          </div>
        </div>
        <button class="heart ${liked ? "on" : ""}" type="button" data-like="${c.id}">${liked ? "♥" : "♡"} ${n || ""}</button>
      </div>`;
    };
    let html = roots.map((c) => row(c, false) + kids(c.id).map((k) => row(k, true)).join("")).join("");
    document.getElementById("zivv-clist").innerHTML = html || '<p style="color:#888;padding:20px 8px">كن أول تعليق.</p>';
    document.querySelectorAll("#zivv-clist [data-like]").forEach((b) => {
      b.onclick = () => {
        ZIVV_CORE.toggleCommentLike(post.id, b.getAttribute("data-like"));
        paintComments();
      };
    });
    document.querySelectorAll("#zivv-clist [data-reply]").forEach((b) => {
      b.onclick = () => {
        state.replyTo = b.getAttribute("data-reply");
        const who = all.find((x) => x.id === state.replyTo);
        document.getElementById("zivv-cinput").placeholder = "رد على " + (who && who.name ? who.name : "");
        document.getElementById("zivv-cinput").focus();
      };
    });
  }

  function openComments(post, onChange) {
    mount();
    state.post = post;
    state.onChange = onChange || null;
    state.replyTo = null;
    paintComments();
    document.getElementById("zivv-scrim").classList.add("open");
    document.getElementById("zivv-comments").classList.add("open");
  }

  function openShare(post, onChange) {
    mount();
    state.post = post;
    state.onChange = onChange || null;
    const box = document.getElementById("zivv-slist");
    const people = ZIVV_CORE.peopleForShare();
    box.innerHTML = people.map((p) =>
      `<button class="zivv-person" type="button" data-u="${p.user}"><img src="${p.avatar}" alt=""><span><b>${p.name}</b><div style="color:#888;font-size:12px">@${p.user}</div></span></button>`
    ).join("") || "<p style='color:#888'>مفيش حد تشاركه لسه.</p>";
    box.querySelectorAll(".zivv-person").forEach((b) => {
      b.onclick = () => {
        const u = b.getAttribute("data-u");
        ZIVV_CORE.sharePost(post, u);
        close();
        if (state.onChange) state.onChange();
        location.href = "chat.html?u=" + encodeURIComponent(u);
      };
    });
    document.getElementById("zivv-scrim").classList.add("open");
    document.getElementById("zivv-share").classList.add("open");
  }

  function popHeart(el) {
    const n = document.createElement("div");
    n.className = "zivv-heartpop";
    n.textContent = "♥";
    el.style.position = el.style.position || "relative";
    el.appendChild(n);
    setTimeout(() => n.remove(), 700);
  }

  window.ZIVV_SOCIAL = { mount, openComments, openShare, popHeart, close };
})();
