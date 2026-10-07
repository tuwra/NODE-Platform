-- Interactive lab experiments: each row is a ready-made circuit built on
-- Wokwi (the free Arduino/ESP32/ESP8266 simulator) and embedded on the
-- public Labs page. Admins add/edit/remove these from the Content tab
-- like any other content type -- no code needed.

create table if not exists public.lab_experiments (
  id uuid primary key default gen_random_uuid(),
  lab_id text not null default 'tech',
  title_ar text not null default '',
  title_en text not null default '',
  board text not null default '',
  desc_ar text not null default '',
  desc_en text not null default '',
  wokwi_url text not null default '',
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.lab_experiments enable row level security;

drop policy if exists "lab_experiments: public read published" on public.lab_experiments;
create policy "lab_experiments: public read published" on public.lab_experiments
  for select using (is_published or public.is_admin());

drop policy if exists "lab_experiments: admin write" on public.lab_experiments;
create policy "lab_experiments: admin write" on public.lab_experiments
  for all using (public.is_admin()) with check (public.is_admin());
