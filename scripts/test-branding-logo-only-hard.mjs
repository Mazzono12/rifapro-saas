import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(file, "utf8");

const form = read("src/components/branding/BrandingSettingsForm.tsx");
const server = read("server.ts");
const tenantHeaderName = read("src/components/branding/TenantHeaderName.tsx");
const publicBrandMark = read("src/components/branding/PublicBrandMark.tsx");
const preview = read("src/components/branding/BrandingPreview.tsx");
const brandingContext = read("src/context/tenant-branding/TenantBrandingContext.tsx");
const adminConfig = read("src/pages/admin/AdminConfig.tsx");

function mustInclude(source, snippet, message) {
  assert.ok(source.includes(snippet), `${message}: trecho ausente: ${snippet}`);
}

function mustNotInclude(source, snippet, message) {
  assert.ok(!source.includes(snippet), `${message}: trecho proibido: ${snippet}`);
}

mustInclude(form, "Nome no cabeçalho (opcional)", "Admin Aparencia deve deixar claro que nome e opcional");
mustInclude(form, "Deixe vazio para usar apenas a logo", "Campo deve orientar logo sem nome");
mustInclude(form, "header_name: nextValue", "Apagar nome deve atualizar header_name");
mustInclude(form, "display_name: nextValue", "Apagar nome deve atualizar display_name");
mustInclude(form, "company_name: nextValue", "Apagar nome deve atualizar company_name");
mustInclude(form, "showName: nextValue.trim() ? homeBranding.showName !== false : false", "Nome vazio deve desligar exibicao do nome");
mustInclude(form, "const mergeUploadedBranding = (uploaded: any)", "Upload de logo deve preservar estado local do formulario");
mustInclude(form, "header_name: value.header_name || \"\"", "Upload nao pode restaurar nome antigo");
mustInclude(form, "display_name: value.display_name || \"\"", "Upload nao pode restaurar display antigo");
mustInclude(form, "company_name: value.company_name || \"\"", "Upload nao pode restaurar company antigo");
mustInclude(form, "const nextLogoUrl = uploaded.logo_url || value.logo_url || \"\"", "Upload deve preservar a nova logo retornada pelo servidor");
mustInclude(form, "logo_url: nextLogoUrl", "Merge do upload deve gravar logo_url explicitamente");
mustInclude(form, "const nextFaviconUrl = uploaded.favicon_url || value.favicon_url || \"\"", "Upload de favicon nao pode apagar logo atual");
mustInclude(form, "onUploaded={mergeUploadedBranding}", "Upload deve passar pelo merge seguro");

mustInclude(server, "const hasHeaderName = Object.prototype.hasOwnProperty.call(incoming, \"header_name\")", "Backend deve distinguir campo ausente de campo vazio");
mustInclude(server, "const clearNamesFromHeader = hasHeaderName && !headerName && !hasDisplayName && !hasCompanyName", "Backend deve permitir limpar nomes por header vazio");
mustInclude(server, "hasDisplayName ? incoming.display_name : clearNamesFromHeader ? \"\" : current.display_name", "Backend nao deve recompor display_name quando limpar nome");
mustInclude(server, "hasCompanyName ? incoming.company_name : clearNamesFromHeader ? \"\" : current.company_name", "Backend nao deve recompor company_name quando limpar nome");
mustInclude(server, "logoAlt: next.header_name || \"Logo da marca\"", "Alt da logo nao deve trazer nome antigo quando header vazio");
mustNotInclude(server, "incoming.display_name ?? incoming.header_name ?? current.display_name ?? current.header_name", "Backend nao pode recriar display_name a partir de header antigo");
mustNotInclude(server, "incoming.company_name ?? current.company_name ?? displayName", "Backend nao pode recriar company_name a partir de display fallback");

mustInclude(tenantHeaderName, "if (!name) return null;", "TenantHeaderName deve renderizar nada quando nao ha nome real");
mustNotInclude(tenantHeaderName, "branding.header_name || \"CIFHER Prime\"", "TenantHeaderName nao pode ressuscitar nome padrao");
mustInclude(publicBrandMark, "const shouldShowName = showName && branding.home_branding?.showName !== false && Boolean(name);", "Marca publica deve esconder nome quando showName=false ou nome vazio");
mustInclude(preview, "const showName = branding.home_branding?.showName !== false && Boolean(brandName);", "Preview deve refletir nome oculto");
mustInclude(brandingContext, "showName: homeBranding.showName !== false", "Provider deve preservar showName false");
mustInclude(brandingContext, "refresh: (force?: boolean) => Promise<void>;", "Provider deve permitir refresh forçado apos salvar no admin");
mustInclude(brandingContext, "const refresh = async (force = false)", "Refresh deve aceitar bypass de cache");
mustInclude(brandingContext, "if (!force && cached && cached.expiresAt > Date.now())", "Refresh forçado nao pode usar cache antigo");
mustInclude(adminConfig, "await refreshTenantBranding(true);", "Admin deve forçar atualização global da marca depois de salvar/resetar");

console.log("PASS: branding logo-only preserva nome vazio, nao restaura fallback e upload nao reativa nome.");
