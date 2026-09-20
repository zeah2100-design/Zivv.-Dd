// ZIVV AI: CHAT ONLY — per-user chats + vision + Gold agent actions.
// Tiers: free chat models for everyone; ALL chat models + agent mode for Gold.
// Quotas are enforced here server-side (see lib/quotas.js) — never trust the client.
// NOTE: image/video generation was removed from the product (chat-only mode). The
// provider helpers still exist in lib/ai.js and can be re-routed later if needed.
const router = require('express').Router();
const db = require('../lib/db');
const AI = require('../lib/ai');
const quotas = require('../lib/quotas');
const { requireAuth } = require('../middleware/auth');

const LOW = new Set(['search', 'navigate', 'draft', 'summarize', 'none']);
const MEDIUM = new Set(['send_message', 'publish', 'follow', 'edit_profile', 'delete_content']);
const HIGH = new Set(['delete_account', 'purchase', 'security_change', 'grant_permission']);
// Tools the executor actually implements. Anything else is rejected, never faked.
const IMPLEMENTED = new Set(['publish', 'follow', 'edit_profile']);
const ACTION_TOOLS = new Set(['publish', 'follow', 'edit_profile']);

async function isGold(req) {
  const r = await db.q('SELECT gold FROM users WHERE id=$1', [req.user.id]);
  return !!r[0]?.gold;
}
function resolveModel(list, id, fallbackId) {
  return list.find((x) => x.id === (id || fallbackId)) || null;
}
// Returns { model, gold } or sends the error response and returns null.
async function gateModel(req, res, list, fallbackId, kind, { needVision = false } = {}) {
  const m = resolveModel(list, (req.body || {}).model, fallbackId);
  if (!m || (needVision && !m.vision)) {
    res.status(400).json({ error: needVision && m && !m.vision ? 'model_no_vision' : 'unknown_model' });
    return null;
  }
  const gold = await isGold(req);
  if (m.gold && !gold) { res.status(403).json({ error: 'gold_required', model: m.id }); return null; }
  const q = await quotas.check(req.user.id, kind, gold);
  if (!q.allowed) { res.status(429).json({ error: 'quota_exceeded', kind, ...q }); return null; }
  return { model: m, gold };
}

router.get('/status', requireAuth, (req, res) => res.json(AI.status()));

// Catalog + my quotas. Drives the model picker and limit badges in the app.
router.get('/models', requireAuth, async (req, res) => {
  const gold = await isGold(req);
  res.json({
    gold,
    defaults: { chat: AI.DEFAULTS.chat },
    chat: AI.CHAT_MODELS,
    limits: quotas.LIMITS,
    usage: await quotas.summary(req.user.id, gold),
  });
});

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

  let reply;
  if (AI.status().live) {
    const gated = await gateModel(req, res, AI.CHAT_MODELS, AI.DEFAULTS.chat, 'chat');
    if (!gated) return; // error already sent
    try {
      reply = await AI.chat([...chat.messages, { role: 'user', text }], { model: gated.model.id });
      await quotas.consume(req.user.id, 'chat', gated.gold);
    } catch (e) {
      if (AI.isBilling(e)) return res.status(402).json({ error: 'ai_billing' });
      console.error('[ai] provider error:', e.message);
      reply = smartReply(text) + '\n\n_(تعذّر الوصول لخدمة الذكاء الاصطناعي — رد تجريبي)_';
    }
  } else {
    reply = smartReply(text);
  }
  chat.messages.push({ id: 'm' + Date.now(), role: 'user', text });
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
  if (/image|صورة/.test(q)) return 'Send me the image and I’ll analyze it for you.';
  return `Got it! I can help with that.\n• Draft posts, captions, replies\n• Find accounts, sounds, products\n• Gold members: I can act inside the app (publish, follow, edit profile) with your confirmation.\nTell me what to do first.`;
}

// Image understanding — real vision when live.
router.post('/vision', requireAuth, async (req, res) => {
  const { imageDataUrl, question } = req.body || {};
  if (!imageDataUrl) return res.status(400).json({ error: 'missing_image' });
  if (imageDataUrl.length > 5.5e6) return res.status(413).json({ error: 'image_too_large' });
  if (!AI.status().live) return res.status(503).json({ error: 'ai_offline', message: 'AI key is not configured on the server.' });
  const gated = await gateModel(req, res, AI.CHAT_MODELS, AI.DEFAULTS.chat, 'vision', { needVision: true });
  if (!gated) return;
  try {
    const answer = await AI.vision(imageDataUrl, question || 'Describe this image in detail.', { model: gated.model.id });
    await quotas.consume(req.user.id, 'vision', gated.gold);
    res.json({ answer, model: gated.model.id });
  } catch (e) {
    if (AI.isBilling(e)) return res.status(402).json({ error: 'ai_billing' });
    console.error('[ai] vision error:', e.message);
    res.status(502).json({ error: 'ai_error' });
  }
});

