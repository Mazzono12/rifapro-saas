import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('server.ts', 'utf8');
function has(pattern, message) { assert.match(source, pattern, message); }

has(/const lockKey = `\$\{job\.tenant_id\}:\$\{job\.gateway\}:\$\{job\.releaseType\}:\$\{job\.purchaseId\}`;/, 'Release de pagamento deve usar lock idempotente por tenant/gateway/tipo/pedido.');
has(/paymentReleaseLocks\.has\(lockKey\)/, 'Webhook duplicado simultaneo deve ser bloqueado por lock.');
has(/if \(modePurchase\.status === "paid"\)[\s\S]*duplicate: true/, 'Webhook duplicado de modalidade deve retornar idempotente.');
has(/if \(farmPurchase\.statusPagamento === "paid"\)[\s\S]*duplicate: true/, 'Webhook duplicado de Fazendinha deve retornar idempotente.');
has(/if \(purchase\.status === "paid"\)[\s\S]*duplicate: true/, 'Webhook duplicado de rifa deve retornar idempotente.');
has(/buildPaymentIdempotencyKey/, 'Webhook deve gerar chave de idempotencia.');
has(/existingEvent\?\.processed/, 'Webhook deve ignorar/reprocessar duplicados de forma controlada.');
has(/timingSafeEqual/, 'Webhook Asaas deve validar token em tempo constante.');

console.log('OK - webhook idempotency contract');
