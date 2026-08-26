#!/usr/bin/env node
// Initialize real database - works with both Supabase and SQLite

const fs = require("fs");
const path = require("path");
const { getConfig } = require("../lib/config");

async function initSupabase() {
  const cfg = getConfig();
  console.log(`[INIT] Mode: ${cfg.mode}`);
  console.log(`[INIT] Supabase URL: ${cfg.supabase.url}`);

  if (cfg.hasSupabase) {
    console.log("[INIT] Checking Supabase connection...");
    try {
      const url = `${cfg.supabase.url}/rest/v1/posts?select=id&limit=1`;
      const res = await fetch(url, {
        headers: { apikey: cfg.supabase.secret, Authorization: `Bearer ${cfg.supabase.secret}` },
      });
      if (res.ok) {
        console.log("[INIT] ✓ Supabase connected, tables exist");
        return true;
      } else {
        const text = await res.text();
        console.log(`[INIT] Supabase response ${res.status}: ${text.slice(0, 300)}`);
        if (res.status === 404 || text.includes("PGRST205") || text.includes("Could not find")) {
          console.log("[INIT] Tables don't exist, you need to run sql/zivv-v2.sql in Supabase SQL Editor");
          console.log(`[INIT] SQL file: ${path.join(__dirname, "..", "sql", "zivv-v2.sql")}`);
        }
        return false;
      }
    } catch (e) {
      console.error("[INIT] Supabase connection failed:", e.message);
      return false;
    }
  } else {
    console.log("[INIT] No Supabase config, initializing SQLite...");
    const { getDatabase } = require("../lib/database");
    const db = getDatabase();
    console.log(`[INIT] SQLite path: ${cfg.sqlite.path}`);
    // Trigger creation
    await db.getPosts(1).catch(() => []);
    console.log("[INIT] ✓ SQLite initialized");
    return true;
  }
}

async function main() {
  console.log("=== ZIVV Real Database Init ===");
  const ok = await initSupabase();
  if (ok) {
    console.log("\n✓ Database ready!");
    console.log("Next steps:");
    console.log("1. If Supabase: run sql/zivv-v2.sql in Supabase SQL Editor");
    console.log("2. npm run dev to start server");
  } else {
    console.log("\n⚠ Database needs setup");
    console.log("Run sql/zivv-v2.sql in Supabase Dashboard > SQL Editor");
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
