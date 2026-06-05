create table if not exists public.whatsapp_crm_campaigns (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  name text not null,
  segment text not null check (segment in ('today', 'last_7_days', 'vip', 'recurring', 'pix_pending', 'pix_expired', 'raffle', 'fazendinha', 'number_mode', 'inactive_30_days')),
  template_name text not null,
  language text not null default 'pt_BR',
  components jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'ready', 'queued', 'sending', 'completed', 'cancelled')),
  predicted_recipients integer not null default 0,
  queued_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  daily_tenant_limit integer not null default 100,
  cooldown_hours integer not null default 24,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create index if not exists idx_whatsapp_crm_campaigns_tenant_status on public.whatsapp_crm_campaigns(tenant_id, status, created_at desc);
create index if not exists idx_whatsapp_message_queue_crm_campaign on public.whatsapp_message_queue(tenant_id, message_type, status, created_at)
  where message_type = 'whatsapp_crm_campaign';
create unique index if not exists idx_whatsapp_message_queue_crm_idempotency on public.whatsapp_message_queue(tenant_id, idempotency_key)
  where message_type = 'whatsapp_crm_campaign';

alter table public.whatsapp_crm_campaigns enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_crm_campaigns' and policyname = 'tenant isolated whatsapp crm campaigns') then
    create policy "tenant isolated whatsapp crm campaigns" on public.whatsapp_crm_campaigns
      using (tenant_id = auth.jwt() ->> 'tenant_id' or auth.jwt() ->> 'role' = 'superadmin')
      with check (tenant_id = auth.jwt() ->> 'tenant_id' or auth.jwt() ->> 'role' = 'superadmin');
  end if;
end $$;
