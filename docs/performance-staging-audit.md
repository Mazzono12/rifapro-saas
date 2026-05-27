# Auditoria de performance do staging Railway

Data: 2026-05-27

## Pontos encontrados

- A home sincronizava todos os videos visiveis a cada 900ms, alem de scroll e resize. Em mobile isso podia competir com decode de video e gerar travamento.
- O checkout da rifa consultava status de pagamento a cada 2,5s. Em compras pendentes, varias abas ou usuarios simultaneos aumentavam chamadas repetidas ao backend.
- Videos de campanha nao definiam `preload="metadata"` de forma central e alguns banners usavam `contain`, gerando barras laterais e mais reflow visual.
- A fila de pagamentos rodava a cada 5s em producao, mesmo quando nao havia volume suficiente para esse ritmo.
- A experiencia publica tinha imagens/videos sem fallback visual unificado, causando sensacao de tela travada durante carregamento ou falha de midia.

## Otimizacoes aplicadas

- Criado `CampaignMediaHero` com skeleton, fallback seguro, `object-fit: cover` por padrao, suporte a imagem/video/embed e lazy playback quando nao e midia prioritaria.
- `MediaRenderer` agora aceita `priority`, `preload`, `onLoad` e `onError`; imagens usam lazy/eager conforme prioridade e videos usam `preload="metadata"`.
- Home e pagina de detalhe usam o novo hero de campanha para evitar barras pretas laterais e overflow horizontal.
- Sincronizacao de videos da home passou de 900ms para 2500ms, mantendo scroll/resize responsivos.
- Polling de compra agora tem intervalo minimo de 6s e backoff em erros/tentativas longas; detalhe da rifa usa 7s.
- Worker de pagamentos passou para 15s em producao e 8s fora de producao.
- Foram adicionadas metricas internas em dev para tempo de carregamento publico, abertura do resumo de checkout e geracao de PIX via evento `rifapro:performance-metric` e log `[perf]`.

## Garantias multitenant

- Endpoints admin usam `resolveRequestTenantId(req)` e ignoram `tenant_id` enviado pelo frontend.
- CRUD de rifas admin continua filtrado por `adminCanAccessTenant`.
- Novos endpoints de admin do tenant sao protegidos por `/api/superadmin`.
- Reset de senha retorna a senha temporaria apenas na resposta, nunca em logs.

## Validacoes recomendadas em staging

- Abrir `/`, `/login`, `/superadmin` e `/rifa/*` em 390px e 1440px.
- Confirmar que `/api/public/tenant-debug` continua sem exigir tenant.
- Criar tenant pelo superadmin, criar admin do tenant e logar em `/login`.
- Criar rifa pelo admin do tenant e confirmar que outro tenant nao enxerga a rifa.
- Fazer checkout PIX e validar que o polling nao gera chamadas duplicadas agressivas.
