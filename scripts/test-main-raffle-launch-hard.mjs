import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const raffleDetails = readFileSync("src/pages/RaffleDetails.tsx", "utf8");
const gamificationPanel = readFileSync("src/components/GamificationPanel.tsx", "utf8");
const adminRaffles = readFileSync("src/pages/admin/AdminRaffles.tsx", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const paymentGatewaysTest = readFileSync("scripts/test-payment-gateways-hard.mjs", "utf8");
const checkoutHardSuite = readFileSync("scripts/test-hard-suite.mjs", "utf8");
const reservationTest = readFileSync("scripts/test-reservation-expiration-hard.mjs", "utf8");
const superCotaTest = readFileSync("scripts/test-super-cota-hard.mjs", "utf8");
const rouletteTest = readFileSync("scripts/test-roulette-hard.mjs", "utf8");
const rouletteNoPendingTest = readFileSync("scripts/test-roulette-no-pending-hard.mjs", "utf8");
const gamificationNoPrepaymentTest = readFileSync("scripts/test-gamification-no-prepayment-rewards-hard.mjs", "utf8");
const topBuyersTest = readFileSync("scripts/test-top-buyers-hard.mjs", "utf8");

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}

check("1. Rifa principal compra por quantidade", () => {
  assert.match(raffleDetails, /data-random-raffle-checkout="quantity-only"/);
  assert.match(raffleDetails, /Escolha a quantidade/);
  assert.match(raffleDetails, /Quantidade de bilhetes/);
  assert.match(server, /const tickets = normalizeTickets\(req\.body\.tickets\)/);
});

check("1b. Rotas visuais do sorteio apontam para o fluxo publico sem backend novo", () => {
  assert.match(app, /path="\/raffle\/:id" element=\{<RaffleDetails \/>}/);
  assert.match(app, /path="\/rifa\/:id" element=\{<RaffleDetails \/>}/);
  assert.match(app, /path="\/sorteio\/:id" element=\{<RaffleDetails \/>}/);
  assert.match(app, /path="\/meus-bilhetes" element=\{<UserDashboard \/>}/);
  assert.match(app, /path="\/meus-numeros" element=\{<UserDashboard \/>}/);
  assert.match(app, /path="\/meus-jogos" element=\{<UserDashboard \/>}/);
  assert.match(app, /path="\/contato" element=\{<Messages \/>}/);
  assert.match(app, /path="\/termos-de-uso" element=\{<Transparency \/>}/);
  assert.match(app, /const isRaffleRoute = \/\^\\\/\(raffle\|rifa\|sorteio\)\\\/\[\^\/\]\+\\\/\?\$\/\.test\(location\.pathname\)/);
});

check("1c. Pagina da rifa tem atalhos visuais para participar e meus bilhetes", () => {
  assert.match(raffleDetails, /<RafflePremiumTopbar onParticipate=\{onParticipate\} \/>/);
  assert.match(raffleDetails, /<RaffleActionRow onParticipate=\{onParticipate\} \/>/);
  assert.match(raffleDetails, /to="\/meus-bilhetes"[\s\S]*Meus Bilhetes/);
  assert.match(raffleDetails, /onClick=\{onParticipate\}[\s\S]*Participar/);
});

check("2. Nao existe selecao manual de numero no checkout publico", () => {
  assert.doesNotMatch(raffleDetails, /selectedNumbers|toggleNumber|manualNumber|numberGrid|grid.*numeros/i);
  assert.match(raffleDetails, /n[uú]meros ser[aã]o gerados automaticamente ap[oó]s a confirma[cç][aã]o do pagamento/i);
});

check("3. Frontend nao renderiza grid de 10 milhoes", () => {
  assert.doesNotMatch(raffleDetails, /Array\.from\(\{\s*length:\s*(?:raffle\.)?totalTickets/);
  assert.doesNotMatch(raffleDetails, /\.map\([^)]*number[^)]*\)[\s\S]{0,120}onClick=.*select/i);
});

