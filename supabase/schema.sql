-- Untuk database BARU: jalankan file ini, lalu migration-002-performa-keamanan.sql.
-- (Database lama cukup jalankan migration-002.)

create extension if not exists "pgcrypto";

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  event_date timestamptz,
  location text not null default '',
  quota integer check (quota is null or quota > 0),   -- null = tanpa batas
  is_open boolean not null default true,
  fields jsonb not null default '[]'::jsonb,           -- definisi form (dibuat admin)
  created_at timestamptz not null default now()
);

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists registrations_event_idx on registrations(event_id, created_at);

alter table events enable row level security;
alter table registrations enable row level security;
