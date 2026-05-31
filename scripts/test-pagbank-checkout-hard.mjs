import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = readFileSync(join(root, "server.ts"), "utf8");

const attachCalls = server.match(/attachActiveGatewayPixToOrder\(/g) || [];
assert.ok(attachCalls.length >= 4, "checkouts devem usar gateway ativo.");

for (const needle of [
  "attachPagbankPixToOrder",
  "attachAsaasPixToOrder(input)) || (await attachPay2mPixToOrder(input)) || (await attachPagbankPixToOrder(input))",
  "gatewayRequiresWebhook = Boolean(getAsaasGatewayConfig(tenantId) || getPay2mGatewayConfig(tenantId) || getPagbankGatewayConfig(tenantId))",
  "const paid = req.body.statusPagamento === \"paid\" || (!gatewayRequiresWebhook && req.body.simulatePayment !== false)",
  "status: balancePayment >= amount ? \"paid\" as const : \"pending\" as const",
  "FAST_MODALITY_RESERVATION_TTL_MS",
  "TRADITIONAL_RAFFLE_RESERVATION_TTL_MS",
  "processPaymentJob",
  "confirmPurchase(purchase)",
  "confirmNumberModePurchase",
  "confirmFazendinhaPurchase"
]) assert.ok(server.includes(needle), `checkout PagBank sem compatibilidade obrigatoria: ${needle}`);

assert.ok(!/token[^;\n]*res\.json/.test(server), "Token PagBank nao deve voltar em resposta de checkout.");

console.log("PASS: PagBank integrado aos checkouts tradicional, NumberMode e Fazendinha com baixa por webhook.");
