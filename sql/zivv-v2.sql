-- ZIVV Real Database Schema v2 - Production Ready
-- شغّل الملف ده في Supabase SQL Editor
-- يدعم كل مزايا الموقع + AI Chat persistence

-- Enable extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ==================== ACCOUNTS ====================
create table if not exists public.accounts (
  email text primary key,
  username text unique not null,
  first_name text,
  last_name text,
  name text,
  age int check (age >= 13 and age <= 120),
  mark text,
  password text, -- kept for backward compat
  password_hash text, -- bcrypt hash - real security
  onboarding jsonb default '{}'::jsonb,
  is_verified boolean default false,
  is_banned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ==================== PROFILES ====================
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique,
  email text unique,
  username text unique not null,
  name text not null,
  avatar text,
  cover text,
  bio text,
  city text,
  age int,
  locked boolean default false,
  is_gold boolean default false,
  gold_until timestamptz,
  points int default 0,
  onboarding jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ==================== POSTS ====================
create table if not exists public.posts (
  id text primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  username text not null,
  name text,
  avatar text,
  title text,
  body text,
  type text default 'text' check (type in ('text','photo','video','audio','product','link')),
  video_kind text check (video_kind in ('short','video','')),
  tags text[] default '{}',
  dests text[] default '{}',
  image_url text,
  video_url text,
  audio_url text,
  sound_url text,
  mute_original boolean default false,
  link text,
  place text,
  status text default 'ok' check (status in ('ok','warned','removed','pending')),
  visibility text default 'public' check (visibility in ('public','friends','private','')),
  priv boolean default false,
  likes_count int default 0,
  comments_count int default 0,
  shares_count int default 0,
  views_count int default 0,
  extra jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ==================== LIKES ====================
create table if not exists public.likes (
  post_id text not null references public.posts(id) on delete cascade,
  user_key text not null,
  created_at timestamptz default now(),
  primary key (post_id, user_key)
);

-- ==================== COMMENTS ====================
create table if not exists public.comments (
  id text primary key,
  post_id text not null references public.posts(id) on delete cascade,
  parent_id text references public.comments(id) on delete cascade,
  name text,
  user_key text not null,
  body text not null,
  likes_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ==================== COMMENT LIKES ====================
create table if not exists public.comment_likes (
  comment_id text not null references public.comments(id) on delete cascade,
  user_key text not null,
  created_at timestamptz default now(),
  primary key (comment_id, user_key)
);

-- ==================== FOLLOWS ====================
create table if not exists public.follows (
  follower text not null,
  following text not null,
  created_at timestamptz default now(),
  primary key (follower, following)
);

-- ==================== SHARES ====================
create table if not exists public.shares (
  id text primary key,
  post_id text references public.posts(id) on delete set null,
  from_key text,
  from_name text,
  to_user text,
  preview text,
  created_at timestamptz default now()
);

-- ==================== MESSAGES ====================
create table if not exists public.messages (
  id text primary key,
  thread_user text not null,
  from_key text,
  from_user text,
  name text,
  kind text default 'text' check (kind in ('text','image','video','audio','share','product','system')),
  body text,
  post_id text references public.posts(id) on delete set null,
  product_id text,
  image_url text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ==================== PRODUCTS ====================
create table if not exists public.products (
  id text primary key,
  title text not null,
  price numeric default 0 check (price >= 0),
  cat text,
  seller text,
  seller_user text,
  phone text,
  image_url text,
  description text,
  specs text[] default '{}',
  is_real boolean default true,
  is_approved boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ==================== REPORTS ====================
create table if not exists public.reports (
  id text primary key,
  post_id text references public.posts(id) on delete set null,
  target_user text,
  type text check (type in ('post','account','product','spam','abuse','gold','account-block')),
  dest text default 'king',
  reporter_name text,
  reporter_email text,
  note text,
  status text default 'pending' check (status in ('pending','reviewed','resolved','rejected')),
  created_at timestamptz default now()
);

-- ==================== STORIES ====================
create table if not exists public.stories (
  id text primary key,
  username text not null,
  name text,
  avatar text,
  kind text check (kind in ('text','image','video')),
  body text,
  image_url text,
  video_url text,
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

-- ==================== FRIEND REQUESTS ====================
create table if not exists public.friend_reqs (
  id text primary key,
  from_user text not null,
  from_name text,
  to_user text not null,
  to_name text,
  status text default 'pending' check (status in ('pending','accepted','rejected','blocked')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ==================== NOTES / NOTIFICATIONS ====================
create table if not exists public.notes (
  id text primary key,
  dest text not null,
  type text check (type in ('official','post','message','friend','gold','system','like','comment','follow')),
  title text,
  body text,
  from_user text,
  from_name text,
  avatar text,
  href text,
  post_id text references public.posts(id) on delete set null,
  unread boolean default true,
  created_at timestamptz default now()
);

-- ==================== GOLD REQUESTS ====================
create table if not exists public.gold_reqs (
  id text primary key,
  username text not null,
  name text,
  status text default 'pending' check (status in ('pending','accepted','rejected','expired')),
  note text,
  until timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ==================== AI CHATS - NEW REAL TABLES ====================
create table if not exists public.ai_chats (
  id text primary key,
  user_key text not null,
  title text default 'دردشة جديدة',
  model text default 'gemini-3.6-flash',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ai_messages (
  id text primary key,
  chat_id text not null references public.ai_chats(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  image_url text,
  sources jsonb default '[]'::jsonb,
  tokens_used int default 0,
  created_at timestamptz default now()
);

create table if not exists public.ai_usage (
  user_key text not null,
  day text not null, -- YYYY-MM-DD
  chats_count int default 0,
  images_count int default 0,
  tokens_used int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_key, day)
);

-- ==================== SESSIONS ====================
create table if not exists public.sessions (
  id text primary key,
  user_email text not null references public.accounts(email) on delete cascade,
  token text unique not null,
  ip text,
  user_agent text,
  expires_at timestamptz default (now() + interval '30 days'),
  created_at timestamptz default now()
);

-- ==================== INDEXES ====================
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_username_idx on public.posts (username);
create index if not exists posts_type_idx on public.posts (type);
create index if not exists posts_status_idx on public.posts (status);
create index if not exists comments_post_idx on public.comments (post_id, created_at);
create index if not exists likes_post_idx on public.likes (post_id);
create index if not exists likes_user_idx on public.likes (user_key);
create index if not exists messages_thread_idx on public.messages (thread_user, created_at);
create index if not exists messages_from_idx on public.messages (from_user);
create index if not exists products_seller_idx on public.products (seller_user);
create index if not exists accounts_mark_idx on public.accounts (mark);
create index if not exists accounts_username_idx on public.accounts (username);
create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists notes_dest_idx on public.notes (dest, created_at desc);
create index if not exists notes_unread_idx on public.notes (dest, unread) where unread = true;
create index if not exists stories_expires_idx on public.stories (expires_at);
create index if not exists ai_chats_user_idx on public.ai_chats (user_key, updated_at desc);
create index if not exists ai_messages_chat_idx on public.ai_messages (chat_id, created_at);
create index if not exists ai_usage_user_day_idx on public.ai_usage (user_key, day);

-- ==================== FUNCTIONS ====================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
drop trigger if exists trg_accounts_updated on public.accounts;
create trigger trg_accounts_updated before update on public.accounts for each row execute function public.update_updated_at();

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.update_updated_at();

drop trigger if exists trg_posts_updated on public.posts;
create trigger trg_posts_updated before update on public.posts for each row execute function public.update_updated_at();

drop trigger if exists trg_ai_chats_updated on public.ai_chats;
create trigger trg_ai_chats_updated before update on public.ai_chats for each row execute function public.update_updated_at();

-- Function to increment counters
create or replace function public.increment_post_likes()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set likes_count = likes_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts set likes_count = greatest(0, likes_count - 1) where id = OLD.post_id;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_likes_count on public.likes;
create trigger trg_likes_count after insert or delete on public.likes for each row execute function public.increment_post_likes();

create or replace function public.increment_post_comments()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set comments_count = comments_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts set comments_count = greatest(0, comments_count - 1) where id = OLD.post_id;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_comments_count on public.comments;
create trigger trg_comments_count after insert or delete on public.comments for each row execute function public.increment_post_comments();

-- ==================== RLS ====================
alter table public.accounts enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.follows enable row level security;
alter table public.shares enable row level security;
alter table public.messages enable row level security;
alter table public.products enable row level security;
alter table public.reports enable row level security;
alter table public.stories enable row level security;
alter table public.friend_reqs enable row level security;
alter table public.notes enable row level security;
alter table public.gold_reqs enable row level security;
alter table public.ai_chats enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage enable row level security;
alter table public.sessions enable row level security;

-- For now, allow all for anon with service key - production should restrict
do $$
declare t text;
begin
  foreach t in array array[
    'accounts','profiles','posts','likes','comments','comment_likes',
    'follows','shares','messages','products','reports','stories',
    'friend_reqs','notes','gold_reqs','ai_chats','ai_messages','ai_usage','sessions'
  ]
  loop
    execute format('drop policy if exists zivv_read on public.%I', t);
    execute format('create policy zivv_read on public.%I for select using (true)', t);
    execute format('drop policy if exists zivv_write on public.%I', t);
    execute format('create policy zivv_write on public.%I for insert with check (true)', t);
    execute format('drop policy if exists zivv_update on public.%I', t);
    execute format('create policy zivv_update on public.%I for update using (true)', t);
    execute format('drop policy if exists zivv_delete on public.%I', t);
    execute format('create policy zivv_delete on public.%I for delete using (true)', t);
  end loop;
end $$;

-- ==================== STORAGE ====================
insert into storage.buckets (id, name, public)
values ('zivv-media', 'zivv-media', true)
on conflict (id) do nothing;

drop policy if exists zivv_media_read on storage.objects;
create policy zivv_media_read on storage.objects
  for select using (bucket_id = 'zivv-media');

drop policy if exists zivv_media_write on storage.objects;
create policy zivv_media_write on storage.objects
  for insert with check (bucket_id = 'zivv-media');

drop policy if exists zivv_media_update on storage.objects;
create policy zivv_media_update on storage.objects
  for update using (bucket_id = 'zivv-media');

drop policy if exists zivv_media_delete on storage.objects;
create policy zivv_media_delete on storage.objects
  for delete using (bucket_id = 'zivv-media');

-- Cleanup expired stories daily (optional cron)
-- delete from public.stories where expires_at < now();

-- Seed admin check
-- select * from public.accounts limit 5;
