-- Patch 4: Security fix — stop a logged-in user from self-issuing a
-- course "pass" and a fake certificate.
--
-- Why this was needed: the RLS policy "enrollments: self can update own
-- progress" correctly checks that a user only touches their OWN
-- course_enrollments row, but Postgres row-level security does not
-- restrict which COLUMNS get changed. Supabase's default table grants
-- give every logged-in user UPDATE (and INSERT) rights on every column,
-- including `passed`, `quiz_score`, and `certificate_code` — the exact
-- fields complete_course() (in patch 2) is supposed to be the only way
-- to set. In practice this meant any signed-in user could open the
-- browser console and run:
--   supabase.from('course_enrollments').update({ passed: true,
--     quiz_score: 100, certificate_code: 'ANYTHING' }).eq('user_id', me)
-- and hand themselves a real, verifiable NODE certificate without ever
-- watching a lesson or passing the quiz. This patch locks client
-- INSERT/UPDATE down to only the columns users are meant to touch
-- themselves. Run this once in the Supabase SQL Editor. Safe to run again.

revoke insert on public.course_enrollments from authenticated;
grant insert (user_id, course_id, completed_lessons) on public.course_enrollments to authenticated;

revoke update on public.course_enrollments from authenticated;
grant update (completed_lessons) on public.course_enrollments to authenticated;

-- passed / quiz_score / certificate_code can now only be set by the
-- security-definer complete_course() function (patch 2), which runs
-- with elevated privileges and is not limited by the grants above.
