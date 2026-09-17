import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { Avatar, Verified, GoldBadge, ZImg } from '../components/ui';
import { useZivv } from '../lib/store';
import {
  CrownIcon, ImageIcon, FileTextIcon, MusicIcon, ClapperIcon, BagIcon,
  ChatIcon, ShareIcon, MapPinIcon, LinkIcon, CalendarIcon, CheckIcon,
} from '../components/icons';

const tabs = [
  { id: 'photos', label: 'Photos', Icon: ImageIcon },
  { id: 'text', label: 'Text', Icon: FileTextIcon },
  { id: 'songs', label: 'Songs', Icon: MusicIcon },
  { id: 'videos', label: 'Videos', Icon: ClapperIcon },
  { id: 'store', label: 'Store', Icon: BagIcon },
];

const typeIcon = { VIDEO: ClapperIcon, MUSIC: MusicIcon, IMAGE: ImageIcon, TEXT: FileTextIcon };

export default function Profile() {
  const { username } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('photos');
  const [following, setFollowing] = useState(false);
  const nav = useNavigate();

  useEffect(() => { api.get(`/users/${username}`).then((r) => { setData(r.data); setFollowing(false); }).catch(() => setData(null)); }, [username]);
  if (data === null) return <div className="p-6 text-center opacity-60">Loading…</div>;
  if (!data) return <div className="p-6 text-center opacity-60">User not found</div>;
  const u = data.user;

  const follow = async () => {
    setFollowing(!following);
    try { await api.post(`/users/${u.id}/follow`); } catch {}
  };

  return (
    <div className="pt-3">
      <div className="h-40 zivv-gradient mx-3 md:mx-0 rounded-3xl relative overflow-hidden">
        <ZImg seed={`cover-${u.id}`} w={800} h={300} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Cover" />
      </div>
      <div className="px-4 -mt-11 relative">
        <div className="flex items-end justify-between">
          <div className="p-1 bg-white dark:bg-ink-950 rounded-full"><Avatar user={u} size={88} /></div>
          <button onClick={() => nav('/gold')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 text-amber-950 text-sm font-black shadow mb-1"><CrownIcon size={16} />Gold</button>
        </div>
        <div className="font-black text-xl mt-2 flex items-center gap-1.5 flex-wrap">{u.name} {u.verified && <Verified gold={u.gold} />} {u.gold && <GoldBadge />}</div>
        <div className="text-sm opacity-60">@{u.username}</div>
        <p className="text-sm mt-1.5 leading-relaxed">{u.bio}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[13px] opacity-60">
          <span className="flex items-center gap-1"><MapPinIcon size={13} />Giza, Egypt</span>
          <span className="flex items-center gap-1"><CalendarIcon size={13} />Joined 2024</span>
          {u.website && <span className="flex items-center gap-1 text-zivv-purple"><LinkIcon size={13} />{u.website}</span>}
        </div>
        <div className="flex gap-4 mt-2.5 text-sm">
          <span><b>{data.posts?.length ?? 0}</b> <span className="opacity-60">posts</span></span>
          <span><b>{fmt.n(u.followers + (following ? 1 : 0))}</b> <span className="opacity-60">followers</span></span>
          <span><b>{fmt.n(u.following)}</b> <span className="opacity-60">following</span></span>
        </div>
        <div className="flex gap-2 mt-3">
          {data.isSelf ? (
            <><button onClick={() => nav('/settings')} className="btn-primary flex-1">Edit profile</button><button className="btn-ghost flex items-center gap-1.5"><ShareIcon size={16} />Share</button></>
          ) : (
            <>
              <button onClick={follow} className={following ? 'btn-ghost flex-1 flex items-center justify-center gap-1.5' : 'btn-primary flex-1 flex items-center justify-center gap-1.5'}>
                {following && <CheckIcon size={15} />}{following ? 'Following' : 'Follow'}
              </button>
              <button onClick={() => nav('/chat')} className="btn-ghost flex-1 flex items-center justify-center gap-1.5"><ChatIcon size={16} />Message</button>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-2 px-3 mt-4 overflow-x-auto no-scrollbar">
        {tabs.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap flex items-center gap-1.5 transition ${tab === t.id ? 'tab-active' : 'bg-black/5 dark:bg-white/10'}`}><t.Icon size={15} />{t.label}</button>)}
      </div>
      <div className="p-3 grid grid-cols-3 gap-2 pb-6">
        {tab === 'store' ? (data.listings || []).map((l) => (
          <Link key={l.id} to={`/market/${l.id}`} className="card overflow-hidden !rounded-2xl">
            <div className="aspect-square zivv-gradient relative"><ZImg seed={`listing-${l.id}`} w={300} h={300} className="absolute inset-0 w-full h-full object-cover" alt={l.title} /></div>
            <div className="p-2"><div className="text-xs font-bold truncate">{l.title}</div><div className="text-xs text-zivv-purple font-black">{fmt.money(l.priceCents, l.currency)}</div></div>
          </Link>
        )) : (data.posts || []).slice(0, 9).map((p) => {
          const Icon = typeIcon[p.type] || FileTextIcon;
          return (
            <div key={p.id} className="card overflow-hidden !rounded-2xl">
              <div className="aspect-square relative zivv-gradient">
                {(p.type === 'IMAGE' || p.type === 'VIDEO') && <ZImg seed={`post-${p.id}`} w={300} h={300} className="absolute inset-0 w-full h-full object-cover" alt="" />}
                <span className="absolute top-1.5 right-1.5 text-white drop-shadow"><Icon size={16} /></span>
              </div>
              <div className="p-2 text-[11px] truncate opacity-70">{p.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
