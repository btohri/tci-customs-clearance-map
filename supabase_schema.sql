-- TCI Customs Clearance Map - Supabase 初始化 SQL
-- 請在 Supabase SQL Editor 執行；前端只使用 anon key，權限由 RLS 控制。

create extension if not exists "uuid-ossp";

create table if not exists customs_records (
  id uuid primary key default uuid_generate_v4(),
  country text not null,
  port text not null,
  dosage_form text not null,
  forwarder text,
  broker text,
  clearance_result text check (clearance_result in ('success', 'delayed', 'held', 'rejected')),
  clearance_days integer,
  required_documents text,
  risk_level text check (risk_level in ('green', 'yellow', 'red')),
  issue_supplement boolean default false,
  issue_held boolean default false,
  issue_delayed boolean default false,
  issue_note text,
  created_by uuid references auth.users(id),
  created_at timestamp default now(),
  last_updated timestamp default now()
);

create table if not exists document_requirements (
  id uuid primary key default uuid_generate_v4(),
  country text not null,
  port text,
  dosage_form text,
  required_documents text not null,
  remarks text
);

create table if not exists broker_directory (
  id uuid primary key default uuid_generate_v4(),
  country text not null,
  port text,
  broker_name text not null,
  contact_info text,
  remarks text
);

create table if not exists user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) unique,
  role text check (role in ('user', 'shipping', 'admin')) default 'user'
);

alter table customs_records enable row level security;
alter table document_requirements enable row level security;
alter table broker_directory enable row level security;
alter table user_roles enable row level security;

drop policy if exists "登入者可查詢通關紀錄" on customs_records;
create policy "登入者可查詢通關紀錄" on customs_records
  for select using (auth.role() = 'authenticated');

drop policy if exists "shipping/admin 可新增通關紀錄" on customs_records;
create policy "shipping/admin 可新增通關紀錄" on customs_records
  for insert with check (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('shipping', 'admin')
    )
  );

drop policy if exists "shipping/admin 可編輯通關紀錄" on customs_records;
create policy "shipping/admin 可編輯通關紀錄" on customs_records
  for update using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('shipping', 'admin')
    )
  );

drop policy if exists "shipping/admin 可刪除通關紀錄" on customs_records;
create policy "shipping/admin 可刪除通關紀錄" on customs_records
  for delete using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('shipping', 'admin')
    )
  );

drop policy if exists "登入者可查詢文件需求" on document_requirements;
create policy "登入者可查詢文件需求" on document_requirements
  for select using (auth.role() = 'authenticated');

drop policy if exists "登入者可查詢Broker" on broker_directory;
create policy "登入者可查詢Broker" on broker_directory
  for select using (auth.role() = 'authenticated');

drop policy if exists "使用者可查詢自己的角色" on user_roles;
create policy "使用者可查詢自己的角色" on user_roles
  for select using (auth.uid() = user_id);

-- 後台角色管理 RPC：只允許 admin 執行，避免前端直接讀取 auth.users。
create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
    and role = 'admin'
  );
$$;

create or replace function public.list_user_role_assignments()
returns table (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Only admin can list user roles';
  end if;

  return query
  select
    u.id as user_id,
    u.email::text as email,
    coalesce(user_roles.role, 'user')::text as role,
    u.created_at
  from auth.users as u
  left join public.user_roles
    on user_roles.user_id = u.id
  order by u.created_at desc;
end;
$$;

create or replace function public.assign_user_role_by_email(
  target_email text,
  target_role text
)
returns table (
  user_id uuid,
  email text,
  role text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
begin
  if not public.is_current_user_admin() then
    raise exception 'Only admin can assign user roles';
  end if;

  if target_role not in ('user', 'shipping', 'admin') then
    raise exception 'Invalid role: %', target_role;
  end if;

  select u.id
  into target_user_id
  from auth.users as u
  where lower(u.email) = lower(target_email)
  limit 1;

  if target_user_id is null then
    raise exception 'User email not found: %', target_email;
  end if;

  insert into public.user_roles (user_id, role)
  values (target_user_id, target_role)
  on conflict (user_id)
  do update set role = excluded.role;

  return query
  select target_user_id, target_email::text, target_role::text;
end;
$$;

grant execute on function public.is_current_user_admin() to authenticated;
grant execute on function public.list_user_role_assignments() to authenticated;
grant execute on function public.assign_user_role_by_email(text, text) to authenticated;

-- 讓 Supabase/PostgREST 重新載入 RPC schema cache。
notify pgrst, 'reload schema';
