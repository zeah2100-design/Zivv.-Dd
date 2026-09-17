import { useState } from 'react';
import { CrownIcon, SparkleIcon } from './icons';

export function Logo({ size = 36, wordmark = true }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <img src="/logo.png" alt="ZIVV" width={size} height={size} className="rounded-[28%] shadow-sm" style={{ width: size, height: size }} />
      {wordmark && <span className="text-[22px] font-extrabold tracking-tight">ZIVV</span>}
    </div>
  );
}

function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

// Real face photos online, neutral initials offline.
export function Avatar({ user, size = 44, ring = false }) {
  const [err, setErr] = useState(false);
  const name = user?.name || user?.username || '?';
  const src = user?.avatar || '';
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  const inner = (src && !err) ? (
    <img src={src} onError={() => setErr(true)} alt={name} loading="lazy"
      className="w-full h-full object-cover rounded-full" />
  ) : (
    <div className="w-full h-full rounded-full bg-gradient-to-br from-zivv-purple to-zivv-pink text-white flex items-center justify-center font-bold" style={{ fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
  if (ring) return <div className="p-[2.5px] rounded-full zivv-ring shrink-0" style={{ width: size + 5, height: size + 5 }}><div className="w-full h-full rounded-full bg-white dark:bg-ink-900 p-[2px] overflow-hidden">{inner}</div></div>;
  return <div className="shrink-0 rounded-full overflow-hidden" style={{ width: size, height: size }}>{inner}</div>;
}

// Real photos online, parent background shows through offline.
export function ZImg({ seed, w = 800, h = 600, className = '', alt = '' }) {
  const [err, setErr] = useState(false);
  if (err) return null;
  return <img src={`https://picsum.photos/seed/${seed}/${w}/${h}`} onError={() => setErr(true)} loading="lazy" alt={alt} className={className} />;
}

export function Verified({ gold }) {
  if (gold) return <CrownIcon size={15} className="inline text-amber-500" />;
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 inline text-zivv-blue" fill="currentColor"><path d="M12 2l2.4 2.4 3.4-.5.9 3.3 3.1 1.5-1.6 3 1.6 3-3.1 1.5-.9 3.3-3.4-.5L12 22l-2.4-2.4-3.4.5-.9-3.3-3.1-1.5 1.6-3-1.6-3 3.1-1.5.9-3.3 3.4.5z" /><path d="M10.6 14.6l-2.1-2.1 1.1-1.1 1 1 3.7-3.7 1.1 1.1z" fill="white" /></svg>
  );
}

export function AiBadge() {
  return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"><SparkleIcon size={11} />AI</span>;
}

export function GoldBadge() {
  return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-amber-950 shadow-sm"><CrownIcon size={13} />GOLD</span>;
}

export function SkeletonPost() {
  return <div className="card p-4 space-y-3"><div className="flex gap-3 items-center"><div className="skeleton w-11 h-11 !rounded-full" /><div className="skeleton h-4 w-40" /></div><div className="skeleton h-56" /><div className="skeleton h-4 w-2/3" /></div>;
}

export function ImageModal({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 fade-in" onClick={onClose}>
      <img src={src} alt="" className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl" />
    </div>
  );
}

export function Empty({ icon, title, sub }) {
  return <div className="card p-10 text-center float-in"><div className="flex justify-center mb-3 text-neutral-400">{icon}</div><div className="font-bold text-lg">{title}</div><div className="text-sm opacity-60 mt-1">{sub}</div></div>;
}
