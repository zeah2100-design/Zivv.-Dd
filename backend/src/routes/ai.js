// ZIVV AI: per-user chats + pins + vision + image-gen + Gold-only agent actions.
const router = require('express').Router();
const S = require('../lib/store');
const AI = require('../lib/ai');
const { requireAuth } = require('../middleware/auth');

const LOW = new Set(['search', 'navigate', 'draft', 'summarize']);
const MEDIUM = new Set(['send_message', 'publish', 'follow', 'edit_profile', 'delete_content']);
const HIGH = new Set(['delete_account', 'purchase', 'security_change', 'grant_permission']);

router.get('/status', requireAuth, (req, res) => res.json(AI.status()));
router.get('/chats', requireAuth, (req, res) => {
  const items = S.aiChats.filter(c => c.userId === req.user.id)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  res.json({ items });
});

router.post('/chats', requireAuth, (req, res) => {
  const c = { id: 'a' + Date.now(), userId: req.user.id, title: 'New chat', pinned: false, messages: [] };
  S.aiChats.unshift(c); res.status(201).json(c);
});

router.post('/chats/:id/pin', requireAuth, (req, res) => {
  const c = S.aiChats.find(x => x.id === req.params.id && x.userId === req.user.id);
  if (!c) return res.status(404).json({ error: 'not_found' });
  c.pinned = !c.pinned;
  res.json({ id: c.id, pinned: c.pinned });
});

router.delete('/chats/:id', requireAuth, (req, res) => {
  const i = S.aiChats.findIndex(x => x.id === req.params.id && x.userId === req.user.id);
  if (i < 0) return res.status(404).json({ error: 'not_found' });
  S.aiChats.splice(i, 1);
  res.json({ ok: true });
});

// Text chat — real provider when live, demo brain otherwise.
router.post('/chats/:id/messages', requireAuth, async (req, res) => {
  const chat = S.aiChats.find(c => c.id === req.params.id && c.userId === req.user.id);
  if (!chat) return res.status(404).json({ error: 'not_found' });
  const { text } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'empty' });
  chat.messages.push({ id: 'm' + Date.now(), role: 'user', text });

  let reply;
  if (AI.status().live) {
    try {
      reply = await AI.chat(chat.messages);
    } catch (e) {
      console.error('[ai] provider error:', e.message);
      reply = smartReply(text) + '\n\n_(تعذّر الوصول لخدمة الذكاء الاصطناعي — رد تجريبي)_';
    }
  } else {
    reply = smartReply(text);
  }
  const a = { id: 'a' + Date.now(), role: 'assistant', text: reply };
  chat.messages.push(a);
  if (chat.title === 'New chat') chat.title = (text || 'Chat').slice(0, 40);
  res.json(a);
});

function smartReply(t = '') {
  if (/[\u0600-\u06FF]/.test(t)) return `تمام! فهمتك — "${t.slice(0, 60)}". تحب أكمّل إزاي: أكتبلك مسودة بوست، ألاقي حسابات، ولا أعمل خطة ريل؟`;
  const q = t.toLowerCase();
  if (/reel|video|فيديو/.test(q)) return 'Here’s a viral-ready plan:\n1) Hook in 1s (“Stop scrolling!”)\n2) 3 fast cuts, trending sound\n3) Caption + 5 hashtags\nWant me to draft the caption and pick the sound?';
  if (/bio/.test(q)) return 'Bio draft:\n"Football daily | Reels & tips | Collabs open"\nSay "apply this bio" and I’ll preview the change for your confirmation.';
  if (/image|صورة/.test(q)) return 'Describe the image (subject, style, mood) and I’ll generate it. AI images are always labeled as AI-generated.';
  return `Got it! I can help with that.\n• Draft posts, captions, replies\n• Find accounts, sounds, products\n• Gold members: I can act inside the app (publish, follow, edit profile) with your confirmation.\nTell me what to do first.`;
}

