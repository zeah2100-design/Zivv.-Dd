import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useLang } from '../lib/i18n';
import { Avatar, Empty } from '../components/ui';
import PageLoader from '../components/PageLoader';
import { CrownIcon, LockIcon, UserIcon, ShieldIcon, UsersIcon, NewspaperIcon, MegaphoneIcon, SendIcon, CheckIcon, XIcon, TrashIcon, BanIcon, EyeIcon } from '../components/icons';

const TABS = [['stats', 'king.t_stats'], ['users', 'king.t_users'], ['posts', 'king.t_posts'], ['gold', 'king.t_gold'], ['ads', 'king.t_ads'], ['notify', 'king.t_notify'], ['audit', 'king.t_audit']];

export default function King() {
  const { t } = useLang();
  const nav = useNavigate();
  const allowed = sessionStorage.getItem('zivv_king_entry') === '1';
  const [token, setToken] = useState(localStorage.getItem('zivv_admin') || '');
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('stats');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [gold, setGold] = useState([]);
  const [ads, setAds] = useState([]);
  const [audit, setAudit] = useState([]);
  const [nTo, setNTo] = useState('all');
  const [nTitle, setNTitle] = useState('');
  const [nBody, setNBody] = useState('');
  const [nSent, setNSent] = useState('');

  const H = (tk) => ({ headers: { Authorization: `Bearer ${tk}` } });

  const login = async () => {
    if (!u || !p || busy) return;
    setBusy(true); setErr('');
    try {
      const r = await api.post('/admin/login', { username: u, password: p });
      localStorage.setItem('zivv_admin', r.data.access);
      setToken(r.data.access);
    } catch { setErr(t('king.e_bad')); } finally { setBusy(false); }
  };

  const load = async (tk) => {
    setLoading(true);
    try {
      const [s, uu, pp, g, a, au] = await Promise.all([
        api.get('/admin/stats', H(tk)), api.get('/admin/users', H(tk)), api.get('/admin/posts', H(tk)),
        api.get('/admin/gold-requests', H(tk)), api.get('/admin/ads', H(tk)), api.get('/admin/audit', H(tk)),
      ]);
      setStats(s.data); setUsers(uu.data.items || []); setPosts(pp.data.items || []);
      setGold(g.data.items || []); setAds(a.data.items || []); setAudit(au.data.items || []);
    } catch { setErr(t('king.e_load')); } finally { setLoading(false); }
  };

  useEffect(() => { if (token) load(token); }, [token]);

  const act = async (fn) => { try { await fn(); load(token); } catch {} };
  const sendNotif = async () => {
    if (!nTitle.trim() || !nBody.trim()) return;
    try {
      const r = await api.post('/admin/notify', { to: nTo.trim() || 'all', title: nTitle, body: nBody }, H(token));
      setNSent(t('king.sent', r.data.sent ?? 1)); setNTitle(''); setNBody('');
      load(token);
    } catch { setNSent(t('king.e_send')); }
  };

  if (!allowed) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <div className="card p-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center mb-3 text-neutral-400"><LockIcon size={30} /></div>
          <div className="font-bold text-xl">{t('king.locked')}</div>
          <div className="text-sm opacity-60 mt-1 mb-4">{t('king.lockedSub')}</div>
          <button onClick={() => nav('/settings')} className="btn-ghost text-sm font-bold">{t('king.toSettings')}</button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="p-4 max-w-sm mx-auto">
        <div className="card p-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mb-3"><CrownIcon size={30} /></div>
          <div className="font-bold text-xl">{t('king.title')}</div>
          <div className="text-sm opacity-60 mt-1 mb-4">{t('king.sub')}</div>
          <div className="space-y-2.5 text-start">
            <div className="relative">
              <span className="absolute start-3.5 top-1/2 -translate-y-1/2 opacity-50"><UserIcon size={17} /></span>
              <input value={u} onChange={(e) => setU(e.target.value)} placeholder={t('king.userPh')} className="input !ps-10" autoCapitalize="none" />
            </div>
            <div className="relative">
              <span className="absolute start-3.5 top-1/2 -translate-y-1/2 opacity-50"><LockIcon size={17} /></span>
              <input value={p} onChange={(e) => setP(e.target.value)} type="password" placeholder={t('king.passPh')} className="input !ps-10" onKeyDown={(e) => e.key === 'Enter' && login()} />
            </div>
          </div>
          {!!err && <div className="text-red-500 text-sm font-bold mt-2">{err}</div>}
          <button onClick={login} disabled={busy} className="btn-primary w-full mt-4 disabled:opacity-40">{busy ? '…' : t('king.login')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 max-w-3xl mx-auto space-y-3">
      <div className="flex items-center gap-2 px-1">
        <CrownIcon size={24} className="text-amber-500" />
        <h1 className="font-bold text-xl flex-1">{t('king.title')}</h1>
        <button onClick={() => { localStorage.removeItem('zivv_admin'); setToken(''); }} className="btn-ghost !py-1.5 text-xs font-bold">{t('king.logout')}</button>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {TABS.map(([v, lk]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-1.5 text-sm font-bold rounded-full transition shrink-0 ${tab === v ? 'tab-active' : 'bg-black/5 dark:bg-white/10 opacity-60'}`}>{t(lk)}</button>
        ))}
      </div>

      {loading && <PageLoader />}
      {!loading && tab === 'stats' && stats && (
        <div className="grid grid-cols-3 gap-2">
          {[['king.s_users', stats.users, UsersIcon], ['king.s_posts', stats.posts, NewspaperIcon], ['king.s_reels', stats.reels, EyeIcon],
            ['king.s_chats', stats.conversations, SendIcon], ['king.s_gold', stats.gold, CrownIcon], ['king.s_ads', stats.campaigns, MegaphoneIcon],
            ['king.s_pgold', stats.pendingGold, CrownIcon], ['king.s_pads', stats.pendingAds, MegaphoneIcon], ['king.s_msgs', stats.messages, SendIcon],
          ].map(([lk, n, Icon], i) => (
            <div key={i} className="card p-3.5 text-center">
              <Icon size={19} className="mx-auto mb-1 opacity-50" />
              <div className="font-bold text-xl">{n ?? 0}</div>
              <div className="text-[11px] opacity-50">{t(lk)}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'users' && (
        users.length === 0 ? <Empty icon={<UsersIcon size={40} />} title={t('king.empty')} sub="" /> : (
          <div className="space-y-2">
            {users.map((x) => (
              <div key={x.id} className={`card p-3 flex items-center gap-3 ${x.banned ? 'opacity-60' : ''}`}>
                <Avatar user={x} size={44} ring={x.gold} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{x.name} {x.banned && <span className="text-[10px] text-red-500">({t('king.banned')})</span>}</div>
                  <div className="text-xs opacity-50 truncate">@{x.username} · {x.points || 0} {t('gold.points')}{x.gold ? ' · GOLD' : ''}</div>
                </div>
                <button onClick={() => act(() => api.post(`/admin/users/${x.id}/ban`, {}, H(token)))} title={x.banned ? t('king.unban') : t('king.ban')}
                  className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600"><BanIcon size={17} /></button>
                <button onClick={() => { if (confirm(t('king.confirmDel'))) act(() => api.delete(`/admin/users/${x.id}`, H(token))); }} title={t('king.del')}
                  className="p-2.5 rounded-xl bg-red-500/10 text-red-500"><TrashIcon size={17} /></button>
              </div>
            ))}
          </div>
        )
      )}

      {!loading && tab === 'posts' && (
        posts.length === 0 ? <Empty icon={<NewspaperIcon size={40} />} title={t('king.empty')} sub="" /> : (
          <div className="space-y-2">
            {posts.map((x) => (
              <div key={x.id} className="card p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs opacity-50">@{x.author?.username} · {x.type}</div>
                  <div className="text-sm line-clamp-2">{x.text}</div>
                </div>
                <button onClick={() => { if (confirm(t('king.confirmDel'))) act(() => api.delete(`/admin/posts/${x.id}`, H(token))); }}
                  className="p-2.5 rounded-xl bg-red-500/10 text-red-500 shrink-0"><TrashIcon size={17} /></button>
              </div>
            ))}
          </div>
        )
      )}

      {!loading && tab === 'gold' && (
        gold.length === 0 ? <Empty icon={<CrownIcon size={40} />} title={t('king.empty')} sub="" /> : (
          <div className="space-y-2">
            {gold.map((r) => (
              <div key={r.id} className="card p-3.5">
                <div className="flex items-center gap-3">
                  <Avatar user={r.user} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">@{r.user?.username}</div>
                    <div className="text-xs opacity-50">{r.package?.name}</div>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600">{r.status}</span>
                </div>
                {r.status === 'PENDING_REVIEW' && (
                  <div className="flex gap-2 mt-2.5">
                    <button onClick={() => act(() => api.post(`/admin/gold-requests/${r.id}/approve`, {}, H(token)))} className="btn-primary !py-1.5 text-sm flex-1 flex items-center justify-center gap-1.5"><CheckIcon size={15} />{t('king.approve')}</button>
                    <button onClick={() => act(() => api.post(`/admin/gold-requests/${r.id}/reject`, {}, H(token)))} className="btn-ghost !py-1.5 text-sm flex-1 flex items-center justify-center gap-1.5"><XIcon size={15} />{t('king.reject')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {!loading && tab === 'ads' && (
        ads.length === 0 ? <Empty icon={<MegaphoneIcon size={40} />} title={t('king.empty')} sub="" /> : (
          <div className="space-y-2">
            {ads.map((c) => (
              <div key={c.id} className="card p-3.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{c.title}</div>
                    <div className="text-xs opacity-50">@{c.owner?.username}</div>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10">{c.status}</span>
                </div>
                <div className="flex gap-2 mt-2.5">
                  {c.status === 'PENDING_REVIEW' && (
                    <>
                      <button onClick={() => act(() => api.post(`/admin/ads/${c.id}/approve`, {}, H(token)))} className="btn-primary !py-1.5 text-sm flex-1">{t('king.approve')}</button>
                      <button onClick={() => act(() => api.post(`/admin/ads/${c.id}/reject`, {}, H(token)))} className="btn-ghost !py-1.5 text-sm flex-1">{t('king.reject')}</button>
                    </>
                  )}
                  {c.status === 'PENDING_PAYMENT' && (
                    <button onClick={() => act(() => api.post(`/admin/ads/${c.id}/activate`, {}, H(token)))} className="btn-primary !py-1.5 text-sm flex-1">{t('king.activate')}</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {!loading && tab === 'notify' && (
        <div className="card p-4 space-y-3">
          <div className="font-bold flex items-center gap-2"><ShieldIcon size={18} />{t('king.notifyTitle')}</div>
          <input value={nTo} onChange={(e) => setNTo(e.target.value)} placeholder={t('king.toPh')} className="input" dir="ltr" />
          <input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder={t('king.titlePh')} className="input" />
          <textarea value={nBody} onChange={(e) => setNBody(e.target.value)} rows={3} placeholder={t('king.bodyPh')} className="input resize-none" />
          {!!nSent && <div className="text-green-500 text-sm font-bold">{nSent}</div>}
          <button onClick={sendNotif} disabled={!nTitle.trim() || !nBody.trim()} className="btn-primary w-full disabled:opacity-40 flex items-center justify-center gap-2"><SendIcon size={17} />{t('king.send')}</button>
        </div>
      )}

      {!loading && tab === 'audit' && (
        <div className="card divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
          {audit.length === 0 && <div className="p-6 text-center text-sm opacity-50">{t('king.empty')}</div>}
          {audit.map((a) => (
            <div key={a.id} className="px-4 py-2.5 text-sm flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 shrink-0">{a.action}</span>
              <span className="opacity-60 truncate flex-1">{a.target}</span>
              <span className="text-[11px] opacity-40 shrink-0">{a.by}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