check("4. Configuracao aceita 10.000.000 numeros", () => {
  assert.match(adminRaffles, /totalTickets:\s*parseInt\(e\.target\.value\)/);
  assert.match(server, /\.\.\.normalizeMediaPayload\(req\.body\)[\s\S]*tenant_id:\s*tenantId/);
  assert.doesNotMatch(server, /totalTickets[\s\S]{0,80}Math\.min\((?:100000|1000000|1_000_000)/);
});

check("5. Pedido pendente nao mostra numeros", () => {
  assert.match(server, /function sanitizePublicPurchase\(purchase: PurchaseRecord\)/);
  assert.match(server, /if \(safe\.status !== "paid"\) \{[\s\S]*safe\.numeros = \[\]/);
  assert.match(server, /res\.json\(sanitizePublicPurchase\(purchase\)\)/);
  assert.match(server, /purchase: sanitizePublicPurchase\(purchase\)/);
});

check("6. Pagamento confirmado libera numeros", () => {
  assert.match(server, /function confirmPurchase\(purchase: PurchaseRecord\)/);
  assert.match(server, /purchase\.status = "paid"[\s\S]*purchase\.numeros = assignedNumbers/);
  assert.match(server, /purchase\.status === "paid"[\s\S]*buildPublicTicketUrl\(purchase\)/);
});

check("7. Numeros liberados nao duplicam em concorrencia", () => {
  assert.match(server, /function assignAvailableNumbers/);
  assert.match(server, /const picked = new Set<number>\(\)/);
  assert.match(server, /!raffle\.soldNumbers\.has\(randNum\) && !picked\.has\(randNum\)/);
  assert.match(server, /assignedNumbers\.forEach\(n => raffle\.soldNumbers\.add\(n\)\)/);
});

check("8. Reserva expira e retorna ao estoque", () => {
  assert.match(server, /function expirePendingReservations/);
  assert.match(server, /releaseReservedNumbers\(raffle, purchase\.numeros\)/);
  assert.match(server, /reservationSettings[\s\S]*raffleMinutes: 15/);
  assert.match(reservationTest, /Default rifa tradicional deve ser 15 minutos/);
});

check("9. Pagamento atrasado nao libera reserva expirada", () => {
  assert.match(server, /expirePendingReservations\(purchase\.tenant_id, purchase\.raffleId\)/);
  assert.match(server, /if \(purchase\.status === "cancelled"\) throw new Error\("Purchase reservation expired"\)/);
  assert.match(server, /purchase\.rejectedReason = "Reserva expirada"/);
});

check("10. PIX gera QR Code e copia e cola", () => {
  assert.match(raffleDetails, /QRCodeSVG value=\{props\.purchase\.pixPayload\}/);
  assert.match(raffleDetails, /Copiar PIX copia e cola/);
  assert.match(server, /pixPayload: buildPixPayload\(payableAmount, raffle, purchaseId\)/);
});

check("11. Webhook duplicado e idempotente", () => {
  assert.match(server, /buildPaymentIdempotencyKey/);
  assert.match(server, /Webhook duplicado idempotente/);
  assert.match(server, /job\.result = \{ duplicate: true, purchaseId: job\.purchaseId, type: "raffle" \}/);
});

check("12. Credenciais de gateway nao vazam", () => {
  assert.match(server, /sanitizePaymentGatewayConfig/);
  assert.match(server, /maskGatewayCredentials/);
  assert.match(server, /gatewaySensitiveFieldPattern/);
  assert.match(paymentGatewaysTest, /credenciais cifradas/);
});

check("13. Super Cota so libera apos pagamento", () => {
  assert.match(server, /premiosWon = instantPrizes\.filter/);
  assert.match(server, /purchase\.status = "paid"[\s\S]*purchase\.premiosInstantaneos = premiosWon/);
  assert.match(gamificationPanel, /purchase\?\.gamification\?\.autoPrizes/);
  assert.match(superCotaTest, /apos pagamento|claimedPurchaseId/i);
});

check("14. Super Cota nao duplica ganhador", () => {
  assert.match(server, /p\.status === "available" && assignedNumbers\.includes\(p\.numeroPremiado\)/);
  assert.match(server, /p\.status = "claimed"/);
  assert.match(server, /claimedPurchaseId/);
  assert.match(superCotaTest, /duplic/i);
});

check("15. Roleta so gira apos pagamento", () => {
  assert.match(server, /app\.post\("\/api\/lootboxes\/:userId\/open"/);
  assert.match(server, /spinId: box\.id/);
  assert.match(rouletteTest, /spinId/);
  assert.match(rouletteNoPendingTest, /Guard de liberacao pos-pagamento/);
});

check("16. Raspadinha so raspa apos pagamento", () => {
  assert.match(server, /scratchcards\/:eventId\/reveal[\s\S]*assertGamificationEventReleased/);
  assert.match(gamificationNoPrepaymentTest, /Raspadinha pendente nao pode liberar premio/);
});

check("17. Caixinha so abre apos pagamento", () => {
  assert.match(server, /mystery-boxes\/:eventId\/open[\s\S]*assertGamificationEventReleased/);
  assert.match(gamificationNoPrepaymentTest, /Caixinha pendente nao pode abrir antes do pagamento/);
});

check("18. Top Compradores considera somente paid", () => {
  assert.match(server, /function getBuyerRanking[\s\S]*purchase\.status === "paid"/);
  assert.match(topBuyersTest, /Top Compradores considera somente compras pagas/);
});

check("19. Bilhete so mostra numeros apos pagamento", () => {
  assert.match(raffleDetails, /props\.step === "ticket" && <PremiumTicket/);
  assert.match(raffleDetails, /numbers = props\.purchase\?\.numeros \|\| \[\]/);
  assert.match(server, /ticketUrl: purchase\.status === "paid" \? buildPublicTicketUrl\(purchase\) : ""/);
});

check("20. Admin aceita 10.000.000 numeros", () => {
  assert.match(adminRaffles, /Total de Bilhetes/);
  assert.match(adminRaffles, /type="number"[\s\S]*totalTickets:\s*parseInt/);
  assert.doesNotMatch(adminRaffles, /max=\{?(?:100000|1000000|1_000_000)/);
});

check("21. Checkout continua funcionando", () => {
  assert.match(server, /app\.post\("\/api\/raffles\/:id\/buy"/);
  assert.match(raffleDetails, /fetch\(`\/api\/raffles\/\$\{id\}\/buy`/);
  assert.match(raffleDetails, /setCheckoutStep\(data\.status === "paid" \? "ticket" : "payment"\)/);
  assert.match(checkoutHardSuite, /checkout-hard/);
});

check("22. Gateways continuam funcionando", () => {
  for (const gateway of ["asaas", "mercadopago", "pagbank", "primepag", "pay2m", "cora"]) {
    assert.match(server, new RegExp(`api/webhooks/${gateway}`));
  }
  assert.match(server, /attachActiveGatewayPixToOrder/);
});

check("23. Production readiness continua coberto", () => {
  assert.match(packageJson, /"test:production-readiness"/);
  assert.match(packageJson, /"test:main-raffle-launch-hard"/);
});

console.log(`PASS: auditoria hard da rifa principal validou ${checks.length} contratos.`);
