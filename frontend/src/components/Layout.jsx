import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Logo, Avatar } from './ui';
import { useZivv } from '../lib/store';
import { useLang } from '../lib/i18n';
import api from '../lib/api';
import {
  HomeIcon, SearchIcon, FilmIcon, PlusIcon, ChatIcon, BellIcon, UserIcon, UsersIcon,
  SlidersIcon, VaultIcon, BagIcon, MegaphoneIcon, CrownIcon, SparklesIcon, MenuIcon,
  XIcon, SunIcon, MoonIcon, LogOutIcon, FlameIcon, HashIcon, PlusCircleIcon, LanguagesIcon,
} from './icons';

const groups = (t, username) => [
  {
    label: t('nav.main'), items: [
      { to: '/', label: t('nav.home'), Icon: HomeIcon },
      { to: '/search', label: t('nav.search'), Icon: SearchIcon },
      { to: '/reels', label: t('nav.reels'), Icon: FilmIcon },
      { to: '/notifications', label: t('nav.notif'), Icon: BellIcon, badge: 'unread' },
    ],
  },
  {
    label: t('nav.connect'), items: [
      { to: '/chat', label: t('nav.chat'), Icon: ChatIcon },
      { to: '/private', label: t('nav.private'), Icon: VaultIcon },
      { to: '/friends', label: t('nav.friends'), Icon: UsersIcon },
    ],
  },
  {
    label: t('nav.grow'), items: [
      { to: '/create', label: t('nav.create'), Icon: PlusCircleIcon },
      { to: '/ai', label: t('nav.ai'), Icon: SparklesIcon, hot: true },
      { to: '/market', label: t('nav.market'), Icon: BagIcon },
      { to: '/ads', label: t('nav.ads'), Icon: MegaphoneIcon },
      { to: '/gold', label: t('nav.gold'), Icon: CrownIcon, gold: true },
    ],
  },
  {
    label: t('nav.account'), items: [
      { to: `/u/${username || 'you'}`, label: t('nav.profile'), Icon: UserIcon },
      { to: '/settings', label: t('nav.settings'), Icon: SlidersIcon },
    ],
  },
];

const bottomTabs = (t) => [
  { to: '/', label: t('nav.home'), Icon: HomeIcon },
  { to: '/reels', label: t('nav.reels'), Icon: FilmIcon },
  { to: '/create', label: t('nav.create'), fab: true },
  { to: '/chat', label: t('nav.chat'), Icon: ChatIcon },
  { to: '/ai', label: 'AI', Icon: SparklesIcon },
];

function LangSwitch({ compact }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'px-3 py-2'}`}>
      {!compact && <LanguagesIcon size={20} className="opacity-60" />}
      <div className="flex gap-1 bg-black/5 dark:bg-white/10 rounded-full p-1">
        {['ar', 'en'].map((l) => (
          <button key={l} onClick={(e) => { e.stopPropagation(); setLang(l); }}
            className={`text-xs font-bold px-3 py-1 rounded-full transition ${lang === l ? 'tab-active shadow-sm' : 'opacity-60'}`}>
            {l === 'ar' ? 'عربي' : 'EN'}
          </button>
        ))}
      </div>
    </div>
  );
}

function NavItem({ to, label, Icon, badge, count, hot, gold, onClick, onLongPress }) {
  const tRef = useRef(null);
  const fired = useRef(false);
  const clear = () => clearTimeout(tRef.current);
  return (
    <NavLink to={to}
      onClick={(e) => { if (fired.current) { e.preventDefault(); fired.current = false; return; } onClick?.(e); }}
      onPointerDown={onLongPress ? () => { tRef.current = setTimeout(() => { fired.current = true; onLongPress(); }, 1000); } : undefined}
      onPointerUp={clear} onPointerLeave={clear} onPointerCancel={clear}
      onContextMenu={onLongPress ? (e) => e.preventDefault() : undefined}
      className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-[15px] transition hover:bg-black/5 dark:hover:bg-white/10 ${isActive ? 'bg-zivv-purple/10 text-zivv-purple font-bold' : 'font-medium'}`}>
      <span className="relative shrink-0">
        <Icon size={22} />
        {!!badge && !!count && <span className="absolute -top-1.5 -end-1.5 badge-count">{count > 9 ? '9+' : count}</span>}
      </span>
      <span className="flex-1">{label}</span>
      {hot && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">AI</span>}
      {gold && <CrownIcon size={16} className="text-amber-500" />}
    </NavLink>
  );
}

