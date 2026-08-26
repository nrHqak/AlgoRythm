alter table public.tasks
add column if not exists pattern text not null default 'uncategorized';
