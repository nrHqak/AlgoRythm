-- Requires the reviewed core schema. Never apply against an inferred live baseline.
-- Existing balances/achievements remain historical and are NOT imported as trusted rewards.
begin;

do $$
declare item record;
begin
  for item in select * from (values ('profiles','id'), ('tasks','id'),
    ('sessions','id'), ('sessions','user_id')) as required(table_name, column_name)
  loop
    if not exists (select 1 from information_schema.columns where table_schema='public'
      and table_name=item.table_name and column_name=item.column_name and udt_name='uuid') then
      raise exception 'Reward migration requires reviewed UUID column %.%', item.table_name, item.column_name;
    end if;
  end loop;
end $$;

alter table public.profiles add column legacy_reward_snapshot jsonb;
update public.profiles set legacy_reward_snapshot=jsonb_build_object('xp',xp,'level',level,
  'streak',streak,'last_active_date',last_active_date);
alter table public.profiles alter column xp set default 0;
alter table public.profiles alter column level set default 1;
alter table public.profiles alter column streak set default 0;
alter table public.profiles alter column last_active_date set default null;
alter table public.sessions add column reward_policy text not null default 'legacy_unverified';
alter table public.sessions add column completion_verified boolean not null default false;
alter table public.sessions add column reported_task_id uuid;
alter table public.user_achievements add column verified boolean not null default false;
create unique index reward_achievement_owner_unique on public.user_achievements(user_id, achievement_id);

create table public.reward_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  xp bigint not null default 0 check (xp between 0 and 2147483647),
  level integer not null default 1 check (level between 1 and 5),
  streak integer not null default 0 check (streak between 0 and 2147483647),
  last_active_date date,
  save_day date,
  saves_today integer not null default 0 check (saves_today between 0 and 100)
);
create table public.practice_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  reported_completed boolean not null default false,
  attempts integer not null default 0 check (attempts between 0 and 2147483647),
  best_steps integer check (best_steps between 0 and 300),
  primary key(user_id, task_id)
);
create schema reward_private;
revoke all on schema reward_private from public, anon, authenticated;
grant usage on schema reward_private to service_role;
create table reward_private.session_settlements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation_id uuid not null,
  session_id uuid not null unique references public.sessions(id),
  request_payload jsonb not null,
  receipt jsonb not null,
  awarded_xp integer not null check (awarded_xp in (0,5)),
  reward_day date not null,
  primary key(user_id, operation_id)
);
create unique index one_activity_award_per_utc_day
  on reward_private.session_settlements(user_id, reward_day) where awarded_xp > 0;
alter table reward_private.session_settlements enable row level security;
revoke all on reward_private.session_settlements from public, anon, authenticated;
grant select, insert on reward_private.session_settlements to service_role;

-- Remove table AND old column grants, including PUBLIC grants. Replace policies
-- rather than OR-ing ownership with unknown permissive policies from a partial baseline.
do $$
declare target text; col text; policy_name text;
begin
  foreach target in array array['profiles','task_progress','sessions','user_achievements',
    'quiz_attempts','reward_accounts','practice_progress'] loop
    execute format('alter table public.%I enable row level security',target);
    execute format('revoke all on public.%I from public, anon, authenticated',target);
    for col in select column_name from information_schema.columns
      where table_schema='public' and table_name=target loop
      execute format('revoke all (%I) on public.%I from public, anon, authenticated',col,target);
    end loop;
    for policy_name in select policyname from pg_policies where schemaname='public' and tablename=target loop
      execute format('drop policy %I on public.%I',policy_name,target);
    end loop;
    execute format('grant select on public.%I to authenticated',target);
    execute format('create policy reward_owner_select on public.%I for select to authenticated using ((select auth.uid()) = %I)',
      target, case when target='profiles' then 'id' else 'user_id' end);
  end loop;
end $$;
grant insert(id, username), update(username) on public.profiles to authenticated;
create policy profiles_safe_insert on public.profiles for insert to authenticated with check ((select auth.uid())=id);
create policy profiles_safe_update on public.profiles for update to authenticated
  using ((select auth.uid())=id) with check ((select auth.uid())=id);
-- Quiz correctness is a practice claim; it cannot change any reward balance.
alter table public.quiz_attempts alter column xp_earned set default 0;
grant insert(user_id, quiz_day, question_key, prompt, correct, response_ms) on public.quiz_attempts to authenticated;
create policy quiz_practice_insert on public.quiz_attempts for insert to authenticated with check ((select auth.uid())=user_id);
grant select on public.profiles, public.tasks, public.sessions to service_role;
grant insert on public.sessions to service_role;
grant update(xp,level,streak,last_active_date) on public.profiles to service_role;
grant select, insert, update on public.reward_accounts, public.practice_progress to service_role;

