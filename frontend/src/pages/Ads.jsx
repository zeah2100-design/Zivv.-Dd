import { useEffect, useState } from 'react';
import api, { fmt } from '../lib/api';

const flow = ['DRAFT', 'PENDING_REVIEW', 'PENDING_PAYMENT', 'ACTIVE', 'COMPLETED'];

export default function Ads() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [budget, setBudget] = useState('500');
  useEffect(() => { api.get('/ads').then((r) => setItems(r.data.items)); }, []);

  const create = async () => {
    const { data } = await api.post('/ads', { title: title || 'My campaign', budgetCents: Math.round(parseFloat(budget || '0') * 100), durationDays: 7 });
    setItems([data, ...items]); setTitle('');
  };

  return (
    <div className="px-3 md:px-0 pt-3 space-y-3">
      <h1 className="text-2xl font-black px-1">Ads Manager 📣</h1>
      <div className="card p-4 space-y-2">
        <div className="font-black">Create campaign</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Campaign title" className="input" />
        <div className="flex gap-2"><input value={budget} onChange={(e) => setBudget(e.target.value)} type="number" placeholder="Budget (EGP)" className="input" /><input placeholder="7 days" className="input" disabled /></div>
        <div className="text-[11px] opacity-60">Flow: Draft → Review → Payment (verified via provider) → Active. Delivery depends on budget, relevance & quality — never a fixed impression promise.</div>
        <button onClick={create} className="btn-primary w-full">Submit for review</button>
      </div>
      {items.map((c) => (
        <div key={c.id} className="card p-4">
          <div className="flex justify-between items-center"><div className="font-bold">{c.title}</div><span className="text-[11px] font-black px-2 py-1 rounded-full bg-black/5 dark:bg-white/10">{c.status}</span></div>
          <div className="flex gap-1 mt-2">{flow.map((s) => <div key={s} className={`h-1.5 flex-1 rounded-full ${flow.indexOf(s) <= flow.indexOf(c.status) ? 'zivv-gradient' : 'bg-black/10 dark:bg-white/10'}`} />)}</div>
          <div className="grid grid-cols-4 gap-2 mt-3 text-center text-xs">
            <div><div className="font-black">{fmt.money(c.budgetCents)}</div><div className="opacity-50">Budget</div></div>
            <div><div className="font-black">{fmt.n(c.impressions)}</div><div className="opacity-50">Impr.</div></div>
            <div><div className="font-black">{fmt.n(c.clicks)}</div><div className="opacity-50">Clicks</div></div>
            <div><button onClick={() => api.post(`/ads/${c.id}/${c.status === 'ACTIVE' ? 'pause' : 'resume'}`)} className="btn-ghost !py-1 text-xs w-full">{c.status === 'ACTIVE' ? 'Pause' : '▶'}</button></div>
          </div>
        </div>
      ))}
    </div>
  );
}
