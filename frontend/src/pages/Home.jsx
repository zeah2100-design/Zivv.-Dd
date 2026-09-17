import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useZivv } from '../lib/store';
import PostCard from '../components/PostCard';
import { SkeletonPost, Empty, Avatar, ZImg } from '../components/ui';
import { PlusIcon, XIcon, ChevronLeftIcon, ChevronRightIcon, ImageIcon, ClapperIcon, MusicIcon, SparklesIcon, SendIcon, NewspaperIcon } from '../components/icons';

function StoryViewer({ stories, index, onClose, onNav }) {
  const s = stories[index];
  useEffect(() => {
    const t = setTimeout(() => { index < stories.length - 1 ? onNav(index + 1) : onClose(); }, 5000);
    return () => clearTimeout(t);
  }, [index]);
  if (!s) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black fade-in flex items-center justify-center">
      <div className="relative w-full max-w-[430px] h-full md:h-[92vh] md:rounded-2xl overflow-hidden bg-neutral-900">
        <div className="absolute inset-0 zivv-gradient opacity-40" />
        <ZImg seed={`story-${s.user.id}`} w={540} h={960} className="absolute inset-0 w-full h-full object-cover" alt="Story" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60" />
        <div className="absolute top-0 inset-x-0 p-3">
          <div className="flex gap-1 mb-3">
            {stories.map((_, i) => (
              <div key={i} className="h-[3px] flex-1 rounded-full bg-white/30 overflow-hidden">
                {i < index && <div className="h-full w-full bg-white rounded-full" />}
                {i === index && <div className="h-full bg-white rounded-full story-fill" />}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2.5 text-white">
            <Avatar user={s.user} size={36} />
            <div className="flex-1"><div className="font-bold text-sm">{s.user.name}</div><div className="text-[11px] opacity-70">2h ago</div></div>
            <button onClick={onClose} className="p-2" aria-label="Close"><XIcon size={22} /></button>
          </div>
        </div>
        <button className="absolute left-0 top-20 bottom-20 w-1/3" onClick={() => index > 0 && onNav(index - 1)} aria-label="Previous" />
        <button className="absolute right-0 top-20 bottom-20 w-1/3" onClick={() => index < stories.length - 1 ? onNav(index + 1) : onClose()} aria-label="Next" />
        <div className="absolute bottom-0 inset-x-0 p-4 flex items-center gap-2">
          <button onClick={() => index > 0 && onNav(index - 1)} className="text-white/70 p-1" aria-label="Previous"><ChevronLeftIcon size={26} /></button>
          <div className="flex-1 border border-white/40 rounded-full px-4 py-2.5 text-white/80 text-sm">Reply to {s.user.name?.split(' ')[0]}…</div>
          <button onClick={() => index < stories.length - 1 ? onNav(index + 1) : onClose()} className="text-white/70 p-1" aria-label="Next"><ChevronRightIcon size={26} /></button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [items, setItems] = useState(null);
  const [stories, setStories] = useState([]);
  const [viewing, setViewing] = useState(-1);
  const [seen, setSeen] = useState(new Set());
  const [composer, setComposer] = useState('');
  const [aiHelp, setAiHelp] = useState('');
  const { user } = useZivv();
  const nav = useNavigate();

  useEffect(() => {
    api.get('/feed').then((r) => setItems(r.data.items)).catch(() => setItems([]));
    api.get('/search/explore').then((r) => setStories((r.data.suggestedAccounts || []).slice(0, 8).map((u) => ({ user: u })))).catch(() => {});
  }, []);

  const publish = async () => {
    if (!composer.trim()) return;
    const { data } = await api.post('/feed', { text: composer });
    setItems([data, ...(items || [])]); setComposer(''); setAiHelp('');
  };

  const improveWithAI = () => {
    if (!composer.trim()) return;
    setAiHelp('AI polished your draft — punchier hook + hashtags suggested: #zivv #viral #fyp');
    setComposer(composer.trim() + ' ✨');
  };

  const openStory = (i) => { setViewing(i); setSeen(new Set([...seen, i])); };

  return (
    <div className="pt-3">
      {/* Stories */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar px-3 md:px-0 pb-1">
        <button onClick={() => nav('/create')} className="flex flex-col items-center gap-1 shrink-0 w-[68px]">
          <span className="relative"><Avatar user={user} size={60} />
            <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full zivv-gradient text-white flex items-center justify-center border-[3px] border-neutral-100 dark:border-ink-950"><PlusIcon size={13} /></span>
          </span>
          <span className="text-[11px] font-semibold opacity-70">Your story</span>
        </button>
        {stories.map((s, i) => (
          <button key={s.user.id} onClick={() => openStory(i)} className="flex flex-col items-center gap-1 shrink-0 w-[68px]">
            {seen.has(i) ? <Avatar user={s.user} size={60} /> : <Avatar user={s.user} size={60} ring />}
            <span className="text-[11px] font-semibold opacity-70 truncate w-full text-center">{s.user.name?.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      <div className="px-3 md:px-0">
        {/* Composer */}
        <div className="card p-4 my-3">
          <div className="flex gap-3">
            <Avatar user={user} size={42} />
            <textarea value={composer} onChange={(e) => setComposer(e.target.value)} rows={2} placeholder="What's happening?" className="flex-1 bg-transparent resize-none outline-none text-[15px] placeholder:text-neutral-400 pt-2" />
          </div>
          {aiHelp && <div className="text-xs mt-1.5 ml-[54px] text-zivv-purple font-medium flex items-center gap-1"><SparklesIcon size={13} />{aiHelp}</div>}
          <div className="flex justify-between items-center mt-2 ml-[54px]">
            <div className="flex gap-0.5 text-zivv-purple">
              <button className="p-2 hover:bg-zivv-purple/10 rounded-xl transition" aria-label="Photo"><ImageIcon size={20} /></button>
              <button className="p-2 hover:bg-zivv-purple/10 rounded-xl transition" aria-label="Video"><ClapperIcon size={20} /></button>
              <button className="p-2 hover:bg-zivv-purple/10 rounded-xl transition" aria-label="Music"><MusicIcon size={20} /></button>
            </div>
            <div className="flex gap-2">
              <button onClick={improveWithAI} className="btn-ghost text-sm flex items-center gap-1.5"><SparklesIcon size={15} />AI Assist</button>
              <button onClick={publish} disabled={!composer.trim()} className="btn-primary !py-2 flex items-center gap-1.5 disabled:opacity-40"><SendIcon size={15} />Post</button>
            </div>
          </div>
        </div>

        {items === null && <><SkeletonPost /><SkeletonPost /></>}
        {items?.length === 0 && <Empty icon={<NewspaperIcon size={52} />} title="Your feed is empty" sub="Follow people or explore trending content." />}
        {items?.map((p) => <PostCard key={p.id} post={p} />)}
      </div>

      {viewing >= 0 && <StoryViewer stories={stories} index={viewing} onClose={() => setViewing(-1)} onNav={setViewing} />}
    </div>
  );
}
