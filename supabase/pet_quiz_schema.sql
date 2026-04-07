create table if not exists public.pet_profiles (
  user_id uuid references public.profiles(id) primary key,
  pet_name text not null default 'Byte',
  hunger integer not null default 42,
  mood integer not null default 68,
  energy integer not null default 74,
  evolution_points integer not null default 0,
  last_fed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) not null,
  quiz_day date not null,
  question_key text not null,
  prompt text not null,
  correct boolean not null default false,
  xp_earned integer not null default 0,
  response_ms integer,
  created_at timestamptz not null default now(),
  unique(user_id, quiz_day, question_key)
);

create index if not exists idx_quiz_attempts_user_day
  on public.quiz_attempts(user_id, quiz_day desc);
