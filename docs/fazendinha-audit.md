# Auditoria da Fazendinha

Data: 2026-05-30

## Escopo

Auditoria do módulo Fazendinha cobrindo Home pública, banner da modalidade, grade de bichos, seleção/desfazer, checkout, recibo pré-PIX, tela PIX, bilhete, admin, APIs públicas/admin, multitenant e mobile.

## Achados

### CRÍTICO

- Mídia promocional e mídia de checkout estavam semanticamente acopladas. O mesmo conceito de mídia era ligado/desligado para resolver posições diferentes, criando risco de banner promocional aparecer dentro do fluxo de compra.
  - Status: corrigido.
  - Correção: criação de `mediaSettings.homeBanner` e `mediaSettings.checkoutMedia`, com endpoints próprios e componentes separados.

### ALTO

- O checkout da Fazendinha não tinha um campo próprio de mídia configurável depois da remoção emergencial do banner.
  - Status: corrigido.
  - Correção: criação de `FazendinhaCheckoutMedia`, renderizado no topo do checkout/recibo somente quando `checkoutMedia.enabled` e `checkoutMedia.mediaUrl` existem.

- O admin não separava claramente a intenção das mídias.
  - Status: corrigido.
  - Correção: área “Mídias” com “Banner da modalidade Fazendinha na Home” e “Mídia do checkout da Fazendinha”.

### MÉDIO

- Testes antigos validavam a ausência total de mídia no checkout da Fazendinha, o que impedia um campo legítimo e separado.
  - Status: corrigido.
  - Correção: testes atualizados para bloquear duplicidade do banner da Home e permitir apenas `FazendinhaCheckoutMedia`.

- O recibo pré-PIX não distinguia mídia padrão de campanha e mídia específica da Fazendinha.
  - Status: corrigido.
  - Correção: `PrePaymentReceiptModal` agora aceita `fazendinhaCheckoutMedia` sem afetar o checkout geral.

### BAIXO

- Nomes legados como `home-media` permaneciam necessários por compatibilidade, mas eram insuficientes para explicar o novo modelo.
  - Status: mitigado.
  - Correção: endpoints antigos mantidos; novo endpoint `/api/*/fazendinha/media-settings` passa a ser o caminho semântico.

## Problemas corrigidos

- Banner promocional da Home permanece acima da grade/lista dos bichos.
- Banner promocional não é reutilizado no checkout.
- Mídia do checkout é configurável separadamente.
- Mídia do checkout aceita imagem, vídeo e GIF via `ResponsiveMediaFrame`.
- Título e descrição ficam abaixo da mídia, sem overlay.
- Mobile limita altura de mídia no checkout e evita overflow horizontal.
- Recibo pré-PIX mantém scroll interno e altura máxima da viewport.
- APIs públicas retornam somente campos seguros.
- Configuração é resolvida por tenant via `resolveRequestTenantId`/domínio público.

## Componentes Revisados

- `FazendinhaSection`
- `Fazendinha`
- `FazendinhaHomeBanner`
- `FazendinhaAnimalPickerBanner`
- `FazendinhaHomeMediaBlock`
- `FazendinhaCheckoutMedia`
- `PrePaymentReceiptModal`
- `AdminFazendinha`

## Classificação Final

- CRÍTICO: corrigido.
- ALTO: corrigido.
- MÉDIO: corrigido.
- BAIXO: mitigado.
