import { useState } from 'react';
import api from '../lib/api';

export default function PrivateChat() {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState('');
  const [mode, setMode] = useState('unlock'); // unlock | setup
  const [err, setErr] = useState('');

  const setup = async () => {
    setErr('');
    try { await api.post('/chat/vault/setup', { password: pw }); setMode('unlock'); setPw(''); setErr('Vault created — enter your password to unlock.'); }
    catch { setErr('Password must be 6+ characters.'); }
  };
  const unlock = async () => {
    setErr('');
    try { await api.post('/chat/vault/unlock', { password: pw }); setUnlocked(true); }
    catch (e) { setErr(e.response?.data?.error === 'no_vault' ? 'No vault yet — create one first.' : 'Wrong password. Attempts are rate-limited.'); }
  };

  if (unlocked) {
    return (
      <div className="px-3 md:px-0 pt-3 space-y-2">
        <div className="flex justify-between items-center"><h1 className="text-2xl font-black">🔒 Private Chat</h1><button onClick={() => setUnlocked(false)} className="btn-ghost text-sm">Lock now</button></div>
        <div className="card p-8 text-center"><div className="text-5xl">🛡️</div><div className="font-bold mt-2">Vault unlocked</div><div className="text-xs opacity-60 mt-1">Auto-locks when you leave • Notifications never show content • E2EE-ready</div></div>
      </div>
    );
  }

  return (
    <div className="px-3 md:px-0 pt-10 max-w-sm mx-auto text-center space-y-4">
      <div className="text-7xl">🔒</div>
      <h1 className="text-2xl font-black">Private Chat</h1>
      <p className="text-sm opacity-60">Protected by your vault password. Never stored in plain text. Rate-limited with lockouts.</p>
      <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="Vault password" className="input text-center" onKeyDown={(e) => e.key === 'Enter' && (mode === 'setup' ? setup() : unlock())} />
      {mode === 'setup'
        ? <button onClick={setup} className="btn-primary w-full">Create vault</button>
        : <button onClick={unlock} className="btn-primary w-full">Unlock</button>}
      <button onClick={() => setMode(mode === 'setup' ? 'unlock' : 'setup')} className="text-sm text-zivv-purple font-bold">{mode === 'setup' ? 'Have a vault? Unlock' : 'First time? Create vault'}</button>
      {err && <div className="text-sm font-semibold text-zivv-pink">{err}</div>}
    </div>
  );
}
