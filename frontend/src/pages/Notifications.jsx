import { useEffect, useState } from 'react';
import api, { fmt } from '../lib/api';
import { HeartIcon, ChatIcon, ShieldIcon, SparklesIcon, MegaphoneIcon, BellIcon, CheckDoubleIcon } from '../components/icons';

const tabs = [['all', 'All'], ['social', 'Social'], ['messages', 'Messages'], ['system', 'System'], ['ai', 'AI'], ['ads', 'Ads']];
const icons = { social: HeartIcon, messages: ChatIcon, system: ShieldIcon, ai: SparklesIcon, ads: MegaphoneIcon };

export default function Notifications() {
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  useEffect(() => { load('all'); }, []);
  const load = async (t) => { setTab(t); const { data } = await api.get('/notifications', { params: { tab: t } }); setItems(data.items); };
  const readAll = async () => { await api.post('/notifications/read-all'); load(tab); };

  return (
    <div className="px-3 md:px-0 pt-3 space-y-3">
      <div className="flex justify-between items-center px-1">
        <h1 className="text-2xl font-black flex items-center gap-2"><BellIcon size={24} />Notifications</h1>
        <button onClick={readAll} className="text-sm font-bold text-zivv-purple flex items-center gap-1.5"><CheckDoubleIcon size={16} />Mark all read</button>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">{tabs.map(([id, l]) => <button key={id} onClick={() => load(id)} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition ${tab === id ? 'tab-active' : 'bg-black/5 dark:bg-white/10'}`}>{l}</button>)}</div>
      {items.map((n) => {
        const Icon = icons[n.category] || BellIcon;
        return (
          <div key={n.id} className={`card p-3.5 flex gap-3 ${n.read ? 'opacity-70' : ''}`}>
            <div className="w-11 h-11 rounded-2xl zivv-gradient flex items-center justify-center text-white shrink-0"><Icon size={20} /></div>
            <div className="flex-1 min-w-0"><div className="font-bold text-sm">{n.title}</div><div className="text-[13px] opacity-60 line-clamp-2">{n.body}</div><div className="text-[11px] opacity-40 mt-0.5">{fmt.time(n.createdAt)} {!n.read && <span className="text-zivv-purple font-bold">· New</span>}</div></div>
            {!n.read && <span className="w-2.5 h-2.5 rounded-full zivv-gradient shrink-0 mt-1.5" />}
          </div>
        );
      })}
      {!items.length && <div className="card p-10 text-center"><BellIcon size={48} className="mx-auto opacity-30" /><div className="font-bold mt-2">All caught up</div><div className="text-sm opacity-50">No new notifications</div></div>}
    </div>
  );
}
