-- Fix ambiguous user_id references in user role RPC functions.
-- Run this in Supabase SQL Editor when role management reports:
-- "column reference user_id is ambiguous" / "欄位參考「user_id」具有歧義".

create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = auth.uid()
    and ur.role = 'admin'
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
    coalesce(ur.role, 'user')::text as role,
    u.created_at
  from auth.users as u
  left join public.user_roles as ur
    on ur.user_id = u.id
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

  update public.user_roles as ur
  set role = target_role
  where ur.user_id = target_user_id;

  if not found then
    insert into public.user_roles (user_id, role)
    values (target_user_id, target_role);
  end if;

  return query
  select target_user_id, target_email::text, target_role::text;
end;
$$;

grant execute on function public.is_current_user_admin() to authenticated;
grant execute on function public.list_user_role_assignments() to authenticated;
grant execute on function public.assign_user_role_by_email(text, text) to authenticated;

notify pgrst, 'reload schema';
