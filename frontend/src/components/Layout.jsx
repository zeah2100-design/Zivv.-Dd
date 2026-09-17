import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Logo } from './ui';
import { useZivv } from '../lib/store';

// Hidden King entry lives in Settings (60s long-press). Never linked publicly.
const tabs = [
  { to: '/', icon: '🏠', label: 'Home' },
  { to: '/reels', icon: '🎬', label: 'Reels' },
  { to: '/create', icon: '➕', label: 'Create', fab: true },
  { to: '/chat', icon: '💬', label: 'Chat' },
  { to: '/ai', icon: '✦', label: 'AI' },
];

export default function Layout() {
  const { user } = useZivv();
  const nav = useNavigate();
  return (
    <div className="min-h-full max-w-[1100px] mx-auto md:flex md:gap-6 md:px-6">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 py-6 gap-1 sticky top-0 h-screen">
        <div className="px-2 mb-6"><Logo /></div>
        {[['🏠', 'Home', '/'], ['🔍', 'Search', '/search'], ['🎬', 'Reels', '/reels'], ['➕', 'Create', '/create'], ['💬', 'Chat', '/chat'], ['🔒', 'Private', '/private'], ['👥', 'Friends', '/friends'], ['✦', 'ZIVV AI', '/ai'], ['🔔', 'Notifications', '/notifications'], ['🛍️', 'Marketplace', '/market'], ['📣', 'Ads', '/ads'], ['🥇', 'Gold', '/gold'], ['👤', 'Profile', `/u/${user?.username || 'you'}`], ['⚙️', 'Settings', '/settings']].map(([icon, label, to]) => (
          <NavLink key={to + label} to={to} className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-2xl font-semibold hover:bg-black/5 dark:hover:bg-white/10 ${isActive ? 'bg-black/5 dark:bg-white/10' : ''}`}>
            <span className="text-xl">{icon}</span>{label}
          </NavLink>
        ))}
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 pb-24 md:pb-10 md:py-6 md:max-w-[640px]">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-ink-950/80 border-b border-black/5 dark:border-white/10 px-4 py-2.5 flex items-center justify-between">
          <Logo size={32} />
          <div className="flex gap-2">
            <button onClick={() => nav('/search')} className="btn-ghost !px-3">🔍</button>
            <button onClick={() => nav('/notifications')} className="btn-ghost !px-3">🔔</button>
            <button onClick={() => nav('/chat')} className="btn-ghost !px-3">💬</button>
          </div>
        </header>
        <div className="px-0 md:px-0"><Outlet /></div>
      </main>

      {/* Desktop right panel */}
      <aside className="hidden lg:block w-72 shrink-0 py-6 sticky top-0 h-screen">
        <div className="card p-5">
          <div className="font-black text-lg mb-1">ZIVV Gold 🥇</div>
          <p className="text-sm opacity-70 mb-3">Priority AI, premium profile, exclusive themes.</p>
          <button onClick={() => nav('/gold')} className="btn-primary w-full">Upgrade</button>
        </div>
        <div className="card p-5 mt-4">
          <div className="font-black mb-2">Trending ✦</div>
          {['#football', '#programming', '#calm', '#cairo'].map((t) => (
            <button key={t} onClick={() => nav(`/search?q=${encodeURIComponent(t)}`)} className="block py-1.5 font-semibold text-zivv-purple">{t}</button>
          ))}
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 backdrop-blur-xl bg-white/90 dark:bg-ink-950/90 border-t border-black/5 dark:border-white/10 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-center py-1.5">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => `flex flex-col items-center px-4 py-1.5 rounded-2xl ${t.fab ? '' : isActive ? 'text-zivv-purple' : 'opacity-60'}`}>
              {t.fab ? <span className="zivv-gradient text-white text-2xl w-12 h-12 -mt-6 rounded-2xl flex items-center justify-center shadow-pop border-4 border-neutral-100 dark:border-ink-950">＋</span>
                : <><span className="text-2xl">{t.icon}</span><span className="text-[10px] font-bold">{t.label}</span></>}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
