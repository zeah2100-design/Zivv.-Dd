import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useZivv } from '../lib/store';
import { useLang } from '../lib/i18n';
import { SparklesIcon, SendIcon, ImageIcon, MicIcon, PlusIcon, ChatIcon, EditIcon, BulbIcon, ReplyIcon, MenuIcon, XIcon, PinIcon, TrashIcon, VolumeIcon, BotIcon, CrownIcon, CheckIcon } from '../components/icons';

const modePrefix = {
  chat: '',
  caption: 'Write a catchy social caption for this: ',
  ideas: 'Give me 5 creative content ideas about: ',
  reply: 'Draft a friendly short reply to this message: ',
};
const MODES = [['chat', ChatIcon], ['caption', EditIcon], ['ideas', BulbIcon], ['reply', ReplyIcon]];
const suggestions = (t) => [t('ai.s1'), t('ai.s2'), t('ai.s3'), t('ai.s4')];

export default function AiCopilot() {
  const { user, refreshUser } = useZivv();
  const { t, lang, isRTL } = useLang();
  const nav = useNavigate();
  const [goldFresh, setGoldFresh] = useState(null); // live from server — cache may predate approval
  useEffect(() => {
    try { refreshUser(); } catch {}
    api.get('/gold/status').then((r) => setGoldFresh(!!r.data.gold)).catch(() => setGoldFresh(false));
  }, []);
  const isGold = goldFresh === null ? !!user?.gold : goldFresh;
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('chat');
  const [status, setStatus] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [listening, setListening] = useState(false);
  // agent
  const [showAgent, setShowAgent] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [plan, setPlan] = useState(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [execBusy, setExecBusy] = useState(false);
  const [execRes, setExecRes] = useState(null);
  const bottomRef = useRef(null);
  const recogRef = useRef(null);

  useEffect(() => { api.get('/ai/status').then((r) => setStatus(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    api.get('/ai/chats').then((r) => {
      const items = r.data.items || [];
      setChats(items);
      if (items.length && !activeId) { setActiveId(items[0].id); setMsgs(items[0].messages || []); }
    }).catch(() => {});
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length, busy]);

  const selectChat = (c) => { setActiveId(c.id); setMsgs(c.messages || []); setDrawer(false); };
  const newChat = async () => {
    try {
      const r = await api.post('/ai/chats');
      setChats((l) => [r.data, ...l]); setActiveId(r.data.id); setMsgs([]); setDrawer(false);
    } catch {}
  };
  const pinChat = async (id) => {
    try {
      const r = await api.post(`/ai/chats/${id}/pin`);
      setChats((l) => l.map((c) => c.id === id ? { ...c, pinned: r.data.pinned } : c)
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)));
    } catch {}
  };
  const delChat = async (id) => {
    try {
      await api.delete(`/ai/chats/${id}`);
      setChats((l) => l.filter((c) => c.id !== id));
      if (activeId === id) { setActiveId(null); setMsgs([]); }
    } catch {}
  };

  const ensureChat = async () => {
    if (activeId) return activeId;
    const r = await api.post('/ai/chats');
    setChats((l) => [r.data, ...l]); setActiveId(r.data.id);
    return r.data.id;
  };

  const ask = async (prompt) => {
    const q = (prompt ?? text).trim();
    if (!q || busy) return;
    setText('');
    const um = { role: 'user', text: q };
    setMsgs((m) => [...m, um]);
    setBusy(true);
    try {
      const id = await ensureChat();
      const r = await api.post(`/ai/chats/${id}/messages`, { text: (modePrefix[mode] || '') + q });
      const am = { role: 'ai', text: r.data?.text || '…' };
      setMsgs((m) => [...m, am]);
      setChats((l) => l.map((c) => c.id === id ? { ...c, title: c.title === 'New chat' ? q.slice(0, 40) : c.title, messages: [...(c.messages || []), um, am] } : c));
    } catch {
      setMsgs((m) => [...m, { role: 'ai', text: t('ai.err') }]);
    } finally { setBusy(false); }
  };

  // --- Voice (Gold): speech-to-text in, speech out ---
  const toggleListen = () => {
    if (!isGold) { nav('/gold'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { recogRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = lang === 'ar' ? 'ar-EG' : 'en-US';
    rec.interimResults = false;
    rec.onresult = (e) => { const s = e.results?.[0]?.[0]?.transcript; if (s) setText((v) => (v ? v + ' ' : '') + s); };
    rec.onend = () => setListening(false);
    recogRef.current = rec;
    rec.start(); setListening(true);
  };
  const speak = (s) => {
    if (!isGold) { nav('/gold'); return; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(s);
      u.lang = lang === 'ar' ? 'ar-EG' : 'en-US';
      speechSynthesis.speak(u);
    } catch {}
  };

  // --- Agent (Gold): plan → confirm → execute ---
  const makePlan = async () => {
    if (!instruction.trim() || planBusy) return;
    setPlanBusy(true); setPlan(null); setExecRes(null);
    try { const r = await api.post('/ai/agent/plan', { instruction }); setPlan(r.data); }
    catch {} finally { setPlanBusy(false); }
  };
  const execPlan = async () => {
    if (!plan || execBusy) return;
    setExecBusy(true);
    try {
      const input = {};
      if (plan.tool === 'publish') input.text = instruction;
      if (plan.tool === 'edit_profile') input.bio = instruction;
      const m = instruction.match(/@([\w.]+)/);
      if (m) input.username = m[1];
      const r = await api.post('/ai/agent/execute', { tool: plan.tool, input, confirmed: true });
      setExecRes(r.data);
    } catch (e) { setExecRes({ error: e.response?.data?.error || 'error' }); }
    finally { setExecBusy(false); }
  };

  const chatList = (
    <div className="flex flex-col h-full">
      <button onClick={newChat} className="m-3 btn-primary !py-2 text-sm flex items-center justify-center gap-2"><PlusIcon size={16} />{t('ai.new')}</button>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {chats.length === 0 && <div className="text-center text-xs opacity-50 py-8">{t('ai.noChats')}</div>}
        {chats.map((c) => (
          <div key={c.id} className={`group flex items-center gap-1 rounded-xl px-2 py-2 ${activeId === c.id ? 'bg-zivv-purple/10' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}>
            <button onClick={() => selectChat(c)} className="flex-1 min-w-0 text-start flex items-center gap-2">
              {c.pinned && <PinIcon size={14} className="text-zivv-purple shrink-0" />}
              <span className="text-sm font-medium truncate">{c.title}</span>
            </button>
            <button onClick={() => pinChat(c.id)} title={t(c.pinned ? 'ai.unpin' : 'ai.pin')} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-60 hover:!opacity-100"><PinIcon size={15} /></button>
            <button onClick={() => delChat(c.id)} title={t('ai.delete')} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-500"><TrashIcon size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100dvh-108px)] md:h-[calc(100vh-32px)] flex max-w-4xl mx-auto">
      {/* History rail (desktop) */}
      <div className="hidden md:flex flex-col w-60 shrink-0 border-e border-black/10 dark:border-white/10">
        <div className="px-4 pt-3 font-bold text-[17px]">{t('ai.history')}</div>
        <div className="flex-1 min-h-0">{chatList}</div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <button onClick={() => setDrawer(true)} className="md:hidden btn-ghost !px-2.5" aria-label="History"><MenuIcon size={20} /></button>
          <span className="w-9 h-9 rounded-xl zivv-gradient text-white flex items-center justify-center shrink-0"><SparklesIcon size={18} /></span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[17px] leading-tight">{t('ai.title')}</div>
            <div className="text-[11px] opacity-50">{status?.live ? `● ${status.provider} · ${status.model}` : t('ai.demo')}</div>
          </div>
          {isGold && <CrownIcon size={20} className="text-amber-500" />}
          <button onClick={() => setShowAgent(!showAgent)} title={t('ai.agent')}
            className={`p-2.5 rounded-xl transition ${showAgent ? 'bg-zivv-purple text-white' : 'bg-black/5 dark:bg-white/10 opacity-70'}`}>
            <BotIcon size={19} />
          </button>
        </div>

        {!isGold && (
          <button onClick={() => nav('/gold')} className="mx-4 mb-1 flex items-center gap-2.5 p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-start">
            <CrownIcon size={20} className="text-amber-500 shrink-0" />
            <span className="flex-1 min-w-0"><span className="block text-[13px] font-bold">{t('ai.goldOnly')}</span><span className="block text-[11px] opacity-60">{t('ai.goldOnlySub')}</span></span>
          </button>
        )}

        {showAgent && (
          <div className="mx-4 mb-2 card p-3.5 space-y-2.5">
            {!isGold ? (
              <button onClick={() => nav('/gold')} className="w-full text-center py-2">
                <CrownIcon size={26} className="text-amber-500 mx-auto mb-1" />
                <div className="font-bold text-sm">{t('ai.agentLock')}</div>
              </button>
            ) : (
              <>
                <div className="font-bold text-sm flex items-center gap-2"><BotIcon size={17} />{t('ai.agent')}</div>
                <div className="flex gap-2">
                  <input value={instruction} onChange={(e) => setInstruction(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && makePlan()}
                    placeholder={t('ai.agentPh')} className="input !py-2 text-sm flex-1" />
                  <button onClick={makePlan} disabled={!instruction.trim() || planBusy} className="btn-primary !py-2 text-sm disabled:opacity-40">{planBusy ? '…' : t('ai.plan')}</button>
                </div>
                {plan && (
                  <div className="rounded-xl bg-black/5 dark:bg-white/10 p-3 text-sm space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-zivv-purple/15 text-zivv-purple">{plan.tool}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${plan.risk === 'LOW' ? 'bg-green-500/15 text-green-600' : plan.risk === 'MEDIUM' ? 'bg-amber-500/15 text-amber-600' : 'bg-red-500/15 text-red-500'}`}>{plan.risk}</span>
                    </div>
                    <div className="opacity-80">{plan.preview}</div>
                    <button onClick={execPlan} disabled={execBusy} className="btn-primary !py-1.5 text-sm w-full disabled:opacity-40 flex items-center justify-center gap-1.5">
                      <CheckIcon size={15} />{execBusy ? t('ai.executing') : t('ai.confirmExec')}
                    </button>
                    {!!execRes && <div className="text-xs font-mono opacity-70 break-words">{JSON.stringify(execRes.result || execRes)}</div>}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar">
          {MODES.map(([v, Icon]) => (
            <button key={v} onClick={() => setMode(v)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition shrink-0 flex items-center gap-1.5 ${mode === v ? 'tab-active' : 'bg-black/5 dark:bg-white/10 opacity-60'}`}>
              <Icon size={14} />{t('ai.m_' + v)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
          {msgs.length === 0 && (
            <div className="text-center pt-4">
              <div className="w-14 h-14 mx-auto rounded-2xl zivv-gradient text-white flex items-center justify-center mb-3"><SparklesIcon size={26} /></div>
              <div className="font-bold text-xl">{t('ai.hello')}</div>
              <div className="text-sm opacity-60 mt-1 mb-4">{t('ai.helloSub')}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-start">
                {suggestions(t).map((s, i) => (
                  <button key={i} onClick={() => ask(s)} className="card p-3.5 text-sm font-medium hover:border-zivv-purple/50 transition text-start">{s}</button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-zivv-purple text-white rounded-2xl rounded-ee-lg' : 'bg-black/[.06] dark:bg-white/10 rounded-2xl rounded-es-lg'
              }`}>
                {m.text}
                {m.role === 'ai' && (
                  <button onClick={() => speak(m.text)} className="flex items-center gap-1 mt-1.5 text-[11px] font-bold opacity-50 hover:opacity-100" title={t('ai.speak')}>
                    <VolumeIcon size={14} />{isGold ? t('ai.speak') : t('ai.goldTag')}
                  </button>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="bg-black/[.06] dark:bg-white/10 rounded-2xl rounded-es-lg px-4 py-3 flex gap-1.5">
                {[0, 1, 2].map((d) => <span key={d} className="w-2 h-2 rounded-full bg-current opacity-60 typing-dot" style={{ animationDelay: `${d * .18}s` }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Pinned composer */}
        <div className="p-3 sticky bottom-0 bg-white dark:bg-neutral-950 border-t border-black/5 dark:border-white/10">
          <div className="flex items-end gap-1.5 bg-black/[.06] dark:bg-white/10 rounded-2xl p-2 ps-3 max-w-3xl mx-auto">
            <button className="p-2 opacity-55 hover:opacity-100" aria-label="Image"><ImageIcon size={20} /></button>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
              placeholder={t('ai.ph')} className="flex-1 bg-transparent resize-none text-[15px] max-h-32 focus:outline-none placeholder:opacity-40 py-2" />
            <button onClick={toggleListen} title={t('ai.listen')}
              className={`p-2 rounded-xl transition ${listening ? 'bg-red-500 text-white animate-pulse' : 'opacity-55 hover:opacity-100'}`}>
              <MicIcon size={20} />
            </button>
            <button onClick={() => ask()} disabled={!text.trim() || busy}
              className="w-9 h-9 rounded-xl bg-zivv-purple text-white flex items-center justify-center disabled:opacity-40 shrink-0 rtl:rotate-180" aria-label="Send">
              <SendIcon size={17} />
            </button>
          </div>
          <div className="text-center text-[11px] opacity-40 mt-1.5">{t('ai.warn')}</div>
        </div>
      </div>

      {/* History drawer (mobile) */}
      {drawer && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 fade-in" onClick={() => setDrawer(false)} />
          <div className={`absolute start-0 top-0 bottom-0 w-[280px] bg-white dark:bg-neutral-950 shadow-2xl ${isRTL ? 'drawer-in-rtl' : 'drawer-in'} flex flex-col`}>
            <div className="p-3 flex items-center justify-between border-b border-black/5 dark:border-white/10">
              <span className="font-bold">{t('ai.history')}</span>
              <button onClick={() => setDrawer(false)} className="btn-ghost !px-2.5" aria-label="Close"><XIcon size={18} /></button>
            </div>
            <div className="flex-1 min-h-0">{chatList}</div>
          </div>
        </div>
      )}
    </div>
  );
}
