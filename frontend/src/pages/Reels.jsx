import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { Avatar } from '../components/ui';

export default function Reels() {
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [liked, setLiked] = useState({});
  const ref = useRef(null);

  useEffect(() => { api.get('/reels').then((r) => setItems(r.data.items)); }, []);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const onScroll = () => setIdx(Math.round(el.scrollTop / el.clientHeight));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const r = items[idx];

  return (
    <div ref={ref} className="reel-snap h-[calc(100dvh-130px)] md:h-[calc(100dvh-60px)] overflow-y-auto no-scrollbar md:rounded-3xl md:overflow-hidden">
      {items.map((reel, i) => (
        <div key={reel.id} className="relative h-full w-full bg-black md:rounded-3xl overflow-hidden mb-2 md:mb-0 shrink-0" onClick={() => i === idx && setPlaying(!playing)}>
          <div className="absolute inset-0 zivv-gradient opacity-60" style={{ filter: `hue-rotate(${i * 40}deg)` }} />
          <div className="absolute inset-0 flex items-center justify-center text-white/90 text-7xl">{i === idx && !playing ? '▶️' : '🎬'}</div>

          {/* right stack */}
          <div className="absolute right-2 bottom-24 flex flex-col gap-4 items-center text-white" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setLiked({ ...liked, [reel.id]: !liked[reel.id] }); api.post(`/reels/${reel.id}/like`).catch(() => {}); }} className="flex flex-col items-center">
              <span className="text-3xl">{liked[reel.id] ? '❤️' : '🤍'}</span><span className="text-[11px] font-bold">{fmt.n(reel.likeCount + (liked[reel.id] ? 1 : 0))}</span>
            </button>
            <button className="flex flex-col items-center"><span className="text-3xl">💬</span><span className="text-[11px] font-bold">{fmt.n(reel.commentCount)}</span></button>
            <button className="flex flex-col items-center"><span className="text-3xl">🔁</span><span className="text-[11px] font-bold">{fmt.n(reel.shareCount)}</span></button>
            <button className="flex flex-col items-center"><span className="text-3xl">📑</span><span className="text-[11px] font-bold">Save</span></button>
            <button className="flex flex-col items-center"><span className="text-3xl">🎵</span><span className="text-[11px] font-bold">Sound</span></button>
            <button className="w-10 h-10 rounded-full zivv-gradient text-xl font-black">＋</button>
          </div>

          {/* bottom info */}
          <div className="absolute left-0 right-14 bottom-0 p-4 text-white bg-gradient-to-t from-black/80 to-transparent" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Avatar user={reel.author} size={36} />
              <span className="font-bold">@{reel.author?.username}</span>
              <button className="text-xs font-bold border border-white/60 rounded-full px-3 py-1">Follow</button>
            </div>
            <p className="mt-2 text-sm">{reel.caption}</p>
            <div className="flex gap-2 mt-1">{reel.hashtags?.map((h) => <span key={h} className="text-xs font-bold">#{h}</span>)}</div>
            <Link to={`/search?q=${encodeURIComponent(reel.sound?.title || '')}`} className="mt-2 inline-flex items-center gap-2 text-xs bg-white/15 rounded-full px-3 py-1.5">🎵 {reel.sound?.title} • {reel.sound?.artist}</Link>
          </div>
          <div className="absolute top-3 left-3 text-[11px] bg-black/60 text-white px-2 py-0.5 rounded-full">0:{String(reel.durationSec).padStart(2, '0')} • {fmt.n(reel.playCount)} views</div>
        </div>
      ))}
      {r && <div className="md:hidden text-center text-xs opacity-50 pb-6">Reel {idx + 1} / {items.length} — AI captions, subtitles & translation available in Create ✦</div>}
    </div>
  );
}
