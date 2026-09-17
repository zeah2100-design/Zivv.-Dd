import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { Avatar, Verified, AiBadge } from '../components/ui';

const tabs = ['top', 'users', 'reels', 'posts', 'music', 'hashtags', 'store'];

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const [tab, setTab] = useState('top');
  const [res, setRes] = useState(null);
  const [suggest, setSuggest] = useState(null);
  const [explore, setExplore] = useState(null);
  const [history, setHistory] = useState([]);
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiMode, setAiMode] = useState(false);

  useEffect(() => { api.get('/search/explore').then((r) => setExplore(r.data)); api.get('/search/history').then((r) => setHistory(r.data.items)); }, []);
  useEffect(() => { const v = sp.get('q'); if (v) { setQ(v); run(v); } }, []);

  const run = async (query = q, t = tab) => {
    if (!query.trim()) { setRes(null); return; }
    const { data } = await api.get('/search', { params: { q: query, tab: t } });
    setRes(data);
  };

  const onType = async (v) => {
    setQ(v);
    if (v.trim().length > 1) { const { data } = await api.get('/search/suggest', { params: { q: v } }); setSuggest(data); }
    else setSuggest(null);
  };

  const aiSearch = async () => {
    if (!q.trim()) return;
    setAiMode(true);
    const { data } = await api.post('/search/ai', { query: q });
    setAiAnswer(data.answer); setRes(data);
  };

  return (
    <div className="px-3 md:px-0 pt-3 space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input value={q} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="Search users, hashtags, reels, music, store…" className="input !pl-10" />
          <span className="absolute left-3 top-2.5">🔍</span>
        </div>
        <button className="btn-ghost" title="Voice search">🎙️</button>
        <button className="btn-ghost" title="Image search">📷</button>
        <button onClick={aiSearch} className="btn-primary !px-3" title="AI Search">✦</button>
      </div>

      {suggest && q && (
        <div className="card p-2 float-in">
          {suggest.users?.map((u) => <button key={u.id} onClick={() => run(u.username)} className="w-full flex items-center gap-2 p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl"><Avatar user={u} size={30} /><span className="font-semibold text-sm">{u.name}</span><span className="text-xs opacity-50">@{u.username}</span></button>)}
          {suggest.hashtags?.map((h) => <button key={h} onClick={() => run('#' + h)} className="w-full text-left p-2 text-sm font-bold text-zivv-purple">#{h}</button>)}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((t) => <button key={t} onClick={() => { setTab(t); setAiMode(false); run(q, t); }} className={`px-4 py-1.5 rounded-full text-sm font-bold capitalize whitespace-nowrap ${tab === t && !aiMode ? 'tab-active' : 'bg-black/5 dark:bg-white/10'}`}>{t}</button>)}
      </div>

      {aiMode && aiAnswer && <div className="card p-4 flex gap-2 items-start"><AiBadge /><p className="text-sm font-medium">{aiAnswer}</p></div>}

      {!res && (
        <div className="space-y-3">
          {!!history.length && (
            <div className="card p-4">
              <div className="flex justify-between items-center mb-2"><span className="font-black">Recent</span><button onClick={() => { api.delete('/search/history'); setHistory([]); }} className="text-xs text-zivv-pink font-bold">Clear all</button></div>
              {history.map((h) => <button key={h.id} onClick={() => { setQ(h.query); run(h.query); }} className="block py-1 text-sm opacity-80">🕘 {h.query}</button>)}
            </div>
          )}
          <div className="card p-4">
            <div className="font-black mb-2">Trending Hashtags 🔥</div>
            <div className="flex flex-wrap gap-2">{explore?.trendingHashtags?.map((h) => <button key={h} onClick={() => { setQ('#' + h); run('#' + h); }} className="px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 text-sm font-bold">#{h}</button>)}</div>
          </div>
          <div className="card p-4">
            <div className="font-black mb-2">Trending Sounds 🎵</div>
            {explore?.trendingSounds?.map((s) => <div key={s.id} className="flex items-center gap-3 py-2"><div className="w-10 h-10 rounded-xl zivv-gradient flex items-center justify-center">🎵</div><div className="flex-1"><div className="font-bold text-sm">{s.title}</div><div className="text-xs opacity-60">{s.artist} • {fmt.n(s.uses)} uses</div></div><button className="btn-ghost text-sm">▶</button></div>)}
          </div>
          <div className="card p-4">
            <div className="font-black mb-2">Suggested Accounts</div>
            {explore?.suggestedAccounts?.map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-2">
                <Avatar user={u} size={40} /><div className="flex-1 min-w-0"><div className="font-bold text-sm flex gap-1 items-center">{u.name} {u.verified && <Verified gold={u.gold} />}</div><div className="text-xs opacity-60 truncate">@{u.username} • {fmt.n(u.followers)} followers</div></div>
                <Link to={`/u/${u.username}`} className="btn-primary !py-1.5 !px-4 text-sm">View</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {res && (
        <div className="space-y-3">
          {(res.users || []).map((u) => (
            <div key={u.id} className="card p-3 flex items-center gap-3">
              <Avatar user={u} size={46} /><div className="flex-1 min-w-0"><div className="font-bold flex gap-1 items-center">{u.name} {u.verified && <Verified gold={u.gold} />}</div><div className="text-xs opacity-60 truncate">@{u.username} • {u.bio}</div><div className="text-xs opacity-60">{fmt.n(u.followers)} followers</div></div>
              <Link to={`/u/${u.username}`} className="btn-primary !py-1.5 !px-4 text-sm">Follow</Link>
            </div>
          ))}
          {(res.posts || []).map((p) => <div key={p.id} className="card p-4 text-sm"><span className="font-bold">@{p.authorId}</span> — {p.text?.slice(0, 140)}</div>)}
          {(res.music || []).map((s) => <div key={s.id} className="card p-3 flex items-center gap-3"><div className="w-11 h-11 rounded-xl zivv-gradient flex items-center justify-center">🎵</div><div className="flex-1"><div className="font-bold text-sm">{s.title}</div><div className="text-xs opacity-60">{s.artist} • {fmt.n(s.uses)} uses</div></div><button className="btn-ghost text-sm">Use sound</button></div>)}
          {(res.store || []).map((l) => <Link key={l.id} to={`/market/${l.id}`} className="card p-3 flex gap-3 items-center"><div className="w-14 h-14 rounded-2xl zivv-gradient flex items-center justify-center text-2xl">🛍️</div><div><div className="font-bold text-sm">{l.title}</div><div className="text-sm text-zivv-purple font-black">{fmt.money(l.priceCents, l.currency)}</div></div></Link>)}
        </div>
      )}
    </div>
  );
}
