import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useLang } from '../lib/i18n';
import { Avatar, Empty } from '../components/ui';
import PageLoader from '../components/PageLoader';
import { UsersIcon, UserPlusIcon, CheckIcon, XIcon } from '../components/icons';

export default function Friends() {
  const { t } = useLang();
  const nav = useNavigate();
  const [tab, setTab] = useState('suggested');
  const [data, setData] = useState({ incoming: [], outgoing: [], suggested: [] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/friends/requests'); setData({ incoming: r.data.incoming || [], outgoing: r.data.outgoing || [], suggested: r.data.suggested || [] }); }
    catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const act = async (id, action) => {
    try { await api.post(`/friends/requests/${id}/${action}`); load(); } catch {}
  };
  const add = async (toId) => {
    try { await api.post('/friends/requests', { toId }); load(); } catch {}
  };

  if (loading) return <PageLoader />;
  const tabs = [['suggested', t('friends.suggested')], ['incoming', `${t('friends.requests')} (${data.incoming.length})`], ['outgoing', t('friends.sent')]];

  return (
    <div className="p-3 md:p-4 max-w-2xl mx-auto space-y-3">
      <h1 className="font-black text-2xl px-1">{t('friends.title')}</h1>
      <div className="flex gap-2">
        {tabs.map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`flex-1 py-1.5 text-sm font-black rounded-full transition ${tab === v ? 'tab-active' : 'bg-black/5 dark:bg-white/10 opacity-60'}`}>{l}</button>
        ))}
      </div>

      {tab === 'incoming' && (
        data.incoming.length === 0 ? <Empty icon={<UsersIcon size={40} />} title={t('friends.noRequests')} sub="" /> : (
          <div className="space-y-2">
            {data.incoming.map((f) => (
              <div key={f.id} className="card p-3.5 flex items-center gap-3">
                <button onClick={() => nav(`/u/${f.user?.username}`)}><Avatar user={f.user} size={52} /></button>
                <div className="flex-1 min-w-0">
                  <button onClick={() => nav(`/u/${f.user?.username}`)} className="font-bold truncate block">{f.user?.name}</button>
                  <div className="text-xs opacity-50">{f.mutual || 0} {t('friends.mutual')}</div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => act(f.id, 'confirm')} className="btn-primary !py-1.5 !px-4 text-sm flex items-center gap-1"><CheckIcon size={15} />{t('friends.confirm')}</button>
                    <button onClick={() => act(f.id, 'delete')} className="btn-ghost !py-1.5 text-sm">{t('friends.delete')}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'outgoing' && (
        data.outgoing.length === 0 ? <Empty icon={<UserPlusIcon size={40} />} title={t('friends.noSent')} sub="" /> : (
          <div className="space-y-2">
            {data.outgoing.map((f) => (
              <div key={f.id} className="card p-3.5 flex items-center gap-3">
                <Avatar user={f.user} size={48} />
                <div className="flex-1 min-w-0"><div className="font-bold truncate">{f.user?.name}</div><div className="text-xs opacity-50">{t('friends.pending')}</div></div>
                <button onClick={() => act(f.id, 'cancel')} className="btn-ghost !py-1.5 text-sm flex items-center gap-1"><XIcon size={15} />{t('friends.cancel')}</button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'suggested' && (
        <div className="grid grid-cols-2 gap-2.5">
          {data.suggested.map((u) => (
            <div key={u.id} className="card overflow-hidden">
              <button onClick={() => nav(`/u/${u.username}`)} className="block w-full p-4 pb-2 text-center">
                <div className="flex justify-center"><Avatar user={u} size={64} /></div>
                <div className="font-bold text-sm truncate mt-2">{u.name}</div>
                <div className="text-[11px] opacity-50">{u.mutual || 0} {t('friends.mutual')}</div>
              </button>
              <div className="p-2.5 pt-1">
                <button onClick={() => add(u.id)} className="btn-primary w-full !py-2 text-sm flex items-center justify-center gap-1.5"><UserPlusIcon size={16} />{t('friends.add')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
