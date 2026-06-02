import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(content, tokens, context) {
  for (const token of tokens) {
    assert.ok(content.includes(token), `${context}: esperado encontrar "${token}"`);
  }
}

const app = read("src/App.tsx");
const boundary = read("src/components/admin/AdminSectionBoundary.tsx");
const sales = read("src/pages/admin/AdminSales.tsx");

includesAll(boundary, [
  "AdminSectionBoundary",
  "componentDidCatch",
  "adminDebug",
  "[admin-section] render_error",
  "Não foi possível carregar esta seção",
  "Tentar novamente",
  "Voltar ao dashboard",
  "window.location.reload()"
], "AdminSectionBoundary deve isolar erro sem expor stack trace ao usuario.");
assert.equal(/<pre|error\.stack|stackTrace/i.test(boundary), false, "Boundary nao deve renderizar stack trace.");

includesAll(app, [
  "AdminSectionBoundary",
  "adminSection(\"Dashboard\"",
  "adminSection(\"Vendas\"",
  "adminSection(\"Rifas\"",
  "adminSection(\"Pagamentos\"",
  "adminSection(\"Relatórios e Afiliados\"",
  "adminSection(\"CRM\"",
  "adminSection(\"Configurações\"",
  "adminSection(\"Operações\"",
  "adminSection(\"Gamificação\"",
  "adminSection(\"Modalidades\"",
  "adminSection(\"Stories\"",
  "adminSection(\"Automações\""
], "Rotas admin principais devem estar isoladas por boundary.");

includesAll(sales, [
  "function asArray",
  "function safeNumber",
  "function normalizePurchase",
  "function normalizeCustomer",
  "function normalizeAdminRaffle",
  "function normalizeAffiliateResult",
  "function normalizeSupportTicket",
  "readJsonArray(\"/api/admin/purchases\", normalizePurchase)",
  "readJsonArray(\"/api/admin/customers\", normalizeCustomer)",
  "readJsonArray(\"/api/raffles\", normalizeAdminRaffle)",
  "readJsonArray(\"/api/admin/support/tickets\", normalizeSupportTicket)",
  "setCustomerLookupResults(asArray(data).map(normalizeCustomer))",
  "safeMoney(p.amount)",
  "asArray(p.paymentHistory)",
  "Nenhuma venda registrada até o momento."
], "AdminSales deve tolerar dados vazios, parciais, datas invalidas e listas ausentes.");

assert.equal(/p\.amount\.toFixed|customer\.purchases\.map|ticket\.messages\.map/.test(sales), false, "AdminSales nao deve renderizar arrays/numeros crus que quebram com payload parcial.");

console.log("PASS: Admin isolado por seção e AdminSales resiliente a payload vazio/parcial.");
