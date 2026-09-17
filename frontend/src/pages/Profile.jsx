import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { useLang } from '../lib/i18n';
import { Avatar, ZImg, Verified, GoldBadge, Empty } from '../components/ui';
import PageLoader from '../components/PageLoader';
import { PostCard } from './Feed';
import { openConversation } from './Chat';
import { UserPlusIcon, CheckIcon, ChatIcon, GridIcon, FilmIcon, BagIcon, BackIcon, SlidersIcon } from '../components/icons';

export default function Profile() {
  const { username } = useParams();
  const { t } = useLang();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState('posts');

  useEffect(() => {
    setData(null); setFollowing(false);
    api.get(`/users/${username}`).then((r) => { setData(r.data); setFollowing(false); }).catch(() => setData(null));
  }, [username]);

  const follow = async () => {
    const u = data?.user;
    if (!u) return;
    setFollowing(!following);
    try { await api.post(`/users/${u.id}/follow`); } catch { setFollowing(following); }
  };

  if (data === null) return <PageLoader />;
  if (!data?.user) return <div className="p-10 text-center font-bold">{t('profile.notFound')}</div>;
  const u = data.user;
  const posts = (data.posts || []).map((p) => ({ ...p, author: u }));

  return (
    <div className="max-w-2xl mx-auto pb-6">
      <div className="flex items-center gap-2 px-3 py-2 sticky top-0 z-10 backdrop-blur-xl bg-white/85 dark:bg-black/85 md:static md:bg-transparent">
        <button onClick={() => nav(-1)} className="btn-ghost !px-2.5 md:hidden rtl:rotate-180" aria-label="Back"><BackIcon size={20} /></button>
        <div className="font-bold text-lg truncate flex-1">@{u.username}</div>
        {data.isSelf && <button onClick={() => nav('/settings')} className="btn-ghost !px-2.5" aria-label="Settings"><SlidersIcon size={19} /></button>}
      </div>

      <div className="px-4 pt-2">
        <div className="flex items-center gap-5">
          <Avatar user={u} size={84} ring={u.gold} />
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
        </div>

        <div className="flex gap-2 mt-3">
          {data.isSelf ? (
            <button onClick={() => nav('/settings')} className="btn-ghost flex-1 font-bold">{t('profile.edit')}</button>
          ) : (
            <>
              <button onClick={follow} className={`flex-1 font-bold rounded-2xl px-5 py-2.5 transition flex items-center justify-center gap-2 ${following ? 'bg-black/5 dark:bg-white/10' : 'bg-zivv-purple text-white shadow-md'}`}>
                {following ? <><CheckIcon size={17} />{t('profile.followingBtn')}</> : <><UserPlusIcon size={17} />{t('profile.follow')}</>}
              </button>
              <button onClick={() => openConversation(u.id, nav)} className="btn-ghost font-bold flex items-center gap-2"><ChatIcon size={17} />{t('profile.message')}</button>
            </>
          )}
        </div>

        <div className="flex mt-4 border-b border-black/10 dark:border-white/10">
          {[['posts', <GridIcon key="g" size={19} />, t('profile.posts')], ['reels', <FilmIcon key="f" size={19} />, t('profile.reels')], ['store', <BagIcon key="b" size={19} />, t('profile.store')]].map(([v, icon, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold border-b-2 -mb-px transition ${tab === v ? 'border-current' : 'border-transparent opacity-40'}`}>
              {icon}{l}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2.5">
          {tab === 'posts' && (posts.length === 0
            ? <Empty icon={<GridIcon size={40} />} title={t('profile.noPosts')} sub="" />
            : posts.map((p) => <PostCard key={p.id} post={p} />))}
          {tab === 'reels' && (
            !(data.reels || []).length ? <Empty icon={<FilmIcon size={40} />} title={t('profile.noReels')} sub="" /> : (
              <div className="grid grid-cols-3 gap-1.5">
                {(data.reels || []).map((r) => (
                  <button key={r.id} onClick={() => nav('/reels')} className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-neutral-800">
                    <ZImg seed={`reel-${r.id}`} w={300} h={400} className="w-full h-full object-cover" alt="" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute bottom-2 start-2 end-2 text-white text-[11px] font-semibold truncate text-start">{r.caption}</span>
                  </button>
                ))}
              </div>
            ))}
          {tab === 'store' && (
            !(data.listings || []).length ? <Empty icon={<BagIcon size={40} />} title={t('profile.noStore')} sub="" /> : (
              <div className="grid grid-cols-2 gap-2.5">
                {(data.listings || []).map((l) => (
                  <Link key={l.id} to={`/market/${l.id}`} className="card overflow-hidden">
                    <div className="aspect-square bg-neutral-100 dark:bg-white/5"><ZImg seed={`listing-${l.id}`} w={400} h={400} className="w-full h-full object-cover" alt="" /></div>
                    <div className="p-2.5"><div className="font-bold text-sm">{fmt.money(l.priceCents, l.currency)}</div><div className="text-xs opacity-60 truncate">{l.title}</div></div>
                  </Link>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
