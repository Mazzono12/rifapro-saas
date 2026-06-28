import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");
const server = read("server.ts");
const api = read("src/services/api.ts");
const resumePage = read("src/pages/CheckoutOrderResume.tsx");
const polling = read("src/hooks/usePurchasePolling.ts");
const raffleDetails = read("src/pages/RaffleDetails.tsx");
const types = read("src/types.ts");
const fazendinha = read("src/pages/Fazendinha.tsx");
const fazendinhaSection = read("src/components/FazendinhaSection.tsx");
const numberMode = read("src/pages/NumberModePage.tsx");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${message}`);
  }
}

function includes(source, needle, message) {
  assert(source.includes(needle), message);
}

includes(server, "function createOrderResumeToken()", "backend cria helper de resumeToken");
includes(server, "randomBytes(32).toString(\"hex\")", "resumeToken usa aleatoriedade forte");
includes(server, "function buildOrderResumeUrl", "backend monta URL segura de retomada");
includes(server, "function hasValidOrderResumeToken", "backend valida token antes de dados sensiveis");
includes(server, "timingSafeEqual", "comparacao do token evita timing leak simples");
includes(server, "code: \"RESUME_TOKEN_REQUIRED\"", "status sem token retorna codigo seguro");
includes(server, "resumeToken,\n      redirectUrl: buildOrderResumeUrl(purchase.purchaseId, resumeToken)", "recuperacao de PIX pendente inclui token e redirectUrl");
includes(server, "resumeToken: createOrderResumeToken()", "criacao de pedidos gera resumeToken");
includes(server, "redirectUrl: buildOrderResumeUrl(purchase.purchaseId, resumeToken)", "compra de rifa retorna redirectUrl com token");
includes(server, "redirectUrl: buildOrderResumeUrl(purchase.id, resumeToken)", "modalidades retornam redirectUrl com token");

const statusRouteIndex = server.indexOf('app.get("/api/checkout/orders/:orderId/status"');
assert(statusRouteIndex >= 0, "endpoint de status do pedido existe");
const statusRoute = server.slice(statusRouteIndex, server.indexOf('app.get("/api/purchases/:purchaseId"', statusRouteIndex));
assert(statusRoute.length > 1000, "recorte do endpoint de status foi localizado");
const guardIndex = statusRoute.indexOf("if (!hasValidOrderResumeToken(req, purchase))");
const refreshIndex = statusRoute.indexOf("await refreshAsaasPixForPendingPurchase");
const pixPayloadIndex = statusRoute.indexOf("pixPayload");
assert(guardIndex >= 0, "status de rifa exige token antes do retorno completo");
assert(refreshIndex > guardIndex, "status nao consulta/recupera PIX antes de validar token");
assert(pixPayloadIndex > guardIndex, "pixPayload de rifa fica depois do gate de token");
assert((statusRoute.match(/hasValidOrderResumeToken\(req,/g) || []).length >= 3, "status protege rifa, modalidade numerica e Fazendinha");
assert((statusRoute.match(/res\.status\(403\)\.json\(buildOrderResumeTokenRequiredResponse/g) || []).length >= 3, "status nega retomada sensivel sem token nas modalidades");
assert(!/RESUME_TOKEN_REQUIRED[\s\S]{0,240}pixPayload/.test(statusRoute), "resposta de token ausente nao inclui copia-e-cola perto do erro");

includes(api, "async checkPixPaymentStatus(orderId: string, resumeToken?: string)", "frontend service aceita resumeToken");
includes(api, "?token=${encodeURIComponent(resumeToken)}", "frontend service envia token no status");
includes(resumePage, "useSearchParams", "pagina de retomada le token da URL");
includes(resumePage, "resumeToken = searchParams.get(\"token\")", "pagina usa token da query string");
includes(resumePage, "status${tokenQuery}", "pagina de retomada consulta status com token");
includes(polling, "resumeToken?: string", "polling aceita token");
includes(polling, "status${tokenQuery}", "polling consulta status com token");
includes(raffleDetails, "function getCheckoutResumeToken", "pagina de rifa extrai resumeToken");
includes(raffleDetails, "usePurchasePolling(purchase?.purchaseId, 7000, getCheckoutResumeToken(purchase))", "rifa passa token ao polling");
includes(raffleDetails, "checkPixPaymentStatus(purchase.purchaseId, getCheckoutResumeToken(purchase))", "rifa confirma status com token");
includes(fazendinha, "checkPixPaymentStatus(pendingPix.purchase.id, pendingPix.resumeToken || pendingPix.purchase.resumeToken)", "Fazendinha consulta status com token");
includes(fazendinhaSection, "checkPixPaymentStatus(pendingPix.purchase.id, pendingPix.resumeToken || pendingPix.purchase.resumeToken)", "secao Fazendinha consulta status com token");
includes(numberMode, "checkPixPaymentStatus(pendingPix.purchase.id, pendingPix.resumeToken || pendingPix.purchase.resumeToken)", "modalidades numericas consultam status com token");
includes(types, "export interface Purchase", "tipo Purchase existe");
includes(types, "resumeToken?: string;", "tipos publicos aceitam resumeToken");

const changedSources = [server, api, resumePage, polling, raffleDetails, fazendinha, fazendinhaSection, numberMode, types];
assert(!changedSources.some((source) => /;`[rn]\\s*const /.test(source)), "nao ha literais de quebra de linha acidentais nos pontos editados");

if (process.exitCode) {
  console.error("\nTeste hard de resumeToken falhou.");
  process.exit(process.exitCode);
}
console.log("\nTeste hard de resumeToken passou.");

