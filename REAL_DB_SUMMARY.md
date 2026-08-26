# ملخص قاعدة البيانات الحقيقية - ZIVV

## ✅ تم عمله

### 1. بنية قاعدة بيانات حقيقية
- **Supabase Postgres**: 19 جدول مع foreign keys, indexes, triggers
- **SQLite local**: نفس المخطط باستخدام node:sqlite (Node 22)
- **Fallback JSON**: لو مفيش sqlite

### 2. ملفات جديدة
- `lib/config.js` - إدارة الإعدادات
- `lib/supabase.js` - عميل Supabase حقيقي (tables مش JSON blob)
- `lib/sqlite.js` - عميل SQLite حقيقي
- `lib/database.js` - واجهة موحدة
- `lib/auth.js` - تشفير bcrypt
- `lib/store.js` - أعيد كتابته لاستخدام DB الحقيقية
- `sql/zivv-v2.sql` - مخطط كامل مع AI tables
- `api/ai.js` - proxy ذكاء مع logging
- `scripts/` - init, migrate, seed

### 3. تحديث API
- `api/[...path].js` - يستخدم جداول حقيقية
- `api/health.js` - يبلغ mode
- `api/upload.js` - تخزين حقيقي
- endpoints جديدة: `/api/auth/login`, `/api/auth/register`, `/api/ai-chats`, `/api/ai-messages`

### 4. تحديث الواجهة
- `js/db.js` - v2 مع دعم real-db mode و AI persistence
- `js/ai-chat.js` - يحفظ في DB الحقيقية
- `index.html` - دخول سريع بالبريد + كلمة مرور (bcrypt) مع fallback قديم

### 5. أمان
- bcrypt hashing (10 rounds)
- validation
- sanitization

## كيفية الاستخدام

```bash
# Local
npm install
npm run db:init   # يفحص الاتصال
npm run db:seed   # حساب demo
npm run dev       # http://localhost:8787

# Supabase
# 1. شغل sql/zivv-v2.sql في SQL Editor
# 2. Deploy
```

## الفرق

قبل: ملف JSON واحد + localStorage + plain passwords
الآن: Postgres حقيقي + SQLite لوكال + bcrypt + AI persistence + triggers + indexes

## حساب تجريبي
demo@zivv.app / demo123 (بعد npm run db:seed)
