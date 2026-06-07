import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const adminGamification = readFileSync("src/pages/admin/AdminGamification.tsx", "utf8");
const panel = readFileSync("src/components/GamificationPanel.tsx", "utf8");
const server = readFileSync("server.ts", "utf8");

assert.match(server, /winningTicket/, "Alias interno winningTicket pode continuar existindo.");
assert.match(adminGamification, /winningTicket: "Super Cota"/, "Admin deve vender winningTicket como Super Cota.");
assert.match(adminGamification, /label="Super Cotas"/, "Planejador deve usar Super Cotas.");
assert.match(panel, /Super Cota/, "Painel publico/admin deve exibir Super Cota.");
assert.doesNotMatch(adminGamification, /Bilhete premiado/, "Admin nao deve exibir Bilhete premiado.");
assert.doesNotMatch(panel, /Bilhete premiado/, "Painel nao deve exibir Bilhete premiado.");

console.log("PASS: winningTicket preservado como alias interno e exposto como Super Cota.");
