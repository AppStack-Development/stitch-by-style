-- Stitch by Style: optional accounts (run once in the Supabase SQL editor, or `supabase db push`).
-- Every row belongs to one signed-in user; row-level security makes sure nobody can read or change
-- anyone else's data, even though the browser talks to the database directly.

-- profile shown on the Account page (filled from the Google account on sign-in)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  lang text check (lang in ('th', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- one row per pattern; `data` is the same JSON the app keeps in localStorage.
-- Deleting a pattern keeps a tombstone (deleted = true, data = null) so other devices delete it too.
create table if not exists public.patterns (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  data jsonb,
  deleted boolean not null default false,
  -- when the pattern was last edited on a device (from the app)
  updated_at timestamptz not null,
  -- when the server last received it; devices pull rows newer than their last sync
  synced_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint patterns_data_size check (data is null or pg_column_size(data) < 2000000)
);
create index if not exists patterns_user_synced on public.patterns (user_id, synced_at);

-- "My threads": the DMC codes the user owns
create table if not exists public.stashes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  codes text[] not null default '{}',
  updated_at timestamptz not null
);

-- server clock decides synced_at, so device clocks that are off can't hide changes
create or replace function public.touch_synced_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.synced_at := now();
  return new;
end $$;
drop trigger if exists patterns_touch_synced on public.patterns;
create trigger patterns_touch_synced before insert or update on public.patterns
  for each row execute function public.touch_synced_at();

alter table public.profiles enable row level security;
alter table public.patterns enable row level security;
alter table public.stashes enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "own patterns" on public.patterns;
create policy "own patterns" on public.patterns for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own stash" on public.stashes;
create policy "own stash" on public.stashes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- signed-out visitors get nothing; signed-in users only reach rows the policies allow
revoke all on public.profiles, public.patterns, public.stashes from anon;
grant select, insert, update, delete on public.profiles, public.patterns, public.stashes to authenticated;

-- "Delete account" on the Account page: removes the auth user, which cascades to all rows above
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = (select auth.uid());
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
