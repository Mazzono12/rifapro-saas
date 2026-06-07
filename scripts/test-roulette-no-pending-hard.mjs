import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");

assert.match(server, /function assertGamificationEventReleased/, "Guard de liberacao pos-pagamento deve existir.");
assert.match(server, /purchase\.status !== "paid"/, "Compra pendente/expirada/cancelada nao pode liberar roleta/caixinha.");
assert.match(server, /Recompensa disponivel somente apos pagamento confirmado/, "Erro explicito de pre-pagamento deve existir.");
assert.match(server, /mystery-boxes\/:eventId\/open[\s\S]*assertGamificationEventReleased/, "Caixinha premiada deve chamar guard antes de abrir.");
assert.match(server, /scratchcards\/:eventId\/reveal[\s\S]*assertGamificationEventReleased/, "Raspadinha deve chamar guard antes de revelar.");

console.log("PASS: roleta/caixinha pendente bloqueada por contrato.");
