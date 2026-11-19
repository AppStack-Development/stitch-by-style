-- Stitch by Style: the 10-shares-a-day spam guard (0003) applies to everyone except the official team
-- account(s) (creators.official, set only in the dashboard), which publish curated patterns in batches.

create or replace function public.posts_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.creators where user_id = new.author and official) then
    return new;
  end if;
  if (select count(*) from public.posts
      where author = new.author and created_at > now() - interval '1 day') >= 10 then
    raise exception 'share limit reached: at most 10 patterns per day' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.posts_rate_limit() from public, anon, authenticated;
