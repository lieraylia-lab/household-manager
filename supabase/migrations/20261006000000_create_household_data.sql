create extension if not exists pgcrypto;

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  amount numeric(12, 2) not null check (amount >= 0),
  due_date date not null,
  category text not null check (char_length(trim(category)) between 1 and 100),
  paid boolean not null default false,
  file_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  amount numeric(12, 2) not null check (amount >= 0),
  category text not null check (char_length(trim(category)) between 1 and 100),
  created_at timestamptz not null default now()
);

create index if not exists bills_user_due_date_idx
  on public.bills (user_id, due_date);
create index if not exists expenses_user_created_at_idx
  on public.expenses (user_id, created_at desc);

alter table public.bills enable row level security;
alter table public.expenses enable row level security;

grant select, insert, update, delete on public.bills to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;

create policy "Users manage their own bills"
  on public.bills
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own expenses"
  on public.expenses
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
