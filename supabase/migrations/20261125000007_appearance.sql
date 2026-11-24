-- Phase 1: appearance studio. Event colours for the public page, poster and share card.
-- Contrast is checked in the app; the database only accepts well-formed hex colours.

alter table public.tournaments
  add column brand_primary text check (brand_primary ~ '^#[0-9a-f]{6}$'),
  add column brand_accent  text check (brand_accent  ~ '^#[0-9a-f]{6}$');

grant update (brand_primary, brand_accent) on public.tournaments to authenticated;
