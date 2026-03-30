begin;
-- 1) Add ownership columns if not already present.
alter table public.items
add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.activity_logs
add column if not exists user_id uuid references auth.users(id) on delete cascade;
-- 2) This rollout starts from fresh private data; remove legacy shared rows.
delete from public.activity_logs
where user_id is null;
delete from public.items
where user_id is null;
-- 3) Enforce ownership requirements.
alter table public.items
alter column user_id
set not null;
alter table public.activity_logs
alter column user_id
set not null;
-- 4) Replace permissive RLS policies with owner-only policies.
drop policy if exists "items_manageable_by_anon" on public.items;
drop policy if exists "activity_logs_readable_by_anon" on public.activity_logs;
drop policy if exists "activity_logs_insertable_by_anon" on public.activity_logs;
drop policy if exists "items_select_own" on public.items;
drop policy if exists "items_insert_own" on public.items;
drop policy if exists "items_update_own" on public.items;
drop policy if exists "items_delete_own" on public.items;
drop policy if exists "activity_logs_select_own" on public.activity_logs;
drop policy if exists "activity_logs_insert_own" on public.activity_logs;
drop policy if exists "activity_logs_update_own" on public.activity_logs;
drop policy if exists "activity_logs_delete_own" on public.activity_logs;
create policy "items_select_own" on public.items for
select to authenticated using (auth.uid() = user_id);
create policy "items_insert_own" on public.items for
insert to authenticated with check (auth.uid() = user_id);
create policy "items_update_own" on public.items for
update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "items_delete_own" on public.items for delete to authenticated using (auth.uid() = user_id);
create policy "activity_logs_select_own" on public.activity_logs for
select to authenticated using (auth.uid() = user_id);
create policy "activity_logs_insert_own" on public.activity_logs for
insert to authenticated with check (auth.uid() = user_id);
create policy "activity_logs_update_own" on public.activity_logs for
update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "activity_logs_delete_own" on public.activity_logs for delete to authenticated using (auth.uid() = user_id);
-- 5) Add user-scope indexes.
create index if not exists items_user_created_idx on public.items (user_id, created_at desc);
create index if not exists activity_logs_user_created_idx on public.activity_logs (user_id, created_at desc);
commit;