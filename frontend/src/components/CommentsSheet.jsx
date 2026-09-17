import { useEffect, useState } from 'react';
import api, { fmt } from '../lib/api';
import { useZivv } from '../lib/store';
import { useLang } from '../lib/i18n';
import { Avatar } from './ui';
import { XIcon, SendIcon, LikeIcon, TrashIcon } from './icons';

// Shared bottom-sheet comments (Feed + Reels).
// Closes via: X button, backdrop tap, or Escape key.
export default function CommentsSheet({ targetType, targetId, count, onCount, onClose }) {
  const { user } = useZivv();
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [total, setTotal] = useState(count || 0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    api.get(`/comments/${targetType}/${targetId}`)
      .then((r) => { setItems(r.data.items || []); setTotal(r.data.items?.length || 0); onCount?.(r.data.items?.length || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [targetType, targetId]);

  const bump = (d) => setTotal((v) => { const n = Math.max(0, v + d); onCount?.(n); return n; });

  const send = async () => {
    const v = text.trim();
    if (!v || sending) return;
    setSending(true);
    try {
      const r = await api.post(`/comments/${targetType}/${targetId}`, { text: v });
      setItems((l) => [...l, r.data]);
      setText('');
      bump(1);
    } finally { setSending(false); }
  };

  const like = async (c) => {
    const prev = { liked: c.liked, likeCount: c.likeCount };
    setItems((l) => l.map((x) => (x.id === c.id ? { ...x, liked: !x.liked, likeCount: (x.likeCount || 0) + (x.liked ? -1 : 1) } : x)));
    try {
      const r = await api.post(`/comments/${c.id}/like`);
      setItems((l) => l.map((x) => (x.id === c.id ? { ...x, liked: r.data.liked, likeCount: r.data.likeCount } : x)));
    } catch {
      setItems((l) => l.map((x) => (x.id === c.id ? { ...x, ...prev } : x)));
    }
  };

  const del = async (c) => {
    if (!window.confirm(t('cmt.delConfirm'))) return;
    setItems((l) => l.filter((x) => x.id !== c.id));
    bump(-1);
    try { await api.delete(`/comments/${c.id}`); } catch {}
  };

  return (
    <div className="fixed inset-0 z-[60] fade-in" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute bottom-0 inset-x-0 mx-auto max-w-2xl bg-white dark:bg-neutral-950 rounded-t-3xl slide-up flex flex-col max-h-[80dvh] overflow-hidden shadow-2xl">
        <div className="pt-2.5 pb-1 flex justify-center shrink-0"><span className="w-10 h-1 rounded-full bg-black/15 dark:bg-white/20" /></div>
        <div className="flex items-center px-3 pb-2.5 border-b border-black/5 dark:border-white/10 shrink-0">
          <div className="flex-1" />
          <div className="font-bold text-[15px]">{t('cmt.title')} · {fmt.n(total)}</div>
          <div className="flex-1 flex justify-end">
            <button onClick={onClose} aria-label="Close"
              className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center active:scale-90 transition hover:bg-black/10 dark:hover:bg-white/20">
              <XIcon size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading && [0, 1, 2].map((i) => (
            <div key={i} className="flex gap-2.5 items-start animate-pulse">
              <div className="w-9 h-9 rounded-full bg-black/10 dark:bg-white/10 shrink-0" />
              <div className="flex-1 space-y-1.5"><div className="h-3 w-24 rounded bg-black/10 dark:bg-white/10" /><div className="h-3 w-3/4 rounded bg-black/10 dark:bg-white/10" /></div>
            </div>
          ))}
          {!loading && items.length === 0 && (
            <div className="text-center text-sm opacity-50 py-10">{t('cmt.empty')}</div>
          )}
          {items.map((c) => {
            const mine = user?.id === c.authorId;
            return (
              <div key={c.id} className="flex gap-2.5 items-start">
                <Avatar user={c.author} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[13px] truncate">{c.author?.name || c.author?.username}</span>
                    <span className="text-[11px] opacity-40 shrink-0">{fmt.time(c.createdAt)}</span>
                  </div>
                  <div className="text-sm leading-snug mt-0.5 break-words">{c.text}</div>
                </div>
                <div className="flex flex-col items-center shrink-0 -mt-0.5">
                  <button onClick={() => like(c)} aria-label="Like"
                    className={`p-1 rounded-full transition active:scale-125 ${c.liked ? 'text-zivv-pink' : 'opacity-45 hover:opacity-100 hover:text-zivv-pink'}`}>
                    <LikeIcon size={17} filled={c.liked} />
                  </button>
                  {(c.likeCount || 0) > 0 && <span className="text-[11px] font-semibold opacity-60 -mt-0.5">{fmt.n(c.likeCount)}</span>}
                  {mine && (
                    <button onClick={() => del(c)} aria-label="Delete" className="p-1 mt-0.5 rounded-full opacity-40 hover:opacity-100 hover:text-red-500 transition">
                      <TrashIcon size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t border-black/5 dark:border-white/10 flex items-center gap-2 shrink-0 bg-white dark:bg-neutral-950">
          <Avatar user={user} size={34} />
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={t('cmt.ph')} maxLength={500} className="input !py-2 !rounded-full text-sm" />
          <button onClick={send} disabled={!text.trim() || sending}
            className="btn-primary !p-2.5 !rounded-full disabled:opacity-40 shrink-0 rtl:rotate-180" aria-label="Send">
            <SendIcon size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
