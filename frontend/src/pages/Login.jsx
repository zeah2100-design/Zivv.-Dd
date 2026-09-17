import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Logo } from '../components/ui';
import { useZivv } from '../lib/store';
import { UserIcon, LockIcon, LogInIcon, SparklesIcon } from '../components/icons';

export default function Login() {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const { login } = useZivv();
  const nav = useNavigate();

  const go = async () => { try { await login(u || 'you', p || 'demo'); nav('/'); } catch { nav('/'); } };

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="card p-8 w-full max-w-sm text-center space-y-4">
        <div className="flex justify-center"><Logo size={60} /></div>
        <p className="text-sm opacity-60 flex items-center justify-center gap-1.5"><SparklesIcon size={14} className="text-zivv-purple" />The AI-native social network</p>
        <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50"><UserIcon size={17} /></span><input value={u} onChange={(e) => setU(e.target.value)} placeholder="Username" className="input !pl-10" /></div>
        <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50"><LockIcon size={17} /></span><input value={p} onChange={(e) => setP(e.target.value)} type="password" placeholder="Password" className="input !pl-10" onKeyDown={(e) => e.key === 'Enter' && go()} /></div>
        <button onClick={go} className="btn-primary w-full flex items-center justify-center gap-2"><LogInIcon size={18} />Log in</button>
        <div className="text-sm opacity-70">New to ZIVV? <Link to="/" className="text-zivv-purple font-bold">Create account</Link></div>
      </div>
    </div>
  );
}
