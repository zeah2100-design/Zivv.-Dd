import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { useZivv } from '../lib/store';
import { useLang } from '../lib/i18n';
import { Avatar, ZImg, AiBadge, ImageModal } from '../components/ui';
import PageLoader from '../components/PageLoader';
import { LikeIcon, CommentIcon, ShareIcon, BookmarkIcon, BookmarkFilledIcon, SendIcon, ImageIcon, SmileIcon, EarthIcon, XIcon, VerifyIcon, CrownIcon, PlayIcon, PauseIcon, MusicIcon, MoonIcon } from '../components/icons';

export function LikeButton({ targetType = 'post', targetId, liked, count }) {
  const [isLiked, setIsLiked] = useState(!!liked);
  const [n, setN] = useState(count || 0);
  const [burst, setBurst] = useState(false);
  useEffect(() => { setIsLiked(!!liked); setN(count || 0); }, [liked, count, targetId]);
  const toggle = async (e) => {
    e?.stopPropagation?.();
    const next = !isLiked;
    setIsLiked(next); setN((v) => v + (next ? 1 : -1));
    if (next) { setBurst(true); setTimeout(() => setBurst(false), 450); }
    try { await api.post(targetType === 'reel' ? `/reels/${targetId}/like` : `/feed/${targetId}/like`); }
    catch { setIsLiked(!next); setN((v) => v + (next ? -1 : 1)); }
  };
  return (
    <button onClick={toggle} aria-label="Like" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition active:scale-90 ${isLiked ? 'text-zivv-pink' : 'opacity-60 hover:bg-zivv-pink/10 hover:text-zivv-pink hover:opacity-100'}`}>
      <span className={`relative ${burst ? 'pop' : ''}`}>
        <LikeIcon size={22} filled={isLiked} />
        {burst && <span className="absolute -inset-2 heart-burst text-zivv-pink">♥</span>}
      </span>
      {n > 0 && <span className="text-[13px] font-semibold">{fmt.n(n)}</span>}
    </button>
  );
}

export function SaveButton({ postId, saved }) {
  const [s, setS] = useState(!!saved);
  useEffect(() => setS(!!saved), [saved, postId]);
  return (
    <button aria-label="Save" onClick={(e) => { e.stopPropagation(); const n = !s; setS(n); api.post(`/feed/${postId}/save`).catch(() => setS(!n)); }}
      className={`p-2 rounded-full transition active:scale-90 ${s ? 'text-zivv-purple' : 'opacity-60 hover:bg-zivv-purple/10 hover:text-zivv-purple hover:opacity-100'}`}>
      {s ? <BookmarkFilledIcon size={21} /> : <BookmarkIcon size={21} />}
    </button>
  );
}

function Composer() {
  const { user } = useZivv();
  const { t } = useLang();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const post = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const hashtags = [...text.matchAll(/#(\w+)/g)].map((m) => m[1]);
      await api.post('/feed', { text, hashtags });
      setText('');
      window.dispatchEvent(new CustomEvent('zivv:reload'));
    } finally { setSending(false); }
  };
  return (
    <div className="card p-4">
      <div className="flex gap-3">
        <Avatar user={user} size={40} />
        <div className="flex-1">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={user?.gold ? 5000 : 2000}
            placeholder={t('feed.ph')} className="w-full bg-transparent resize-none text-[15px] placeholder:opacity-40 focus:outline-none" />
          <div className="flex items-center gap-1 pt-2 mt-1 border-t border-black/5 dark:border-white/10">
            <span className="flex items-center gap-1 text-xs font-semibold opacity-50 px-2 py-1"><EarthIcon size={14} />{t('feed.public')}</span>
            <div className="flex-1" />
            <button className="p-2 rounded-full opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Photo"><ImageIcon size={20} /></button>
            <button className="p-2 rounded-full opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Emoji"><SmileIcon size={20} /></button>
            <button onClick={post} disabled={!text.trim() || sending} className="btn-primary !py-2 !px-5 disabled:opacity-40">{sending ? '…' : t('feed.post')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentBox({ onSend }) {
  const { t } = useLang();
  const [text, setText] = useState('');
  const send = () => { if (!text.trim()) return; onSend(text.trim()); setText(''); };
  return (
    <div className="flex items-center gap-2">
      <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
        placeholder={t('feed.cmtPh')} className="input !py-2 !rounded-full text-sm" />
      <button onClick={send} disabled={!text.trim()} className="btn-primary !p-2.5 !rounded-full disabled:opacity-40 shrink-0 rtl:rotate-180" aria-label="Send"><SendIcon size={17} /></button>
    </div>
  );
}

function PostMedia({ p }) {
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(null);
  const src = p.media?.[0]?.cdnUrl || '';
  if (p.type === 'IMAGE') {
    const zoomSrc = src || `https://picsum.photos/seed/post-${p.id}/800/600`;
    return (
      <div className="px-3 py-2">
        <button onClick={() => setZoom(zoomSrc)} className="block w-full rounded-xl overflow-hidden bg-neutral-100 dark:bg-white/5 aspect-[4/3]">
          {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <ZImg seed={`post-${p.id}`} w={800} h={600} className="w-full h-full object-cover" alt="Post image" />}
        </button>
        <ImageModal src={zoom} onClose={() => setZoom(null)} />
      </div>
    );
  }
  if (p.type === 'VIDEO') {
    if (src) {
      return (
        <div className="px-3 py-2">
          <video src={src} controls preload="metadata" playsInline className="w-full rounded-xl bg-black aspect-video" />
        </div>
      );
    }
    return (
      <div className="px-3 py-2">
        <div className="rounded-xl overflow-hidden bg-black aspect-video relative cursor-pointer" onClick={() => setPlaying(!playing)}>
          <ZImg seed={`vid-${p.id}`} w={800} h={450} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="Video" />
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-14 h-14 rounded-full bg-black/55 backdrop-blur flex items-center justify-center text-white">
              {playing ? <PauseIcon size={26} /> : <PlayIcon size={26} className="ms-1" />}
            </span>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20"><div className="h-full bg-white rounded-full" style={{ width: playing ? '32%' : '8%' }} /></div>
        </div>
      </div>
    );
  }
  if (p.type === 'MUSIC') {
    return (
      <div className="px-3 py-2">
        <div className="rounded-xl bg-black/[.04] dark:bg-white/[.07] p-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-zivv-purple shrink-0">
            <ZImg seed={`song-${p.id}`} w={200} h={200} className="w-full h-full object-cover" alt="Cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">{p.text?.slice(0, 40) || 'Track'}</div>
            <div className="text-xs opacity-60 flex items-center gap-1"><MusicIcon size={12} />{p.author?.name}</div>
            {src
              ? <audio src={src} controls preload="metadata" className="w-full h-8 mt-1.5" />
              : <div className="h-1 rounded-full bg-black/10 dark:bg-white/15 mt-2 overflow-hidden"><div className="h-full w-1/3 bg-zivv-purple rounded-full" /></div>}
          </div>
          {!src && (
            <button onClick={() => setPlaying(!playing)} className="w-10 h-10 rounded-full bg-zivv-purple text-white flex items-center justify-center shrink-0 active:scale-95 transition" aria-label="Play">
              {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} className="ms-0.5" />}
            </button>
          )}
        </div>
      </div>
    );
  }
  return null;
}

