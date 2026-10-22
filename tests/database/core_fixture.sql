-- Disposable test assumptions ONLY. This is NOT the missing production baseline.
create schema auth;
create function auth.uid() returns uuid language sql stable as
$$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to anon,authenticated,service_role;
create table public.profiles(id uuid primary key,username text not null unique,xp integer default 0,
  level integer default 1,streak integer default 0,last_active_date date);
create table public.tasks(id uuid primary key,title text);
create table public.achievements(id uuid primary key,slug text,xp_reward integer);
create table public.sessions(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles,
 code text,array_var text,trace jsonb,error jsonb,total_steps integer,algorithm_type text,solved boolean,
 attempts integer,xp_earned integer,created_at timestamptz default now());
create table public.user_achievements(user_id uuid references public.profiles,achievement_id uuid references public.achievements);
create table public.task_progress(user_id uuid references public.profiles,task_id uuid references public.tasks,
 status text,attempts integer,best_steps integer,xp_earned integer,completed_at timestamptz,primary key(user_id,task_id));
create table public.quiz_attempts(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles,
 quiz_day date,question_key text,prompt text,correct boolean default false,xp_earned integer default 0,response_ms integer);
create table public.pet_profiles(user_id uuid primary key references public.profiles);
create table public.mentor_messages(user_id uuid references public.profiles,session_id uuid references public.sessions);
-- Include pre-existing PUBLIC and column grants so revocation is actually tested.
grant insert(xp),update(xp,level) on public.profiles to public;

insert into profiles(id,username,xp) values('00000000-0000-4000-8000-000000000099','legacy_snapshot',777);
