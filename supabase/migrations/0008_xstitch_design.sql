-- Cross Stitch Lab is now XStitch.Design (xstitch-design.vercel.app).
-- Order codes start with XSD- from now on; CSL- and SBS- stay valid for orders made under the earlier names.
alter table public.orders drop constraint if exists orders_code_check;
alter table public.orders add constraint orders_code_check check (code ~ '^(XSD|CSL|SBS)-[A-Z0-9]{6}$');

-- the team's public name in the community gallery
update public.creators set display_name = 'XStitch.Design' where display_name in ('Cross Stitch Lab', 'Stitch by Style');

-- the team's post descriptions mention the app by name (e.g. the Little Monsters series)
update public.posts p set description = replace(replace(p.description, 'Stitch by Style', 'XStitch.Design'), 'Cross Stitch Lab', 'XStitch.Design')
  from public.creators c
 where c.user_id = p.author and c.official
   and (p.description like '%Stitch by Style%' or p.description like '%Cross Stitch Lab%');
