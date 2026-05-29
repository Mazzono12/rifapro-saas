import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const port = Number(process.env.PORT || (4300 + Math.floor(Math.random() * 900)));
const baseUrl = `http://127.0.0.1:${port}`;
const host = "cliente-a.meudominio.com";
const webhookSecret = "full-purchase-staging-secret";
const startedAt = new Date().toISOString();
const report = {
  startedAt,
  mockOnly: true,
  host,
  clients: [],
  campaigns: [],
  purchases: [],
  validations: {},
  errors: []
};

const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.full-purchase@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-full-purchase-staging-hard-jwt-secret-long-value",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-full-purchase-staging-hard-gateway-key"
};

const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 70; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status >= 200) return;
    } catch {
      await wait(120);
    }
  }
  throw new Error("Servidor de staging mock nao iniciou.");
}

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function login(email, password) {
  const { response, body } = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  assert.equal(response.status, 200, `Login falhou para ${email}: ${JSON.stringify(body)}`);
  return body.token;
}

async function createTenantAdmin(superHeaders) {
  const email = `admin.full-purchase.${Date.now()}@teste.local`;
  const { response, body } = await json("/api/superadmin/users", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({
      nome: "Admin Full Purchase",
      email,
      password: "SenhaTenant123!",
      role: "tenant_admin",
      tenant_id: "tenant-cliente-a"
    })
  });
  assert.equal(response.status, 201, `Criacao admin tenant falhou: ${JSON.stringify(body)}`);
  return login(email, "SenhaTenant123!");
}

async function ensureMockTenant(adminHeaders) {
  await json("/api/admin/gateways", {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({
      pix: {
        apiKey: "mock-full-purchase-key",
        webhookSecret,
        webhookUrl: "/api/webhooks/payment/mercadopago",
        sandbox: true
      }
    })
  });

  const whatsapp = await json("/api/admin/whatsapp/config", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ enabled: true, provider: "mock", environment: "sandbox", default_language: "pt_BR" })
  });
  assert.equal(whatsapp.response.status, 200, `Config WhatsApp mock falhou: ${JSON.stringify(whatsapp.body)}`);
}

async function createLargeRaffle(adminHeaders) {
  const title = `Campanha Full Purchase Mock ${Date.now()}`;
  const { response, body } = await json("/api/admin/raffles", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      title,
      description: "Campanha criada para teste completo de checkout em ambiente mock.",
      price: 0.5,
      totalTickets: 20000,
      drawDate: "2026-12-31T20:00:00Z",
      image: "https://player.mediadelivery.net/play/670514/b27261d2-ffd9-4e39-aa23-d7c400424177",
      mediaUrl: "https://player.mediadelivery.net/play/670514/b27261d2-ffd9-4e39-aa23-d7c400424177",
      mediaType: "bunny",
      checkoutMediaUrl: "https://player.mediadelivery.net/play/670514/b27261d2-ffd9-4e39-aa23-d7c400424177",
      checkoutMediaType: "bunny",
      status: "active"
    })
  });
  assert.equal(response.status, 200, `Criacao de campanha mock falhou: ${JSON.stringify(body)}`);
  return body;
}

async function listActiveRaffles() {
  const { response, body } = await json("/api/raffles", { headers: { "x-forwarded-host": host } });
  assert.equal(response.status, 200, `Listagem publica de campanhas falhou: ${JSON.stringify(body)}`);
  return Array.isArray(body) ? body.filter(raffle => raffle.status === "active") : [];
}

