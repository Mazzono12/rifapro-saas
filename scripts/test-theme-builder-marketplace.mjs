import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const read = file => readFileSync(join(root, file), "utf8");

function includesAll(content, expected, label) {
  const missing = expected.filter(item => !content.includes(item));
  if (missing.length) throw new Error(`${label} sem trechos obrigatorios: ${missing.join(", ")}`);
}

const server = read("server.ts");
const migration = read("supabase/migrations/33_tenant_theme_templates.sql");
const adminConfig = read("src/pages/admin/AdminConfig.tsx");
const builder = read("src/components/branding/ThemeBuilder.tsx");
const brandingProvider = read("src/context/tenant-branding/TenantBrandingContext.tsx");

includesAll(migration, [
  "create table if not exists public.tenant_theme_templates",
  "tenant_id uuid references public.tenants(id)",
  "theme_key text not null",
  "settings jsonb not null",
  "active boolean not null",
  "enable row level security",
  "public.can_access_tenant",
  "tenant_theme_templates_one_active_per_tenant_idx",
  "for delete",
  "using (false)"
], "migration tenant_theme_templates");

includesAll(server, [
  "TenantThemeTemplateRecord",
  "premium dark",
  "cassino neon",
  "fazendinha",
  "esportivo",
  "luxo dourado",
  "clean claro",
  "black friday",
  "sanitizeThemeText",
  "sanitizeThemeUrl",
  "buildThemeSettings",
  "ensureTenantThemeTemplate",
  "publicTenantTheme",
  "app.get(\"/api/public/theme-template\""
], "backend templates");

includesAll(server, [
  "app.get(\"/api/admin/theme-builder\"",
  "app.put(\"/api/admin/theme-builder\"",
  "app.post(\"/api/admin/theme-builder/publish\"",
  "TENANT_THEME_TEMPLATE_UPDATED",
  "TENANT_THEME_TEMPLATE_PUBLISHED",
  "app.get(\"/api/superadmin/theme-templates\"",
  "app.post(\"/api/superadmin/theme-templates\"",
  "app.post(\"/api/superadmin/theme-templates/:themeId/apply/:tenantId\"",
  "app.post(\"/api/superadmin/theme-templates/:themeId/duplicate\""
], "endpoints theme builder");

includesAll(builder, [
  "Construtor visual",
  "Tema do marketplace",
  "Hero",
  "Banner",
  "Video",
  "Premio principal",
  "Pacotes de cotas",
  "Prova social",
  "FAQ",
  "Regulamento",
  "Preview",
  "Salvar",
  "Publicar"
], "UI construtor");

includesAll(adminConfig, [
  "ThemeBuilder",
  "/api/admin/theme-builder",
  "/api/admin/theme-builder/publish",
  "Carregando construtor visual"
], "Admin Aparencia Construtor");

includesAll(brandingProvider, ["PublicTenantBranding", "support_whatsapp"], "branding publico preservado");

if (/<script|dangerouslySetInnerHTML|javascript:/i.test(builder)) {
  throw new Error("Builder nao deve permitir HTML/script perigoso no frontend");
}
if (!/replace\(\/\[<>\]\/g/.test(server) || !/\^javascript:/i.test(server)) {
  throw new Error("Backend deve sanitizar textos e bloquear javascript: em URLs");
}

console.log("[theme-builder-marketplace] ok");
