-- XStitch.Design: order terms (#/order-terms). Every order records which version of the terms the customer
-- accepted when ordering (ORDER_TERMS_VERSION in src/lib/orders.ts), and an order can't be placed without it.

alter table public.orders add column if not exists terms_version text not null default ''
  check (char_length(terms_version) <= 20);
grant insert (terms_version) on public.orders to authenticated;

-- same as 0006, plus: the terms must have been accepted
create or replace function public.orders_prepare() returns trigger
language plpgsql security definer set search_path = '' as $$
declare unit int; ship int;
begin
  if coalesce(btrim(new.terms_version), '') = '' then
    raise exception 'order terms not accepted' using errcode = 'P0001';
  end if;
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
