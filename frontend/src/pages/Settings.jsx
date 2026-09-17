import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useZivv } from '../lib/store';
import api from '../lib/api';
import {
  UserIcon, KeyIcon, SmartphoneIcon, IdCardIcon, PowerIcon, LockIcon, ChatIcon,
  CommentIcon, ClockIcon, UsersIcon, SparklesIcon, HashIcon, BanIcon, RefreshIcon,
  SunIcon, MoonIcon, LanguagesIcon, BellIcon, GaugeIcon, LifeBuoyIcon, BugIcon, FileTextIcon,
} from '../components/icons';

function Row({ Icon, label, right, onClick, danger }) {
  return <button onClick={onClick} className={`w-full flex items-center gap-3 p-3.5 hover:bg-black/5 dark:hover:bg-white/5 text-left transition ${danger ? 'text-red-500' : ''}`}><span className={danger ? '' : 'opacity-70'}><Icon size={21} /></span><span className="flex-1 font-semibold text-sm">{label}</span>{right}</button>;
}

function Toggle({ on }) {
  const [v, setV] = useState(!!on);
  return <button onClick={(e) => { e.stopPropagation(); setV(!v); }} className={`w-11 h-6 rounded-full transition shrink-0 ${v ? 'zivv-gradient' : 'bg-black/15 dark:bg-white/15'}`} aria-label="Toggle"><span className={`block w-5 h-5 bg-white rounded-full shadow transition ${v ? 'translate-x-5' : 'translate-x-0.5'}`} /></button>;
}

export default function Settings() {
  const { theme, setTheme, lang, setLang, logout, user, setUser } = useZivv();
  const [aiMix, setAiMix] = useState(30);
  const [press, setPress] = useState(0);
  const timer = useRef(null);
  const nav = useNavigate();

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
      <h1 className="text-2xl font-black px-1">Settings</h1>

      <div className="card divide-y divide-black/5 dark:divide-white/10 overflow-hidden">
        <div className="px-4 pt-3 text-xs font-black opacity-50">ACCOUNT</div>
        <Row Icon={UserIcon} label="Name, username, email, birthday" onClick={saveBio} right={<span className="text-xs opacity-50">@{user?.username}</span>} />
        <Row Icon={KeyIcon} label="Password & 2FA" right={<span className="text-xs font-bold text-green-600">Protected</span>} />
        <Row Icon={SmartphoneIcon} label="Logged-in devices" right={<span className="text-xs opacity-50">2</span>} />
        <Row Icon={IdCardIcon} label="Verification" />
        <Row Icon={PowerIcon} label="Logout all devices" danger onClick={logout} />
      </div>

      <div className="card divide-y divide-black/5 dark:divide-white/10 overflow-hidden">
        <div className="px-4 pt-3 text-xs font-black opacity-50">PRIVACY</div>
        <Row Icon={LockIcon} label="Private account" right={<Toggle />} />
        <Row Icon={ChatIcon} label="Who can message me" right={<span className="text-xs opacity-50">Everyone</span>} />
        <Row Icon={CommentIcon} label="Who can comment" right={<span className="text-xs opacity-50">Everyone</span>} />
        <Row Icon={ClockIcon} label="Activity status & last seen" right={<Toggle on />} />
        <Row Icon={UsersIcon} label="Discoverability & contact sync" right={<Toggle />} />
      </div>

      <div className="card p-4">
        <div className="text-xs font-black opacity-50 mb-2 flex items-center gap-1.5"><SparklesIcon size={14} />AI CONTENT CONTROL</div>
        <div className="text-sm font-semibold">AI content in recommendations: <b className="zivv-gradient-text">{aiMix}%</b></div>
        <input type="range" min={0} max={100} value={aiMix} onChange={(e) => setAiMix(+e.target.value)} className="w-full accent-purple-600 mt-2" />
        <div className="flex gap-2 mt-2 flex-wrap">{[0, 30, 50, 100].map((v) => <button key={v} onClick={() => setAiMix(v)} className={`text-xs font-bold px-3 py-1.5 rounded-full transition ${aiMix === v ? 'tab-active' : 'bg-black/5 dark:bg-white/10'}`}>{v}% AI</button>)}</div>
        <p className="text-[11px] opacity-60 mt-2">AI classification is probabilistic, not perfectly reliable. Applies to Feed, Reels, Explore.</p>
        <div className="flex gap-2 mt-2 flex-wrap">
          <button className="btn-ghost text-xs flex items-center gap-1.5"><HashIcon size={13} />Manage interests</button>
          <button className="btn-ghost text-xs flex items-center gap-1.5"><BanIcon size={13} />Block topics</button>
          <button className="btn-ghost text-xs flex items-center gap-1.5"><RefreshIcon size={13} />Reset</button>
        </div>
      </div>

      <div className="card divide-y divide-black/5 dark:divide-white/10 overflow-hidden">
        <div className="px-4 pt-3 text-xs font-black opacity-50">APPEARANCE & LANGUAGE</div>
        <Row Icon={theme === 'dark' ? MoonIcon : SunIcon} label="Theme" right={<div className="flex gap-1">{['light', 'dark'].map((t) => <button key={t} onClick={(e) => { e.stopPropagation(); setTheme(t); }} className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${theme === t ? 'tab-active' : 'bg-black/5 dark:bg-white/10'}`}>{t}</button>)}</div>} />
        <Row Icon={LanguagesIcon} label="Language" right={<div className="flex gap-1">{['en', 'ar'].map((l) => <button key={l} onClick={(e) => { e.stopPropagation(); setLang(l); localStorage.setItem('zivv_lang', l); }} className={`text-xs font-bold px-2.5 py-1 rounded-full ${lang === l ? 'tab-active' : 'bg-black/5 dark:bg-white/10'}`}>{l === 'ar' ? 'العربية' : 'English'}</button>)}</div>} />
        <Row Icon={BellIcon} label="Notifications" onClick={() => nav('/notifications')} />
        <Row Icon={GaugeIcon} label="Data & video quality" right={<span className="text-xs opacity-50">Auto</span>} />
      </div>

      <div className="card divide-y divide-black/5 dark:divide-white/10 overflow-hidden">
        <div className="px-4 pt-3 text-xs font-black opacity-50">HELP / LEGAL</div>
        <Row Icon={LifeBuoyIcon} label="Help Center & FAQ" />
        <Row Icon={BugIcon} label="Report a problem" />
        <Row Icon={FileTextIcon} label="Terms · Privacy · Guidelines · Ads · Copyright" />
      </div>

      <div className="text-center pt-4 select-none" onPointerDown={startPress} onPointerUp={endPress} onPointerLeave={endPress} onContextMenu={(e) => e.preventDefault()}>
        <span className="text-[11px] opacity-30">ZIVV v1.0 {press > 0 && <span>({press.toFixed(0)}s…)</span>}</span>
        {press > 0 && <div className="h-1 rounded-full bg-black/10 dark:bg-white/10 mt-1 overflow-hidden"><div className="h-full zivv-gradient" style={{ width: `${(press / 60) * 100}%` }} /></div>}
      </div>
    </div>
  );
}
