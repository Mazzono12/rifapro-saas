import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const adminConfig = readFileSync("src/pages/admin/AdminConfig.tsx", "utf8");
const adminRaffles = readFileSync("src/pages/admin/AdminRaffles.tsx", "utf8");
const adminModalidades = readFileSync("src/pages/admin/AdminModalidades.tsx", "utf8");
const adminFazendinha = readFileSync("src/pages/admin/AdminFazendinha.tsx", "utf8");

assert.match(server, /reservationSettings[\s\S]*raffleMinutes: 15/, "Default rifa tradicional deve ser 15 minutos.");
assert.match(server, /reservationSettings[\s\S]*numberModeMinutes: 5/, "Default modalidades deve ser 5 minutos.");
assert.match(server, /reservationSettings[\s\S]*fazendinhaMinutes: 5/, "Default Fazendinha deve ser 5 minutos.");
assert.match(server, /getRaffleReservationTtlMs/, "TTL de rifa tradicional deve ser resolvido por helper.");
assert.match(server, /getNumberModeReservationTtlMs/, "TTL de modalidades deve ser resolvido por helper.");
assert.match(server, /getFazendinhaReservationTtlMs/, "TTL de Fazendinha deve ser resolvido por helper.");
assert.match(server, /reservationExpiresAt\(getRaffleReservationTtlMs\(raffle\)\)/, "Compra de rifa deve usar TTL configuravel.");
assert.match(server, /reservationExpiresAt\(getNumberModeReservationTtlMs\(tenantId, mode\)\)/, "Compra de modalidade deve usar TTL configuravel.");
assert.match(server, /reservationExpiresAt\(getFazendinhaReservationTtlMs\(tenantId\)\)/, "Compra de Fazendinha deve usar TTL configuravel.");
assert.match(adminConfig, /Reservas/, "Admin Config deve ter secao Reservas.");
assert.match(adminRaffles, /Reserva da campanha \(min\)/, "Rifa deve aceitar override por campanha.");
assert.match(adminModalidades, /Reserva pendente \(min\)/, "Modalidades devem aceitar override.");
assert.match(adminFazendinha, /Reserva pendente \(min\)/, "Fazendinha deve aceitar override.");

console.log("PASS: expiracao de reservas configuravel validada.");
