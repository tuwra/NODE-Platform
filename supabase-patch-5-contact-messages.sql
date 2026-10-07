-- Contact form messages: lets the public "Contact us" form actually save
-- somewhere, and gives admins a place to read/manage what comes in.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new','read')),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- Anyone (including anonymous visitors) can submit a contact message.
drop policy if exists "anyone can submit contact message" on public.contact_messages;
create policy "anyone can submit contact message"
on public.contact_messages for insert
to anon, authenticated
with check (true);

-- Only admins can read, update (mark read) or delete messages.
drop policy if exists "admins can view contact messages" on public.contact_messages;
create policy "admins can view contact messages"
on public.contact_messages for select
to authenticated
using (public.is_admin());

drop policy if exists "admins can update contact messages" on public.contact_messages;
create policy "admins can update contact messages"
on public.contact_messages for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins can delete contact messages" on public.contact_messages;
create policy "admins can delete contact messages"
on public.contact_messages for delete
to authenticated
using (public.is_admin());

-- Defense in depth: even if a policy is ever loosened, restrict which
-- columns each role can touch at the grant level too.
revoke insert on public.contact_messages from anon, authenticated;
grant insert (name, email, subject, message) on public.contact_messages to anon, authenticated;

revoke update on public.contact_messages from authenticated;
grant update (status) on public.contact_messages to authenticated;

grant select, delete on public.contact_messages to authenticated;
