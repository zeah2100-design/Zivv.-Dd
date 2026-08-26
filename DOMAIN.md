# دومين ZIVV من GitHub - طلب الدومين

## الدومين الحالي من GitHub Pages (مجاني 100%)

بعد ما فعلنا GitHub Pages، الموقع هيبقى متاح على:

### 1. دومين GitHub الافتراضي (مجاني)
```
https://zeah2100-design.github.io/Zivv.-Dd/
```
ده شغال تلقائي بعد ما تعمل Enable Pages في الإعدادات.

### 2. دومين مخصص (لو عندك)
لو شاري دومين مثل `zivv.app`:
1. روح `Settings > Pages` في GitHub
2. حط الدومين في `Custom domain`
3. اعمل CNAME record عند شركة الدومين:
   ```
   Type: CNAME
   Name: @ أو www
   Value: zeah2100-design.github.io
   ```
4. فعل `Enforce HTTPS`

---

## كيفية تفعيل GitHub Pages (خطوة بخطوة)

### من GitHub Website:
1. افتح https://github.com/zeah2100-design/Zivv.-Dd/settings/pages
2. في `Build and deployment`:
   - Source: `GitHub Actions` (احنا عملنا workflow)
   - أو `Deploy from a branch` -> Branch: `main` -> `/ (root)`
3. احفظ - بعد دقيقة هيظهر لينك الموقع

### الدومين هيشتغل بقاعدة بيانات حقيقية!
حتى على GitHub Pages (static فقط)، الموقع بيستخدم:
- **Supabase مباشر**: `js/supabase-config.js` فيه URL و anon key
- `js/db.js` بيجرب `/api/health` الأول، لو فشل (GitHub Pages مفيهوش API) بيحول تلقائي لـ Supabase REST
- كل البيانات (posts, accounts, likes, etc) من Supabase Postgres الحقيقي
- الصور من Supabase Storage `zivv-media` bucket

يعني **موقع تواصل اجتماعي كامل شغال على دومين GitHub مجاني + قاعدة بيانات حقيقية**!

---

## لو عايز دومين Vercel (أفضل للـ API)

Vercel بيدعم Node API (اللي عملناه) فهو أفضل:

1. روح https://vercel.com
2. Import من GitHub: `zeah2100-design/Zivv.-Dd`
3. حط Environment Variables:
   ```
   SUPABASE_URL=https://ldionpdfplvbnpoelkqe.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_... (من Supabase Dashboard > API)
   USE_SUPABASE=true
   ```
4. Deploy - هيديك دومين مجاني:
   ```
   https://zivv-dd.vercel.app
   ```
5. لو عندك دومين مخصص، ضيفه في Vercel Settings > Domains

Vercel أفضل لأنه بيشغل `api/[...path].js` اللي عملناه بقاعدة البيانات الحقيقية.

---

## مقارنة

| الميزة | GitHub Pages | Vercel |
|--------|-------------|--------|
| دومين مجاني | ✅ `github.io` | ✅ `vercel.app` |
| دومين مخصص | ✅ | ✅ |
| HTTPS | ✅ | ✅ |
| API Node.js | ❌ (يستخدم Supabase مباشر) | ✅ (api/ حقيقي) |
| قاعدة بيانات حقيقية | ✅ Supabase مباشر | ✅ Supabase + SQLite |
| سرعة | سريع | أسرع + Edge |
| مجاني | 100% مجاني | مجاني بحدود |

**التوصية**: استخدم **Vercel** للإنتاج الكامل، و **GitHub Pages** كنسخة احتياطية مجانية.

---

## الدومين الحالي

- GitHub: `https://zeah2100-design.github.io/Zivv.-Dd/` (بعد التفعيل)
- Vercel: `https://zivv-dd.vercel.app` (بعد الـ import)
- مخصص: تقدر تربط `zivv.app` أو أي دومين

كلهم بقاعدة بيانات حقيقية 100% ✅
