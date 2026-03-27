create extension if not exists pgcrypto;

create table if not exists public.groups (
  key text primary key,
  label_en text not null,
  label_zh text not null,
  accent text not null,
  order_index integer not null default 0
);

insert into public.groups (key, label_en, label_zh, accent, order_index)
values
  ('study', 'Study', '学习', '#4f7cff', 1),
  ('work', 'Work', '工作', '#ff6b4a', 2),
  ('life', 'Life', '生活', '#39b07a', 3),
  ('health', 'Health', '健康', '#f5a623', 4),
  ('other', 'Other', '其他', '#7b6ef6', 5)
on conflict (key) do update
set
  label_en = excluded.label_en,
  label_zh = excluded.label_zh,
  accent = excluded.accent,
  order_index = excluded.order_index;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('todo', 'event')),
  title text not null,
  notes text,
  status text not null,
  group_key text not null default 'other' references public.groups(key),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  estimated_minutes integer,
  start_at timestamptz,
  end_at timestamptz,
  due_date date,
  is_all_day boolean not null default false,
  needs_confirmation boolean not null default false,
  parse_confidence numeric(3, 2),
  source_text text,
  google_event_id text,
  sync_state text not null default 'local_only',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'google',
  calendar_id text not null default 'primary',
  calendar_summary text,
  is_enabled boolean not null default false,
  connection_status text not null default 'disconnected',
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

drop trigger if exists calendar_connections_set_updated_at on public.calendar_connections;
create trigger calendar_connections_set_updated_at
before update on public.calendar_connections
for each row execute function public.set_updated_at();

alter table public.groups enable row level security;
alter table public.items enable row level security;
alter table public.calendar_connections enable row level security;

drop policy if exists "Groups are readable to authenticated users" on public.groups;
create policy "Groups are readable to authenticated users"
on public.groups
for select
to authenticated
using (true);

drop policy if exists "Users manage their own items" on public.items;
create policy "Users manage their own items"
on public.items
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage their own calendar connections" on public.calendar_connections;
create policy "Users manage their own calendar connections"
on public.calendar_connections
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
