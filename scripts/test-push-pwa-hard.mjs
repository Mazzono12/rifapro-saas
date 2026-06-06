import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => readFileSync(path.join(root, file), "utf8");

const server = read("server.ts");
const app = read("src/App.tsx");
const register = read("src/pwa/registerPwa.ts");
const adminLayout = read("src/pages/admin/AdminLayout.tsx");
const superLayout = read("src/pages/superadmin/SuperAdminLayout.tsx");
const adminPush = read("src/pages/admin/AdminPushNotifications.tsx");
const superPush = read("src/pages/superadmin/SuperAdminPush.tsx");
const manifestPath = "public/manifest.webmanifest";
const serviceWorkerPath = "public/service-worker.js";
const migrationPath = "supabase/migrations/56_push_notifications_pwa.sql";
const manifest = read(manifestPath);
const serviceWorker = read(serviceWorkerPath);
const migration = read(migrationPath);
const pkg = JSON.parse(read("package.json"));

function mustInclude(source, value, message) {
  assert.ok(source.includes(value), message || `Esperado encontrar: ${value}`);
}

assert.ok(existsSync(path.join(root, manifestPath)), "manifest.webmanifest deve existir.");
assert.ok(existsSync(path.join(root, serviceWorkerPath)), "service-worker.js deve existir.");
assert.ok(existsSync(path.join(root, migrationPath)), "Migration 56_push_notifications_pwa.sql deve existir.");

[
  '"name"',
  '"short_name"',
  '"theme_color"',
  '"background_color"',
  '"display": "standalone"',
  '"orientation": "portrait"',
  '"sizes": "192x192"',
  '"sizes": "512x512"'
].forEach(value => mustInclude(manifest, value, `Manifest PWA invalido: ${value}`));

[
  'app.get("/manifest.webmanifest"',
  "publicTenantBranding",
  "theme_color",
  "background_color",
  "display: \"standalone\"",
  "orientation: \"portrait-primary\"",
  "sizes: \"192x192\"",
  "sizes: \"512x512\""
].forEach(value => mustInclude(server, value, `Manifest dinamico por tenant incompleto: ${value}`));

[
  "navigator.serviceWorker.register(\"/service-worker.js\"",
  "subscribeToEnterprisePush",
  "unsubscribeFromEnterprisePush",
  "/api/push/settings",
  "/api/push/subscribe",
  "/api/push/unsubscribe"
].forEach(value => mustInclude(register, value, `Registro PWA/Push incompleto: ${value}`));

[
  "caches.open",
  "OFFLINE_URL",
  "self.addEventListener(\"push\"",
  "showNotification",
  "self.addEventListener(\"notificationclick\"",
  "/api/push/notifications/",
  "clients.openWindow",
  "/^\\/assets\\/.*\\.(?:js|css)$/i"
].forEach(value => mustInclude(serviceWorker, value, `Service worker incompleto: ${value}`));

assert.ok(!serviceWorker.includes('["image", "font", "manifest", "style", "script"]'), "Service worker nao deve cachear JS/CSS em cache-first.");

[
  "create table if not exists public.push_subscriptions",
  "create table if not exists public.push_notifications",
  "create table if not exists public.push_campaigns",
  "create table if not exists public.push_settings",
  "device_type text not null default 'desktop' check (device_type in ('desktop', 'android', 'ios'))",
  "status text not null default 'active' check (status in ('active', 'inactive'))",
  "status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'clicked'))",
  "idx_push_subscriptions_tenant_id",
  "idx_push_subscriptions_customer_id",
  "idx_push_subscriptions_status",
  "idx_push_subscriptions_created_at",
  "idx_push_notifications_tenant_id",
  "idx_push_campaigns_tenant_id",
  "alter table public.push_subscriptions enable row level security",
  "alter table public.push_notifications enable row level security",
  "alter table public.push_campaigns enable row level security",
  "alter table public.push_settings enable row level security",
  "auth.jwt() ->> 'role' = 'superadmin'",
  "tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId')"
].forEach(value => mustInclude(migration, value, `Migration Push/PWA incompleta: ${value}`));

