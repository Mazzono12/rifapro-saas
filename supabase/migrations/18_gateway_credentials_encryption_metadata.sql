-- Metadados de criptografia para credenciais de gateways.
-- Os valores sensiveis continuam em credentials/webhook_secret/pix_key, mas
-- devem ser gravados pela API como envelopes cifrados enc:v1:*.

alter table public.payment_gateway_configs
  add column if not exists credentials_encryption_version integer not null default 1,
  add column if not exists credentials_encrypted_at timestamptz default now();

comment on column public.payment_gateway_configs.credentials is
  'JSONB com valores sensiveis cifrados no backend usando GATEWAY_CREDENTIALS_ENCRYPTION_KEY. Nunca salvar api_key, secret_key, client_secret, token ou webhook_secret em texto puro.';

comment on column public.payment_gateway_configs.webhook_secret is
  'Valor cifrado enc:v1:* quando configurado.';

comment on column public.payment_gateway_configs.pix_key is
  'Valor cifrado enc:v1:* quando configurado.';
