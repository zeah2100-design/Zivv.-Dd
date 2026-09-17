import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/ui';
import { useZivv } from '../lib/store';
import { useLang } from '../lib/i18n';
import { UserIcon, LockIcon, LogInIcon, SparklesIcon } from '../components/icons';

export default function Login() {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useZivv();
  const { t, lang, setLang } = useLang();
  const nav = useNavigate();

  const go = async (demo) => {
    if (busy) return;
    setBusy(true);
    try { await login(demo ? 'you' : (u || 'you'), demo ? '' : (p || 'demo')); } catch {}
    nav('/');
  };

  return (
    <div className="min-h-full flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-zivv-purple opacity-[.07] pointer-events-none" />
      <div className="absolute top-4 end-4 flex gap-1 bg-black/5 dark:bg-white/10 rounded-full p-1">
        {['ar', 'en'].map((l) => (
          <button key={l} onClick={() => setLang(l)}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition ${lang === l ? 'tab-active shadow' : 'opacity-60'}`}>
            {l === 'ar' ? 'عربي' : 'EN'}
          </button>
        ))}
      </div>
      <div className="card p-8 w-full max-w-sm text-center space-y-4 relative">
        <div className="flex justify-center"><Logo size={60} /></div>
        <p className="text-sm opacity-60 flex items-center justify-center gap-1.5">
          <SparklesIcon size={14} className="text-zivv-purple" />{t('auth.tagline')}
        </p>
        <div className="relative">
          <span className="absolute start-3.5 top-1/2 -translate-y-1/2 opacity-50"><UserIcon size={17} /></span>
          <input value={u} onChange={(e) => setU(e.target.value)} placeholder={t('auth.userPh')} className="input !ps-10" />
        </div>
        <div className="relative">
          <span className="absolute start-3.5 top-1/2 -translate-y-1/2 opacity-50"><LockIcon size={17} /></span>
          <input value={p} onChange={(e) => setP(e.target.value)} type="password" placeholder={t('auth.passPh')} className="input !ps-10" onKeyDown={(e) => e.key === 'Enter' && go(false)} />
        </div>
        <button onClick={() => go(false)} disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
          <LogInIcon size={18} />{t('auth.login')}
        </button>
        <button onClick={() => go(true)} disabled={busy} className="btn-ghost w-full font-bold disabled:opacity-50">{t('auth.demo')}</button>
        <div className="text-xs opacity-50">{t('auth.hint')}</div>
      </div>
    </div>
  );
}
