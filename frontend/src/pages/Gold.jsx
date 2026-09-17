import { useEffect, useState } from 'react';
import api, { fmt } from '../lib/api';
import { useZivv } from '../lib/store';
import { useLang } from '../lib/i18n';
import { GoldBadge } from '../components/ui';
import PageLoader from '../components/PageLoader';
import { CrownIcon, CheckIcon, SparklesIcon, CoinsIcon } from '../components/icons';

export default function Gold() {
  const { refreshUser } = useZivv();
  const { t } = useLang();
  const [pkgs, setPkgs] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [redeeming, setRedeeming] = useState(false);

  const load = async () => {
    try {
      const [p, s] = await Promise.all([api.get('/gold/packages'), api.get('/gold/status')]);
      setPkgs(p.data.items || []); setStatus(s.data);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const request = async (packageId) => {
    setBusy(packageId);
    try {
      await api.post('/gold/request', { packageId });
      const s = await api.get('/gold/status');
      setStatus(s.data);
    } catch {} finally { setBusy(null); }
  };

  const redeem = async () => {
    setRedeeming(true);
    try {
      await api.post('/gold/redeem');
      const s = await api.get('/gold/status');
      setStatus(s.data);
      refreshUser();
    } catch {} finally { setRedeeming(false); }
  };

  if (loading) return <PageLoader />;
  const points = status?.points || 0;
  const cost = status?.redeemCost || 1000;
  const pct = Math.min(100, Math.round((points / cost) * 100));

  return (
    <div className="p-3 md:p-4 max-w-2xl mx-auto space-y-4">
      <div className="rounded-2xl p-6 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-amber-950 shadow-md text-center">
        <div className="flex justify-center mb-2"><CrownIcon size={44} /></div>
        <div className="font-bold text-2xl">ZIVV Gold</div>
        <div className="text-sm font-medium opacity-80 mt-1">{t('gold.pitch')}</div>
        {status?.gold && <div className="mt-3 flex justify-center"><GoldBadge /></div>}
      </div>

      {!status?.gold && (
        <div className="card p-5">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0"><CoinsIcon size={20} /></span>
            <div className="flex-1">
              <div className="font-bold">{fmt.n(points)} {t('gold.points')}</div>
              <div className="text-xs opacity-50">{t('gold.pointsSub')}</div>
            </div>
          </div>
          <div className="h-2 rounded-full bg-black/10 dark:bg-white/15 mt-3 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-300 to-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <button onClick={redeem} disabled={redeeming || points < cost}
            className="btn-primary w-full mt-3 disabled:opacity-40 flex items-center justify-center gap-2">
            <SparklesIcon size={17} />{redeeming ? '…' : points >= cost ? t('gold.redeem') : t('gold.needMore', fmt.n(cost - points))}
          </button>
        </div>
      )}

      <div className="card p-5">
        <div className="font-bold mb-2">{t('gold.benefits')}</div>
        <ul className="space-y-1.5">
          {[t('gold.b1'), t('gold.b2'), t('gold.b3'), t('gold.b4'), t('gold.b5'), t('gold.b6')].map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm"><CheckIcon size={16} className="text-green-500 shrink-0 mt-0.5" />{b}</li>
          ))}
        </ul>
      </div>

      {!!status?.requests?.length && (
        <div className="card p-4">
          <div className="font-bold mb-2">{t('gold.myRequests')}</div>
          {status.requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-black/5 dark:border-white/5 last:border-0 text-sm">
              <span className="font-bold">{r.package?.name}</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600">{r.status}</span>
            </div>
          ))}
          <div className="text-[11px] opacity-50 mt-2">{t('gold.cashNote')}</div>
        </div>
      )}

      {!status?.gold && (
        <>
          <div className="font-bold px-1">{t('gold.cashTitle')}</div>
          <div className="grid md:grid-cols-2 gap-3">
            {pkgs.map((p) => (
              <div key={p.id} className="card p-5 flex flex-col">
                <div className="font-bold text-lg">{p.name}</div>
                <div className="font-bold text-3xl my-1">{fmt.money(p.priceCents)}</div>
                <div className="text-xs opacity-50 mb-3">{p.durationDays} {t('gold.days')}</div>
                <ul className="space-y-1.5 flex-1">
                  {(p.perks || []).map((perk, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm"><CheckIcon size={16} className="text-green-500 shrink-0 mt-0.5" />{perk}</li>
                  ))}
                </ul>
                <button onClick={() => request(p.id)} disabled={busy === p.id}
                  className="btn-primary w-full mt-4 disabled:opacity-40 flex items-center justify-center gap-2">
                  <SparklesIcon size={17} />{busy === p.id ? '…' : t('gold.subscribe')}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
