import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { processImage, MAX_UPLOAD_CHARS } from '../lib/image';
import { useZivv } from '../lib/store';
import { useLang } from '../lib/i18n';
import { Avatar, Verified, GoldBadge, Empty, ImageModal } from '../components/ui';
import PageLoader from '../components/PageLoader';
import { PostCard } from './Feed';
import { openConversation } from './Chat';
import { UserPlusIcon, CheckIcon, ChatIcon, GridIcon, ImageIcon, FilmIcon, ClapperIcon, MusicIcon, BagIcon, BackIcon, SlidersIcon, CameraIcon, XIcon, PlayIcon } from '../components/icons';

function Tile({ icon, label }) {
  return (
    <div className="w-full h-full bg-black/5 dark:bg-white/10 flex flex-col items-center justify-center gap-1 text-neutral-400 p-1">
      {icon}
      {!!label && <span className="text-[10px] font-semibold text-center line-clamp-2">{label}</span>}
    </div>
  );
}

function EditModal({ user, onClose, onSaved }) {
  const { t } = useLang();
  const [name, setName] = useState(user.name || '');
  const [bio, setBio] = useState(user.bio || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr('');
    const dataUrl = await processImage(f);
    if (!dataUrl) { setErr(t('create.failed')); return; }
    if (dataUrl.length > MAX_UPLOAD_CHARS) { setErr(t('profile.photoBig')); return; }
    setAvatar(dataUrl);
  };
  const save = async () => {
    setBusy(true); setErr('');
    try {
      const r = await api.patch('/users/me', { name: name.trim(), bio, avatar });
      onSaved(r.data.user);
    } catch { setErr(t('create.failed')); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] fade-in flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative card p-5 w-full max-w-sm slide-up space-y-3">
        <div className="flex items-center">
          <div className="font-bold text-lg flex-1">{t('profile.editProfile')}</div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center" aria-label="Close"><XIcon size={18} /></button>
        </div>
        <div className="flex items-center gap-3">
          <Avatar user={{ ...user, avatar }} size={64} ring={user.gold} />
          <button onClick={() => fileRef.current?.click()} className="btn-ghost !py-2 text-sm font-bold">{t('profile.changePhoto')}</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        </div>
        <div>
          <div className="text-xs font-bold opacity-60 mb-1">{t('profile.name')}</div>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="input" />
        </div>
        <div>
          <div className="text-xs font-bold opacity-60 mb-1">{t('profile.bio')}</div>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} className="input resize-none" />
        </div>
        {!!err && <div className="text-red-500 text-sm font-bold">{err}</div>}
        <button onClick={save} disabled={busy || !name.trim()} className="btn-primary w-full disabled:opacity-40">{t('profile.save')}</button>
      </div>
    </div>
  );
}

