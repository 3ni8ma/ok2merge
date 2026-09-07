-- Run in Supabase SQL editor. Requires Vault: create extension if missing.
create extension if not exists "supabase_vault";

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid, -- placeholder for team billing; unused in v1
  created_at timestamptz default now()
);

create table if not exists github_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  secret_id uuid not null, -- supabase_vault secret id; raw token never in this table
  github_login text not null,
  updated_at timestamptz default now()
);

create table if not exists push_tokens (
  user_id uuid references auth.users(id) on delete cascade,
  fcm_token text not null,
  platform text not null check (platform in ('ios','android')),
  updated_at timestamptz default now(),
  primary key (user_id, fcm_token)
);

create table if not exists summary_cache (
  user_id uuid references auth.users(id) on delete cascade,
  repo text not null,
  pr_number int not null,
  head_sha text not null,
  summary text not null,
  partial boolean default false,
  created_at timestamptz default now(),
  primary key (user_id, repo, pr_number, head_sha)
);

create table if not exists entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','pro')),
  summaries_used_today int not null default 0,
  day date not null default current_date,
  updated_at timestamptz default now()
);

create table if not exists idempotency_keys (
  user_id uuid references auth.users(id) on delete cascade,
  key text not null,
  status int not null,
  body jsonb not null,
  created_at timestamptz default now(),
  primary key (user_id, key)
);

alter table profiles enable row level security;
alter table github_tokens enable row level security;
alter table push_tokens enable row level security;
alter table summary_cache enable row level security;
alter table entitlements enable row level security;
alter table idempotency_keys enable row level security;
-- v1 access is service-role only (backend); no public policies by design.
