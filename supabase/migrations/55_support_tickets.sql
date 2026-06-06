-- Tickets/SLA Enterprise por tenant.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  ticket_number text not null,
  customer_id text,
  contact_id text,
  source text not null default 'manual' check (source in ('whatsapp', 'crm', 'manual', 'email_future')),
  subject text not null default '',
  description text not null default '',
  status text not null default 'open' check (status in ('open', 'pending', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  category text not null default 'other' check (category in ('financial', 'technical', 'sales', 'affiliate', 'other')),
  assigned_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  sla_due_at timestamptz not null,
  whatsapp_conversation_id text,
  constraint support_tickets_tenant_number_unique unique (tenant_id, ticket_number)
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_type text not null check (author_type in ('customer', 'agent', 'system')),
  author_id text,
  message text not null default '',
  internal_note boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_tenant_id on public.support_tickets (tenant_id);
create index if not exists idx_support_tickets_status on public.support_tickets (status);
create index if not exists idx_support_tickets_priority on public.support_tickets (priority);
create index if not exists idx_support_tickets_assigned_user_id on public.support_tickets (assigned_user_id);
create index if not exists idx_support_tickets_sla_due_at on public.support_tickets (sla_due_at);
create index if not exists idx_support_ticket_messages_tenant_id on public.support_ticket_messages (tenant_id);
create index if not exists idx_support_ticket_messages_ticket_id on public.support_ticket_messages (ticket_id);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

drop policy if exists "support_tickets_tenant_select" on public.support_tickets;
create policy "support_tickets_tenant_select"
on public.support_tickets for select
using (
  tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  or auth.jwt() ->> 'role' = 'superadmin'
);

drop policy if exists "support_tickets_tenant_write" on public.support_tickets;
create policy "support_tickets_tenant_write"
on public.support_tickets for all
using (
  auth.jwt() ->> 'role' in ('superadmin', 'service_role')
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id')
)
with check (
  auth.jwt() ->> 'role' in ('superadmin', 'service_role')
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

drop policy if exists "support_ticket_messages_tenant_select" on public.support_ticket_messages;
create policy "support_ticket_messages_tenant_select"
on public.support_ticket_messages for select
using (
  (
    tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    and exists (
      select 1 from public.support_tickets st
      where st.id = support_ticket_messages.ticket_id
      and st.tenant_id = support_ticket_messages.tenant_id
    )
  )
  or auth.jwt() ->> 'role' = 'superadmin'
);

drop policy if exists "support_ticket_messages_tenant_write" on public.support_ticket_messages;
create policy "support_ticket_messages_tenant_write"
on public.support_ticket_messages for all
using (
  auth.jwt() ->> 'role' in ('superadmin', 'service_role')
  or (
    tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    and exists (
      select 1 from public.support_tickets st
      where st.id = support_ticket_messages.ticket_id
      and st.tenant_id = support_ticket_messages.tenant_id
    )
  )
)
with check (
  auth.jwt() ->> 'role' in ('superadmin', 'service_role')
  or (
    tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    and exists (
      select 1 from public.support_tickets st
      where st.id = support_ticket_messages.ticket_id
      and st.tenant_id = support_ticket_messages.tenant_id
    )
  )
);
