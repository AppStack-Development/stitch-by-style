-- Stitch by Style: in-app review of community reports (#/moderation).
-- Moderators are added by hand in the dashboard:
--   insert into public.moderators (user_id) values ('<auth user id>');

create table if not exists public.moderators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.moderators enable row level security;

-- a signed-in user can only find out whether they themselves are a moderator
drop policy if exists "see self" on public.moderators;
create policy "see self" on public.moderators for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.moderators from anon, authenticated;
grant select on public.moderators to authenticated;

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.moderators where user_id = (select auth.uid()));
$$;
revoke all on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

-- ---------- reports: moderators read them and mark them handled ----------
alter table public.post_reports add column if not exists resolved_at timestamptz;
alter table public.post_reports add column if not exists resolution text
  check (resolution is null or resolution in ('kept', 'hidden', 'removed'));
create index if not exists post_reports_open on public.post_reports (created_at) where resolved_at is null;

drop policy if exists "moderators read reports" on public.post_reports;
create policy "moderators read reports" on public.post_reports for select to authenticated
  using ((select public.is_moderator()));
drop policy if exists "moderators resolve reports" on public.post_reports;
create policy "moderators resolve reports" on public.post_reports for update to authenticated
  using ((select public.is_moderator())) with check ((select public.is_moderator()));
-- row level security above limits both to moderators
grant select on public.post_reports to authenticated;
grant update (resolved_at, resolution) on public.post_reports to authenticated;

-- ---------- posts: moderators see every post and can change its status ----------
drop policy if exists "moderators read all posts" on public.posts;
create policy "moderators read all posts" on public.posts for select to authenticated
  using ((select public.is_moderator()));
drop policy if exists "moderators moderate posts" on public.posts;
create policy "moderators moderate posts" on public.posts for update to authenticated
  using ((select public.is_moderator())) with check ((select public.is_moderator()));
grant update (status) on public.posts to authenticated;

-- the grant above is per role, so authors could otherwise un-hide their own posts through
-- "edit own posts": only moderators (or the report trigger, which runs as the owner) may change status
create or replace function public.posts_status_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status
     and current_user in ('authenticated', 'anon')
     and not public.is_moderator() then
    raise exception 'only moderators can change a post''s status' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists posts_status_guard on public.posts;
create trigger posts_status_guard before update on public.posts
  for each row execute function public.posts_status_guard();
revoke all on function public.posts_status_guard() from public, anon, authenticated;
