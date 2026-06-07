create table if not exists public.customer_sponsors (
  id text primary key,
  tenant_id text not null,
  customer_id text not null,
  sponsor_affiliate_id text not null,
  sponsor_user_id text not null default '',
  first_ref_code text not null,
  first_campaign_id text not null default '',
  source_url text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  locked_at timestamptz not null default now(),
  constraint customer_sponsors_customer_unique unique (tenant_id, customer_id)
);

create table if not exists public.sponsor_reward_settings (
  id text primary key,
  tenant_id text not null,
  campaign_id text not null,
  enabled boolean not null default false,
  commercial_name text not null default 'Patrocinador Premiado',
  reward_type text not null default 'manual' check (reward_type in ('pix', 'saldo', 'produto', 'commission_extra', 'manual')),
  reward_value numeric(12,2) not null default 0 check (reward_value >= 0),
  reward_description text not null default '',
  eligible_prize_scope text not null default 'all' check (eligible_prize_scope in ('main', 'all', 'manual')),
  show_publicly boolean not null default true,
  show_on_campaign_page boolean not null default true,
  auto_credit_wallet boolean not null default false,
  requires_manual_approval boolean not null default true,
  minimum_purchase_amount numeric(12,2) not null default 0 check (minimum_purchase_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsor_reward_settings_campaign_unique unique (tenant_id, campaign_id)
);

create table if not exists public.sponsor_rewards (
  id text primary key,
  tenant_id text not null,
  campaign_id text not null,
  modality_type text not null,
  winner_customer_id text not null,
  sponsor_affiliate_id text not null,
  sponsor_customer_id text not null default '',
  prize_id text not null,
  source_purchase_id text not null,
  sponsor_purchase_id text not null default '',
  reward_type text not null,
  reward_value numeric(12,2) not null default 0,
  reward_description text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'credited')),
  eligibility_snapshot jsonb not null default '{}'::jsonb,
  rejection_reason text not null default '',
  credited_wallet_transaction_id text not null default '',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsor_rewards_idempotency_unique unique (idempotency_key)
);

create table if not exists public.sponsor_reward_audit_logs (
  id text primary key,
  tenant_id text not null,
  sponsor_reward_id text not null default '',
  campaign_id text not null default '',
  winner_customer_id text not null default '',
  sponsor_affiliate_id text not null default '',
  event_type text not null,
  reason text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_sponsors_tenant on public.customer_sponsors (tenant_id);
create index if not exists idx_customer_sponsors_sponsor on public.customer_sponsors (tenant_id, sponsor_affiliate_id);
create index if not exists idx_sponsor_reward_settings_campaign on public.sponsor_reward_settings (tenant_id, campaign_id);
create index if not exists idx_sponsor_rewards_tenant_campaign on public.sponsor_rewards (tenant_id, campaign_id);
create index if not exists idx_sponsor_rewards_sponsor on public.sponsor_rewards (tenant_id, sponsor_affiliate_id);
create index if not exists idx_sponsor_rewards_status on public.sponsor_rewards (tenant_id, status);
create index if not exists idx_sponsor_reward_logs_tenant on public.sponsor_reward_audit_logs (tenant_id, created_at desc);

alter table public.customer_sponsors enable row level security;
alter table public.sponsor_reward_settings enable row level security;
alter table public.sponsor_rewards enable row level security;
alter table public.sponsor_reward_audit_logs enable row level security;

drop policy if exists "customer_sponsors_tenant_access" on public.customer_sponsors;
create policy "customer_sponsors_tenant_access" on public.customer_sponsors
for all
using (auth.jwt() ->> 'role' = 'superadmin' or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId'))
with check (auth.jwt() ->> 'role' = 'superadmin' or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId'));

drop policy if exists "sponsor_reward_settings_tenant_access" on public.sponsor_reward_settings;
create policy "sponsor_reward_settings_tenant_access" on public.sponsor_reward_settings
for all
using (auth.jwt() ->> 'role' = 'superadmin' or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId'))
with check (auth.jwt() ->> 'role' = 'superadmin' or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId'));

drop policy if exists "sponsor_rewards_tenant_access" on public.sponsor_rewards;
create policy "sponsor_rewards_tenant_access" on public.sponsor_rewards
for all
using (auth.jwt() ->> 'role' = 'superadmin' or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId'))
with check (auth.jwt() ->> 'role' = 'superadmin' or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId'));

drop policy if exists "sponsor_reward_audit_logs_tenant_access" on public.sponsor_reward_audit_logs;
create policy "sponsor_reward_audit_logs_tenant_access" on public.sponsor_reward_audit_logs
for all
using (auth.jwt() ->> 'role' = 'superadmin' or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId'))
with check (auth.jwt() ->> 'role' = 'superadmin' or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId'));
