import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function includes(source, needle, message) {
  assert.ok(source.includes(needle), `${message}\nEsperado encontrar: ${needle}`);
}

function excludes(source, needle, message) {
  assert.ok(!source.includes(needle), `${message}\nNao deveria conter: ${needle}`);
}

const app = read("src/App.tsx");
const adminLayout = read("src/pages/admin/AdminLayout.tsx");
const adminConfig = read("src/pages/admin/AdminConfig.tsx");
const brandingForm = read("src/components/branding/BrandingSettingsForm.tsx");
const brandingContext = read("src/context/tenant-branding/TenantBrandingContext.tsx");
const home = read("src/pages/Home.tsx");
const server = read("server.ts");

includes(app, 'path="marca-dominio" element={<Navigate to="/admin/config" replace />}', "Rota antiga Marca e Dominio deve redirecionar para Configuracoes.");
includes(app, 'path="config/aparencia" element={<Navigate to="/admin/config" replace />}', "Rota antiga Aparencia deve redirecionar para Configuracoes.");
includes(app, 'path="aparencia" element={<Navigate to="/superadmin/white-label" replace />}', "Aparencia global do superadmin nao deve ficar como formulario duplicado.");
includes(app, 'path="tenants/:tenantId/aparencia" element={<Navigate to="/superadmin/clientes" replace />}', "Aparencia por tenant do superadmin nao deve ficar como formulario duplicado.");

excludes(adminLayout, 'name: "Marca e Domínio"', "Menu admin nao deve expor Marca e Dominio como formulario visual concorrente.");
excludes(adminLayout, 'name: "Aparência"', "Menu admin nao deve expor Aparencia como formulario visual concorrente.");
includes(adminLayout, 'name: "Configurações"', "Menu admin deve manter Configuracoes como local oficial.");

includes(adminConfig, "Identidade visual e aparência", "Configuracoes deve exibir bloco oficial de identidade visual.");
includes(adminConfig, "<BrandingSettingsForm", "Configuracoes deve usar o formulario oficial de branding.");
includes(adminConfig, 'logoEndpoint="/api/admin/branding/logo"', "Upload de logo deve salvar no endpoint oficial de branding.");
excludes(adminConfig, 'label="Logo da empresa"', "Configuracoes nao deve manter campo legado settings.branding.logoUrl.");
excludes(adminConfig, "settings.branding?.logoUrl", "Configuracoes nao deve editar logo pelo settings legado.");

excludes(brandingForm, "Logo Centralizada", "Formulario oficial nao deve oferecer modo centralizado.");
includes(brandingForm, 'logoPosition: "left"', "Formulario oficial deve manter logo lateral.");
includes(brandingContext, 'logoPosition?: "left"', "Branding publico deve tipar apenas logo lateral.");
excludes(brandingContext, 'logoPosition?: "center" | "left"', "Branding publico nao deve anunciar logo centralizada.");
includes(home, 'data-logo-position="left"', "Home deve usar marca lateral fixa.");

includes(server, "const officialBranding = getTenantBranding(tenantId);", "Settings deve consultar branding oficial.");
excludes(server, "branding: { ...currentSettings.branding, ...(req.body.branding || {}) }", "Settings geral nao pode aceitar branding concorrente do payload.");
includes(server, "companyName: officialBranding.header_name", "Settings legado deve ser sincronizado a partir do branding oficial.");
includes(server, "logoUrl: officialBranding.logo_url", "Settings legado deve usar logo oficial.");

[
  "src/pages/admin/AdminPaymentGateways.tsx",
  "src/pages/CheckoutOrderResume.tsx",
  "src/components/premium/PremiumUI.tsx"
].forEach(path => {
  assert.ok(fs.existsSync(path), `Arquivo de pagamento/checkout esperado ausente: ${path}`);
});

console.log("PASS: identidade visual centralizada em Configuracoes e salvamento concorrente bloqueado.");
