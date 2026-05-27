# RifaPro SaaS - Auditoria hard

Data: 2026-05-26
Ambiente: local/sandbox, dados fake, sem disparo real de PIX, mensagens ou gateways externos.

## Modulos encontrados

- Backend Express em `server.ts`, com rotas publicas, admin tenant, superadmin, autenticacao, checkout, webhooks, workers e gamificacao.
- Frontend React/Vite com paginas publicas, painel admin, painel superadmin e fluxo de auth SaaS.
- Supabase/Postgres com migrations para clientes, tenants, auth usuarios, estado persistente, RLS e agora `payment_gateway_configs`.
- Auth via Supabase Auth + JWT backend, roles e tenant resolvido no backend.
- Fluxos de rifa: listagem publica, detalhe, compra, reserva, pagamento, ganhadores, ranking e sorteio/admin.
- Fluxos multitenant: middleware de dominio/subdominio, bypass para `/api/teste/*`, escopo por `tenant_id`, testes de isolamento.
- Webhooks/workers: fila de pagamentos, logs, idempotencia e reconciliacao PIX mock/sandbox.
- Integracoes/gamificacao: estrutura preparada, testes locais e placeholders onde endpoint oficial nao deve ser inventado.

## Riscos encontrados

- Gateways PIX ainda tinham modelo legado espalhado entre `active`, `pix.gateway` e objetos por provedor.
- Painel de gateways nao listava provedores novos como PrimePag, Paggue, Cash Pay e Fke Processor.
- Sem tabela normalizada para multiplos gateways por tenant, gateway default unico e preservacao formal do provider por pedido.
- `credentials` em `payment_gateway_configs` precisa evoluir para criptografia em producao antes de credenciais reais.
- Provedores sem documentacao oficial seguem em mock/placeholder seguro.

## Correcoes aplicadas

- Criada migration `17_payment_gateway_configs.sql`.
- Backend ganhou normalizacao de provider, configs por tenant, default unico e compatibilidade com rotas antigas.
- Webhook normaliza `:gateway` antes de validar assinatura e enfileirar job.
- Checkout preserva `pixGateway` do pedido usando provider normalizado.
- Painel admin de gateways agora permite selecionar/testar sandbox, mock, PrimePag, Paggue, Cash Pay e Fke Processor.
- Scripts hard criados para gateway, checkout, rifas, multitenant, webhooks, frontend e prontidao de producao.

## Pendencias de producao

- Aplicar migrations no Supabase de homologacao/producao.
- Validar credenciais reais apenas em sandbox/homologacao de cada provedor.
- Criptografar `credentials` com KMS/pgsodium/Vault antes de salvar secrets reais.
- Confirmar documentacao oficial e assinatura de webhook de cada provedor.
- Executar teste manual de UX em dispositivos reais antes de vender para clientes.
