create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  customer_id uuid,
  nome text not null,
  telefone text not null,
  email text,
  cpf_mascarado text,
  cidade text,
  estado text,
  origem text not null default 'manual',
  tags text[] not null default '{}',
  score integer not null default 0,
  status text not null default 'lead' check (status in ('lead','comprador','vip','inativo','bloqueado')),
  pipeline_stage text not null default 'novo lead' check (pipeline_stage in ('novo lead','interessado','comprou','recorrente','vip','inativo','perdido')),
  last_purchase_at timestamptz,
  total_spent numeric not null default 0,
  total_orders integer not null default 0,
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_contacts_tenant_status_idx on public.crm_contacts (tenant_id, status);
create index if not exists crm_contacts_tenant_pipeline_idx on public.crm_contacts (tenant_id, pipeline_stage);
create index if not exists crm_contacts_tenant_score_idx on public.crm_contacts (tenant_id, score desc);

alter table public.crm_contacts enable row level security;

drop policy if exists crm_contacts_tenant_select on public.crm_contacts;
create policy crm_contacts_tenant_select
  on public.crm_contacts for select
  using (public.can_access_tenant(tenant_id));

drop policy if exists crm_contacts_tenant_insert on public.crm_contacts;
create policy crm_contacts_tenant_insert
  on public.crm_contacts for insert
  with check (public.can_access_tenant(tenant_id));

drop policy if exists crm_contacts_tenant_update on public.crm_contacts;
create policy crm_contacts_tenant_update
  on public.crm_contacts for update
  using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

create table if not exists public.crm_contact_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  contact_id uuid not null references public.crm_contacts(id),
  actor_user_id uuid,
  note text not null,
  created_at timestamptz not null default now()
);

alter table public.crm_contact_notes enable row level security;

drop policy if exists crm_contact_notes_tenant_all on public.crm_contact_notes;
create policy crm_contact_notes_tenant_all
  on public.crm_contact_notes for all
  using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));
