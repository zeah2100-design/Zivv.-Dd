import { useMemo, useState } from 'react';
import api from '../lib/api';
import { useLang } from '../lib/i18n';
import { ConversationList, Thread } from './Chat';
import { VaultIcon, LockIcon, EyeIcon, EyeOffIcon, ShieldIcon } from '../components/icons';

export default function PrivateChat() {
  const { t } = useLang();
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [hasVault, setHasVault] = useState(null);
  const [vault, setVault] = useState('');
  const [active, setActive] = useState(null);
  const [uname, setUname] = useState('');
  const [starting, setStarting] = useState(false);
  const [startErr, setStartErr] = useState('');

  const vh = useMemo(() => ({ 'X-Vault-Token': vault }), [vault]);

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
      const r = await api.post('/chat/vault/unlock', { password: pass });
      setVault(r.data.vaultToken || '');
      setUnlocked(true); setPass(''); setActive(null);
    } catch (e) {
      if (e.response?.status === 404) setHasVault(false);
      else if (e.response?.status === 429) setErr(t('private.lockedOut'));
      else setErr(t('private.badPass'));
    } finally { setBusy(false); }
  };

  const lock = () => {
    setVault(''); setUnlocked(false); setActive(null); setPass(''); setErr(''); setUname(''); setStartErr('');
  };
  const expired = () => {
    lock();
    setErr(t('private.lockExpired'));
  };

  const start = async () => {
    const name = uname.trim().replace(/^@/, '');
    if (!name || starting) return;
    setStarting(true); setStartErr('');
    try {
      const u = await api.get(`/users/${encodeURIComponent(name)}`);
      const r = await api.post('/chat/private/conversations', { userId: u.data.user.id }, { headers: vh });
      setActive(r.data); setUname('');
    } catch (e) {
      if (e.response?.status === 403) { expired(); return; }
      setStartErr(t(e.response?.status === 404 ? 'private.badUser' : 'private.err'));
    } finally { setStarting(false); }
  };

  if (unlocked) {
    return (
      <div className="h-[calc(100dvh-108px)] md:h-[calc(100vh-32px)] flex flex-col max-w-4xl mx-auto">
        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
          <VaultIcon size={20} />
          <div className="font-bold text-lg flex-1">{t('private.title')}</div>
          <button onClick={lock} className="btn-ghost !py-1.5 text-xs font-bold">{t('private.lockAgain')}</button>
        </div>
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 bg-black/5 dark:bg-white/10 rounded-full ps-4 pe-1.5 py-1.5">
            <span className="text-xs font-bold opacity-50 shrink-0">{t('private.newChat')}</span>
            <input value={uname} onChange={(e) => setUname(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && start()}
              placeholder={t('private.userPh')} className="bg-transparent flex-1 text-sm focus:outline-none placeholder:opacity-40 min-w-0" dir="ltr" autoCapitalize="none" />
            <button onClick={start} disabled={!uname.trim() || starting} className="text-sm font-bold text-zivv-purple disabled:opacity-40 px-2 shrink-0">{t('private.start')}</button>
          </div>
          {!!startErr && <div className="text-red-500 text-xs font-bold px-2 mt-1">{startErr}</div>}
        </div>
        <div className="flex-1 min-h-0 flex">
          <div className={`${active ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[320px] md:border-e md:border-black/10 md:dark:border-white/10`}>
            <div className="flex-1 min-h-0">
              <ConversationList base="/chat/private/conversations" headers={vh} onAuthFail={expired}
                onPick={(c) => setActive(c)} activeId={active?.id} />
            </div>
          </div>
          <div className={`${active ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-w-0`}>
            {active
              ? <Thread convId={active.id} peer={active.peer} online={active.online} base="/chat/private/conversations" headers={vh}
                  onAuthFail={expired} onBack={() => setActive(null)} />
              : <div className="flex-1 hidden md:flex flex-col items-center justify-center opacity-40 gap-3">
                  <VaultIcon size={44} />
                  <div className="font-bold text-sm">{t('chat.pick')}</div>
                </div>}
          </div>
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
