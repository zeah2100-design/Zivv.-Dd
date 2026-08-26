(function () {
  const KEY = "zivv.aiChats";
  const COMET_KEY = "sk-vSJCr2yYYijxwTpLdBHf3sOprMRZoj7OOn4DUh9Blvz50hGG";
  const COMET_MODEL = "gemini-3.6-flash";
  const root = document.getElementById("root");
  const qs = new URLSearchParams(location.search);
  let activeId = qs.get("id") || "";
  let abort = null;
  let pendingFiles = [];

  const SYSTEM =
    "أنت زيفي، المساعد الذكي داخل تطبيق ZIVV. " +
    "ZIVV شبكة اجتماعية للبالغين +18. " +
    "رد باللهجة المصرية الواضحة والمختصرة إلا لو المستخدم طلب تفصيل. " +
    "ما تقولش إنك ChatGPT أو Claude أو Gemini. اسمك زيفي وبس. " +
    "ساعد في الكتابة، الأفكار، الترجمة، المحتوى، الأسئلة العامة. " +
    "ممنوع مساعدة في جرائم أو أي محتوى لقاصرين.";

  const STARTERS = [
    "اكتب كابشن قوي لصورة من الجيزة بالليل",
    "فكرة ريل قصير يفاجئ الناس",
    "ترجم الجملة دي لإنجليزي محترم",
    "خطة محتوى لأسبوع على ZIVV",
    "ابحث: أخبار مصر النهاردة",
    "ارسم: الأهرامات بالليل بأسلوب سينمائي",
  ];

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  function write(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("zivv-ai-chats"));
  }
  function meName() {
    return (window.ZIVV_CORE && ZIVV_CORE.meName && ZIVV_CORE.meName()) || "أنت";
  }
  function now() {
    return Date.now();
  }
  function uid() {
    return "ai_" + Date.now() + "_" + Math.random().toString(16).slice(2, 6);
  }
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function md(s) {
    let t = esc(s);
    t = t.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/\n/g, "<br>");
    return t;
  }
  function titleFrom(text) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    return t.slice(0, 36) || "دردشة جديدة";
  }
  function wantsImage(text) {
    return /(ارسم|ولّد|ولد صور|اعمل صور|اعمل صورة|صوّر|صور لي|صورلى|صورة ل|صورة عن|صمم|تصميم|لوجو|خلفية|generate an image|draw |make an image|صورة سينما)/i.test(
      text || ""
    );
  }
  function wantsEdit(text) {
    return /(عدل|عدّل|تعديل|غيّر|غير اللون|حسن الصورة|حط على الصورة|شيل من الصورة|رتّوش|رتوش|edit the image|retouch)/i.test(
      text || ""
    );
  }
  function goldAI() {
    return !!(window.ZIVV_CREATOR && ZIVV_CREATOR.isGoldUser && ZIVV_CREATOR.isGoldUser());
  }
  function quota() {
    return (window.ZIVV_CREATOR && ZIVV_CREATOR.aiStatus && ZIVV_CREATOR.aiStatus()) || {
      gold: goldAI(),
      chatsLeft: 10,
      imagesLeft: 10,
    };
  }
  function quotaLine() {
    const q = quota();
    if (q.gold) return "حساب ذهبي: زيفي براحتك، محادثة عادية أو مباشرة.";
    return "العادي اليوم: " + q.chatsLeft + " محادثات · كل واحدة ساعة · " + q.imagesLeft + " صور.";
  }
  function wantsSearch(text) {
    const t = String(text || "");
    return /(ابحث|سيرش|search|أخبار|النهارده|النهاردة|سعر|الطقس|مين فاز|إيه اللي حصل|آخر خبر|دلوقتي|جوجل|google|ويكيبيديا|امتى|فين الخبر|ماتش|ماتشات|نتيجة|نتيجه|سكور|كورة|كوره|الدوري)/i.test(
      t
    );
  }
  function imageUrl(prompt) {
    return (
      "https://image.pollinations.ai/prompt/" +
      encodeURIComponent(String(prompt || "cinematic photo").slice(0, 400)) +
      "?width=1024&height=1024&nologo=true&model=flux&referrer=zivv&seed=" +
      Date.now()
    );
  }
  function formatHits(items) {
    return (items || [])
      .filter((it) => it && it.title)
      .map((it, i) => i + 1 + ") " + it.title + (it.snippet ? " — " + it.snippet : "") + (it.url ? " (" + it.url + ")" : ""))
      .join("\n");
  }
  async function wikiSearch(q) {
    const items = [];
    const r = await fetch(
      "https://ar.wikipedia.org/w/api.php?action=query&list=search&utf8=1&format=json&origin=*&srlimit=5&srsearch=" +
        encodeURIComponent(q)
    );
    const d = await r.json();
    const hits = (d.query && d.query.search) || [];
    if (!hits.length) return items;
    const titles = hits.map((h) => h.title).join("|");
    const r2 = await fetch(
      "https://ar.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exchars=280&format=json&origin=*&titles=" +
        encodeURIComponent(titles)
    );
    const d2 = await r2.json();
    const pages = (d2.query && d2.query.pages) || {};
    Object.keys(pages).forEach((k) => {
      const p = pages[k];
      if (!p || p.missing != null) return;
      items.push({
        title: p.title,
        snippet: String(p.extract || "").replace(/\s+/g, " ").trim().slice(0, 240),
        url: "https://ar.wikipedia.org/wiki/" + encodeURIComponent(p.title),
      });
    });
    return items;
  }
  async function newsSearch(q) {
    const rss =
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent(q) +
      "&hl=ar&gl=EG&ceid=EG:ar";
    const r = await fetch("https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(rss));
    const d = await r.json();
    return ((d && d.items) || []).slice(0, 6).map((it) => ({
      title: it.title || "",
      snippet: String(it.content || it.description || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180),
      url: it.link || it.url || "",
    }));
  }
  async function webSearch(q) {
    const bag = [];
    try {
      const news = await newsSearch(q);
      news.forEach((n) => bag.push(n));
    } catch {}
    try {
      const r = await fetch("/api/search?q=" + encodeURIComponent(q));
      const data = await r.json();
      ((data && data.items) || []).forEach((it) => {
        if (!bag.some((b) => b.title === it.title)) bag.push(it);
      });
    } catch {}
    try {
      const wiki = await wikiSearch(q);
      wiki.forEach((w) => {
        if (!bag.some((b) => b.title === w.title)) bag.push(w);
      });
    } catch {}
    return bag.slice(0, goldAI() ? 12 : 6);
  }
  async function readArticle(link) {
    if (!link) return "";
    try {
      const r = await fetch("/api/read?url=" + encodeURIComponent(link));
      const d = await r.json();
      return String((d && d.text) || "").trim();
    } catch {}
    try {
      const r = await fetch("https://r.jina.ai/" + link);
      return String(await r.text()).replace(/\s+/g, " ").trim().slice(0, 2800);
    } catch {}
    return "";
  }
  async function readTop(items) {
    const top = (items || []).filter((x) => x && x.url).slice(0, goldAI() ? 6 : 3);
    const bodies = await Promise.all(
      top.map(async (it) => {
        const body = await readArticle(it.url);
        if (!body) return "";
        return "عنوان: " + it.title + "\n" + body.slice(0, goldAI() ? 1800 : 900);
      })
    );
    return bodies.filter(Boolean).join("\n\n----\n\n");
  }
  async function makeImage(prompt, signal) {
    try {
      const r = await fetch(imageUrl(prompt), { signal });
      if (r.ok) {
        const blob = await r.blob();
        if (blob && blob.size > 800) {
          return await new Promise((resolve) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.readAsDataURL(blob);
          });
        }
      }
    } catch {}
    try {
      const res = await fetch("https://api.cometapi.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + COMET_KEY },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: String(prompt || "cinematic photo").slice(0, 900),
          n: 1,
          size: "1024x1024",
        }),
        signal,
      });
      const data = await res.json();
      const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
      if (b64) return "data:image/png;base64," + b64;
      if (data && data.data && data.data[0] && data.data[0].url) return data.data[0].url;
    } catch {}
    try {
      const r = await fetch(imageUrl(prompt), { signal });
      if (r.ok) {
        const blob = await r.blob();
        if (blob && blob.size > 800) {
          return await new Promise((resolve) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.readAsDataURL(blob);
          });
        }
      }
    } catch {}
    return "";
  }
  async function persistImage(dataUrl) {
    if (!dataUrl) return { image: "" };
    if (!dataUrl.startsWith("data:") || dataUrl.length < 80000) return { image: dataUrl };
    try {
      if (window.ZIVV_MEDIA) {
        const raw = dataUrl.split(",")[1] || "";
        const bin = atob(raw);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const id = "aiimg_" + Date.now();
        await ZIVV_MEDIA.put(id, new Blob([arr], { type: "image/png" }));
        return { image: dataUrl, mediaId: id };
      }
    } catch {}
    return { image: dataUrl };
  }
  function watermark(src) {
    return new Promise((resolve) => {
      if (!src) return resolve("");
      const img = new Image();
      if (!/^data:|^blob:/i.test(String(src))) img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const label = "zivv. AI";
          const size = Math.max(26, Math.round(w * 0.048));
          ctx.font = "800 " + size + "px Segoe UI, Arial, sans-serif";
          const padX = Math.round(size * 0.62);
          const padY = Math.round(size * 0.42);
          const tw = ctx.measureText(label).width;
          const bw = tw + padX * 2;
          const bh = size + padY * 2;
          const x = w - Math.round(size * 0.55) - bw;
          const y = h - Math.round(size * 0.5) - bh;
          ctx.fillStyle = "rgba(0,0,0,.62)";
          ctx.beginPath();
          const r = Math.max(8, Math.round(size * 0.28));
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + bw, y, x + bw, y + bh, r);
          ctx.arcTo(x + bw, y + bh, x, y + bh, r);
          ctx.arcTo(x, y + bh, x, y, r);
          ctx.arcTo(x, y, x + bw, y, r);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(label, x + padX, y + bh / 2);
          resolve(c.toDataURL("image/jpeg", 0.9));
        } catch {
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }
  function getChat(id) {
    return read().find((c) => c.id === id) || null;
  }
  function saveChat(chat) {
    const list = read().filter((c) => c.id !== chat.id);
    list.unshift(chat);
    write(list.slice(0, 40));
    // Push to real database if available
    try {
      if (window.ZIVV_DB && ZIVV_DB.pushAiChat) {
        ZIVV_DB.pushAiChat(chat);
        // Also push messages
        const last = chat.messages && chat.messages[chat.messages.length - 1];
        if (last && ZIVV_DB.pushAiMessage) {
          ZIVV_DB.pushAiMessage(chat.id, { id: last.id || "aim_" + Date.now(), role: last.role, content: last.content, image: last.image || "", sources: last.sources || [], chatTitle: chat.title });
        }
      }
    } catch {}
  }
  function newChat() {
    const chat = { id: uid(), title: "دردشة جديدة", messages: [], at: now() };
    saveChat(chat);
    return chat;
  }

  function go(id) {
    activeId = id || "";
    const url = id ? "ai.html?id=" + encodeURIComponent(id) : "ai.html";
    history.replaceState({}, "", url);
    paint();
  }

  function plusBtn() {
    return `<button class="plus-new" id="btn-new" type="button" title="محادثة جديدة">+</button>`;
  }

  function liveOn() {
    return !!(window.ZIVV_ZIVVY && ZIVV_ZIVVY.isLive && ZIVV_ZIVVY.isLive());
  }

  function liveLine(compact) {
    const p = (window.ZIVV_ZIVVY && ZIVV_ZIVVY.prefs && ZIVV_ZIVVY.prefs()) || { gender: "female", speak: true };
    const on = liveOn();
    const gender = `<div class="voice-bar">
        <button type="button" data-voice="female" class="${p.gender !== "male" ? "on" : ""}">أنثى</button>
        <button type="button" data-voice="male" class="${p.gender === "male" ? "on" : ""}">ذكر</button>
        ${on ? `<button type="button" data-speak="${p.speak ? "off" : "on"}">${p.speak ? "صوت" : "صامت"}</button>` : ""}
      </div>`;
    if (on) {
      return `${compact ? "" : '<div class="live"><i></i> الدردشة المباشرة شغالة</div>'}
        <button class="live-mini on" id="btn-live-end" type="button">إنهاء اللايف</button>
        ${gender}`;
    }
    if (compact) {
      return `<button class="live-mini" id="btn-live" type="button">ابدأ الدردشة المباشرة</button>${gender}`;
    }
    return `<button class="live-start" id="btn-live" type="button">ابدأ الدردشة المباشرة</button>${gender}`;
  }

  function composer() {
    if (liveOn()) return "";
    return `<div class="attach-bar" id="attach-bar"></div>
    <form class="composer" id="send">
      <button class="tool" id="btn-file" type="button" title="رفع ملف">📎</button>
      <input id="ai-file" type="file" accept="image/*,.txt,.md,.csv,.json,text/plain" hidden />
      <textarea id="msg" rows="1" placeholder="اكتب الطلب… زيفي هيفهم لو بحث أو رسم أو تعديل"></textarea>
      <button class="send" id="go" type="submit">إرسال</button>
    </form>`;
  }

  function bindComposer() {
    const ta = document.getElementById("msg");
    const form = document.getElementById("send");
    if (ta) {
      ta.oninput = () => {
        ta.style.height = "42px";
        ta.style.height = Math.min(120, ta.scrollHeight) + "px";
      };
      setTimeout(() => ta.focus(), 50);
    }
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const v = ta.value.trim();
        if (!v && !pendingFiles.length) return;
        ta.value = "";
        ta.style.height = "42px";
        send(v || "شوف المرفق");
      };
    }
    const plus = document.getElementById("btn-new");
    if (plus) plus.onclick = () => {
      const q = quota();
      if (!q.gold && q.chatsLeft <= 0) {
        window.alert("خلصت الـ ١٠ محادثات اليوم. الذهبي يستخدم زيفي براحته.");
        return;
      }
      pendingFiles = [];
      go("");
    };
    const liveBtn = document.getElementById("btn-live");
    if (liveBtn && window.ZIVV_ZIVVY) liveBtn.onclick = () => ZIVV_ZIVVY.startLive();
    const liveEnd = document.getElementById("btn-live-end");
    if (liveEnd && window.ZIVV_ZIVVY) liveEnd.onclick = () => ZIVV_ZIVVY.stopLive();
    const bf = document.getElementById("btn-file");
    const fi = document.getElementById("ai-file");
    if (bf && fi) {
      bf.onclick = () => fi.click();
      fi.onchange = () => {
        const file = fi.files && fi.files[0];
        fi.value = "";
        if (file) addPendingFile(file);
      };
    }
    paintAttach();
    document.querySelectorAll(".voice-bar button[data-voice]").forEach((b) => {
      b.onclick = () => {
        if (!window.ZIVV_ZIVVY) return;
        const cur = ZIVV_ZIVVY.prefs();
        ZIVV_ZIVVY.savePrefs({ gender: b.getAttribute("data-voice"), speak: true });
        document.querySelectorAll(".voice-bar button[data-voice]").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
      };
    });
    const sp = document.querySelector(".voice-bar button[data-speak]");
    if (sp && window.ZIVV_ZIVVY) {
      sp.onclick = () => {
        const cur = ZIVV_ZIVVY.prefs();
        const next = !cur.speak;
        ZIVV_ZIVVY.savePrefs({ gender: cur.gender, speak: next });
        sp.textContent = next ? "صوت" : "صامت";
        if (!next && ZIVV_ZIVVY.stopVoice) ZIVV_ZIVVY.stopVoice();
      };
    }
  }

  function paintWelcome() {
    root.innerHTML = `
      <div class="page-bar">
        <span class="key-left" style="visibility:hidden">مفتاح</span>
        <div class="bar-mid">
          <h1>زيفي</h1>
          ${liveLine()}
        </div>
        ${plusBtn()}
      </div>
      <div class="hero">
        <div class="ava"><img src="brand/logo-sm.png" alt=""></div>
        <h2>أهلاً ${esc(meName())}</h2>
        <p class="mute">${esc(quotaLine())}</p>
      </div>
      <div class="chips">
        ${STARTERS.map((s) => `<button class="chip" type="button">${esc(s)}</button>`).join("")}
      </div>
      ${composer()}`;
    root.querySelectorAll(".chip").forEach((b) => {
      b.onclick = () => send(b.textContent);
    });
    bindComposer();
  }

  function paintThread() {
    const chat = getChat(activeId);
    if (!chat) {
      go("");
      return;
    }
    root.innerHTML = `
      <div class="page-bar">
        <span class="key-left" style="visibility:hidden">مفتاح</span>
        <div class="bar-mid">
          <div class="who" style="margin:0;justify-content:center">
            <div class="ava"><img src="brand/logo-sm.png" alt=""></div>
            <div>
              <h1>زيفي</h1>
              <div class="mute">${esc(chat.title || "محادثة")}</div>
              ${liveLine(true)}
            </div>
          </div>
        </div>
        ${plusBtn()}
      </div>
      <div class="thread" id="thread"></div>
      ${composer()}`;
    drawMessages(chat);
    bindComposer();
  }

  function drawMessages(chat, extra) {
    const box = document.getElementById("thread");
    if (!box) return;
    const msgs = chat.messages || [];
    box.innerHTML =
      msgs
        .map((m) => {
          const mine = m.role === "user";
          const img = m.mediaId
            ? `<div class="gen-wrap"><img class="gen" data-media="${esc(m.mediaId)}" alt=""><span class="wm">zivv. AI</span><button class="dl-img" type="button" data-media="${esc(m.mediaId)}">تحميل</button></div>`
            : m.image
              ? `<div class="gen-wrap"><img class="gen" src="${esc(m.image)}" alt=""><span class="wm">zivv. AI</span><button class="dl-img" type="button" data-src="1">تحميل</button></div>`
              : "";
          const files = (m.files || [])
            .map((f) =>
              f.kind === "image"
                ? `<div class="gen-wrap"><img class="gen" src="${esc(f.data)}" alt=""><span class="wm">مرفق</span></div>`
                : `<div class="file-chip">ملف: ${esc(f.name || "نص")}</div>`
            )
            .join("");
          const srcs = (m.sources || [])
            .slice(0, 5)
            .map((s) => `<a class="src" href="${esc(s.url || "#")}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a>`)
            .join("");
          return `<div class="bubble ${mine ? "me" : "them"}">${md(m.content || "")}${files}${img}${
            srcs ? `<div class="srcs">${srcs}</div>` : ""
          }</div>`;
        })
        .join("") + (extra || "");
    if (window.ZIVV_MEDIA) ZIVV_MEDIA.hydrate(box);
    box.querySelectorAll(".dl-img").forEach((b) => {
      b.onclick = () => downloadAiImage(b);
    });
    box.scrollTop = box.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
  }

  function downloadAiImage(btn) {
    const wrap = btn.closest(".gen-wrap");
    const img = wrap && wrap.querySelector("img.gen");
    const mid = btn.getAttribute("data-media");
    const run = async () => {
      if (mid && window.ZIVV_MEDIA && ZIVV_MEDIA.get) {
        const blob = await ZIVV_MEDIA.get(mid);
        if (blob && window.ZIVV_CORE && ZIVV_CORE.saveFile) {
          ZIVV_CORE.saveFile(URL.createObjectURL(blob), "zivv-ai.png");
          return;
        }
      }
      const src = img && img.src;
      if (src && window.ZIVV_CORE && ZIVV_CORE.saveFile) ZIVV_CORE.saveFile(src, "zivv-ai.jpg");
    };
    run();
  }

  function paintAttach() {
    const bar = document.getElementById("attach-bar");
    if (!bar) return;
    if (!pendingFiles.length) {
      bar.innerHTML = "";
      bar.classList.remove("on");
      return;
    }
    bar.classList.add("on");
    bar.innerHTML = pendingFiles
      .map((f, i) => {
        const thumb = f.kind === "image" ? `<img src="${esc(f.data)}" alt="">` : "<span>TXT</span>";
        return `<div class="att">${thumb}<b>${esc(f.name)}</b><button type="button" data-x="${i}">✕</button></div>`;
      })
      .join("");
    bar.querySelectorAll("[data-x]").forEach((b) => {
      b.onclick = () => {
        pendingFiles.splice(Number(b.getAttribute("data-x")), 1);
        paintAttach();
      };
    });
  }

  function readAsData(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }
  function readAsText(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = reject;
      fr.readAsText(file);
    });
  }
  function compressData(dataUrl, max) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.86));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }
  async function addPendingFile(file) {
    if (!file) return;
    const name = file.name || "ملف";
    if (/image\//i.test(file.type)) {
      const raw = await readAsData(file);
      const data = await compressData(raw, 1280);
      pendingFiles.push({ kind: "image", name, data, mime: "image/jpeg" });
    } else {
      const text = (await readAsText(file)).slice(0, 18000);
      pendingFiles.push({ kind: "text", name, text });
    }
    paintAttach();
  }

  async function editImage(dataUrl, prompt, signal) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const fd = new FormData();
      fd.append("model", "gpt-image-1");
      fd.append("prompt", String(prompt || "edit this image").slice(0, 900));
      fd.append("size", "1024x1024");
      fd.append("image", blob, "edit.jpg");
      const res = await fetch("https://api.cometapi.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: "Bearer " + COMET_KEY },
        body: fd,
        signal,
      });
      const data = await res.json().catch(() => ({}));
      const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
      if (b64) return "data:image/png;base64," + b64;
      if (data && data.data && data.data[0] && data.data[0].url) return data.data[0].url;
    } catch {}
    return makeImage(prompt, signal);
  }

  function setBusy(on) {
    const go = document.getElementById("go");
    if (!go) return;
    if (on) {
      const btn = document.createElement("button");
      btn.className = "stop";
      btn.id = "go";
      btn.type = "button";
      btn.textContent = "إيقاف";
      btn.onclick = () => {
        if (abort) abort.abort();
      };
      go.replaceWith(btn);
    } else {
      go.className = "send";
      go.type = "submit";
      go.textContent = "إرسال";
      go.onclick = null;
    }
  }

  function friendlyError(err) {
    const raw = String((err && err.message) || err || "");
    if (err && err.name === "AbortError") return "";
    if (/failed to fetch|networkerror|load failed/i.test(raw)) {
      return "السيرفر مش واصل. افتح الصفحة من سيرفر ZIVV مش من ملف فاضي.";
    }
    if (/429|queue full/i.test(raw)) {
      return "الكوتة خلصت لدقيقة. استنى شوية وارجع ابعت.";
    }
    if (/HTTP 404|not found/i.test(raw)) {
      return "مفيش وصلة /api/ai. شغّل سيرفر ZIVV.";
    }
    return "الشبكة قطعت لحظة. ابعت الرسالة تاني.";
  }

  async function send(text) {
    const files = pendingFiles.slice();
    pendingFiles = [];
    paintAttach();
    let chat = activeId ? getChat(activeId) : null;
    if (!chat) {
      const q0 = quota();
      if (!q0.gold && q0.chatsLeft <= 0) {
        window.alert("خلصت الـ ١٠ محادثات اليوم. كل محادثة ساعة. الذهبي من غير حد.");
        pendingFiles = files;
        paintAttach();
        return;
      }
      chat = newChat();
      if (window.ZIVV_CREATOR && ZIVV_CREATOR.aiStartChat) ZIVV_CREATOR.aiStartChat(chat.id, "chat");
      chat.title = titleFrom(text);
      saveChat(chat);
      activeId = chat.id;
      history.replaceState({}, "", "ai.html?id=" + encodeURIComponent(chat.id));
      paintThread();
    } else {
      const left = window.ZIVV_CREATOR && ZIVV_CREATOR.aiChatLeft && ZIVV_CREATOR.aiChatLeft(chat.id);
      if (left && !left.ok && left.reason === "expired") {
        window.alert("المحادثة دي خلصت ساعتها. ابدأ محادثة جديدة من +");
        return;
      }
      if (left && !left.ok && left.reason === "missing") {
        const start = window.ZIVV_CREATOR && ZIVV_CREATOR.aiStartChat;
        const gate = start ? start(chat.id, "chat") : { ok: true };
        if (!gate.ok && gate.reason === "limit") {
          window.alert("خلصت الـ ١٠ محادثات اليوم. الذهبي من غير حد.");
          return;
        }
      }
      if (chat.title === "دردشة جديدة") chat.title = titleFrom(text);
    }
    const shownFiles = files.map((f) =>
      f.kind === "image" ? { kind: "image", name: f.name, data: f.data } : { kind: "text", name: f.name }
    );
    chat.messages.push({ role: "user", content: text, files: shownFiles, at: now() });
    chat.at = now();
    saveChat(chat);
    if (!document.getElementById("thread")) paintThread();
    const imgFile = files.find((f) => f.kind === "image");
    const textFiles = files.filter((f) => f.kind === "text");
    const needSearch = wantsSearch(text);
    const needEdit = !!(imgFile && (wantsEdit(text) || wantsImage(text)));
    const needImage = !needEdit && wantsImage(text);
      drawMessages(
      chat,
      `<div class="bubble them"><div class="typing"><i></i><i></i><i></i></div><div class="mute">${
        needEdit ? "بعدّل الصورة…" : needImage ? "برسم صورة حقيقية…" : needSearch ? "بدور على النت دلوقتي…" : "بيفكر…"
      }</div></div>`
    );
    setBusy(true);

    abort = new AbortController();
    try {
      if (window.ZIVV_ZIVVY && ZIVV_ZIVVY.doSiteAction) {
        const acted = ZIVV_ZIVVY.doSiteAction(text);
        if (acted) {
          chat = getChat(activeId) || chat;
          chat.messages.push({ role: "assistant", content: acted, at: now() });
          saveChat(chat);
          drawMessages(chat);
          if (liveOn()) ZIVV_ZIVVY.speak(acted);
          setBusy(false);
          abort = null;
          return;
        }
      }
      let ask = text;
      let sources = [];
      if (textFiles.length) {
        ask +=
          "\n\nالملفات النصية المرفقة:\n" +
          textFiles.map((f) => "--- " + f.name + " ---\n" + f.text).join("\n\n");
      }
      if (imgFile && !needEdit && !needImage) {
        ask += "\n\nالمستخدم رفع صورة. اوصفها أو نفّذ طلبه عليها من غير ما تلفق تفاصيل مش ظاهرة.";
      }
      if (needSearch) {
        sources = await webSearch(text.replace(/^\s*ابحث\s*:?\s*/i, ""));
        drawMessages(
          chat,
          `<div class="bubble them"><div class="mute">لقيت ${sources.length} مصادر… بقرأ المقالات دلوقتي.</div></div>`
        );
        const articles = await readTop(sources);
        const found = formatHits(sources);
        if (articles || found) {
          ask =
            text +
            "\n\nاقرأ المقالات دي وجاوب بنفسك بالمصري: النتيجة، الخبر، الأرقام. متبعتش المستخدم للرابط.\n\n" +
            (articles || found);
        } else {
          ask = text + "\n\nمفيش مقالات اتقريت. قول إن البحث فشل ومتلفقش نتيجة.";
        }
      }
      const forModel = chat.messages.slice();
      if (ask !== text) forModel[forModel.length - 1] = Object.assign({}, forModel[forModel.length - 1], { content: ask });
      if (imgFile) forModel[forModel.length - 1].image = imgFile.data;
      const got = await complete(forModel, abort.signal);
      const reply = typeof got === "string" ? got : (got && got.text) || "";
      if (got && got.sources && got.sources.length) {
        got.sources.forEach((s) => {
          if (!sources.some((x) => x.title === s.title)) sources.push(s);
        });
      }
      let image = "";
      let mediaId = "";
      if ((needImage || needEdit) && window.ZIVV_CREATOR && ZIVV_CREATOR.aiUseImage) {
        const slot = ZIVV_CREATOR.aiUseImage();
        if (!slot.ok) {
          chat = getChat(activeId) || chat;
          chat.messages.push({
            role: "assistant",
            content: (reply || "") + (reply ? "\n\n" : "") + "خلصت الـ ١٠ صور اليوم. الذهبي يولّد صور من غير حد.",
            at: now(),
          });
          saveChat(chat);
          drawMessages(chat);
          setBusy(false);
          abort = null;
          return;
        }
      }
      if (needImage || needEdit) {
        drawMessages(
          chat,
          `<div class="bubble them">${md(reply || "")}<div class="mute">${needEdit ? "بعدّل الصورة…" : "برسم صورة حقيقية… حوالي ٣٠ ثانية."}</div></div>`
        );
        const rawImg = needEdit && imgFile
          ? await editImage(imgFile.data, text, abort.signal)
          : await makeImage(text.replace(/^\s*ارسم\s*:?\s*/i, ""), abort.signal);
        if (rawImg) {
          const marked = await watermark(rawImg);
          const saved = await persistImage(marked || rawImg);
          image = saved.image || marked || rawImg;
          mediaId = saved.mediaId || "";
        }
      }
      chat = getChat(activeId) || chat;
      const msg = { role: "assistant", content: reply, image: "", mediaId, sources, at: now() };
      chat.messages.push(msg);
      chat.at = now();
      try {
        saveChat(chat);
      } catch {}
      if (image) msg.image = image;
      drawMessages(chat);
      if (window.ZIVV_ZIVVY && reply && liveOn()) ZIVV_ZIVVY.speak(reply);
    } catch (err) {
      chat = getChat(activeId) || chat;
      const note = friendlyError(err);
      drawMessages(chat, note ? `<p class="err">${esc(note)}</p>` : "");
    } finally {
      abort = null;
      setBusy(false);
    }
  }

  function toOpenAI(messages) {
    const extra = goldAI()
      ? " الحساب ده ذهبي: جاوب أسرع وبتركيز، وقدّم تفاصيل أكتر وجودة أعلى."
      : "";
    const keep = goldAI() ? 28 : 12;
    const cut = goldAI() ? 7000 : 2800;
    return [{ role: "system", content: SYSTEM + extra + " المستخدم اسمه " + meName() + "." }].concat(
      messages
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
        .slice(-keep)
        .map((m) => ({ role: m.role, content: String(m.content).slice(0, cut), image: m.image || "" }))
    );
  }

  function extractText(data) {
    if (data == null) return "";
    if (typeof data === "string") {
      const t = data.trim();
      if (t.startsWith("{") || t.startsWith("[")) {
        try {
          return extractText(JSON.parse(t));
        } catch {
          return t;
        }
      }
      return t;
    }
    const choice = data.choices && data.choices[0];
    if (choice && choice.message && choice.message.content) return String(choice.message.content);
    if (choice && choice.text) return String(choice.text);
    const parts =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts;
    if (Array.isArray(parts)) {
      const t = parts.map((p) => p.text || "").join("").trim();
      if (t) return t;
    }
    if (typeof data.content === "string") return data.content;
    if (typeof data.text === "string") return data.text;
    if (typeof data.response === "string") return data.response;
    if (data.error) return "";
    return "";
  }

  function mergeSignal(external, ms) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    if (external) {
      if (external.aborted) c.abort();
      else external.addEventListener("abort", () => c.abort(), { once: true });
    }
    return {
      signal: c.signal,
      clear() {
        clearTimeout(t);
      },
    };
  }

  async function postJSON(url, body, ms, userSignal) {
    const gate = mergeSignal(userSignal, ms);
    try {
      const headers = { "Content-Type": "application/json" };
      if (url.indexOf("cometapi.com") >= 0) headers["Authorization"] = "Bearer " + COMET_KEY;
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: gate.signal,
      });
      const raw = await res.text();
      let data = raw;
      try {
        data = JSON.parse(raw);
      } catch {}
      if (!res.ok) {
        const msg =
          (data && data.error && (data.error.message || data.error)) ||
          raw.slice(0, 160) ||
          "HTTP " + res.status;
        throw new Error(String(msg));
      }
      return data;
    } finally {
      gate.clear();
    }
  }

  async function callCometDirect(messages, userSignal) {
    const packed = toOpenAI(messages);
    const sys = packed.find((m) => m.role === "system");
    const contents = packed
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content) }],
      }));
    const payload = {
      contents: contents.length ? contents : [{ parts: [{ text: "مرحبا" }] }],
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: goldAI() ? 8192 : 3072 },
    };
    if (sys) payload.systemInstruction = { parts: [{ text: String(sys.content) }] };
    const gate = mergeSignal(userSignal, goldAI() ? 28000 : 45000);
    try {
      const res = await fetch(
        "https://api.cometapi.com/v1beta/models/" + encodeURIComponent(COMET_MODEL) + ":generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": COMET_KEY },
          body: JSON.stringify(payload),
          signal: gate.signal,
        }
      );
      const data = await res.json().catch(() => ({}));
      const text = extractText(data);
      const grounded = [];
      const chunks =
        (data.candidates && data.candidates[0] && data.candidates[0].groundingMetadata &&
          data.candidates[0].groundingMetadata.groundingChunks) ||
        (data.groundingMetadata && data.groundingMetadata.groundingChunks) ||
        [];
      chunks.forEach((c) => {
        const w = c && c.web;
        if (w && (w.title || w.uri)) grounded.push({ title: w.title || w.uri, url: w.uri || "" });
      });
      if (text) return { text, sources: grounded };
      if (!res.ok) throw new Error((data.error && data.error.message) || "HTTP " + res.status);
    } finally {
      gate.clear();
    }
    const chat = await postJSON(
      "https://api.cometapi.com/v1/chat/completions",
      { model: COMET_MODEL, messages: packed, stream: false, max_tokens: 4096 },
      40000,
      userSignal
    );
    const t2 = extractText(chat);
    return t2 ? { text: t2, sources: [] } : null;
  }

  async function complete(messages, userSignal) {
    try {
      const got = await callCometDirect(messages, userSignal);
      if (got && got.text) return got;
      if (typeof got === "string" && got.trim()) return { text: got.trim(), sources: [] };
    } catch (e) {
      if (e && e.name === "AbortError" && userSignal && userSignal.aborted) throw e;
    }
    try {
      const data = await postJSON(
        "/api/ai",
        { messages: toOpenAI(messages), provider: "cometapi", model: COMET_MODEL },
        40000,
        userSignal
      );
      const t = String(extractText(data) || "").trim();
      if (t) return { text: t, sources: [] };
    } catch (e) {
      if (e && e.name === "AbortError" && userSignal && userSignal.aborted) throw e;
    }
    throw new Error("no reply");
  }

  function paint() {
    if (activeId) paintThread();
    else paintWelcome();
  }

  window.addEventListener("zivv-ai-chats", (e) => {
    const removed = e.detail && e.detail.removed;
    if (removed && removed === activeId) go("");
  });
  window.addEventListener("zivv-live", () => paint());

  window.ZIVV_AI = {
    open(id) {
      go(id);
    },
    fresh() {
      go("");
    },
  };

  paint();
})();
