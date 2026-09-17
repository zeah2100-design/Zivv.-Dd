import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { useLang } from '../lib/i18n';
import { SparklesIcon, SendIcon, ImageIcon, MicIcon, PlusIcon } from '../components/icons';

const suggestions = (t) => [t('ai.s1'), t('ai.s2'), t('ai.s3'), t('ai.s4')];
const modePrefix = {
  chat: '',
  caption: 'Write a catchy social caption for this: ',
  ideas: 'Give me 5 creative content ideas about: ',
  reply: 'Draft a friendly short reply to this message: ',
};

export default function AiCopilot() {
  const { t, lang } = useLang();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('chat');
  const [status, setStatus] = useState(null);
  const chatId = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => { api.get('/ai/status').then((r) => setStatus(r.data)).catch(() => {}); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length, busy]);

  const ensureChat = async () => {
    if (chatId.current) return chatId.current;
    const r = await api.post('/ai/chats');
    chatId.current = r.data.id;
    return chatId.current;
  };

  const ask = async (prompt) => {
    const q = (prompt ?? text).trim();
    if (!q || busy) return;
    setText('');
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const id = await ensureChat();
      const r = await api.post(`/ai/chats/${id}/messages`, { text: (modePrefix[mode] || '') + q });
      setMsgs((m) => [...m, { role: 'ai', text: r.data?.text || '…' }]);
    } catch {
      setMsgs((m) => [...m, { role: 'ai', text: t('ai.err') }]);
    } finally { setBusy(false); }
  };

  const newChat = () => { chatId.current = null; setMsgs([]); };

  return (
    <div className="h-[calc(100dvh-108px)] md:h-[calc(100vh-32px)] flex flex-col max-w-3xl mx-auto">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="w-10 h-10 rounded-2xl zivv-gradient text-white flex items-center justify-center shrink-0"><SparklesIcon size={20} /></span>
        <div className="flex-1">
          <div className="font-black text-lg leading-tight">{t('ai.title')}</div>
          <div className="text-[11px] opacity-50">{status?.live ? `● ${status.provider} · ${status.model}` : t('ai.demo')}</div>
        </div>
        <button onClick={newChat} className="btn-ghost !py-2 text-sm" title={t('ai.new')}><PlusIcon size={17} /></button>
      </div>

      <div className="flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar">
        {[['chat', '💬'], ['caption', '✍️'], ['ideas', '💡'], ['reply', '↩️']].map(([v, e]) => (
          <button key={v} onClick={() => setMode(v)}
            className={`text-xs font-black px-3.5 py-1.5 rounded-full transition shrink-0 ${mode === v ? 'tab-active' : 'bg-black/5 dark:bg-white/10 opacity-60'}`}>
            {e} {t('ai.m_' + v)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {msgs.length === 0 && (
          <div className="text-center pt-6">
            <div className="w-16 h-16 mx-auto rounded-3xl zivv-gradient text-white flex items-center justify-center mb-3"><SparklesIcon size={28} /></div>
            <div className="font-black text-xl">{t('ai.hello')}</div>
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
              m.role === 'user' ? 'zivv-gradient text-white rounded-3xl rounded-ee-lg' : 'bg-black/[.06] dark:bg-white/10 rounded-3xl rounded-es-lg'
            }`}>{m.text}</div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-black/[.06] dark:bg-white/10 rounded-3xl rounded-es-lg px-4 py-3 flex gap-1.5">
              {[0, 1, 2].map((d) => <span key={d} className="w-2 h-2 rounded-full bg-current opacity-60 typing-dot" style={{ animationDelay: `${d * .18}s` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3">
        <div className="flex items-end gap-2 bg-black/[.06] dark:bg-white/10 rounded-[26px] p-2 ps-4">
          <button className="p-2 opacity-55 hover:opacity-100" aria-label="Image"><ImageIcon size={21} /></button>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
            placeholder={t('ai.ph')} className="flex-1 bg-transparent resize-none text-[15px] max-h-32 focus:outline-none placeholder:opacity-40 py-2" />
          <button className="p-2 opacity-55 hover:opacity-100" aria-label="Voice"><MicIcon size={21} /></button>
          <button onClick={() => ask()} disabled={!text.trim() || busy}
            className="w-10 h-10 rounded-full zivv-gradient text-white flex items-center justify-center disabled:opacity-40 shrink-0 rtl:rotate-180" aria-label="Send">
            <SendIcon size={18} />
          </button>
        </div>
        <div className="text-center text-[11px] opacity-40 mt-1.5">{t('ai.warn')}</div>
      </div>
    </div>
  );
}
