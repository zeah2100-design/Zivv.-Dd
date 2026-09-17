import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { Avatar } from '../components/ui';
import {
  SearchIcon, VaultIcon, EditIcon, ArrowLeftIcon, PhoneIcon, VideoCallIcon, DotsIcon,
  ImageIcon, MicIcon, SendIcon, SparklesIcon, CheckIcon, CheckDoubleIcon, ChatIcon as ChatBubbleIcon,
} from '../components/icons';

export function ChatList() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/chat/conversations').then((r) => setItems(r.data.items)); }, []);
  const filtered = items.filter((c) => !q || c.peer?.name?.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="px-3 md:px-0 pt-3 space-y-2">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-black">Chats</h1>
        <div className="flex gap-2">
          <Link to="/private" className="btn-ghost text-sm flex items-center gap-1.5"><VaultIcon size={16} />Private</Link>
          <button className="btn-primary !px-3" aria-label="New chat"><EditIcon size={18} /></button>
        </div>
      </div>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50"><SearchIcon size={17} /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats…" className="input !pl-10 !rounded-full" />
      </div>
      {filtered.map((c) => (
        <Link key={c.id} to={`/chat/${c.id}`} className="card p-3 flex items-center gap-3 hover:shadow-pop/50 transition">
          <div className="relative"><Avatar user={c.peer} size={52} />{c.online && <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-[2.5px] border-white dark:border-ink-900" />}</div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[15px] truncate">{c.peer?.name}</div>
            <div className="text-[13px] opacity-60 truncate">{c.typing ? <i className="text-zivv-purple not-italic font-semibold">typing…</i> : c.lastMessage}</div>
          </div>
          <div className="text-right shrink-0"><div className="text-[11px] opacity-50">{fmt.time(c.updatedAt)}</div>{c.unread > 0 && <span className="inline-block mt-1 min-w-[20px] text-center text-[11px] font-black text-white zivv-gradient rounded-full px-1.5 py-0.5">{c.unread}</span>}</div>
        </Link>
      ))}
      {!filtered.length && (
        <div className="card p-10 text-center"><ChatBubbleIcon size={48} className="mx-auto opacity-30" /><div className="font-bold mt-2">No chats yet</div><div className="text-sm opacity-60">Start a conversation from any profile.</div></div>
      )}
    </div>
  );
}

export function ChatRoom() {
  const id = location.pathname.split('/').pop();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [assist, setAssist] = useState([]);

  useEffect(() => { api.get(`/chat/conversations/${id}/messages`).then((r) => setMsgs(r.data.items)); }, [id]);

  const send = async () => {
    if (!text.trim()) return;
    const { data } = await api.post(`/chat/conversations/${id}/messages`, { text });
    setMsgs([...msgs, data]); setText('');
  };

  const ai = async (mode) => {
    const { data } = await api.post('/chat/ai-assist', { mode, text: text || msgs.slice(-1)[0]?.text || 'Hello!' });
    if (mode === 'reply') setAssist(Array.isArray(data.result) ? data.result : [data.result]);
    else setText(typeof data.result === 'string' ? data.result : text);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-129px)] md:h-[calc(100dvh-48px)] md:card md:overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-2 border-b border-black/5 dark:border-white/10">
        <Link to="/chat" className="btn-ghost !px-2.5" aria-label="Back"><ArrowLeftIcon size={20} /></Link>
        <Avatar user={{ name: 'Layla Hassan', username: 'layla' }} size={40} />
        <div className="flex-1 min-w-0 px-1"><div className="font-bold text-[15px] truncate">Layla Hassan</div><div className="text-[11px] text-green-500 font-semibold">online</div></div>
        <button className="btn-ghost !px-2.5" aria-label="Voice call"><PhoneIcon size={20} /></button>
        <button className="btn-ghost !px-2.5" aria-label="Video call"><VideoCallIcon size={20} /></button>
        <button className="btn-ghost !px-2.5" aria-label="More"><DotsIcon size={19} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <div className="text-center text-[11px] opacity-40 py-1">Messages are encrypted · AI only reads chat when you ask</div>
        {msgs.map((m) => (
          <div key={m.id} className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-[15px] w-fit ${m.senderId === 'u-you' ? 'ml-auto zivv-gradient text-white rounded-br-md' : 'bg-black/5 dark:bg-white/10 rounded-bl-md'}`}>
            {m.text}
            <div className={`text-[10px] mt-0.5 flex items-center justify-end gap-1 ${m.senderId === 'u-you' ? 'opacity-80' : 'opacity-50'}`}>
              {fmt.time(m.createdAt)}
              {m.senderId === 'u-you' && (m.state === 'read' ? <CheckDoubleIcon size={14} /> : <CheckIcon size={14} />)}
            </div>
          </div>
        ))}
        {!!assist.length && <div className="flex flex-wrap gap-2 pt-1">{assist.map((s, i) => <button key={i} onClick={() => setText(s)} className="text-xs px-3 py-1.5 rounded-full border border-zivv-purple/40 text-zivv-purple font-semibold flex items-center gap-1"><SparklesIcon size={12} />{s}</button>)}</div>}
      </div>
      <div className="p-2.5 border-t border-black/5 dark:border-white/10 space-y-2 bg-white dark:bg-ink-900">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-0.5">
          {[['reply', 'Replies'], ['translate', 'Translate'], ['summary', 'Summarize'], ['improve', 'Improve']].map(([mode, label]) => (
            <button key={mode} onClick={() => ai(mode)} className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 whitespace-nowrap flex items-center gap-1"><SparklesIcon size={11} className="text-zivv-purple" />{label}</button>
          ))}
        </div>
        <div className="flex gap-1.5 items-center">
          <button className="btn-ghost !px-2.5 shrink-0" aria-label="Send photo"><ImageIcon size={20} /></button>
          <button className="btn-ghost !px-2.5 shrink-0" aria-label="Voice message"><MicIcon size={20} /></button>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Message…" className="input !rounded-full" />
          <button onClick={send} className="btn-primary !px-3.5 !rounded-full shrink-0" aria-label="Send"><SendIcon size={18} /></button>
        </div>
      </div>
    </div>
  );
}
