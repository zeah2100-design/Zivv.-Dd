import { useEffect, useState } from 'react';
import api, { fmt } from '../lib/api';
import { CrownIcon, CheckCircleIcon, SparklesIcon, ShieldIcon } from '../components/icons';

export default function Gold() {
  const [pkgs, setPkgs] = useState([]);
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/gold/packages').then((r) => setPkgs(r.data.items)); api.get('/gold/status').then((r) => setStatus(r.data)); }, []);

  const request = async (id) => {
    await api.post('/gold/request', { packageId: id });
    setMsg('Request sent! Admin reviews → then you get payment instructions in-app. Gold activates after verified payment.');
    const { data } = await api.get('/gold/status'); setStatus(data);
  };

  return (
    <div className="px-3 md:px-0 pt-3 space-y-3 pb-6">
      <div className="rounded-3xl p-6 text-center bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-amber-950 shadow-pop">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-950/15 flex items-center justify-center"><CrownIcon size={34} /></div>
        <h1 className="text-3xl font-black mt-2">ZIVV Gold</h1>
        <p className="text-sm font-semibold opacity-80 mt-1">Premium profile · Priority AI · Exclusive themes · Priority support</p>
        {status?.gold && <div className="mt-2 inline-flex items-center gap-1.5 font-black bg-amber-950 text-amber-300 px-4 py-1.5 rounded-full text-sm"><SparklesIcon size={15} />You are GOLD</div>}
      </div>
      {pkgs.map((p) => (
        <div key={p.id} className="card p-5">
          <div className="flex justify-between items-center gap-2"><div className="font-black text-lg">{p.name}</div><div className="font-black text-xl zivv-gradient-text whitespace-nowrap">{fmt.money(p.priceCents)}<span className="text-xs opacity-60 font-bold"> / {p.durationDays}d</span></div></div>
          <ul className="mt-3 space-y-2">{p.perks?.map((perk) => <li key={perk} className="text-sm flex items-center gap-2"><CheckCircleIcon size={17} className="text-green-500 shrink-0" />{perk}</li>)}</ul>
          <button onClick={() => request(p.id)} className="btn-primary w-full mt-4 flex items-center justify-center gap-2"><CrownIcon size={17} />Request {p.name}</button>
        </div>
      ))}
      {msg && <div className="card p-4 text-sm font-semibold flex gap-2"><CheckCircleIcon size={18} className="text-green-500 shrink-0 mt-0.5" />{msg}</div>}
      <div className="text-[11px] opacity-50 text-center px-4 flex items-start justify-center gap-1.5"><ShieldIcon size={13} className="shrink-0 mt-0.5" /><span>Gold members follow all safety, moderation & community rules. Payments verified via provider — never send money outside official instructions.</span></div>
    </div>
  );
}
