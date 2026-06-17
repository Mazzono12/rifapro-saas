import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(root, file), "utf8");

const server = read("server.ts");
const admin = read("src/pages/admin/AdminPaymentGateways.tsx");
const providerSource = read("src/server/payments/AsaasProvider.ts");
const prodCheck = read("scripts/prod-check.mjs");

function mustInclude(source, snippet, label) {
  assert.ok(source.includes(snippet), `${label}: faltando ${snippet}`);
}

function mustNotInclude(source, snippet, label) {
  assert.ok(!source.includes(snippet), `${label}: nao deve conter ${snippet}`);
}

mustInclude(providerSource, '"/payments"', "AsaasProvider deve criar cobranca em /payments");
mustInclude(providerSource, '"billingType": "PIX"', "AsaasProvider deve criar cobranca PIX");
mustInclude(providerSource, "/pixQrCode", "AsaasProvider deve buscar QR Code PIX oficial");
mustInclude(providerSource, "encodedImage", "AsaasProvider deve ler imagem base64");
mustInclude(providerSource, "payload", "AsaasProvider deve ler copia-e-cola");
mustInclude(providerSource, "getPayment(paymentId", "AsaasProvider deve consultar status da cobranca");

mustInclude(server, 'const gateway = "asaas";', "Checkout deve resolver PIX efetivo como Asaas");
mustInclude(server, 'const selectedGateway = process.env.RIFAPRO_TEST_MODE && isInternalPixGateway(requestedGateway) ? requestedGateway : "asaas"', "Checkout deve bloquear fallback real e permitir mock apenas em teste");
mustInclude(server, 'pixGateway: "asaas"', "Pedido deve salvar pixGateway Asaas");
mustInclude(server, 'paymentProvider: "asaas"', "Pedido deve salvar paymentProvider Asaas");
mustInclude(server, 'externalPaymentId: asaasPaymentId', "Pedido deve salvar externalPaymentId Asaas");
mustInclude(server, "pixQrCodeBase64", "Pedido/status deve salvar QR Code Asaas");
mustInclude(server, "pix_copy_paste: pixPayload", "Payment record deve salvar copia-e-cola");
mustInclude(server, 'gateway: "asaas"', "Resposta publica deve expor gateway Asaas");
mustInclude(server, "refreshAsaasPixForPendingPurchase", "Recuperacao deve tentar recompor QR Code Asaas pendente");
mustInclude(server, "releaseReservedNumbers(raffle, purchase.numeros)", "Webhook terminal deve liberar cotas tradicionais");
mustInclude(server, 'modePurchase.status = "cancelled"', "Webhook terminal deve cancelar modalidade");
mustInclude(server, 'farmPurchase.statusPagamento = "cancelled"', "Webhook terminal deve cancelar fazendinha");
mustInclude(server, "timingSafeEqual", "Webhook Asaas deve validar token com comparacao segura");
mustInclude(server, "asaasRemoteVerified: true", "Webhook pago deve consultar status remoto Asaas antes da baixa");
mustInclude(server, 'const requestedProvider = "asaas";', "Admin API deve forcar Asaas como provider solicitado");
mustInclude(server, 'const provider = "asaas";', "Config legada deve gerar Asaas como provider");
mustInclude(server, "config.enabled = false", "Politica deve desabilitar outros gateways");
mustInclude(server, 'typeof value === "string" && !value.trim()', "Salvar metadados do Asaas nao pode apagar API Key vazia/mascarada ja salva");
mustInclude(server, 'typeof raw.webhook_secret === "string" && !raw.webhook_secret.trim()', "Normalizacao deve preservar segredo de webhook vazio/mascarado");
mustInclude(server, 'throw new Error("Não foi possível gerar PIX pelo Asaas.")', "Falha Asaas deve retornar erro claro sem fingir pagamento");

mustInclude(admin, 'const publicGatewayIds = ["asaas"]', "Admin deve expor apenas Asaas na selecao");
mustInclude(admin, 'normalized.active = "asaas"', "Admin deve salvar sempre Asaas");
mustInclude(admin, 'webhookUrl: "/api/webhooks/asaas"', "Admin deve fixar webhook Asaas");
mustNotInclude(admin, '<option value="sandbox">', "Admin nao deve expor sandbox em producao");

mustInclude(prodCheck, '"ASAAS_API_KEY"', "prod-check deve exigir ASAAS_API_KEY");
mustInclude(prodCheck, "ASAAS_API_KEY obrigatoria", "prod-check deve falhar sem chave Asaas em producao");

const calls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  if (String(url).endsWith("/customers")) return new Response(JSON.stringify({ id: "cus_123" }), { status: 200 });
  if (String(url).endsWith("/payments")) return new Response(JSON.stringify({ id: "pay_123", status: "PENDING", externalReference: "tenant:order" }), { status: 200 });
  if (String(url).endsWith("/payments/pay_123/pixQrCode")) return new Response(JSON.stringify({ encodedImage: "BASE64PNG", payload: "000201ASAAS", expirationDate: "2026-06-16T19:20:00Z" }), { status: 200 });
  if (String(url).endsWith("/payments/pay_123")) return new Response(JSON.stringify({ id: "pay_123", status: "RECEIVED" }), { status: 200 });
  if (String(url).endsWith("/myAccount")) return new Response(JSON.stringify({ id: "acct_123" }), { status: 200 });
  return new Response(JSON.stringify({ errors: [{ description: "unexpected" }] }), { status: 404 });
};

try {
  const transformed = transformSync(providerSource, { loader: "ts", format: "esm" }).code;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(transformed).toString("base64")}`;
  const { AsaasProvider } = await import(moduleUrl);
  const provider = new AsaasProvider({ apiKey: "$aact_prod_fake", environment: "production", userAgent: "CIFHER Hard Test" });
  const customer = await provider.createCustomer({ name: "Cliente Teste", cpfCnpj: "12345678901", mobilePhone: "11999999999", externalReference: "C_1" });
  assert.equal(customer.id, "cus_123");
  const payment = await provider.createPixPayment({ customerId: "cus_123", value: 10, dueDate: "2026-06-16", externalReference: "tenant:order", description: "Pedido teste" });
  assert.equal(payment.id, "pay_123");
  const qr = await provider.getPixQrCode("pay_123");
  assert.equal(qr.encodedImage, "BASE64PNG");
  assert.equal(qr.payload, "000201ASAAS");
  const remote = await provider.getPayment("pay_123");
  assert.equal(remote.status, "RECEIVED");
  assert.ok(calls.some(call => call.url === "https://api.asaas.com/v3/payments"), "Deve chamar Asaas producao /payments");
  assert.ok(calls.some(call => call.url === "https://api.asaas.com/v3/payments/pay_123/pixQrCode"), "Deve chamar Asaas producao /pixQrCode");
  const paymentCall = calls.find(call => call.url === "https://api.asaas.com/v3/payments");
  assert.match(String(paymentCall?.init?.body || ""), /"billingType":"PIX"/, "Payload Asaas deve usar billingType PIX");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("PASS: Asaas isolado como unico gateway real, cria cobranca PIX, busca QR/copia-e-cola, padroniza checkout/status e bloqueia fallback em producao.");
