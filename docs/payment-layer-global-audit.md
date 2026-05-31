# Auditoria Global da Camada de Pagamentos

Data: 2026-05-31

## Escopo

Gateways auditados:

- Asaas
- Pay2M
- PagBank
- Mercado Pago
- Cora
- PrimePag

## Resumo Executivo

Status: APROVADO COM ENDURECIMENTOS APLICADOS.

A camada de pagamentos agora possui contrato comum para criação Pix, consulta, webhook, reconciliação e teste de conexão. O checkout segue usando um registro interno normalizado em `payments`, com baixa por fila idempotente e tenant-scoped.

## Contrato de Provider

Todos os providers reais implementam:

- `createPixPayment()`
- `getPayment()`
- `handleWebhook()`
- `reconcile()`
- `testConnection()`
- `normalizePixPaymentResult()`

Contrato interno normalizado:

```json
{
  "provider": "gateway",
  "provider_payment_id": "id externo",
  "provider_reference": "referencia interna/externa segura",
  "pix_copy_paste": "PIX copia e cola",
  "qr_code_base64": "imagem base64 opcional",
  "status": "pending/paid/etc",
  "expiration": "data/hora ou vencimento retornado"
}
```

## Tenant Isolation

Verificado:

- `payment_gateways`: resolvido por `tenant_id` via `getDefaultPaymentGatewayConfig(tenantId)`.
- `payments`: criação e atualização sempre filtram `tenant_id`.
- `orders/purchases`: baixa usa `payment.order_id` tenant-scoped.
- `webhook_events`: eventos salvos com `tenant_id`, provider e idempotência por payment/status.
- cotas/números/Fazendinha: liberação acontece pela fila de pagamento com `tenant_id`.

Regra crítica mantida: webhook não libera pedido apenas por `external_reference`.

## Webhooks

Verificado:

- Rotas dedicadas por gateway respondem HTTP 200 rapidamente quando precisam ignorar/absorver reenvios.
- Eventos duplicados são bloqueados por chave idempotente.
- Pagamento pago sem `payment` interno do mesmo tenant é bloqueado.
- Expirado/cancelado não reabre pedido pago.

## Gateway Policy

Regra aplicada:

- Gateway ativo principal é sempre único por tenant (`is_default = true` em apenas um enabled).
- Gateways adicionais habilitados são tratados como fallback com prioridade (`config_json.gatewayRole = "fallback"` e `fallbackPriority`).
- Não há múltiplos gateways concorrentes sem prioridade definida.

## Observabilidade

Adicionado/validado:

- `paymentLogs`: trilha normalizada de criação/atualização/reconciliação/teste.
- `webhookLogs`: trilha de eventos webhook com provider, status HTTP e mensagem.
- `gatewayHealth`: status agregado por tenant/provider com contadores de sucesso/falha.

Endpoints admin:

- `GET /api/admin/payments/logs`
- `GET /api/admin/payments/webhook-logs`
- `GET /api/admin/payments/gateway-health`

## Achados

### ALTO

- Providers não expunham todos o método `reconcile()` no mesmo contrato.
  - Correção: método adicionado em todos os providers.

### MÉDIO

- Retornos dos providers eram heterogêneos.
  - Correção: `normalizePixPaymentResult()` adicionado para padronizar o contrato interno.

### MÉDIO

- Política de gateway ativo/fallback estava implícita.
  - Correção: `enforcePaymentGatewayPolicy()` garante gateway principal único e fallback com prioridade.

### BAIXO

- Observabilidade era concentrada em `paymentWebhookLogs`.
  - Correção: adicionados `paymentLogs`, `webhookLogs` e `gatewayHealth`.

## Recomendação para Produção

- Manter apenas um gateway default por tenant.
- Usar fallback somente com prioridade explícita e teste de saúde.
- Monitorar `gatewayHealth` no admin/superadmin.
- Continuar validando webhooks por token/assinatura quando o provedor oferecer.
- Nunca liberar cotas por tela de sucesso, apenas por webhook/reconciliação idempotente.
