import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const read = file => readFileSync(file, "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includesAll = (source, needles, label) => {
  for (const needle of needles) {
    assert(source.includes(needle), `${label}: faltando ${needle}`);
  }
};
const excludesAll = (source, needles, label) => {
  for (const needle of needles) {
    assert(!source.includes(needle), `${label}: nao deve conter ${needle}`);
  }
};
const blockBetween = (source, start, end) => {
  const startIndex = source.indexOf(start);
  assert(startIndex >= 0, `bloco nao encontrado: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert(endIndex > startIndex, `fim de bloco nao encontrado: ${end}`);
  return source.slice(startIndex, endIndex);
};

const raffleDetails = read("src/pages/RaffleDetails.tsx");
const numberModePage = read("src/pages/NumberModePage.tsx");
const fazendinha = read("src/pages/Fazendinha.tsx");
const server = read("server.ts");
const pkg = JSON.parse(read("package.json"));
const css = read("src/index.css");

includesAll(raffleDetails, [
  "data-random-raffle-checkout=\"quantity-only\"",
  "Escolha a quantidade",
  "Seus números serão gerados automaticamente após a confirmação do pagamento.",
  "rdp-quick-amounts",
  "rdp-quantity-control",
  "type=\"number\"",
  "max={maxQuantity}",
  "Math.max(1, Math.floor(remaining || 1))",
  "Math.min(remaining",
  "tickets,",
  "onConfirm={executeBuy}"
], "rifa tradicional por quantidade");

excludesAll(raffleDetails, [
  "rdp-number-grid",
  "rdp-selected-strip",
  "Números selecionados",
  "Escolha seus números",
  "selectedNumbers",
  "buildSelectedNumbers",
  "Array.from({ length: 10000000",
  "Array.from({ length: totalTickets",
  "numbers: selected",
  "selectedNumbers:"
], "rifa tradicional nao escolhe numeros");

includesAll(css, [
  ".rdp-quantity-card",
  ".rdp-quick-amounts",
  ".rdp-quantity-control",
  ".rdp-quantity-stats"
], "css do seletor de quantidade");
excludesAll(css, [".rdp-number-grid", ".rdp-selected-strip"], "css sem grid tradicional");

const raffleBuyBlock = blockBetween(server, 'app.post("/api/raffles/:id/buy"', 'app.post("/api/modalidades/:mode/buy"');
includesAll(raffleBuyBlock, [
  "const tickets = normalizeTickets(req.body.tickets)",
  "reserveAvailableNumbers(raffle, effectiveTickets)",
  "reservedNumbers",
  "numeros: reservedNumbers",
  "attachActiveGatewayPixToOrder",
  "reservedUntil"
], "backend rifa tradicional reserva por quantidade");
excludesAll(raffleBuyBlock, [
  "req.body.numbers",
  "req.body.selectedNumbers",
  "selectedNumbers",
  "parseTicketNumbers"
], "backend rifa tradicional ignora numeros manuais");

const assignBlock = blockBetween(server, "function assignAvailableNumbers", "function reserveAvailableNumbers");
includesAll(assignBlock, [
  "const randNum = randomInt(1, raffle.totalTickets + 1)",
  "const density = raffle.soldTickets / raffle.totalTickets",
  "if (density < 0.75)"
], "geracao aleatoria escalavel");
assert(!assignBlock.includes("Array.from({ length: raffle.totalTickets"), "geracao aleatoria nao deve criar array gigante na rota normal");

includesAll(numberModePage, [
  "const [selected, setSelected]",
  "visibleNumbers",
  "toggleNumber",
  "numbers: selected",
  "modalidadesService.buyMode(mode, selected",
  "Selecione ao menos um número",
  "modeTitles",
  "dezena",
  "centena",
  "milhar"
], "modalidades preservam escolha manual");

includesAll(fazendinha, [
  "Fazendinha",
  "selectedGroups",
  "fazendinhaService.buy",
  "hidden={checkoutOpen || receiptOpen}"
], "fazendinha preservada");

const diff = (() => {
  try {
    return execSync("git diff --name-only", { encoding: "utf8" });
  } catch {
    return "";
  }
})();
const changed = diff.split(/\r?\n/).filter(Boolean).map(file => file.replace(/\\/g, "/"));
const forbiddenChanged = changed.filter(file => (
  file.startsWith("src/components/checkout/PrePaymentReceiptModal") ||
  file.startsWith("src/components/PixPaymentResultModal") ||
  file.startsWith("src/services/api") ||
  file.startsWith("src/integrations/") ||
  file.startsWith("supabase/") ||
  /payment-gateway|webhook|whatsapp|crm|affiliate/i.test(file)
));
assert(forbiddenChanged.length === 0, `Arquivos sensiveis alterados indevidamente: ${forbiddenChanged.join(", ")}`);
assert(pkg.scripts["test:random-raffle-vs-number-modes-hard"] === "node scripts/test-random-raffle-vs-number-modes-hard.mjs", "script npm ausente");

console.log("PASS: rifa tradicional aleatoria separada de modalidades com escolha manual, sem alterar PIX/gateways/webhooks.");