const clients = [
  { name: "Cliente Teste 01", phone: "11991000001", email: "cliente01+staging@teste.local", city: "Sao Paulo", state: "SP", cpf: "11111111111", tickets: 1, label: "1 cota" },
  { name: "Cliente Teste 02", phone: "11991000002", email: "cliente02+staging@teste.local", city: "Rio de Janeiro", state: "RJ", cpf: "22222222222", tickets: 5, label: "pacote pequeno" },
  { name: "Cliente Teste 03", phone: "11991000003", email: "cliente03+staging@teste.local", city: "Belo Horizonte", state: "MG", cpf: "33333333333", tickets: 100, label: "pacote medio" },
  { name: "Cliente Teste 04", phone: "11991000004", email: "cliente04+staging@teste.local", city: "Curitiba", state: "PR", cpf: "44444444444", tickets: 700, label: "pacote grande" },
  { name: "Cliente Teste 05", phone: "11991000005", email: "cliente05+staging@teste.local", city: "Florianopolis", state: "SC", cpf: "55555555555", tickets: 37, label: "quantidade manual" }
];

function buildCustomer(client, raffleId) {
  return {
    name: client.name,
    phone: client.phone,
    email: client.email,
    cpf: client.cpf,
    city: client.city,
    state: client.state,
    accessPassword: "123456"
  };
}

async function buyAndConfirm({ raffle, client, index, adminHeaders }) {
  const customer = buildCustomer(client, raffle.id);
  const beforeMessages = await json("/api/admin/whatsapp/messages", { headers: adminHeaders });
  assert.equal(beforeMessages.response.status, 200, "Nao foi possivel consultar fila WhatsApp antes da compra.");

  const preview = await json("/api/checkout/preview", {
    method: "POST",
    headers: { "x-forwarded-host": host },
    body: JSON.stringify({ type: "raffle", raffleId: raffle.id, tickets: client.tickets, customer })
  });
  assert.equal(preview.response.status, 200, `Preview falhou para ${client.name}: ${JSON.stringify(preview.body)}`);
  assert.ok(Number(preview.body.quantity || 0) >= client.tickets, "Preview deve preservar quantidade ou aplicar bonus.");
  assert.ok(Number(preview.body.total || 0) >= 0, "Preview deve retornar total seguro.");

  const purchase = await json(`/api/raffles/${raffle.id}/buy`, {
    method: "POST",
    headers: { "x-forwarded-host": host },
    body: JSON.stringify({
      tickets: client.tickets,
      contact: customer.phone,
      customer,
      refCode: index === 1 ? "REF-STAGING-MOCK" : undefined
    })
  });
  assert.equal(purchase.response.status, 200, `Compra falhou para ${client.name}: ${JSON.stringify(purchase.body)}`);
  assert.ok(purchase.body.purchaseId, "Compra deve retornar purchaseId.");
  assert.ok(purchase.body.pixPayload, "Compra deve retornar PIX mock/sandbox.");
  assert.ok(Array.isArray(purchase.body.numeros) && purchase.body.numeros.length >= client.tickets, "Bilhete deve conter cotas reservadas.");
  assert.equal(new Set(purchase.body.numeros).size, purchase.body.numeros.length, "Compra nao pode duplicar cota no mesmo bilhete.");

  const pending = await json(`/api/checkout/orders/${purchase.body.purchaseId}/status`, { headers: { "x-forwarded-host": host } });
  assert.equal(pending.response.status, 200, "Consulta segura de status deve funcionar.");

  const webhook = await json("/api/webhooks/payment/mercadopago", {
    method: "POST",
    headers: { "x-forwarded-host": host, "x-webhook-secret": webhookSecret },
    body: JSON.stringify({
      eventId: `evt-full-${raffle.id}-${client.phone}`,
      status: "approved",
      external_reference: purchase.body.purchaseId,
      metadata: { mock: true }
    })
  });
  assert.equal(webhook.response.status, 200, `Webhook aprovado falhou: ${JSON.stringify(webhook.body)}`);

  const duplicateWebhook = await json("/api/webhooks/payment/mercadopago", {
    method: "POST",
    headers: { "x-forwarded-host": host, "x-webhook-secret": webhookSecret },
    body: JSON.stringify({
      eventId: `evt-full-${raffle.id}-${client.phone}`,
      status: "approved",
      external_reference: purchase.body.purchaseId,
      metadata: { mock: true, duplicate: true }
    })
  });
  assert.equal(duplicateWebhook.response.status, 200, "Webhook duplicado deve ser idempotente.");

  await wait(160);
  const status = await json(`/api/checkout/orders/${purchase.body.purchaseId}/status`, { headers: { "x-forwarded-host": host } });
  assert.equal(status.response.status, 200, "Consulta pos-webhook deve funcionar.");
  assert.equal(status.body.paid || status.body.purchase?.status === "paid", true, "Pedido deve estar pago apos webhook mock.");

  const afterMessages = await json("/api/admin/whatsapp/messages", { headers: adminHeaders });
  assert.equal(afterMessages.response.status, 200, "Nao foi possivel consultar fila WhatsApp apos compra.");
  const ticketMessages = afterMessages.body.filter(message => message.order_id === purchase.body.purchaseId && message.message_type === "ticket_confirmation");
  assert.equal(ticketMessages.length, 1, "Webhook duplicado nao pode duplicar WhatsApp.");

  const purchaseReport = {
    campaignId: raffle.id,
    campaignTitle: raffle.title,
    customer: client.name,
    email: client.email,
    scenario: client.label,
    requestedTickets: client.tickets,
    orderId: purchase.body.purchaseId,
    status: status.body.purchase?.status || purchase.body.status,
    numbersCount: purchase.body.numeros.length,
    pixMock: true,
    whatsappQueued: ticketMessages.length === 1,
    mediaInCampaign: Boolean(raffle.checkoutMediaUrl || raffle.mediaUrl || raffle.image)
  };
  report.purchases.push(purchaseReport);
  return purchaseReport;
}

