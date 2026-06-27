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

has(/withCriticalReservationLocks\(groupIds\.map\(groupId => `fazendinha:\$\{tenantId\}:\$\{groupId\}`\)/, 'Fazendinha deve travar por tenant + grupo.');
has(/group\.status = "reserved";\s*group\.compradorId = customer\.id;\s*group\.compraId = purchase\.id;/, 'Grupo deve ser reservado antes do gateway.');
has(/fazendinhaCompras\.unshift\(purchase\);\s*await persistCriticalReservationState\("fazendinha-reservation-created"\)/, 'Compra Fazendinha deve persistir reserva imediatamente.');
has(/group\.status = "available";\s*delete group\.compradorId;\s*delete group\.compraId;/, 'Falha de gateway deve liberar grupo da Fazendinha.');
has(/await persistCriticalReservationState\("fazendinha-reservation-reverted"\)/, 'Reversao Fazendinha deve persistir.');
order('await persistCriticalReservationState("fazendinha-reservation-created")', 'await attachActiveGatewayPixToOrder({\n        tenantId,\n        purchase,\n        customer,\n        amount: purchase.valorPago', 'Fazendinha deve persistir reserva antes do gateway PIX.');

console.log('OK - concurrent fazendinha contract');
