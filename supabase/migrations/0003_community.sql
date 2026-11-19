-- Stitch by Style: community gallery ("ลายจากชุมชน"). See docs/community-gallery.md.
-- Anyone can browse published patterns; signed-in users can share their own, like and report.
-- The team moderates in the Supabase dashboard (Table Editor → posts: set status to 'hidden' or 'removed').

-- ---------- public identity (separate from the Google name kept in profiles) ----------
create table if not exists public.creators (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  -- "from the team" badge; only settable in the dashboard
  official boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- shared patterns ----------
create table if not exists public.posts (
  id text primary key default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  -- references creators so the app can embed the author's display name in one query
  author uuid not null default auth.uid() references public.creators (user_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  base text not null check (base in ('aida', 'print3d')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  colors smallint not null check (colors between 1 and 200),
  stitches integer not null check (stitches > 0),
  cols smallint not null check (cols between 1 and 1000),
  rows smallint not null check (rows between 1 and 1000),
  template_name text check (template_name is null or char_length(template_name) <= 80),
  tags text[] not null default '{}' check (cardinality(tags) <= 3),
  -- the pattern as made by encodeShare(): no stitching progress, deflated + base64url
  data text not null check (char_length(data) between 10 and 200000),
  remix_of text references public.posts (id) on delete set null,
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  like_count integer not null default 0,
  report_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_new on public.posts (status, created_at desc);
create index if not exists posts_popular on public.posts (status, like_count desc, created_at desc);
create index if not exists posts_author on public.posts (author, created_at desc);

create table if not exists public.post_likes (
  post_id text not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user on public.post_likes (user_id);

create table if not exists public.post_reports (
  id bigint generated always as identity primary key,
  post_id text not null references public.posts (id) on delete cascade,
  -- set automatically for signed-in reporters, null otherwise
  reporter uuid default auth.uid() references auth.users (id) on delete set null,
  reason text not null check (reason in ('copyright', 'inappropriate', 'spam', 'other')),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists post_reports_post on public.post_reports (post_id);

-- ---------- triggers ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists creators_touch on public.creators;
create trigger creators_touch before update on public.creators
  for each row execute function public.touch_updated_at();
drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

-- at most 10 new shares per account per day (spam guard)
create or replace function public.posts_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.posts
      where author = new.author and created_at > now() - interval '1 day') >= 10 then
    raise exception 'share limit reached: at most 10 patterns per day' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit before insert on public.posts
  for each row execute function public.posts_rate_limit();

-- keep posts.like_count in step with post_likes (users can't write the counter themselves)
create or replace function public.post_likes_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
drop trigger if exists post_likes_count on public.post_likes;
create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function public.post_likes_count();

-- count reports; hide a post for review once 3 different signed-in people have reported it
-- (signed-out reports are counted but can't hide anything on their own)
create or replace function public.post_reports_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.posts set report_count = report_count + 1 where id = new.post_id;
  if (select count(distinct reporter) from public.post_reports
      where post_id = new.post_id and reporter is not null) >= 3 then
    update public.posts set status = 'hidden' where id = new.post_id and status = 'published';
  end if;
  return null;
end $$;
drop trigger if exists post_reports_count on public.post_reports;
create trigger post_reports_count after insert on public.post_reports
  for each row execute function public.post_reports_count();

-- trigger functions are not meant to be called directly
revoke all on function public.posts_rate_limit(), public.post_likes_count(), public.post_reports_count()
  from public, anon, authenticated;

-- ---------- row level security ----------
alter table public.creators enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_reports enable row level security;

drop policy if exists "creators are public" on public.creators;
create policy "creators are public" on public.creators for select to anon, authenticated using (true);
drop policy if exists "own creator" on public.creators;
create policy "own creator" on public.creators for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "own creator update" on public.creators;
create policy "own creator update" on public.creators for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- published posts are public; authors also see their own hidden ones
drop policy if exists "read posts" on public.posts;
create policy "read posts" on public.posts for select to anon, authenticated
  using (status = 'published' or (select auth.uid()) = author);
drop policy if exists "share own posts" on public.posts;
create policy "share own posts" on public.posts for insert to authenticated
  with check ((select auth.uid()) = author);
drop policy if exists "edit own posts" on public.posts;
create policy "edit own posts" on public.posts for update to authenticated
  using ((select auth.uid()) = author) with check ((select auth.uid()) = author);
drop policy if exists "remove own posts" on public.posts;
create policy "remove own posts" on public.posts for delete to authenticated
  using ((select auth.uid()) = author);

-- who liked what stays private: you only see your own likes
drop policy if exists "own likes" on public.post_likes;
create policy "own likes" on public.post_likes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- reports are insert-only (read in the dashboard), like feedback
drop policy if exists "anyone can report" on public.post_reports;
create policy "anyone can report" on public.post_reports for insert to anon, authenticated
  with check (reporter is null or reporter = (select auth.uid()));

-- ---------- column grants: counters, status and badges are not writable from the app ----------
revoke all on public.creators, public.posts, public.post_likes, public.post_reports from anon, authenticated;

grant select on public.creators to anon, authenticated;
grant insert (user_id, display_name) on public.creators to authenticated;
grant update (display_name) on public.creators to authenticated;

grant select on public.posts to anon, authenticated;
grant insert (author, title, description, base, difficulty, colors, stitches, cols, rows, template_name, tags, data, remix_of)
  on public.posts to authenticated;
grant update (title, description, base, difficulty, colors, stitches, cols, rows, template_name, tags, data)
  on public.posts to authenticated;
grant delete on public.posts to authenticated;

grant select, insert, delete on public.post_likes to authenticated;

grant insert (post_id, reporter, reason, note) on public.post_reports to anon, authenticated;
