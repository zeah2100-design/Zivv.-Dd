# ZIVV Real Database - قاعدة البيانات الحقيقية

تم تحويل الموقع من localStorage و JSON file إلى قاعدة بيانات حقيقية 🎉

## الوضع الجديد

### 1. Production (Supabase Postgres)
- **URL**: https://ldionpdfplvbnpoelkqe.supabase.co
- **Tables**: 19 جدول حقيقي (posts, accounts, profiles, likes, comments, ai_chats, ai_messages, etc)
- **Auth**: bcrypt hashing بدلاً من plain text
- **Storage**: Supabase Storage bucket `zivv-media` للصور والفيديوهات
- **Features**:
  - Foreign keys و indexes
  - Triggers لتحديث counters (likes_count, comments_count)
  - RLS policies
  - AI chats persistence

### 2. Local Development (SQLite)
- **Path**: `data/zivv.db` (auto-created)
- **Engine**: Node.js built-in `node:sqlite` (Node 22+)
- **Fallback**: JSON file if sqlite not available
- **No setup needed**: يشتغل تلقائي لو مفيش Supabase env

## الملفات الجديدة

```
lib/
  config.js       - تحميل env وتحديد mode
  database.js     - واجهة موحدة (Supabase | SQLite)
  supabase.js     - Supabase REST client (real tables)
  sqlite.js       - SQLite local client (real file DB)
  auth.js         - bcrypt hashing
  store.js        - rewritten to use real DB (backward compat)

sql/
  zivv.sql        - القديم
  zivv-v2.sql     - الجديد الحقيقي مع AI tables

db/
  schema.sql      - SQLite schema reference

api/
  [...path].js    - rewritten: uses real DB tables, not JSON blob
  health.js       - reports real DB mode
  upload.js       - uses real DB upload (Supabase Storage or local /uploads)
  ai.js           - AI proxy with usage logging

scripts/
  init-db.js      - يفحص الاتصال ويقولك لو محتاج تشغل SQL
  migrate.js      - ينقل من zivv.json القديم للجدول الحقيقي
  seed.js         - ينشئ حساب demo ومنشورات تجريبية

js/
  db.js           - v2: supports real-db mode, AI chat persistence
  ai-chat.js      - updated: يحفظ في قاعدة البيانات الحقيقية

.env.example      - مثال للإعدادات
```

## كيفية التشغيل

### Local (بدون Supabase)
```bash
npm install
npm run dev
# هيستخدم SQLite تلقائي في data/zivv.db
# افتح http://localhost:8787
```

### Production (Supabase)
1. روح Supabase Dashboard > SQL Editor
2. شغل `sql/zivv-v2.sql`
3. تأكد من env vars:
   ```
   SUPABASE_URL=https://ldionpdfplvbnpoelkqe.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_...
   ```
4. Deploy على Vercel

### Migration من البيانات القديمة
```bash
npm run db:migrate
```

### Seed بيانات تجريبية
```bash
npm run db:seed
# حساب: demo@zivv.app / demo123
```

## الجداول الجديدة

- `ai_chats` - محادثات زيفي
- `ai_messages` - رسائل كل محادثة
- `ai_usage` - استهلاك يومي (chats, images, tokens)
- `sessions` - جلسات تسجيل الدخول

## الأمان

- كلمات المرور مشفرة بـ bcrypt (10 rounds)
- يدعم كلمات مرور قديمة plain text للتوافق (migration)
- RLS policies (حالياً مفتوحة للـ anon مع service key، تقدر تضيقها)
- Validation على البريد واسم المستخدم

## API الجديدة

```
GET  /api/health          - real DB info
POST /api/auth/login      - email+password (bcrypt)
POST /api/auth/register   - create account with hash
GET  /api/ai-chats?user=  - AI chats
POST /api/ai-chats        - create chat
GET  /api/ai-messages?chat_id=
POST /api/ai-messages
POST /api/upload          - real storage
```

كل الـ endpoints القديمة (posts, likes, comments, etc) شغالة بنفس الواجهة لكن وراها جداول حقيقية.

## الفرق عن قبل

| قبل | الآن |
|-----|------|
| ملف JSON واحد في Storage | 19 جدول Postgres |
| password plain text | bcrypt hash |
| AI chats في localStorage فقط | محفوظة في DB |
| لا يوجد indexes | indexes + triggers |
| لا يوجد foreign keys | FK + cascade |
| upload base64 في JSON | Supabase Storage /uploads |

## ملاحظات

- لو شغال لوكال بدون .env، هيستخدم SQLite
- لو حطيت SUPABASE_URL و SECRET، هيستخدم Supabase تلقائي
- الـ client (js/db.js) بيتعرف على mode ويظهر badge
- الصور الكبيرة base64 بتتقلص قبل الرفع

Enjoy real DB! 🚀
