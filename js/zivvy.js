(function () {
  if (window.ZIVV_ZIVVY) return;

  const PREF = "zivv.zivvy";
  const LIVE = "zivv.live";
  const LIVE_ID = "zivv.liveChatId";
  const CHATS = "zivv.aiChats";
  const COMET_KEY = "sk-vSJCr2yYYijxwTpLdBHf3sOprMRZoj7OOn4DUh9Blvz50hGG";
  const COMET_MODEL = "gemini-3.6-flash";

  let ctx = null;
  let playing = null;
  let speakAbort = null;
  let hueRaf = 0;
  let hueT = 0;
  let listening = false;
  let busy = false;
  let micStream = null;
  let analyser = null;
  let vadRaf = 0;
  let recorder = null;
  let recChunks = [];
  let voiced = false;
  let silentMs = 0;
  let voicedMs = 0;
  let recStart = 0;
  let lastVad = 0;

  function prefs() {
    try {
      return Object.assign({ gender: "female", speak: true }, JSON.parse(localStorage.getItem(PREF) || "{}"));
    } catch {
      return { gender: "female", speak: true };
    }
  }
  function savePrefs(next) {
    localStorage.setItem(PREF, JSON.stringify(next));
  }
  function isLive() {
    return sessionStorage.getItem(LIVE) === "1";
  }

  function ensureCss() {
    if (!document.querySelector('link[href*="zivvy.css"]')) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "css/zivvy.css?v=18";
      document.head.appendChild(l);
    }
  }

  function ensureCtx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function setTalk(on) {
    const halo = document.querySelector(".zivvy-halo");
    if (halo) halo.classList.toggle("talk", !!on);
  }

  function stopVoice() {
    if (speakAbort) {
      try {
        speakAbort.abort();
      } catch {}
      speakAbort = null;
    }
    if (playing) {
      try {
        playing.stop();
      } catch {}
      playing = null;
    }
    setTalk(false);
  }

  function cleanSpeak(text) {
    return String(text || "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[#*_`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 420);
  }

  async function fetchSpeech(text, gender, signal) {
    const female = gender !== "male";
    const body = {
      model: "gpt-4o-mini-tts",
      input: text,
      voice: female ? "coral" : "onyx",
      response_format: "mp3",
      speed: 0.96,
      instructions: female
        ? "You are Zivvy, the ZIVV companion. Speak clear Egyptian Arabic. Warm young woman. Every word must be understandable. Not rushed."
        : "You are Zivvy, the ZIVV companion. Speak clear Egyptian Arabic. Calm adult man. Every word must be understandable. Not rushed.",
    };
    let res = await fetch("https://api.cometapi.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + COMET_KEY },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      res = await fetch("https://api.cometapi.com/v1/audio/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + COMET_KEY },
        body: JSON.stringify({
          model: "tts-1-hd",
          input: text,
          voice: female ? "nova" : "onyx",
          response_format: "mp3",
          speed: 0.96,
        }),
        signal,
      });
    }
    if (!res.ok) throw new Error("tts " + res.status);
    return await res.blob();
  }

  async function playBlob(blob) {
    const ac = ensureCtx();
    if (!ac) throw new Error("no audio");
    const arr = await blob.arrayBuffer();
    const buf = await ac.decodeAudioData(arr.slice(0));
    const src = ac.createBufferSource();
    const gain = ac.createGain();
    src.buffer = buf;
    gain.gain.value = 1;
    src.connect(gain);
    gain.connect(ac.destination);
    playing = src;
    await new Promise((resolve) => {
      src.onended = () => {
        if (playing === src) playing = null;
        setTalk(false);
        resolve();
      };
      src.start();
    });
  }

  async function speak(text) {
    const p = prefs();
    if (!p.speak || !isLive()) return;
    const clean = cleanSpeak(text);
    if (!clean) return;
    stopVoice();
    const ac = ensureCtx();
    if (!ac) return;
    speakAbort = new AbortController();
    const signal = speakAbort.signal;
    setTalk(true);
    try {
      const blob = await fetchSpeech(clean, p.gender, signal);
      if (signal.aborted) return;
      await playBlob(blob);
    } catch (e) {
      if (e && e.name === "AbortError") return;
      setTalk(false);
    }
  }

  function spinHue() {
    const halo = document.querySelector(".zivvy-halo");
    if (!halo || !halo.classList.contains("on")) {
      hueRaf = 0;
      return;
    }
    hueT += 0.45;
    halo.style.setProperty("--zivvy-hue", (hueT % 360) + "deg");
    hueRaf = requestAnimationFrame(spinHue);
  }

  function readChats() {
    try {
      const v = JSON.parse(localStorage.getItem(CHATS) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  function writeChats(list) {
    localStorage.setItem(CHATS, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("zivv-ai-chats"));
  }
  function liveChat() {
    let id = sessionStorage.getItem(LIVE_ID);
    const list = readChats();
    let chat = list.find((c) => c.id === id);
    if (!chat) {
      chat = { id: "live_" + Date.now(), title: "لايف زيفي", messages: [], at: Date.now(), live: true };
      list.unshift(chat);
      writeChats(list.slice(0, 40));
      sessionStorage.setItem(LIVE_ID, chat.id);
    }
    return chat;
  }
  function saveLive(chat) {
    const list = readChats().filter((c) => c.id !== chat.id);
    list.unshift(chat);
    writeChats(list.slice(0, 40));
  }

  function setListenUi(on) {
    listening = !!on;
    const halo = document.querySelector(".zivvy-halo");
    if (halo) halo.classList.toggle("listen", listening);
  }

  function stopRecorder() {
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      } catch {}
    }
    recorder = null;
    recChunks = [];
    voiced = false;
    silentMs = 0;
    voicedMs = 0;
  }

  function killMic() {
    if (vadRaf) cancelAnimationFrame(vadRaf);
    vadRaf = 0;
    stopRecorder();
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    analyser = null;
    setListenUi(false);
  }

  function rms() {
    if (!analyser) return 0;
    const arr = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(arr);
    let s = 0;
    for (let i = 0; i < arr.length; i++) {
      const v = (arr[i] - 128) / 128;
      s += v * v;
    }
    return Math.sqrt(s / arr.length);
  }

  function recMime() {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    for (let i = 0; i < types.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return "";
  }

  function beginRec() {
    if (!micStream || recorder || busy || playing) return;
    recChunks = [];
    recStart = Date.now();
    voiced = true;
    silentMs = 0;
    const mime = recMime();
    try {
      recorder = mime ? new MediaRecorder(micStream, { mimeType: mime }) : new MediaRecorder(micStream);
    } catch {
      recorder = null;
      return;
    }
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) recChunks.push(e.data);
    };
    recorder.start();
  }

  async function finishRec() {
    if (!recorder) return;
    const recd = recorder;
    recorder = null;
    voiced = false;
    const blob = await new Promise((resolve) => {
      recd.onstop = () => resolve(new Blob(recChunks, { type: recd.mimeType || "audio/webm" }));
      try {
        recd.stop();
      } catch {
        resolve(null);
      }
    });
    recChunks = [];
    if (!blob || blob.size < 2500 || !isLive() || busy) return;
    const said = await transcribe(blob);
    if (said) ask(said);
  }

  async function transcribe(blob) {
    try {
      const fd = new FormData();
      fd.append("file", blob, "live.webm");
      fd.append("model", "whisper-1");
      fd.append("language", "ar");
      const r = await fetch("https://api.cometapi.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: "Bearer " + COMET_KEY },
        body: fd,
      });
      const d = await r.json().catch(() => ({}));
      const t = String(d.text || "").trim();
      if (!t) return "";
      if (/اشترك|القناة|subscribe|thanks for watching/i.test(t) && t.length < 42) return "";
      return t;
    } catch {
      return "";
    }
  }

  function vadLoop(ts) {
    if (!isLive()) return;
    vadRaf = requestAnimationFrame(vadLoop);
    if (busy || playing || !analyser) return;
    const now = ts || performance.now();
    const dt = lastVad ? Math.min(80, now - lastVad) : 16;
    lastVad = now;
    const lv = rms();
    if (lv > 0.038) {
      silentMs = 0;
      voicedMs += dt;
      if (!voiced && voicedMs > 160) beginRec();
    } else {
      voicedMs = Math.max(0, voicedMs - dt * 0.4);
      if (voiced) {
        silentMs += dt;
        if (silentMs > 700 && Date.now() - recStart > 550) finishRec();
      }
    }
    if (voiced && Date.now() - recStart > 12000) finishRec();
  }

  async function openMic() {
    if (micStream && micStream.active) return micStream;
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const ac = ensureCtx();
    const src = ac.createMediaStreamSource(micStream);
    analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    return micStream;
  }

  async function startListen() {
    if (!isLive() || busy) return;
    try {
      await openMic();
    } catch {
      return;
    }
    setListenUi(true);
    lastVad = 0;
    voiced = false;
    silentMs = 0;
    voicedMs = 0;
    if (!vadRaf) vadRaf = requestAnimationFrame(vadLoop);
  }

  function extractPerson(text) {
    if (!window.ZIVV_CORE) return null;
    const at = String(text || "").match(/@([a-zA-Z0-9_\.]{2,20})/);
    if (at) {
      const u = at[1].toLowerCase();
      return (
        (ZIVV_CORE.PEOPLE || []).find((p) => p.user === u) ||
        ZIVV_CORE.searchPeople(u)[0] || { user: u, name: u }
      );
    }
    const list = (ZIVV_CORE.peopleForShare && ZIVV_CORE.peopleForShare()) || ZIVV_CORE.PEOPLE || [];
    const blob = ZIVV_CORE.norm(text);
    return list.find((p) => blob.includes(ZIVV_CORE.norm(p.user)) || blob.includes(ZIVV_CORE.norm(p.name))) || null;
  }

  function searchKindFrom(text) {
    if (/صور|صورة|photo/.test(text)) return "photo";
    if (/فيديو|فديو|ريل|شورت/.test(text)) return "video";
    if (/منتج|متجر/.test(text)) return "product";
    if (/هاشتاج|وسم|#/.test(text)) return "hashtag";
    if (/شخص|ناس|حساب/.test(text)) return "person";
    if (/موسيقى|اغني/.test(text)) return "music";
    return "post";
  }

  function queryFrom(text) {
    return String(text || "")
      .replace(/^(ابحث|دور|فتش|افتح|وريني|روحي|روح|وديني)\s*/i, "")
      .replace(/جوه التطبيق|في التطبيق|على التطبيق/g, "")
      .replace(/عن\s+/g, "")
      .replace(/صور(?:ة)?|فيديوه?ات?|منتجات?|هاشتاج(?:ات)?|منشور(?:ات)?|أشخاص|شخص/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function goLater(url) {
    setTimeout(() => {
      location.href = url;
    }, 850);
  }

  function doSiteAction(text) {
    if (!window.ZIVV_CORE) return null;
    const t = String(text || "");
    if (!/(ابعت|ابعثي|اطلب|انشر|انزلي|افتح|وريني|روحي|روح|وديني|ضيف|دور|ابحث|فتش|قول|كلمي|كلم)/.test(t)) {
      return null;
    }

    if (/صداق/.test(t)) {
      const who = extractPerson(t);
      if (!who) return "قول اسم الشخص أو @اليوزر عشان أبعت طلب صداقة.";
      ZIVV_CORE.sendFriendRequest(who.user, who.name);
      return "اتبعت طلب صداقة لـ @" + who.user + " من حسابك.";
    }

    if (/(ابعت|ابعثي|قول|كلمي|كلم).*(رسال|ل|لك)|ابعت ل|ابعثي ل/.test(t) && !/صداق/.test(t)) {
      const who = extractPerson(t);
      if (!who) return "قول لمين أبعت الرسالة.";
      const me = ZIVV_CORE.author ? ZIVV_CORE.author().user : "";
      if (!ZIVV_CORE.areFriends(me, who.user)) {
        return "مقدرش أبعت رسالة غير بعد ما تبقوا أصدقاء. اطلب صداقة من حسابه الأول.";
      }
      let body = t
        .replace(/^(ابعتي?|قولي?|كلمي?)\s*(رسالة)?\s*/i, "")
        .replace(new RegExp(who.name, "ig"), "")
        .replace("@" + who.user, "")
        .replace(/^(ل|لك|إلى)\s*/i, "")
        .replace(/^[:：،,]\s*/, "")
        .trim();
      if (!body) return "قول نص الرسالة.";
      ZIVV_CORE.sendMessage(who.user, { text: body, kind: "text" });
      return "اتبعتت الرسالة لـ @" + who.user + ".";
    }

    if (/انشر|انزلي منشور|انزل منشور/.test(t) && !/افتح/.test(t)) {
      const body = t.replace(/^[\s\S]*?(?:انشر|انزلي منشور|انزل منشور)\s*:?\s*/i, "").trim() || t;
      const made = ZIVV_CORE.addPost({ text: body, type: "text", tags: "عام" });
      if (made && made.blocked) return made.note || "المنشور اترفض.";
      return "المنشور اتنشر على حسابك.";
    }

    if (/(دور|ابحث|فتش|وريني منشور|افتح البحث)/.test(t)) {
      const kind = searchKindFrom(t);
      const q = queryFrom(t);
      const hits = ZIVV_CORE.search(q, kind).slice(0, 5);
      const names = hits
        .map((h) => {
          if (h.kind === "hashtag") return "#" + h.item.tag;
          if (h.kind === "person") return "@" + h.item.user;
          if (h.kind === "product") return h.item.title;
          return (h.item.title || h.item.text || "").slice(0, 40);
        })
        .filter(Boolean);
      goLater("search.html?k=" + encodeURIComponent(kind) + (q ? "&q=" + encodeURIComponent(q) : ""));
      if (!hits.length) return "بفتح البحث جوّه التطبيق. مفيش نتيجة مطابقة لسه.";
      return "لقيت " + hits.length + " جوّه ZIVV: " + names.join(" · ") + ". بفتح صفحة البحث.";
    }

    if (/افتح|وريني|روحي|روح|وديني/.test(t)) {
      if (/نشر/.test(t)) {
        goLater("publish.html");
        return "بفتح صفحة النشر.";
      }
      if (/دردش|محادث|شات|chat/.test(t)) {
        const who = extractPerson(t);
        if (who) {
          goLater("chat.html?u=" + encodeURIComponent(who.user));
          return "بفتح الدردشة مع @" + who.user;
        }
        goLater("chat.html");
        return "بفتح صفحة الدردشة.";
      }
      if (/خاص/.test(t)) {
        goLater("private.html");
        return "بفتح الدردشة الخاصة.";
      }
      if (/حساب|بروفايل|ملف/.test(t)) {
        const who = extractPerson(t);
        if (who) {
          goLater("profile.html?u=" + encodeURIComponent(who.user));
          return "بفتح حساب @" + who.user;
        }
        goLater("profile.html");
        return "بفتح حسابك.";
      }
      if (/منتج|متجر/.test(t)) {
        goLater("store.html");
        return "بفتح المتجر.";
      }
      if (/استكشف|اكتشف/.test(t)) {
        goLater("explore.html");
        return "بفتح استكشف.";
      }
      if (/شريط|ريل/.test(t)) {
        goLater("reels.html");
        return "بفتح الشريط.";
      }
      if (/أصحاب|اصدق|أصدق/.test(t)) {
        goLater("friends.html");
        return "بفتح الأصدقاء.";
      }
      if (/إشعار|اشعار/.test(t)) {
        goLater("alerts.html");
        return "بفتح الإشعارات.";
      }
      if (/موسيقى|مزيكا/.test(t)) {
        goLater("music.html");
        return "بفتح الموسيقى.";
      }
      if (/حالات|ستوري/.test(t)) {
        goLater("stories.html");
        return "بفتح الحالات.";
      }
      if (/إعداد|اعداد/.test(t)) {
        goLater("settings.html");
        return "بفتح الإعدادات.";
      }
      if (/بحث/.test(t)) {
        goLater("search.html");
        return "بفتح البحث.";
      }
      if (/رئيس|هوم|home/.test(t)) {
        goLater("home.html");
        return "بفتح الرئيسية.";
      }
    }
    return null;
  }

  async function completeShort(messages) {
    const packed = [
      {
        role: "system",
        content:
          "أنت زيفي داخل تطبيق ZIVV. رد بالمصري المختصر (جملة أو جملتين) عشان الكلام يتقال صوت. " +
          "ما تنفّذيش حاجة في الموقع من نفسك. لو المستخدم طلب تنفيذ، قول إنك هتنفذي لما يطلب بصيغة أمر. " +
          "اسمك زيفي. ممنوع محتوى إجرامي أو لقاصرين.",
      },
    ].concat(
      messages
        .filter((m) => m && m.content)
        .slice(-8)
        .map((m) => ({ role: m.role, content: String(m.content).slice(0, 1200) }))
    );
    const contents = packed
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
    const res = await fetch(
      "https://api.cometapi.com/v1beta/models/" + encodeURIComponent(COMET_MODEL) + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": COMET_KEY },
        body: JSON.stringify({
          contents: contents.length ? contents : [{ parts: [{ text: "مرحبا" }] }],
          systemInstruction: { parts: [{ text: packed[0].content }] },
          generationConfig: { maxOutputTokens: (window.ZIVV_CREATOR && ZIVV_CREATOR.isGoldUser && ZIVV_CREATOR.isGoldUser()) ? 1400 : 420 },
        }),
      }
    );
    const data = await res.json().catch(() => ({}));
    const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const text = Array.isArray(parts) ? parts.map((p) => p.text || "").join("").trim() : "";
    return text || "مش واضحة. قول تاني.";
  }

  async function ask(text) {
    if (!isLive() || busy) return;
    const said = String(text || "").trim();
    if (!said) return;
    busy = true;
    stopRecorder();
    const chat = liveChat();
    chat.messages.push({ role: "user", content: said, at: Date.now() });
    chat.at = Date.now();
    if (chat.title === "لايف زيفي" && said.length > 2) chat.title = said.slice(0, 36);
    saveLive(chat);
    try {
      let reply = doSiteAction(said);
      if (!reply) reply = await completeShort(chat.messages);
      chat.messages.push({ role: "assistant", content: reply, at: Date.now() });
      chat.at = Date.now();
      saveLive(chat);
      window.dispatchEvent(new CustomEvent("zivv-live-msg", { detail: { text: said, reply } }));
      await speak(reply);
    } catch {
    } finally {
      busy = false;
      if (isLive()) setTimeout(startListen, 280);
    }
  }

  function mount() {
    ensureCss();
    if (!document.querySelector(".zivvy-halo")) {
      const halo = document.createElement("div");
      halo.className = "zivvy-halo";
      halo.setAttribute("aria-hidden", "true");
      halo.innerHTML = '<div class="ring"></div><div class="glow"></div>';
      document.body.appendChild(halo);
    }
    const old = document.querySelector(".zivvy-dock");
    if (old) old.remove();
    if (!document.querySelector(".zivvy-endchip")) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "zivvy-endchip";
      chip.textContent = "إنهاء اللايف";
      chip.onclick = () => stopLive();
      document.body.appendChild(chip);
    }
    syncUi();
  }

  function syncUi() {
    const halo = document.querySelector(".zivvy-halo");
    const chip = document.querySelector(".zivvy-endchip");
    const on = isLive();
    if (halo) halo.classList.toggle("on", on);
    if (chip) chip.classList.toggle("on", on);
    if (on && !hueRaf) hueRaf = requestAnimationFrame(spinHue);
    if (on && !listening && !busy) setTimeout(startListen, 200);
    if (on) watchLiveHour();
    if (!on) {
      killMic();
      stopVoice();
      if (hueRaf) cancelAnimationFrame(hueRaf);
      hueRaf = 0;
    }
  }

  let liveTimer = 0;
  function liveAllowed() {
    if (!window.ZIVV_CREATOR) return { ok: true };
    const id = sessionStorage.getItem(LIVE_ID) || "";
    if (id && ZIVV_CREATOR.aiChatLeft) {
      const left = ZIVV_CREATOR.aiChatLeft(id);
      if (left && left.ok) return left;
    }
    if (ZIVV_CREATOR.aiStatus) {
      const st = ZIVV_CREATOR.aiStatus();
      if (!st.gold && st.chatsLeft <= 0) return { ok: false, reason: "limit" };
    }
    return { ok: true };
  }
  function watchLiveHour() {
    if (liveTimer) clearInterval(liveTimer);
    liveTimer = setInterval(() => {
      if (!isLive()) {
        clearInterval(liveTimer);
        liveTimer = 0;
        return;
      }
      const id = sessionStorage.getItem(LIVE_ID);
      if (!id || !window.ZIVV_CREATOR || !ZIVV_CREATOR.aiChatLeft) return;
      const left = ZIVV_CREATOR.aiChatLeft(id);
      if (left && !left.gold && !left.ok) {
        stopLive();
        window.alert("ساعة المحادثة المباشرة خلصت. ابدأ لايف جديد لو لسه عندك رصيد، أو اشترك ذهبي.");
      }
    }, 15000);
  }

  async function startLive() {
    const gate0 = liveAllowed();
    if (!gate0.ok && gate0.reason === "limit") {
      window.alert("خلصت الـ ١٠ محادثات اليوم (عادية ومباشرة). الذهبي من غير حد.");
      return;
    }
    sessionStorage.setItem(LIVE, "1");
    const chat = liveChat();
    if (window.ZIVV_CREATOR && ZIVV_CREATOR.aiStartChat) {
      const gate = ZIVV_CREATOR.aiStartChat(chat.id, "live");
      if (!gate.ok && gate.reason === "limit") {
        sessionStorage.removeItem(LIVE);
        window.alert("خلصت الـ ١٠ محادثات اليوم. الذهبي من غير حد.");
        return;
      }
      if (!gate.ok && gate.reason === "expired") {
        sessionStorage.removeItem(LIVE_ID);
        const fresh = liveChat();
        const again = ZIVV_CREATOR.aiStartChat(fresh.id, "live");
        if (!again.ok) {
          sessionStorage.removeItem(LIVE);
          window.alert("خلصت الـ ١٠ محادثات اليوم. الذهبي من غير حد.");
          return;
        }
      }
    }
    ensureCtx();
    syncUi();
    watchLiveHour();
    window.dispatchEvent(new CustomEvent("zivv-live", { detail: { on: true } }));
    await startListen();
  }

  function stopLive() {
    sessionStorage.removeItem(LIVE);
    if (liveTimer) {
      clearInterval(liveTimer);
      liveTimer = 0;
    }
    killMic();
    stopVoice();
    syncUi();
    window.dispatchEvent(new CustomEvent("zivv-live", { detail: { on: false } }));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  window.ZIVV_ZIVVY = {
    speak,
    prefs,
    savePrefs,
    doSiteAction,
    extractPerson,
    isLive,
    startLive,
    stopLive,
    stopVoice,
    ask,
    startListen,
  };
})();
