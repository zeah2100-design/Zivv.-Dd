import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Logo } from '../components/ui';
import { useZivv } from '../lib/store';

export default function Login() {
  const [u, setU] = useState('you');
  const [p, setP] = useState('demo');
  const { login } = useZivv();
  const nav = useNavigate();

  const go = async () => { try { await login(u, p); nav('/'); } catch { nav('/'); } };

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="card p-8 w-full max-w-sm text-center space-y-4">
        <div className="flex justify-center"><Logo size={56} /></div>
        <p className="text-sm opacity-60">The AI-native professional social network ✦</p>
        <input value={u} onChange={(e) => setU(e.target.value)} placeholder="Username" className="input text-center" />
        <input value={p} onChange={(e) => setP(e.target.value)} type="password" placeholder="Password" className="input text-center" onKeyDown={(e) => e.key === 'Enter' && go()} />
        <button onClick={go} className="btn-primary w-full">Log in</button>
        <div className="text-sm">New here? <Link to="/" className="text-zivv-purple font-bold">Create account</Link></div>
      </div>
    </div>
  );
}
