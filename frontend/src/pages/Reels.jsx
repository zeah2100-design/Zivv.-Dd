import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { Avatar, ZImg } from '../components/ui';
import {
  HeartIcon, HeartFilledIcon, CommentIcon, ShareIcon, BookmarkIcon, BookmarkFilledIcon,
  MusicIcon, DiscIcon, PlusIcon, PlayIcon, CameraIcon, HashIcon,
} from '../components/icons';

export default function Reels() {
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [liked, setLiked] = useState({});
  const [saved, setSaved] = useState({});
  const [following, setFollowing] = useState({});
  const ref = useRef(null);
  const nav = useNavigate();

  useEffect(() => { api.get('/reels').then((r) => setItems(r.data.items)); }, []);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const onScroll = () => { const i = Math.round(el.scrollTop / el.clientHeight); setIdx(i); setPlaying(true); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="relative">
      <div className="md:hidden absolute top-3 left-0 right-0 z-10 flex items-center justify-between px-4 text-white pointer-events-none">
        <span className="font-black text-lg drop-shadow">Reels</span>
        <button onClick={() => nav('/create')} className="pointer-events-auto p-2" aria-label="Create"><CameraIcon size={24} /></button>
      </div>
      <div ref={ref} className="reel-snap h-[calc(100dvh-129px)] md:h-[calc(100dvh-48px)] overflow-y-auto no-scrollbar md:rounded-3xl">
        {items.map((reel, i) => {
          const active = i === idx;
          return (
            <div key={reel.id} className="relative h-full w-full bg-black md:rounded-3xl overflow-hidden shrink-0" onClick={() => active && setPlaying(!playing)}>
              <div className="absolute inset-0 zivv-gradient" />
              <ZImg seed={`reel-${reel.id}`} w={540} h={960} className="absolute inset-0 w-full h-full object-cover" alt="Reel" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
              {active && !playing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="w-20 h-20 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white pop-in"><PlayIcon size={34} className="ml-1" /></span>
                </div>
              )}

              {/* right action stack */}
              <div className="absolute right-2.5 bottom-28 flex flex-col gap-5 items-center text-white" onClick={(e) => e.stopPropagation()}>
                <span className="relative">
                  <Avatar user={reel.author} size={46} />
                  <button onClick={() => setFollowing({ ...following, [reel.id]: !following[reel.id] })} aria-label="Follow"
                    className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center border-2 border-black transition ${following[reel.id] ? 'bg-white text-black' : 'zivv-gradient text-white'}`}>
                    {following[reel.id] ? <span className="text-sm font-black">✓</span> : <PlusIcon size={13} />}
                  </button>
                </span>
                <button onClick={() => { setLiked({ ...liked, [reel.id]: !liked[reel.id] }); api.post(`/reels/${reel.id}/like`).catch(() => {}); }} className="flex flex-col items-center gap-0.5 active:scale-90 transition" aria-label="Like">
                  <span key={String(!!liked[reel.id])} className={liked[reel.id] ? 'pop-in' : ''}>{liked[reel.id] ? <HeartFilledIcon size={30} className="text-rose-500 drop-shadow" /> : <HeartIcon size={30} className="drop-shadow" />}</span>
                  <span className="text-[11px] font-bold drop-shadow">{fmt.n(reel.likeCount + (liked[reel.id] ? 1 : 0))}</span>
                </button>
                <button className="flex flex-col items-center gap-0.5 active:scale-90 transition" aria-label="Comments"><CommentIcon size={29} className="drop-shadow" /><span className="text-[11px] font-bold drop-shadow">{fmt.n(reel.commentCount)}</span></button>
                <button className="flex flex-col items-center gap-0.5 active:scale-90 transition" aria-label="Share"><ShareIcon size={29} className="drop-shadow" /><span className="text-[11px] font-bold drop-shadow">{fmt.n(reel.shareCount)}</span></button>
                <button onClick={() => setSaved({ ...saved, [reel.id]: !saved[reel.id] })} className="flex flex-col items-center gap-0.5 active:scale-90 transition" aria-label="Save">
                  {saved[reel.id] ? <BookmarkFilledIcon size={28} className="text-amber-400 drop-shadow" /> : <BookmarkIcon size={28} className="drop-shadow" />}
                  <span className="text-[11px] font-bold drop-shadow">Save</span>
                </button>
                <span className="mt-1 spin-slow drop-shadow"><DiscIcon size={32} /></span>
              </div>

              {/* bottom info */}
              <div className="absolute left-0 right-16 bottom-0 p-4 pt-10 text-white" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <span className="font-bold drop-shadow">@{reel.author?.username}</span>
                  <button onClick={() => setFollowing({ ...following, [reel.id]: !following[reel.id] })} className={`text-xs font-bold rounded-full px-3.5 py-1.5 border transition ${following[reel.id] ? 'bg-white/20 border-transparent' : 'border-white/70'}`}>
                    {following[reel.id] ? 'Following' : 'Follow'}
                  </button>
                </div>
                <p className="mt-2 text-sm drop-shadow line-clamp-2">{reel.caption}</p>
                <div className="flex gap-2 mt-1.5 flex-wrap">{reel.hashtags?.map((h) => <span key={h} className="text-[13px] font-bold drop-shadow flex items-center"><HashIcon size={12} />{h}</span>)}</div>
                <Link to={`/search?q=${encodeURIComponent(reel.sound?.title || '')}`} className="mt-2.5 inline-flex items-center gap-2 text-xs bg-white/15 backdrop-blur rounded-full pl-2 pr-3 py-1.5 max-w-full">
                  <MusicIcon size={14} className="shrink-0" /><span className="truncate">{reel.sound?.title} · {reel.sound?.artist}</span>
                </Link>
              </div>
              <div className="absolute top-3 left-3 text-[11px] font-bold bg-black/55 backdrop-blur text-white px-2.5 py-1 rounded-full">0:{String(reel.durationSec).padStart(2, '0')} · {fmt.n(reel.playCount)} views</div>
              {/* progress */}
              <div className="absolute bottom-0 inset-x-0 h-[3px] bg-white/20"><div className={`h-full bg-white rounded-full ${active && playing ? 'story-fill' : ''}`} style={{ animationDuration: `${reel.durationSec}s` }} /></div>
            </div>
          );
        })}
        {!items.length && <div className="h-full flex items-center justify-center text-white/60 bg-neutral-900 md:rounded-3xl">Loading reels…</div>}
      </div>
    </div>
  );
}
