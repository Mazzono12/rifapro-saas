create table if not exists public.whatsapp_contacts (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  customer_id text,
  phone text not null,
  display_name text not null default '',
  source text not null default 'meta_webhook',
  opt_out boolean not null default false,
  opt_out_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

create table if not exists public.whatsapp_conversations (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  contact_id text not null references public.whatsapp_contacts(id) on delete cascade,
  phone text not null,
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'waiting_customer')),
  assigned_user_id text,
  last_message_at timestamptz,
  service_window_expires_at timestamptz,
  unread_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_conversation_messages (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  conversation_id text not null references public.whatsapp_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound', 'system', 'internal_note')),
  type text not null default 'unknown' check (type in ('text', 'template', 'image', 'audio', 'document', 'button', 'status', 'unknown')),
  body text not null default '',
  status text,
  meta_message_id text,
  received_at timestamptz,
  sent_at timestamptz,
  raw_summary jsonb not null default '{}'::jsonb
);

create table if not exists public.whatsapp_opt_out_events (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  contact_id text not null references public.whatsapp_contacts(id) on delete cascade,
  phone text not null,
  reason text not null,
  source text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_contacts_tenant_phone on public.whatsapp_contacts(tenant_id, phone);
create index if not exists idx_whatsapp_conversations_tenant_status on public.whatsapp_conversations(tenant_id, status, last_message_at desc);
create index if not exists idx_whatsapp_messages_tenant_conversation on public.whatsapp_conversation_messages(tenant_id, conversation_id, received_at, sent_at);
create index if not exists idx_whatsapp_messages_meta_id on public.whatsapp_conversation_messages(tenant_id, meta_message_id);
create index if not exists idx_whatsapp_opt_out_tenant_contact on public.whatsapp_opt_out_events(tenant_id, contact_id, created_at desc);

alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_conversation_messages enable row level security;
alter table public.whatsapp_opt_out_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_contacts' and policyname = 'tenant isolated whatsapp contacts') then
    create policy "tenant isolated whatsapp contacts" on public.whatsapp_contacts
      using (tenant_id = auth.jwt() ->> 'tenant_id' or auth.jwt() ->> 'role' = 'superadmin')
      with check (tenant_id = auth.jwt() ->> 'tenant_id' or auth.jwt() ->> 'role' = 'superadmin');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_conversations' and policyname = 'tenant isolated whatsapp conversations') then
    create policy "tenant isolated whatsapp conversations" on public.whatsapp_conversations
      using (tenant_id = auth.jwt() ->> 'tenant_id' or auth.jwt() ->> 'role' = 'superadmin')
      with check (tenant_id = auth.jwt() ->> 'tenant_id' or auth.jwt() ->> 'role' = 'superadmin');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_conversation_messages' and policyname = 'tenant isolated whatsapp messages') then
    create policy "tenant isolated whatsapp messages" on public.whatsapp_conversation_messages
      using (tenant_id = auth.jwt() ->> 'tenant_id' or auth.jwt() ->> 'role' = 'superadmin')
      with check (tenant_id = auth.jwt() ->> 'tenant_id' or auth.jwt() ->> 'role' = 'superadmin');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'whatsapp_opt_out_events' and policyname = 'tenant isolated whatsapp opt outs') then
    create policy "tenant isolated whatsapp opt outs" on public.whatsapp_opt_out_events
      using (tenant_id = auth.jwt() ->> 'tenant_id' or auth.jwt() ->> 'role' = 'superadmin')
      with check (tenant_id = auth.jwt() ->> 'tenant_id' or auth.jwt() ->> 'role' = 'superadmin');
  end if;
end $$;
