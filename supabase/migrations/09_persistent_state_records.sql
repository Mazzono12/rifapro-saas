-- Durable replacement layer for the former in-memory mock DB in server.ts.
-- Each collection is persisted as JSONB while the monolith is incrementally
-- normalized into first-class relational tables.

create table if not exists public.persistent_state_records (
  tenant_id text not null default 'platform',
  collection text not null,
  record_key text not null default 'singleton',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, collection, record_key)
);

create index if not exists idx_persistent_state_records_collection
  on public.persistent_state_records (collection);

create index if not exists idx_persistent_state_records_updated
  on public.persistent_state_records (updated_at desc);

alter table public.persistent_state_records enable row level security;

drop policy if exists "persistent_state_service_role_only" on public.persistent_state_records;
create policy "persistent_state_service_role_only"
  on public.persistent_state_records
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.touch_persistent_state_records_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_persistent_state_records_updated_at on public.persistent_state_records;
create trigger trg_persistent_state_records_updated_at
before update on public.persistent_state_records
for each row execute function public.touch_persistent_state_records_updated_at();
