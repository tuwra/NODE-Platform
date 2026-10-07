-- Patch 3: Site settings (home/about/contact/footer text + brand colors),
-- editable from the admin dashboard with no code.
-- Run this once in the Supabase SQL Editor. Safe to run again.

create table if not exists public.site_settings (
  id text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "site_settings: public read" on public.site_settings;
create policy "site_settings: public read" on public.site_settings
  for select using (true);

drop policy if exists "site_settings: admin write" on public.site_settings;
create policy "site_settings: admin write" on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Keep updated_at current on every save.
create or replace function public.touch_site_settings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_site_settings on public.site_settings;
create trigger trg_touch_site_settings
  before update on public.site_settings
  for each row execute function public.touch_site_settings();

-- Seed the five editable sections (safe to re-run: does nothing if they
-- already exist, so it never overwrites text an admin already edited).
insert into public.site_settings (id, value) values
  ('home', '{}'),
  ('about', '{}'),
  ('contact', '{}'),
  ('footer', '{}'),
  ('brand', '{}')
on conflict (id) do nothing;
