import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { useZivv } from '../lib/store';
import { useLang } from '../lib/i18n';
import { Avatar } from '../components/ui';
import PageLoader from '../components/PageLoader';
import { BackIcon, SendIcon, SearchIcon, ImageIcon, SmileIcon, CheckDoubleIcon } from '../components/icons';

function timeHM(ts) {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

export function ConversationList({ onPick, activeId }) {
  const { t } = useLang();
  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  useEffect(() => {
    api.get('/chat/conversations').then((r) => setConvs(r.data.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const filtered = convs.filter((c) => !q || c.peer?.name?.toLowerCase().includes(q.toLowerCase()) || c.peer?.username?.toLowerCase().includes(q.toLowerCase()));
  if (loading) return <PageLoader />;
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 bg-black/5 dark:bg-white/10 rounded-full px-4 py-2.5">
          <SearchIcon size={18} className="opacity-50 shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('chat.searchPh')} className="bg-transparent flex-1 text-sm focus:outline-none placeholder:opacity-40" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-4">
        {filtered.map((c) => (
          <button key={c.id} onClick={() => onPick(c)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-start transition hover:bg-black/5 dark:hover:bg-white/5 ${activeId === c.id ? 'bg-black/5 dark:bg-white/10' : ''}`}>
            <span className="relative shrink-0">
              <Avatar user={c.peer} size={52} />
              {c.online && <span className="absolute bottom-0.5 end-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white dark:border-neutral-950" />}
              {!!c.unread && <span className="absolute -top-0.5 -end-0.5 badge-count">{c.unread}</span>}
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-bold truncate">{c.peer?.name}</span>
                <span className="text-[11px] opacity-50 shrink-0">{c.updatedAt ? fmt.time(c.updatedAt) : ''}</span>
              </span>
              <span className={`block text-[13px] truncate ${c.unread ? 'font-bold opacity-90' : 'opacity-55'}`}>
                {c.lastMessage || t('chat.newConv')}
              </span>
            </span>
          </button>
        ))}
        {filtered.length === 0 && <div className="text-center text-sm opacity-50 py-10">{t('chat.noResults')}</div>}
      </div>
    </div>
  );
}

export function Thread({ convId, peer, online, onBack }) {
  const { user } = useZivv();
  const { t } = useLang();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  useEffect(() => {
    setLoading(true);
    api.get(`/chat/conversations/${convId}/messages`).then((r) => setMsgs(r.data.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, [convId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length, loading]);
  const send = async () => {
    if (!text.trim()) return;
    const body = text; setText('');
    const tmp = { id: 'tmp-' + Date.now(), text: body, senderId: user?.id, createdAt: new Date().toISOString(), state: 'sending' };
    setMsgs((m) => [...m, tmp]);
    try {
      const r = await api.post(`/chat/conversations/${convId}/messages`, { text: body });
      if (r.data?.id) setMsgs((m) => [...m.filter((x) => x.id !== tmp.id), r.data]);
    } catch { setMsgs((m) => m.filter((x) => x.id !== tmp.id)); }
  };
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-2 py-2 border-b border-black/5 dark:border-white/10 sticky top-0 backdrop-blur-xl bg-white/85 dark:bg-black/85 z-10">
        {onBack && <button onClick={onBack} className="btn-ghost !px-2.5 rtl:rotate-180" aria-label="Back"><BackIcon size={20} /></button>}
        <Avatar user={peer} size={40} />
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{peer?.name}</div>
          <div className={`text-[11px] font-semibold ${online ? 'text-green-500' : 'opacity-50'}`}>{online ? `● ${t('chat.online')}` : t('chat.offline')}</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 chat-bg">
        {loading && <PageLoader />}
        {msgs.map((m, i) => {
          const mine = m.senderId === user?.id;
          const showTail = i === 0 || (msgs[i - 1]?.senderId === user?.id) !== mine;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3.5 py-2 text-[15px] leading-snug break-words ${
                mine
                  ? `bg-zivv-purple text-white rounded-2xl ${showTail ? 'rounded-ee-md' : ''}`
                  : `bg-black/[.07] dark:bg-white/15 rounded-2xl ${showTail ? 'rounded-es-md' : ''}`
              }`}>
                {m.text}
                <span className={`flex items-center justify-end gap-1 text-[10px] mt-0.5 ${mine ? 'text-white/70' : 'opacity-50'}`}>
                  {timeHM(m.createdAt)}
                  {mine && <CheckDoubleIcon size={13} className={m.state === 'read' ? '!text-white' : ''} />}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="p-2.5 border-t border-black/5 dark:border-white/10 flex items-center gap-1.5 sticky bottom-0 bg-white dark:bg-neutral-950">
        <button className="p-2.5 rounded-full opacity-55 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Emoji"><SmileIcon size={22} /></button>
        <button className="p-2.5 rounded-full opacity-55 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Photo"><ImageIcon size={22} /></button>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={t('chat.typeMsg')} className="input !rounded-full flex-1" />
        <button onClick={send} disabled={!text.trim()} className="btn-primary !p-3 !rounded-full disabled:opacity-40 shrink-0 rtl:rotate-180" aria-label="Send">
          <SendIcon size={18} />
        </button>
      </div>
    </div>
  );
}

export default function Chat() {
  const { t } = useLang();
  const { id } = useParams();
  const nav = useNavigate();
  const [active, setActive] = useState(null);
  useEffect(() => {
    if (!id) { setActive(null); return; }
    api.get('/chat/conversations').then((r) => {
      const c = (r.data.items || []).find((x) => String(x.id) === String(id));
      if (c) setActive(c);
    }).catch(() => {});
  }, [id]);
  const pick = (c) => { setActive(c); nav(`/chat/${c.id}`, { replace: true }); };
  return (
    <div className="h-[calc(100dvh-108px)] md:h-[calc(100vh-32px)] flex">
      <div className={`${active ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[340px] md:border-e md:border-black/10 md:dark:border-white/10`}>
        <div className="px-4 pt-3 pb-1 font-bold text-xl">{t('chat.title')}</div>
        <div className="flex-1 min-h-0"><ConversationList onPick={pick} activeId={active?.id} /></div>
      </div>
      <div className={`${active ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-w-0`}>
        {active
          ? <Thread convId={active.id} peer={active.peer} online={active.online} onBack={() => { setActive(null); nav('/chat', { replace: true }); }} />
          : <div className="flex-1 hidden md:flex flex-col items-center justify-center opacity-40 gap-3">
              <img src="/logo.png" alt="" className="w-20 h-20 rounded-[28%] opacity-50" />
              <div className="font-bold">{t('chat.pick')}</div>
            </div>}
      </div>
    </div>
  );
}
