// ZIVV AI: per-user chats + pins + vision + image-gen + Gold-only agent actions.
const router = require('express').Router();
const db = require('../lib/db');
const AI = require('../lib/ai');
const { requireAuth } = require('../middleware/auth');

const LOW = new Set(['search', 'navigate', 'draft', 'summarize']);
const MEDIUM = new Set(['send_message', 'publish', 'follow', 'edit_profile', 'delete_content']);
const HIGH = new Set(['delete_account', 'purchase', 'security_change', 'grant_permission']);

router.get('/status', requireAuth, (req, res) => res.json(AI.status()));
router.get('/chats', requireAuth, async (req, res) => {
  const rows = await db.q(
    'SELECT * FROM ai_chats WHERE user_id=$1 ORDER BY pinned DESC, created_at DESC', [req.user.id]
  );
  res.json({ items: rows.map(db.aiChatRow) });
});

router.post('/chats', requireAuth, async (req, res) => {
  const id = 'a' + Date.now();
  const rows = await db.q(
    'INSERT INTO ai_chats (id, user_id) VALUES ($1,$2) RETURNING *', [id, req.user.id]
  );
  res.status(201).json(db.aiChatRow(rows[0]));
});

router.post('/chats/:id/pin', requireAuth, async (req, res) => {
  const rows = await db.q('UPDATE ai_chats SET pinned=NOT pinned WHERE id=$1 AND user_id=$2 RETURNING id, pinned',
    [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  res.json({ id: rows[0].id, pinned: rows[0].pinned });
});

router.delete('/chats/:id', requireAuth, async (req, res) => {
  const del = await db.q('DELETE FROM ai_chats WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.user.id]);
  if (!del.length) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Text chat — real provider when live, demo brain otherwise.
router.post('/chats/:id/messages', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT * FROM ai_chats WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const chat = db.aiChatRow(rows[0]);
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
  await db.q('UPDATE ai_chats SET messages=$1, title=$2 WHERE id=$3',
    [JSON.stringify(chat.messages), chat.title, chat.id]);
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

router.post('/agent/execute', requireAuth, async (req, res) => {
  const meRows = await db.q('SELECT * FROM users WHERE id=$1', [req.user.id]);
  const me = db.userRow(meRows[0]);
  if (!me?.gold) return res.status(403).json({ error: 'gold_required' });
  const { tool, input, confirmed } = req.body || {};
  const risk = LOW.has(tool) ? 'LOW' : MEDIUM.has(tool) ? 'MEDIUM' : 'HIGH';
  if (risk !== 'LOW' && !confirmed) return res.status(428).json({ error: 'confirmation_required', risk });
  let result = { ok: true };
  if (tool === 'publish' && input?.text) {
    const id = 'p-' + db.uuid().slice(0, 6);
    await db.q(
      `INSERT INTO posts (id, author_id, type, text, hashtags, media, ai_generated)
       VALUES ($1,$2,'TEXT',$3,$4,'[]',TRUE)`,
      [id, me.id, input.text, JSON.stringify(input.hashtags || [])]
    );
    result = { published: id };
  }
  if (tool === 'follow' && input?.username) {
    const tgt = await db.q('SELECT id, username FROM users WHERE LOWER(username)=LOWER($1) AND banned=FALSE', [input.username]);
    if (tgt.length && tgt[0].id !== me.id) {
      await db.q('INSERT INTO follows (follower_id, followee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [me.id, tgt[0].id]);
      await db.q('UPDATE users SET followers=(SELECT COUNT(*) FROM follows WHERE followee_id=$1) WHERE id=$1', [tgt[0].id]);
      await db.q('UPDATE users SET following=(SELECT COUNT(*) FROM follows WHERE follower_id=$1) WHERE id=$1', [me.id]);
      result = { followed: tgt[0].username };
    }
  }
  if (tool === 'edit_profile' && input?.bio) {
    await db.q('UPDATE users SET bio=$1 WHERE id=$2', [input.bio, me.id]);
    result = { bio: input.bio };
  }
  await db.notify(me.id, { category: 'ai', title: 'Agent task completed', body: `${tool} done` });
  await db.auditLog(me.username, 'agent_execute', tool);
  res.json({ result, risk, audited: true });
});

module.exports = router;
