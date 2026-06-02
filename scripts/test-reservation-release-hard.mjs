import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");

assert(server.includes("function releaseReservedNumbers"), "rifa tradicional precisa liberar cotas");
assert(server.includes("purchase.rejectedReason = \"Reserva expirada\""), "rifa expirada deve ser marcada como cancelada por reserva expirada");
assert(server.includes("numberModeBets = numberModeBets.filter"), "NumberMode deve remover numeros reservados expirados");
assert(server.includes("purchase.status = \"cancelled\""), "NumberMode expirado deve cancelar a compra");
assert(server.includes("group.status = \"available\""), "Fazendinha expirada deve devolver grupos para disponivel");
assert(server.includes("delete group.compradorId") && server.includes("delete group.compraId"), "Fazendinha deve limpar comprador/compra ao liberar reserva");
assert(server.includes("function isFazendinhaReservationExpired"), "Fazendinha deve ter guarda unica para expiracao de reserva");
assert(server.includes("isFazendinhaReservationExpired(purchase)") && server.includes("purchase.statusPagamento = \"cancelled\""), "confirmacao da Fazendinha deve recusar pagamento apos 5 minutos");
assert(server.includes("groups.length < expectedGroupIds.length"), "Fazendinha nao pode confirmar reserva sem todos os bichos ainda vinculados");
assert(server.includes("group.compraId !== purchase.id"), "Fazendinha nao pode confirmar bicho reservado por outra compra");
assert(server.includes("confirmNumberModePurchase(modePurchase)") && server.includes("confirmFazendinhaPurchase(farmPurchase)"), "webhook deve confirmar modalidades antes do prazo");
assert(server.includes("Number mode reservation expired") && server.includes("Fazendinha reservation expired"), "pagamento apos expiracao nao pode reativar sem auditoria");
assert(server.includes("const sold = new Set(numberModeBets.filter(bet => bet.tenant_id === tenantId && bet.mode === mode && [\"reserved\", \"paid\"].includes(bet.status))"), "grade NumberMode deve ignorar reservas canceladas");
assert(server.includes("status: modePurchase.status === \"paid\" ? \"paid\" : expired ? \"expired\" : \"pending\"") || server.includes("paymentStatus: modePurchase.status === \"paid\" ? \"paid\" : expired ? \"expired\" : \"pending\""), "status NumberMode deve expirar corretamente");
assert(server.includes("paymentStatus: farmPurchase.statusPagamento === \"paid\" ? \"paid\" : expired ? \"expired\" : \"pending\""), "status Fazendinha deve expirar corretamente");

console.log("reservation-release-hard ok");
