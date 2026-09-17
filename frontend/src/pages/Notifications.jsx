import { useEffect, useState } from 'react';
import api, { fmt } from '../lib/api';
import { useLang } from '../lib/i18n';
import { Empty } from '../components/ui';
import PageLoader from '../components/PageLoader';
import { BellIcon, LikeIcon, UserPlusIcon, AtIcon, MegaphoneIcon, SparklesIcon, CrownIcon, CheckDoubleIcon, ShieldIcon } from '../components/icons';

const catIcon = (c) => {
  if (c === 'like') return <LikeIcon size={19} />;
  if (c === 'follow') return <UserPlusIcon size={19} />;
  if (c === 'mention') return <AtIcon size={19} />;
  if (c === 'ads') return <MegaphoneIcon size={19} />;
  if (c === 'ai') return <SparklesIcon size={19} />;
  if (c === 'gold') return <CrownIcon size={19} />;
  if (c === 'admin') return <ShieldIcon size={19} />;
  return <BellIcon size={19} />;
};

export default function Notifications() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/notifications', { params: { tab } }); setItems(r.data.items || []); }
    catch { setItems([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [tab]);

  const readAll = async () => {
    try { await api.post('/notifications/read-all'); setItems((l) => l.map((n) => ({ ...n, read: true }))); } catch {}
  };

  const tabs = ['all', 'like', 'follow', 'mention', 'ai', 'ads'];
  if (loading) return <PageLoader />;

  return (
    <div className="p-3 md:p-4 max-w-2xl mx-auto space-y-3">
      <div className="flex items-center justify-between px-1">
        <h1 className="font-bold text-xl">{t('notif.title')}</h1>
        <button onClick={readAll} className="text-sm font-bold text-zivv-purple flex items-center gap-1.5">
          <CheckDoubleIcon size={17} />{t('notif.markRead')}
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {tabs.map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-4 py-1.5 text-sm font-bold rounded-full transition shrink-0 ${tab === tb ? 'tab-active' : 'bg-black/5 dark:bg-white/10 opacity-60'}`}>
            {t('notif.t_' + tb)}
          </button>
        ))}
      </div>
      {items.length === 0 && <Empty icon={<BellIcon size={40} />} title={t('notif.empty')} sub="" />}
      <div className="card divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
        {items.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 p-3.5 ${n.read ? '' : 'bg-zivv-purple/[.06]'}`}>
            <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${n.read ? 'bg-black/5 dark:bg-white/10 opacity-70' : 'bg-zivv-purple text-white'}`}>
              {catIcon(n.category)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm"><span className="font-bold">{n.title}</span> <span className="opacity-70">{n.body}</span></div>
              <div className="text-[11px] opacity-50 mt-0.5">{fmt.time(n.createdAt)}</div>
            </div>
            {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-zivv-purple mt-1.5 shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}
