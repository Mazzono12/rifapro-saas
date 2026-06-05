create table if not exists public.whatsapp_automation_rules (
  id text primary key,
  tenant_id text not null,
  type text not null check (type in ('new_buyer', 'vip_buyer', 'abandoned_pix', 'inactive_customer', 'post_raffle', 'top_buyers', 'birthday')),
  enabled boolean not null default true,
  template text not null,
  language text not null default 'pt_BR',
  delay integer not null default 0,
  conditions jsonb not null default '{}'::jsonb,
  daily_limit integer not null default 100,
  cooldown_hours integer not null default 24,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_automation_executions (
  id text primary key,
  tenant_id text not null,
  rule_id text not null references public.whatsapp_automation_rules(id) on delete cascade,
  customer_id text not null,
  status text not null check (status in ('scheduled', 'sent', 'failed', 'skipped')),
  scheduled_at timestamptz not null,
  executed_at timestamptz,
  phone text,
  template text,
  language text not null default 'pt_BR',
  reason text,
  queue_id text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_automation_rules_tenant_type on public.whatsapp_automation_rules(tenant_id, type, enabled);
create index if not exists idx_whatsapp_automation_executions_tenant_status on public.whatsapp_automation_executions(tenant_id, status, scheduled_at);
create unique index if not exists idx_whatsapp_automation_execution_idempotency
  on public.whatsapp_automation_executions(tenant_id, rule_id, customer_id, scheduled_at);

alter table public.whatsapp_automation_rules enable row level security;
alter table public.whatsapp_automation_executions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_automation_rules' and policyname = 'tenant isolated whatsapp automation rules') then
    create policy "tenant isolated whatsapp automation rules" on public.whatsapp_automation_rules
      for all using (tenant_id = auth.jwt() ->> 'tenant_id')
      with check (tenant_id = auth.jwt() ->> 'tenant_id');
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_automation_executions' and policyname = 'tenant isolated whatsapp automation executions') then
    create policy "tenant isolated whatsapp automation executions" on public.whatsapp_automation_executions
      for all using (tenant_id = auth.jwt() ->> 'tenant_id')
      with check (tenant_id = auth.jwt() ->> 'tenant_id');
  end if;
end $$;