export default function Profile() {
  const { username } = useParams();
  const { t } = useLang();
  const { refreshUser } = useZivv();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState('posts');
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(null);
  const [msg, setMsg] = useState('');
  const [loadErr, setLoadErr] = useState(0);
  const avRef = useRef(null);
  const pressT = useRef(null);
  const pressFired = useRef(false);
  const clearPress = () => clearTimeout(pressT.current);
  const kingGo = () => { try { sessionStorage.setItem('zivv_king_entry', '1'); } catch {} nav('/king'); };

  useEffect(() => {
    setData(null); setFollowing(false); setTab('posts'); setMsg(''); setLoadErr(0);
    api.get(`/users/${username}`).then((r) => setData(r.data)).catch((e) => { setLoadErr(e.response?.status || -1); setData(false); });
  }, [username]);

  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(''), 2600);
    return () => clearTimeout(id);
  }, [msg]);

  const follow = async () => {
    const u = data?.user;
    if (!u) return;
    setFollowing(!following);
    try { await api.post(`/users/${u.id}/follow`); } catch { setFollowing(following); }
  };

  const changeAvatar = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const dataUrl = await processImage(f);
    if (!dataUrl) { setMsg(t('create.failed')); return; }
    if (dataUrl.length > MAX_UPLOAD_CHARS) { setMsg(t('profile.photoBig')); return; }
    {
      try {
        const r = await api.patch('/users/me', { avatar: dataUrl }, { timeout: 120000 });
        setData((d) => ({ ...d, user: r.data.user }));
        refreshUser();
        setMsg(t('profile.saved'));
      } catch { setMsg(t('create.failed')); }
    };
    }

  const onSaved = (u) => {
    setData((d) => ({ ...d, user: u }));
    refreshUser();
    setEditing(false);
    setMsg(t('profile.saved'));
  };

  if (data === null) return <PageLoader />;
  if (!data?.user) {
    if (loadErr && loadErr !== 404) {
      return (
        <div className="p-10 text-center space-y-3">
          <div className="font-bold">{t('profile.loadFailed')}</div>
          <button onClick={() => { setData(null); setLoadErr(0); api.get(`/users/${username}`).then((r) => setData(r.data)).catch((e) => { setLoadErr(e.response?.status || -1); setData(false); }); }} className="btn-primary">{t('profile.retry')}</button>
        </div>
      );
    }
    return <div className="p-10 text-center font-bold">@{username} — {t('profile.notFound')}</div>;
  }
  const u = data.user;
  const posts = (data.posts || []).map((p) => ({ ...p, author: u }));
  const written = posts.filter((p) => !p.type || p.type === 'TEXT');
  const photos = posts.filter((p) => p.type === 'IMAGE');
  const videos = posts.filter((p) => p.type === 'VIDEO');
  const songs = posts.filter((p) => p.type === 'MUSIC');
  const shorts = data.reels || [];
  const listings = data.listings || [];

  const TABS = [
    ['posts', GridIcon, t('profile.posts'), written.length],
    ['photos', ImageIcon, t('profile.photos'), photos.length],
    ['shorts', ClapperIcon, t('profile.shorts'), shorts.length],
    ['videos', FilmIcon, t('profile.videos'), videos.length],
    ['songs', MusicIcon, t('profile.songs'), songs.length],
    ['store', BagIcon, t('profile.store'), listings.length],
  ];

  return (
    <div className="max-w-2xl mx-auto pb-6">
      <div className="flex items-center gap-2 px-3 py-2 sticky top-0 z-10 backdrop-blur-xl bg-white/85 dark:bg-black/85 md:static md:bg-transparent">
        <button onClick={() => nav(-1)} className="btn-ghost !px-2.5 md:hidden rtl:rotate-180" aria-label="Back"><BackIcon size={20} /></button>
        <div className="font-bold text-lg truncate flex-1">@{u.username}</div>
        {data.isSelf && (
          <button
            onClick={(e) => { if (pressFired.current) { e.preventDefault(); pressFired.current = false; return; } nav('/settings'); }}
            onPointerDown={() => { pressT.current = setTimeout(() => { pressFired.current = true; kingGo(); }, 1000); }}
            onPointerUp={clearPress} onPointerLeave={clearPress} onPointerCancel={clearPress}
            onContextMenu={(e) => e.preventDefault()}
            className="btn-ghost !px-2.5" aria-label="Settings"><SlidersIcon size={19} /></button>
        )}
      </div>

      <div className="px-4 pt-2">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <button onClick={() => u.avatar && setZoom(u.avatar)} aria-label="Photo">
              <Avatar user={u} size={84} ring={u.gold} />
            </button>
            {data.isSelf && (
              <button onClick={() => avRef.current?.click()} aria-label={t('profile.changePhoto')}
                className="absolute bottom-0 end-0 w-8 h-8 rounded-full bg-zivv-purple text-white flex items-center justify-center border-[3px] border-white dark:border-neutral-950 active:scale-90 transition">
                <CameraIcon size={15} />
              </button>
            )}
            <input ref={avRef} type="file" accept="image/*" className="hidden" onChange={changeAvatar} />
          </div>
          <div className="flex-1 flex justify-around text-center">
            {[[posts.length, t('profile.posts')], [u.followers, t('profile.followers')], [u.following, t('profile.following')]].map(([n, l], i) => (
              <div key={i}><div className="font-bold text-lg">{fmt.n(n)}</div><div className="text-xs opacity-60">{l}</div></div>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <div className="font-bold flex items-center gap-1.5">{u.name}{u.verified && <Verified />}</div>
          {u.gold && <div className="mt-1"><GoldBadge /></div>}
          {u.bio && <div className="text-sm mt-1 whitespace-pre-wrap">{u.bio}</div>}
          {!!msg && <div className="mt-1.5 text-sm font-bold text-green-500 fade-in">{msg}</div>}
        </div>

        <div className="flex gap-2 mt-3">
          {data.isSelf ? (
            <button onClick={() => setEditing(true)} className="btn-ghost flex-1 font-bold">{t('profile.edit')}</button>
          ) : (
            <>
              <button onClick={follow} className={`flex-1 font-bold rounded-2xl px-5 py-2.5 transition flex items-center justify-center gap-2 ${following ? 'bg-black/5 dark:bg-white/10' : 'bg-zivv-purple text-white shadow-md'}`}>
                {following ? <><CheckIcon size={17} />{t('profile.followingBtn')}</> : <><UserPlusIcon size={17} />{t('profile.follow')}</>}
              </button>
              <button onClick={() => openConversation(u.id, nav)} className="btn-ghost font-bold flex items-center gap-2"><ChatIcon size={17} />{t('profile.message')}</button>
            </>
          )}
        </div>

        <div className="flex mt-4 border-b border-black/10 dark:border-white/10 overflow-x-auto no-scrollbar">
          {TABS.map(([v, Icon, l, n]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`flex-1 min-w-[86px] flex items-center justify-center gap-1.5 py-2.5 px-2 text-[13px] font-bold border-b-2 -mb-px transition whitespace-nowrap ${tab === v ? 'border-current' : 'border-transparent opacity-40'}`}>
              <Icon size={17} />{l}{n > 0 && <span className="opacity-60 font-semibold">({fmt.n(n)})</span>}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2.5">
          {tab === 'posts' && (written.length === 0
            ? <Empty icon={<GridIcon size={40} />} title={t('profile.noPosts')} sub="" />
            : written.map((p) => <PostCard key={p.id} post={p} />))}

          {tab === 'photos' && (photos.length === 0
            ? <Empty icon={<ImageIcon size={40} />} title={t('profile.noPhotos')} sub="" />
            : (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((p) => {
                  const src = p.media?.[0]?.cdnUrl || '';
                  return (
                    <button key={p.id} onClick={() => src && setZoom(src)} className="relative rounded-2xl overflow-hidden aspect-square bg-neutral-100 dark:bg-white/5">
                      {src ? <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" /> : <Tile icon={<ImageIcon size={26} />} label={p.text} />}
                    </button>
                  );
                })}
              </div>
            ))}

          {tab === 'shorts' && (shorts.length === 0
            ? <Empty icon={<ClapperIcon size={40} />} title={t('profile.noShorts')} sub="" />
            : (
              <div className="grid grid-cols-3 gap-1.5">
                {shorts.map((r) => (
                  <button key={r.id} onClick={() => nav('/reels')} className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-neutral-900">
                    {r.mediaUrl
                      ? <video src={r.mediaUrl} preload="metadata" muted playsInline className="w-full h-full object-cover" />
                      : <Tile icon={<ClapperIcon size={26} />} label={r.caption} />}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                    <span className="absolute bottom-2 start-2 end-2 text-white text-[11px] font-semibold truncate text-start flex items-center gap-1">
                      <PlayIcon size={12} />{fmt.n(r.playCount || 0)}
                    </span>
                  </button>
                ))}
              </div>
            ))}

          {tab === 'videos' && (videos.length === 0
            ? <Empty icon={<FilmIcon size={40} />} title={t('profile.noVideos')} sub="" />
            : videos.map((p) => {
              const src = p.media?.[0]?.cdnUrl || '';
              return (
                <div key={p.id} className="card overflow-hidden">
                  {src ? <video src={src} controls preload="metadata" playsInline className="w-full aspect-video bg-black" />
                    : <div className="aspect-video"><Tile icon={<FilmIcon size={30} />} /></div>}
                  {!!p.text && <div className="p-3 text-sm">{p.text}</div>}
                </div>
              );
            }))}

          {tab === 'songs' && (songs.length === 0
            ? <Empty icon={<MusicIcon size={40} />} title={t('profile.noSongs')} sub="" />
            : songs.map((p) => {
              const src = p.media?.[0]?.cdnUrl || '';
              return (
                <div key={p.id} className="card p-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-zivv-purple/15 text-zivv-purple flex items-center justify-center shrink-0">
                    <MusicIcon size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{p.text?.slice(0, 60) || 'Track'}</div>
                    <div className="text-xs opacity-60">{fmt.time(p.createdAt)}</div>
                    {src && <audio src={src} controls preload="metadata" className="w-full h-8 mt-1.5" />}
                  </div>
                </div>
              );
            }))}

          {tab === 'store' && (listings.length === 0
            ? <Empty icon={<BagIcon size={40} />} title={t('profile.noStore')} sub="" />
            : (
              <div className="grid grid-cols-2 gap-2.5">
                {listings.map((l) => (
                  <Link key={l.id} to={`/market/${l.id}`} className="card overflow-hidden">
                    <div className="aspect-square bg-neutral-100 dark:bg-white/5">
                      {l.image ? <img src={l.image} alt="" loading="lazy" className="w-full h-full object-cover" /> : <Tile icon={<BagIcon size={30} />} />}
                    </div>
                    <div className="p-2.5"><div className="font-bold text-sm">{fmt.money(l.priceCents, l.currency)}</div><div className="text-xs opacity-60 truncate">{l.title}</div></div>
                  </Link>
                ))}
              </div>
            ))}
        </div>
      </div>

      {editing && <EditModal user={u} onClose={() => setEditing(false)} onSaved={onSaved} />}
      <ImageModal src={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
