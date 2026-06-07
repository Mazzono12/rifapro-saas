import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raffleDetails = readFileSync("src/pages/RaffleDetails.tsx", "utf8");
const numberMode = readFileSync("src/pages/NumberModePage.tsx", "utf8");
const fazendinha = readFileSync("src/pages/Fazendinha.tsx", "utf8");
const server = readFileSync("server.ts", "utf8");

assert.match(raffleDetails, /data-random-raffle-checkout="quantity-only"/, "Rifa tradicional deve continuar compra por quantidade.");
assert.match(raffleDetails, /Seus números serão gerados automaticamente após a confirmação do pagamento/, "Rifa tradicional nao deve prometer selecao manual.");
assert.doesNotMatch(raffleDetails, /Escolha seus números/, "Rifa tradicional nao deve exibir grid manual.");
assert.match(numberMode, /selectedNumbers|numbers/, "Dezena/Centena/Milhar devem manter selecao manual propria.");
assert.match(fazendinha, /selectedGroups|grupoIds|bichinho|bichinhos/i, "Fazendinha deve manter selecao de grupo/bicho.");
assert.match(server, /getNumberModeReservationTtlMs/, "Modalidades devem usar reserva propria.");
assert.match(server, /getFazendinhaReservationTtlMs/, "Fazendinha deve usar reserva propria.");
assert.match(server, /instantPrizes/, "Super Cota deve se integrar ao fluxo de rifa tradicional.");

console.log("PASS: gamificacao cross-modes preserva regras por modalidade.");
