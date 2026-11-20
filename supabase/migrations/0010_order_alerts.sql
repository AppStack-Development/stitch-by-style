-- XStitch.Design: order emails.
-- After an order changes (placed, slip sent, status, tracking) or a message is posted, the database pings the
-- `order-alert` Edge Function (supabase/functions/order-alert) with just the row id. The function reads the
-- order itself, works out which emails are due, and records each one in order_alerts so it goes out once.
-- The ping carries no data and the function only sends what the order's state calls for, so calling it again
-- (by retry or by anyone else) can't send anything twice.

create extension if not exists pg_net;

create table if not exists public.order_alerts (
  order_id bigint not null references public.orders (id) on delete cascade,
  key text not null check (char_length(key) <= 120),
  sent_at timestamptz not null default now(),
  primary key (order_id, key)
);
alter table public.order_alerts enable row level security;
-- no policies on purpose: only the Edge Function (service role) reads and writes this table

-- this project doesn't give service_role table rights by default, so grant the function exactly what it uses
grant select on public.orders, public.order_messages to service_role;
grant select, insert, delete on public.order_alerts to service_role;

create or replace function public.order_alert_ping() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://pokdpqxnwrotzcokrkah.supabase.co/functions/v1/order-alert',
    body := case when tg_table_name = 'order_messages'
                 then jsonb_build_object('message_id', new.id)
                 else jsonb_build_object('order_id', new.id) end,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
  return null;
exception when others then
  -- an email must never stop an order from being saved
  raise warning 'order alert not queued: %', sqlerrm;
  return null;
end $$;
revoke all on function public.order_alert_ping() from public, anon, authenticated;

drop trigger if exists orders_alert on public.orders;
create trigger orders_alert after insert or update of status, slip_at, tracking_no on public.orders
  for each row execute function public.order_alert_ping();

drop trigger if exists order_messages_alert on public.order_messages;
create trigger order_messages_alert after insert on public.order_messages
  for each row execute function public.order_alert_ping();
