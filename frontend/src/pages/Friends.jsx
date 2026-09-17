import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Avatar } from '../components/ui';

export default function Friends() {
  const [data, setData] = useState({ incoming: [], outgoing: [], suggested: [] });
  useEffect(() => { api.get('/friends/requests').then((r) => setData(r.data)); }, []);

  const act = async (id, action) => {
    await api.post(`/friends/requests/${id}/${action}`);
    setData({ ...data, incoming: data.incoming.filter((f) => f.id !== id) });
  };

  return (
    <div className="px-3 md:px-0 pt-3 space-y-4">
      <h1 className="text-2xl font-black px-1">Friends 👥</h1>
      <section>
        <h2 className="font-black mb-2">Incoming requests ({data.incoming.length})</h2>
        {data.incoming.map((f) => (
          <div key={f.id} className="card p-3 flex gap-3 items-center mb-2">
            <Avatar user={f.user} size={52} />
            <div className="flex-1"><div className="font-bold text-sm">{f.user?.name}</div><div className="text-xs opacity-60">@{f.user?.username} • {f.mutual} mutual friends</div></div>
            <button onClick={() => act(f.id, 'confirm')} className="btn-primary !px-4 !py-1.5 text-sm">Confirm</button>
            <button onClick={() => act(f.id, 'delete')} className="btn-ghost !px-4 !py-1.5 text-sm">Delete</button>
          </div>
        ))}
        {!data.incoming.length && <div className="text-sm opacity-50">No pending requests 🎉</div>}
      </section>
      <section>
        <h2 className="font-black mb-2">Suggested for you</h2>
        {data.suggested.map((u) => (
          <div key={u.id} className="card p-3 flex gap-3 items-center mb-2">
            <Avatar user={u} size={48} />
            <div className="flex-1"><div className="font-bold text-sm">{u.name}</div><div className="text-xs opacity-60">{u.mutual} mutual • {u.bio}</div></div>
            <button onClick={() => api.post('/friends/requests', { toId: u.id })} className="btn-ghost text-sm">＋ Add</button>
          </div>
        ))}
      </section>
    </div>
  );
}
