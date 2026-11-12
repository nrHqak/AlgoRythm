-- SOURCE-VERIFIED RECOVERY CANDIDATE. Not release-approved; not a CLI migration.

-- Generated offline by scripts/schema_recovery.py from the screened metadata snapshot.

-- Represents the task-pattern and old RLS migrations already present in the source.

-- Preserves LEGACY browser INSERT/UPDATE grants; never activate this snapshot alone.

-- No managed schemas, Auth users, platform roles, defaults, event triggers or history are restored.

-- Local review must explicitly SET algorythm.schema_recovery = 'local-review' first.

begin;

set local search_path = public, pg_catalog;

do $$ begin
  if current_setting('algorythm.schema_recovery',true) is distinct from 'local-review' then
    raise exception 'Recovery candidate requires explicit local-review opt-in; no remote initialization approval implied';
  end if;
  if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null then
    raise exception 'Managed Auth dependencies must already exist';
  end if;
end $$;

set local role postgres;

create table public."achievements" (
  "id" uuid default gen_random_uuid() not null,
  "slug" text not null,
  "title" text not null,
  "description" text not null,
  "icon" text not null,
  "xp_reward" integer default 50,
  "condition_type" text not null
);

create table public."mentor_messages" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "session_id" uuid,
  "role" text not null,
  "message" text not null,
  "trigger_type" text,
  "created_at" timestamp with time zone default now()
);

create table public."pet_profiles" (
  "user_id" uuid not null,
  "pet_name" text default 'Byte'::text not null,
  "hunger" integer default 42 not null,
  "mood" integer default 68 not null,
  "energy" integer default 74 not null,
  "evolution_points" integer default 0 not null,
  "last_fed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."profiles" (
  "id" uuid not null,
  "username" text not null,
  "xp" integer default 0,
  "level" integer default 1,
  "streak" integer default 0,
  "last_active_date" date,
  "created_at" timestamp with time zone default now()
);

create table public."quiz_attempts" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "quiz_day" date not null,
  "question_key" text not null,
  "prompt" text not null,
  "correct" boolean default false not null,
  "xp_earned" integer default 0 not null,
  "response_ms" integer,
  "created_at" timestamp with time zone default now() not null
);

create table public."sessions" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "code" text not null,
  "array_var" text default 'arr'::text,
  "trace" jsonb,
  "error" jsonb,
  "total_steps" integer,
  "algorithm_type" text,
  "solved" boolean default false,
  "attempts" integer default 1,
  "xp_earned" integer default 0,
  "created_at" timestamp with time zone default now()
);

create table public."task_progress" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "task_id" uuid,
  "status" text default 'locked'::text,
  "attempts" integer default 0,
  "best_steps" integer,
  "xp_earned" integer default 0,
  "completed_at" timestamp with time zone
);

create table public."tasks" (
  "id" uuid default gen_random_uuid() not null,
  "title" text not null,
  "description" text not null,
  "difficulty" text not null,
  "order_index" integer not null,
  "starter_code" text,
  "solution_hint" text,
  "expected_algorithm" text,
  "max_xp" integer default 100,
  "pattern" text default 'uncategorized'::text not null
);

create table public."user_achievements" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "achievement_id" uuid,
  "earned_at" timestamp with time zone default now()
);

alter table public."achievements" add constraint "achievements_pkey" PRIMARY KEY (id);

alter table public."achievements" add constraint "achievements_slug_key" UNIQUE (slug);

alter table public."mentor_messages" add constraint "mentor_messages_pkey" PRIMARY KEY (id);

alter table public."pet_profiles" add constraint "pet_profiles_pkey" PRIMARY KEY (user_id);

alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);

alter table public."profiles" add constraint "profiles_username_key" UNIQUE (username);

alter table public."quiz_attempts" add constraint "quiz_attempts_pkey" PRIMARY KEY (id);

alter table public."quiz_attempts" add constraint "quiz_attempts_user_id_quiz_day_question_key_key" UNIQUE (user_id, quiz_day, question_key);

alter table public."sessions" add constraint "sessions_pkey" PRIMARY KEY (id);

alter table public."task_progress" add constraint "task_progress_pkey" PRIMARY KEY (id);

alter table public."task_progress" add constraint "task_progress_user_id_task_id_key" UNIQUE (user_id, task_id);

alter table public."tasks" add constraint "tasks_pkey" PRIMARY KEY (id);

alter table public."user_achievements" add constraint "user_achievements_pkey" PRIMARY KEY (id);

alter table public."user_achievements" add constraint "user_achievements_user_id_achievement_id_key" UNIQUE (user_id, achievement_id);

alter table public."mentor_messages" add constraint "mentor_messages_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id);

alter table public."mentor_messages" add constraint "mentor_messages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id);

alter table public."pet_profiles" add constraint "pet_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id);

alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id);

alter table public."quiz_attempts" add constraint "quiz_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id);

alter table public."sessions" add constraint "sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id);

alter table public."task_progress" add constraint "task_progress_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.tasks(id);

alter table public."task_progress" add constraint "task_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id);

alter table public."user_achievements" add constraint "user_achievements_achievement_id_fkey" FOREIGN KEY (achievement_id) REFERENCES public.achievements(id);

alter table public."user_achievements" add constraint "user_achievements_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id);

CREATE INDEX idx_quiz_attempts_user_day ON public.quiz_attempts USING btree (user_id, quiz_day DESC);

alter table public."achievements" enable row level security;

revoke all privileges on table public."achievements" from public, anon, authenticated, service_role;

alter table public."mentor_messages" enable row level security;

revoke all privileges on table public."mentor_messages" from public, anon, authenticated, service_role;

alter table public."pet_profiles" enable row level security;