create function public.settle_activity_session(p_user_id uuid, p_operation_id uuid, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  account public.reward_accounts%rowtype;
  prior reward_private.session_settlements%rowtype;
  now_utc timestamptz;
  today date;
  award integer := 0;
  reason text := 'daily_limit';
  saved_id uuid;
  task uuid;
  practice jsonb := null;
  receipt jsonb;
begin
  -- Service-only RPC; the API supplies ONLY its independently verified principal.
  if current_user <> 'service_role' or p_user_id is null then
    raise exception 'Service principal required' using errcode='42501';
  end if;
  if p_operation_id is null or jsonb_typeof(p_payload) is distinct from 'object'
    or (p_payload - array['code','array_var','trace','error','total_steps','algorithm_type','execution_succeeded','task_id']) <> '{}'::jsonb
    or jsonb_typeof(p_payload->'code') is distinct from 'string'
    or length(p_payload->>'code') > 200000
    or jsonb_typeof(p_payload->'trace') is distinct from 'array'
    or jsonb_array_length(p_payload->'trace') > 300
    or (p_payload->>'total_steps')::integer not between 0 and 300
    or pg_column_size(p_payload)>2000000 then
    raise exception 'Invalid session payload' using errcode='22023';
  end if;

  -- The unique account row serializes *all* tabs/instances for this owner.
  insert into public.reward_accounts(user_id) values(p_user_id) on conflict do nothing;
  select * into strict account from public.reward_accounts where user_id=p_user_id for update;
  select * into prior from reward_private.session_settlements
    where user_id=p_user_id and operation_id=p_operation_id;
  if found then
    if prior.request_payload <> p_payload then
      raise exception 'idempotency_conflict' using errcode='P0001';
    end if;
    return prior.receipt || jsonb_build_object('replayed',true);
  end if;
  -- Use DB wall-clock AFTER locking, never a client date or transaction-start date.
  now_utc := clock_timestamp();
  today := (now_utc at time zone 'UTC')::date;
  if account.save_day is distinct from today then account.saves_today := 0; end if;
  if account.saves_today >= 100 then
    raise exception 'activity_daily_limit' using errcode='P0001';
  end if;
  if account.last_active_date is distinct from today then
    if account.xp <= 2147483642 then
      award := 5; reason := 'awarded';
      account.streak := case when account.last_active_date=today-1
        then least(account.streak::bigint+1,2147483647)::integer else 1 end;
      account.last_active_date := today;
    else reason := 'balance_limit'; end if;
  end if;
  account.xp := account.xp + award;
  account.level := case when account.xp>=2000 then 5 when account.xp>=1000 then 4
    when account.xp>=500 then 3 when account.xp>=200 then 2 else 1 end;
  task := nullif(p_payload->>'task_id','')::uuid;

  insert into public.sessions(user_id,code,array_var,trace,error,total_steps,algorithm_type,
    solved,attempts,xp_earned,reward_policy,completion_verified,reported_task_id)
  values(p_user_id,p_payload->>'code',p_payload->>'array_var',p_payload->'trace',
    nullif(p_payload->'error','null'::jsonb),(p_payload->>'total_steps')::integer,
    p_payload->>'algorithm_type',coalesce((p_payload->>'execution_succeeded')::boolean,false),
    1,award,'activity-v1',false,task) returning id into saved_id;

  if task is not null and exists(select 1 from public.tasks where id=task) then
    insert into public.practice_progress(user_id,task_id,reported_completed,attempts,best_steps)
    values(p_user_id,task,coalesce((p_payload->>'execution_succeeded')::boolean,false),1,
      case when (p_payload->>'execution_succeeded')::boolean then (p_payload->>'total_steps')::integer end)
    on conflict(user_id,task_id) do update set
      reported_completed=public.practice_progress.reported_completed or excluded.reported_completed,
      attempts=least(public.practice_progress.attempts::bigint+1,2147483647)::integer,
      best_steps=least(public.practice_progress.best_steps,excluded.best_steps);
    select to_jsonb(row) into practice from public.practice_progress row where user_id=p_user_id and task_id=task;
  end if;
  update public.reward_accounts set xp=account.xp,level=account.level,streak=account.streak,
    last_active_date=account.last_active_date,save_day=today,saves_today=account.saves_today+1 where user_id=p_user_id;
  -- Compatibility mirror only. Legacy values never enter authoritative calculations.
  update public.profiles set xp=account.xp,level=account.level,streak=account.streak,
    last_active_date=account.last_active_date where id=p_user_id;
  receipt := jsonb_build_object('session_id',saved_id,'xp_awarded',award,'reward_status',reason,
    'completion_verified',false,'achievements_earned','[]'::jsonb,'practice_progress',practice,
    'profile',jsonb_build_object('xp',account.xp,'level',account.level,'streak',account.streak), 'replayed',false);
  insert into reward_private.session_settlements values(p_user_id,p_operation_id,saved_id,p_payload,receipt,award,today);
  return receipt;
end $$;
revoke all on function public.settle_activity_session(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.settle_activity_session(uuid,uuid,jsonb) to service_role;
comment on function public.settle_activity_session(uuid,uuid,jsonb) is
  'Service-only activity-v1: 5 XP once per UTC day, 100 saves/day; no completion proof or achievement grants.';
commit;
