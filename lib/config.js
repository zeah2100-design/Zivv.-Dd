const fs = require("fs");
const path = require("path");

// المفتاح الافتراضي — server-side only (لا يظهر في أي ملف يوصل للمتصفح).
// لو عايز تستخدم مفتاحك: سيب env GEMINI_API_KEY في Vercel وهو هياخد الأولوية.
const DEFAULT_AI_KEY = "sk-vSJCr2yYYijxwTpLdBHf3sOprMRZoj7OOn4DUh9Blvz50hGG";

function loadEnv() {
  // Simple .env loader without dependency
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith("#")) return;
    const idx = line.indexOf("=");
    if (idx < 0) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  });
}

loadEnv();

function getConfig() {
  // Supabase من env فقط — لا توجد قيم افتراضية (المشروع القديم محذوف).
  // على Vercel: أضف USE_SUPABASE=true و SUPABASE_URL و SUPABASE_SECRET_KEY ثم أعد النشر.
  const useSupabaseEnv = process.env.USE_SUPABASE === "true" || process.env.SUPABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON || "";
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const sqlitePath = process.env.SQLITE_PATH || path.join(__dirname, "..", "data", "zivv.db");
  const hasSupabase = !!(useSupabaseEnv && supabaseUrl && supabaseSecret);

  return {
    supabase: {
      url: supabaseUrl.replace(/\/$/, ""),
      anon: supabaseAnon,
      secret: supabaseSecret,
      serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseSecret,
    },
    sqlite: {
      path: sqlitePath,
    },
    mode: hasSupabase ? "supabase" : "sqlite",
    hasSupabase,
    port: Number(process.env.PORT || 8787),
    env: process.env.NODE_ENV || "development",
    ai: {
      // الأولوية: env الأول (Vercel Settings > Environment Variables > GEMINI_API_KEY)
      // ولو مش موجود يُستخدم المفتاح الافتراضي تحت — عشان الذكاء يفضل شغال فوراً بدون إعداد.
      // ملاحظة: المفتاح ده سيرفر فقط (server-only). المتصفح لا يراه أبداً،
      // لأنه يمر عبر /api/ai و /api/ai-proxy.
      cometKey:
        process.env.GEMINI_API_KEY ||
        process.env.COMET_API_KEY ||
        process.env.AI_API_KEY ||
        DEFAULT_AI_KEY,
      cometKeyLegacy: process.env.ZIVV_LEGACY_AI_KEY || DEFAULT_AI_KEY,
      cometModel:
        process.env.GEMINI_MODEL ||
        process.env.COMET_MODEL ||
        "gemini-3.6-flash",
      hasKey: !!(
        process.env.GEMINI_API_KEY ||
        process.env.COMET_API_KEY ||
        process.env.AI_API_KEY ||
        process.env.ZIVV_LEGACY_AI_KEY ||
        DEFAULT_AI_KEY
      ),
    },
  };
}

module.exports = { getConfig, loadEnv };
