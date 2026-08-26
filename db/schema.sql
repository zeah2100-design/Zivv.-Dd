-- ZIVV Real Database Schema for SQLite (local dev)
-- This is auto-created by lib/sqlite.js but kept here for reference
-- For Supabase production, use sql/zivv-v2.sql

CREATE TABLE IF NOT EXISTS accounts (
  email TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  name TEXT,
  age INTEGER,
  mark TEXT,
  password TEXT,
  password_hash TEXT,
  onboarding TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  auth_id TEXT UNIQUE,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  name TEXT,
  avatar TEXT,
  cover TEXT,
  bio TEXT,
  city TEXT,
  age INTEGER,
  locked INTEGER DEFAULT 0,
  onboarding TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  profile_id TEXT,
  username TEXT,
  name TEXT,
  avatar TEXT,
  title TEXT,
  body TEXT,
  type TEXT DEFAULT 'text',
  video_kind TEXT,
  tags TEXT,
  dests TEXT,
  image_url TEXT,
  video_url TEXT,
  audio_url TEXT,
  sound_url TEXT,
  mute_original INTEGER DEFAULT 0,
  link TEXT,
  place TEXT,
  status TEXT DEFAULT 'ok',
  visibility TEXT,
  priv INTEGER DEFAULT 0,
  extra TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')*1000)
);

CREATE TABLE IF NOT EXISTS likes (
  post_id TEXT NOT NULL,
  user_key TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now')*1000),
  PRIMARY KEY (post_id, user_key)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  parent_id TEXT,
  name TEXT,
  user_key TEXT,
  body TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now')*1000)
);

CREATE TABLE IF NOT EXISTS follows (
  follower TEXT NOT NULL,
  following TEXT NOT NULL,
  from_user TEXT,
  to_user TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')*1000),
  PRIMARY KEY (follower, following)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_user TEXT NOT NULL,
  from_key TEXT,
  from_user TEXT,
  name TEXT,
  kind TEXT DEFAULT 'text',
  body TEXT,
  post_id TEXT,
  product_id TEXT,
  image_url TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')*1000)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  price REAL DEFAULT 0,
  cat TEXT,
  seller TEXT,
  seller_user TEXT,
  phone TEXT,
  image_url TEXT,
  description TEXT,
  specs TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')*1000)
);

CREATE TABLE IF NOT EXISTS ai_chats (
  id TEXT PRIMARY KEY,
  user_key TEXT NOT NULL,
  title TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')*1000),
  updated_at INTEGER DEFAULT (strftime('%s','now')*1000)
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  sources TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')*1000)
);
