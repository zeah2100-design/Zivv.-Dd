import { useState } from 'react';
import api from '../lib/api';
import { VaultIcon, LockIcon, ShieldIcon, EyeOffIcon, TimerIcon, FingerprintIcon } from '../components/icons';

export default function PrivateChat() {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState('');
  const [mode, setMode] = useState('unlock');
  const [err, setErr] = useState('');

  const setup = async () => {
    setErr('');
    try { await api.post('/chat/vault/setup', { password: pw }); setMode('unlock'); setPw(''); setErr('Vault created — enter your password to unlock.'); }
    catch { setErr('Password must be 6+ characters.'); }
  };
  const unlock = async () => {
    setErr('');
    try { await api.post('/chat/vault/unlock', { password: pw }); setUnlocked(true); setPw(''); }
    catch (e) { setErr(e.response?.data?.error === 'no_vault' ? 'No vault yet — create one first.' : 'Wrong password. Attempts are rate-limited.'); }
  };

  if (unlocked) {
    return (
      <div className="px-3 md:px-0 pt-3 space-y-3">
        <div className="flex justify-between items-center px-1">
          <h1 className="text-2xl font-black flex items-center gap-2"><VaultIcon size={24} />Private Chat</h1>
          <button onClick={() => setUnlocked(false)} className="btn-ghost text-sm flex items-center gap-1.5"><LockIcon size={15} />Lock now</button>
        </div>
        <div className="card p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-3xl zivv-gradient flex items-center justify-center text-white"><ShieldIcon size={30} /></div>
          <div className="font-black text-lg mt-3">Vault unlocked</div>
          <div className="text-sm opacity-60 mt-1">Your private space is open</div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            {[['Auto-lock', TimerIcon], ['Hidden previews', EyeOffIcon], ['E2EE-ready', ShieldIcon]].map(([l, Icon]) => (
              <div key={l} className="p-3 rounded-2xl bg-black/5 dark:bg-white/10"><Icon size={20} className="mx-auto text-zivv-purple" /><div className="text-[11px] font-bold mt-1">{l}</div></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pt-12 max-w-sm mx-auto text-center space-y-4">
      <div className="w-20 h-20 mx-auto rounded-[1.75rem] zivv-gradient flex items-center justify-center text-white shadow-pop"><VaultIcon size={38} /></div>
      <h1 className="text-2xl font-black">Private Chat</h1>
      <p className="text-sm opacity-60">Protected by your vault password. Never stored in plain text. Rate-limited with lockouts.</p>
      <div className="card p-4 space-y-3">
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50"><LockIcon size={17} /></span>
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="Vault password" className="input !pl-10 text-center" onKeyDown={(e) => e.key === 'Enter' && (mode === 'setup' ? setup() : unlock())} />
        </div>
        {mode === 'setup'
          ? <button onClick={setup} className="btn-primary w-full flex items-center justify-center gap-2"><VaultIcon size={17} />Create vault</button>
          : <button onClick={unlock} className="btn-primary w-full flex items-center justify-center gap-2"><FingerprintIcon size={17} />Unlock</button>}
        <button onClick={() => setMode(mode === 'setup' ? 'unlock' : 'setup')} className="text-sm text-zivv-purple font-bold">{mode === 'setup' ? 'Have a vault? Unlock' : 'First time? Create vault'}</button>
        {err && <div className="text-sm font-semibold text-zivv-pink">{err}</div>}
      </div>
    </div>
  );
}
