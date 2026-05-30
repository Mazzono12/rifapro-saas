alter table if exists public.fazendinha_configuracoes
  add column if not exists fazendinha_checkout_media_enabled boolean not null default false,
  add column if not exists fazendinha_checkout_media_url text,
  add column if not exists fazendinha_checkout_media_type text not null default 'image',
  add column if not exists fazendinha_checkout_media_poster_url text,
  add column if not exists fazendinha_checkout_media_title text,
  add column if not exists fazendinha_checkout_media_description text,
  add column if not exists fazendinha_checkout_media_fit text not null default 'auto',
  add column if not exists fazendinha_checkout_media_alt text;

alter table if exists public.fazendinha_configuracoes
  drop constraint if exists fazendinha_checkout_media_type_check;

alter table if exists public.fazendinha_configuracoes
  add constraint fazendinha_checkout_media_type_check
  check (fazendinha_checkout_media_type in ('image', 'video', 'gif', 'youtube', 'vimeo', 'bunny'));

alter table if exists public.fazendinha_configuracoes
  drop constraint if exists fazendinha_checkout_media_fit_check;

alter table if exists public.fazendinha_configuracoes
  add constraint fazendinha_checkout_media_fit_check
  check (fazendinha_checkout_media_fit in ('auto', 'contain', 'cover'));
