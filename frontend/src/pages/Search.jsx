import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { Avatar, Verified, AiBadge, ZImg } from '../components/ui';
import {
  SearchIcon, MicIcon, CameraIcon, SparklesIcon, PlayIcon, HashIcon, FlameIcon,
  MusicIcon, ClockIcon, XIcon, TrendingIcon, BagIcon,
} from '../components/icons';

const tabs = ['top', 'users', 'reels', 'posts', 'music', 'hashtags', 'store'];

export default function Search() {
  const [sp] = useSearchParams();
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
    setRes(data); setSuggest(null);
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
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50"><SearchIcon size={18} /></span>
          <input value={q} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="Search users, hashtags, reels, music, store…" className="input !pl-10 !rounded-full" />
          {!!q && <button onClick={() => { setQ(''); setRes(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50" aria-label="Clear"><XIcon size={16} /></button>}
        </div>
        <button className="btn-ghost !px-3 !rounded-full" title="Voice search" aria-label="Voice search"><MicIcon size={19} /></button>
        <button className="btn-ghost !px-3 !rounded-full" title="Image search" aria-label="Image search"><CameraIcon size={19} /></button>
        <button onClick={aiSearch} className="btn-primary !px-3.5 !rounded-full" title="AI Search" aria-label="AI Search"><SparklesIcon size={19} /></button>
      </div>

      {suggest && q && (
        <div className="card p-2 float-in">
          {suggest.users?.map((u) => <button key={u.id} onClick={() => run(u.username)} className="w-full flex items-center gap-2.5 p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl"><Avatar user={u} size={32} /><span className="font-semibold text-sm">{u.name}</span><span className="text-xs opacity-50">@{u.username}</span></button>)}
          {suggest.hashtags?.map((h) => <button key={h} onClick={() => run('#' + h)} className="w-full text-left p-2 text-sm font-bold text-zivv-purple flex items-center gap-1"><HashIcon size={14} />{h}</button>)}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((t) => <button key={t} onClick={() => { setTab(t); setAiMode(false); run(q, t); }} className={`px-4 py-1.5 rounded-full text-sm font-bold capitalize whitespace-nowrap transition ${tab === t && !aiMode ? 'tab-active' : 'bg-black/5 dark:bg-white/10'}`}>{t}</button>)}
      </div>

      {aiMode && aiAnswer && <div className="card p-4 flex gap-2.5 items-start"><AiBadge /><p className="text-sm font-medium">{aiAnswer}</p></div>}

      {!res && (
        <div className="space-y-3">
          {!!history.length && (
            <div className="card p-4">
              <div className="flex justify-between items-center mb-1"><span className="font-black flex items-center gap-2"><ClockIcon size={17} />Recent</span><button onClick={() => { api.delete('/search/history'); setHistory([]); }} className="text-xs text-zivv-pink font-bold">Clear all</button></div>
              {history.map((h) => <button key={h.id} onClick={() => { setQ(h.query); run(h.query); }} className="flex items-center gap-2 w-full py-2 text-sm opacity-80 hover:opacity-100"><ClockIcon size={15} className="opacity-50" />{h.query}</button>)}
            </div>
          )}
          <div className="card p-4">
            <div className="font-black mb-2.5 flex items-center gap-2"><FlameIcon size={18} className="text-zivv-pink" />Trending now</div>
            <div className="flex flex-wrap gap-2">{explore?.trendingHashtags?.map((h) => <button key={h} onClick={() => { setQ('#' + h); run('#' + h); }} className="px-3.5 py-1.5 rounded-full bg-black/5 dark:bg-white/10 text-sm font-bold flex items-center gap-1"><HashIcon size={13} />{h}</button>)}</div>
          </div>
          <div className="card p-4">
            <div className="font-black mb-1 flex items-center gap-2"><TrendingIcon size={18} className="text-zivv-purple" />Trending sounds</div>
            {explore?.trendingSounds?.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-black/5 dark:border-white/5 last:border-0">
                <div className="w-11 h-11 rounded-xl zivv-gradient flex items-center justify-center text-white shrink-0"><MusicIcon size={20} /></div>
                <div className="flex-1 min-w-0"><div className="font-bold text-sm truncate">{s.title}</div><div className="text-xs opacity-60">{s.artist} · {fmt.n(s.uses)} uses</div></div>
                <button className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center" aria-label="Preview"><PlayIcon size={15} /></button>
              </div>
            ))}
          </div>
          <div className="card p-4">
            <div className="font-black mb-1">Suggested accounts</div>
            {explore?.suggestedAccounts?.map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-2.5 border-b border-black/5 dark:border-white/5 last:border-0">
                <Avatar user={u} size={44} />
                <div className="flex-1 min-w-0"><div className="font-bold text-sm flex gap-1 items-center truncate">{u.name} {u.verified && <Verified gold={u.gold} />}</div><div className="text-xs opacity-60 truncate">@{u.username} · {fmt.n(u.followers)} followers</div><div className="text-xs opacity-50 truncate">{u.bio}</div></div>
                <Link to={`/u/${u.username}`} className="btn-primary !py-1.5 !px-4 text-sm">View</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {res && (
        <div className="space-y-2.5">
          {(res.users || []).map((u) => (
            <div key={u.id} className="card p-3 flex items-center gap-3">
              <Avatar user={u} size={50} /><div className="flex-1 min-w-0"><div className="font-bold flex gap-1 items-center">{u.name} {u.verified && <Verified gold={u.gold} />}</div><div className="text-xs opacity-60 truncate">@{u.username} · {u.bio}</div><div className="text-xs opacity-60">{fmt.n(u.followers)} followers</div></div>
              <Link to={`/u/${u.username}`} className="btn-primary !py-1.5 !px-4 text-sm">Follow</Link>
            </div>
          ))}
          {(res.reels || []).length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {(res.reels || []).map((r) => (
                <Link key={r.id} to="/reels" className="card overflow-hidden !rounded-2xl">
                  <div className="aspect-[3/4] zivv-gradient relative"><ZImg seed={`reel-${r.id}`} w={300} h={400} className="absolute inset-0 w-full h-full object-cover" alt="Reel" />
                    <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded-md flex items-center gap-1"><PlayIcon size={9} />{fmt.n(r.playCount)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {(res.posts || []).map((p) => <div key={p.id} className="card p-4 text-sm"><span className="font-bold">@{p.authorId}</span> — {p.text?.slice(0, 140)}</div>)}
          {(res.music || []).map((s) => <div key={s.id} className="card p-3 flex items-center gap-3"><div className="w-11 h-11 rounded-xl zivv-gradient flex items-center justify-center text-white"><MusicIcon size={20} /></div><div className="flex-1"><div className="font-bold text-sm">{s.title}</div><div className="text-xs opacity-60">{s.artist} · {fmt.n(s.uses)} uses</div></div><button className="btn-ghost text-sm">Use sound</button></div>)}
          {(res.store || []).map((l) => (
            <Link key={l.id} to={`/market/${l.id}`} className="card p-3 flex gap-3 items-center">
              <div className="w-16 h-16 rounded-2xl zivv-gradient relative overflow-hidden shrink-0"><ZImg seed={`listing-${l.id}`} w={200} h={200} className="absolute inset-0 w-full h-full object-cover" alt="" /></div>
              <div><div className="font-bold text-sm">{l.title}</div><div className="font-black text-zivv-purple">{fmt.money(l.priceCents, l.currency)}</div></div>
              <BagIcon size={18} className="ml-auto opacity-40" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
