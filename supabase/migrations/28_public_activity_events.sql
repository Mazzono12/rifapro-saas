create table if not exists public.public_activity_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  raffle_id text,
  event_type text not null check (event_type in ('purchase_created','purchase_approved','instant_prize','mystery_box','new_affiliate','raffle_ending')),
  display_name_masked text not null,
  amount numeric not null default 0,
  quantity integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists public_activity_events_tenant_raffle_created_idx
  on public.public_activity_events (tenant_id, raffle_id, created_at desc);

create index if not exists public_activity_events_visible_idx
  on public.public_activity_events (tenant_id, visible, created_at desc);

alter table public.public_activity_events enable row level security;

drop policy if exists public_activity_events_tenant_select on public.public_activity_events;
create policy public_activity_events_tenant_select
  on public.public_activity_events
  for select
  using (public.can_access_tenant(tenant_id));

drop policy if exists public_activity_events_tenant_insert on public.public_activity_events;
create policy public_activity_events_tenant_insert
  on public.public_activity_events
  for insert
  with check (public.can_access_tenant(tenant_id));

drop policy if exists public_activity_events_tenant_update on public.public_activity_events;
create policy public_activity_events_tenant_update
  on public.public_activity_events
  for update
  using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));
