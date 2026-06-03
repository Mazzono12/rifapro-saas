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

const checkoutBlock = blockBetween(server, "app.post(\"/api/raffles/:id/buy\"", "app.post(\"/api/modalidades/:mode/buy\"");
const attachIndex = checkoutBlock.indexOf("await attachActiveGatewayPixToOrder({");
const catchIndex = checkoutBlock.indexOf("} catch (error)", attachIndex);
const consumeIndex = checkoutBlock.indexOf("if (coupon) coupon.used++");
const pushIndex = checkoutBlock.indexOf("purchases.push(purchase)", attachIndex);

assert.notEqual(attachIndex, -1, "Checkout deve criar PIX pelo gateway ativo.");
assert.notEqual(catchIndex, -1, "Checkout deve capturar falha de criacao PIX.");
assert.notEqual(consumeIndex, -1, "Checkout deve consumir cupom apos PIX.");
assert.notEqual(pushIndex, -1, "Checkout deve persistir pedido apos PIX.");
assert.ok(consumeIndex > catchIndex, "Cupom nao pode ser consumido antes do catch de falha PIX.");
assert.ok(consumeIndex > attachIndex, "Cupom deve ser consumido apenas depois do attachActiveGatewayPixToOrder.");
assert.ok(consumeIndex < pushIndex, "Cupom deve ser consumido uma unica vez no pedido valido antes da persistencia.");

const failureBlock = checkoutBlock.slice(catchIndex, checkoutBlock.indexOf("return;", catchIndex) + "return;".length);
assert.ok(failureBlock.includes("releaseReservedNumbers(raffle, reservedNumbers)"), "Falha PIX deve desfazer reserva principal.");
assert.ok(!failureBlock.includes("coupon.used++"), "Falha PIX nao pode consumir cupom.");
assert.equal((checkoutBlock.match(/coupon\.used\+\+/g) || []).length, 1, "Cupom deve ser consumido uma unica vez no checkout.");
assert.ok(pkg.includes("\"test:coupon-consume-after-pix\""), "package.json deve expor test:coupon-consume-after-pix.");

console.log("PASS: cupom so e consumido depois de PIX criado com sucesso; falha no PIX nao incrementa used.");