function runStaticCheckoutAssertions() {
  const css = readFileSync("src/index.css", "utf8");
  const raffleDetails = readFileSync("src/pages/RaffleDetails.tsx", "utf8");
  const receipt = readFileSync("src/components/checkout/PrePaymentReceiptModal.tsx", "utf8");
  const media = readFileSync("src/components/checkout/CheckoutCampaignMedia.tsx", "utf8");

  assert(!/\.fixed\.inset-0\[class\*="z-\[80\]"\]\s+button/.test(css), "CSS nao pode forcar botoes de overlay fixo generico.");
  assert(!/checkout-modal-title[\s\S]{0,180}overflow-wrap:\s*anywhere/.test(css), "Titulo do checkout nao pode quebrar por caractere.");
  assert(css.includes(".checkout-campaign-media"), "CSS da midia do checkout deve existir.");
  assert(raffleDetails.includes("<CheckoutCampaignMedia"), "Checkout da rifa deve mostrar foto/video da campanha.");
  assert(receipt.includes("<CheckoutCampaignMedia"), "Recibo pre-PIX deve mostrar foto/video da campanha.");
  assert(media.includes("checkout-media-fallback"), "Midia do checkout deve ter fallback visual.");
  report.validations.noVerticalTextStatic = true;
  report.validations.checkoutMediaStatic = true;
  report.validations.floatingButtonsHiddenDuringCheckout = raffleDetails.includes("checkoutCriticalActive") && raffleDetails.includes("!checkoutCriticalActive && <FloatingActions");
}

