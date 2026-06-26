import fs from "node:fs";
import assert from "node:assert/strict";

const server = fs.readFileSync("server.ts", "utf8");
const page = fs.readFileSync("src/pages/admin/AdminWhatsApp.tsx", "utf8");

function includesAll(source, items, label) {
  for (const item of items) assert.ok(source.includes(item), `${label}: missing ${item}`);
}

includesAll(server, [
  'app.post("/api/admin/raffles/:id/whatsapp/new-raffle"',
  'app.post("/api/admin/raffles/:id/whatsapp/result"',
  'adminCanAccessTenant(req, item.tenant_id)',
  'raffle.status !== "active"',
  'Resultado exige ganhador pago definido',
  'purchase.status === "paid"',
  'purchase.tenant_id === tenantId',
  'purchase.tenant_id === raffle.tenant_id',
  'customerHasWhatsAppOptOut(tenantId, phone)',
  'isValidBrazilianWhatsAppPhone(phone)',
  'whatsapp-raffle-automation:${input.tenantId}:${input.raffle.id}:${input.automation}:${recipient.phone}',
  'recordWhatsAppCloudLog(input.tenantId',
  'message_type: "whatsapp_raffle_automation"',
  'const eventMap: Record<typeof input.automation, string>',
  'const templateMap: Record<typeof input.automation, string>'
], "server raffle whatsapp automation");

includesAll(page, [
  'status: "implemented"',
  'new_raffle_announcement',
  'raffle_result_announcement',
  '/api/admin/raffles/${selectedRaffleId}/whatsapp/${kind}',
  'window.confirm',
  'Enviar aviso de novo sorteio',
  'Enviar resultado do sorteio',
  '/api/admin/raffles',
  '{link_campanha}',
  '{link_resultado}',
  '{ganhador}'
], "admin whatsapp ui");

const renderForbidden = [
  'useEffect(() => { void triggerRaffleAutomation',
  'fetch(`/api/admin/raffles/${selectedRaffleId}/whatsapp/${kind}`);',
  'fetch("/api/admin/raffles/:id/whatsapp/new-raffle"',
  'fetch("/api/admin/raffles/:id/whatsapp/result"'
];
for (const item of renderForbidden) assert.ok(!page.includes(item), `must not trigger raffle automation on render: ${item}`);

assert.ok(server.includes('if (whatsappMessageQueue.some(message => message.idempotency_key === idempotencyKey)) { skipped += 1; continue; }'), "must skip duplicate contact/campaign messages");
assert.ok(server.includes('raffle.status !== "completed" && audit.status !== "published" && audit.status !== "executed"'), "result requires completed/executed/published state");
assert.ok(!server.includes('scheduleAutomation("new_raffle"') && !server.includes('scheduleAutomation("raffle_result"'), "must not add automatic save/publish triggers");
console.log("[whatsapp-automation-phase8-2a] ok");


