-- Stitch by Style: ordering a 3D piece, start to finish on the website.
--   1. a signed-in customer picks options, sees the price, enters a delivery address and places the order
--   2. pays by PromptPay QR and uploads the slip
--   3. the team checks the slip, makes and ships the piece, and adds the tracking number
--   4. the customer marks it received
-- Customer and team talk in a message thread on the order. Prices and the PromptPay account are set by the team
-- on #/moderation. Moderators come from 0004.
-- Replaces the LINE-based pilot table order_requests, which never took real orders.

drop table if exists public.order_requests cascade;

-- ---------- prices and payment details ----------
create table if not exists public.order_config (
  key text primary key
    check (key ~ '^(price:(blank|kit|stitched):(S|M|L)|shipping|promptpay_id|promptpay_name)$'),
  value text not null check (char_length(value) <= 100),
  updated_at timestamptz not null default now(),
  check ((key not like 'price:%' and key <> 'shipping') or value ~ '^[0-9]{1,6}$')
);
alter table public.order_config enable row level security;

drop policy if exists "prices are public" on public.order_config;
create policy "prices are public" on public.order_config for select to anon
  using (key like 'price:%' or key = 'shipping');
drop policy if exists "signed-in read config" on public.order_config;
create policy "signed-in read config" on public.order_config for select to authenticated using (true);
drop policy if exists "moderators add config" on public.order_config;
create policy "moderators add config" on public.order_config for insert to authenticated
  with check ((select public.is_moderator()));
drop policy if exists "moderators edit config" on public.order_config;
create policy "moderators edit config" on public.order_config for update to authenticated
  using ((select public.is_moderator())) with check ((select public.is_moderator()));

revoke all on public.order_config from anon, authenticated;
grant select on public.order_config to anon, authenticated;
grant insert (key, value), update (key, value) on public.order_config to authenticated;

drop trigger if exists order_config_touch on public.order_config;
create trigger order_config_touch before update on public.order_config
  for each row execute function public.touch_updated_at(); -- from 0003

-- starting prices in baht per piece (S/M/L by the longest side, see order_size) and shipping per order;
-- the team changes them on #/moderation
insert into public.order_config (key, value) values
  ('price:blank:S', '79'), ('price:blank:M', '119'), ('price:blank:L', '169'),
  ('price:kit:S', '159'), ('price:kit:M', '219'), ('price:kit:L', '329'),
  ('price:stitched:S', '390'), ('price:stitched:M', '750'), ('price:stitched:L', '1290'),
  ('shipping', '50')
on conflict (key) do nothing;

-- size class of a piece by its longest side in mm; null = too big for our printers.
-- Keep in step with SIZE_LIMITS in src/lib/orders.ts.
create or replace function public.order_size(cols int, rows int, pitch numeric) returns text
language sql immutable set search_path = '' as $$
  select case
    when greatest(cols, rows) * pitch <= 75 then 'S'
    when greatest(cols, rows) * pitch <= 120 then 'M'
    when greatest(cols, rows) * pitch <= 180 then 'L'
  end;
$$;

