-- Base de governanca SaaS por tenant: planos, status operacional e feature flags.

alter table public.tenants
  add column if not exists plano text default 'pro',
  add column if not exists operational_status text default 'active',
  add column if not exists governance_metadata jsonb default '{}'::jsonb;

alter table public.tenants
  drop constraint if exists tenants_operational_status_check;

alter table public.tenants
  add constraint tenants_operational_status_check
  check (coalesce(operational_status, status, 'active') in ('trial','active','suspended','overdue','maintenance','blocked','canceled','inactive'));

create table if not exists public.saas_plan_definitions (
  id text primary key,
  nome text not null,
  max_campaigns integer not null,
  max_customers integer not null,
  max_admin_users integer not null,
  max_whatsapp_messages_month integer not null,
  custom_domain boolean not null default false,
  advanced_reports boolean not null default false,
  public_api boolean not null default false,
  included_features text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.saas_plan_definitions (
  id, nome, max_campaigns, max_customers, max_admin_users, max_whatsapp_messages_month,
  custom_domain, advanced_reports, public_api, included_features
) values
  ('starter', 'Starter', 1, 1000, 2, 500, false, false, false, array['crm','wallet','whatsapp_automation']),
  ('pro', 'Pro', 25, 20000, 8, 5000, true, true, false, array['crm','automations','advanced_affiliates','wallet','provably_fair','reports_pdf','custom_theme','whatsapp_automation','realtime_social_proof']),
  ('premium', 'Premium', 100, 100000, 25, 25000, true, true, true, array['crm','automations','advanced_affiliates','wallet','provably_fair','reports_pdf','public_api','pwa','custom_theme','whatsapp_automation','realtime_social_proof']),
  ('enterprise', 'Enterprise', 999999, 999999, 999999, 999999, true, true, true, array['crm','automations','advanced_affiliates','wallet','provably_fair','reports_pdf','public_api','pwa','custom_theme','whatsapp_automation','realtime_social_proof'])
on conflict (id) do update set
  nome = excluded.nome,
  max_campaigns = excluded.max_campaigns,
  max_customers = excluded.max_customers,
  max_admin_users = excluded.max_admin_users,
  max_whatsapp_messages_month = excluded.max_whatsapp_messages_month,
  custom_domain = excluded.custom_domain,
  advanced_reports = excluded.advanced_reports,
  public_api = excluded.public_api,
  included_features = excluded.included_features,
  updated_at = now();

create table if not exists public.tenant_feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  flag text not null check (flag in ('crm','automations','advanced_affiliates','wallet','provably_fair','reports_pdf','public_api','pwa','custom_theme','whatsapp_automation','realtime_social_proof')),
  enabled boolean not null default false,
  reason text,
  updated_by uuid,
  updated_at timestamptz default now(),
  unique (tenant_id, flag)
);

alter table public.tenant_feature_flags
  add column if not exists reason text,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz default now();

create index if not exists tenant_feature_flags_tenant_idx on public.tenant_feature_flags (tenant_id, flag);

alter table public.saas_plan_definitions enable row level security;
alter table public.tenant_feature_flags enable row level security;

-- A aplicacao backend aplica escopo por tenant e superadmin; clients normais nao recebem policies de escrita direta.
