# ZIVV - Real Database Edition 🚀

## قاعدة البيانات الحقيقية - تم ✅

الموقع الآن يعمل بقاعدة بيانات حقيقية بدلاً من localStorage و JSON:

- **Production**: Supabase Postgres (19 جدول) مع bcrypt و foreign keys و triggers
- **Local**: SQLite (Node 22 built-in) في `data/zivv.db` - يشتغل تلقائي بدون إعداد
- **AI**: محادثات زيفي محفوظة في `ai_chats` و `ai_messages`

### التشغيل السريع

```bash
npm install
npm run db:init   # يفحص قاعدة البيانات
npm run db:seed   # حساب تجريبي demo@zivv.app / demo123
npm run dev       # http://localhost:8787
```

### Supabase Production Setup

1. افتح Supabase Dashboard > SQL Editor
2. شغل `sql/zivv-v2.sql` (المخطط الجديد الكامل)
3. اضبط env vars في Vercel:
   ```
   SUPABASE_URL=https://ldionpdfplvbnpoelkqe.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_...
   USE_SUPABASE=true
   ```
4. Deploy

### الملفات الجديدة

- `lib/database.js` - واجهة موحدة (Supabase | SQLite)
- `lib/supabase.js` - عميل Supabase بجداول حقيقية
- `lib/sqlite.js` - عميل SQLite حقيقي
- `lib/auth.js` - تشفير bcrypt
- `sql/zivv-v2.sql` - مخطط الإنتاج مع AI tables
- `api/[...path].js` - أعيد كتابته لجداول حقيقية
- `api/ai.js` - AI proxy مع usage logging
- `js/db.js` - v2 يدعم real-db mode
- `scripts/` - init, migrate, seed

### الفرق

| قبل | الآن |
|-----|------|
| JSON file واحد في Storage | 19 جدول Postgres |
| password plain text | bcrypt hash |
| AI chats localStorage فقط | محفوظة في DB |
| لا indexes | indexes + triggers |

### الصفحات

- `index.html` - تسجيل دخول حقيقي (بريد+باسورد مشفر)
- `home.html` - الفيد + نشر
- `ai.html` - دردشة زيفي مع حفظ حقيقي
- `chat.html` - الدردشة
- `store.html` - المتجر
- `explore.html`, `reels.html`, `music.html`, etc

### حساب تجريبي

بعد `npm run db:seed`:
- Email: demo@zivv.app
- Password: demo123

### تفاصيل أكثر

شوف `README_DB.md` و `REAL_DB_SUMMARY.md`
# ZIVV v3.1 - Force redeploy Thu Aug 27 13:06:41 UTC 2026
