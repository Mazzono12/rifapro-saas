# Integracao Banco Cora Pix

## Visao Geral

A integracao Banco Cora Pix e plug-and-play por tenant. Cada tenant configura suas proprias credenciais em **Admin > Gateways de Pagamento > Banco Cora Pix real**.

Regra de produto: o Pix acontece dentro do checkout da plataforma. Nao ha redirecionamento do cliente.

## Requisitos Cora

A documentacao Cora informa que a Integracao Direta exige:

- client_id;
- certificado;
- chave privada;
- token de autenticacao;
- uso do certificado e chave em todas as requisicoes;
- header `Idempotency-Key` em formato UUID nas emissões.

O Banco Cora pode exigir CoraPro/Integracao Direta habilitada na conta.

## Endpoints

Documentacao oficial: https://developers.cora.com.br

Endpoints confirmados:

- Token Integracao Direta stage: `POST https://matls-clients.api.stage.cora.com.br/token`
- QR Code Pix v2 stage: `POST https://api.stage.cora.com.br/v2/invoices/`
- Na Integracao Direta, usar base mTLS: `https://matls-clients.api.stage.cora.com.br/v2/invoices/`

O QR Code Pix v2 usa:

- `payment_forms: ["PIX"]`;
- header `Idempotency-Key: UUID_V4`;
- valor em centavos no campo `services[].amount`;
- Pix copia e cola no campo `emv`, quando retornado.

## Configuracao Admin

Campos:

- ativar/desativar Cora Pix;
- sandbox/producao;
- client_id;
- client_secret, se aplicavel;
- certificado PEM;
- chave privada PEM;
- webhook token opcional;
- tempo de expiracao Pix.

Credenciais sensiveis sao armazenadas pela camada segura do gateway e mascaradas no frontend.

## Checkout

Quando o provider ativo for `cora`:

1. O backend cria uma fatura Pix v2 com `payment_forms: ["PIX"]`.
2. Salva `payments.provider = 'cora'`.
3. Salva `provider_payment_id`, `provider_reference`, `txid`, `pix_copy_paste`, `qr_code_base64` e `expiration_date`.
4. Retorna Pix copia e cola para renderizar o QR Code no checkout.

## Webhook

URL publica:

`https://SEU_DOMINIO.com/api/webhooks/cora`

Fluxo:

1. Recebe webhook.
2. Valida token/header se configurado.
3. Salva payload bruto em `webhook_events`.
4. Consulta a cobranca na API Cora quando houver `provider_payment_id`.
5. Localiza pagamento local por `tenant_id + provider='cora' + provider_payment_id/txid`.
6. Nunca baixa pedido apenas por `external_reference`.
7. Se pago, enfileira baixa usando `payment.order_id`.
8. Eventos duplicados sao ignorados por idempotencia.

Idempotencia:

`tenant_id + provider + provider_payment_id + status + txid + end_to_end`

## Reconciliação Manual

Endpoint admin:

`POST /api/admin/payments/cora/reconcile`

Body:

```json
{
  "provider_payment_id": "invoice_id_ou_txid"
}
```

Primeiro o backend valida o pagamento local no tenant atual. Depois consulta a Cora e, se estiver pago, libera cotas/numeros uma unica vez.

## Troubleshooting

- `Certificado e chave privada Cora sao obrigatorios`: configure certificado PEM e chave privada PEM.
- `Cora nao retornou id/emv`: a conta pode nao estar habilitada para Pix/fatura v2, ou a resposta nao trouxe QR Code.
- Webhook nao baixa: valide dominio, token do webhook e existencia do `payment` local com o mesmo `provider_payment_id`.
- Falha de token: confirme ambiente, client_id, certificado e chave privada.
