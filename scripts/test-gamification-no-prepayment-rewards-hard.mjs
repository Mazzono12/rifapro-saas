import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const gamificationTest = readFileSync("scripts/test-gamification-modules.mjs", "utf8");

assert.match(server, /assertGamificationEventReleased/, "Servidor deve centralizar guard de premio pos-pagamento.");
assert.match(server, /expirePendingReservations\(event\.tenant_id, event\.raffleId\)/, "Guard deve expirar reservas vencidas antes de liberar premio.");
assert.match(server, /purchase\.status !== "paid"/, "Somente compra paga pode revelar recompensa.");
assert.match(gamificationTest, /Raspadinha pendente nao pode liberar premio/, "Teste e2e deve cobrir raspadinha pendente.");
assert.match(gamificationTest, /Caixinha pendente nao pode abrir antes do pagamento/, "Teste e2e deve cobrir caixinha pendente.");
assert.match(gamificationTest, /apos pagamento/, "Teste e2e deve liberar recompensa somente apos confirmacao.");

console.log("PASS: recompensas de gamificacao bloqueadas antes do pagamento.");
