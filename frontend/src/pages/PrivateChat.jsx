import { useState } from 'react';
import api from '../lib/api';
import { useLang } from '../lib/i18n';
import { VaultIcon, LockIcon, EyeIcon, EyeOffIcon, CheckIcon, ShieldIcon } from '../components/icons';

export default function PrivateChat() {
  const { t } = useLang();
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [hasVault, setHasVault] = useState(null);

  const setup = async () => {
    if (pass.length < 6 || busy) return;
    setBusy(true); setErr('');
    try { await api.post('/chat/vault/setup', { password: pass }); setHasVault(true); setPass(''); }
    catch { setErr(t('private.err')); } finally { setBusy(false); }
  };

  const unlock = async () => {
    if (!pass || busy) return;
    setBusy(true); setErr('');
    try {
      await api.post('/chat/vault/unlock', { password: pass });
      setUnlocked(true); setPass('');
    } catch (e) {
      if (e.response?.status === 404) setHasVault(false);
      else if (e.response?.status === 429) setErr(t('private.lockedOut'));
      else setErr(t('private.badPass'));
    } finally { setBusy(false); }
  };

  if (unlocked) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="card p-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/15 text-green-500 flex items-center justify-center mb-3"><CheckIcon size={30} /></div>
          <div className="font-bold text-xl">{t('private.open')}</div>
          <div className="text-sm opacity-60 mt-1">{t('private.openSub')}</div>
          <button onClick={() => setUnlocked(false)} className="btn-ghost mt-4 text-sm font-bold">{t('private.lockAgain')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="card p-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-black flex items-center justify-center mb-3"><VaultIcon size={30} /></div>
        <div className="font-bold text-xl">{t('private.title')}</div>
        <div className="text-sm opacity-60 mt-1 mb-5">{t('private.sub')}</div>

        <div className="flex items-center gap-2 bg-black/5 dark:bg-white/10 rounded-2xl px-4 py-1">
          <LockIcon size={18} className="opacity-50 shrink-0" />
          <input type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (hasVault === false ? setup() : unlock())}
            placeholder={t('private.passPh')} className="bg-transparent flex-1 py-2.5 text-[15px] focus:outline-none placeholder:opacity-40" />
          <button onClick={() => setShow(!show)} className="opacity-50" aria-label="Toggle">{show ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}</button>
        </div>
        {!!err && <div className="text-red-500 text-sm font-bold mt-2">{err}</div>}

        {hasVault === false ? (
          <button onClick={setup} disabled={pass.length < 6 || busy} className="btn-primary w-full mt-4 disabled:opacity-40">{t('private.create')}</button>
        ) : (
          <button onClick={unlock} disabled={!pass || busy} className="btn-primary w-full mt-4 disabled:opacity-40">{t('private.unlock')}</button>
        )}
        {hasVault === null && (
          <button onClick={() => setHasVault(false)} className="text-xs font-bold text-zivv-purple mt-3">{t('private.firstTime')}</button>
        )}

        <div className="flex items-center justify-center gap-1.5 text-[11px] opacity-50 mt-4">
          <ShieldIcon size={13} />{t('private.secure')}
        </div>
      </div>
    </div>
  );
}
