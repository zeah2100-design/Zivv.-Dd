-- ZIVV — شغّل الملف ده في Supabase: SQL Editor → Run
-- Project Settings → API: انسخ Project URL و anon key بعد كده في setup.html

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique,
  email text unique not null,
  username text unique,
  name text,
  avatar text,
  cover text,
  bio text,
  city text,
  age int,
  onboarding jsonb,
  created_at timestamptz default now()
);

create table if not exists public.posts (
  id text primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  username text,
  name text,
  avatar text,
  title text,
  body text,
  type text default 'text',
  video_kind text,
  tags text[] default '{}',
  dests text[] default '{}',
  image_url text,
  video_url text,
  audio_url text,
  sound_url text,
  mute_original boolean default false,
  link text,
  place text,
  status text default 'ok',
  extra jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.likes (
  post_id text not null references public.posts(id) on delete cascade,
  user_key text not null,
  created_at timestamptz default now(),
  primary key (post_id, user_key)
);

create table if not exists public.comments (
  id text primary key,
  post_id text not null references public.posts(id) on delete cascade,
  parent_id text,
  name text,
  user_key text,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.comment_likes (
  comment_id text not null,
  user_key text not null,
  created_at timestamptz default now(),
  primary key (comment_id, user_key)
);

create table if not exists public.follows (
  follower text not null,
  following text not null,
  created_at timestamptz default now(),
  primary key (follower, following)
);

create table if not exists public.shares (
  id text primary key,
  post_id text,
  from_key text,
  from_name text,
  to_user text,
  preview text,
  created_at timestamptz default now()
);

create table if not exists public.messages (
  id text primary key,
  thread_user text not null,
  from_key text,
  from_user text,
  name text,
  kind text default 'text',
  body text,
  post_id text,
  product_id text,
  image_url text,
  created_at timestamptz default now()
);

create table if not exists public.products (
  id text primary key,
  title text not null,
  price numeric default 0,
  cat text,
  seller text,
  seller_user text,
  phone text,
  image_url text,
  description text,
  specs text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists public.reports (
  id text primary key,
  post_id text,
  target_user text,
  type text,
  dest text default 'king',
  reporter_name text,
  reporter_email text,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.stories (
  id text primary key,
  name text,
  kind text,
  body text,
  image_url text,
  video_url text,
  created_at timestamptz default now()
);

create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists comments_post_idx on public.comments (post_id, created_at);
create index if not exists messages_thread_idx on public.messages (thread_user, created_at);
create index if not exists products_seller_idx on public.products (seller_user);

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

-- قراءة عامة + كتابة للزوار (anon) عشان الموقع يشتغل قبل ما نفعّل صلاحيات أدق
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','posts','likes','comments','comment_likes',
    'follows','shares','messages','products','reports','stories'
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

insert into storage.buckets (id, name, public)
values ('zivv-media', 'zivv-media', true)
on conflict (id) do nothing;

drop policy if exists zivv_media_read on storage.objects;
create policy zivv_media_read on storage.objects
  for select using (bucket_id = 'zivv-media');
drop policy if exists zivv_media_write on storage.objects;
create policy zivv_media_write on storage.objects
  for insert with check (bucket_id = 'zivv-media');
