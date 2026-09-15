#!/usr/bin/env node
// One-time import: data/zivv.json -> real SQLite file (after switching to better-sqlite3)
const fs = require("fs");
const path = require("path");
const { getDatabase } = require("../lib/database");

(async () => {
  const jp = path.join(__dirname, "..", "data", "zivv.json");
  if (!fs.existsSync(jp)) { console.log("no json file, nothing to import"); return; }
  const data = JSON.parse(fs.readFileSync(jp, "utf8"));
  const db = getDatabase();
  console.log("mode:", db.mode);
  const counts = {};
  const step = async (name, arr, fn) => {
    let n = 0;
    for (const row of (arr || [])) { try { await fn(row); n++; } catch (e) { console.log(`skip ${name}:`, e.message.slice(0, 120)); } }
    counts[name] = n;
  };
  await step("accounts", data.accounts, (r) => db.createAccount(r));
  await step("profiles", data.profiles, (r) => db.upsertProfile(r));
  await step("posts", data.posts, (r) => db.createPost(r));
  await step("likes", data.likes, (r) => db.toggleLike(r.post_id, r.user_key, true));
  await step("comments", data.comments, (r) => db.createComment(r));
  await step("messages", data.messages, (r) => db.createMessage(r));
  await step("products", data.products, (r) => db.createProduct(r));
  await step("stories", data.stories, (r) => db.createStory(r));
  await step("friend_reqs", data.friend_reqs || data.friendReqs, (r) => db.createFriendReq(r));
  await step("notes", data.notes, (r) => db.createNote(r));
  await step("gold_reqs", data.gold_reqs || data.goldReqs, (r) => db.createGoldReq(r));
  await step("reports", data.reports, (r) => db.createReport(r));
  await step("ai_chats", data.ai_chats, (r) => db.upsertAiChat(r));
  await step("ai_messages", data.ai_messages, (r) => db.createAiMessage(r));
  await step("ai_usage", data.ai_usage, (r) => db.upsertAiUsage(r));
  await step("follows", data.follows, (r) => db.toggleFollow(r.follower || r.from_user, r.following || r.to_user, true));
  console.log("imported:", counts);
  try { fs.renameSync(jp, jp + ".bak"); console.log("renamed zivv.json -> zivv.json.bak"); } catch {}
})().catch(e => { console.error(e); process.exit(1); });
