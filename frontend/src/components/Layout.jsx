import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Logo, Avatar } from './ui';
import { useZivv } from '../lib/store';
import api from '../lib/api';
import {
  HomeIcon, SearchIcon, FilmIcon, PlusIcon, ChatIcon, BellIcon, UserIcon, UsersIcon,
  SlidersIcon, VaultIcon, BagIcon, MegaphoneIcon, CrownIcon, SparklesIcon, MenuIcon,
  XIcon, SunIcon, MoonIcon, LogOutIcon, FlameIcon, HashIcon, PlusCircleIcon,
} from './icons';

// Every page in the app, grouped for drawer + desktop sidebar.
const groups = (username) => [
  {
    label: 'Main', items: [
      { to: '/', label: 'Home', Icon: HomeIcon },
      { to: '/search', label: 'Search & Explore', Icon: SearchIcon },
      { to: '/reels', label: 'Reels', Icon: FilmIcon },
      { to: '/notifications', label: 'Notifications', Icon: BellIcon, badge: 'unread' },
    ],
  },
  {
    label: 'Connect', items: [
      { to: '/chat', label: 'Chat', Icon: ChatIcon },
      { to: '/private', label: 'Private Chat', Icon: VaultIcon },
      { to: '/friends', label: 'Friends', Icon: UsersIcon },
    ],
  },
  {
    label: 'Create & Grow', items: [
      { to: '/create', label: 'Create', Icon: PlusCircleIcon },
      { to: '/ai', label: 'ZIVV AI', Icon: SparklesIcon, hot: true },
      { to: '/market', label: 'Marketplace', Icon: BagIcon },
      { to: '/ads', label: 'Ads Manager', Icon: MegaphoneIcon },
      { to: '/gold', label: 'ZIVV Gold', Icon: CrownIcon, gold: true },
    ],
  },
  {
    label: 'Account', items: [
      { to: `/u/${username || 'you'}`, label: 'My Profile', Icon: UserIcon },
      { to: '/settings', label: 'Settings', Icon: SlidersIcon },
    ],
  },
];

const bottomTabs = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/reels', label: 'Reels', Icon: FilmIcon },
  { to: '/create', label: 'Create', fab: true },
  { to: '/chat', label: 'Chat', Icon: ChatIcon },
  { to: '/ai', label: 'AI', Icon: SparklesIcon },
];

