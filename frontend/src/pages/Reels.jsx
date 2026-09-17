import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { useLang } from '../lib/i18n';
import { Avatar, ZImg } from '../components/ui';
import PageLoader from '../components/PageLoader';
import CommentsSheet from '../components/CommentsSheet';
import { LikeButton } from './Feed';
import { CommentIcon, ShareIcon, MusicIcon, PlusIcon, VerifyIcon, PlayIcon } from '../components/icons';

function ReelItem({ reel, active }) {
  const { t } = useLang();
  const nav = useNavigate();
  const [showC, setShowC] = useState(false);
  const [cc, setCc] = useState(reel.commentCount || 0);
  const [lc, setLc] = useState(reel.likeCount || 0);
  const [shares, setShares] = useState(reel.shareCount || 0);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    if (!active) return;
    setProgress(8);
    api.post(`/reels/${reel.id}/play`).catch(() => {});
    const t0 = Date.now();
    const iv = setInterval(() => {
      const p = 8 + ((Date.now() - t0) / ((reel.durationSec || 20) * 1000)) * 92;
      setProgress(p >= 100 ? 8 : p);
    }, 300);
    return () => clearInterval(iv);
  }, [active, reel.id]);

  const share = async () => {
    setShares((v) => v + 1);
    try {
      if (navigator.share) await navigator.share({ title: 'ZIVV Reel', text: reel.caption, url: location.href });
      else await navigator.clipboard.writeText(location.href);
    } catch {}
  };

  return (
    <div className="relative h-[calc(100dvh-108px)] md:h-[calc(100vh-40px)] w-full snap-start snap-always bg-black md:rounded-2xl overflow-hidden select-none">
      <div className="absolute inset-0 bg-neutral-900">
        {reel.mediaUrl
          ? <video src={reel.mediaUrl} loop muted playsInline autoPlay={active} preload={active ? 'auto' : 'none'} className="w-full h-full object-cover" />
          : <ZImg seed={`reel-${reel.id}`} w={540} h={960} className="w-full h-full object-cover" alt="" />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/85 pointer-events-none" />
      </div>
      {!active && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="w-16 h-16 rounded-full bg-black/55 backdrop-blur flex items-center justify-center text-white"><PlayIcon size={28} className="ms-1" /></span>
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20 z-10"><div className="h-full bg-white" style={{ width: `${progress}%` }} /></div>

      {/* Right action rail (TikTok-style) */}
      <div className="absolute bottom-24 end-2 flex flex-col items-center gap-4 text-white z-10">
        <button onClick={() => nav(`/u/${reel.author?.username}`)} className="relative mb-1">
          <Avatar user={reel.author} size={46} />
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-zivv-pink flex items-center justify-center"><PlusIcon size={13} /></span>
        </button>
        <div className="flex flex-col items-center -mb-1 [&_button]:!text-white [&_button]:!opacity-100">
          <LikeButton targetType="reel" targetId={reel.id} liked={reel.liked} count={0} hideCount onToggle={(v) => setLc((x) => Math.max(0, x + (v ? 1 : -1)))} />
          <span className="text-[11px] font-bold -mt-1">{fmt.n(lc)}</span>
        </div>
        <button onClick={() => setShowC(true)} className="flex flex-col items-center gap-0.5">
          <CommentIcon size={29} /><span className="text-[11px] font-bold">{fmt.n(cc)}</span>
        </button>
        <button onClick={share} className="flex flex-col items-center gap-0.5">
          <ShareIcon size={29} /><span className="text-[11px] font-bold">{shares > 0 ? fmt.n(shares) : t('reels.share')}</span>
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/40 animate-spin-slow">
          <Avatar user={reel.author} size={40} />
        </div>
      </div>

      {/* Caption */}
      <div className="absolute bottom-5 start-3 end-20 text-white space-y-1.5 z-10">
        <button onClick={() => nav(`/u/${reel.author?.username}`)} className="font-bold text-[16px] flex items-center gap-1">
          @{reel.author?.username}{reel.author?.verified && <VerifyIcon size={15} />}
        </button>
        {reel.caption && <p className="text-sm leading-snug line-clamp-2">{reel.caption}</p>}
        {!!reel.hashtags?.length && (
          <div className="flex flex-wrap gap-x-2">
            {reel.hashtags.map((h) => <Link key={h} to={`/search?q=${encodeURIComponent('#' + h)}`} className="text-[13px] font-bold text-white">#{h}</Link>)}
          </div>
        )}
        {reel.sound && (
          <div className="flex items-center gap-1.5 text-[13px] opacity-90">
            <MusicIcon size={14} className="animate-spin-slow shrink-0" />
            <span className="truncate">{reel.sound.title} · {reel.sound.artist}</span>
          </div>
        )}
      </div>

      {showC && <CommentsSheet targetType="reel" targetId={reel.id} count={cc} onCount={setCc} onClose={() => setShowC(false)} />}
    </div>
  );
}

export default function Reels() {
  const { t } = useLang();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);

  useEffect(() => {
    api.get('/reels').then((r) => setReels(r.data.items || [])).catch(() => setReels([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollTop / el.clientHeight));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [loading]);

  if (loading) return <PageLoader />;
  if (!reels.length) return <div className="card p-10 m-4 text-center"><div className="w-14 h-14 mx-auto rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center mb-3 text-neutral-400"><FilmIcon size={26} /></div><div className="font-bold">{t('reels.empty')}</div></div>;

  return (
    <div ref={wrapRef} className="h-[calc(100dvh-108px)] md:h-auto md:max-h-[calc(100vh-40px)] overflow-y-auto snap-y snap-mandatory no-scrollbar md:p-4 md:space-y-4">
      {reels.map((r, i) => <ReelItem key={r.id} reel={r} active={i === active} />)}
    </div>
  );
}
