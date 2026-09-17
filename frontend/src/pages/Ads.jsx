import { useEffect, useState } from 'react';
import api, { fmt } from '../lib/api';
import { MegaphoneIcon, PlayIcon, PauseIcon, PlusIcon, TargetIcon, GaugeIcon } from '../components/icons';

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
    <div className="px-3 md:px-0 pt-3 space-y-3 pb-6">
      <h1 className="text-2xl font-black px-1 flex items-center gap-2"><MegaphoneIcon size={24} />Ads Manager</h1>
      <div className="card p-4 space-y-2.5">
        <div className="font-black flex items-center gap-2"><PlusIcon size={18} />Create campaign</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Campaign title" className="input" />
        <div className="flex gap-2">
          <input value={budget} onChange={(e) => setBudget(e.target.value)} type="number" placeholder="Budget (EGP)" className="input" />
          <input placeholder="7 days" className="input opacity-60" disabled />
        </div>
        <div className="text-[11px] opacity-60 flex gap-1.5"><TargetIcon size={14} className="shrink-0 mt-0.5" /><span>Flow: Draft → Review → Verified payment → Active. Delivery depends on budget, relevance & quality.</span></div>
        <button onClick={create} className="btn-primary w-full">Submit for review</button>
      </div>
      {items.map((c) => (
        <div key={c.id} className="card p-4">
          <div className="flex justify-between items-center gap-2"><div className="font-bold truncate">{c.title}</div><span className={`text-[10px] font-black px-2.5 py-1 rounded-full whitespace-nowrap ${c.status === 'ACTIVE' ? 'bg-green-500/15 text-green-600' : 'bg-black/5 dark:bg-white/10'}`}>{c.status.replace(/_/g, ' ')}</span></div>
          <div className="flex gap-1 mt-2.5">{flow.map((s) => <div key={s} className={`h-1.5 flex-1 rounded-full ${flow.indexOf(s) <= flow.indexOf(c.status) ? 'zivv-gradient' : 'bg-black/10 dark:bg-white/10'}`} />)}</div>
          <div className="grid grid-cols-4 gap-2 mt-3 text-center">
            <div className="p-2 rounded-2xl bg-black/[.04] dark:bg-white/[.06]"><div className="font-black text-sm">{fmt.money(c.budgetCents)}</div><div className="text-[10px] opacity-50 font-bold">BUDGET</div></div>
            <div className="p-2 rounded-2xl bg-black/[.04] dark:bg-white/[.06]"><div className="font-black text-sm">{fmt.n(c.impressions)}</div><div className="text-[10px] opacity-50 font-bold">REACH</div></div>
            <div className="p-2 rounded-2xl bg-black/[.04] dark:bg-white/[.06]"><div className="font-black text-sm">{fmt.n(c.clicks)}</div><div className="text-[10px] opacity-50 font-bold">CLICKS</div></div>
            <button onClick={() => api.post(`/ads/${c.id}/${c.status === 'ACTIVE' ? 'pause' : 'resume'}`)} className="p-2 rounded-2xl bg-black/[.04] dark:bg-white/[.06] flex items-center justify-center gap-1 text-xs font-bold" aria-label="Pause or resume">
              {c.status === 'ACTIVE' ? <PauseIcon size={15} /> : <PlayIcon size={14} />}{c.status === 'ACTIVE' ? 'Pause' : 'Start'}
            </button>
          </div>
        </div>
      ))}
      {!items.length && <div className="card p-10 text-center"><GaugeIcon size={44} className="mx-auto opacity-30" /><div className="font-bold mt-2">No campaigns yet</div><div className="text-sm opacity-50">Create your first campaign above.</div></div>}
    </div>
  );
}