function NavItem({ to, label, Icon, badge, count, hot, gold, onClick }) {
  return (
    <NavLink to={to} onClick={onClick}
      className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-2xl font-semibold transition hover:bg-black/5 dark:hover:bg-white/10 ${isActive ? 'bg-black/[.06] dark:bg-white/10 text-zivv-purple' : ''}`}>
      <span className="relative">
        <Icon size={22} />
        {!!badge && !!count && <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-0.5 text-[10px] font-black text-white zivv-gradient rounded-full flex items-center justify-center">{count > 9 ? '9+' : count}</span>}
      </span>
      <span className="flex-1">{label}</span>
      {hot && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full zivv-gradient text-white">AI</span>}
      {gold && <CrownIcon size={16} className="text-amber-500" />}
    </NavLink>
  );
}

export default function Layout() {
  const { user, theme, setTheme, logout } = useZivv();
  const [drawer, setDrawer] = useState(false);
  const [unread, setUnread] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    api.get('/notifications').then((r) => setUnread(r.data.unread || 0)).catch(() => {});
  }, []);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <div className="min-h-full max-w-[1100px] mx-auto md:flex md:gap-6 md:px-6">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 py-6 sticky top-0 h-screen overflow-y-auto no-scrollbar">
        <div className="px-2 mb-4"><Logo /></div>
        {groups(user?.username).map((g) => (
          <div key={g.label} className="mb-2">
            <div className="px-4 pt-2 pb-1 text-[11px] font-black uppercase tracking-wider opacity-40">{g.label}</div>
            {g.items.map((it) => <NavItem key={it.to} {...it} count={unread} />)}
          </div>
        ))}
        <div className="mt-auto px-2 pt-4">
          <button onClick={toggleTheme} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl font-semibold w-full hover:bg-black/5 dark:hover:bg-white/10">
            {theme === 'dark' ? <SunIcon size={22} /> : <MoonIcon size={22} />}{theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 pb-24 md:pb-10 md:py-6 md:max-w-[640px]">
        <header className="md:hidden sticky top-0 z-20 backdrop-blur-xl bg-white/85 dark:bg-ink-950/85 border-b border-black/5 dark:border-white/10 px-3 py-2 flex items-center gap-1">
          <button onClick={() => setDrawer(true)} className="btn-ghost !px-2.5" aria-label="Menu"><MenuIcon size={22} /></button>
          <div className="flex-1"><Logo size={30} /></div>
          <button onClick={() => nav('/search')} className="btn-ghost !px-2.5" aria-label="Search"><SearchIcon size={21} /></button>
          <button onClick={() => nav('/notifications')} className="btn-ghost !px-2.5 relative" aria-label="Notifications">
            <BellIcon size={21} />
            {!!unread && <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-0.5 text-[10px] font-black text-white zivv-gradient rounded-full flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
          </button>
        </header>
        <div><Outlet /></div>
      </main>

      {/* Desktop right panel */}
      <aside className="hidden lg:block w-72 shrink-0 py-6 sticky top-0 h-screen overflow-y-auto no-scrollbar">
        <div className="rounded-3xl p-5 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-amber-950 shadow-pop">
          <div className="flex items-center gap-2 font-black text-lg"><CrownIcon size={22} />ZIVV Gold</div>
          <p className="text-sm font-medium opacity-80 mt-1 mb-3">Priority AI, premium profile, exclusive themes.</p>
          <button onClick={() => nav('/gold')} className="w-full bg-amber-950 text-white font-bold rounded-2xl py-2.5 active:scale-[.98] transition">Upgrade</button>
        </div>
        <div className="card p-5 mt-4">
          <div className="font-black mb-2 flex items-center gap-2"><FlameIcon size={18} className="text-zivv-pink" />Trending</div>
          {['football', 'programming', 'calm', 'cairo'].map((t) => (
            <button key={t} onClick={() => nav(`/search?q=${encodeURIComponent('#' + t)}`)} className="flex items-center gap-1.5 py-1.5 font-semibold text-zivv-purple"><HashIcon size={15} />{t}</button>
          ))}
        </div>
      </aside>

      {/* Mobile drawer — every page reachable */}
      {drawer && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 fade-in" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[300px] bg-white dark:bg-ink-900 shadow-2xl drawer-in flex flex-col overflow-y-auto">
            <div className="p-4 flex items-center justify-between sticky top-0 bg-white dark:bg-ink-900 z-10">
              <Logo size={32} />
              <button onClick={() => setDrawer(false)} className="btn-ghost !px-2.5" aria-label="Close"><XIcon size={20} /></button>
            </div>
            <button onClick={() => { setDrawer(false); nav(`/u/${user?.username || 'you'}`); }} className="mx-3 p-3 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center gap-3 text-left">
              <Avatar user={user} size={46} ring />
              <span className="flex-1 min-w-0"><span className="block font-bold truncate">{user?.name}</span><span className="block text-xs opacity-60">@{user?.username} · View profile</span></span>
            </button>
            <div className="p-2">
              {groups(user?.username).map((g) => (
                <div key={g.label} className="mb-1">
                  <div className="px-4 pt-3 pb-1 text-[11px] font-black uppercase tracking-wider opacity-40">{g.label}</div>
                  {g.items.map((it) => <NavItem key={it.to} {...it} count={unread} onClick={() => setDrawer(false)} />)}
                </div>
              ))}
            </div>
            <div className="mt-auto p-3 border-t border-black/5 dark:border-white/10 space-y-1">
              <button onClick={toggleTheme} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl font-semibold w-full hover:bg-black/5 dark:hover:bg-white/10">
                {theme === 'dark' ? <SunIcon size={22} /> : <MoonIcon size={22} />}{theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button onClick={logout} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl font-semibold w-full text-red-500 hover:bg-red-500/10">
                <LogOutIcon size={22} />Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 backdrop-blur-xl bg-white/90 dark:bg-ink-950/90 border-t border-black/5 dark:border-white/10 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-center py-1.5">
          {bottomTabs.map((t) => (
            <NavLink key={t.to + t.label} to={t.to} className="flex flex-col items-center px-4 py-1.5 rounded-2xl min-w-[64px]">
              {({ isActive }) => t.fab ? (
                <span className="zivv-gradient text-white w-12 h-12 -mt-6 rounded-2xl flex items-center justify-center shadow-pop border-4 border-neutral-100 dark:border-ink-950"><PlusIcon size={24} /></span>
              ) : (
                <>
                  <t.Icon size={24} className={isActive ? 'text-zivv-purple' : 'opacity-50'} />
                  <span className={`text-[10px] font-bold ${isActive ? 'text-zivv-purple' : 'opacity-50'}`}>{t.label}</span>
                  {isActive && <span className="w-1 h-1 rounded-full zivv-gradient mt-0.5" />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
