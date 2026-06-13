-- Garante que novos gateways/integracoes nascam em producao.
-- Sandbox permanece permitido, mas somente quando configurado explicitamente.

alter table if exists public.payment_gateway_configs
  alter column environment set default 'production';

alter table if exists public.payment_gateway_configs
  drop constraint if exists payment_gateway_configs_environment_check;

alter table if exists public.payment_gateway_configs
  add constraint payment_gateway_configs_environment_check
  check (environment in ('sandbox', 'production', 'staging', 'mock'));

alter table if exists public.payment_gateways
  alter column environment set default 'production';

alter table if exists public.whatsapp_provider_configs
  alter column environment set default 'production';
