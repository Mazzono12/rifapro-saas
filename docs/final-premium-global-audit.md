# Auditoria Global Premium Final

Data: 2026-05-30

## CRITICO

- Checkout sem mídia com cabeçalho alto e área visual ociosa.
  - Corrigido com `CheckoutModalHeader` em modo `compact-no-media`, aplicado ao recibo, PIX e checkout da Fazendinha quando não há mídia ativa.
- Botões flutuantes cobrindo conteúdo em checkout mobile.
  - Corrigido com `body[data-checkout-open="true"]` e recuo parcial de `.public-floating-actions` durante qualquer fluxo de compra.

## ALTO

- Larguras divergentes entre header, Home, páginas públicas e checkout.
  - Corrigido com `PublicPageContainer`, `AppContentContainer` e `CheckoutPageContainer`, além de tokens CSS globais de largura.
- Shells de checkout ainda dependiam de `max-w-2xl` local.
  - Corrigido para usar `--checkout-content-max-width` e classe `checkout-modal-shell`.
- Header público e header de checkout não compartilhavam a mesma geometria útil.
  - Corrigido com `app-content-container` no header público e `CheckoutPageContainer` dentro do header de checkout.

## MEDIO

- Fazendinha tinha risco de espaçamento excessivo entre banner, chips e grade.
  - Mantido o fluxo compacto: banner, chips, título curto, grade e CTA.
- Admin ainda tinha histórico recente de campos de tipo de mídia duplicados.
  - Consolidado no `MediaPicker`, preservando apenas comportamento/proporção onde necessário.

## BAIXO

- Relatórios de teste são atualizados pelas suítes hard/hardcore.
  - Mantidos fora do commit para evitar ruído de execução.

## Resultado

- CRITICO corrigido.
- ALTO corrigido.
- MEDIO auditado e ajustado.
- BAIXO documentado.
