import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

const app = read("src/App.tsx");
const authSession = read("src/lib/authSession.ts");
const affiliates = read("src/pages/Affiliates.tsx");
const server = read("server.ts");
const pkg = read("package.json");

includesAll(authSession, [
  'return "/afiliados";'
], "home por role afiliado");

includesAll(app, [
  'path="/afiliado" element={<Navigate to="/afiliados" replace />}',
  'path="/afiliados" element={<AffiliateAccessRoute />}',
  '<Route path="/admin" element={<ProtectedRoute roles={["superadmin", "admin"]}'
], "rotas afiliado/admin");

const affiliateRouteBlock = app.slice(app.indexOf('path="/afiliados"'), app.indexOf('path="/mensagens"'));
assert(!affiliateRouteBlock.includes('roles={["superadmin", "admin"]}'), "painel de afiliado nao deve exigir perfil admin");

includesAll(affiliates, [
  "Você ainda não possui cadastro de afiliado.",
  "/api/affiliates/${customer.affiliateRefCode}/dashboard",
  "dashboard?.metrics.commissionsPending",
  "dashboard?.metrics.commissionsReleased",
  "dashboard?.metrics.commissionsPaid"
], "tela afiliado");

const ownerBlock = server.slice(server.indexOf("function isAffiliateOwnerRequest"), server.indexOf("function monthWindow"));
includesAll(ownerBlock, [
  "requestOwnsCustomer(req, customer)",
  'normalizeAuthRole(session.role) === "afiliado"',
  "session.tenant_id === affiliate.tenant_id",
  "session.sub === customer.id"
], "controle de dono do afiliado");

const dashboardRouteBlock = server.slice(server.indexOf('app.get("/api/affiliates/:refCode/dashboard"'), server.indexOf('app.get("/api/admin/affiliates/search"'));
includesAll(dashboardRouteBlock, [
  "isAffiliateOwnerRequest(req, affiliate)",
  'res.status(403).json({ error: "Acesso negado para este afiliado" })',
  "buildAffiliateDashboard(req, affiliate)"
], "dashboard afiliado privado");

const updateRouteBlock = server.slice(server.indexOf('app.put("/api/affiliates/:refCode"'), server.indexOf('app.post("/api/affiliates/:refCode/click"'));
includesAll(updateRouteBlock, [
  "isAffiliateOwnerRequest(req, affiliate)",
  'res.status(403).json({ error: "Acesso negado para este afiliado" })',
  "affiliate.pixKey = pixKey"
], "preferencias e saque do afiliado");

const dashboardBuilderBlock = server.slice(server.indexOf("function buildAffiliateDashboard"), server.indexOf("  function manuallyConfirmPurchasePayment"));
for (const field of ["cpf", "phone", "accessPassword"]) {
  assert(!dashboardBuilderBlock.includes(field), `dashboard do afiliado nao deve expor ${field}`);
}

includesAll(server, [
  'app.get("/api/admin/affiliates/search"',
  'app.get("/api/admin/affiliates/withdrawals"',
  'app.post("/api/admin/affiliates/manual"',
  'app.put("/api/admin/affiliates/:refCode/full"'
], "admin afiliados preservado");

assert(pkg.includes('"test:affiliate-access-control"'), "package.json deve expor test:affiliate-access-control");

console.log("affiliate-access-control-hard: ok");
