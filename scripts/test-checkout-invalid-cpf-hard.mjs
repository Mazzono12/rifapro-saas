import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");
const raffle = readFileSync("src/pages/RaffleDetails.tsx", "utf8");
const cpf = readFileSync("src/utils/cpf.ts", "utf8");
const buyRouteStart = server.indexOf('app.post("/api/raffles/:id/buy"');
const buyRouteEnd = server.indexOf('app.post("/api/modalidades/:mode/buy"', buyRouteStart);
assert.ok(buyRouteStart >= 0 && buyRouteEnd > buyRouteStart, "Rota /api/raffles/:id/buy deve existir para auditoria.");
const buyRoute = server.slice(buyRouteStart, buyRouteEnd);

function includes(text, needle, message) {
  assert.ok(text.includes(needle), message);
}

function before(text, first, second, message) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  assert.ok(firstIndex >= 0, `${message}: trecho inicial ausente (${first})`);
  assert.ok(secondIndex >= 0, `${message}: trecho final ausente (${second})`);
  assert.ok(firstIndex < secondIndex, message);
}

includes(cpf, 'INVALID_CPF_MESSAGE = "CPF inválido. Verifique os números digitados e tente novamente."', "Mensagem de CPF inválido deve ser padronizada.");
includes(cpf, "export function normalizeCpf", "Validador deve normalizar CPF.");
includes(cpf, "export function isValidCpf", "Validador deve existir.");
includes(cpf, "/^(\\d)\\1{10}$/.test(cpf)", "Validador deve rejeitar CPFs repetidos.");
includes(cpf, "calcDigit(9)", "Validador deve conferir o primeiro dígito verificador.");
includes(cpf, "calcDigit(10)", "Validador deve conferir o segundo dígito verificador.");
includes(cpf, 'code: "INVALID_CPF"', "Resposta da API deve conter code INVALID_CPF.");
includes(cpf, 'field: "cpf"', "Resposta da API deve apontar o campo cpf.");

includes(server, 'from "./src/utils/cpf"', "Backend deve importar utilitário de CPF.");
includes(buyRoute, "const checkoutCpf = normalizeCpf(req.body.customer?.cpf || \"\")", "Endpoint de compra deve normalizar CPF antes do checkout.");
includes(buyRoute, "res.status(400).json(invalidCpfApiResponse())", "Backend deve retornar resposta INVALID_CPF.");
before(buyRoute, "const checkoutCpf = normalizeCpf(req.body.customer?.cpf || \"\")", "customer = findOrCreateCustomer", "CPF inválido deve ser bloqueado antes de criar cliente.");
before(buyRoute, "const checkoutCpf = normalizeCpf(req.body.customer?.cpf || \"\")", "attachActiveGatewayPixToOrder", "CPF inválido deve ser bloqueado antes de chamar gateway/Asaas.");
includes(server, "if (!cpf || !isValidCpf(cpf)) throw new Error(INVALID_CPF_MESSAGE)", "findOrCreateCustomer também deve validar CPF.");
includes(server, "isInvalidCpfGatewayError(error)", "Erro de CPF retornado pelo gateway deve ser normalizado.");
includes(server, 'eventStatus: "INVALID_CPF"', "Erro de CPF do gateway deve registrar log padronizado.");

const gatewayCpfIndex = server.indexOf("if (isInvalidCpfGatewayError(error))");
const releaseIndex = server.lastIndexOf("releaseReservedNumbers(raffle, reservedNumbers)", gatewayCpfIndex);
assert.ok(releaseIndex >= 0 && releaseIndex < gatewayCpfIndex, "Reservas devem ser liberadas antes de responder erro CPF no catch do gateway.");

includes(raffle, 'import { getCpfValidationError, INVALID_CPF_MESSAGE } from "../utils/cpf"', "Frontend deve importar validação de CPF.");
includes(raffle, "const [cpfError, setCpfError] = useState(\"\")", "Frontend deve manter erro inline de CPF.");
includes(raffle, "const cpfMessage = getCpfValidationError", "Frontend deve validar CPF antes de chamar checkout.");
includes(raffle, '(data as any)?.code === "INVALID_CPF"', "Frontend deve interpretar resposta INVALID_CPF.");
includes(raffle, 'setCheckoutStep("review")', "Frontend deve voltar para revisão quando CPF inválido vier da API.");
includes(raffle, "error={props.cpfError}", "Campo CPF deve receber erro inline.");
includes(raffle, "aria-invalid={Boolean(error)}", "Input deve sinalizar estado inválido.");
includes(raffle, "props.setCpfError(\"\")", "Ao alterar CPF, erro deve ser limpo.");
before(raffle, "if (!raffle || !validateCheckoutForm(resolvedCustomer)) return;", "fetch(`/api/raffles/${id}/buy`", "Frontend deve validar CPF antes de chamar endpoint de compra.");

console.log("checkout-invalid-cpf-hard ok");
