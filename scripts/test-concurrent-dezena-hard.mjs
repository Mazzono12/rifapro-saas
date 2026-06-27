import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('server.ts', 'utf8');
function has(pattern, message) { assert.match(source, pattern, message); }
function order(before, after, message) {
  const a = source.indexOf(before);
  const b = source.indexOf(after);
  assert.ok(a >= 0, `Nao encontrou: ${before}`);
  assert.ok(b >= 0, `Nao encontrou: ${after}`);
  assert.ok(a < b, message);
}

has(/getTenantGateways\(tenantId\)\.pix\?\.enabled/, 'Modalidades numericas devem usar gateway tenant-scoped.');
has(/withCriticalReservationLocks\(numbers\.map\(number => `number-mode:\$\{tenantId\}:\$\{mode\}:\$\{number\}`\)/, 'Dezena/Centena/Milhar devem travar por tenant + modalidade + numero.');
has(/numberModePurchases\.unshift\(purchase\);/, 'Pedido da modalidade deve ser criado dentro da reserva.');
has(/numberModeBets\.push\(\{[\s\S]*purchaseId: purchase\.id,[\s\S]*status: purchase\.status/, 'Bet reservado deve ser persistido antes do PIX.');
has(/await persistCriticalReservationState\("number-mode-reservation-created"\)/, 'Reserva da modalidade deve persistir imediatamente.');
has(/numberModeBets = numberModeBets\.filter\(bet => !\(bet\.tenant_id === tenantId && bet\.purchaseId === purchase\.id\)\)/, 'Falha no gateway deve remover bets reservados.');
order('await persistCriticalReservationState("number-mode-reservation-created")', 'await attachActiveGatewayPixToOrder({\n        tenantId,\n        purchase,\n        customer,\n        amount: purchase.amount', 'Modalidade deve persistir reserva antes do gateway PIX.');

console.log('OK - concurrent dezena/centena/milhar contract');
