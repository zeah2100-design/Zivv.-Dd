import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { useLang } from '../lib/i18n';
import { Avatar, ZImg, Empty } from '../components/ui';
import { SearchIcon, XIcon, HashIcon, MusicIcon, PlayIcon, SparklesIcon, ClockIcon, UserPlusIcon } from '../components/icons';

const TABS = ['top', 'users', 'reels', 'posts', 'music', 'hashtags', 'store'];

export default function Search() {
  const { t } = useLang();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const tab = params.get('tab') || 'top';
  const [input, setInput] = useState(q);
  const [res, setRes] = useState(null);
  const [explore, setExplore] = useState(null);
  const [history, setHistory] = useState([]);
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { setInput(q); }, [q]);

  useEffect(() => {
    if (q) {
      api.get('/search', { params: { q, tab } }).then((r) => setRes(r.data)).catch(() => setRes(null));
    } else {
      api.get('/search/explore').then((r) => setExplore(r.data)).catch(() => {});
      api.get('/search/history').then((r) => setHistory(r.data.items || [])).catch(() => {});
    }
  }, [q, tab]);

  const submit = (v) => {
    const val = (v ?? input).trim();
    if (val) setParams({ q: val });
    else setParams({});
  };

  const askAi = async () => {
    if (!q || aiLoading) return;
    setAiLoading(true);
    try { const r = await api.post('/search/ai', { query: q }); setAiAnswer(r.data.answer || ''); }
    catch { setAiAnswer(''); } finally { setAiLoading(false); }
  };

  const clearHistory = async () => { try { await api.delete('/search/history'); setHistory([]); } catch {} };

  const show = (name) => tab === 'top' || tab === name;

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 bg-black/5 dark:bg-white/10 rounded-full px-4 py-2.5 sticky top-0 z-10 backdrop-blur-xl">
        <SearchIcon size={19} className="opacity-50 shrink-0" />
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={t('search.ph')} className="bg-transparent flex-1 text-[15px] focus:outline-none placeholder:opacity-40" />
        {!!input && <button onClick={() => { setInput(''); submit(''); }} aria-label="Clear"><XIcon size={17} className="opacity-50" /></button>}
      </div>

      {!!q && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {TABS.map((tb) => (
            <button key={tb} onClick={() => setParams({ q, tab: tb })}
              className={`px-4 py-1.5 text-sm font-black rounded-full transition shrink-0 ${tab === tb ? 'tab-active' : 'bg-black/5 dark:bg-white/10 opacity-60'}`}>
              {t('search.t_' + tb)}
            </button>
          ))}
        </div>
      )}

      {!!q && (
        <button onClick={askAi} className="w-full card p-3 flex items-center gap-2.5 text-start hover:border-zivv-purple/50 transition">
          <span className="w-9 h-9 rounded-xl zivv-gradient text-white flex items-center justify-center shrink-0"><SparklesIcon size={17} /></span>
          <span className="flex-1 text-sm font-semibold">{aiLoading ? '…' : aiAnswer || t('search.askAi')}</span>
        </button>
      )}

      {!q && (
        <div className="space-y-4">
          {history.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-black">{t('search.recent')}</span>
                <button onClick={clearHistory} className="text-xs font-bold text-zivv-purple">{t('search.clearAll')}</button>
              </div>
              {history.slice(0, 6).map((h) => (
                <button key={h.id} onClick={() => submit(h.query)} className="flex items-center gap-2.5 w-full py-2 text-start">
                  <ClockIcon size={17} className="opacity-40" />
                  <span className="text-sm font-medium truncate">{h.query}</span>
                </button>
              ))}
            </div>
          )}
          {!!explore?.trendingHashtags?.length && (
            <div className="card p-4">
              <div className="font-black mb-2">{t('search.trending')}</div>
              <div className="flex flex-wrap gap-2">
                {explore.trendingHashtags.map((h) => (
                  <button key={h} onClick={() => submit('#' + h)} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 text-sm font-bold text-zivv-purple">
                    <HashIcon size={14} />{h}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!!explore?.trendingSounds?.length && (
            <div className="card p-4">
              <div className="font-black mb-2">{t('search.sounds')}</div>
              {explore.trendingSounds.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2">
                  <span className="w-10 h-10 rounded-xl zivv-gradient text-white flex items-center justify-center shrink-0"><MusicIcon size={18} /></span>
                  <span className="flex-1 min-w-0"><span className="block font-bold text-sm truncate">{s.title}</span><span className="block text-xs opacity-50">{s.artist} · {fmt.n(s.uses)} {t('search.uses')}</span></span>
                </div>
              ))}
            </div>
          )}
          {!!explore?.suggestedAccounts?.length && (
            <div className="card p-4">
              <div className="font-black mb-2">{t('search.suggested')}</div>
              {explore.suggestedAccounts.slice(0, 5).map((u) => (
                <div key={u.id} className="flex items-center gap-3 py-2">
                  <button onClick={() => nav(`/u/${u.username}`)}><Avatar user={u} size={42} /></button>
                  <button onClick={() => nav(`/u/${u.username}`)} className="flex-1 min-w-0 text-start">
                    <span className="block font-bold text-sm truncate">{u.name}</span>
                    <span className="block text-xs opacity-50 truncate">@{u.username} · {fmt.n(u.followers)} {t('search.followers')}</span>
                  </button>
                  <button onClick={() => nav(`/u/${u.username}`)} className="btn-ghost !py-1.5 text-xs font-bold">{t('search.view')}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!!q && show('users') && !!res?.users?.length && (
        <div className="card p-4">
          <div className="font-black mb-2">{t('search.t_users')}</div>
          {res.users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-2">
              <button onClick={() => nav(`/u/${u.username}`)}><Avatar user={u} size={42} /></button>
              <button onClick={() => nav(`/u/${u.username}`)} className="flex-1 min-w-0 text-start">
                <span className="block font-bold text-sm truncate">{u.name}</span>
                <span className="block text-xs opacity-50 truncate">@{u.username}</span>
              </button>
              <button onClick={() => api.post(`/users/${u.id}/follow`).catch(() => {})} className="btn-ghost !py-1.5 text-xs font-bold flex items-center gap-1"><UserPlusIcon size={14} />{t('search.follow')}</button>
            </div>
          ))}
        </div>
      )}

      {!!q && show('hashtags') && !!res?.hashtags?.length && (
        <div className="card p-4">
          <div className="font-black mb-2">{t('search.t_hashtags')}</div>
          <div className="flex flex-wrap gap-2">
            {res.hashtags.map((h) => (
              <button key={h.tag} onClick={() => submit('#' + h.tag)} className="px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 text-sm font-bold text-zivv-purple">
                #{h.tag} <span className="opacity-50 font-medium">· {fmt.n(h.posts)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!!q && show('reels') && !!res?.reels?.length && (
        <div>
          <div className="font-black mb-2 px-1">{t('search.t_reels')}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {res.reels.map((r) => (
              <button key={r.id} onClick={() => nav('/reels')} className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-neutral-800">
                <ZImg seed={`reel-${r.id}`} w={300} h={400} className="w-full h-full object-cover" alt="" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <PlayIcon size={20} className="absolute top-2 start-2 text-white" />
                <span className="absolute bottom-2 start-2 end-2 text-white text-[11px] font-semibold truncate text-start">{r.caption}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!!q && show('posts') && !!res?.posts?.length && (
        <div className="card p-4">
          <div className="font-black mb-2">{t('search.t_posts')}</div>
          {res.posts.map((p) => (
            <button key={p.id} onClick={() => nav('/')} className="block w-full text-start py-2 border-b border-black/5 dark:border-white/5 last:border-0">
              <span className="text-sm line-clamp-2">{p.text}</span>
            </button>
          ))}
        </div>
      )}

      {!!q && show('music') && !!res?.music?.length && (
        <div className="card p-4">
          <div className="font-black mb-2">{t('search.t_music')}</div>
          {res.music.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2">
              <span className="w-10 h-10 rounded-xl zivv-gradient text-white flex items-center justify-center shrink-0"><MusicIcon size={18} /></span>
              <span className="flex-1 min-w-0"><span className="block font-bold text-sm truncate">{s.title}</span><span className="block text-xs opacity-50">{s.artist}</span></span>
            </div>
          ))}
        </div>
      )}

      {!!q && show('store') && !!res?.store?.length && (
        <div>
          <div className="font-black mb-2 px-1">{t('search.t_store')}</div>
          <div className="grid grid-cols-2 gap-2">
            {res.store.map((l) => (
              <button key={l.id} onClick={() => nav(`/market/${l.id}`)} className="card overflow-hidden text-start">
                <div className="aspect-square zivv-gradient relative"><ZImg seed={`listing-${l.id}`} w={400} h={400} className="w-full h-full object-cover" alt="" /></div>
                <div className="p-2.5"><div className="font-black text-sm">{fmt.money(l.priceCents, l.currency)}</div><div className="text-xs opacity-60 truncate">{l.title}</div></div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!!q && res && !['users', 'reels', 'posts', 'music', 'hashtags', 'store'].some((k) => res[k]?.length) && (
        <Empty icon={<SearchIcon size={40} />} title={t('search.noRes')} sub={q} />
      )}
    </div>
  );
}
