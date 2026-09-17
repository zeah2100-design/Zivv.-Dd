import { useState } from 'react';
import api, { fmt } from '../lib/api';
import { CrownIcon, UserIcon, KeyIcon, ShieldIcon, CheckIcon, XIcon } from '../components/icons';

export default function King() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('zivv_admin'));
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState({ ads: [] });

  const login = async () => {
    setErr('');
    try {
      const { data } = await api.post('/admin/login', { username: u, password: p });
      localStorage.setItem('zivv_admin', data.access);
      localStorage.setItem('zivv_access', data.access);
      setAuthed(true); load();
    } catch { setErr('Invalid credentials. Attempts are rate-limited & audited.'); }
  };
  const load = async () => {
    try {
      const s = await api.get('/admin/stats'); setStats(s.data);
      const q = await api.get('/admin/review-queue'); setQueue(q.data);
    } catch { setErr('Session lacks admin role.'); }
  };
  useState(() => { if (authed) load(); });

  if (!authed) {
    return (
      <div className="pt-14 px-6 max-w-sm mx-auto text-center space-y-3">
        <div className="w-20 h-20 mx-auto rounded-[1.75rem] bg-neutral-900 dark:bg-white text-white dark:text-black flex items-center justify-center"><CrownIcon size={36} /></div>
        <h1 className="text-xl font-black">Restricted area</h1>
        <p className="text-sm opacity-60 flex items-center justify-center gap-1.5"><ShieldIcon size={14} />Admin authentication required</p>
        <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50"><UserIcon size={17} /></span><input value={u} onChange={(e) => setU(e.target.value)} placeholder="Admin user" className="input !pl-10" /></div>
        <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50"><KeyIcon size={17} /></span><input value={p} onChange={(e) => setP(e.target.value)} type="password" placeholder="Admin password" className="input !pl-10" onKeyDown={(e) => e.key === 'Enter' && login()} /></div>
        <button onClick={login} className="btn-primary w-full">Authenticate</button>
        {err && <div className="text-sm text-red-500 font-semibold">{err}</div>}
      </div>
    );
  }

  return (
    <div className="px-3 md:px-0 pt-3 space-y-3">
      <h1 className="text-2xl font-black flex items-center gap-2"><CrownIcon size={24} />Admin Dashboard</h1>
      <div className="grid grid-cols-4 gap-2">
        {[['Users', stats?.users], ['Active', stats?.active], ['Posts', stats?.posts], ['Reels', stats?.reels], ['Messages', stats?.messages], ['Ads', stats?.ads], ['Gold', stats?.gold], ['Reports', stats?.reports]].map(([l, v]) => (
          <div key={l} className="card p-3 text-center"><div className="font-black text-[15px]">{fmt.n(v || 0)}</div><div className="text-[10px] font-bold opacity-50 uppercase">{l}</div></div>
        ))}
      </div>
      <div className="card p-4">
        <div className="font-black mb-2">Ad review queue</div>
        {queue.ads?.map((c) => (
          <div key={c.id} className="flex items-center gap-2 py-2.5 border-b border-black/5 dark:border-white/10 last:border-0">
            <div className="flex-1 text-sm font-semibold truncate">{c.title}</div>
            <button onClick={async () => { await api.post(`/admin/ads/${c.id}/approve`); load(); }} className="btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1"><CheckIcon size={13} />Approve</button>
            <button onClick={async () => { await api.post(`/admin/ads/${c.id}/reject`); load(); }} className="btn-ghost !py-1.5 !px-3 text-xs flex items-center gap-1"><XIcon size={13} />Reject</button>
          </div>
        ))}
        {!queue.ads?.length && <div className="text-sm opacity-50">Queue clear</div>}
      </div>
    </div>
  );
}
