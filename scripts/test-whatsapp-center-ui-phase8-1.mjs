import fs from "node:fs";
import assert from "node:assert/strict";

const page = fs.readFileSync("src/pages/admin/AdminWhatsApp.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");

function includesAll(source, items, label) {
  for (const item of items) assert.ok(source.includes(item), `${label}: missing ${item}`);
}

includesAll(app, ['path="whatsapp"', 'AdminWhatsApp'], "/admin/whatsapp route");
includesAll(page, ["Conexao", "Templates", "Automacoes", "Recuperacao PIX", "Logs"], "tabs");
includesAll(page, [
  "Recuperacao de PIX pendente/abandonado",
  "PIX expirando",
  "PIX confirmado",
  "Compra aprovada",
  "Confirmacao de bilhetes/cotas",
  "Agradecimento pos-compra",
  "Novo comprador",
  "Comprador VIP",
  "Cliente inativo",
  "Top compradores",
  "Aniversario",
  "Campanhas CRM manuais"
], "implemented automations");
includesAll(page, ["PIX expirado", "Rifa encerrando", "Resultado de sorteio", "Convite de afiliado", "Retry de pagamento falho"], "partial automations");
includesAll(page, ["Novo sorteio", "new_raffle_announcement", "Enviar aviso de novo sorteio"], "new raffle manual safe automation");
includesAll(page, ["{nome}", "{telefone}", "{campanha}", "{valor}", "{pedido}", "{link_pagamento}", "{link_pedido}", "{data_sorteio}", "{nome_empresa}"], "template variables");
includesAll(page, [
  "/api/admin/whatsapp-center/numbers",
  "/api/admin/whatsapp-center/templates",
  "/api/admin/whatsapp-center/automations",
  "/api/admin/whatsapp-cloud/pix-recovery/settings",
  "/api/admin/whatsapp-cloud/pix-recovery/queue",
  "/api/admin/whatsapp-cloud/purchase-confirmation/settings",
  "/api/admin/whatsapp/messages"
], "read endpoints");

const forbiddenRenderCalls = [
  'fetch("/api/admin/whatsapp-center/automations/run"',
  'fetch("/api/admin/whatsapp-center/campaigns/queue/run"',
  'fetch("/api/admin/whatsapp-cloud/pix-recovery/enqueue"',
  'fetch("/api/admin/whatsapp-cloud/pix-recovery/run"',
  'fetch("/api/admin/whatsapp-cloud/purchase-confirmation/test"',
  'fetch("/api/admin/whatsapp/test"'
];
for (const item of forbiddenRenderCalls) assert.ok(!page.includes(item), `render must not dispatch messages: ${item}`);

assert.ok(!page.includes("AdminCRM") && !page.includes("AdminTickets") && !page.includes("AdminSendPulse"), "WhatsApp central must not embed CRM/Tickets/SendPulse modules");
assert.ok(page.includes("informativo nesta fase"), "toggles must remain informative in this phase");
console.log("[whatsapp-center-ui-phase8-1] ok");

