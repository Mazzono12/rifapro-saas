import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('server.ts', 'utf8');

function has(pattern, message) {
  assert.match(source, pattern, message);
}

function order(before, after, message) {
  const a = source.indexOf(before);
  const b = source.indexOf(after);
  assert.ok(a >= 0, `Nao encontrou: ${before}`);
  assert.ok(b >= 0, `Nao encontrou: ${after}`);
  assert.ok(a < b, message);
}

has(/withCriticalReservationLocks\(\[/, 'Rifa deve usar lock critico por campanha.');
has(/`raffle:\$\{tenantId\}:\$\{id\}`/, 'Lock de rifa deve ser tenant + campanha.');
has(/reserveAvailableNumbers\(raffle, effectiveTickets\)/, 'Rifa deve reservar numeros antes do PIX.');
has(/await persistCriticalReservationState\("checkout-raffle-reservation-created"\)/, 'Reserva de rifa deve persistir imediatamente.');
has(/purchases = purchases\.filter\(item => item\.purchaseId !== purchase\.purchaseId/, 'Falha ao gerar PIX deve remover pedido de rifa persistido.');
has(/await persistCriticalReservationState\("checkout-raffle-reservation-reverted"\)/, 'Falha ao gerar PIX deve persistir reversao da rifa.');
order('await persistCriticalReservationState("checkout-raffle-reservation-created")', 'await attachActiveGatewayPixToOrder({\n        tenantId,\n        purchase,\n        customer,\n        amount: payableAmount', 'Rifa deve persistir reserva antes de chamar gateway PIX.');

console.log('OK - concurrent raffle purchase contract');
