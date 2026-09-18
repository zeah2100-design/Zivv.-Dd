import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { processImage, MAX_UPLOAD_CHARS } from '../lib/image';
import { useZivv } from '../lib/store';
import { useLang } from '../lib/i18n';
import { Avatar } from '../components/ui';
import { ImageIcon, FilmIcon, BagIcon, SendIcon, EditIcon, ClapperIcon, MusicIcon, TagIcon, LinkIcon, XIcon } from '../components/icons';

const TABS = [
  ['post', EditIcon, 'create.tabPost'],
  ['image', ImageIcon, 'create.tabImage'],
  ['short', ClapperIcon, 'create.tabReel'],
  ['video', FilmIcon, 'create.tabVideo'],
  ['song', MusicIcon, 'create.tabSong'],
  ['listing', TagIcon, 'create.tabListing'],
];

export default function Create() {
  const { user } = useZivv();
  const { t } = useLang();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [kind, setKind] = useState(params.get('type') === 'story' ? 'post' : 'post');
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [preview, setPreview] = useState('');
  const [duration, setDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  // listing fields
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Phones');
  const [cond, setCond] = useState('used-like-new');
  const [limg, setLimg] = useState('');
  const limgRef = useRef(null);

  const max = user?.gold ? 5000 : 2000;

  const pickFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr('');
    const dataUrl = await processImage(f);
    if (!dataUrl) { setErr(t('create.failed')); return; }
    if (dataUrl.length > MAX_UPLOAD_CHARS) { setErr(t('create.tooBig')); return; }
    setMediaUrl(dataUrl); setPreview(dataUrl);
  };

  const pickListingImg = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr('');
    const dataUrl = await processImage(f);
    if (!dataUrl) { setErr(t('create.failed')); return; }
    if (dataUrl.length > MAX_UPLOAD_CHARS) { setErr(t('create.tooBig')); return; }
    setLimg(dataUrl);
  };

  const detectDuration = (url, isVideo) => {
    if (!url || !url.startsWith('http')) return;
    const el = document.createElement(isVideo ? 'video' : 'audio');
    el.preload = 'metadata';
    el.onloadedmetadata = () => setDuration(Math.round(el.duration || 0));
    el.onerror = () => {};
    el.src = url;
  };

  const publish = async () => {
    if (busy) return;
    setBusy(true); setErr(''); setDone('');
    try {
      const hashtags = [...text.matchAll(/#(\w+)/g)].map((m) => m[1]);
      if (kind === 'post') {
        if (!text.trim()) return;
        await api.post('/feed', { text, hashtags });
        setText(''); setDone(t('create.published'));
        setTimeout(() => nav('/'), 900);
      } else if (kind === 'image') {
        if (!mediaUrl) { setErr(t('create.needMedia')); return; }
        await api.post('/feed', { type: 'IMAGE', text, hashtags, mediaUrl }, { timeout: 120000 });
        afterMedia('/');
      } else if (kind === 'short') {
        if (!mediaUrl) { setErr(t('create.needMedia')); return; }
        if (duration > 60) { setErr(t('create.tooLong')); return; }
        await api.post('/reels', { caption: text, hashtags, mediaUrl, durationSec: duration }, { timeout: 120000 });
        afterMedia('/reels');
      } else if (kind === 'video') {
        if (!mediaUrl) { setErr(t('create.needMedia')); return; }
        await api.post('/feed', { type: 'VIDEO', text, hashtags, mediaUrl, durationSec: duration }, { timeout: 120000 });
        afterMedia('/');
      } else if (kind === 'song') {
        if (!mediaUrl) { setErr(t('create.needMedia')); return; }
        await api.post('/feed', { type: 'MUSIC', text, hashtags, mediaUrl, durationSec: duration }, { timeout: 120000 });
        afterMedia('/');
      }
    } catch (e) {
      setErr(e.response?.data?.error === 'too_long' ? t('create.tooLongText') : t('create.failed'));
    } finally { setBusy(false); }
  };
  const afterMedia = (to) => { setText(''); setMediaUrl(''); setPreview(''); setDuration(0); setDone(t('create.published')); setTimeout(() => nav(to), 900); };

  const publishListing = async () => {
    if (!title.trim() || !price || busy) return;
    setBusy(true); setErr('');
    try {
      await api.post('/marketplace', { title, description: desc, priceCents: Math.round(parseFloat(price) * 100), category: cat, condition: cond, image: limg || undefined }, { timeout: 120000 });
      setTitle(''); setPrice(''); setDesc(''); setLimg('');
      setDone(t('create.listed'));
      setTimeout(() => nav('/market'), 900);
    } catch { setErr(t('create.failed')); } finally { setBusy(false); }
  };

  const needsUrl = kind === 'short' || kind === 'video' || kind === 'song';

  return (
    <div className="p-3 md:p-4 max-w-2xl mx-auto space-y-3">
      <h1 className="font-bold text-xl px-1">{t('create.title')}</h1>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {TABS.map(([v, Icon, lk]) => (
          <button key={v} onClick={() => { setKind(v); setErr(''); setDone(''); }}
            className={`px-4 py-2 text-sm font-bold rounded-full transition shrink-0 flex items-center gap-1.5 ${kind === v ? 'tab-active' : 'bg-black/5 dark:bg-white/10 opacity-60'}`}>
            <Icon size={15} />{t(lk)}
          </button>
        ))}
      </div>

      {kind !== 'listing' && (
        <div className="card p-4">
          <div className="flex gap-3">
            <Avatar user={user} size={40} />
            <div className="flex-1">
              <div className="font-bold text-sm">{user?.name}</div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={max}
                placeholder={t(kind === 'short' ? 'create.captionPhReel' : 'create.captionPh')} className="w-full bg-transparent resize-none text-[15px] mt-1 placeholder:opacity-40 focus:outline-none" />
              <div className="text-[11px] opacity-40 text-end">{text.length}/{max}</div>
            </div>
          </div>

          {kind === 'image' && (
            <div className="mt-2 space-y-2">
              {preview ? (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={preview} alt="" className="w-full max-h-72 object-cover" />
                  <button onClick={() => { setPreview(''); setMediaUrl(''); }} className="absolute top-2 end-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="Remove"><XIcon size={16} /></button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} className="w-full py-6 rounded-xl border-2 border-dashed border-black/15 dark:border-white/15 text-sm font-bold opacity-70 hover:opacity-100 flex items-center justify-center gap-2">
                  <ImageIcon size={19} />{t('create.pickImage')}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
              <div className="flex items-center gap-2 bg-black/5 dark:bg-white/10 rounded-xl px-3">
                <LinkIcon size={16} className="opacity-50 shrink-0" />
                <input value={mediaUrl.startsWith('data:') ? '' : mediaUrl} onChange={(e) => { setMediaUrl(e.target.value); setPreview(e.target.value); }} placeholder={t('create.urlPh')} className="bg-transparent flex-1 py-2.5 text-sm focus:outline-none placeholder:opacity-40" />
              </div>
            </div>
          )}

          {needsUrl && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 bg-black/5 dark:bg-white/10 rounded-xl px-3">
                <LinkIcon size={16} className="opacity-50 shrink-0" />
                <input value={mediaUrl} onChange={(e) => { setMediaUrl(e.target.value); detectDuration(e.target.value, kind !== 'song'); }} placeholder={t(kind === 'song' ? 'create.audioUrlPh' : 'create.videoUrlPh')} className="bg-transparent flex-1 py-2.5 text-sm focus:outline-none placeholder:opacity-40" dir="ltr" />
              </div>
              {kind === 'short' && <div className="text-[11px] opacity-50 px-1">{t('create.shortNote')}{duration > 0 && ` · ${duration}s`}</div>}
              {kind === 'video' && duration > 0 && <div className="text-[11px] opacity-50 px-1">{duration}s · {t('create.longNote')}</div>}
              {kind === 'short' && mediaUrl.startsWith('http') && (
                <video src={mediaUrl} preload="metadata" muted playsInline className="w-full max-h-64 rounded-xl bg-black" controls />
              )}
              {kind === 'video' && mediaUrl.startsWith('http') && (
                <video src={mediaUrl} preload="metadata" className="w-full max-h-64 rounded-xl bg-black" controls />
              )}
              {kind === 'song' && mediaUrl.startsWith('http') && <audio src={mediaUrl} controls className="w-full" />}
            </div>
          )}

          {!!err && <div className="text-red-500 text-sm font-bold mt-2">{err}</div>}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-black/5 dark:border-white/10">
            <span className="text-[11px] opacity-50 font-semibold">{kind === 'short' ? t('create.goesReels') : t('create.goesHome')}</span>
            <div className="flex-1" />
            <button onClick={publish} disabled={busy || (!text.trim() && !mediaUrl)} className="btn-primary disabled:opacity-40 flex items-center gap-2">
              <SendIcon size={17} />{t('create.publish')}
            </button>
          </div>
        </div>
      )}

      {kind === 'listing' && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2 font-bold"><BagIcon size={20} />{t('create.newListing')}</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('create.titlePh')} className="input" />
          <div className="flex gap-2">
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder={t('create.pricePh')} className="input flex-1" />
            <select value={cond} onChange={(e) => setCond(e.target.value)} className="input flex-1">
              <option value="new">{t('create.condNew')}</option>
              <option value="used-like-new">{t('create.condLikeNew')}</option>
              <option value="used">{t('create.condUsed')}</option>
            </select>
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="input">
            {['Phones', 'Sports', 'Fashion', 'Home', 'Cars', 'Other'].map((c) => <option key={c}>{c}</option>)}
          </select>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder={t('create.descPh')} className="input resize-none" />
          {limg ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={limg} alt="" className="w-full max-h-56 object-cover" />
              <button onClick={() => setLimg('')} className="absolute top-2 end-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="Remove"><XIcon size={16} /></button>
            </div>
          ) : (
            <button onClick={() => limgRef.current?.click()} className="w-full py-4 rounded-xl border-2 border-dashed border-black/15 dark:border-white/15 text-sm font-bold opacity-70 hover:opacity-100 flex items-center justify-center gap-2">
              <ImageIcon size={19} />{t('create.listingImage')}
            </button>
          )}
          <input ref={limgRef} type="file" accept="image/*" className="hidden" onChange={pickListingImg} />
          {!!err && <div className="text-red-500 text-sm font-bold">{err}</div>}
          <button onClick={publishListing} disabled={!title.trim() || !price || busy} className="btn-primary w-full disabled:opacity-40">{t('create.publishListing')}</button>
        </div>
      )}

      {!!done && <div className="card p-4 text-center font-bold text-green-500 fade-in">{done}</div>}
    </div>
  );
}
