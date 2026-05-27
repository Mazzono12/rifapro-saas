-- Clean-room compatibility for Supabase Auth backed users.
-- Password hashes live in auth.users; public.usuarios must allow null senha_hash.

alter table if exists public.usuarios
  alter column senha_hash drop not null;

alter table if exists public.usuarios
  drop constraint if exists usuarios_role_check;

alter table if exists public.usuarios
  add constraint usuarios_role_check
  check (role in ('superadmin', 'admin', 'operador', 'afiliado', 'tenant_admin', 'tenant_user'));

alter table if exists public.usuarios
  drop constraint if exists usuarios_tenant_role_check;

alter table if exists public.usuarios
  add constraint usuarios_tenant_role_check
  check (
    (role = 'superadmin' and tenant_id is null) or
    (role in ('admin', 'operador', 'afiliado', 'tenant_admin', 'tenant_user') and tenant_id is not null)
  );
