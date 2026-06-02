import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const premium = read("src/components/premium/PremiumUI.tsx");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const raffle = read("src/pages/RaffleDetails.tsx");
const numberMode = read("src/pages/NumberModePage.tsx");
const fazendinha = read("src/pages/Fazendinha.tsx");
const fazendinhaSection = read("src/components/FazendinhaSection.tsx");

assert.ok(premium.includes("CheckoutModalHeader"), "Checkout deve continuar usando header compartilhado.");
assert.ok(premium.includes("CheckoutModalShell"), "Checkout deve continuar usando shell compartilhado.");
assert.equal(premium.includes("checkout-modal-close"), false, "Checkout publico nao deve renderizar botao X superior.");
assert.equal(premium.includes("aria-label=\"Fechar checkout\""), false, "Checkout publico nao deve expor X superior de fechar.");
assert.equal(/<X[\s/>]/.test(premium), false, "Checkout publico nao deve renderizar icone X no header.");

for (const [label, source] of [
  ["recibo pre-PIX", receipt],
  ["rifa tradicional", raffle],
  ["modalidades", numberMode],
  ["fazendinha pagina", fazendinha],
  ["fazendinha home", fazendinhaSection]
]) {
  assert.ok(source.includes("PrePaymentReceiptModal") || source.includes("CheckoutModalShell"), `${label}: checkout principal deve continuar presente.`);
}

assert.ok(receipt.includes("Alterar Dados"), "Recibo deve manter acao de alterar dados.");
assert.ok(receipt.includes("Concluir Compra"), "Recibo deve manter acao principal de concluir compra.");
assert.ok(premium.includes("Copiar PIX"), "PIX deve manter acao principal de copiar.");

console.log("PASS: Checkout publico sem X superior e com acoes principais preservadas.");
