create table if not exists public.persistent_state_records (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  state_key text not null,
  state_value jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists persistent_state_records_scope_state_key_unique
  on public.persistent_state_records (scope, state_key);

create index if not exists idx_persistent_state_records_updated_at
  on public.persistent_state_records (updated_at desc);

alter table public.persistent_state_records enable row level security;

drop policy if exists persistent_state_records_service_role_only on public.persistent_state_records;
drop policy if exists "persistent_state_service_role_only" on public.persistent_state_records;
drop policy if exists "persistent state service role only" on public.persistent_state_records;

create policy persistent_state_records_service_role_only
  on public.persistent_state_records
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.touch_persistent_state_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_persistent_state_records_updated_at on public.persistent_state_records;

create trigger trg_persistent_state_records_updated_at
before update on public.persistent_state_records
for each row execute function public.touch_persistent_state_records_updated_at();
