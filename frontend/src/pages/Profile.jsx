import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { Avatar, Verified, GoldBadge } from '../components/ui';
import { useZivv } from '../lib/store';

const tabs = [['photos', '📷 Photos'], ['text', '📝 Text'], ['songs', '🎧 Songs'], ['videos', '🎬 Videos'], ['store', '🛍️ Store']];

export default function Profile() {
  const { username } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('photos');
  const [following, setFollowing] = useState(false);
  const { user } = useZivv();
  const nav = useNavigate();

  useEffect(() => { api.get(`/users/${username}`).then((r) => { setData(r.data); setFollowing(r.data.isFollowing); }).catch(() => setData(null)); }, [username]);
  if (!data) return <div className="p-6 text-center opacity-60">Loading…</div>;
  const u = data.user;

  return (
    <div className="pt-3">
      <div className="h-36 zivv-gradient mx-3 md:mx-0 rounded-3xl" />
      <div className="px-4 -mt-10">
        <div className="flex items-end justify-between">
          <div className="p-1 bg-white dark:bg-ink-950 rounded-full"><Avatar user={u} size={84} /></div>
          <button onClick={() => nav('/gold')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 text-amber-950 text-sm font-black shadow">🥇 Gold</button>
        </div>
        <div className="font-black text-xl mt-2 flex items-center gap-1.5">{u.name} {u.verified && <Verified gold={u.gold} />} {u.gold && <GoldBadge />}</div>
        <div className="text-sm opacity-60">@{u.username}</div>
        <p className="text-sm mt-1.5">{u.bio}</p>
        <div className="flex gap-4 mt-2 text-sm"><span><b>{u.posts ?? data.posts?.length ?? 0}</b> posts</span><span><b>{fmt.n(u.followers)}</b> followers</span><span><b>{fmt.n(u.following)}</b> following</span></div>
        <div className="flex gap-2 mt-3">
          {data.isSelf ? (
            <><button onClick={() => nav('/settings')} className="btn-primary flex-1">Edit profile</button><button className="btn-ghost">Share</button></>
          ) : (
            <><button onClick={() => setFollowing(!following)} className={following ? 'btn-ghost flex-1' : 'btn-primary flex-1'}>{following ? 'Following ✓' : 'Follow'}</button><button onClick={() => nav('/chat')} className="btn-ghost flex-1">Message</button><button className="btn-ghost">•••</button></>
          )}
        </div>
      </div>
      <div className="flex gap-2 px-3 mt-4 overflow-x-auto no-scrollbar">
        {tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${tab === id ? 'tab-active' : 'bg-black/5 dark:bg-white/10'}`}>{label}</button>)}
      </div>
      <div className="p-3 grid grid-cols-3 gap-2">
        {tab === 'store' ? (data.listings || []).map((l) => (
          <Link key={l.id} to={`/market/${l.id}`} className="card overflow-hidden"><div className="h-24 zivv-gradient flex items-center justify-center text-3xl">🛍️</div><div className="p-2"><div className="text-xs font-bold truncate">{l.title}</div><div className="text-xs text-zivv-purple font-black">{fmt.money(l.priceCents, l.currency)}</div></div></Link>
        )) : (data.posts || []).slice(0, 9).map((p, i) => (
          <div key={p.id} className="card overflow-hidden"><div className="h-24 flex items-center justify-center text-3xl zivv-gradient" style={{ filter: `hue-rotate(${i * 35}deg)` }}>{p.type === 'VIDEO' ? '🎬' : p.type === 'MUSIC' ? '🎧' : p.type === 'IMAGE' ? '🖼️' : '📝'}</div><div className="p-2 text-[11px] truncate opacity-70">{p.text}</div></div>
        ))}
      </div>
    </div>
  );
}
