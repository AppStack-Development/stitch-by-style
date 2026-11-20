-- XStitch.Design: price "fully stitched" by the number of stitches instead of by size alone.
-- unit = price:stitched:<size> (a starting price, set to the kit price) + stitch_rate × stitches,
-- rounded up to a price ending in 9 (201.8 -> 209, 209 -> 209). Blank and kit stay a flat price per size.
-- Keep order_unit_price() in step with unitPrice() in src/lib/orders.ts.

-- allow the new key; the rate is baht with up to 2 decimals, e.g. 0.30
alter table public.order_config drop constraint if exists order_config_key_check;
alter table public.order_config add constraint order_config_key_check
  check (key ~ '^(price:(blank|kit|stitched):(S|M|L)|shipping|stitch_rate|promptpay_id|promptpay_name)$');
alter table public.order_config drop constraint if exists order_config_stitch_rate_check;
alter table public.order_config add constraint order_config_stitch_rate_check
  check (key <> 'stitch_rate' or value ~ '^[0-9]{1,2}(\.[0-9]{1,2})?$');

insert into public.order_config (key, value) values ('stitch_rate', '0.30')
on conflict (key) do update set value = excluded.value;
-- starting prices for fully stitched = the kit prices (were 390 / 750 / 1290 per size)
update public.order_config set value = '159' where key = 'price:stitched:S';
update public.order_config set value = '219' where key = 'price:stitched:M';
update public.order_config set value = '329' where key = 'price:stitched:L';

-- the rate is public like the prices, so signed-out visitors see the same price as the form
drop policy if exists "prices are public" on public.order_config;
create policy "prices are public" on public.order_config for select to anon
  using (key like 'price:%' or key in ('shipping', 'stitch_rate'));

create or replace function public.order_unit_price(p_product text, p_size text, p_stitches int) returns int
language plpgsql stable security definer set search_path = '' as $$
declare base int; rate numeric;
begin
  select value::int into base from public.order_config where key = 'price:' || p_product || ':' || p_size;
  if base is null then return null; end if;
  if p_product <> 'stitched' then return base; end if;
  select value::numeric into rate from public.order_config where key = 'stitch_rate';
  if rate is null then return null; end if;
  return (ceil((base + rate * p_stitches + 1) / 10.0) * 10 - 1)::int;
end $$;
revoke all on function public.order_unit_price(text, text, int) from public, anon;
grant execute on function public.order_unit_price(text, text, int) to authenticated;

-- same as 0009, plus: a sane stitch count, and the unit price from order_unit_price()
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
  if new.stitches < 1 or new.stitches > new.cols * new.rows then
    raise exception 'bad stitch count' using errcode = 'P0001';
  end if;
  new.size := public.order_size(new.cols, new.rows, new.pitch_mm);
  if new.size is null then raise exception 'piece too large' using errcode = 'P0001'; end if;
  unit := public.order_unit_price(new.product, new.size, new.stitches);
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
