-- Read-only curriculum catalog.
alter table public.tasks enable row level security;
revoke all privileges on table public.tasks from anon, authenticated;
grant select on table public.tasks to authenticated;

drop policy if exists tasks_authenticated_select on public.tasks;
create policy tasks_authenticated_select
on public.tasks
for select
to authenticated
using (true);

do $$
begin
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.tasks'::regclass)
     or (select count(*) from pg_catalog.pg_policy where polrelid = 'public.tasks'::regclass) <> 1 then
    raise exception 'RLS verification failed for public.tasks';
  end if;
end;
$$;

-- Read-only achievements catalog.
alter table public.achievements enable row level security;
revoke all privileges on table public.achievements from anon, authenticated;
grant select on table public.achievements to authenticated;

drop policy if exists achievements_authenticated_select on public.achievements;
create policy achievements_authenticated_select
on public.achievements
for select
to authenticated
using (true);

do $$
begin
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.achievements'::regclass)
     or (select count(*) from pg_catalog.pg_policy where polrelid = 'public.achievements'::regclass) <> 1 then
    raise exception 'RLS verification failed for public.achievements';
  end if;
end;
$$;

-- Sessions are written by the backend service role and read by their owner.
alter table public.sessions enable row level security;
revoke all privileges on table public.sessions from anon, authenticated;
grant select on table public.sessions to authenticated;

drop policy if exists sessions_owner_select on public.sessions;
create policy sessions_owner_select
on public.sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

do $$
begin
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.sessions'::regclass)
     or (select count(*) from pg_catalog.pg_policy where polrelid = 'public.sessions'::regclass) <> 1 then
    raise exception 'RLS verification failed for public.sessions';
  end if;
end;
$$;

-- Achievement awards are written by the backend service role and read by their owner.
alter table public.user_achievements enable row level security;
revoke all privileges on table public.user_achievements from anon, authenticated;
grant select on table public.user_achievements to authenticated;

drop policy if exists user_achievements_owner_select on public.user_achievements;
create policy user_achievements_owner_select
on public.user_achievements
for select
to authenticated
using ((select auth.uid()) = user_id);

do $$
begin
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.user_achievements'::regclass)
     or (select count(*) from pg_catalog.pg_policy where polrelid = 'public.user_achievements'::regclass) <> 1 then
    raise exception 'RLS verification failed for public.user_achievements';
  end if;
end;
$$;

-- Profiles are readable and editable only by their owner.
alter table public.profiles enable row level security;
revoke all privileges on table public.profiles from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists profiles_owner_select on public.profiles;
drop policy if exists profiles_owner_insert on public.profiles;
drop policy if exists profiles_owner_update on public.profiles;

create policy profiles_owner_select
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_owner_insert
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy profiles_owner_update
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

do $$
begin
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.profiles'::regclass)
     or (select count(*) from pg_catalog.pg_policy where polrelid = 'public.profiles'::regclass) <> 3 then
    raise exception 'RLS verification failed for public.profiles';
  end if;
end;
$$;

-- Quiz attempts are readable and editable only by their owner.
alter table public.quiz_attempts enable row level security;
revoke all privileges on table public.quiz_attempts from anon, authenticated;
grant select, insert, update on table public.quiz_attempts to authenticated;

drop policy if exists quiz_attempts_owner_select on public.quiz_attempts;
drop policy if exists quiz_attempts_owner_insert on public.quiz_attempts;
drop policy if exists quiz_attempts_owner_update on public.quiz_attempts;

create policy quiz_attempts_owner_select
on public.quiz_attempts
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy quiz_attempts_owner_insert
on public.quiz_attempts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy quiz_attempts_owner_update
on public.quiz_attempts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

do $$
begin
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.quiz_attempts'::regclass)
     or (select count(*) from pg_catalog.pg_policy where polrelid = 'public.quiz_attempts'::regclass) <> 3 then
    raise exception 'RLS verification failed for public.quiz_attempts';
  end if;
end;
$$;

-- Pet state is readable and editable only by its owner.
alter table public.pet_profiles enable row level security;
revoke all privileges on table public.pet_profiles from anon, authenticated;
grant select, insert, update on table public.pet_profiles to authenticated;

drop policy if exists pet_profiles_owner_select on public.pet_profiles;
drop policy if exists pet_profiles_owner_insert on public.pet_profiles;
drop policy if exists pet_profiles_owner_update on public.pet_profiles;

create policy pet_profiles_owner_select
on public.pet_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy pet_profiles_owner_insert
on public.pet_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy pet_profiles_owner_update
on public.pet_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

do $$
begin
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.pet_profiles'::regclass)
     or (select count(*) from pg_catalog.pg_policy where polrelid = 'public.pet_profiles'::regclass) <> 3 then
    raise exception 'RLS verification failed for public.pet_profiles';
  end if;
end;
$$;

-- Task progress is readable and editable only by its owner.
alter table public.task_progress enable row level security;
revoke all privileges on table public.task_progress from anon, authenticated;
grant select, insert, update on table public.task_progress to authenticated;

drop policy if exists task_progress_owner_select on public.task_progress;
drop policy if exists task_progress_owner_insert on public.task_progress;
drop policy if exists task_progress_owner_update on public.task_progress;

create policy task_progress_owner_select
on public.task_progress
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy task_progress_owner_insert
on public.task_progress
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy task_progress_owner_update
on public.task_progress
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

do $$
begin
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.task_progress'::regclass)
     or (select count(*) from pg_catalog.pg_policy where polrelid = 'public.task_progress'::regclass) <> 3 then
    raise exception 'RLS verification failed for public.task_progress';
  end if;
end;
$$;

-- Mentor messages belong to the user and, when linked, to one of that user's sessions.
alter table public.mentor_messages enable row level security;
revoke all privileges on table public.mentor_messages from anon, authenticated;
grant select, insert, update on table public.mentor_messages to authenticated;

drop policy if exists mentor_messages_owner_select on public.mentor_messages;
drop policy if exists mentor_messages_owner_insert on public.mentor_messages;
drop policy if exists mentor_messages_owner_update on public.mentor_messages;

create policy mentor_messages_owner_select
on public.mentor_messages
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (
    session_id is null
    or exists (
      select 1
      from public.sessions
      where sessions.id = mentor_messages.session_id
        and sessions.user_id = (select auth.uid())
    )
  )
);

create policy mentor_messages_owner_insert
on public.mentor_messages
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    session_id is null
    or exists (
      select 1
      from public.sessions
      where sessions.id = mentor_messages.session_id
        and sessions.user_id = (select auth.uid())
    )
  )
);

create policy mentor_messages_owner_update
on public.mentor_messages
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and (
    session_id is null
    or exists (
      select 1
      from public.sessions
      where sessions.id = mentor_messages.session_id
        and sessions.user_id = (select auth.uid())
    )
  )
)
with check (
  (select auth.uid()) = user_id
  and (
    session_id is null
    or exists (
      select 1
      from public.sessions
      where sessions.id = mentor_messages.session_id
        and sessions.user_id = (select auth.uid())
    )
  )
);

do $$
begin
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.mentor_messages'::regclass)
     or (select count(*) from pg_catalog.pg_policy where polrelid = 'public.mentor_messages'::regclass) <> 3 then
    raise exception 'RLS verification failed for public.mentor_messages';
  end if;
end;
$$;
