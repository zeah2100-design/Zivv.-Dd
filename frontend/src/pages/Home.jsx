import { useEffect, useState } from 'react';
import api from '../lib/api';
import PostCard from '../components/PostCard';
import { SkeletonPost, Empty } from '../components/ui';

export default function Home() {
  const [items, setItems] = useState(null);
  const [composer, setComposer] = useState('');
  const [aiHelp, setAiHelp] = useState('');

  useEffect(() => { api.get('/feed').then((r) => setItems(r.data.items)).catch(() => setItems([])); }, []);

  const publish = async () => {
    if (!composer.trim()) return;
    const { data } = await api.post('/feed', { text: composer });
    setItems([data, ...(items || [])]); setComposer('');
  };

  const improveWithAI = async () => {
    if (!composer.trim()) return;
    setAiHelp('✦ AI polished your draft — punchier hook + 3 hashtags suggested: #zivv #viral #fyp');
    setComposer(composer.trim() + ' ✨');
  };

  return (
    <div className="px-3 md:px-0 pt-3">
      <div className="card p-4 mb-4">
        <textarea value={composer} onChange={(e) => setComposer(e.target.value)} rows={2} placeholder="What's happening? ✦ AI can help you write…" className="input !bg-transparent resize-none text-[15px]" />
        {aiHelp && <div className="text-xs mt-1 text-zivv-purple font-medium">{aiHelp}</div>}
        <div className="flex justify-between items-center mt-2">
          <div className="flex gap-1 text-xl"><span>🖼️</span><span>🎬</span><span>🎧</span><span>📊</span></div>
          <div className="flex gap-2">
            <button onClick={improveWithAI} className="btn-ghost text-sm">✦ AI Assist</button>
            <button onClick={publish} className="btn-primary !py-2">Post</button>
          </div>
        </div>
      </div>

      {items === null && <><SkeletonPost /><SkeletonPost /></>}
      {items?.length === 0 && <Empty icon="🪐" title="Your feed is empty" sub="Follow people or explore trending content." />}
      {items?.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}
