import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const raffleDetails = readFileSync("src/pages/RaffleDetails.tsx", "utf8");
const revealModal = readFileSync("src/components/NumberRevealModal.tsx", "utf8");
const admin = readFileSync("src/pages/admin/AdminInstantPrizes.tsx", "utf8");

assert.match(server, /\/api\/public\/raffles\/:raffleId\/super-cotas/, "Super Cotas publicas devem existir para conversao.");
assert.match(server, /claimedPurchaseId/, "Super Cota deve vincular pedido ganhador.");
assert.match(server, /claimedCustomerId/, "Super Cota deve vincular cliente ganhador.");
assert.match(server, /claimedAt/, "Super Cota deve registrar data de ganho.");
assert.match(server, /raffleId === .*numeroPremiado ===/s, "Super Cota duplicada por campanha/numero deve ser bloqueada.");
assert.match(server, /purchase\.status !== "paid"/, "Premio nao deve liberar sem compra paga.");
assert.match(server, /prizeBalance \+= prizeBalance/, "Premio de Super Cota deve creditar saldo de premio.");
assert.match(raffleDetails, /data-public-super-cotas="visible"/, "Pagina publica deve listar Super Cotas disponiveis.");
assert.match(raffleDetails, /Super Cota encontrada/, "Toast publico deve usar nomenclatura Super Cota.");
assert.match(revealModal, /SUPER COTA ENCONTRADA!/, "Modal pos-pagamento deve usar Super Cota.");
assert.match(revealModal, /confetti/, "Super Cota paga deve ter celebracao visual.");
assert.match(admin, /Super Cotas/, "Admin deve usar nomenclatura comercial Super Cotas.");

console.log("PASS: contrato hard de Super Cota validado.");