-- ---------- orders ----------
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  -- short reference shown to the customer, made in the app, e.g. SBS-7KQ2MX
  code text not null unique check (code ~ '^SBS-[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- kept (as null) when the customer deletes their account, for bookkeeping
  user_id uuid default auth.uid() references auth.users (id) on delete set null,

  -- the piece
  title text not null check (char_length(title) between 1 and 80),
  template_name text check (template_name is null or char_length(template_name) <= 80),
  cols smallint not null check (cols between 1 and 1000),
  rows smallint not null check (rows between 1 and 1000),
  pitch_mm numeric(5, 2) not null check (pitch_mm between 1 and 10),
  size text not null check (size in ('S', 'M', 'L')),
  colors smallint not null check (colors between 0 and 200),
  stitches integer not null check (stitches >= 0),
  -- the pattern as made by encodeShare(): no stitching progress, deflated + base64url
  data text not null check (char_length(data) between 10 and 200000),
  product text not null check (product in ('blank', 'kit', 'stitched')),
  plastic_color text not null default '' check (char_length(plastic_color) <= 40),
  quantity smallint not null default 1 check (quantity between 1 and 20),
  note text not null default '' check (char_length(note) <= 1000),
  lang text check (lang is null or lang in ('th', 'en')),

  -- delivery
  ship_name text not null check (char_length(ship_name) between 1 and 100),
  ship_phone text not null check (ship_phone ~ '^[0-9+ -]{9,20}$'),
  ship_address text not null check (char_length(ship_address) between 10 and 500),
  ship_postcode text not null check (ship_postcode ~ '^[0-9]{5}$'),

  -- price in baht, set by the database from order_config when the order is placed
  unit_thb integer not null check (unit_thb >= 0),
  shipping_thb integer not null check (shipping_thb >= 0),
  total_thb integer not null check (total_thb >= 0),

  status text not null default 'awaiting_payment' check (status in
    ('awaiting_payment', 'payment_review', 'paid', 'in_production', 'shipped', 'done', 'cancelled')),
  slip_path text,
  slip_at timestamptz,
  paid_at timestamptz,
  tracking_carrier text not null default '' check (char_length(tracking_carrier) <= 40),
  tracking_no text not null default '' check (char_length(tracking_no) <= 60),
  shipped_at timestamptz,
  closed_at timestamptz
);
create index if not exists orders_mine on public.orders (user_id, created_at desc);
create index if not exists orders_open on public.orders (status, created_at);

-- on insert: work out the size and price (the client never sends them), reset the team's fields, limit the rate
create or replace function public.orders_prepare() returns trigger
language plpgsql security definer set search_path = '' as $$
declare unit int; ship int;
begin
  if not public.is_moderator() and (
    select count(*) from public.orders where user_id = (select auth.uid()) and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'too many orders in an hour' using errcode = 'P0001';
  end if;
  new.size := public.order_size(new.cols, new.rows, new.pitch_mm);
  if new.size is null then raise exception 'piece too large' using errcode = 'P0001'; end if;
  select value::int into unit from public.order_config where key = 'price:' || new.product || ':' || new.size;
  select value::int into ship from public.order_config where key = 'shipping';
  if unit is null or ship is null then raise exception 'no price set' using errcode = 'P0001'; end if;
  new.unit_thb := unit;
  new.shipping_thb := ship;
  new.total_thb := unit * new.quantity + ship;
  new.created_at := now();
  new.updated_at := now();
  new.status := 'awaiting_payment';
  new.slip_path := null; new.slip_at := null; new.paid_at := null;
  new.tracking_carrier := ''; new.tracking_no := ''; new.shipped_at := null; new.closed_at := null;
  return new;
end $$;
drop trigger if exists orders_prepare on public.orders;
create trigger orders_prepare before insert on public.orders
  for each row execute function public.orders_prepare();

-- on update: timestamps that follow the status
create or replace function public.orders_track() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if new.status = 'paid' and new.paid_at is null then new.paid_at := now(); end if;
    if new.status = 'shipped' then new.shipped_at := now(); end if;
    if new.status in ('done', 'cancelled') then new.closed_at := now(); else new.closed_at := null; end if;
  end if;
  return new;
end $$;
drop trigger if exists orders_track on public.orders;
create trigger orders_track before update on public.orders
  for each row execute function public.orders_track();

alter table public.orders enable row level security;
drop policy if exists "customers place orders" on public.orders;
create policy "customers place orders" on public.orders for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "own orders or team" on public.orders;
create policy "own orders or team" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_moderator()));
drop policy if exists "team works orders" on public.orders;
create policy "team works orders" on public.orders for update to authenticated
  using ((select public.is_moderator())) with check ((select public.is_moderator()));

revoke all on public.orders from anon, authenticated;
grant insert (code, title, template_name, cols, rows, pitch_mm, colors, stitches, data, product, plastic_color,
  quantity, note, lang, ship_name, ship_phone, ship_address, ship_postcode)
  on public.orders to authenticated;
grant select on public.orders to authenticated;
-- row level security above limits these to moderators; customers change their orders only through the functions below
grant update (status, tracking_carrier, tracking_no) on public.orders to authenticated;

