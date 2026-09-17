import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { Avatar, Verified, AiBadge, ZImg } from './ui';
import {
  HeartIcon, HeartFilledIcon, CommentIcon, ShareIcon, BookmarkIcon, BookmarkFilledIcon,
  DotsIcon, CirclePlayIcon, PlayIcon, PauseIcon, MusicIcon, GlobeIcon,
} from './icons';

export default function PostCard({ post }) {
  const [p, setP] = useState(post);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [playing, setPlaying] = useState(false);

  const like = async () => {
    setLiked(!liked); setP({ ...p, likeCount: p.likeCount + (liked ? -1 : 1) });
    try { await api.post(`/feed/${p.id}/like`); } catch {}
  };
  const save = async () => {
    setSaved(!saved);
    try { await api.post(`/feed/${p.id}/save`); } catch {}
  };

  return (
    <article className="card p-4 mb-3 float-in">
      <div className="flex items-center gap-3">
        <Link to={`/u/${p.author?.username}`}><Avatar user={p.author} ring size={44} /></Link>
        <div className="flex-1 min-w-0">
          <Link to={`/u/${p.author?.username}`} className="font-bold hover:underline flex items-center gap-1.5 text-[15px]">
            <span className="truncate">{p.author?.name}</span>{p.author?.verified && <Verified gold={p.author?.gold} />}
          </Link>
          <div className="text-xs opacity-60 flex items-center gap-1">@{p.author?.username} · {fmt.time(p.createdAt)} · <GlobeIcon size={12} /></div>
        </div>
        {p.aiGenerated && <AiBadge />}
        <button className="btn-ghost !px-2.5" aria-label="More"><DotsIcon size={19} /></button>
      </div>

      <p className="mt-3 leading-relaxed whitespace-pre-wrap text-[15px]">{p.text}</p>
      {!!p.hashtags?.length && (
        <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1">
          {p.hashtags.map((h) => <Link key={h} to={`/search?q=${encodeURIComponent('#' + h)}`} className="text-zivv-purple font-semibold text-sm">#{h}</Link>)}
        </div>
      )}

      {p.type === 'IMAGE' && (
        <div className="mt-3 rounded-2xl overflow-hidden zivv-gradient aspect-[4/3] relative">
          <ZImg seed={`post-${p.id}`} w={800} h={600} className="w-full h-full object-cover" alt="Post image" />
        </div>
      )}
      {p.type === 'VIDEO' && (
        <div className="mt-3 rounded-2xl overflow-hidden bg-black aspect-video relative group cursor-pointer" onClick={() => setPlaying(!playing)}>
          <div className="absolute inset-0 zivv-gradient opacity-30" />
          <ZImg seed={`vid-${p.id}`} w={800} h={450} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="Video" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-black/55 backdrop-blur flex items-center justify-center text-white group-hover:scale-110 transition">
              {playing ? <PauseIcon size={28} /> : <PlayIcon size={28} className="ml-1" />}
            </span>
          </div>
          <span className="absolute bottom-2.5 right-2.5 text-[11px] font-bold bg-black/70 text-white px-2 py-0.5 rounded-full">3:04</span>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20"><div className="h-full zivv-gradient rounded-full" style={{ width: playing ? '32%' : '8%' }} /></div>
        </div>
      )}
      {p.type === 'MUSIC' && (
        <div className="mt-3 rounded-2xl bg-black/[.04] dark:bg-white/[.07] p-3 flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden zivv-gradient shrink-0 relative">
            <ZImg seed={`song-${p.id}`} w={200} h={200} className="w-full h-full object-cover" alt="Cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">Midnight Nile</div>
            <div className="text-xs opacity-60 flex items-center gap-1"><MusicIcon size={12} />{p.author?.name} · 3:23</div>
            <div className="h-1 rounded-full bg-black/10 dark:bg-white/15 mt-2 overflow-hidden"><div className="h-full w-1/3 zivv-gradient rounded-full" /></div>
          </div>
          <button onClick={() => setPlaying(!playing)} className="w-11 h-11 rounded-full zivv-gradient text-white flex items-center justify-center shrink-0 shadow-md active:scale-95 transition" aria-label="Play">
            {playing ? <PauseIcon size={19} /> : <PlayIcon size={19} className="ml-0.5" />}
          </button>
        </div>
      )}

      <div className="mt-2.5 pt-1 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <button onClick={like} aria-label="Like" className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl font-semibold text-sm transition active:scale-90 ${liked ? 'text-rose-500' : 'opacity-70 hover:bg-black/5 dark:hover:bg-white/10'}`}>
            <span key={String(liked)} className={liked ? 'pop-in inline-flex' : 'inline-flex'}>{liked ? <HeartFilledIcon size={21} /> : <HeartIcon size={21} />}</span>{fmt.n(p.likeCount)}
          </button>
          <button aria-label="Comments" className="flex items-center gap-1.5 px-3 py-2 rounded-2xl font-semibold text-sm opacity-70 hover:bg-black/5 dark:hover:bg-white/10 transition"><CommentIcon size={20} />{fmt.n(p.commentCount)}</button>
          <button aria-label="Share" className="flex items-center gap-1.5 px-3 py-2 rounded-2xl font-semibold text-sm opacity-70 hover:bg-black/5 dark:hover:bg-white/10 transition"><ShareIcon size={20} />{fmt.n(p.shareCount)}</button>
        </div>
        <button onClick={save} aria-label="Save" className={`p-2.5 rounded-2xl transition active:scale-90 ${saved ? 'text-zivv-purple' : 'opacity-70 hover:bg-black/5 dark:hover:bg-white/10'}`}>
          {saved ? <BookmarkFilledIcon size={21} /> : <BookmarkIcon size={21} />}
        </button>
      </div>
    </article>
  );
}
