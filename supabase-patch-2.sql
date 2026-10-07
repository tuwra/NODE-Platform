-- Patch 2: Courses (دورات) with video lessons, quizzes, and certificates.
-- Run this once in Supabase SQL Editor. Safe to run again.

-- ---------------------------------------------------------------------
-- Courses (each course holds its lessons and quiz as JSON, edited from
-- the admin dashboard — no code needed to add a course, a video lesson,
-- or a quiz question)
-- ---------------------------------------------------------------------
create table if not exists public.courses (
  id text primary key,
  title_ar text not null default '',
  title_en text not null default '',
  cat text not null default '',
  level text not null default '',
  desc_ar text not null default '',
  desc_en text not null default '',
  lessons jsonb not null default '[]',   -- [{title_ar,title_en,video_url}]
  quiz jsonb not null default '[]',      -- [{q_ar,q_en,options:[...],correct:0}]
  passing_score int not null default 60,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;

drop policy if exists "courses: public read published" on public.courses;
create policy "courses: public read published" on public.courses
  for select using (is_published or public.is_admin());

drop policy if exists "courses: admin write" on public.courses;
create policy "courses: admin write" on public.courses
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Enrollments: one row per (user, course) — tracks watched lessons,
-- the last quiz score, pass/fail, and the certificate code once passed.
-- ---------------------------------------------------------------------
create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  completed_lessons jsonb not null default '[]',
  quiz_score int,
  passed boolean not null default false,
  certificate_code text unique,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

alter table public.course_enrollments enable row level security;

drop policy if exists "enrollments: self or admin read" on public.course_enrollments;
create policy "enrollments: self or admin read" on public.course_enrollments
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "enrollments: logged-in users can enroll" on public.course_enrollments;
create policy "enrollments: logged-in users can enroll" on public.course_enrollments
  for insert with check (auth.uid() = user_id);

drop policy if exists "enrollments: self can update own progress" on public.course_enrollments;
create policy "enrollments: self can update own progress" on public.course_enrollments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Grading + certificate issuance is decided on the server (not a raw
-- client UPDATE): pass/fail is computed against the course's real
-- passing_score, and the certificate code is generated here so a user
-- can't invent their own.
create or replace function public.complete_course(p_course_id text, p_score int)
returns public.course_enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pass_mark int;
  v_passed boolean;
  v_row public.course_enrollments;
  v_code text;
begin
  select passing_score into v_pass_mark from public.courses where id = p_course_id;
  if v_pass_mark is null then
    raise exception 'course not found';
  end if;
  v_passed := p_score >= v_pass_mark;

  insert into public.course_enrollments (user_id, course_id, quiz_score, passed)
  values (auth.uid(), p_course_id, p_score, v_passed)
  on conflict (user_id, course_id) do update
    set quiz_score = excluded.quiz_score,
        passed = public.course_enrollments.passed or excluded.passed
  returning * into v_row;

  if v_row.passed and v_row.certificate_code is null then
    v_code := 'NODE-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8));
    update public.course_enrollments set certificate_code = v_code where id = v_row.id
      returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function public.complete_course(text,int) to authenticated;

-- Public certificate verification (no login needed) — returns only safe,
-- non-sensitive fields for the exact random code, so a certificate can be
-- checked by anyone who has it (e.g. an employer), without exposing the
-- whole enrollments table.
create or replace function public.verify_certificate(p_code text)
returns table(full_name text, course_title_ar text, course_title_en text, score int, issued_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select p.full_name, c.title_ar, c.title_en, e.quiz_score, e.created_at
  from public.course_enrollments e
  join public.profiles p on p.id = e.user_id
  join public.courses c on c.id = e.course_id
  where e.certificate_code = p_code and e.passed = true;
$$;

grant execute on function public.verify_certificate(text) to anon, authenticated;
