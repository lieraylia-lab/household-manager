create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year integer not null check (year between 2000 and 9999),
  month integer not null check (month between 1 and 12),
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year, month)
);

alter table public.monthly_budgets enable row level security;

grant select, insert, update on public.monthly_budgets to authenticated;

create policy "Users manage their own monthly budgets"
  on public.monthly_budgets
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
