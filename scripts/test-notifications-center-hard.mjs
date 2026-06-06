import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => readFileSync(path.join(root, file), "utf8");

const server = read("server.ts");
const app = read("src/App.tsx");
const bell = read("src/components/notifications/NotificationBell.tsx");
const page = read("src/pages/admin/AdminNotifications.tsx");
const migrationPath = "supabase/migrations/51_notifications_center.sql";
const migration = read(migrationPath);
const packageJson = JSON.parse(read("package.json"));

function mustInclude(source, value, message) {
  assert.ok(source.includes(value), message || `Esperado encontrar: ${value}`);
}

assert.ok(existsSync(path.join(root, migrationPath)), "Migration 51_notifications_center.sql deve existir.");

[
  "type NotificationRecord",
  "function createNotification",
  "dedupe_key",
  "notificationVisibleForSession",
  "publicNotification",
  "sanitizeNotificationActionUrl",
  "notifyTenantAdmins"
].forEach(value => mustInclude(server, value, `Backend deve conter ${value}.`));

[
  'app.get("/api/notifications"',
  'app.get("/api/notifications/unread-count"',
  'app.put("/api/notifications/:id/read"',
  'app.put("/api/notifications/read-all"',
  'app.put("/api/notifications/:id/archive"',
  'app.delete("/api/notifications/:id"'
].forEach(value => mustInclude(server, value, `Endpoint ausente: ${value}`));

mustInclude(server, "notification.tenant_id !== tenantId", "Visibilidade deve isolar tenant.");
mustInclude(server, "notification.user_id && notification.user_id !== session.sub", "Visibilidade deve respeitar userId.");
mustInclude(server, "notification.role_target", "Visibilidade deve respeitar roleTarget.");
mustInclude(server, 'status === "unread"', "Unread count deve considerar notificacoes nao lidas.");
mustInclude(server, 'notification.status = "read"', "Marcar como lida deve atualizar status.");
mustInclude(server, 'notification.status = "archived"', "Arquivar deve atualizar status.");
mustInclude(server, "notifications = notifications.filter", "Delete deve remover somente notificacao visivel.");
mustInclude(server, "maskSecretText", "Notificacoes/logs nao devem expor payload sensivel cru.");
assert.ok(!server.includes("raw_response: notification") && !server.includes("payload: notification"), "Notificacao nao deve expor payload bruto.");

[
  'type: "payment_confirmed"',
  'type: "pix_pending"',
  'type: "pix_expired"',
  'type: "affiliate_withdrawal_requested"',
  'type: "whatsapp_inbound_message"',
  'type: "whatsapp_campaign_completed"',
  'type: "whatsapp_send_failed"',
  'type: "gateway_error"'
].forEach(value => mustInclude(server, value, `Integracao inicial ausente: ${value}`));

mustInclude(server, "processWhatsAppCenterInboundWebhook", "Webhook inbound WhatsApp deve continuar existindo.");
mustInclude(server, "recordPaymentWebhookLog", "Logs de pagamento/gateway devem continuar existindo.");
mustInclude(server, "manuallyConfirmPurchasePayment", "Confirmacao manual de pagamento deve continuar existindo.");
mustInclude(server, "app.post(\"/api/affiliates/:refCode/withdrawals\"", "Solicitacao de saque afiliado deve continuar existindo.");

[
  "create table if not exists public.notifications",
  "tenant_id text not null",
  "user_id text",
  "role_target text",
  "severity text not null",
  "status text not null",
  "action_url text",
  "entity_type text",
  "entity_id text",
  "created_at timestamptz",
  "read_at timestamptz",
  "archived_at timestamptz",
  "idx_notifications_tenant_id",
  "idx_notifications_user_id",
  "idx_notifications_status",
  "idx_notifications_role_target",
  "idx_notifications_created_at",
  "enable row level security",
  "notifications_select_tenant"
].forEach(value => mustInclude(migration, value, `Migration incompleta: ${value}`));

mustInclude(bell, "/api/notifications/unread-count", "Sino deve buscar contador.");
mustInclude(bell, "/api/notifications?status=all", "Sino deve buscar ultimas notificacoes.");
mustInclude(bell, "NotificationBell", "Componente do sino deve existir.");
mustInclude(page, "Marcar todas como lidas", "Pagina deve permitir marcar todas como lidas.");
mustInclude(page, "/api/notifications/read-all", "Pagina deve chamar read-all.");
["Todas", "Nao lidas", "Importantes", "Erros", "Arquivadas"].forEach(label => mustInclude(page, label, `Filtro ausente: ${label}`));
mustInclude(app, 'path="notificacoes"', "Rotas de notificacoes devem existir.");
mustInclude(app, 'roles={["superadmin", "admin", "operador"]}', "Operador deve acessar notificacoes permitidas.");

assert.equal(
  packageJson.scripts["test:notifications-center-hard"],
  "node scripts/test-notifications-center-hard.mjs",
  "Script npm test:notifications-center-hard deve estar registrado."
);

console.log("Notifications center hard checks passed.");
