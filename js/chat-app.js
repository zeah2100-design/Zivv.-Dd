(function () {
  const priv = document.body.getAttribute("data-chat") === "private";
  const page = priv ? "private.html" : "chat.html";
  const title = priv ? "الدردشة الخاصة" : "الدردشة";
  const qs = new URLSearchParams(location.search);
  const u = qs.get("u");
  const productId = qs.get("product");
  const root = document.getElementById("root");
  const me = ZIVV_CORE.meKey();
  const PASS_KEY = "zivv.privatePass";
  const UNLOCK_KEY = "zivv.privateUnlock";

  function person(user) {
    return (
      ZIVV_CORE.peopleForShare().find((p) => p.user === user) || {
        name: user,
        user,
        avatar: "brand/logo-sm.png",
      }
    );
  }

  function hash(s) {
    let h = 5381;
    const t = String(s || "");
    for (let i = 0; i < t.length; i++) h = ((h << 5) + h) ^ t.charCodeAt(i);
    return String(h >>> 0);
  }

  function unlocked() {
    if (!priv) return true;
    const saved = localStorage.getItem(PASS_KEY);
    if (!saved) return false;
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  }

  function paintLock() {
    const has = !!localStorage.getItem(PASS_KEY);
    root.innerHTML = `
      <h1>${title}</h1>
      <p class="mute">الصفحة دي محمية بكلمة مرور. نفس الدردشة، بخصوصية أعلى.</p>
      <form class="lock" id="lock">
        ${
          has
            ? `<input class="field" id="pw" type="password" placeholder="كلمة المرور" required />`
            : `<input class="field" id="pw" type="password" placeholder="أنشئ كلمة مرور" required minlength="4" />
               <input class="field" id="pw2" type="password" placeholder="تأكيد كلمة المرور" required />`
        }
        <button class="btn" type="submit">${has ? "دخول" : "حفظ ودخول"}</button>
        <p class="err" id="lock-err"></p>
      </form>`;
    document.getElementById("lock").onsubmit = (e) => {
      e.preventDefault();
      const pw = document.getElementById("pw").value;
      const err = document.getElementById("lock-err");
      if (!has) {
        const pw2 = document.getElementById("pw2").value;
        if (pw.length < 4) {
          err.textContent = "كلمة المرور ٤ حروف على الأقل.";
          return;
        }
        if (pw !== pw2) {
          err.textContent = "التأكيد مش مطابق.";
          return;
        }
        localStorage.setItem(PASS_KEY, hash(pw));
        sessionStorage.setItem(UNLOCK_KEY, "1");
        start();
        return;
      }
      if (hash(pw) !== localStorage.getItem(PASS_KEY)) {
        err.textContent = "كلمة المرور غلط.";
        return;
      }
      sessionStorage.setItem(UNLOCK_KEY, "1");
      start();
    };
  }

  function href(user) {
    return page + "?u=" + encodeURIComponent(user);
  }

  function paintInbox(filter) {
    const q = String(filter || "").trim();
    const threads = ZIVV_CORE.inbox(priv);
    const friends = ZIVV_CORE.chatFriends();
    const people = q ? ZIVV_CORE.searchPeople(q) : ZIVV_CORE.peopleForShare();
    const shownThreads = q
      ? threads.filter((t) => people.some((p) => p.user === t.user) || ZIVV_CORE.norm(t.person.name).includes(ZIVV_CORE.norm(q)))
      : threads;

    root.innerHTML = `
      <div class="head">
        <h1>${title}</h1>
        <div class="tools">
          <button class="ico" id="btn-search" type="button" title="بحث عن أشخاص">⌕</button>
          <button class="ico" id="btn-add" type="button" title="إضافة صديق">+</button>
        </div>
      </div>
      <div class="find ${q ? "open" : ""}" id="find">
        <input id="q" class="field" placeholder="ابحث عن شخص…" value="${q.replace(/"/g, "")}" />
      </div>
      <p class="mute">${priv ? "محادثات خاصة مع الأصدقاء المقبولين فقط." : "الدردشة للأصدقاء المقبولين بس. طلب الصداقة من الملف الشخصي، والمتابعة حاجة تانية."}</p>
      <div id="list"></div>`;

    const list = document.getElementById("list");
    if (q) {
      list.innerHTML =
        (people.length
          ? people
              .map((p) => {
                const ok = ZIVV_CORE.isChatFriend(p.user);
                const go = ok ? href(p.user) : "profile.html?u=" + encodeURIComponent(p.user);
                return `<a class="row" href="${go}">
            <img src="${p.avatar}" alt="">
            <div><b>${p.name}</b><div class="mute">@${p.user}${ok ? " · صديق — دردشة" : " · ابعت طلب صداقة من حسابه"}</div></div>
          </a>`;
              })
              .join("")
          : '<p class="mute">مفيش شخص بالاسم ده.</p>');
    } else {
      const friendPeople = friends
        .map((fu) => person(fu))
        .filter((p) => !shownThreads.some((t) => t.user === p.user));
      const friendThreads = shownThreads.filter((t) => ZIVV_CORE.isChatFriend(t.user));
      list.innerHTML =
        (friendThreads.length
          ? `<h2>المحادثات</h2>` +
            friendThreads
              .map(
                (t) => `<a class="row" href="${href(t.user)}">
            <img src="${t.person.avatar}" alt="">
            <div><b>${t.person.name}</b><div class="mute">${preview(t.last)}</div></div>
          </a>`
              )
              .join("")
          : '<p class="mute">مفيش محادثات. ابعت طلب صداقة من الملف الشخصي، وبعد القبول تقدر تدردش.</p>') +
        (friendPeople.length
          ? `<h2>الأصدقاء</h2>` +
            friendPeople
              .map(
                (p) => `<a class="row" href="${href(p.user)}">
            <img src="${p.avatar}" alt=""><div><b>${p.name}</b><div class="mute">@${p.user}</div></div>
          </a>`
              )
              .join("")
          : "");
    }

    document.getElementById("btn-search").onclick = () => {
      const box = document.getElementById("find");
      box.classList.toggle("open");
      if (box.classList.contains("open")) document.getElementById("q").focus();
    };
    document.getElementById("q").oninput = () => paintInbox(document.getElementById("q").value);
    document.getElementById("btn-add").onclick = () => {
      location.href = "friends.html";
    };
  }

  function preview(last) {
    if (!last) return "";
    if (last.kind === "image") return "صورة";
    if (last.kind === "video") return "فيديو";
    if (last.kind === "file") return "ملف: " + (last.fileName || "");
    return (last.text || "").slice(0, 48);
  }

  function openAdd() {
    const people = ZIVV_CORE.peopleForShare();
    const sheet = document.createElement("div");
    sheet.className = "sheet-bg";
    sheet.innerHTML = `
      <div class="sheet">
        <h3>إضافة صديق للدردشة</h3>
        <input class="field" id="add-q" placeholder="ابحث عن شخص…" />
        <div id="add-list"></div>
        <button class="ghost" type="button" id="add-x">إغلاق</button>
      </div>`;
    document.body.appendChild(sheet);
    function draw(q) {
      const list = q ? ZIVV_CORE.searchPeople(q) : people;
      document.getElementById("add-list").innerHTML = list
        .map(
          (p) => `<button class="rowbtn" type="button" data-u="${p.user}">
          <img src="${p.avatar}" alt=""><span><b>${p.name}</b><div class="mute">@${p.user}</div></span>
        </button>`
        )
        .join("");
      document.querySelectorAll("#add-list .rowbtn").forEach((b) => {
        b.onclick = () => {
          const user = b.getAttribute("data-u");
          ZIVV_CORE.addChatFriend(user);
          sheet.remove();
          location.href = href(user);
        };
      });
    }
    draw("");
    document.getElementById("add-q").oninput = (e) => draw(e.target.value);
    document.getElementById("add-x").onclick = () => sheet.remove();
    sheet.onclick = (e) => {
      if (e.target === sheet) sheet.remove();
    };
  }

  function compress(dataUrl, max, cb) {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => cb(dataUrl);
    img.src = dataUrl;
  }

  function paintThread() {
    const p = person(u);
    if (!ZIVV_CORE.isChatFriend(u)) {
      root.innerHTML = `
        <a class="back" href="${page}">رجوع</a>
        <h1>${p.name}</h1>
        <p class="mute">مش تقدر تدردش غير بعد طلب صداقة وقبوله. المتابعة حاجة تانية.</p>
        <p style="margin-top:14px"><a class="back" href="profile.html?u=${encodeURIComponent(u)}">افتح الحساب الرسمي وابعت طلب صداقة</a></p>`;
      return;
    }
    if (productId && window.ZIVV_STORE) {
      const pr = ZIVV_STORE.byId(productId);
      if (pr && !ZIVV_CORE.threadWith(u, priv).some((m) => m.productId === productId && m.from === me)) {
        ZIVV_CORE.sendMessage(
          u,
          {
            kind: "product",
            productId,
            text: "مهتم بالمنتج: " + pr.title + " — عايز أشتري.",
            image: pr.image,
          },
          priv
        );
      }
    }

    function draw() {
      const thread = ZIVV_CORE.threadWith(u, priv);
      root.innerHTML = `
        <a class="back" href="${page}">رجوع</a>
        <div class="who">
          <img src="${p.avatar}" alt="">
          <div>
            <h1>${p.name}</h1>
            <div class="mute">@${p.user}${priv ? " · خاصة" : ""}</div>
          </div>
        </div>
        <div class="thread" id="thread"></div>
        <form class="composer" id="send">
          <button class="att" id="att" type="button" title="صورة أو فيديو أو ملف">📎</button>
          <input id="msg" placeholder="اكتب رسالة…" />
          <button type="submit">إرسال</button>
        </form>
        <input id="file" type="file" accept="image/*,video/*,*/*" hidden />`;

      const box = document.getElementById("thread");
      box.innerHTML =
        thread
          .map((m) => {
            const mine = m.from === me;
            let media = "";
            if (m.kind === "image" && (m.image || m.mediaId)) {
              media = `<img class="att-img" ${m.mediaId ? `data-media="${m.mediaId}"` : `src="${m.image}"`} alt="">`;
            } else if (m.kind === "video") {
              media = `<video class="att-vid" controls playsinline ${m.mediaId ? `data-media="${m.mediaId}"` : m.video ? `src="${m.video}"` : ""}></video>`;
            } else if (m.kind === "file") {
              media = `<div class="file">ملف: ${m.fileName || "مرفق"}</div>`;
            } else if (m.kind === "share" || m.kind === "product") {
              media = `<div class="share-card">${m.image ? `<img src="${m.image}" alt="">` : ""}<span>${m.preview || m.text}</span></div>`;
            }
            return `<div class="bubble ${mine ? "me" : "them"}">${m.text ? `<div>${m.text}</div>` : ""}${media}</div>`;
          })
          .join("") || '<p class="mute">ابدأ المحادثة.</p>';

      if (window.ZIVV_MEDIA) ZIVV_MEDIA.hydrate(box);
      box.scrollTop = box.scrollHeight;

      document.getElementById("send").onsubmit = (e) => {
        e.preventDefault();
        const v = document.getElementById("msg").value.trim();
        if (!v) return;
        ZIVV_CORE.sendMessage(u, { text: v, kind: "text" }, priv);
        document.getElementById("msg").value = "";
        draw();
      };
      document.getElementById("att").onclick = () => document.getElementById("file").click();
      document.getElementById("file").onchange = async () => {
        const file = document.getElementById("file").files && document.getElementById("file").files[0];
        document.getElementById("file").value = "";
        if (!file) return;
        if (file.type.startsWith("image/")) {
          const r = new FileReader();
          r.onload = () =>
            compress(r.result, 1000, (data) => {
              ZIVV_CORE.sendMessage(u, { kind: "image", image: data, text: "" }, priv);
              draw();
            });
          r.readAsDataURL(file);
          return;
        }
        const id = "chat_" + Date.now();
        if (window.ZIVV_MEDIA) {
          try {
            await ZIVV_MEDIA.put(id, file);
          } catch {
            alert("الملف كبير. جرّب أصغر.");
            return;
          }
        }
        if (file.type.startsWith("video/")) {
          ZIVV_CORE.sendMessage(u, { kind: "video", mediaId: id, text: "", fileName: file.name }, priv);
        } else {
          ZIVV_CORE.sendMessage(u, { kind: "file", mediaId: id, text: "", fileName: file.name }, priv);
        }
        draw();
      };
    }
    draw();
  }

  function start() {
    if (u) paintThread();
    else paintInbox("");
  }

  if (priv && !unlocked()) paintLock();
  else start();
})();
