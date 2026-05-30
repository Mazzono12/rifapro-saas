alter table if exists public.fazendinha_configuracoes
  add column if not exists fazendinha_home_banner_link_url text,
  add column if not exists fazendinha_home_banner_link_target text not null default '_self',
  add column if not exists fazendinha_premium_info_enabled boolean not null default true,
  add column if not exists fazendinha_premium_title text,
  add column if not exists fazendinha_premium_description text,
  add column if not exists fazendinha_premium_highlight text,
  add column if not exists fazendinha_caixinha_highlight_enabled boolean not null default true,
  add column if not exists fazendinha_caixinha_title text,
  add column if not exists fazendinha_caixinha_description text,
  add column if not exists fazendinha_caixinha_prize_value text,
  add column if not exists fazendinha_caixinha_icon text,
  add column if not exists fazendinha_extraction_time text,
  add column if not exists fazendinha_extraction_text text,
  add column if not exists fazendinha_extraction_enabled boolean not null default true,
  add column if not exists fazendinha_prize_label text,
  add column if not exists fazendinha_prize_value text,
  add column if not exists fazendinha_ticket_price_label text,
  add column if not exists fazendinha_ticket_price_value text,
  add column if not exists fazendinha_cta_label text,
  add column if not exists fazendinha_cta_subtitle text;

alter table if exists public.fazendinha_configuracoes
  drop constraint if exists fazendinha_home_banner_link_target_check;

alter table if exists public.fazendinha_configuracoes
  add constraint fazendinha_home_banner_link_target_check
  check (fazendinha_home_banner_link_target in ('_self', '_blank'));