// Image understanding — real vision when live.
router.post('/vision', requireAuth, async (req, res) => {
  const { imageDataUrl, question } = req.body || {};
  if (!imageDataUrl) return res.status(400).json({ error: 'missing_image' });
  if (imageDataUrl.length > 5.5e6) return res.status(413).json({ error: 'image_too_large' });
  if (!AI.status().live) return res.status(503).json({ error: 'ai_offline', message: 'Set OPENAI_API_KEY or GEMINI_API_KEY to enable vision.' });
  try {
    const answer = await AI.vision(imageDataUrl, question || 'Describe this image in detail.');
    res.json({ answer });
  } catch (e) {
    console.error('[ai] vision error:', e.message);
    res.status(502).json({ error: 'ai_error' });
  }
});

// Image generation — real when live, labeled provenance always.
router.post('/image', requireAuth, async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt?.trim()) return res.status(400).json({ error: 'missing_prompt' });
  if (!AI.status().live) {
    return res.json({ imageUrl: '', prompt, aiGenerated: true, label: 'AI-generated with ZIVV', note: 'Set OPENAI_API_KEY or GEMINI_API_KEY server-side for real generation.' });
  }
  try {
    const out = await AI.generateImage(prompt);
    res.json({ ...out, prompt, aiGenerated: true, label: 'AI-generated with ZIVV' });
  } catch (e) {
    console.error('[ai] image error:', e.message);
    res.status(502).json({ error: 'ai_error' });
  }
});

// Agent: plan → preview → confirm → execute → audit. GOLD ONLY.
router.post('/agent/plan', requireAuth, (req, res) => {
  const { instruction } = req.body || {};
  const t = (instruction || '').toLowerCase();
  let tool = 'search', risk = 'LOW', preview = `Search ZIVV for "${instruction}"`;
  if (/send|message|بعت|رسالة/.test(t)) { tool = 'send_message'; risk = 'MEDIUM'; preview = 'Send message (recipient + text required)'; }
  else if (/post|publish|انشر/.test(t)) { tool = 'publish'; risk = 'MEDIUM'; preview = 'Publish content as drafted'; }
  else if (/follow|تابع/.test(t)) { tool = 'follow'; risk = 'MEDIUM'; preview = 'Follow account'; }
  else if (/bio|edit profile|عدل/.test(t)) { tool = 'edit_profile'; risk = 'MEDIUM'; preview = 'Edit profile with provided fields'; }
  else if (/delete account|امسح حساب|purchase|pay|ادفع/.test(t)) { tool = 'purchase'; risk = 'HIGH'; preview = 'HIGH-RISK action — explicit confirmation required'; }
  res.json({ tool, risk, preview, needsConfirmation: risk !== 'LOW', instruction });
});

router.post('/agent/execute', requireAuth, (req, res) => {
  const me = S.users.find(u => u.id === req.user.id);
  if (!me?.gold) return res.status(403).json({ error: 'gold_required' });
  const { tool, input, confirmed } = req.body || {};
  const risk = LOW.has(tool) ? 'LOW' : MEDIUM.has(tool) ? 'MEDIUM' : 'HIGH';
  if (risk !== 'LOW' && !confirmed) return res.status(428).json({ error: 'confirmation_required', risk });
  let result = { ok: true };
  if (tool === 'publish' && input?.text) {
    const post = { id: 'p-' + S.uuid().slice(0, 6), authorId: me.id, type: 'TEXT', text: input.text, hashtags: input.hashtags || [],
      mentions: [], likeCount: 0, commentCount: 0, shareCount: 0, saveCount: 0, viewCount: 0, aiGenerated: true, createdAt: new Date().toISOString(), media: [] };
    S.posts.unshift(post); result = { published: post.id };
  }
  if (tool === 'follow' && input?.username) {
    const u = S.users.find(x => x.username === input.username);
    if (u) { u.followers++; result = { followed: u.username }; }
  }
  if (tool === 'edit_profile' && input?.bio) { me.bio = input.bio; result = { bio: input.bio }; }
  S.notify(me.id, { category: 'ai', title: 'Agent task completed', body: `${tool} done` });
  S.auditLog(me.username, 'agent_execute', tool);
  res.json({ result, risk, audited: true });
});

module.exports = router;
