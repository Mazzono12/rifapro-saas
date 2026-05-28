import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(content, fragments, label) {
  const missing = fragments.filter(fragment => !content.includes(fragment));
  assert(!missing.length, `${label} sem trechos obrigatorios: ${missing.join(", ")}`);
}

function contrastRatio(foreground, background) {
  const parse = color => {
    const hex = color.replace("#", "");
    return [0, 2, 4].map(start => Number.parseInt(hex.slice(start, start + 2), 16) / 255).map(value => (
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    ));
  };
  const [fr, fg, fb] = parse(foreground);
  const [br, bg, bb] = parse(background);
  const l1 = 0.2126 * fr + 0.7152 * fg + 0.0722 * fb;
  const l2 = 0.2126 * br + 0.7152 * bg + 0.0722 * bb;
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const css = read("src/index.css");
const contrastHelper = read("src/lib/contrast.ts");
const brandingProvider = read("src/context/tenant-branding/TenantBrandingContext.tsx");
const brandingPreview = read("src/components/branding/BrandingPreview.tsx");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const raffle = read("src/pages/RaffleDetails.tsx");
const adminDashboard = read("src/pages/admin/AdminDashboard.tsx");
const superadminDashboard = read("src/pages/superadmin/SuperAdminDashboard.tsx");
const adminRaffles = read("src/pages/admin/AdminRaffles.tsx");
const authShell = read("src/pages/auth/AuthShell.tsx");
const packageJson = read("package.json");

assertIncludes(css, [
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--text-inverted",
  "--text-danger",
  "--text-success",
  "--text-warning",
  "--surface-primary",
  "--surface-secondary",
  "--surface-elevated",
  "--border-subtle",
  "--input-bg",
  "--input-text",
  "--input-placeholder"
], "tokens globais de legibilidade");

assertIncludes(css, [
  ".text-primary",
  ".text-secondary",
  ".text-muted",
  ".text-inverted",
  ".surface-primary",
  ".surface-secondary",
  ".surface-elevated",
  ".input-placeholder::placeholder"
], "classes globais de legibilidade");

assertIncludes(css, [
  ".public-shell input",
  ".checkout-screen input",
  ".premium-page input",
  ".admin-shell input",
  "color: var(--input-text) !important",
  "color: var(--input-placeholder) !important",
  "input:disabled",
  "option"
], "campos e formularios legiveis");

assertIncludes(css, [
  ".premium-button",
  "--tenant-cta-text",
  ".premium-button-danger",
  ".premium-button-ghost",
  ".premium-table th",
  ".premium-table td",
  ".recharts-text",
  "[data-sonner-toast]"
], "botoes, tabelas, graficos e feedbacks legiveis");

assertIncludes(contrastHelper, [
  "export function getReadableTextColor",
  "export function getContrastRatio",
  "export function hasReadableContrast",
  "normalizeReadableColor"
], "helper de contraste");

assertIncludes(brandingProvider, [
  "getReadableTextColor",
  "--tenant-primary-text",
  "--tenant-secondary-text",
  "--tenant-cta-text",
  "normalizeReadableColor"
], "branding com contraste automatico");

assertIncludes(brandingPreview, [
  "getReadableTextColor",
  "getContrastRatio",
  "Contraste ajustado automaticamente"
], "preview de branding com aviso de contraste");

assertIncludes(receipt, ["Recibo pre-pagamento", "TenantLogo", "TenantHeaderName", "label=\"Cidade\""], "recibo pre-PIX legivel e com branding");
assertIncludes(raffle, ["Confirmar PIX", "premium-button", "Field label=\"Cidade\"", "Field label=\"WhatsApp\""], "checkout publico legivel");
assertIncludes(authShell, ["text-white", "Acesso seguro"], "autenticacao legivel em tema premium");
assertIncludes(adminDashboard, ["admin-input", "admin-card"], "dashboard admin usa controles legiveis");
assertIncludes(superadminDashboard, ["admin-input", "Novo tenant", "Salvar tenant"], "superadmin cria tenant com campos legiveis");
assertIncludes(adminRaffles, ["glass-card", "Rifas"], "modal/criacao de rifa com campos legiveis");

assert(contrastRatio("#f8fafc", "#050914") >= 12, "texto primario deve ter contraste alto em surface-primary");
assert(contrastRatio("#cbd5e1", "#020617") >= 10, "placeholder deve ser legivel em input escuro");
assert(contrastRatio("#020617", "#34d399") >= 8, "CTA verde deve ter texto escuro legivel");
assert(contrastRatio("#fecdd3", "#7f1d1d") >= 6, "botao perigo deve ser legivel");

assert(packageJson.includes("\"test:ui-contrast-hard\""), "package.json deve registrar test:ui-contrast-hard");

const cssSizeKb = statSync(join(root, "src/index.css")).size / 1024;
assert(cssSizeKb < 95, `CSS global cresceu demais: ${cssSizeKb.toFixed(1)}KB`);

console.log("[ui-contrast-hard] ok");
