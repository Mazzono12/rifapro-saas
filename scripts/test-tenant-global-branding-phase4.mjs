import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = path => readFileSync(path, "utf8");

const provider = read("src/context/tenant-branding/TenantBrandingContext.tsx");
const adminAparencia = read("src/pages/admin/AdminAparencia.tsx");
const brandingForm = read("src/components/branding/BrandingSettingsForm.tsx");
const logoUploader = read("src/components/branding/LogoUploader.tsx");
const adminLayout = read("src/pages/admin/AdminLayout.tsx");
const publicBrand = read("src/components/branding/PublicBrandMark.tsx");
const tenantLogo = read("src/components/branding/TenantLogo.tsx");
const authShell = read("src/pages/auth/AuthShell.tsx");
const server = read("server.ts");
const util = read("src/utils/tenantBranding.ts");

function includesAll(source, tokens, label) {
  for (const token of tokens) {
    assert.ok(source.includes(token), `${label}: faltando ${token}`);
  }
}

includesAll(adminAparencia, [
  "/api/admin/branding",
  "/api/admin/branding/reset",
  "logoEndpoint=\"/api/admin/branding/logo\"",
  "faviconEndpoint=\"/api/admin/branding/favicon\"",
  "onUploadComplete={() => void refresh(true)}",
  "Marca do tenant salva"
], "AdminAparencia deve salvar branding oficial do tenant");

includesAll(brandingForm, [
  "Nome no cabeçalho",
  "Logo principal por URL",
  "Enviar logo/GIF",
  "Remover/trocar logo",
  "sanitizeBrandingImageUrl",
  "disabled={logoUrlIsInvalid}"
], "Formulario deve cobrir nome, URL, upload, preview e remocao");

includesAll(logoUploader, [
  "accept=\".png,.jpg,.jpeg,.webp,.svg,.gif,image/png,image/jpeg,image/webp,image/svg+xml,image/gif\"",
  "\"X-File-Name\"",
  "arrayBuffer()"
], "Upload deve reaproveitar fluxo binario existente");

includesAll(provider, [
  "companyName",
  "logoUrl",
  "resolveTenantCompanyName",
  "resolveTenantLogoUrl",
  "sanitizeBrandingImageUrl",
  "fetch(`/api/public/branding${force ? `?t=${Date.now()}` : \"\"}`",
  "cache: force ? \"no-store\" : \"default\""
], "Provider deve centralizar resolucao global e refresh por dominio");

includesAll(adminLayout, [
  "const { companyName, logoUrl } = useTenantBranding()",
  "title={adminBrandTitle || \"Admin\"}",
  "logoUrl={logo}"
], "AdminLayout deve consumir marca centralizada");

includesAll(publicBrand, [
  "companyName",
  "logoUrl",
  "public-brand-logo-fallback",
  "logo-only"
], "Marca publica deve consumir branding centralizado");

includesAll(tenantLogo, [
  "onError={() => setFailed(true)}",
  "Logo RifaPro",
  "logoUrl"
], "TenantLogo deve ter fallback quando imagem falhar");

includesAll(authShell, [
  "companyName",
  "tenantLogoUrl",
  "branding.login_logo_url || tenantLogoUrl",
  "RifaPro"
], "Login deve resolver marca por provider publico");

includesAll(server, [
  "app.get(\"/api/public/branding\"",
  "resolveDomainTenantInfo(req)",
  "app.get(\"/api/admin/branding\"",
  "app.put(\"/api/admin/branding\"",
  "app.post(\"/api/admin/branding/logo\"",
  "resolveRequestTenantId(req)",
  "tenantBrandingSettings[tenantId]",
  "sanitizeBrandingImageUrl",
  "incoming.logo_url ?? incoming.logoUrl",
  "incoming.company_name ?? incoming.companyName"
], "Backend deve manter persistencia tenant-scoped e aliases seguros");

includesAll(util, [
  "javascript|data|vbscript|file|blob",
  "http:",
  "https:",
  "/uploads/",
  "resolveTenantCompanyName",
  "resolveTenantLogoUrl"
], "Utilitario deve bloquear URL perigosa e resolver fallback");

assert.ok(!util.includes("localStorage"), "Branding global nao deve depender de cache local cross-tenant.");
assert.ok(!adminAparencia.includes("/api/settings"), "Aparencia nova nao deve salvar branding no endpoint generico legado.");

console.log("tenant-global-branding-phase4: ok");
