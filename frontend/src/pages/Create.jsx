import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const sections = [
  { id: 'songs', icon: '🎧', label: 'Songs' },
  { id: 'long', icon: '🎞️', label: 'Long Videos' },
  { id: 'text', icon: '📝', label: 'Text & Images' },
  { id: 'short', icon: '⚡', label: 'Short Videos' },
  { id: 'five', icon: '🎬', label: 'Videos ≤ 5 min' },
  { id: 'store', icon: '🛍️', label: 'Marketplace' },
];

export default function Create() {
  const [sec, setSec] = useState('text');
  const [caption, setCaption] = useState('');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [msg, setMsg] = useState('');
  const nav = useNavigate();

  const publishPost = async () => {
    if (!caption.trim()) return setMsg('Write something first ✍️');
    await api.post('/feed', { text: caption, hashtags: ['zivv'] });
    setMsg('Published! 🎉'); setCaption('');
    setTimeout(() => nav('/'), 800);
  };

  const publishListing = async () => {
    if (!title.trim() || !price) return setMsg('Product name + price are required.');
    await api.post('/marketplace', { title, priceCents: Math.round(parseFloat(price) * 100), description: caption, category: 'Other' });
    setMsg('Listing published! 🛍️'); setTitle(''); setPrice(''); setCaption('');
  };

  return (
    <div className="px-3 md:px-0 pt-3 space-y-3">
      <h1 className="text-2xl font-black px-1">Create ✦</h1>
      <div className="grid grid-cols-3 gap-2">
        {sections.map((s) => (
          <button key={s.id} onClick={() => { setSec(s.id); setMsg(''); }} className={`card p-4 text-center transition ${sec === s.id ? 'ring-2 ring-zivv-purple' : ''}`}>
            <div className="text-3xl">{s.icon}</div><div className="text-xs font-bold mt-1">{s.label}</div>
          </button>
        ))}
      </div>

      <div className="card p-4 space-y-3">
        {(sec === 'store') ? (
          <>
            <div className="text-xs bg-amber-500/15 border border-amber-500/30 rounded-2xl p-3">⚠️ ZIVV Marketplace is <b>listing + communication only</b>. ZIVV does not sell, collect payment, ship, or guarantee the product. Buyer contacts seller directly.</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product name *" className="input" />
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Description, condition, location…" rows={3} className="input" />
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (EGP) *" type="number" className="input" />
            <div className="flex gap-2"><button className="btn-ghost flex-1">📷 Add photos</button><button className="btn-ghost flex-1">🎬 Add video</button></div>
            <button onClick={publishListing} className="btn-primary w-full">Publish listing</button>
          </>
        ) : (
          <>
            {(sec === 'long' || sec === 'five' || sec === 'short' || sec === 'songs') && (
              <div className="rounded-2xl border-2 border-dashed border-zivv-purple/40 p-8 text-center">
                <div className="text-4xl">☁️</div>
                <div className="font-bold mt-1">Upload {sec === 'songs' ? 'audio' : 'video'}</div>
                <div className="text-xs opacity-60">{sec === 'five' ? 'Max 5:00 for feed videos' : sec === 'short' ? 'Short vertical video (configurable max)' : 'Secure upload • scanned • transcoded to multiple qualities'}</div>
                <button className="btn-primary mt-3">Choose file</button>
              </div>
            )}
            {(sec === 'long' || sec === 'five') && <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="input" />}
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={sec === 'songs' ? 'Song name + description…' : 'Caption — ✦ AI can generate, translate & add subtitles…'} rows={3} className="input" />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCaption(caption + (caption ? '\n' : '') + '✦ AI caption: "You NEED to see this 👀🔥 #zivv #viral"')} className="btn-ghost text-sm">✦ Caption</button>
              <button onClick={() => setMsg('✦ Subtitles will be auto-generated after upload (AR/EN).')} className="btn-ghost text-sm">✦ Subtitles</button>
              <button onClick={() => setMsg('✦ Enhancement queued: video + audio upscaling.')} className="btn-ghost text-sm">✦ Enhance</button>
              <button onClick={() => setMsg('AI-generated content is always labeled ✦')} className="btn-ghost text-sm">✦ AI image</button>
            </div>
            <button onClick={publishPost} className="btn-primary w-full">Publish</button>
          </>
        )}
        {msg && <div className="text-sm font-semibold text-zivv-purple text-center">{msg}</div>}
      </div>
    </div>
  );
}
