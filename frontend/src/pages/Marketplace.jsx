import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { Avatar, ZImg } from '../components/ui';
import {
  SearchIcon, BagIcon, ArrowLeftIcon, ChatIcon, PhoneIcon, FlagIcon, BanIcon,
  AlertTriangleIcon, MapPinIcon, TagIcon, CheckDoubleIcon,
} from '../components/icons';

export function Marketplace() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  useEffect(() => { api.get('/marketplace').then((r) => { setItems(r.data.items); setCats(r.data.categories); }); }, []);
  const run = async (query = q, c = cat) => { const { data } = await api.get('/marketplace', { params: { q: query, category: c || undefined } }); setItems(data.items); };

  return (
    <div className="px-3 md:px-0 pt-3 space-y-3">
      <h1 className="text-2xl font-black px-1 flex items-center gap-2"><BagIcon size={24} />Marketplace</h1>
      <div className="text-xs bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3 flex gap-2"><AlertTriangleIcon size={16} className="text-amber-500 shrink-0 mt-0.5" /><span>ZIVV facilitates <b>discovery + communication only</b>. Transaction, payment, pickup, delivery & verification are between buyer and seller.</span></div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50"><SearchIcon size={17} /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="Search products…" className="input !pl-10 !rounded-full" />
        </div>
        <button onClick={() => run()} className="btn-primary !rounded-full">Search</button>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <button onClick={() => { setCat(''); run(q, ''); }} className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${!cat ? 'tab-active' : 'bg-black/5 dark:bg-white/10'}`}>All</button>
        {cats.map((c) => <button key={c} onClick={() => { setCat(c); run(q, c); }} className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${cat === c ? 'tab-active' : 'bg-black/5 dark:bg-white/10'}`}>{c}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((l) => (
          <Link key={l.id} to={`/market/${l.id}`} className="card overflow-hidden !rounded-2xl hover:shadow-lg transition">
            <div className="aspect-square zivv-gradient relative">
              <ZImg seed={`listing-${l.id}`} w={400} h={400} className="absolute inset-0 w-full h-full object-cover" alt={l.title} />
              <span className={`absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full backdrop-blur ${l.status === 'available' ? 'bg-green-500/85 text-white' : 'bg-red-500/85 text-white'}`}>{l.status === 'available' ? 'Available' : 'Sold'}</span>
            </div>
            <div className="p-2.5"><div className="text-sm font-bold truncate">{l.title}</div><div className="font-black text-zivv-purple">{fmt.money(l.priceCents, l.currency)}</div><div className="text-[11px] opacity-60 truncate">{l.seller?.name} · {l.condition}</div></div>
          </Link>
        ))}
      </div>
      {!items.length && <div className="card p-10 text-center opacity-50">No products found</div>}
    </div>
  );
}

export function ProductDetail() {
  const { id } = useParams();
  const [l, setL] = useState(null);
  const [showPhone, setShowPhone] = useState(false);
  const nav = useNavigate();
  useEffect(() => { api.get(`/marketplace/${id}`).then((r) => setL(r.data)); }, [id]);
  if (!l) return <div className="p-6 text-center opacity-50">Loading…</div>;
  return (
    <div className="pt-3 px-3 md:px-0 space-y-3 pb-6">
      <button onClick={() => nav(-1)} className="btn-ghost text-sm flex items-center gap-1.5 w-fit"><ArrowLeftIcon size={17} />Back</button>
      <div className="card overflow-hidden">
        <div className="aspect-[4/3] zivv-gradient relative">
          <ZImg seed={`listing-${l.id}`} w={800} h={600} className="absolute inset-0 w-full h-full object-cover" alt={l.title} />
          <span className={`absolute top-3 left-3 text-xs font-black px-3 py-1 rounded-full backdrop-blur ${l.status === 'available' ? 'bg-green-500/85 text-white' : 'bg-red-500/85 text-white'}`}>{l.status}</span>
        </div>
        <div className="p-4">
          <h1 className="text-xl font-black leading-snug">{l.title}</h1>
          <div className="text-2xl font-black text-zivv-purple mt-1">{fmt.money(l.priceCents, l.currency)}</div>
          <p className="text-sm mt-2.5 opacity-80 leading-relaxed">{l.description}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 flex items-center gap-1.5"><TagIcon size={13} />{l.condition}</span>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 flex items-center gap-1.5"><BagIcon size={13} />{l.category}</span>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 flex items-center gap-1.5"><MapPinIcon size={13} />Giza, Egypt</span>
          </div>
          <div className="flex items-center gap-2.5 mt-4 p-3 rounded-2xl bg-black/[.04] dark:bg-white/[.06]">
            <Avatar user={l.seller} size={46} />
            <div className="flex-1 min-w-0"><div className="font-bold text-sm flex items-center gap-1.5">{l.seller?.name}<CheckDoubleIcon size={15} className="text-zivv-blue" /></div><div className="text-xs opacity-60">@{l.seller?.username} · Seller</div></div>
            <Link to={`/u/${l.seller?.username}`} className="btn-ghost text-sm">Profile</Link>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => nav('/chat')} className="btn-primary flex items-center justify-center gap-2"><ChatIcon size={18} />Message</button>
            <button onClick={() => setShowPhone(!showPhone)} className="btn-ghost flex items-center justify-center gap-2"><PhoneIcon size={18} />{showPhone ? (l.phonePublic ? '+20 1•• ••• ••42' : 'Private') : 'Call seller'}</button>
          </div>
          {!l.phonePublic && showPhone && <div className="text-xs text-center opacity-60 mt-1.5">Seller chose to keep their number private — use ZIVV messages.</div>}
          <div className="flex gap-2 mt-2">
            <button onClick={() => api.post(`/marketplace/${l.id}/report`).then(() => alert('Report received. Our team will review.'))} className="btn-ghost text-xs flex-1 flex items-center justify-center gap-1.5"><FlagIcon size={14} />Report product</button>
            <button className="btn-ghost text-xs flex-1 flex items-center justify-center gap-1.5"><BanIcon size={14} />Block seller</button>
          </div>
          <div className="text-[11px] opacity-70 mt-3 p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex gap-2"><AlertTriangleIcon size={15} className="text-amber-500 shrink-0 mt-0.5" /><span>Safety: meet in public, verify the product before paying, never send deposits in advance. ZIVV does not guarantee transactions.</span></div>
        </div>
      </div>
    </div>
  );
}
