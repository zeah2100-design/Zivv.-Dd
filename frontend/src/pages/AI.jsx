import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Logo, AiBadge } from '../components/ui';

export default function AI() {
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [text, setText] = useState('');
  const [plan, setPlan] = useState(null);
  const [imgPrompt, setImgPrompt] = useState('');
  const [live, setLive] = useState(false);

  useEffect(() => { api.get('/ai/chats').then((r) => { setChats(r.data.items); setActive(r.data.items[0]); }); }, []);

  const send = async () => {
    if (!text.trim() || !active) return;
    const t = text; setText('');
    setActive({ ...active, messages: [...active.messages, { role: 'user', text: t }, { role: 'assistant', text: '✦ thinking…' }] });
    const { data } = await api.post(`/ai/chats/${active.id}/messages`, { text: t });
    const { data: list } = await api.get('/ai/chats');
    setChats(list.items); setActive(list.items.find((c) => c.id === active.id));
  };

  const newChat = async () => { const { data } = await api.post('/ai/chats'); setChats([data, ...chats]); setActive(data); };

  const agentPlan = async () => {
    if (!text.trim()) return;
    const { data } = await api.post('/ai/agent/plan', { instruction: text });
    setPlan(data);
  };
  const agentExec = async (confirmed) => {
    const { data } = await api.post('/ai/agent/execute', { tool: plan.tool, input: {}, confirmed });
    setPlan(null); setText('');
    alert(`Agent ${plan.tool} done ✓ (${data.risk})`);
  };

  return (
    <div className="md:flex gap-4 pt-3 px-3 md:px-0">
      {/* history */}
      <aside className="hidden md:block w-56 shrink-0 space-y-2">
        <button onClick={newChat} className="btn-primary w-full text-sm">＋ New chat</button>
        {chats.map((c) => <button key={c.id} onClick={() => setActive(c)} className={`w-full text-left text-sm font-semibold p-2.5 rounded-2xl truncate ${active?.id === c.id ? 'bg-black/5 dark:bg-white/10' : ''}`}>💬 {c.title}</button>)}
      </aside>

      <div className="flex-1 card p-4 min-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Logo size={30} wordmark={false} /><span className="font-black text-lg">ZIVV AI</span><AiBadge /></div>
          <div className="flex gap-2">
            <button onClick={() => setLive(!live)} className={`btn-ghost text-sm ${live ? '!bg-red-500/20' : ''}`}>{live ? '🔴 End live' : '🎙️ Live voice'}</button>
            <button onClick={newChat} className="btn-ghost text-sm md:hidden">＋</button>
          </div>
        </div>

        {live && (
          <div className="mt-3 rounded-2xl zivv-gradient p-6 text-white text-center">
            <div className="text-5xl animate-pulse">🎙️</div>
            <div className="font-black mt-2">Live conversation</div>
            <div className="text-sm opacity-90">Speak anytime — interruption supported • transcripts on</div>
            <div className="flex justify-center gap-2 mt-3"><button className="bg-white/20 rounded-full px-4 py-1.5 text-sm font-bold">Mute</button><button onClick={() => setLive(false)} className="bg-white text-black rounded-full px-4 py-1.5 text-sm font-bold">End</button></div>
          </div>
        )}

        <div className="flex-1 space-y-3 mt-4 overflow-y-auto max-h-[50vh]">
          {(active?.messages || []).map((m, i) => (
            <div key={i} className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${m.role === 'user' ? 'ml-auto zivv-gradient text-white' : 'bg-black/5 dark:bg-white/10'}`}>{m.text}</div>
          ))}
          {!active?.messages?.length && <div className="text-center opacity-50 text-sm mt-10">Ask anything — AR, Egyptian Arabic, EN 🌍<br />Try: “Create a Reel about football” then use Agent ✦</div>}
        </div>

        {plan && (
          <div className="mt-3 rounded-2xl border-2 border-zivv-purple/50 p-4">
            <div className="font-black text-sm">🤖 Agent preview <span className={`text-xs px-2 py-0.5 rounded-full ${plan.risk === 'HIGH' ? 'bg-red-500/20 text-red-500' : plan.risk === 'MEDIUM' ? 'bg-amber-500/20 text-amber-600' : 'bg-green-500/20 text-green-600'}`}>{plan.risk}</span></div>
            <div className="text-sm mt-1">Tool: <b>{plan.tool}</b> — {plan.preview}</div>
            <div className="text-xs opacity-60 mt-1">Permission → validation → {plan.needsConfirmation ? 'confirmation required' : 'auto-approved (low risk)'} → execution → audit</div>
            <div className="flex gap-2 mt-2"><button onClick={() => agentExec(true)} className="btn-primary text-sm">Confirm & Execute</button><button onClick={() => setPlan(null)} className="btn-ghost text-sm">Cancel</button></div>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <input value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} placeholder="🖼️ Generate image…" className="input text-sm" />
          <button onClick={async () => { if (!imgPrompt.trim()) return; await api.post('/ai/image', { prompt: imgPrompt }); setImgPrompt(''); alert('✦ Image queued — labeled AI-generated when ready.'); }} className="btn-ghost text-sm whitespace-nowrap">Generate</button>
        </div>
        <div className="flex gap-2 mt-2">
          <button className="btn-ghost">📎</button>
          <button className="btn-ghost">🎙️</button>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Message ZIVV AI… (يدعم العربية ✦)" className="input" />
          <button onClick={agentPlan} className="btn-ghost whitespace-nowrap text-sm" title="Run as agent action">🤖 Agent</button>
          <button onClick={send} className="btn-primary">➤</button>
        </div>
      </div>
    </div>
  );
}
