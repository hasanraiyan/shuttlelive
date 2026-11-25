-- Allow organizers to enable/disable the AI voice assistant on a tournament's public pages (default: enabled).
alter table public.tournaments
  add column voice_assistant_enabled boolean not null default true;

grant update (voice_assistant_enabled) on public.tournaments to authenticated;
