# Clean Media Layout Audit

Data: 2026-06-02

## Objetivo

Padronizar a exibicao de banners, imagens, GIFs e videos para que a area de midia fique limpa, completa e sem texto/CTA/preco/descricao sobrepostos. As informacoes da campanha ficam abaixo do frame de midia.

## Componentes alterados

- `src/utils/mediaAspect.ts`
  - `auto` agora prefere `contain` quando ainda nao ha metadados ou quando a orientacao e detectada.
  - `cover` continua disponivel quando configurado explicitamente.

- `src/components/StandardRaffleMediaBlock.tsx`
  - Removeu o force de `cover` e `horizontal` quando `preferredFit/aspectMode` eram `auto`.
  - Padronizou `clean-media-block` para conter apenas `ResponsiveMediaFrame`.
  - Padronizou `media-info-block` abaixo da midia para titulo, descricao, progresso, preco e CTA.
  - Removeu overlay visual obrigatorio do frame.

- `src/components/CampaignMediaHero.tsx`
  - `mediaFit` padrao passou para `auto`.
  - Removeu gradientes e textos absolutos sobre a midia.
  - Preservou `data-video-player="VideoHeroPlayer"` e a compatibilidade de `overlay && !noOverlay` sem renderizar camada visual obrigatoria.

- `src/components/DynamicMedia.tsx`
  - `mediaFit` padrao passou para `auto`.
  - `fill` continua mapeando para `cover` somente quando pedido.

- `src/components/ModalidadesSection.tsx`
  - Removeu mascara escura e badge dentro do frame.
  - Badge `Ativo`, titulo, descricao, premio, valor e CTA ficam abaixo/ao lado da area limpa de midia.

- `src/pages/admin/AdminStories.tsx`
  - Removeu gradiente e titulo absoluto sobre o preview.
  - Titulo e acoes foram movidos para bloco abaixo da midia.

- `src/index.css`
  - `data-fit="auto"` aplica `object-fit: contain`.
  - Checkout media usa `contain` para imagem/video/iframe.
  - Regras responsivas preservam max-height em mobile e desktop.

## Componentes auditados e preservados

- `ResponsiveMediaFrame`
- `SmartAutoPlayVideo`
- `CheckoutCampaignMedia`
- `FazendinhaHomeMediaBlock`
- `FazendinhaCheckoutMedia`
- `StoriesSection`
- `WinnersGallery`
- `Home`
- `RaffleDetails`
- `NumberModePage`
- `AdminRaffles`
- `AdminWinners`
- `MediaPicker`
- tenant branding e tema publico

## Overlays removidos

- Textos e gradientes absolutos de `CampaignMediaHero`.
- Overlay escuro e badge dentro da midia em `ModalidadesSection`.
- Gradiente e legenda absoluta em previews de `AdminStories`.
- Overlay visual obrigatorio de `StandardRaffleMediaBlock`.

## Textos movidos para baixo da midia

- Home/rifa principal: titulo, descricao, progresso, preco e CTA no `media-info-block`.
- Modalidades: badge, titulo, descricao, premio, valor e CTA fora do frame.
- Admin Stories: titulo e acoes abaixo do preview.
- Checkout e Fazendinha ja mantinham info abaixo da midia e foram preservados.

## Regras de fit aplicadas

- Padrao global: `auto`.
- `auto` prefere `contain` para evitar corte de rosto, premio, texto importante ou produto.
- Imagem vertical, story, retrato e quadrada sao exibidos completos.
- Banner horizontal continua usando largura util do container, sem crop obrigatorio.
- `cover` permanece disponivel quando configurado explicitamente no admin ou em usos que pedem preenchimento.

## Validacao mobile

Cobertura estatica adicionada para:

- 360px
- 390px
- 414px
- 768px

As regras garantem:

- Sem overflow horizontal.
- Midia em 100% da largura util.
- Texto fora da area de midia.
- Altura maxima responsiva em checkout, banners e frames verticais.

## Testes executados

- `npm run lint`
- `npm run build`
- `npm run test:clean-media-layout-hard`
- `npm run test:responsive-media-hard`
- `npm run test:frontend-hard`
- `npm run test:checkout-hard`
- `npm run test:production-readiness`
- `npm run test:all-hard`

## Teste novo

- `scripts/test-clean-media-layout-hard.mjs`
  - Valida Home rifa principal sem overlay.
  - Valida midia principal completa com `auto/contain`.
  - Valida titulo/descricao abaixo da midia.
  - Valida cards/modalidades sem texto dentro da midia.
  - Valida RaffleDetails, Fazendinha, NumberMode e checkout.
  - Valida previews admin sem legenda sobreposta.
  - Valida mobile 360/390/414/768.
  - Valida preservacao de `ResponsiveMediaFrame` e `SmartAutoPlayVideo`.

O teste foi integrado ao `frontend-hard`, logo tambem passa a ser coberto por `production-readiness` e `all-hard`.
