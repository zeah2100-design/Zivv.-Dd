import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useZivv } from '../lib/store';
import api from '../lib/api';

function Row({ icon, label, right, onClick, danger }) {
  return <button onClick={onClick} className={`w-full flex items-center gap-3 p-3.5 hover:bg-black/5 dark:hover:bg-white/5 text-left ${danger ? 'text-red-500' : ''}`}><span className="text-xl">{icon}</span><span className="flex-1 font-semibold text-sm">{label}</span>{right}</button>;
}

export default function Settings() {
  const { theme, setTheme, lang, setLang, logout, user, setUser } = useZivv();
  const [aiMix, setAiMix] = useState(30);
  const [press, setPress] = useState(0);
  const timer = useRef(null);
  const nav = useNavigate();

  // Hidden King entry: 60s long-press reveals admin login. Obscurity ≠ security:
  // server still enforces password hash + roles + audit + rate limits.
  const startPress = () => {
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setPress(s);
      if (s >= 60) { clearInterval(timer.current); setPress(0); nav('/king'); }
    }, 250);
  };
  const endPress = () => { clearInterval(timer.current); setPress(0); };

  const saveBio = async () => {
    const bio = prompt('New bio:', user?.bio || '');
    if (bio === null) return;
    const { data } = await api.patch('/users/me', { bio });
    setUser(data.user);
  };

  return (
    <div className="px-3 md:px-0 pt-3 space-y-3 pb-8">
      <h1 className="text-2xl font-black px-1">Control Center ⚙️</h1>

      <div className="card divide-y divide-black/5 dark:divide-white/10 overflow-hidden">
        <div className="px-4 pt-3 text-xs font-black opacity-50">ACCOUNT</div>
        <Row icon="👤" label="Name, username, email, birthday" onClick={saveBio} right={<span className="text-xs opacity-50">@{user?.username}</span>} />
        <Row icon="🔑" label="Password & 2FA" right={<span className="text-xs opacity-50">Protected</span>} />
        <Row icon="📱" label="Logged-in devices" right={<span className="text-xs opacity-50">2</span>} />
        <Row icon="✅" label="Verification" />
        <Row icon="🚪" label="Logout all devices" danger onClick={logout} />
      </div>

      <div className="card divide-y divide-black/5 dark:divide-white/10 overflow-hidden">
        <div className="px-4 pt-3 text-xs font-black opacity-50">PRIVACY</div>
        <Row icon="🔒" label="Private account" right={<Toggle />} />
        <Row icon="💬" label="Who can message me" right={<span className="text-xs opacity-50">Everyone ▾</span>} />
        <Row icon="💭" label="Who can comment" right={<span className="text-xs opacity-50">Everyone ▾</span>} />
        <Row icon="🟢" label="Activity status & last seen" right={<Toggle on />} />
        <Row icon="🔍" label="Discoverability & contact sync" right={<Toggle />} />
      </div>

      <div className="card p-4">
        <div className="text-xs font-black opacity-50 mb-2">AI CONTENT CONTROL ✦</div>
        <div className="text-sm font-semibold">AI content in recommendations: <b className="zivv-gradient-text">{aiMix}%</b></div>
        <input type="range" min={0} max={100} value={aiMix} onChange={(e) => setAiMix(+e.target.value)} className="w-full accent-purple-600 mt-2" />
        <div className="flex gap-2 mt-2 flex-wrap">{[0, 30, 50, 100].map((v) => <button key={v} onClick={() => setAiMix(v)} className={`text-xs font-bold px-3 py-1.5 rounded-full ${aiMix === v ? 'tab-active' : 'bg-black/5 dark:bg-white/10'}`}>{v}% AI</button>)}</div>
        <p className="text-[11px] opacity-60 mt-2">AI classification is probabilistic, not perfectly reliable. Applies to Feed, Reels, Explore.</p>
        <div className="flex gap-2 mt-2 flex-wrap"><button className="btn-ghost text-xs">Manage interests</button><button className="btn-ghost text-xs">Block topics</button><button className="btn-ghost text-xs">Reset recommendations</button></div>
      </div>

      <div className="card divide-y divide-black/5 dark:divide-white/10 overflow-hidden">
        <div className="px-4 pt-3 text-xs font-black opacity-50">APPEARANCE & LANGUAGE</div>
        <Row icon={theme === 'dark' ? '🌙' : '☀️'} label="Theme" right={<div className="flex gap-1">{['light', 'dark', 'system'].map((t) => <button key={t} onClick={() => setTheme(t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t)} className={`text-xs font-bold px-2.5 py-1 rounded-full ${theme === t || (t === 'system' && false) ? 'tab-active' : 'bg-black/5 dark:bg-white/10'}`}>{t}</button>)}</div>} />
        <Row icon="🌍" label="Language" right={<div className="flex gap-1">{['en', 'ar'].map((l) => <button key={l} onClick={() => { setLang(l); localStorage.setItem('zivv_lang', l); }} className={`text-xs font-bold px-2.5 py-1 rounded-full ${lang === l ? 'tab-active' : 'bg-black/5 dark:bg-white/10'}`}>{l === 'ar' ? 'العربية' : 'English'}</button>)}</div>} />
        <Row icon="🔔" label="Notifications" onClick={() => nav('/notifications')} />
        <Row icon="📶" label="Data & video quality" right={<span className="text-xs opacity-50">Auto ▾</span>} />
      </div>

      <div className="card divide-y divide-black/5 dark:divide-white/10 overflow-hidden">
        <div className="px-4 pt-3 text-xs font-black opacity-50">HELP / LEGAL</div>
        <Row icon="❓" label="Help Center & FAQ" />
        <Row icon="🚩" label="Report a problem" />
        <Row icon="📜" label="Terms • Privacy • Guidelines • Ads • Copyright" />
      </div>

      {/* Hidden King area — long-press 60s */}
      <div className="text-center pt-4 select-none" onPointerDown={startPress} onPointerUp={endPress} onPointerLeave={endPress} onContextMenu={(e) => e.preventDefault()}>
        <span className="text-[11px] opacity-30">ZIVV v1.0 • made with ✦ {press > 0 && <span className="opacity-70">({press.toFixed(0)}s…)</span>}</span>
        {press > 0 && <div className="h-1 rounded-full bg-black/10 dark:bg-white/10 mt-1 overflow-hidden"><div className="h-full zivv-gradient" style={{ width: `${(press / 60) * 100}%` }} /></div>}
      </div>
    </div>
  );
}

function Toggle({ on }) {
  const [v, setV] = useState(!!on);
  return <button onClick={(e) => { e.stopPropagation(); setV(!v); }} className={`w-11 h-6 rounded-full transition ${v ? 'zivv-gradient' : 'bg-black/15 dark:bg-white/15'}`}><span className={`block w-5 h-5 bg-white rounded-full shadow transition ${v ? 'translate-x-5' : 'translate-x-0.5'}`} /></button>;
}
