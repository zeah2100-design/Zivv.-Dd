import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useZivv } from '../lib/store';
import { useLang } from '../lib/i18n';
import { Avatar } from '../components/ui';
import { SunIcon, MoonIcon, LanguagesIcon, UserIcon, LogOutIcon, ShieldIcon, BellIcon, CheckIcon } from '../components/icons';

function Row({ Icon, label, right, onClick, danger }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 p-4 text-start ${danger ? 'text-red-500' : ''}`}>
      <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-500/10' : 'bg-black/5 dark:bg-white/10'}`}>
        <Icon size={20} />
      </span>
      <span className="flex-1 font-bold">{label}</span>
      {right}
    </button>
  );
}

export default function Settings() {
  const { user, setUser, theme, setTheme, logout } = useZivv();
  const { t, lang, setLang } = useLang();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const nav = useNavigate();
  const pressT = useRef(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const r = await api.patch('/users/me', { name, bio });
      if (r.data?.user) setUser(r.data.user);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="p-3 md:p-4 max-w-2xl mx-auto space-y-3">
      <h1 className="font-bold text-xl px-1">{t('settings.title')}</h1>

      <div className="card p-4 flex items-center gap-3">
        <Avatar user={user} size={60} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg truncate">{user?.name}</div>
          <div className="text-sm opacity-50">@{user?.username}</div>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="font-bold flex items-center gap-2"><UserIcon size={18} />{t('settings.editProfile')}</div>
        <div>
          <label className="text-xs font-bold opacity-60">{t('settings.name')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" />
        </div>
        <div>
          <label className="text-xs font-bold opacity-60">{t('settings.bio')}</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="input mt-1 resize-none" />
        </div>
        <button onClick={save} disabled={saving} className="btn-primary w-full disabled:opacity-40 flex items-center justify-center gap-2">
          {saved ? <><CheckIcon size={17} />{t('settings.saved')}</> : t('settings.save')}
        </button>
      </div>

      <div className="card divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
        <Row Icon={theme === 'dark' ? SunIcon : MoonIcon} label={theme === 'dark' ? t('settings.light') : t('settings.dark')}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          />
        <Row Icon={LanguagesIcon} label={t('settings.language')}
          right={<div className="flex gap-1 bg-black/5 dark:bg-white/10 rounded-full p-1">
            {['ar', 'en'].map((l) => (
              <button key={l} onClick={(e) => { e.stopPropagation(); setLang(l); }}
                className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition ${lang === l ? 'tab-active shadow' : 'opacity-60'}`}>
                {l === 'ar' ? 'عربي' : 'EN'}
              </button>
            ))}
          </div>} />
        <Row Icon={BellIcon} label={t('settings.notif')} right={<span className="text-xs font-bold opacity-50">{t('settings.on')}</span>} />
        <Row Icon={ShieldIcon} label={t('settings.privacy')} />
        <Row Icon={LogOutIcon} label={t('settings.logout')} danger onClick={logout} />
      </div>

      <button
        onPointerDown={() => { pressT.current = setTimeout(() => { sessionStorage.setItem('zivv_king_entry', '1'); nav('/king'); }, 1200); }}
        onPointerUp={() => clearTimeout(pressT.current)} onPointerLeave={() => clearTimeout(pressT.current)}
        className="w-full text-center text-xs opacity-40 pb-4 select-none">ZIVV v1.0 · {t('settings.made')}</button>
    </div>
  );
}
