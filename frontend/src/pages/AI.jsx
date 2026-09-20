import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { Logo, AiBadge } from '../components/ui';
import {
  PlusIcon, MicIcon, MicOffIcon, SendIcon, ImageIcon, BotIcon, ChatIcon, XIcon, SparklesIcon,
} from '../components/icons';

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

const starters = ['Create a Reel about football', 'Draft a post for me', 'Find programming accounts', 'Write a catchy bio'];

function aiErr(e, fallback) {
  const d = e?.response?.data || {};
  if (d.error === 'ai_billing') return 'الخدمة محتاجة شحن رصيد AI — كلّم الإدارة';
  if (d.error === 'gold_required') return 'الميزة دي للـ Gold بس — اشترك عشان تفتحها';
  if (d.error === 'quota_exceeded') return `خلصت حصتك (${d.kind}: ${d.used}/${d.limit} ${d.per === 'day' ? 'يوميًا' : 'أسبوعيًا'}) — Gold بيزوّد الحصة`;
  if (d.error === 'model_no_vision') return 'الموديل ده مش بيفهم الصور — اختار موديل رؤية';
  return fallback;
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
  const [muted, setMuted] = useState(false);
  const [models, setModels] = useState(null);
  const [chatModel, setChatModel] = useState('');
  const [imgModel, setImgModel] = useState('');
  const [vidModel, setVidModel] = useState('');
  const [vidPrompt, setVidPrompt] = useState('');
  const [vidJob, setVidJob] = useState(null);
  const pollRef = useRef(null);

  const loadModels = async () => {
    try {
      const { data } = await api.get('/ai/models');
      setModels(data);
      setChatModel((v) => v || data.defaults.chat);
      setImgModel((v) => v || data.defaults.image);
      setVidModel((v) => v || data.defaults.video);
    } catch {}
  };

  useEffect(() => {
    api.get('/ai/chats').then((r) => { setChats(r.data.items); setActive(r.data.items[0]); });
    api.get('/ai/status').then((r) => setLive(r.data)).catch(() => setLive({ live: false }));
    loadModels();
    return () => clearTimeout(pollRef.current);
  }, []);

  const refresh = async (id) => {
    const { data } = await api.get('/ai/chats');
    setChats(data.items); setActive(data.items.find((c) => c.id === id));
  };

  const send = async (override) => {
    const t = (override ?? text).trim();
    if (!t || !active || busy) return;
    setText(''); setBusy(true);
    setActive({ ...active, messages: [...active.messages, { role: 'user', text: t }, { role: 'assistant', text: 'Thinking…' }] });
    try {
      await api.post(`/ai/chats/${active.id}/messages`, { text: t, model: chatModel || undefined });
      loadModels();
    } catch (e) { alert(aiErr(e, 'Send failed.')); }
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
    alert(`Agent ${plan.tool} done (${data.risk})`);
  };

  const generate = async () => {
    if (!imgPrompt.trim()) return;
    setGenImg('loading');
    try {
      const { data } = await api.post('/ai/image', { prompt: imgPrompt, model: imgModel || undefined });
      setGenImg(data.imageUrl || data.imageDataUrl || 'none');
      if (!data.imageUrl && !data.imageDataUrl) alert(data.note || 'Image queued.');
      loadModels();
    } catch (e) { setGenImg(''); alert(aiErr(e, 'Image generation failed.')); }
  };

  const pollVideo = async (jobId, n = 0) => {
    if (n > 150) { setVidJob({ jobId, status: 'error', error: 'استغرق وقتًا طويلًا — جرّب تاني' }); return; }
    try {
      const { data } = await api.get(`/ai/video/${jobId}`);
      if (data.status === 'completed' && data.videoUrl) { setVidJob({ jobId, status: 'completed', videoUrl: data.videoUrl }); return; }
      if (data.status === 'failed') { setVidJob({ jobId, status: 'error', error: 'فشل توليد الفيديو — جرّب وصفًا مختلفًا' }); return; }
      setVidJob({ jobId, status: data.status || 'processing', videoUrl: '' });
    } catch (e) {
      if (e?.response?.status === 404) { setVidJob({ status: 'error', error: 'الطلب مش موجود' }); return; }
    }
    pollRef.current = setTimeout(() => pollVideo(jobId, n + 1), 5000);
  };

  const genVideo = async () => {
    if (!vidPrompt.trim() || vidJob?.status === 'queued' || vidJob?.status === 'processing' || vidJob?.status === 'starting') return;
    clearTimeout(pollRef.current);
    setVidJob({ status: 'starting' });
    try {
      const { data } = await api.post('/ai/video', { prompt: vidPrompt, model: vidModel || undefined });
      setVidJob({ jobId: data.jobId, status: 'queued', videoUrl: '' });
      pollVideo(data.jobId);
      loadModels();
    } catch (e) { setVidJob({ status: 'error', error: aiErr(e, 'Video generation failed.') }); }
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0]; if (!f || !active) return;
    const q = text.trim() || 'Describe this image in detail.';
    const vm = models?.chat.find((m) => m.id === chatModel);
    setText(''); setBusy(true);
    setActive({ ...active, messages: [...active.messages, { role: 'user', text: q }, { role: 'assistant', text: 'Analyzing image…' }] });
    try {
      const dataUrl = await resizeImage(f);
      const { data } = await api.post('/ai/vision', { imageDataUrl: dataUrl, question: q, model: vm?.vision ? chatModel : undefined });
      setActive({ ...active, messages: [...active.messages, { role: 'user', text: q }, { role: 'assistant', text: data.answer }] });
      loadModels();
    } catch (err) {
      setActive({ ...active, messages: [...active.messages, { role: 'user', text: q }, { role: 'assistant', text: aiErr(err, 'Vision needs a live AI key on the server.') }] });
    }
    setBusy(false);
    e.target.value = '';
  };

  const u = models?.usage;
  const quotaLine = u ? `Chat ${u.chat.used}/${u.chat.limit} · Images ${u.image.used}/${u.image.limit} · Video ${u.video.used}/${u.video.limit}/${u.video.per}` : '';

  return (
    <div className="md:flex gap-4 pt-3 px-3 md:px-0">
      <aside className="hidden md:block w-56 shrink-0 space-y-1.5">
        <button onClick={newChat} className="btn-primary w-full text-sm flex items-center justify-center gap-1.5"><PlusIcon size={16} />New chat</button>
        {chats.map((c) => <button key={c.id} onClick={() => setActive(c)} className={`w-full text-left text-sm font-semibold p-2.5 rounded-2xl truncate flex items-center gap-2 ${active?.id === c.id ? 'bg-black/5 dark:bg-white/10' : ''}`}><ChatIcon size={16} className="opacity-50 shrink-0" /><span className="truncate">{c.title}</span></button>)}
      </aside>

      <div className="flex-1 card p-4 min-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Logo size={30} wordmark={false} /><span className="font-bold text-lg">ZIVV AI</span><AiBadge /></div>
          <div className="flex items-center gap-2">
            {live && (live.live
              ? <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-500/15 text-green-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Live · {live.provider}</span>
              : <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/10 dark:bg-white/10 opacity-70">Demo mode</span>)}
            <button onClick={() => setLiveVoice(!liveVoice)} className={`btn-ghost !px-3 text-sm ${liveVoice ? '!bg-red-500/15 text-red-500' : ''}`} aria-label="Live voice"><MicIcon size={18} /></button>
            <button onClick={newChat} className="btn-ghost !px-3 text-sm md:hidden" aria-label="New chat"><PlusIcon size={18} /></button>
          </div>
        </div>

        {models && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className={`px-2.5 py-1 rounded-full ${models.gold ? 'bg-amber-500/15 text-amber-600' : 'bg-black/10 dark:bg-white/10 opacity-70'}`}>{models.gold ? 'GOLD' : 'FREE'}</span>
            <span className="opacity-60">{quotaLine}</span>
            <select value={chatModel} onChange={(e) => setChatModel(e.target.value)} className="input !w-auto !py-1 !px-2 !text-[11px] !rounded-full" title="Chat model">
              {models.chat.map((m) => (
                <option key={m.id} value={m.id} disabled={m.gold && !models.gold}>{m.label}{m.gold && !models.gold ? ' (Gold)' : ''}{m.free ? ' · free' : ''}</option>
              ))}
            </select>
          </div>
        )}

        {liveVoice && (
          <div className="mt-3 rounded-2xl zivv-gradient p-6 text-white text-center fade-in">
            <div className={`w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center ${muted ? '' : 'animate-pulse'}`}>{muted ? <MicOffIcon size={28} /> : <MicIcon size={28} />}</div>
            <div className="font-bold mt-2">Live conversation</div>
            <div className="text-sm opacity-90">Speak anytime · interruption supported · transcript on</div>
            <div className="flex justify-center gap-2 mt-3">
              <button onClick={() => setMuted(!muted)} className="bg-white/20 rounded-full px-4 py-1.5 text-sm font-bold flex items-center gap-1.5">{muted ? <MicOffIcon size={15} /> : <MicIcon size={15} />}{muted ? 'Unmute' : 'Mute'}</button>
              <button onClick={() => setLiveVoice(false)} className="bg-white text-black rounded-full px-4 py-1.5 text-sm font-bold flex items-center gap-1.5"><XIcon size={15} />End</button>
            </div>
          </div>
        )}

        <div className="flex-1 space-y-3 mt-4 overflow-y-auto max-h-[44vh] pr-0.5">
          {(active?.messages || []).map((m, i) => (
            <div key={i} className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed w-fit ${m.role === 'user' ? 'ml-auto zivv-gradient text-white' : 'bg-black/5 dark:bg-white/10'}`}>{m.text}</div>
          ))}
          {!active?.messages?.length && (
            <div className="text-center mt-8">
              <div className="w-16 h-16 mx-auto rounded-2xl zivv-gradient flex items-center justify-center text-white shadow-md"><SparklesIcon size={30} /></div>
              <div className="font-bold text-lg mt-3">How can I help?</div>
              <div className="text-sm opacity-60">Arabic, Egyptian dialect & English supported</div>
              <div className="grid grid-cols-2 gap-2 mt-4 text-left">
                {starters.map((s) => <button key={s} onClick={() => send(s)} className="text-xs font-semibold p-3 rounded-2xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 transition text-left">{s}</button>)}
              </div>
            </div>
          )}
          {genImg === 'loading' && <div className="text-sm opacity-60 flex items-center gap-2"><SparklesIcon size={15} className="animate-pulse" />Generating image…</div>}
          {genImg && genImg !== 'loading' && genImg !== 'none' && (
            <div><img src={genImg} alt="AI generated" className="rounded-2xl max-h-72" /><div className="text-[11px] opacity-60 mt-1">AI-generated with ZIVV</div></div>
          )}
          {vidJob?.status === 'completed' && vidJob.videoUrl && (
            <div><video src={vidJob.videoUrl} controls className="rounded-2xl max-h-72 w-full bg-black" /><div className="text-[11px] opacity-60 mt-1">AI-generated with ZIVV</div></div>
          )}
          {vidJob && ['starting', 'queued', 'processing'].includes(vidJob.status) && (
            <div className="text-sm opacity-60 flex items-center gap-2"><SparklesIcon size={15} className="animate-pulse" />Generating video… ({vidJob.status})</div>
          )}
          {vidJob?.status === 'error' && <div className="text-sm text-red-500 font-semibold">{vidJob.error}</div>}
        </div>

        {plan && (
          <div className="mt-3 rounded-2xl border-2 border-zivv-purple/50 p-4 fade-in">
            <div className="font-bold text-sm flex items-center gap-2"><BotIcon size={18} className="text-zivv-purple" />Agent preview
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${plan.risk === 'HIGH' ? 'bg-red-500/15 text-red-500' : plan.risk === 'MEDIUM' ? 'bg-amber-500/15 text-amber-600' : 'bg-green-500/15 text-green-600'}`}>{plan.risk}</span>
            </div>
            <div className="text-sm mt-1.5">Tool: <b>{plan.tool}</b> — {plan.preview}</div>
            <div className="text-xs opacity-60 mt-1">Permission → validation → {plan.needsConfirmation ? 'confirmation required' : 'auto-approved (low risk)'} → execution → audit</div>
            <div className="flex gap-2 mt-2.5"><button onClick={() => agentExec(true)} className="btn-primary text-sm">Confirm & Execute</button><button onClick={() => setPlan(null)} className="btn-ghost text-sm">Cancel</button></div>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50"><ImageIcon size={16} /></span>
            <input value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} placeholder="Describe an image to generate…" className="input !pl-10 text-sm" />
          </div>
          {models && (
            <select value={imgModel} onChange={(e) => setImgModel(e.target.value)} className="input !w-auto text-sm" title="Image model">
              {models.image.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          )}
          <button onClick={generate} className="btn-ghost text-sm whitespace-nowrap flex items-center gap-1.5"><SparklesIcon size={15} />Generate</button>
        </div>
        <div className="flex gap-2 mt-2">
          <input value={vidPrompt} onChange={(e) => setVidPrompt(e.target.value)} placeholder="Describe a video to generate…" className="input text-sm flex-1" />
          {models && (
            <select value={vidModel} onChange={(e) => setVidModel(e.target.value)} className="input !w-auto text-sm" title="Video model">
              {models.video.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          )}
          <button onClick={genVideo} className="btn-ghost text-sm whitespace-nowrap flex items-center gap-1.5"><SparklesIcon size={15} />Video</button>
        </div>
        <div className="flex gap-1.5 mt-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button onClick={() => fileRef.current?.click()} className="btn-ghost !px-3" title="Analyze image" aria-label="Analyze image"><ImageIcon size={19} /></button>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Message ZIVV AI…" className="input" />
          <button onClick={agentPlan} className="btn-ghost whitespace-nowrap text-sm flex items-center gap-1.5" title="Run as agent action"><BotIcon size={17} /><span className="hidden sm:inline">Agent</span></button>
          <button onClick={() => send()} className="btn-primary !px-4" aria-label="Send"><SendIcon size={18} /></button>
        </div>
      </div>
    </div>
  );
}
