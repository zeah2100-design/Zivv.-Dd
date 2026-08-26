#!/usr/bin/env node
// Seed database with demo data

const { getDatabase } = require("../lib/database");
const { hashPassword } = require("../lib/auth");

async function seed() {
  console.log("=== ZIVV Seed Real DB ===");
  const db = getDatabase();
  console.log(`Mode: ${db.mode}`);

  // Create demo account
  const demoEmail = "demo@zivv.app";
  const existing = await db.getAccountByEmail(demoEmail).catch(() => null);
  if (!existing) {
    const hash = await hashPassword("demo123");
    await db.createAccount({
      email: demoEmail,
      username: "demo",
      first_name: "Demo",
      last_name: "User",
      name: "Demo User",
      age: 25,
      mark: "demo",
      password_hash: hash,
      onboarding: { city: "القاهرة", bio: "حساب تجريبي" },
    });
    await db.upsertProfile({
      email: demoEmail,
      username: "demo",
      name: "Demo User",
      avatar: "brand/logo-sm.png",
      city: "القاهرة",
      bio: "حساب تجريبي لـ ZIVV",
    });
    console.log("✓ Demo account created: demo@zivv.app / demo123");
  } else {
    console.log("Demo account exists");
  }

  // Create demo posts
  const posts = await db.getPosts(1).catch(() => []);
  if (posts.length === 0) {
    console.log("Creating demo posts...");
    const demoPosts = [
      {
        id: "p_demo_1",
        username: "demo",
        name: "Demo User",
        avatar: "brand/logo-sm.png",
        title: "أهلاً بيكم في ZIVV بقاعدة بيانات حقيقية! 🎉",
        body: "دلوقتي الموقع شغال بقاعدة بيانات حقيقية - Supabase Postgres في الإنتاج و SQLite لوكال. كل البيانات محفوظة بأمان!",
        type: "text",
        tags: ["zivv", "قاعدة_بيانات", "تطوير"],
        dests: ["home", "explore"],
        status: "ok",
        created_at: new Date().toISOString(),
      },
      {
        id: "p_demo_2",
        username: "demo",
        name: "Demo User",
        avatar: "brand/logo-sm.png",
        title: "الذكاء الاصطناعي زيفي",
        body: "زيفي دلوقتي بيحفظ المحادثات في قاعدة البيانات الحقيقية. كل محادثة محفوظة ومرتبطة بحسابك.",
        type: "text",
        tags: ["ai", "زيفي", "ذكاء_اصطناعي"],
        dests: ["home", "explore"],
        status: "ok",
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ];

    for (const p of demoPosts) {
      await db.createPost(p);
    }
    console.log("✓ Demo posts created");
  }

  console.log("\n✓ Seed complete!");
  const finalPosts = await db.getPosts(5);
  console.log(`Total posts: ${finalPosts.length}`);
}

seed().catch(e => {
  console.error(e);
  process.exit(1);
});