function writeReports() {
  report.finishedAt = new Date().toISOString();
  mkdirSync("reports", { recursive: true });
  mkdirSync("docs", { recursive: true });
  writeFileSync("reports/full-purchase-staging-hard.json", `${JSON.stringify(report, null, 2)}\n`);
  const totalPurchases = report.purchases.length;
  const markdown = `# Auditoria full purchase staging hard

Gerado em: ${report.finishedAt}

## Escopo

- Ambiente: servidor local em modo production com gateway PIX mock/sandbox.
- Host tenant: ${host}
- Dinheiro real: nao utilizado.
- Clientes fake: ${report.clients.length}
- Campanhas testadas: ${report.campaigns.length}
- Compras executadas: ${totalPurchases}

## Validacoes

- Texto vertical no checkout: ${report.validations.noVerticalTextStatic ? "corrigido por assercao estatica" : "nao validado"}
- Midia no checkout/recibo: ${report.validations.checkoutMediaStatic ? "presente" : "nao validada"}
- Floating buttons durante checkout: ${report.validations.floatingButtonsHiddenDuringCheckout ? "ocultos" : "nao validado"}
- PIX mock/sandbox: ${report.mockOnly ? "sim" : "nao"}
- WhatsApp mock enfileirado uma vez por pedido: ${report.validations.whatsappIdempotent ? "sim" : "nao validado"}
- Sem cotas duplicadas por campanha: ${report.validations.noDuplicateNumbers ? "sim" : "nao validado"}

## Clientes

${report.clients.map(client => `- ${client.name} (${client.email}) - ${client.city}/${client.state}`).join("\n")}

## Campanhas

${report.campaigns.map(campaign => `- ${campaign.title} (${campaign.id})`).join("\n")}

## Compras

${report.purchases.map(item => `- ${item.customer} em ${item.campaignTitle}: ${item.requestedTickets} cota(s), pedido ${item.orderId}, status ${item.status}, bilhete com ${item.numbersCount} numero(s), WhatsApp mock ${item.whatsappQueued ? "ok" : "falhou"}.`).join("\n")}

## Observacoes

O teste valida fluxo completo em mock: preview, compra, PIX, webhook aprovado, status seguro, bilhete/cotas e idempotencia do WhatsApp. Nao chama gateway real e nao usa dados reais.
`;
  writeFileSync("docs/full-purchase-staging-audit.md", markdown);
}

try {
  runStaticCheckoutAssertions();
  await waitForServer();
  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const tenantToken = await createTenantAdmin(superHeaders);
  const adminHeaders = { Authorization: `Bearer ${tenantToken}` };
  await ensureMockTenant(adminHeaders);
  await createLargeRaffle(adminHeaders);

  let raffles = await listActiveRaffles();
  assert.ok(raffles.length > 0, "Deve existir ao menos uma campanha ativa para compras.");
  raffles = raffles.filter(raffle => String(raffle.tenant_id || raffle.tenantId || "tenant-cliente-a").includes("tenant-cliente-a") || raffle.id);
  report.campaigns = raffles.map(raffle => ({ id: raffle.id, title: raffle.title, media: Boolean(raffle.checkoutMediaUrl || raffle.mediaUrl || raffle.image) }));
  report.clients = clients.map(({ name, email, city, state, label }) => ({ name, email, city, state, scenario: label }));

  const usedNumbersByCampaign = new Map();
  for (const raffle of raffles) {
    usedNumbersByCampaign.set(raffle.id, new Set());
    for (const [index, client] of clients.entries()) {
      const purchase = await buyAndConfirm({ raffle, client, index, adminHeaders });
      const numberSet = usedNumbersByCampaign.get(raffle.id);
      assert.ok(purchase.numbersCount >= client.tickets, "Bilhete deve conter cotas compradas.");
      const orderStatus = report.purchases.at(-1);
      assert.ok(orderStatus.whatsappQueued, "WhatsApp automatico deve ser enfileirado no mock.");
      const status = await json(`/api/checkout/orders/${orderStatus.orderId}/status`, { headers: { "x-forwarded-host": host } });
      const numbers = status.body.purchase?.numeros || status.body.purchase?.numbers || [];
      for (const number of numbers) {
        assert.equal(numberSet.has(number), false, `Cota duplicada na campanha ${raffle.title}: ${number}`);
        numberSet.add(number);
      }
    }
  }

  report.validations.noDuplicateNumbers = true;
  report.validations.whatsappIdempotent = true;
  report.validations.fiveFakeClientsPurchased = report.clients.length === 5 && report.purchases.length >= report.campaigns.length * 5;
  writeReports();
  console.log(`full-purchase-staging-hard: ok (${report.purchases.length} compras mock em ${report.campaigns.length} campanha(s))`);
} catch (error) {
  report.errors.push(String(error?.stack || error?.message || error));
  writeReports();
  console.error(serverOutput);
  throw error;
} finally {
  server.kill("SIGTERM");
}
