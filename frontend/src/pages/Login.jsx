import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/ui';
import { useZivv } from '../lib/store';
import { useLang } from '../lib/i18n';
import { UserIcon, LockIcon, LogInIcon, SparklesIcon, MailIcon, AtIcon, CalendarIcon, UserPlusIcon } from '../components/icons';

function Field({ Icon, ...props }) {
  return (
    <div className="relative">
      <span className="absolute start-3.5 top-1/2 -translate-y-1/2 opacity-50"><Icon size={17} /></span>
      <input {...props} className="input !ps-10" />
    </div>
  );
}

const errKey = (code) => ({
  bad_credentials: 'auth.e_bad', missing_fields: 'auth.e_missing', username_taken: 'auth.e_taken',
  email_taken: 'auth.e_email_taken', bad_email: 'auth.e_email', bad_age: 'auth.e_age',
  weak_password: 'auth.e_weak', password_mismatch: 'auth.e_mismatch', bad_handle: 'auth.e_handle',
  banned: 'auth.e_banned',
}[code] || 'auth.e_unknown');

export default function Login() {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ firstName: '', lastName: '', age: '', email: '', password: '', confirm: '', username: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { login, register } = useZivv();
  const { t, lang, setLang } = useLang();
  const nav = useNavigate();

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const go = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try {
      if (mode === 'login') {
        await login({ firstName: f.firstName, lastName: f.lastName, username: f.username, password: f.password });
      } else {
        await register(f);
      }
      nav('/');
    } catch (e) {
      setErr(t(errKey(e.response?.data?.error)));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-full flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-zivv-purple opacity-[.07] pointer-events-none" />
      <div className="absolute top-4 end-4 flex gap-1 bg-black/5 dark:bg-white/10 rounded-full p-1">
        {['ar', 'en'].map((l) => (
          <button key={l} onClick={() => setLang(l)}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition ${lang === l ? 'tab-active shadow-sm' : 'opacity-60'}`}>
            {l === 'ar' ? 'عربي' : 'EN'}
          </button>
        ))}
      </div>
      <div className="card p-6 sm:p-8 w-full max-w-sm text-center space-y-3.5 relative my-6">
        <div className="flex justify-center"><Logo size={56} /></div>
        <p className="text-sm opacity-60 flex items-center justify-center gap-1.5">
          <SparklesIcon size={14} className="text-zivv-purple" />{t('auth.tagline')}
        </p>
        <div className="flex gap-1 bg-black/5 dark:bg-white/10 rounded-full p-1">
          {[['login', t('auth.loginTab')], ['register', t('auth.regTab')]].map(([v, l]) => (
            <button key={v} onClick={() => { setMode(v); setErr(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-full transition ${mode === v ? 'tab-active shadow-sm' : 'opacity-60'}`}>{l}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Field Icon={UserIcon} value={f.firstName} onChange={set('firstName')} placeholder={t('auth.firstName')} />
          <Field Icon={UserIcon} value={f.lastName} onChange={set('lastName')} placeholder={t('auth.lastName')} />
        </div>
        <Field Icon={AtIcon} value={f.username} onChange={set('username')} placeholder={t('auth.handlePh')} autoCapitalize="none" />
        {mode === 'register' && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Field Icon={MailIcon} value={f.email} onChange={set('email')} placeholder={t('auth.emailPh')} type="email" autoCapitalize="none" />
              <Field Icon={CalendarIcon} value={f.age} onChange={set('age')} placeholder={t('auth.agePh')} inputMode="numeric" />
            </div>
            <div className="text-[11px] opacity-50 text-start px-1">{t('auth.handleHint')}</div>
          </>
        )}
        <Field Icon={LockIcon} value={f.password} onChange={set('password')} type="password" placeholder={t('auth.passPh')} onKeyDown={(e) => e.key === 'Enter' && mode === 'login' && go()} />
        {mode === 'register' && (
          <Field Icon={LockIcon} value={f.confirm} onChange={set('confirm')} type="password" placeholder={t('auth.confirmPh')} onKeyDown={(e) => e.key === 'Enter' && go()} />
        )}
        {!!err && <div className="text-red-500 text-sm font-bold">{err}</div>}
        <button onClick={go} disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
          {mode === 'login' ? <LogInIcon size={18} /> : <UserPlusIcon size={18} />}
          {busy ? '…' : mode === 'login' ? t('auth.login') : t('auth.create')}
        </button>
      </div>
    </div>
  );
}
