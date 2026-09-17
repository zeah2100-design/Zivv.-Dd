import { useEffect, useState } from 'react';
import api, { fmt } from '../lib/api';
import { useLang } from '../lib/i18n';
import { GoldBadge } from '../components/ui';
import PageLoader from '../components/PageLoader';
import { CrownIcon, CheckIcon, SparklesIcon } from '../components/icons';

export default function Gold() {
  const { t } = useLang();
  const [pkgs, setPkgs] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/gold/packages'), api.get('/gold/status')])
      .then(([p, s]) => { setPkgs(p.data.items || []); setStatus(s.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const request = async (packageId) => {
    setBusy(packageId);
    try {
      await api.post('/gold/request', { packageId });
      const s = await api.get('/gold/status');
      setStatus(s.data);
    } catch {} finally { setBusy(null); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="p-3 md:p-4 max-w-2xl mx-auto space-y-4">
      <div className="rounded-2xl p-6 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-amber-950 shadow-md text-center">
        <div className="flex justify-center mb-2"><CrownIcon size={44} /></div>
        <div className="font-bold text-2xl">ZIVV Gold</div>
        <div className="text-sm font-medium opacity-80 mt-1">{t('gold.pitch')}</div>
        {status?.gold && <div className="mt-3 flex justify-center"><GoldBadge /></div>}
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
        </div>
      )}

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
            <button onClick={() => request(p.id)} disabled={busy === p.id || status?.gold}
              className="btn-primary w-full mt-4 disabled:opacity-40 flex items-center justify-center gap-2">
              <SparklesIcon size={17} />{status?.gold ? t('gold.active') : busy === p.id ? '…' : t('gold.subscribe')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