// Agent: plan → preview → confirm → execute → audit. GOLD ONLY.
// The LLM parses the instruction into { tool, input, confidence }; keyword rules
// are the fallback when AI is offline or unparsable. Only ACTION_TOOLS act.
router.post('/agent/plan', requireAuth, async (req, res) => {
  if (!(await isGold(req))) return res.status(403).json({ error: 'gold_required' });
  const { instruction } = req.body || {};
  if (!instruction?.trim()) return res.status(400).json({ error: 'empty' });
  let parsed = null;
  if (AI.status().live) {
    try {
      parsed = await AI.agentParse(instruction.trim());
    } catch (e) {
      console.error('[ai] agent parse error:', e.message);
    }
  }
  if (!parsed || parsed.confidence < 0.55) parsed = { ...keywordPlan(instruction), confidence: 0.5 };
  const risk = LOW.has(parsed.tool) ? 'LOW' : MEDIUM.has(parsed.tool) ? 'MEDIUM' : 'HIGH';
  res.json({
    tool: parsed.tool, input: parsed.input || {}, risk,
    preview: parsed.preview || parsed.tool,
    needsConfirmation: risk !== 'LOW',
    acts: ACTION_TOOLS.has(parsed.tool),
    confidence: parsed.confidence,
    instruction,
  });
});

function keywordPlan(instruction) {
  const t = (instruction || '').toLowerCase();
  if (/delete account|امسح حساب|purchase|pay|ادفع/.test(t)) {
    return { tool: 'purchase', input: {}, preview: 'HIGH-RISK action — explicit confirmation required' };
  }
  if (/post|publish|انشر|شير|نزل بوست/.test(t)) {
    const text = instruction.replace(/^(انشر|نزل|شير|publish|post)\s*(بوست)?\s*:?\s*/i, '').trim();
    return { tool: 'publish', input: { text }, preview: `Publish post: "${text.slice(0, 80)}"` };
  }
  if (/follow|تابع/.test(t)) {
    const u = (instruction.match(/@?([a-z0-9._]{3,30})/i) || [])[1] || '';
    return { tool: 'follow', input: { username: u }, preview: `Follow @${u}` };
  }
  if (/bio|بايو|عدل|الحساب/.test(t)) {
    return { tool: 'edit_profile', input: {}, preview: 'Edit profile' };
  }
  return { tool: 'none', input: {}, preview: 'Plain chat — no action' };
}

router.post('/agent/execute', requireAuth, async (req, res) => {
  const meRows = await db.q('SELECT * FROM users WHERE id=$1', [req.user.id]);
  const me = db.userRow(meRows[0]);
  if (!me?.gold) return res.status(403).json({ error: 'gold_required' });
  const { tool, input, confirmed } = req.body || {};
  if (!IMPLEMENTED.has(tool)) return res.status(400).json({ error: 'tool_not_supported', tool });
  const risk = LOW.has(tool) ? 'LOW' : MEDIUM.has(tool) ? 'MEDIUM' : 'HIGH';
  if (risk !== 'LOW' && !confirmed) return res.status(428).json({ error: 'confirmation_required', risk });
  let result = { ok: true };
  if (tool === 'publish' && input?.text) {
    const id = 'p-' + db.uuid().slice(0, 6);
    await db.q(
      `INSERT INTO posts (id, author_id, type, text, hashtags, media, ai_generated)
       VALUES ($1,$2,'TEXT',$3,$4,'[]',TRUE)`,
      [id, me.id, String(input.text).slice(0, 2000), JSON.stringify(input.hashtags || [])]
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
    await db.q('UPDATE users SET bio=$1 WHERE id=$2', [String(input.bio).slice(0, 500), me.id]);
    result = { bio: input.bio };
  }
  await db.notify(me.id, { category: 'ai', title: 'Agent task completed', body: `${tool} done` });
  await db.auditLog(me.username, 'agent_execute', tool);
  res.json({ result, risk, audited: true });
});

module.exports = router;
