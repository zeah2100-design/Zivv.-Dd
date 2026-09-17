import { useEffect, useState } from 'react';
import api, { fmt } from '../lib/api';

const tabs = [['all', 'All'], ['social', 'Social'], ['messages', 'Messages'], ['system', 'System'], ['ai', 'AI ✦'], ['ads', 'Ads']];
const icons = { social: '❤️', messages: '💬', system: '🛡️', ai: '✦', ads: '📣' };

export default function Notifications() {
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  useEffect(() => { load('all'); }, []);
  const load = async (t) => { setTab(t); const { data } = await api.get('/notifications', { params: { tab: t } }); setItems(data.items); };
  const readAll = async () => { await api.post('/notifications/read-all'); load(tab); };

  return (
    <div className="px-3 md:px-0 pt-3 space-y-3">
      <div className="flex justify-between items-center px-1"><h1 className="text-2xl font-black">Notifications</h1><button onClick={readAll} className="text-sm font-bold text-zivv-purple">Mark all read</button></div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">{tabs.map(([id, l]) => <button key={id} onClick={() => load(id)} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${tab === id ? 'tab-active' : 'bg-black/5 dark:bg-white/10'}`}>{l}</button>)}</div>
      {items.map((n) => (
        <div key={n.id} className={`card p-3.5 flex gap-3 ${n.read ? 'opacity-70' : ''}`}>
          <div className="w-10 h-10 rounded-2xl zivv-gradient flex items-center justify-center text-lg shrink-0">{icons[n.category] || '🔔'}</div>
          <div className="flex-1"><div className="font-bold text-sm">{n.title}</div><div className="text-xs opacity-60">{n.body}</div><div className="text-[11px] opacity-40 mt-0.5">{fmt.time(n.createdAt)} {!n.read && <span className="text-zivv-purple font-bold">• new</span>}</div></div>
        </div>
      ))}
      {!items.length && <div className="card p-10 text-center opacity-50">All caught up 🎉</div>}
    </div>
  );
}
