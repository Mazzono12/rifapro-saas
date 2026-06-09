import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const details = readFileSync("src/pages/RaffleDetails.tsx", "utf8");

assert.match(server, /available: prizes[\s\S]*status === "available"/, "Publico deve ver somente Super Cotas disponiveis.");
assert.match(server, /maskDisplayName/, "Ganhadores publicos devem ser mascarados.");
assert.match(server, /purchase\.status === "paid"/, "Ganhador publico de Super Cota deve depender de pedido pago.");
assert.doesNotMatch(server, /available:[\s\S]{0,300}claimedCustomerId/, "Lista publica de disponiveis nao deve expor cliente.");
assert.match(details, /pr[eê]mio s[oó] libera ap[oó]s pagamento confirmado/i, "UI publica deve informar liberacao apenas apos pagamento.");
assert.match(details, /NumberRevealModal/, "Premios efetivos devem aparecer no modal pos-pagamento.");

console.log("PASS: Super Cota nao vaza recompensa antes do pagamento.");