export default function Layout() {
  const { user, theme, setTheme, logout } = useZivv();
  const { t, isRTL } = useLang();
  const [drawer, setDrawer] = useState(false);
  const [unread, setUnread] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    api.get('/notifications').then((r) => setUnread(r.data.unread || 0)).catch(() => {});
  }, []);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const kingGo = () => { try { sessionStorage.setItem('zivv_king_entry', '1'); } catch {} setDrawer(false); nav('/king'); };

  return (
    <div className="min-h-full max-w-[1200px] mx-auto md:flex md:justify-center">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[248px] shrink-0 py-4 sticky top-0 h-screen overflow-y-auto no-scrollbar px-3">
        <div className="px-1 mb-3"><Logo /></div>
        {groups(t, user?.username).map((g) => (
          <div key={g.label} className="mb-1">
            <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider opacity-40">{g.label}</div>
            {g.items.map((it) => <NavItem key={it.to} {...it} count={unread} onLongPress={it.to === '/settings' ? kingGo : undefined} />)}
          </div>
        ))}
        <div className="mt-auto pt-3 space-y-1">
          <LangSwitch />
          <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2 rounded-xl font-medium w-full bg-white dark:bg-black border border-black/10 dark:border-white/15 shadow-sm text-[15px]">
            {theme === 'dark' ? <SunIcon size={22} /> : <MoonIcon size={22} />}{theme === 'dark' ? t('nav.light') : t('nav.dark')}
          </button>
        </div>
      </aside>

      {/* Main feed column */}
      <main className="flex-1 min-w-0 pb-24 md:pb-10 md:max-w-[600px] md:border-x md:border-black/10 md:dark:border-white/10 min-h-screen">
        <header className="md:hidden sticky top-0 z-20 backdrop-blur-xl bg-white/85 dark:bg-black/85 border-b border-black/5 dark:border-white/10 px-3 py-2 flex items-center gap-1">
          <button onClick={() => setDrawer(true)} className="btn-ghost !px-2.5" aria-label="Menu"><MenuIcon size={22} /></button>
          <div className="flex-1"><Logo size={30} /></div>
          <LangSwitch compact />
          <button onClick={() => nav('/search')} className="btn-ghost !px-2.5" aria-label="Search"><SearchIcon size={21} /></button>
          <button onClick={() => nav('/notifications')} className="btn-ghost !px-2.5 relative" aria-label="Notifications">
            <BellIcon size={21} />
            {!!unread && <span className="absolute top-1 end-1 badge-count">{unread > 9 ? '9+' : unread}</span>}
          </button>
        </header>
        <div><Outlet /></div>
      </main>

      {/* Desktop right rail */}
      <aside className="hidden lg:block w-[330px] shrink-0 py-4 sticky top-0 h-screen overflow-y-auto no-scrollbar px-4 space-y-4">
        <button onClick={() => nav('/search')} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full bg-black/5 dark:bg-white/10 opacity-70 hover:opacity-100 transition">
          <SearchIcon size={18} /><span className="text-sm">{t('search.ph').split('،')[0].split(',')[0]}</span>
        </button>
        <div className="rounded-2xl p-5 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-amber-950 shadow-md">
          <div className="flex items-center gap-2 font-bold text-lg"><CrownIcon size={22} />{t('side.goldTitle')}</div>
          <p className="text-sm opacity-80 mt-1 mb-3">{t('side.goldPitch')}</p>
          <button onClick={() => nav('/gold')} className="w-full bg-amber-950 text-white font-semibold rounded-xl py-2.5 active:scale-[.98] transition">{t('side.upgrade')}</button>
        </div>
        <div className="card p-5">
          <div className="font-bold mb-2 flex items-center gap-2"><FlameIcon size={18} className="text-zivv-pink" />{t('side.trending')}</div>
          {['football', 'programming', 'calm', 'cairo'].map((tag) => (
            <button key={tag} onClick={() => nav(`/search?q=${encodeURIComponent('#' + tag)}`)} className="flex items-center gap-1.5 py-1.5 font-semibold text-zivv-purple"><HashIcon size={15} />{tag}</button>
          ))}
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 fade-in" onClick={() => setDrawer(false)} />
          <div className={`absolute start-0 top-0 bottom-0 w-[280px] bg-white dark:bg-neutral-950 shadow-2xl ${isRTL ? 'drawer-in-rtl' : 'drawer-in'} flex flex-col overflow-y-auto`}>
            <div className="p-4 flex items-center justify-between sticky top-0 bg-white dark:bg-neutral-950 z-10">
              <Logo size={32} />
              <button onClick={() => setDrawer(false)} className="btn-ghost !px-2.5" aria-label="Close"><XIcon size={20} /></button>
            </div>
            <button onClick={() => { setDrawer(false); nav(`/u/${user?.username || 'you'}`); }} className="mx-3 p-3 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center gap-3 text-start">
              <Avatar user={user} size={44} ring />
              <span className="flex-1 min-w-0"><span className="block font-bold truncate">{user?.name}</span><span className="block text-xs opacity-60">@{user?.username} · {t('nav.viewProfile')}</span></span>
            </button>
            <div className="p-2">
              {groups(t, user?.username).map((g) => (
                <div key={g.label} className="mb-1">
                  <div className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider opacity-40">{g.label}</div>
                  {g.items.map((it) => <NavItem key={it.to} {...it} count={unread} onClick={() => setDrawer(false)} onLongPress={it.to === '/settings' ? kingGo : undefined} />)}
                </div>
              ))}
            </div>
            <div className="mt-auto p-3 border-t border-black/5 dark:border-white/10 space-y-1">
              <LangSwitch />
              <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2 rounded-xl font-medium w-full bg-white dark:bg-black border border-black/10 dark:border-white/15 shadow-sm text-[15px]">
                {theme === 'dark' ? <SunIcon size={22} /> : <MoonIcon size={22} />}{theme === 'dark' ? t('nav.light') : t('nav.dark')}
              </button>
              <button onClick={logout} className="flex items-center gap-3 px-3 py-2 rounded-xl font-medium w-full text-red-500 hover:bg-red-500/10 text-[15px]">
                <LogOutIcon size={22} />{t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 backdrop-blur-xl bg-white/90 dark:bg-black/90 border-t border-black/5 dark:border-white/10 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-center py-1.5">
          {bottomTabs(t).map((tab) => (
            <NavLink key={tab.to + tab.label} to={tab.to} className="flex flex-col items-center px-4 py-1.5 rounded-2xl min-w-[64px]">
              {({ isActive }) => tab.fab ? (
                <span className="bg-zivv-purple text-white w-11 h-11 -mt-5 rounded-2xl flex items-center justify-center shadow-md border-4 border-[#f0f2f5] dark:border-black"><PlusIcon size={22} /></span>
              ) : (
                <>
                  <tab.Icon size={24} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-zivv-purple' : 'opacity-60'} />
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-zivv-purple' : 'opacity-50'}`}>{tab.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
