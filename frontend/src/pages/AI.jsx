import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { Logo, AiBadge } from '../components/ui';

// Downscale before upload (serverless request limits + faster vision).
function resizeImage(file, maxDim = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function AI() {
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [text, setText] = useState('');
  const [plan, setPlan] = useState(null);
  const [imgPrompt, setImgPrompt] = useState('');
  const [genImg, setGenImg] = useState('');
  const [live, setLive] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const [liveVoice, setLiveVoice] = useState(false);

  useEffect(() => {
    api.get('/ai/chats').then((r) => { setChats(r.data.items); setActive(r.data.items[0]); });
    api.get('/ai/status').then((r) => setLive(r.data)).catch(() => setLive({ live: false }));
  }, []);

  const refresh = async (id) => {
    const { data } = await api.get('/ai/chats');
    setChats(data.items); setActive(data.items.find((c) => c.id === id));
  };

  const send = async () => {
    if (!text.trim() || !active || busy) return;
    const t = text; setText(''); setBusy(true);
    setActive({ ...active, messages: [...active.messages, { role: 'user', text: t }, { role: 'assistant', text: '✦ thinking…' }] });
    try { await api.post(`/ai/chats/${active.id}/messages`, { text: t }); } catch {}
    await refresh(active.id); setBusy(false);
  };

  const newChat = async () => { const { data } = await api.post('/ai/chats'); setChats([data, ...chats]); setActive(data); };

  const agentPlan = async () => {
    if (!text.trim()) return;
    const { data } = await api.post('/ai/agent/plan', { instruction: text });
    setPlan(data);
  };
  const agentExec = async (confirmed) => {
    const { data } = await api.post('/ai/agent/execute', { tool: plan.tool, input: {}, confirmed });
    setPlan(null); setText('');
    alert(`Agent ${plan.tool} done ✓ (${data.risk})`);
  };

  const generate = async () => {
    if (!imgPrompt.trim()) return;
    setGenImg('loading');
    try {
      const { data } = await api.post('/ai/image', { prompt: imgPrompt });
      setGenImg(data.imageUrl || data.imageDataUrl || 'none');
      if (!data.imageUrl && !data.imageDataUrl) alert('✦ ' + (data.note || 'Image queued.'));
    } catch { setGenImg(''); alert('Image generation failed.'); }
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0]; if (!f || !active) return;
    const q = text.trim() || 'Describe this image in detail.';
    setText(''); setBusy(true);
    setActive({ ...active, messages: [...active.messages, { role: 'user', text: `🖼️ ${q}` }, { role: 'assistant', text: '✦ analyzing image…' }] });
    try {
      const dataUrl = await resizeImage(f);
      const { data } = await api.post('/ai/vision', { imageDataUrl: dataUrl, question: q });
      const msgs = [...active.messages, { role: 'user', text: `🖼️ ${q}` }, { role: 'assistant', text: data.answer }];
      setActive({ ...active, messages: msgs });
    } catch {
      setActive({ ...active, messages: [...active.messages, { role: 'user', text: `🖼️ ${q}` }, { role: 'assistant', text: '⚠️ Vision needs a live AI key (set OPENAI_API_KEY or GEMINI_API_KEY on the server).' }] });
    }
    setBusy(false);
    e.target.value = '';
  };

  return (
    <div className="md:flex gap-4 pt-3 px-3 md:px-0">
      <aside className="hidden md:block w-56 shrink-0 space-y-2">
        <button onClick={newChat} className="btn-primary w-full text-sm">＋ New chat</button>
        {chats.map((c) => <button key={c.id} onClick={() => setActive(c)} className={`w-full text-left text-sm font-semibold p-2.5 rounded-2xl truncate ${active?.id === c.id ? 'bg-black/5 dark:bg-white/10' : ''}`}>💬 {c.title}</button>)}
      </aside>

      <div className="flex-1 card p-4 min-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={30} wordmark={false} /><span className="font-black text-lg">ZIVV AI</span><AiBadge />
            {live && (live.live
              ? <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-green-500/15 text-green-600">● Live ({live.provider})</span>
              : <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 opacity-70">Demo mode</span>)}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setLiveVoice(!liveVoice)} className={`btn-ghost text-sm ${liveVoice ? '!bg-red-500/20' : ''}`}>{liveVoice ? '🔴 End live' : '🎙️ Live voice'}</button>
            <button onClick={newChat} className="btn-ghost text-sm md:hidden">＋</button>
          </div>
        </div>

        {liveVoice && (
          <div className="mt-3 rounded-2xl zivv-gradient p-6 text-white text-center">
            <div className="text-5xl animate-pulse">🎙️</div>
            <div className="font-black mt-2">Live conversation</div>
            <div className="text-sm opacity-90">Speak anytime — interruption supported • transcripts on</div>
            <div className="flex justify-center gap-2 mt-3"><button className="bg-white/20 rounded-full px-4 py-1.5 text-sm font-bold">Mute</button><button onClick={() => setLiveVoice(false)} className="bg-white text-black rounded-full px-4 py-1.5 text-sm font-bold">End</button></div>
          </div>
        )}

        <div className="flex-1 space-y-3 mt-4 overflow-y-auto max-h-[44vh]">
          {(active?.messages || []).map((m, i) => (
            <div key={i} className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${m.role === 'user' ? 'ml-auto zivv-gradient text-white' : 'bg-black/5 dark:bg-white/10'}`}>{m.text}</div>
          ))}
          {!active?.messages?.length && <div className="text-center opacity-50 text-sm mt-10">Ask anything — AR, Egyptian Arabic, EN 🌍<br />Try: “Create a Reel about football” then use Agent ✦</div>}
          {genImg === 'loading' && <div className="text-sm opacity-60">✦ Generating image…</div>}
          {genImg && genImg !== 'loading' && genImg !== 'none' && (
            <div><img src={genImg} alt="AI generated" className="rounded-2xl max-h-72" /><div className="text-[11px] opacity-60 mt-1">AI-generated with ZIVV ✦</div></div>
          )}
        </div>

        {plan && (
          <div className="mt-3 rounded-2xl border-2 border-zivv-purple/50 p-4">
            <div className="font-black text-sm">🤖 Agent preview <span className={`text-xs px-2 py-0.5 rounded-full ${plan.risk === 'HIGH' ? 'bg-red-500/20 text-red-500' : plan.risk === 'MEDIUM' ? 'bg-amber-500/20 text-amber-600' : 'bg-green-500/20 text-green-600'}`}>{plan.risk}</span></div>
            <div className="text-sm mt-1">Tool: <b>{plan.tool}</b> — {plan.preview}</div>
            <div className="text-xs opacity-60 mt-1">Permission → validation → {plan.needsConfirmation ? 'confirmation required' : 'auto-approved (low risk)'} → execution → audit</div>
            <div className="flex gap-2 mt-2"><button onClick={() => agentExec(true)} className="btn-primary text-sm">Confirm & Execute</button><button onClick={() => setPlan(null)} className="btn-ghost text-sm">Cancel</button></div>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <input value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} placeholder="🖼️ Generate image…" className="input text-sm" />
          <button onClick={generate} className="btn-ghost text-sm whitespace-nowrap">Generate</button>
        </div>
        <div className="flex gap-2 mt-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button onClick={() => fileRef.current?.click()} className="btn-ghost" title="Analyze image">📎</button>
          <button className="btn-ghost">🎙️</button>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Message ZIVV AI… (يدعم العربية ✦)" className="input" />
          <button onClick={agentPlan} className="btn-ghost whitespace-nowrap text-sm" title="Run as agent action">🤖 Agent</button>
          <button onClick={send} className="btn-primary">➤</button>
        </div>
      </div>
    </div>
  );
}
