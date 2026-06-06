-- Central interna de notificacoes do sistema.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  user_id text,
  role_target text,
  type text not null,
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'error')),
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  action_url text,
  entity_type text,
  entity_id text,
  dedupe_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz,
  constraint notifications_dedupe_key_unique unique (tenant_id, dedupe_key)
);

create index if not exists idx_notifications_tenant_id on public.notifications (tenant_id);
create index if not exists idx_notifications_user_id on public.notifications (user_id);
create index if not exists idx_notifications_status on public.notifications (status);
create index if not exists idx_notifications_role_target on public.notifications (role_target);
create index if not exists idx_notifications_created_at on public.notifications (created_at desc);
create index if not exists idx_notifications_tenant_status_created on public.notifications (tenant_id, status, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_tenant" on public.notifications;
create policy "notifications_select_tenant"
on public.notifications
for select
using (
  tenant_id = coalesce(
    nullif((auth.jwt() ->> 'tenant_id'), ''),
    nullif((auth.jwt() -> 'app_metadata' ->> 'tenant_id'), ''),
    nullif((auth.jwt() -> 'user_metadata' ->> 'tenant_id'), '')
  )
);

drop policy if exists "notifications_update_tenant" on public.notifications;
create policy "notifications_update_tenant"
on public.notifications
for update
using (
  tenant_id = coalesce(
    nullif((auth.jwt() ->> 'tenant_id'), ''),
    nullif((auth.jwt() -> 'app_metadata' ->> 'tenant_id'), ''),
    nullif((auth.jwt() -> 'user_metadata' ->> 'tenant_id'), '')
  )
)
with check (
  tenant_id = coalesce(
    nullif((auth.jwt() ->> 'tenant_id'), ''),
    nullif((auth.jwt() -> 'app_metadata' ->> 'tenant_id'), ''),
    nullif((auth.jwt() -> 'user_metadata' ->> 'tenant_id'), '')
  )
);

drop policy if exists "notifications_delete_tenant" on public.notifications;
create policy "notifications_delete_tenant"
on public.notifications
for delete
using (
  tenant_id = coalesce(
    nullif((auth.jwt() ->> 'tenant_id'), ''),
    nullif((auth.jwt() -> 'app_metadata' ->> 'tenant_id'), ''),
    nullif((auth.jwt() -> 'user_metadata' ->> 'tenant_id'), '')
  )
);
