import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const server = read("server.ts");
const types = read("src/types.ts");
const adminRaffles = read("src/pages/admin/AdminRaffles.tsx");
const home = read("src/pages/Home.tsx");
const raffleDetails = read("src/pages/RaffleDetails.tsx");
const hardSuite = read("scripts/test-hard-suite.mjs");
const pkg = read("package.json");

for (const token of [
  "countdownEnabled?: boolean",
  "countdownEndAt?: string",
  "salesEndAt?: string",
  "manuallyClosedAt?: string"
]) {
  assert(types.includes(token), `Raffle deve expor campo oficial: ${token}`);
}

for (const token of [
  "function getRaffleSalesDeadline",
  "if (raffle.countdownEnabled !== true) return \"\"",
  "const candidates = [raffle.countdownEndAt, raffle.salesEndAt]",
  ".sort((a, b) => new Date(b).getTime() - new Date(a).getTime())",
  "function isRaffleSalesExpired",
  "function assertRaffleOpenForCheckout",
  "if (raffle.status !== \"active\") throw new Error(\"Rifa encerrada ou indisponivel\")",
  "if (isRaffleSalesExpired(raffle)) throw new Error(\"Vendas encerradas pelo contador regressivo\")",
  "function normalizeRaffleCountdownPayload",
  "countdownEndAt: \"\"",
  "salesEndAt: \"\"",
  "manuallyClosedAt: \"\""
]) {
  assert(server.includes(token), `Backend sem regra oficial do contador: ${token}`);
}

assert(server.includes("assertRaffleOpenForCheckout(raffle);") && server.includes("reserveAvailableNumbers(raffle"), "Reserva deve bloquear por tempo apenas via assertRaffleOpenForCheckout.");
assert(server.includes("assertRaffleOpenForCheckout(addonRaffle)"), "Rifa adicional/upsell deve respeitar contador oficial.");
assert(server.includes("app.post(\"/api/checkout/preview\"") && server.includes("return res.status(403).json({ error: error instanceof Error ? error.message"), "Preview deve bloquear por tempo somente via regra oficial.");
assert(server.includes("app.post(\"/api/raffles/:id/buy\"") && server.includes("Vendas encerradas pelo contador regressivo"), "Compra deve bloquear por tempo somente via regra oficial.");
assert(server.includes("salesDeadline") && server.includes("salesExpired") && server.includes("Vendas encerradas"), "Payload publico deve informar deadline/expirado sem mutar status.");
assert(!/drawDate[\s\S]{0,160}status\s*=\s*["']completed["']/.test(server), "drawDate nao pode encerrar rifa automaticamente.");
assert(!/webhook[\s\S]{0,220}countdownEndAt|countdownEndAt[\s\S]{0,220}webhook/i.test(server), "Webhooks nao devem encerrar rifa por contador.");

for (const token of [
  "Ativar contador regressivo de vendas",
  "Fim das vendas",
  "countdownEnabled",
  "salesEndAt",
  "countdownEndAt",
  "toDateTimeLocal(currentRaffle.salesEndAt || currentRaffle.countdownEndAt || \"\")",
  "statusChangedToClosed",
  "statusChangedToActive"
]) {
  assert(adminRaffles.includes(token) || server.includes(token), `Admin/persistencia sem controle de contador: ${token}`);
}

for (const token of [
  "countdownEnabled: rawRaffle.countdownEnabled === true",
  "countdownEndAt: safeText(rawRaffle.countdownEndAt, \"\")",
  "salesEndAt: safeText(rawRaffle.salesEndAt, \"\")",
  "countdownLabel"
]) {
  assert(home.includes(token), `Home nao le contador: ${token}`);
}

for (const token of [
  "function getLatestSalesDeadline",
  ".sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || \"\"",
  "salesDeadline && <CountdownStrip",
  "expired={Boolean((raffle as any).salesExpired)}",
  "Vendas encerradas"
]) {
  assert(raffleDetails.includes(token), `Detalhe/checkout nao respeita contador: ${token}`);
}

assert(hardSuite.includes("scripts/test-countdown-sales-hard.mjs"), "production-readiness deve rodar test-countdown-sales-hard.");
assert(pkg.includes("\"test:countdown-sales-hard\""), "package.json deve expor test:countdown-sales-hard.");

console.log("countdown-sales-hard: ok");