revoke all privileges on table public."pet_profiles" from public, anon, authenticated, service_role;

alter table public."profiles" enable row level security;

revoke all privileges on table public."profiles" from public, anon, authenticated, service_role;

alter table public."quiz_attempts" enable row level security;

revoke all privileges on table public."quiz_attempts" from public, anon, authenticated, service_role;

alter table public."sessions" enable row level security;

revoke all privileges on table public."sessions" from public, anon, authenticated, service_role;

alter table public."task_progress" enable row level security;

revoke all privileges on table public."task_progress" from public, anon, authenticated, service_role;

alter table public."tasks" enable row level security;

revoke all privileges on table public."tasks" from public, anon, authenticated, service_role;

alter table public."user_achievements" enable row level security;

revoke all privileges on table public."user_achievements" from public, anon, authenticated, service_role;

grant SELECT on table public."achievements" to "authenticated";

grant all privileges on table public."achievements" to "postgres";

grant all privileges on table public."achievements" to "service_role";

grant INSERT, SELECT, UPDATE on table public."mentor_messages" to "authenticated";

grant all privileges on table public."mentor_messages" to "postgres";

grant all privileges on table public."mentor_messages" to "service_role";

grant INSERT, SELECT, UPDATE on table public."pet_profiles" to "authenticated";

grant all privileges on table public."pet_profiles" to "postgres";

grant all privileges on table public."pet_profiles" to "service_role";

grant INSERT, SELECT, UPDATE on table public."profiles" to "authenticated";

grant all privileges on table public."profiles" to "postgres";

grant all privileges on table public."profiles" to "service_role";

grant INSERT, SELECT, UPDATE on table public."quiz_attempts" to "authenticated";

grant all privileges on table public."quiz_attempts" to "postgres";

grant all privileges on table public."quiz_attempts" to "service_role";

grant SELECT on table public."sessions" to "authenticated";

grant all privileges on table public."sessions" to "postgres";

grant all privileges on table public."sessions" to "service_role";

grant INSERT, SELECT, UPDATE on table public."task_progress" to "authenticated";

grant all privileges on table public."task_progress" to "postgres";

grant all privileges on table public."task_progress" to "service_role";

grant SELECT on table public."tasks" to "authenticated";

grant all privileges on table public."tasks" to "postgres";

grant all privileges on table public."tasks" to "service_role";

grant SELECT on table public."user_achievements" to "authenticated";

grant all privileges on table public."user_achievements" to "postgres";

grant all privileges on table public."user_achievements" to "service_role";

create policy "achievements_authenticated_select" on public."achievements" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "mentor_messages_owner_insert" on public."mentor_messages" as PERMISSIVE for INSERT to "authenticated" with check (((( SELECT auth.uid() AS uid) = user_id) AND ((session_id IS NULL) OR (EXISTS ( SELECT 1
   FROM sessions
  WHERE ((sessions.id = mentor_messages.session_id) AND (sessions.user_id = ( SELECT auth.uid() AS uid))))))));

create policy "mentor_messages_owner_select" on public."mentor_messages" as PERMISSIVE for SELECT to "authenticated" using (((( SELECT auth.uid() AS uid) = user_id) AND ((session_id IS NULL) OR (EXISTS ( SELECT 1
   FROM sessions
  WHERE ((sessions.id = mentor_messages.session_id) AND (sessions.user_id = ( SELECT auth.uid() AS uid))))))));

create policy "mentor_messages_owner_update" on public."mentor_messages" as PERMISSIVE for UPDATE to "authenticated" using (((( SELECT auth.uid() AS uid) = user_id) AND ((session_id IS NULL) OR (EXISTS ( SELECT 1
   FROM sessions
  WHERE ((sessions.id = mentor_messages.session_id) AND (sessions.user_id = ( SELECT auth.uid() AS uid)))))))) with check (((( SELECT auth.uid() AS uid) = user_id) AND ((session_id IS NULL) OR (EXISTS ( SELECT 1
   FROM sessions
  WHERE ((sessions.id = mentor_messages.session_id) AND (sessions.user_id = ( SELECT auth.uid() AS uid))))))));

create policy "pet_profiles_owner_insert" on public."pet_profiles" as PERMISSIVE for INSERT to "authenticated" with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "pet_profiles_owner_select" on public."pet_profiles" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id));

create policy "pet_profiles_owner_update" on public."pet_profiles" as PERMISSIVE for UPDATE to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "profiles_owner_insert" on public."profiles" as PERMISSIVE for INSERT to "authenticated" with check ((( SELECT auth.uid() AS uid) = id));

create policy "profiles_owner_select" on public."profiles" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = id));

create policy "profiles_owner_update" on public."profiles" as PERMISSIVE for UPDATE to "authenticated" using ((( SELECT auth.uid() AS uid) = id)) with check ((( SELECT auth.uid() AS uid) = id));

create policy "quiz_attempts_owner_insert" on public."quiz_attempts" as PERMISSIVE for INSERT to "authenticated" with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "quiz_attempts_owner_select" on public."quiz_attempts" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id));

create policy "quiz_attempts_owner_update" on public."quiz_attempts" as PERMISSIVE for UPDATE to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "sessions_owner_select" on public."sessions" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id));

create policy "task_progress_owner_insert" on public."task_progress" as PERMISSIVE for INSERT to "authenticated" with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "task_progress_owner_select" on public."task_progress" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id));

create policy "task_progress_owner_update" on public."task_progress" as PERMISSIVE for UPDATE to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "tasks_authenticated_select" on public."tasks" as PERMISSIVE for SELECT to "authenticated" using (true);

create policy "user_achievements_owner_select" on public."user_achievements" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id));

commit;