[
  "type PushSubscriptionRecord",
  "type PushSettingsRecord",
  "type PushNotificationRecord",
  "type PushCampaignRecord",
  "let pushSubscriptions",
  "let pushNotifications",
  "let pushCampaigns",
  "pushSettings",
  "getPushSettings",
  "deliverPushNotification",
  "queuePushFromInternalNotification",
  "buildPushStats",
  "resolvePushCampaignCustomerIds",
  "pushAutomaticEventCatalog",
  "whatsapp_push_internal",
  "compra_aprovada",
  "pix_pendente",
  "pix_vencido",
  "resultado_sorteio",
  "ticket_criado",
  "ticket_respondido",
  "ticket_encerrado",
  "campanha_crm",
  "automacao_crm",
  "comissao_afiliado",
  "saque_aprovado",
  "billing_gerado",
  "billing_vencido",
  "pushSubscriptions,",
  "pushNotifications,",
  "pushCampaigns,",
  "pushSettings,"
].forEach(value => mustInclude(server, value, `Backend Push incompleto: ${value}`));

[
  'app.post("/api/push/subscribe"',
  'app.get("/api/push/settings"',
  'app.post("/api/push/unsubscribe"',
  'app.post("/api/push/notifications/:id/click"',
  'app.get("/api/admin/push/subscribers"',
  'app.get("/api/admin/push/logs"',
  'app.get("/api/admin/push/stats"',
  'app.get("/api/admin/push/campaigns"',
  'app.post("/api/admin/push/campaigns"',
  'app.post("/api/admin/push/campaigns/:id/preview"',
  'app.post("/api/admin/push/campaigns/:id/send"',
  'app.get("/api/superadmin/push"',
  'app.get("/api/superadmin/push/dashboard"',
  "function requirePushAdminSession",
  "Acesso administrativo obrigatorio"
].forEach(value => mustInclude(server, value, `Endpoint Push ausente: ${value}`));

[
  "subscription.tenant_id === tenantId",
  "adminCanAccessTenant(req, subscription.tenant_id) && subscription.tenant_id === tenantId",
  "adminCanAccessTenant(req, notification.tenant_id) && notification.tenant_id === tenantId",
  "normalizeAuthRole(getAuthSession(req)?.role) !== \"superadmin\""
].forEach(value => mustInclude(server, value, `Isolamento tenant Push incompleto: ${value}`));

[
  "AdminPushNotifications",
  "/admin/push-notifications",
  "Push Notifications",
  "Configurações",
  "Assinantes",
  "Campanhas Push",
  "Fila",
  "Logs",
  "/api/admin/push/settings",
  "/api/admin/push/subscribers",
  "/api/admin/push/campaigns",
  "compradores",
  "VIP",
  "inativos",
  "afiliados",
  "personalizado"
].forEach(value => mustInclude(adminPush + app + adminLayout, value, `Tela Admin Push incompleta: ${value}`));

[
  "SuperAdminPush",
  "/superadmin/push",
  "SuperAdmin &gt; Push",
  "/api/superadmin/push/dashboard",
  "/api/superadmin/push",
  "Assinantes",
  "Envios",
  "Falhas",
  "Cliques",
  "CTR"
].forEach(value => mustInclude(superPush + app + superLayout, value, `Tela SuperAdmin Push incompleta: ${value}`));

[
  "notifySupportTicketEvent",
  "ticket_respondido",
  "created.author_type === \"agent\" && !created.internal_note",
  "createPushNotification"
].forEach(value => mustInclude(server, value, `Integração Tickets Push ausente: ${value}`));

[
  "WhatsApp → Push → Notificação interna",
  "whatsapp_push_internal"
].forEach(value => mustInclude(adminPush + server + migration, value, `Fallback WhatsApp/Push/Interna incompleto: ${value}`));

[
  'app.post("/api/raffles/:id/buy"',
  "recordPlatformCommissionForPaidOrder",
  "creditAffiliateCommission",
  "getTenantPlatformBillingSettings",
  "createPixPayment",
  "payment_gateway",
  "whatsapp_crm_campaign",
  "whatsapp_crm_automation"
].forEach(value => mustInclude(server, value, `Fluxo protegido deve permanecer presente: ${value}`));

assert.equal(pkg.scripts["test:push-pwa-hard"], "node scripts/test-push-pwa-hard.mjs");

console.log("push-pwa-hard: ok");
