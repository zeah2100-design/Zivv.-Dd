import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { Avatar } from '../components/ui';

export function ChatList() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/chat/conversations').then((r) => setItems(r.data.items)); }, []);
  const filtered = items.filter((c) => !q || c.peer?.name?.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="px-3 md:px-0 pt-3 space-y-2">
      <div className="flex items-center justify-between px-1"><h1 className="text-2xl font-black">Chats</h1><div className="flex gap-2"><Link to="/private" className="btn-ghost">🔒 Private</Link><button className="btn-primary !px-3">✎</button></div></div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats…" className="input" />
      {filtered.map((c) => (
        <Link key={c.id} to={`/chat/${c.id}`} className="card p-3 flex items-center gap-3">
          <div className="relative"><Avatar user={c.peer} size={50} />{c.online && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-ink-900" />}</div>
          <div className="flex-1 min-w-0"><div className="font-bold text-sm">{c.peer?.name}</div><div className="text-xs opacity-60 truncate">{c.typing ? <i className="text-zivv-purple">typing…</i> : c.lastMessage}</div></div>
          <div className="text-right"><div className="text-[11px] opacity-50">{fmt.time(c.updatedAt)}</div>{c.unread > 0 && <span className="inline-block mt-1 min-w-[20px] text-center text-[11px] font-black text-white zivv-gradient rounded-full px-1.5 py-0.5">{c.unread}</span>}</div>
        </Link>
      ))}
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
    <div className="flex flex-col h-[calc(100dvh-130px)] md:h-[calc(100dvh-48px)]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-black/5 dark:border-white/10">
        <Link to="/chat" className="btn-ghost !px-2.5">←</Link>
        <Avatar user={{ name: 'Layla Hassan' }} size={38} />
        <div className="flex-1"><div className="font-bold text-sm">Layla Hassan</div><div className="text-[11px] text-green-500">online</div></div>
        <button className="btn-ghost !px-2.5">📞</button><button className="btn-ghost !px-2.5">🎥</button><button className="btn-ghost !px-2.5">•••</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {msgs.map((m) => (
          <div key={m.id} className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${m.senderId === 'u-you' ? 'ml-auto zivv-gradient text-white rounded-br-md' : 'bg-black/5 dark:bg-white/10 rounded-bl-md'}`}>
            {m.text}<div className="text-[10px] opacity-70 text-right mt-0.5">{fmt.time(m.createdAt)} {m.senderId === 'u-you' && (m.state === 'read' ? '✓✓' : '✓')}</div>
          </div>
        ))}
        {!!assist.length && <div className="flex flex-wrap gap-2">{assist.map((s, i) => <button key={i} onClick={() => setText(s)} className="text-xs px-3 py-1.5 rounded-full border border-zivv-purple/40 text-zivv-purple font-semibold">✦ {s}</button>)}</div>}
      </div>
      <div className="p-2 border-t border-black/5 dark:border-white/10 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-1">
          <button onClick={() => ai('reply')} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 whitespace-nowrap">✦ Replies</button>
          <button onClick={() => ai('translate')} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 whitespace-nowrap">✦ Translate</button>
          <button onClick={() => ai('summary')} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 whitespace-nowrap">✦ Summarize</button>
          <button onClick={() => ai('improve')} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 whitespace-nowrap">✦ Improve</button>
        </div>
        <div className="flex gap-2 items-center">
          <button className="btn-ghost !px-2.5">😊</button><button className="btn-ghost !px-2.5">📎</button>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Message… (AI only reads chat when you ask ✦)" className="input" />
          <button className="btn-ghost !px-2.5">🎙️</button>
          <button onClick={send} className="btn-primary !px-4">➤</button>
        </div>
      </div>
    </div>
  );
}
