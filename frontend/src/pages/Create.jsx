import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { useZivv } from '../lib/store';
import { useLang } from '../lib/i18n';
import { Avatar } from '../components/ui';
import { ImageIcon, FilmIcon, BagIcon, SendIcon, SparklesIcon, EditIcon, ApertureIcon, ClapperIcon, TagIcon } from '../components/icons';

export default function Create() {
  const { user } = useZivv();
  const { t } = useLang();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [kind, setKind] = useState(params.get('type') === 'story' ? 'story' : 'post');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  // listing fields
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Phones');
  const [cond, setCond] = useState('used-like-new');

  const publishPost = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const hashtags = [...text.matchAll(/#(\w+)/g)].map((m) => m[1]);
      await api.post('/feed', { text, hashtags });
      setText(''); setDone(t('create.published'));
      setTimeout(() => nav('/'), 900);
    } finally { setBusy(false); }
  };

  const publishListing = async () => {
    if (!title.trim() || !price || busy) return;
    setBusy(true);
    try {
      await api.post('/marketplace', { title, description: desc, priceCents: Math.round(parseFloat(price) * 100), category: cat, condition: cond });
      setDone(t('create.listed'));
      setTimeout(() => nav('/market'), 900);
    } finally { setBusy(false); }
  };

  const tabs = [
    ['post', EditIcon, t('create.tabPost')],
    ['story', ApertureIcon, t('create.tabStory')],
    ['reel', ClapperIcon, t('create.tabReel')],
    ['listing', TagIcon, t('create.tabListing')],
  ];

  return (
    <div className="p-3 md:p-4 max-w-2xl mx-auto space-y-3">
      <h1 className="font-bold text-xl px-1">{t('create.title')}</h1>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {tabs.map(([v, Icon, l]) => (
          <button key={v} onClick={() => setKind(v)}
            className={`px-4 py-2 text-sm font-bold rounded-full transition shrink-0 flex items-center gap-1.5 ${kind === v ? 'tab-active' : 'bg-black/5 dark:bg-white/10 opacity-60'}`}>
            <Icon size={15} />{l}
          </button>
        ))}
      </div>

      {(kind === 'post' || kind === 'story') && (
        <div className="card p-4">
          <div className="flex gap-3">
            <Avatar user={user} size={40} />
            <div className="flex-1">
              <div className="font-bold">{user?.name}</div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={2000}
                placeholder={t('create.captionPh')} className="w-full bg-transparent resize-none text-[15px] mt-1 placeholder:opacity-40 focus:outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-3 border-t border-black/5 dark:border-white/10">
            <button className="p-2.5 rounded-full bg-black/5 dark:bg-white/10 opacity-70" aria-label="Photo"><ImageIcon size={20} /></button>
            <button className="p-2.5 rounded-full bg-black/5 dark:bg-white/10 opacity-70" aria-label="Video"><FilmIcon size={20} /></button>
            <button className="p-2.5 rounded-full bg-black/5 dark:bg-white/10 opacity-70" aria-label="AI"><SparklesIcon size={20} /></button>
            <div className="flex-1" />
            <button onClick={publishPost} disabled={!text.trim() || busy} className="btn-primary disabled:opacity-40 flex items-center gap-2">
              <SendIcon size={17} />{t('create.publish')}
            </button>
          </div>
        </div>
      )}

      {kind === 'reel' && (
        <div className="card p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center mb-3 text-neutral-400"><ClapperIcon size={26} /></div>
          <div className="font-bold text-lg">{t('create.reelSoon')}</div>
          <div className="text-sm opacity-60 mt-1">{t('create.reelSoonSub')}</div>
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
          <button onClick={publishListing} disabled={!title.trim() || !price || busy} className="btn-primary w-full disabled:opacity-40">{t('create.publishListing')}</button>
        </div>
      )}

      {!!done && <div className="card p-4 text-center font-bold text-green-500 fade-in">{done}</div>}
    </div>
  );
}
