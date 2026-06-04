alter table if exists public.tenant_branding_settings
  add column if not exists login_logo_url text,
  add column if not exists login_title text,
  add column if not exists login_subtitle text,
  add column if not exists login_support_text text,
  add column if not exists login_background_url text,
  add column if not exists login_primary_color text,
  add column if not exists login_accent_color text,
  add column if not exists login_button_text text,
  add column if not exists login_footer_text text;

update public.tenant_branding_settings
set
  login_title = coalesce(nullif(login_title, ''), 'CIFHER Prime'),
  login_subtitle = coalesce(nullif(login_subtitle, ''), 'Acesse seu ambiente exclusivo com segurança, controle e alta performance.'),
  login_support_text = coalesce(nullif(login_support_text, ''), 'Tecnologia premium para gestão inteligente, operação avançada e crescimento profissional.'),
  login_primary_color = coalesce(nullif(login_primary_color, ''), primary_color, '#00d66b'),
  login_accent_color = coalesce(nullif(login_accent_color, ''), cta_color, '#f5c451'),
  login_button_text = coalesce(nullif(login_button_text, ''), 'Entrar com segurança'),
  login_footer_text = coalesce(nullif(login_footer_text, ''), 'Ambiente protegido • Acesso autorizado')
where true;
