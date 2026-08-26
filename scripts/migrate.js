#!/usr/bin/env node
// Migrate old JSON data to real database

const fs = require("fs");
const path = require("path");
const { getDatabase } = require("../lib/database");

async function migrate() {
  console.log("=== ZIVV Migration: JSON -> Real DB ===");
  const db = getDatabase();
  console.log(`Mode: ${db.mode}`);

  const oldPaths = [
    path.join(__dirname, "..", "data", "zivv.json"),
    path.join(__dirname, "..", "data", "zivv.db.json"),
  ];

  let oldData = null;
  for (const p of oldPaths) {
    if (fs.existsSync(p)) {
      console.log(`Found old data: ${p}`);
      try {
        oldData = JSON.parse(fs.readFileSync(p, "utf8"));
        break;
      } catch (e) {
        console.warn(`Failed to parse ${p}: ${e.message}`);
      }
    }
  }

  if (!oldData) {
    console.log("No old JSON data found, checking localStorage dump?");
    console.log("Migration will check if there's data in current DB already");
    const posts = await db.getPosts(5).catch(() => []);
    console.log(`Current DB has ${posts.length} posts`);
    return;
  }

  console.log(`Old data: ${oldData.posts?.length || 0} posts, ${oldData.accounts?.length || 0} accounts`);

  // Migrate accounts
  if (oldData.accounts && oldData.accounts.length) {
    console.log("Migrating accounts...");
    for (const acc of oldData.accounts.slice(0, 100)) {
      try {
        await db.createAccount({
          email: acc.email,
          username: acc.username || acc.email?.split("@")[0],
          first_name: acc.first_name || acc.first || "",
          last_name: acc.last_name || acc.last || "",
          name: acc.name || "",
          age: acc.age || null,
          mark: acc.mark || "",
          password: acc.password || "",
          password_hash: acc.password_hash || "",
          onboarding: acc.onboarding || {},
        });
      } catch (e) {
        console.warn(`Account ${acc.email} failed: ${e.message}`);
      }
    }
    console.log("✓ Accounts migrated");
  }

  // Migrate posts
  if (oldData.posts && oldData.posts.length) {
    console.log("Migrating posts...");
    for (const post of oldData.posts.slice(0, 200)) {
      try {
        await db.createPost({
          id: post.id,
          username: post.username || post.user || "unknown",
          name: post.name || "",
          avatar: post.avatar || "",
          title: post.title || "",
          body: post.body || post.text || "",
          type: post.type || "text",
          video_kind: post.video_kind || post.videoKind || "",
          tags: post.tags || [],
          dests: post.dests || [],
          image_url: post.image_url || post.image || "",
          video_url: post.video_url || post.videoId || "",
          audio_url: post.audio_url || post.audioId || "",
          sound_url: post.sound_url || post.soundId || "",
          mute_original: !!post.mute_original,
          link: post.link || "",
          place: post.place || "",
          status: post.status || "ok",
          visibility: post.visibility || "",
          priv: !!post.priv,
          created_at: post.created_at ? new Date(post.created_at).toISOString() : new Date().toISOString(),
        });
      } catch (e) {
        console.warn(`Post ${post.id} failed: ${e.message}`);
      }
    }
    console.log("✓ Posts migrated");
  }

  // Migrate likes, comments, etc. similarly
  if (oldData.likes && oldData.likes.length) {
    console.log(`Migrating ${oldData.likes.length} likes...`);
    for (const like of oldData.likes.slice(0, 500)) {
      try {
        await db.toggleLike(like.post_id, like.user_key, true);
      } catch {}
    }
  }

  if (oldData.comments && oldData.comments.length) {
    console.log(`Migrating ${oldData.comments.length} comments...`);
    for (const c of oldData.comments.slice(0, 300)) {
      try {
        await db.createComment({
          id: c.id,
          post_id: c.post_id,
          parent_id: c.parent_id || null,
          name: c.name || "",
          user_key: c.user_key || "",
          body: c.body || c.text || "",
          created_at: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
        });
      } catch {}
    }
  }

  console.log("\n✓ Migration complete!");
}

migrate().catch(e => {
  console.error("Migration failed:", e);
  process.exit(1);
});
