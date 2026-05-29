# Auditoria de responsividade mobile e largura util

Data: 2026-05-29

## Escopo revisado

- Publicas: Home, pagina principal da rifa, modalidades/NumberModePage, Fazendinha, checkout, PIX, recibo pre-pagamento, bilhete, meus bilhetes, resultado e auditoria publica.
- Autenticacao: login, cadastro e recuperacao de senha.
- Admin tenant: dashboard, rifas, clientes/pedidos, CRM, afiliados, relatorios, branding e configuracoes.
- Superadmin: dashboard, tenants, auditoria e financeiro.

## Causas encontradas

1. Wrappers publicos e administrativos usavam combinacoes de `max-w-*`, `container mx-auto` e padding lateral que eram adequadas para desktop, mas deixavam cards e checkout estreitos em 360-414px.
2. Alguns modais de checkout tinham `p-3` fixo no overlay e `max-w-2xl` sem uma regra mobile forte para ocupar a largura disponivel.
3. QR Code do PIX usava `w-fit` com tamanho fixo (`210px`, `236px`, `250px`), criando uma ilha estreita e pouco flexivel no mobile.
4. Hero/banner/video dependiam do wrapper pai para largura e nao tinham uma camada global garantindo `min-width: 0` em grids/flex.
5. O suporte a safe area existia em pontos isolados, mas nao havia uma regra global para iPhone/Android nas laterais.

## Correcoes aplicadas

- Criada camada global de hardening mobile em `src/index.css` para telas ate 767px.
- Normalizado `html`, `body`, `#root`, `public-shell`, `premium-page`, `admin-shell` e `checkout-screen` para `width: 100%`, `min-width: 0` e `max-width: 100%`.
- Containers de paginas publicas, admin e checkout agora removem max-width indevido no mobile e usam gutter responsivo com `env(safe-area-inset-left/right)`.
- Wrappers `max-w-7xl` ate `max-w-3xl` nas shells principais passam a ocupar 100% no mobile.
- Cards, glass cards, admin cards, premium cards e `CampaignMediaHero` recebem largura 100% e `min-width: 0`.
- Grids/flex recebem `min-width: 0` e grids `lg:*` colapsam para uma coluna no mobile.
- Hero, video, imagem e iframe de campanha passam a ter largura total garantida.
- Overlays de checkout/recibo passam a respeitar safe area lateral.
- Modais principais de checkout tiveram padding reduzido no mobile e largura `w-full`.
- QR Codes de PIX passaram a usar `max-width` responsivo e SVG fluido no mobile.

## Arquivos alterados

- `src/index.css`
- `src/components/premium/PremiumUI.tsx`
- `src/components/checkout/PrePaymentReceiptModal.tsx`
- `src/components/CampaignMediaHero.tsx`
- `src/pages/RaffleDetails.tsx`
- `src/components/FazendinhaSection.tsx`

## Componentes afetados

- `PremiumPageLayout`
- `PremiumHero`
- `PremiumCheckoutModal`
- `PixPaymentCard`
- `PrePaymentReceiptModal`
- `CampaignMediaHero`
- checkout da rifa principal
- checkout da Fazendinha

## Viewports alvo

As regras foram desenhadas para:

- 360x640
- 375x667
- 390x844
- 414x896
- 768x1024
- 1440x900

No mobile, a expectativa agora e:

- sem faixa lateral vazia por container desktop;
- sem card estreito indevido;
- hero/banner/video ocupando toda a largura util;
- checkout e recibo usando largura total disponivel;
- QR Code responsivo sem forcar overflow;
- safe area lateral respeitada em iPhone/Android.

## Validacao

- `npm run lint`: aprovado.
- `npm run build`: aprovado.
- `npm run test:frontend-hard`: aprovado.
- `npm run test:checkout-hard`: aprovado.
- `npm run test:all-hard`: aprovado.
- `npm run test:hardcore`: aprovado.
- `npm run test:production-readiness`: aprovado.

Observacao: uma primeira execucao de build chegou a gerar os assets e caiu no encerramento do Node no Windows com assertion nativo. A execucao final foi repetida e passou com sucesso.
