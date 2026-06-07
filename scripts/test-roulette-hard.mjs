import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const adminLootboxes = readFileSync("src/pages/admin/AdminLootboxes.tsx", "utf8");
const rulesEditor = readFileSync("src/components/admin/LootboxRulesEditor.tsx", "utf8");

assert.match(server, /app\.post\("\/api\/lootboxes\/:userId\/open"/, "Endpoint de roleta/caixinha deve existir.");
assert.match(server, /requestedSpinId/, "Cliente deve conseguir abrir giro especifico sem reuso implicito.");
assert.match(server, /box\.status = "opening"/, "Giro deve ter lock anti-concorrencia.");
assert.match(server, /box\.status = "opened"/, "Giro usado deve ser marcado como aberto.");
assert.match(server, /spinId: box\.id/, "Resultado deve retornar spinId.");
assert.match(server, /purchaseId: box\.purchaseId/, "Resultado deve vincular purchaseId.");
assert.match(server, /campaignId: box\.scopeId/, "Resultado deve vincular campanha/modalidade.");
assert.match(server, /customerId: customer\?\.id/, "Resultado deve vincular cliente.");
assert.match(server, /status: "opened"/, "Resultado deve registrar status.");
assert.match(server, /getLootboxConfigByScope/, "Roleta deve usar configuracao por escopo/campanha.");
assert.match(server, /stock|currentCounter|everyXTickets/, "Configuracao deve ter estoque/progresso de premios.");
assert.match(adminLootboxes, /AdminLootboxes|Caixinha|Roleta|Experi/, "Admin de caixinha/roleta deve existir.");
assert.match(rulesEditor, /probability|weight|chance|everyXTickets|milestones/i, "Admin deve configurar chance/peso/estoque de premio.");

console.log("PASS: contrato hard de Roleta/Caixinha validado.");
