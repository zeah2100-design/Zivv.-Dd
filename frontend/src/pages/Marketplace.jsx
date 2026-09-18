import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { useLang } from '../lib/i18n';
import { Avatar, Empty } from '../components/ui';
import { useListingImage } from '../lib/media';
import PageLoader from '../components/PageLoader';
import { openConversation } from './Chat';
import { SearchIcon, BagIcon, BackIcon, FlagIcon, PhoneIcon, ChatIcon, ShieldIcon, PlusIcon } from '../components/icons';

function ListingCard({ l, onOpen }) {
  const img = useListingImage(l);
  return (
    <button onClick={onOpen} className="card overflow-hidden text-start">
      <div className="aspect-square bg-neutral-100 dark:bg-white/5 relative">
        {img === null ? <div className="w-full h-full animate-pulse bg-black/5 dark:bg-white/10" />
          : img ? <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-neutral-300 dark:text-neutral-600"><BagIcon size={34} /></div>}
        {l.status !== 'available' && <span className="absolute top-2 start-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 text-white">{l.status}</span>}
      </div>
      <div className="p-2.5">
        <div className="font-bold">{fmt.money(l.priceCents, l.currency)}</div>
        <div className="text-xs opacity-60 truncate">{l.title}</div>
        <div className="text-[11px] opacity-40 truncate">{l.category} · {l.condition}</div>
      </div>
    </button>
  );
}

export function Marketplace() {
  const { t } = useLang();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/marketplace', { params: { q: q || undefined, category: cat || undefined } });
      setItems(r.data.items || []); setCats(r.data.categories || []);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [cat]);
  if (loading) return <PageLoader />;

  return (
    <div className="p-3 md:p-4 max-w-3xl mx-auto space-y-3">
      <div className="flex items-center gap-2 px-1">
        <h1 className="font-bold text-xl flex-1">{t('market.title')}</h1>
        <button onClick={() => nav('/create')} className="btn-primary !p-2.5 !rounded-full" aria-label="Sell"><PlusIcon size={19} /></button>
      </div>
      <div className="flex items-center gap-2 bg-black/5 dark:bg-white/10 rounded-full px-4 py-2.5">
        <SearchIcon size={18} className="opacity-50 shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder={t('market.searchPh')} className="bg-transparent flex-1 text-sm focus:outline-none placeholder:opacity-40" />
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <button onClick={() => setCat('')} className={`px-4 py-1.5 text-sm font-bold rounded-full shrink-0 transition ${!cat ? 'tab-active' : 'bg-black/5 dark:bg-white/10 opacity-60'}`}>{t('market.all')}</button>
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`px-4 py-1.5 text-sm font-bold rounded-full shrink-0 transition ${cat === c ? 'tab-active' : 'bg-black/5 dark:bg-white/10 opacity-60'}`}>{c}</button>
        ))}
      </div>
      {items.length === 0 && <Empty icon={<BagIcon size={40} />} title={t('market.empty')} sub="" />}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {items.map((l) => <ListingCard key={l.id} l={l} onOpen={() => nav(`/market/${l.id}`)} />)}
      </div>
      <div className="flex items-start gap-2 text-[11px] opacity-50 px-1 pb-4">
        <ShieldIcon size={14} className="shrink-0 mt-0.5" />{t('market.disclaimer')}
      </div>
    </div>
  );
}

export function ProductDetail() {
  const { t } = useLang();
  const { id } = useParams();
  const nav = useNavigate();
  const [l, setL] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    api.get(`/marketplace/${id}`).then((r) => setL(r.data)).catch(() => setL(null)).finally(() => setLoading(false));
  }, [id]);

  const report = async () => {
    try { await api.post(`/marketplace/${id}/report`, { reason: 'suspicious' }); setReported(true); } catch {}
  };

  if (loading) return <PageLoader />;
  if (!l) return <div className="p-10 text-center font-bold">{t('market.notFound')}</div>;

  return (
    <div className="max-w-2xl mx-auto pb-6">
      <div className="relative aspect-square md:rounded-b-3xl overflow-hidden bg-neutral-900">
        {l.image ? <img src={l.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-neutral-500"><BagIcon size={48} /></div>}
        <button onClick={() => nav('/market')} className="absolute top-3 start-3 w-10 h-10 rounded-full bg-black/50 text-white backdrop-blur flex items-center justify-center rtl:rotate-180" aria-label="Back"><BackIcon size={20} /></button>
        <button onClick={report} disabled={reported} className="absolute top-3 end-3 h-10 px-3 rounded-full bg-black/50 text-white backdrop-blur flex items-center gap-1.5 text-xs font-bold disabled:opacity-50">
          <FlagIcon size={15} />{reported ? t('market.reported') : t('market.report')}
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <div className="font-bold text-2xl">{fmt.money(l.priceCents, l.currency)}</div>
          <div className="font-bold text-lg">{l.title}</div>
          <div className="text-xs opacity-50">{l.category} · {l.condition} · {fmt.time(l.createdAt)}</div>
        </div>
        {l.description && <p className="text-[15px] leading-relaxed card p-4">{l.description}</p>}
        <div className="card p-4 flex items-center gap-3">
          <Avatar user={l.seller} size={48} />
          <div className="flex-1 min-w-0">
            <div className="text-xs opacity-50 font-bold">{t('market.seller')}</div>
            <Link to={`/u/${l.seller?.username}`} className="font-bold hover:underline">{l.seller?.name}</Link>
          </div>
          <button onClick={() => l.seller?.id && openConversation(l.seller.id, nav)} className="btn-primary !py-2 text-sm flex items-center gap-1.5"><ChatIcon size={16} />{t('market.chat')}</button>
        </div>
        {l.phonePublic && l.phone && (
          <a href={`tel:${l.phone}`} className="card p-4 flex items-center gap-3 font-bold"><PhoneIcon size={20} className="text-green-500" />{l.phone}</a>
        )}
        <div className="flex items-start gap-2 text-[11px] opacity-50 px-1">
          <ShieldIcon size={14} className="shrink-0 mt-0.5" />{t('market.disclaimer')}
        </div>
      </div>
    </div>
  );
}
