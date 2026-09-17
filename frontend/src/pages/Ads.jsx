import { useEffect, useState } from 'react';
import api, { fmt } from '../lib/api';
import { useLang } from '../lib/i18n';
import { Empty } from '../components/ui';
import PageLoader from '../components/PageLoader';
import { MegaphoneIcon, PlusIcon, PauseIcon, PlayIcon, EyeIcon } from '../components/icons';

const statusColor = (s) => ({
  ACTIVE: 'bg-green-500/15 text-green-500',
  PAUSED: 'bg-amber-500/15 text-amber-500',
  PENDING_REVIEW: 'bg-zivv-purple/15 text-zivv-purple',
}[s] || 'bg-black/5 dark:bg-white/10 opacity-70');

export default function Ads() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState('');
  const [budget, setBudget] = useState('500');
  const [days, setDays] = useState('7');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/ads'); setItems(r.data.items || []); } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await api.post('/ads', { title, budgetCents: Math.round(parseFloat(budget || '0') * 100), durationDays: parseInt(days, 10) || 7 });
      setTitle(''); setShow(false); load();
    } finally { setBusy(false); }
  };

  const toggle = async (c) => {
    try { await api.post(`/ads/${c.id}/${c.status === 'ACTIVE' ? 'pause' : 'resume'}`); load(); } catch {}
  };

  if (loading) return <PageLoader />;

  return (
    <div className="p-3 md:p-4 max-w-2xl mx-auto space-y-3">
      <div className="card p-3.5 text-[13px] opacity-80">{t('ads.reviewNote')}</div>
      <div className="flex items-center gap-2 px-1">
        <h1 className="font-bold text-xl flex-1">{t('ads.title')}</h1>
        <button onClick={() => setShow(!show)} className="btn-primary !py-2 text-sm flex items-center gap-1.5"><PlusIcon size={16} />{t('ads.new')}</button>
      </div>

      {show && (
        <div className="card p-4 space-y-3 slide-up">
          <div className="font-bold">{t('ads.newTitle')}</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('ads.titlePh')} className="input" />
          <div className="flex gap-2">
            <div className="flex-1"><label className="text-xs font-bold opacity-60">{t('ads.budget')}</label><input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" className="input mt-1" /></div>
            <div className="flex-1"><label className="text-xs font-bold opacity-60">{t('ads.days')}</label><input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className="input mt-1" /></div>
          </div>
          <button onClick={create} disabled={!title.trim() || busy} className="btn-primary w-full disabled:opacity-40">{t('ads.launch')}</button>
        </div>
      )}

      {items.length === 0 && <Empty icon={<MegaphoneIcon size={40} />} title={t('ads.empty')} sub={t('ads.emptySub')} />}

      {items.map((c) => (
        <div key={c.id} className="card p-4">
          <div className="flex items-center gap-2">
            <span className="w-10 h-10 rounded-2xl bg-zivv-purple text-white flex items-center justify-center shrink-0"><MegaphoneIcon size={19} /></span>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{c.title}</div>
              <div className="text-xs opacity-50">{fmt.money(c.budgetCents)} · {c.durationDays} {t('ads.days')}</div>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusColor(c.status)}`}>{c.status?.replace('_', ' ')}</span>
          </div>
          <div className="flex items-center gap-4 mt-3 text-sm">
            <span className="flex items-center gap-1.5 opacity-70"><EyeIcon size={16} />{fmt.n(c.impressions)} {t('ads.impr')}</span>
            <span className="opacity-70 font-semibold">{fmt.n(c.clicks)} {t('ads.clicks')}</span>
            <div className="flex-1" />
            {(c.status === 'ACTIVE' || c.status === 'PAUSED') && (
              <button onClick={() => toggle(c)} className="btn-ghost !py-1.5 text-xs font-bold flex items-center gap-1.5">
                {c.status === 'ACTIVE' ? <><PauseIcon size={14} />{t('ads.pause')}</> : <><PlayIcon size={14} />{t('ads.resume')}</>}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
