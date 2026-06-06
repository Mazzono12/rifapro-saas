import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => readFileSync(path.join(root, file), "utf8");

const server = read("server.ts");
const app = read("src/App.tsx");
const adminLayout = read("src/pages/admin/AdminLayout.tsx");
const superLayout = read("src/pages/superadmin/SuperAdminLayout.tsx");
const context = read("src/context/tenant-branding/TenantBrandingContext.tsx");
const adminPage = read("src/pages/admin/AdminWhiteLabel.tsx");
const superPage = read("src/pages/superadmin/SuperAdminWhiteLabel.tsx");
const migrationPath = "supabase/migrations/53_white_label_enterprise.sql";
const migration = read(migrationPath);
const pkg = JSON.parse(read("package.json"));

function mustInclude(source, value, message) {
  assert.ok(source.includes(value), message || `Esperado encontrar: ${value}`);
}

assert.ok(existsSync(path.join(root, migrationPath)), "Migration 53_white_label_enterprise.sql deve existir.");

[
  "create table if not exists public.brand_settings",
  "create table if not exists public.tenant_domains",
  "create table if not exists public.tenant_seo_settings",
  "create table if not exists public.tenant_legal_pages",
  "create table if not exists public.tenant_landing_settings",
  "company_name",
  "display_name",
  "login_background_url",
  "custom_css",
  "status in ('pending', 'verified', 'active', 'failed')",
  "ssl_status in ('pending', 'active', 'failed')",
  "enable row level security",
  "tenant_id = coalesce(auth.jwt() ->> 'tenant_id'",
  "auth.jwt() ->> 'role' = 'superadmin'",
  "idx_tenant_domains_domain",
  "tenant_domains_domain_unique"
].forEach(value => mustInclude(migration, value, `Migration incompleta: ${value}`));

[
  "type TenantSeoSettings",
  "type TenantLegalPages",
  "type TenantLandingSettings",
  "tenantSeoSettings",
  "tenantLegalPages",
  "tenantLandingSettings",
  "defaultTenantSeoSettings",
  "normalizeTenantSeoSettings",
  "normalizeTenantLegalPages",
  "normalizeTenantLandingSettings",
  "resolveDomainTenantInfo",
  "tenantDomainMatchesHost",
  "[\"verified\", \"active\"].includes(domain.status)",
  '.in("status", ["verified", "active"])',
  "sanitizeWhiteLabelCustomCss",
  "replace(/@import",
  "replace(/url\\s*\\(",
  "replace(/expression\\s*\\(",
  "replace(/javascript:/gi",
  ".slice(0, 4000)"
].forEach(value => mustInclude(server, value, `Backend White Label ausente: ${value}`));

[
  'app.get("/api/public/white-label"',
  'app.get("/api/admin/white-label"',
  'app.put("/api/admin/white-label/branding"',
  'app.put("/api/admin/white-label/seo"',
  'app.put("/api/admin/white-label/landing"',
  'app.put("/api/admin/white-label/legal"',
  'app.post("/api/admin/white-label/domains"',
  'app.get("/api/superadmin/white-label"',
  'app.post("/api/superadmin/white-label/domains/:id/activate"',
  'app.post("/api/superadmin/white-label/domains/:id/deactivate"',
  'app.post("/api/superadmin/white-label/domains/:id/revalidate"'
].forEach(value => mustInclude(server, value, `Endpoint ausente: ${value}`));

[
  "resolveRequestTenantId(req)",
  "tenantDomains.filter(item => item.tenant_id === tenantId)",
  "getTenantBranding(tenantId)",
  "getTenantSeoSettings(tenantId)",
  "getTenantLandingSettings(tenantId)",
  "getTenantLegalPages(tenantId)"
].forEach(value => mustInclude(server, value, `Isolamento tenant ausente: ${value}`));

[
  "AdminWhiteLabel",
  "SuperAdminWhiteLabel",
  "marca-dominio",
  "white-label",
  "Marca e Domínio",
  "White Label"
].forEach(value => mustInclude(app + adminLayout + superLayout, value, `Rota/menu ausente: ${value}`));

[
  "Identidade Visual",
  "Domínio",
  "SEO",
  "Landing Page",
  "Páginas Legais",
  "/api/admin/white-label/${section}",
  "save(\"branding\")",
  "save(\"seo\")",
  "save(\"landing\")",
  "save(\"legal\")"
].forEach(value => mustInclude(adminPage, ` ${value}`.trim(), `Admin Marca e Domínio incompleto: ${value}`));

[
  "/api/superadmin/white-label",
  "Ativar",
  "Desativar",
  "Revalidar",
  "Domínios ativos",
  "SSL ativo"
].forEach(value => mustInclude(superPage, value, `SuperAdmin White Label incompleto: ${value}`));

[
  "seo?:",
  "landing?:",
  "custom_css",
  "meta[name=\"description\"]",
  "meta[property=\"og:title\"]",
  "twitter:image",
  "data-tenant-custom-css"
].forEach(value => mustInclude(context, value, `SEO runtime/login branding incompleto: ${value}`));

[
  'app.post("/api/raffles/:id/buy"',
  'app.post("/api/webhooks/mercadopago"',
  "recordPlatformCommissionForPaidOrder",
  "creditAffiliateCommission",
  "processWhatsAppCenterInboundWebhook",
  "crmContacts",
  "createNotification"
].forEach(value => mustInclude(server, value, `Fluxo protegido ausente/alterado: ${value}`));

assert.ok(!server.includes('app.put("/api/admin/white-label/tenants/:tenantId'), "Admin nao pode editar outro tenant por parametro.");
assert.equal(pkg.scripts["test:white-label-enterprise-hard"], "node scripts/test-white-label-enterprise-hard.mjs");

console.log("White Label Enterprise hard checks passed.");
