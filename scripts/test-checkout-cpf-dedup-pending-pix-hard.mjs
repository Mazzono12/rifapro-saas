import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");
const raffle = readFileSync("src/pages/RaffleDetails.tsx", "utf8");
const cpf = readFileSync("src/utils/cpf.ts", "utf8");

function includes(text, needle, message) {
  assert.ok(text.includes(needle), message);
}

function before(text, first, second, message) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  assert.ok(firstIndex >= 0, `${message}: trecho inicial ausente (${first})`);
  assert.ok(secondIndex >= 0, `${message}: trecho final ausente (${second})`);
  assert.ok(firstIndex < secondIndex, message);
}

const buyStart = server.indexOf('app.post("/api/raffles/:id/buy"');
const buyEnd = server.indexOf('app.post("/api/modalidades/:mode/buy"', buyStart);
assert.ok(buyStart >= 0 && buyEnd > buyStart, "Rota de compra de rifa deve existir.");
const buyRoute = server.slice(buyStart, buyEnd);

includes(cpf, 'code: "INVALID_CPF"', "CPF inválido deve retornar INVALID_CPF.");
includes(cpf, "export function isValidCpf", "Validação real de CPF deve existir.");
includes(server, "function findCustomerByCpf", "Backend deve manter busca por CPF normalizado.");
includes(server, "customersByCpf[tenantCustomerKey(tenantId, cpf)] = customer", "Cliente deve ser indexado por tenant + CPF.");
includes(server, "const uniqueLookup = resolveUniqueCustomerByIdentity", "Cliente existente deve ser resolvido por identidade.");
includes(server, "return existing;", "findOrCreateCustomer deve reutilizar cliente existente.");

includes(server, "function findReusablePendingPixPurchaseForCpf", "Backend deve buscar PIX pendente por CPF.");
includes(server, "purchase.tenant_id === input.tenantId", "Busca de PIX pendente deve respeitar tenant.");
includes(server, "purchase.raffleId === input.raffleId", "Busca de PIX pendente deve respeitar campanha.");
includes(server, 'purchase.status === "pending"', "Busca deve considerar apenas pedido pendente.");
includes(server, 'normalizeCpf(purchase.customer?.cpf || "") === cpf', "Busca deve usar CPF normalizado do cliente.");
includes(server, "isPastReservationExpiry(purchase.reservedUntil || purchase.pixExpiresAt)", "Pedido pendente expirado deve ser tratado.");
includes(server, 'purchase.status = "cancelled"', "Pedido expirado deve ser cancelado.");
includes(server, "releaseReservedNumbers(raffle, purchase.numeros)", "Cotas antigas devem ser liberadas ao expirar.");
includes(server, "function buildReusablePendingPixResponse", "Backend deve montar resposta de reutilização.");
includes(server, "reused: true", "Resposta deve sinalizar reused=true.");
includes(server, 'reason: "PENDING_PIX_ALREADY_EXISTS"', "Resposta deve informar motivo PENDING_PIX_ALREADY_EXISTS.");
includes(server, "redirectUrl: `/checkout/pedido/${encodeURIComponent(purchase.purchaseId)}`", "Resposta deve redirecionar para página do pedido.");
includes(server, "pixQrCodeBase64", "Resposta deve preservar QR Code existente.");
includes(server, "pixPayload", "Resposta deve preservar copia-e-cola existente.");
includes(server, "stripSensitiveCustomerFields", "Resposta deve remover dados sensíveis.");

includes(buyRoute, "const checkoutCpf = normalizeCpf(req.body.customer?.cpf || \"\")", "Compra deve normalizar CPF.");
includes(buyRoute, "res.status(400).json(invalidCpfApiResponse())", "CPF inválido deve bloquear antes do gateway.");
includes(buyRoute, "const reusablePendingPix = findReusablePendingPixPurchaseForCpf", "Rota deve procurar PIX pendente existente.");
includes(buyRoute, "res.json(buildReusablePendingPixResponse(reusablePendingPix))", "Rota deve retornar pedido existente.");
before(buyRoute, "const reusablePendingPix = findReusablePendingPixPurchaseForCpf", "reserveAvailableNumbers(raffle, effectiveTickets)", "PIX pendente deve ser retornado antes de reservar novas cotas.");
before(buyRoute, "const reusablePendingPix = findReusablePendingPixPurchaseForCpf", "attachActiveGatewayPixToOrder", "PIX pendente deve ser retornado antes de criar nova cobrança.");
before(buyRoute, "const reusablePendingPix = findReusablePendingPixPurchaseForCpf", "const purchaseId = createPublicId()", "PIX pendente deve ser retornado antes de criar novo pedido.");

includes(raffle, "(data as any)?.reused", "Frontend deve tratar reused=true.");
includes(raffle, "PIX pendente encontrado", "Frontend deve avisar que encontrou PIX pendente.");
includes(raffle, "Encontramos um PIX pendente para este CPF. Continue o pagamento para finalizar sua compra.", "Mensagem amigável deve existir.");
includes(raffle, "navigate(redirectUrl)", "Frontend deve abrir a página do pedido/PIX existente.");

console.log("checkout-cpf-dedup-pending-pix-hard ok");
