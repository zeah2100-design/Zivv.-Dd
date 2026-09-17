import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { Avatar } from '../components/ui';

export function Marketplace() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/marketplace').then((r) => { setItems(r.data.items); setCats(r.data.categories); }); }, []);
  const run = async () => { const { data } = await api.get('/marketplace', { params: { q } }); setItems(data.items); };

  return (
    <div className="px-3 md:px-0 pt-3 space-y-3">
      <h1 className="text-2xl font-black px-1">Marketplace 🛍️</h1>
      <div className="text-xs bg-amber-500/15 border border-amber-500/30 rounded-2xl p-3">ZIVV facilitates <b>discovery + communication only</b>. Transaction, payment, pickup, delivery & verification are between buyer and seller.</div>
      <div className="flex gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="Search products…" className="input" /><button onClick={run} className="btn-primary">Go</button></div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">{cats.map((c) => <button key={c} className="px-3.5 py-1.5 rounded-full bg-black/5 dark:bg-white/10 text-xs font-bold whitespace-nowrap">{c}</button>)}</div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((l) => (
          <Link key={l.id} to={`/market/${l.id}`} className="card overflow-hidden">
            <div className="h-32 zivv-gradient flex items-center justify-center text-4xl">🛍️</div>
            <div className="p-2.5"><div className="text-sm font-bold truncate">{l.title}</div><div className="font-black text-zivv-purple">{fmt.money(l.priceCents, l.currency)}</div><div className="text-[11px] opacity-60">{l.seller?.name} • {l.status === 'available' ? '🟢 Available' : '🔴 Sold'}</div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ProductDetail() {
  const { id } = useParams();
  const [l, setL] = useState(null);
  const nav = useNavigate();
  useEffect(() => { api.get(`/marketplace/${id}`).then((r) => setL(r.data)); }, [id]);
  if (!l) return <div className="p-6 text-center opacity-50">Loading…</div>;
  return (
    <div className="pt-3 px-3 md:px-0 space-y-3">
      <button onClick={() => nav(-1)} className="btn-ghost text-sm">← Back</button>
      <div className="card overflow-hidden"><div className="h-64 zivv-gradient flex items-center justify-center text-7xl">🛍️</div>
        <div className="p-4">
          <div className="flex justify-between items-start"><h1 className="text-xl font-black">{l.title}</h1><span className={`text-xs font-bold px-2.5 py-1 rounded-full ${l.status === 'available' ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-500'}`}>{l.status}</span></div>
          <div className="text-2xl font-black text-zivv-purple mt-1">{fmt.money(l.priceCents, l.currency)}</div>
          <p className="text-sm mt-2 opacity-80">{l.description}</p>
          <div className="text-xs opacity-60 mt-1">Condition: {l.condition} • Category: {l.category}</div>
          <div className="flex items-center gap-2 mt-4 card !rounded-2xl p-3"><Avatar user={l.seller} size={42} /><div className="flex-1"><div className="font-bold text-sm">{l.seller?.name}</div><div className="text-xs opacity-60">@{l.seller?.username}</div></div><Link to={`/u/${l.seller?.username}`} className="btn-ghost text-sm">Profile</Link></div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => nav('/chat')} className="btn-primary">💬 Message seller</button>
            <button className="btn-ghost">{l.phonePublic ? '📞 Show number' : '📞 Private number'}</button>
          </div>
          <div className="flex gap-2 mt-2"><button onClick={() => api.post(`/marketplace/${l.id}/report`).then(() => alert('Reported 🚩'))} className="btn-ghost text-xs flex-1">🚩 Report product</button><button className="btn-ghost text-xs flex-1">🚫 Block seller</button></div>
          <div className="text-[11px] opacity-60 mt-3 p-3 bg-black/5 dark:bg-white/5 rounded-2xl">⚠️ Safety: meet in public, verify the product before paying, never send deposits in advance. ZIVV does not guarantee transactions.</div>
        </div>
      </div>
    </div>
  );
}
