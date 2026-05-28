-- Compliance, auditoria imutavel, cotas auditadas, LGPD, antifraude e sorteio auditavel.

create table if not exists public.audit_event_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  actor_user_id uuid,
  actor_role text,
  action text not null,
  resource_type text not null,
  resource_id text,
  before_data jsonb,
  after_data jsonb,
  reason text not null,
  ip_address text,
  user_agent text,
  request_id text,
  hash text not null,
  previous_hash text,
  created_at timestamptz default now()
);

create table if not exists public.ticket_adjustments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  order_id uuid,
  customer_id uuid,
  raffle_id uuid,
  adjustment_type text not null check (adjustment_type in ('add','remove','swap','move')),
  old_numbers jsonb default '[]'::jsonb,
  new_numbers jsonb default '[]'::jsonb,
  reason text not null,
  financial_impact numeric default 0,
  actor_user_id uuid,
  created_at timestamptz default now()
);

create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  customer_id uuid,
  affiliate_ref text,
  source_type text not null check (source_type in ('purchase','affiliate_commission','cashback','instant_prize','manual_credit','manual_debit','withdrawal_requested','withdrawal_approved','withdrawal_rejected','refund','ticket_adjustment')),
  source_id text,
  amount numeric not null,
  reason text not null,
  actor_user_id uuid,
  created_at timestamptz default now()
);

create table if not exists public.raffle_draw_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  raffle_id uuid,
  draw_method text,
  public_seed text,
  server_seed_hash text,
  server_seed_revealed text,
  external_reference text,
  eligible_numbers_hash text,
  winning_number text,
  algorithm_version text,
  result_hash text,
  audit_pdf_url text,
  created_at timestamptz default now()
);

create table if not exists public.customer_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  customer_id uuid,
  consent_type text not null,
  status text not null check (status in ('accepted','revoked')),
  terms_version text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create table if not exists public.data_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  customer_id uuid,
  request_type text not null check (request_type in ('export','anonymize','block','logical_delete')),
  status text not null check (status in ('requested','completed','rejected')),
  reason text not null,
  result jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists public.fraud_signals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  customer_id uuid,
  order_id uuid,
  signal_type text not null,
  severity text not null check (severity in ('low','medium','high')),
  metadata jsonb default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz default now()
);

create index if not exists audit_event_ledger_tenant_idx on public.audit_event_ledger (tenant_id, created_at desc);
create index if not exists ticket_adjustments_tenant_idx on public.ticket_adjustments (tenant_id, created_at desc);
create index if not exists wallet_ledger_tenant_customer_idx on public.wallet_ledger (tenant_id, customer_id, created_at desc);
create index if not exists raffle_draw_audit_raffle_idx on public.raffle_draw_audit (tenant_id, raffle_id);
create index if not exists fraud_signals_tenant_idx on public.fraud_signals (tenant_id, status, created_at desc);

create or replace function public.prevent_immutable_compliance_update_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'immutable compliance ledger records cannot be updated or deleted';
end;
$$;

drop trigger if exists audit_event_ledger_immutable_update on public.audit_event_ledger;
drop trigger if exists audit_event_ledger_immutable_delete on public.audit_event_ledger;
create trigger audit_event_ledger_immutable_update before update on public.audit_event_ledger for each row execute function public.prevent_immutable_compliance_update_delete();
create trigger audit_event_ledger_immutable_delete before delete on public.audit_event_ledger for each row execute function public.prevent_immutable_compliance_update_delete();

alter table public.audit_event_ledger enable row level security;
alter table public.ticket_adjustments enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.raffle_draw_audit enable row level security;
alter table public.customer_consents enable row level security;
alter table public.data_privacy_requests enable row level security;
alter table public.fraud_signals enable row level security;

-- Policies follow the existing service/backend clean-room pattern: tenant access is enforced by backend/session helpers.
-- No update/delete policies are created for audit_event_ledger, making it append-only for normal clients.
