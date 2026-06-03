import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const pkg = readFileSync("package.json", "utf8");

function blockBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Bloco inicial nao encontrado: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Bloco final nao encontrado: ${end}`);
  return source.slice(startIndex, endIndex);
}

function has(source, snippet, label) {
  assert.ok(source.includes(snippet), `${label}: faltando "${snippet}"`);
}

const debugBlock = blockBetween(server, "function registerPublicDebugRoutes()", "app.get(\"/api/public/geo\"");

[
  "const publicDebugEnabled = process.env.ENABLE_PUBLIC_DEBUG === \"true\"",
  "if (!isNodeProduction || publicDebugEnabled) return true",
  "const session = getAuthSession(req)",
  "role === \"admin\" || role === \"superadmin\"",
  "res.status(404).json(publicDebugNotFound)",
  "app.get(\"/api/public/tenant-debug\"",
  "app.get(\"/api/public/raffles-debug\""
].forEach(snippet => has(server, snippet, "Rotas publicas debug devem ser protegidas em producao"));

const tenantRouteIndex = debugBlock.indexOf("app.get(\"/api/public/tenant-debug\"");
const tenantGateIndex = debugBlock.indexOf("if (!canAccessPublicDebug(req))", tenantRouteIndex);
const tenantResponseIndex = debugBlock.indexOf("res.json(await buildPublicTenantDebug(req))", tenantRouteIndex);
const rafflesRouteIndex = debugBlock.indexOf("app.get(\"/api/public/raffles-debug\"");
const rafflesGateIndex = debugBlock.indexOf("if (!canAccessPublicDebug(req))", rafflesRouteIndex);
const rafflesResponseIndex = debugBlock.indexOf("res.json(debug)", rafflesRouteIndex);

assert.ok(tenantGateIndex > tenantRouteIndex && tenantGateIndex < tenantResponseIndex, "tenant-debug deve validar gate antes de responder.");
assert.ok(rafflesGateIndex > rafflesRouteIndex && rafflesGateIndex < rafflesResponseIndex, "raffles-debug deve validar gate antes de responder.");
assert.ok(!debugBlock.includes("settings") && !debugBlock.includes("paymentGateways") && !debugBlock.includes("reports/"), "Debug publico nao deve expor configs internas completas.");
assert.ok(pkg.includes("\"test:no-public-debug-production\""), "package.json deve expor test:no-public-debug-production.");

console.log("PASS: rotas publicas de debug exigem ENABLE_PUBLIC_DEBUG=true ou admin autenticado em producao e retornam 404 por padrao.");