-- customer: attach a payment slip (already uploaded to payment-slips/<user id>/<code>/…)
create or replace function public.order_submit_slip(order_code text, slip text) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where code = order_code and user_id = (select auth.uid()) for update;
  if not found then raise exception 'order not found' using errcode = 'P0001'; end if;
  if o.status not in ('awaiting_payment', 'payment_review') then
    raise exception 'order is not waiting for payment' using errcode = 'P0001';
  end if;
  if slip is null or slip not like (select auth.uid())::text || '/' || order_code || '/%' then
    raise exception 'bad slip path' using errcode = 'P0001';
  end if;
  update public.orders set slip_path = slip, slip_at = now(), status = 'payment_review' where id = o.id;
end $$;

-- customer: cancel before paying
create or replace function public.order_cancel(order_code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set status = 'cancelled'
   where code = order_code and user_id = (select auth.uid()) and status = 'awaiting_payment';
  if not found then raise exception 'order cannot be cancelled' using errcode = 'P0001'; end if;
end $$;

-- customer: the parcel arrived
create or replace function public.order_received(order_code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set status = 'done'
   where code = order_code and user_id = (select auth.uid()) and status = 'shipped';
  if not found then raise exception 'order is not shipped' using errcode = 'P0001'; end if;
end $$;

revoke all on function public.order_submit_slip(text, text) from public, anon;
revoke all on function public.order_cancel(text) from public, anon;
revoke all on function public.order_received(text) from public, anon;
grant execute on function public.order_submit_slip(text, text) to authenticated;
grant execute on function public.order_cancel(text) to authenticated;
grant execute on function public.order_received(text) to authenticated;

-- ---------- the team's private notes ----------
create table if not exists public.order_notes (
  order_id bigint primary key references public.orders (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 2000),
  updated_at timestamptz not null default now()
);
alter table public.order_notes enable row level security;
drop policy if exists "team notes" on public.order_notes;
create policy "team notes" on public.order_notes for all to authenticated
  using ((select public.is_moderator())) with check ((select public.is_moderator()));
revoke all on public.order_notes from anon, authenticated;
grant select, insert, update on public.order_notes to authenticated;
drop trigger if exists order_notes_touch on public.order_notes;
create trigger order_notes_touch before update on public.order_notes
  for each row execute function public.touch_updated_at();

-- ---------- messages between the customer and the team ----------
create table if not exists public.order_messages (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  created_at timestamptz not null default now(),
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  from_team boolean not null default false,
  body text not null check (char_length(body) between 1 and 1000)
);
create index if not exists order_messages_by_order on public.order_messages (order_id, created_at);

create or replace function public.order_messages_prepare() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  select user_id into owner from public.orders where id = new.order_id;
  new.author_id := (select auth.uid());
  new.created_at := now();
  -- a moderator writing on someone else's order speaks for the team
  new.from_team := public.is_moderator() and owner is distinct from new.author_id;
  if not new.from_team and (
    select count(*) from public.order_messages where author_id = new.author_id and created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'too many messages in an hour' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists order_messages_prepare on public.order_messages;
create trigger order_messages_prepare before insert on public.order_messages
  for each row execute function public.order_messages_prepare();

alter table public.order_messages enable row level security;
drop policy if exists "order people read messages" on public.order_messages;
create policy "order people read messages" on public.order_messages for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
         or (select public.is_moderator()));
drop policy if exists "order people write messages" on public.order_messages;
create policy "order people write messages" on public.order_messages for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
              or (select public.is_moderator()));
revoke all on public.order_messages from anon, authenticated;
grant select on public.order_messages to authenticated;
grant insert (order_id, body) on public.order_messages to authenticated;

-- ---------- payment slips (private files) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-slips', 'payment-slips', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- customers upload into a folder named after their user id; they and the team can read them
drop policy if exists "upload own slips" on storage.objects;
create policy "upload own slips" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-slips' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "read own slips or team" on storage.objects;
create policy "read own slips or team" on storage.objects for select to authenticated
  using (bucket_id = 'payment-slips'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_moderator())));