export function PostCard({ post: p }) {
  const { user } = useZivv();
  const { t } = useLang();
  const [local, setLocal] = useState([]);
  const [showC, setShowC] = useState(false);
  const [shares, setShares] = useState(p.shareCount || 0);
  const nav = useNavigate();
  useEffect(() => {
    try {
      const seen = JSON.parse(sessionStorage.getItem('zv_viewed') || '[]');
      if (!seen.includes(p.id)) {
        seen.push(p.id);
        sessionStorage.setItem('zv_viewed', JSON.stringify(seen));
        api.post(`/feed/${p.id}/view`).catch(() => {});
      }
    } catch {}
  }, [p.id]);
  const share = async () => {
    setShares((v) => v + 1);
    try {
      if (navigator.share) await navigator.share({ title: 'ZIVV', text: p.text?.slice(0, 120), url: location.href });
      else await navigator.clipboard.writeText(location.href);
    } catch {}
  };
  return (
    <article className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-3 pb-1">
        <button onClick={() => nav(`/u/${p.author?.username}`)}><Avatar user={p.author} size={44} ring={p.author?.gold} /></button>
        <div className="flex-1 min-w-0">
          <button onClick={() => nav(`/u/${p.author?.username}`)} className="font-bold text-[15px] truncate flex items-center gap-1 hover:underline">
            {p.author?.name}
            {p.author?.verified && <VerifyIcon size={15} />}
            {p.author?.gold && <CrownIcon size={14} className="text-amber-500" />}
          </button>
          <div className="text-xs opacity-50">@{p.author?.username} · {fmt.time(p.createdAt)}{(p.viewCount || 0) > 0 && <> · {fmt.n(p.viewCount)} {t('feed.views')}</>}</div>
        </div>
        {p.aiGenerated && <AiBadge />}
      </div>
      {p.text && <p className="px-4 py-1 text-[15px] leading-relaxed whitespace-pre-wrap">{p.text}</p>}
      {!!p.hashtags?.length && (
        <div className="px-4 pb-1 flex flex-wrap gap-x-2 gap-y-0.5">
          {p.hashtags.map((h) => <Link key={h} to={`/search?q=${encodeURIComponent('#' + h)}`} className="text-zivv-purple font-semibold text-sm">#{h}</Link>)}
        </div>
      )}
      <PostMedia p={p} />
      <div className="flex items-center px-2 pt-0.5 pb-1">
        <LikeButton targetId={p.id} count={p.likeCount} />
        <button onClick={() => setShowC(!showC)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full opacity-60 hover:bg-zivv-purple/10 hover:text-zivv-purple hover:opacity-100 transition">
          <CommentIcon size={22} />
          {((p.commentCount || 0) + local.length) > 0 && <span className="text-[13px] font-semibold">{fmt.n((p.commentCount || 0) + local.length)}</span>}
        </button>
        <button onClick={share} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full opacity-60 hover:bg-zivv-blue/10 hover:text-zivv-blue hover:opacity-100 transition">
          <ShareIcon size={22} />
          {shares > 0 && <span className="text-[13px] font-semibold">{fmt.n(shares)}</span>}
        </button>
        <div className="flex-1" />
        <SaveButton postId={p.id} />
      </div>
      {showC && (
        <div className="px-4 pb-3 pt-1 space-y-2.5">
          {local.map((c) => (
            <div key={c.id} className="flex gap-2 items-start">
              <Avatar user={c.author} size={30} />
              <div className="bg-black/5 dark:bg-white/10 rounded-2xl rounded-ss-md px-3 py-1.5 text-sm flex-1">
                <span className="font-bold text-[13px] block">{c.author?.name}</span>{c.text}
              </div>
            </div>
          ))}
          <CommentBox onSend={(text) => setLocal((l) => [...l, { id: Date.now(), text, author: user }])} />
        </div>
      )}
    </article>
  );
}

function Stories() {
  const { t } = useLang();
  const [stories, setStories] = useState([]);
  const [view, setView] = useState(null);
  useEffect(() => {
    api.get('/search/explore').then((r) => setStories((r.data.suggestedAccounts || []).slice(0, 8).map((u) => ({ user: u })))).catch(() => {});
  }, []);
  if (!stories.length) return null;
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 px-1">
      <Link to="/create?type=story" className="flex flex-col items-center gap-1 shrink-0 w-[68px]">
        <span className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/10 border-2 border-dashed border-zivv-purple/60 flex items-center justify-center text-zivv-purple text-2xl font-light">+</span>
        <span className="text-[11px] font-semibold opacity-70">{t('feed.story')}</span>
      </Link>
      {stories.map((g, i) => (
        <button key={g.user?.id || i} onClick={() => setView(g)} className="flex flex-col items-center gap-1 shrink-0 w-[68px]">
          <span className="story-ring w-16 h-16 rounded-full p-[2.5px]">
            <span className="block w-full h-full rounded-full overflow-hidden border-[3px] border-white dark:border-neutral-950 bg-neutral-200 dark:bg-neutral-800">
              <Avatar user={g.user} size={58} />
            </span>
          </span>
          <span className="text-[11px] font-medium opacity-70 truncate w-full text-center">{g.user?.name?.split(' ')[0]}</span>
        </button>
      ))}
      {view && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4 fade-in" onClick={() => setView(null)}>
          <button className="absolute top-4 end-4 text-white/80 p-2" aria-label="Close"><XIcon size={26} /></button>
          <div className="story-card w-full max-w-sm rounded-2xl p-8 text-center text-white">
            <div className="flex justify-center"><Avatar user={view.user} size={60} /></div>
            <div className="font-bold mt-3">{view.user?.name}</div>
            <div className="text-white/70 mt-1 text-sm">{view.user?.bio}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Feed() {
  const { t } = useLang();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'home';
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      if (tab === 'explore') {
        const r = await api.get('/search/explore');
        const byId = Object.fromEntries((r.data.suggestedAccounts || []).map((u) => [u.id, u]));
        setPosts((r.data.trending || []).map((p) => ({ ...p, author: byId[p.authorId] || { name: 'ZIVV', username: 'zivv' } })));
      } else {
        const r = await api.get('/feed');
        setPosts(r.data.items || []);
      }
    } catch { setPosts([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [tab]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('zivv:reload', h);
    return () => window.removeEventListener('zivv:reload', h);
  }, [tab]);
  if (loading) return <PageLoader />;
  const tabs = [['home', t('feed.home')], ['explore', t('feed.explore')]];
  return (
    <div className="md:p-4 space-y-3">
      <div className="flex gap-2 px-4 md:px-0 pt-3 md:pt-0">
        {tabs.map(([v, l]) => (
          <button key={v} onClick={() => setParams(v === 'home' ? {} : { tab: v })}
            className={`px-5 py-1.5 text-sm font-bold rounded-full transition ${tab === v ? 'tab-active' : 'opacity-50'} flex-1 md:flex-none`}>{l}</button>
        ))}
      </div>
      {tab === 'home' && <div className="px-3 md:px-0"><Stories /></div>}
      {tab === 'home' && <div className="px-3 md:px-0"><Composer /></div>}
      {posts.length === 0 && (
        <div className="card p-10 text-center mx-3 md:mx-0">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center mb-3 text-neutral-400"><MoonIcon size={26} /></div>
          <div className="font-bold text-lg">{t('feed.empty')}</div>
          <div className="text-sm opacity-60 mt-1">{t('feed.emptySub')}</div>
        </div>
      )}
      <div className="space-y-3 px-0 md:px-0">
        {posts.map((p) => <PostCard key={p.id} post={p} />)}
      </div>
      <div className="text-center text-xs opacity-40 pb-6">{t('feed.end')}</div>
    </div>
  );
}
