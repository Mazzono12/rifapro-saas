import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const server = read("server.ts");
const app = read("src/App.tsx");
const adminPlan = read("src/pages/admin/AdminMyPlan.tsx");
const superPlan = read("src/pages/superadmin/SuperAdminTenantPlanResources.tsx");
const migration = read("supabase/migrations/25_saas_governance_plans_features.sql");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includesAll(source, terms, label) {
  for (const term of terms) assert(source.includes(term), `${label}: ausente ${term}`);
}

includesAll(server, ["starter", "pro", "premium", "enterprise", "TenantFeatureFlag", "allTenantFeatureFlags"], "planos SaaS");
includesAll(server, ["trial", "active", "suspended", "overdue", "maintenance", "blocked", "canceled"], "status tenant");
includesAll(server, ["crm", "automations", "advanced_affiliates", "wallet", "provably_fair", "reports_pdf", "public_api", "pwa", "custom_theme", "whatsapp_automation", "realtime_social_proof"], "feature flags");
includesAll(server, ["max_campaigns", "max_customers", "max_admin_users", "max_whatsapp_messages_month", "dominio_proprio", "advanced_reports", "public_api"], "limites por plano");
includesAll(server, ["app.get(\"/api/admin/plan\"", "app.get(\"/api/admin/features\"", "app.get(\"/api/superadmin/tenants/:tenantId/plan\"", "app.put(\"/api/superadmin/tenants/:tenantId/plan\"", "app.get(\"/api/superadmin/tenants/:tenantId/features\"", "app.put(\"/api/superadmin/tenants/:tenantId/features\""], "endpoints governanca");
includesAll(server, ["Recurso bloqueado pelo plano atual", "tenantHasFeature", "assertTenantOperationalForCheckout", "Tenant em manutenção", "Tenant suspenso", "Plano ${plan.nome} permite ate ${plan.max_customers}"], "regras governanca");
includesAll(server, ["currentRaffles >= plan.limite_rifas", "tenant.plano = getTenantPlan", "TENANT_PLAN_UPDATED", "TENANT_FEATURES_UPDATED"], "controle superadmin e limite campanha");
includesAll(app, ["AdminMyPlan", "SuperAdminTenantPlanResources", "TenantOperationalGate", "meu-plano", "tenants/:tenantId/plano"], "rotas UI governanca");
includesAll(adminPlan, ["Meu plano", "Bloqueado. Solicite upgrade.", "/api/admin/plan", "/api/admin/features"], "UI admin meu plano");
includesAll(superPlan, ["Plano e Recursos", "tenantStatuses", "/plan", "/features"], "UI superadmin plano recursos");
includesAll(migration, ["saas_plan_definitions", "tenant_feature_flags", "starter", "enterprise", "tenants_operational_status_check"], "migration governanca");

console.log("[saas-governance] ok");
