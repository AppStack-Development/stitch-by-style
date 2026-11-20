-- Stitch by Style is now Cross Stitch Lab (cross-stitch-lab.vercel.app).
-- Order codes start with CSL- from now on; SBS- stays valid for any order made before the change.
alter table public.orders drop constraint if exists orders_code_check;
alter table public.orders add constraint orders_code_check check (code ~ '^(CSL|SBS)-[A-Z0-9]{6}$');

-- the team's public name in the community gallery
update public.creators set display_name = 'Cross Stitch Lab' where display_name = 'Stitch by Style';
