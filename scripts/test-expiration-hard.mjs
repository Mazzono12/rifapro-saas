import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('server.ts', 'utf8');
function has(pattern, message) { assert.match(source, pattern, message); }

has(/function expirePendingReservations[\s\S]*releaseReservedNumbers\(raffle, purchase\.numeros\)/, 'Expiracao de rifa deve liberar cotas.');
has(/function expireNumberModeReservations[\s\S]*numberModeBets = numberModeBets\.filter/, 'Expiracao de modalidade deve liberar bets.');
has(/function expireFazendinhaReservations[\s\S]*group\.status = "available"/, 'Expiracao Fazendinha deve liberar grupos.');
has(/modePurchase\.status = "cancelled";[\s\S]*numberModeBets = numberModeBets\.filter\(bet => !\(bet\.tenant_id === tenantId && bet\.purchaseId === modePurchase\.id\)\)/, 'Webhook terminal deve liberar bets da modalidade.');
has(/farmPurchase\.statusPagamento = "cancelled";[\s\S]*group\.status = "available";[\s\S]*delete group\.compradorId;[\s\S]*delete group\.compraId;/, 'Webhook terminal deve liberar grupos da Fazendinha.');
has(/remote_status_not_paid/, 'Pagamento atrasado/nao pago deve ser ignorado apos validacao remota.');

console.log('OK - expiration and release contract');
