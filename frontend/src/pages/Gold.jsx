import { useEffect, useState } from 'react';
import api, { fmt } from '../lib/api';

export default function Gold() {
  const [pkgs, setPkgs] = useState([]);
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/gold/packages').then((r) => setPkgs(r.data.items)); api.get('/gold/status').then((r) => setStatus(r.data)); }, []);

  const request = async (id) => {
    await api.post('/gold/request', { packageId: id });
    setMsg('Request sent! Admin reviews → then you get payment instructions in-app. Gold activates after verified payment. 🥇');
    const { data } = await api.get('/gold/status'); setStatus(data);
  };

  return (
    <div className="px-3 md:px-0 pt-3 space-y-3">
      <div className="rounded-3xl p-6 text-center bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-amber-950 shadow-pop">
        <div className="text-5xl">🥇</div>
        <h1 className="text-3xl font-black mt-1">ZIVV Gold</h1>
        <p className="text-sm font-semibold opacity-80">Premium profile • Priority AI • Exclusive themes • Priority support</p>
        {status?.gold && <div className="mt-2 font-black">✨ You are GOLD ✨</div>}
      </div>
      {pkgs.map((p) => (
        <div key={p.id} className="card p-5">
          <div className="flex justify-between items-center"><div className="font-black text-lg">{p.name}</div><div className="font-black text-xl zivv-gradient-text">{fmt.money(p.priceCents)}<span className="text-xs opacity-60"> / {p.durationDays}d</span></div></div>
          <ul className="mt-2 space-y-1">{p.perks?.map((perk) => <li key={perk} className="text-sm">✅ {perk}</li>)}</ul>
          <button onClick={() => request(p.id)} className="btn-primary w-full mt-3">Request {p.name}</button>
        </div>
      ))}
      {msg && <div className="card p-4 text-sm font-semibold text-center">{msg}</div>}
      <div className="text-[11px] opacity-50 text-center px-4">Gold users follow all safety, moderation & community rules. Payments verified via provider — never send money outside official instructions.</div>
    </div>
  );
}
