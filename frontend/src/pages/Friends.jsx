import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Avatar } from '../components/ui';
import { UsersIcon, UserPlusIcon, CheckIcon, XIcon, ClockIcon } from '../components/icons';

export default function Friends() {
  const [data, setData] = useState({ incoming: [], outgoing: [], suggested: [] });
  const [sent, setSent] = useState(new Set());
  useEffect(() => { api.get('/friends/requests').then((r) => setData(r.data)); }, []);

  const act = async (id, action) => {
    await api.post(`/friends/requests/${id}/${action}`);
    setData({ ...data, incoming: data.incoming.filter((f) => f.id !== id) });
  };
  const add = async (u) => { await api.post('/friends/requests', { toId: u.id }); setSent(new Set([...sent, u.id])); };

  return (
    <div className="px-3 md:px-0 pt-3 space-y-4">
      <h1 className="text-2xl font-black px-1 flex items-center gap-2"><UsersIcon size={24} />Friends</h1>
      <section>
        <h2 className="font-black mb-2 px-1">Requests <span className="text-sm font-bold opacity-50">({data.incoming.length})</span></h2>
        {data.incoming.map((f) => (
          <div key={f.id} className="card p-3 flex gap-3 items-center mb-2">
            <Avatar user={f.user} size={54} />
            <div className="flex-1 min-w-0"><div className="font-bold text-[15px] truncate">{f.user?.name}</div><div className="text-xs opacity-60">@{f.user?.username} · {f.mutual} mutual friends</div></div>
            <button onClick={() => act(f.id, 'confirm')} className="btn-primary !px-4 !py-2 text-sm flex items-center gap-1.5"><CheckIcon size={15} />Confirm</button>
            <button onClick={() => act(f.id, 'delete')} className="btn-ghost !px-3 !py-2 text-sm" aria-label="Delete"><XIcon size={17} /></button>
          </div>
        ))}
        {!data.incoming.length && <div className="card p-6 text-center text-sm opacity-50">No pending requests</div>}
      </section>
      {!!data.outgoing.length && (
        <section>
          <h2 className="font-black mb-2 px-1 flex items-center gap-2"><ClockIcon size={17} />Sent</h2>
          {data.outgoing.map((f) => (
            <div key={f.id} className="card p-3 flex gap-3 items-center mb-2">
              <Avatar user={f.user} size={46} />
              <div className="flex-1 font-bold text-sm">{f.user?.name}</div>
              <button onClick={() => act(f.id, 'cancel')} className="btn-ghost text-sm">Cancel</button>
            </div>
          ))}
        </section>
      )}
      <section>
        <h2 className="font-black mb-2 px-1">Suggested for you</h2>
        {data.suggested.map((u) => (
          <div key={u.id} className="card p-3 flex gap-3 items-center mb-2">
            <Avatar user={u} size={50} />
            <div className="flex-1 min-w-0"><div className="font-bold text-[15px] truncate">{u.name}</div><div className="text-xs opacity-60 truncate">{u.mutual} mutual · {u.bio}</div></div>
            {sent.has(u.id)
              ? <span className="text-xs font-bold opacity-50 flex items-center gap-1"><CheckIcon size={13} />Sent</span>
              : <button onClick={() => add(u)} className="btn-ghost text-sm flex items-center gap-1.5"><UserPlusIcon size={16} />Add</button>}
          </div>
        ))}
      </section>
    </div>
  );
}
