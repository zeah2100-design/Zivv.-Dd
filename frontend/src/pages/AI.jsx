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
  if (d.error === 'tool_not_supported') return 'الأداة دي مش مدعومة لسه';
  return fallback;
}

export default function AI() {
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [text, setText] = useState('');
  const [plan, setPlan] = useState(null);
  const [planInput, setPlanInput] = useState({});
  const [agentMode, setAgentMode] = useState(false);
  const [live, setLive] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const [liveVoice, setLiveVoice] = useState(false);
  const [muted, setMuted] = useState(false);
  const [models, setModels] = useState(null);
  const [chatModel, setChatModel] = useState('');

  const loadModels = async () => {
    try {
      const { data } = await api.get('/ai/models');
      setModels(data);
      setChatModel((v) => v || data.defaults.chat);
    } catch {}
  };

  useEffect(() => {
    api.get('/ai/chats').then((r) => { setChats(r.data.items); setActive(r.data.items[0]); });
    api.get('/ai/status').then((r) => setLive(r.data)).catch(() => setLive({ live: false }));
    loadModels();
  }, []);

  const refresh = async (id) => {
    const { data } = await api.get('/ai/chats');
    setChats(data.items); setActive(data.items.find((c) => c.id === id));
  };

  const send = async (override) => {
    const t = (override ?? text).trim();
    if (!t || !active || busy) return;
    if (agentMode && models?.gold) return sendAgent(t);
    setText(''); setBusy(true);
    setActive({ ...active, messages: [...active.messages, { role: 'user', text: t }, { role: 'assistant', text: 'Thinking…' }] });
    try {
      await api.post(`/ai/chats/${active.id}/messages`, { text: t, model: chatModel || undefined });
      loadModels();
    } catch (e) { alert(aiErr(e, 'Send failed.')); }
    await refresh(active.id); setBusy(false);
  };

  // Agent mode (Gold): instruction → plan card → confirm → execute → audit.
  // Non-action messages fall back to normal chat.
  const sendAgent = async (t) => {
    setText(''); setBusy(true); setPlan(null);
    try {
      const { data } = await api.post('/ai/agent/plan', { instruction: t });
      if (data.acts && data.confidence >= 0.55) {
        setPlan(data);
        setPlanInput(data.input || {});
      } else {
        setActive({ ...active, messages: [...active.messages, { role: 'user', text: t }, { role: 'assistant', text: 'Thinking…' }] });
        await api.post(`/ai/chats/${active.id}/messages`, { text: t, model: chatModel || undefined });
        await refresh(active.id); loadModels();
      }
    } catch (e) { alert(aiErr(e, 'Agent failed.')); }
    setBusy(false);
  };

  const agentExec = async () => {
    const input = { ...planInput };
    if (plan.tool === 'publish' && input.text) {
      input.hashtags = [...new Set((input.text.match(/#[\p{L}\p{N}_]+/gu) || []).map((h) => h.slice(1)))];
    }
    try {
      const { data } = await api.post('/ai/agent/execute', { tool: plan.tool, input, confirmed: true });
      setPlan({ ...plan, done: data.result });
      setText('');
    } catch (e) { alert(aiErr(e, 'Execute failed.')); }
  };

  const planResultText = () => {
    const r = plan?.done || {};
    if (r.published) return 'تم نشر البوست بنجاح';
    if (r.followed) return `تم متابعة @${r.followed}`;
    if (r.bio) return 'تم تحديث البايو';
    return 'تم التنفيذ';
  };

  const newChat = async () => { const { data } = await api.post('/ai/chats'); setChats([data, ...chats]); setActive(data); };

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
  const quotaLine = u ? `Chat ${u.chat.used}/${u.chat.limit} · Vision ${u.vision.used}/${u.vision.limit}` : '';

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
        </div>

        {plan && (
          <div className="mt-3 rounded-2xl border-2 border-zivv-purple/50 p-4 fade-in">
            <div className="font-bold text-sm flex items-center gap-2"><BotIcon size={18} className="text-zivv-purple" />Agent preview
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${plan.risk === 'HIGH' ? 'bg-red-500/15 text-red-500' : plan.risk === 'MEDIUM' ? 'bg-amber-500/15 text-amber-600' : 'bg-green-500/15 text-green-600'}`}>{plan.risk}</span>
            </div>
            <div className="text-sm mt-1.5">Tool: <b>{plan.tool}</b> — {plan.preview}</div>
            {!plan.done && plan.tool === 'publish' && (
              <textarea value={planInput.text || ''} onChange={(e) => setPlanInput({ ...planInput, text: e.target.value })} rows={3} className="input text-sm mt-2" placeholder="Post text…" />
            )}
            {!plan.done && plan.tool === 'follow' && (
              <input value={planInput.username || ''} onChange={(e) => setPlanInput({ ...planInput, username: e.target.value })} className="input text-sm mt-2" placeholder="username" />
            )}
            {!plan.done && plan.tool === 'edit_profile' && (
              <textarea value={planInput.bio || ''} onChange={(e) => setPlanInput({ ...planInput, bio: e.target.value })} rows={2} className="input text-sm mt-2" placeholder="New bio…" />
            )}
            {plan.done
              ? <div className="text-sm font-bold text-green-600 mt-2.5">{planResultText()}</div>
              : <div className="text-xs opacity-60 mt-1.5">Permission → validation → confirmation required → execution → audit</div>}
            <div className="flex gap-2 mt-2.5">
              {!plan.done && <button onClick={agentExec} className="btn-primary text-sm">Confirm & Execute</button>}
              <button onClick={() => { setPlan(null); setPlanInput({}); }} className="btn-ghost text-sm">{plan.done ? 'Close' : 'Cancel'}</button>
            </div>
          </div>
        )}

        {agentMode && models?.gold && (
          <div className="text-[11px] opacity-60 mt-2.5 font-semibold">وضع Agent شغال: اطلب (انشر / تابع / عدّل البايو) وهنفذ بعد تأكيدك</div>
        )}
        <div className="flex gap-1.5 mt-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button onClick={() => fileRef.current?.click()} className="btn-ghost !px-3" title="Analyze image" aria-label="Analyze image"><ImageIcon size={19} /></button>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={agentMode ? 'أمر للـ Agent…' : 'Message ZIVV AI…'} className="input" />
          {models?.gold && (
            <button onClick={() => { setAgentMode(!agentMode); setPlan(null); }} className={`btn-ghost whitespace-nowrap text-sm flex items-center gap-1.5 ${agentMode ? '!bg-zivv-purple/15 text-zivv-purple' : ''}`} title="Agent mode: act inside the app"><BotIcon size={17} /><span className="hidden sm:inline">Agent</span></button>
          )}
          <button onClick={() => send()} className="btn-primary !px-4" aria-label="Send"><SendIcon size={18} /></button>
        </div>
      </div>
    </div>
  );
}
