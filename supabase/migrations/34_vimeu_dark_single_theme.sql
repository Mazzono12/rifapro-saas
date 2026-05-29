alter table if exists public.tenant_branding_settings
  drop constraint if exists tenant_branding_settings_theme_mode_check;

alter table if exists public.tenant_branding_settings
  alter column theme_mode set default 'vimeu_dark';

update public.tenant_branding_settings
set theme_mode = 'vimeu_dark'
where theme_mode is null
   or theme_mode <> 'vimeu_dark';

alter table if exists public.tenant_branding_settings
  add constraint tenant_branding_settings_theme_mode_check
  check (theme_mode = 'vimeu_dark');
