import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { Avatar, Verified, AiBadge } from './ui';

export default function PostCard({ post }) {
  const [p, setP] = useState(post);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  const like = async () => {
    setLiked(!liked); setP({ ...p, likeCount: p.likeCount + (liked ? -1 : 1) }); // optimistic
    try { await api.post(`/feed/${p.id}/like`); } catch {}
  };
  const save = async () => {
    setSaved(!saved);
    try { await api.post(`/feed/${p.id}/save`); } catch {}
  };

  return (
    <article className="card p-4 mb-4 float-in">
      <div className="flex items-center gap-3">
        <Avatar user={p.author} ring />
        <div className="flex-1 min-w-0">
          <Link to={`/u/${p.author?.username}`} className="font-bold hover:underline flex items-center gap-1.5">
            {p.author?.name} {p.author?.verified && <Verified gold={p.author?.gold} />}
          </Link>
          <div className="text-xs opacity-60">@{p.author?.username} • {fmt.time(p.createdAt)}</div>
        </div>
        {p.aiGenerated && <AiBadge />}
        <button className="btn-ghost !px-2.5">•••</button>
      </div>

      <p className="mt-3 leading-relaxed whitespace-pre-wrap">{p.text}</p>
      {!!p.hashtags?.length && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {p.hashtags.map((h) => <Link key={h} to={`/search?q=${encodeURIComponent('#' + h)}`} className="text-zivv-purple font-semibold text-sm">#{h}</Link>)}
        </div>
      )}

      {p.type === 'IMAGE' && <div className="mt-3 rounded-2xl zivv-gradient h-64 flex items-center justify-center text-white text-5xl">🖼️</div>}
      {p.type === 'VIDEO' && (
        <div className="mt-3 rounded-2xl bg-black h-64 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 zivv-gradient opacity-40" />
          <span className="relative text-white text-6xl">▶️</span>
          <span className="absolute bottom-2 right-2 text-[11px] bg-black/70 text-white px-2 py-0.5 rounded-full">3:04 • ≤5:00</span>
        </div>
      )}
      {p.type === 'MUSIC' && (
        <div className="mt-3 rounded-2xl bg-black/5 dark:bg-white/10 p-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl zivv-gradient flex items-center justify-center text-2xl">🎧</div>
          <div className="flex-1"><div className="font-bold text-sm">Midnight Nile</div><div className="text-xs opacity-60">3:23 • ▶ Preview</div></div>
          <button className="btn-primary !px-4">▶</button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="flex gap-1">
          <button onClick={like} className={`btn-ghost ${liked ? '!bg-pink-500/15' : ''}`}>{liked ? '❤️' : '🤍'} {fmt.n(p.likeCount)}</button>
          <button className="btn-ghost">💬 {fmt.n(p.commentCount)}</button>
          <button className="btn-ghost">🔁 {fmt.n(p.shareCount)}</button>
        </div>
        <button onClick={save} className="btn-ghost">{saved ? '🔖' : '📑'}</button>
      </div>
    </article>
  );
}
