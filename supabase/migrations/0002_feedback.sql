-- Stitch by Style: in-app feedback ("ส่งความคิดเห็น").
-- Anyone can send feedback, signed in or not; nobody can read it back through the app.
-- The team reads it in the Supabase dashboard (Table Editor → feedback).

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  -- set automatically for signed-in senders, null otherwise
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null check (kind in ('idea', 'bug', 'other')),
  message text not null check (char_length(message) between 3 and 2000),
  -- optional, only when the sender asks for a reply
  contact_email text check (contact_email is null or (char_length(contact_email) <= 200 and contact_email like '%_@_%.%')),
  -- where the app was when the feedback was sent, e.g. '#/quick' (no pattern data)
  page text check (page is null or char_length(page) <= 100),
  lang text check (lang is null or lang in ('th', 'en')),
  -- coarse device info to reproduce bugs: 'phone' | 'tablet' | 'desktop', screen width in px
  device text check (device is null or device in ('phone', 'tablet', 'desktop')),
  screen_w integer check (screen_w is null or screen_w between 100 and 10000)
);

alter table public.feedback enable row level security;

-- insert-only for the app; the sender can't spoof someone else's user_id
drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

revoke all on public.feedback from anon, authenticated;
grant insert (kind, message, contact_email, page, lang, device, screen_w, user_id) on public.feedback to anon, authenticated;
