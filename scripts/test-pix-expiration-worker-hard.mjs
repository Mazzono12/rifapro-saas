import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");
const raffle = readFileSync("src/pages/RaffleDetails.tsx", "utf8");
const farmSection = readFileSync("src/components/FazendinhaSection.tsx", "utf8");
const farmPage = readFileSync("src/pages/Fazendinha.tsx", "utf8");
const numberMode = readFileSync("src/pages/NumberModePage.tsx", "utf8");

assert(server.includes("TRADITIONAL_RAFFLE_RESERVATION_TTL_MS = Number(process.env.PURCHASE_RESERVATION_TTL_MS || 15 * 60 * 1000)"), "rifa tradicional deve manter TTL de 15 minutos");
assert(server.includes("FAST_MODALITY_RESERVATION_TTL_MS = Number(process.env.FAST_MODALITY_RESERVATION_TTL_MS || 5 * 60 * 1000)"), "modalidades rapidas devem ter TTL de 5 minutos");
assert(server.includes("const reservationWorkerInterval = setInterval"), "worker de expiracao de reservas deve existir");
assert(server.includes("expireAllReservations();"), "worker deve executar limpeza inicial");
assert(server.includes("expirePendingReservations(tenantId);"), "status/processos devem expirar rifas tradicionais");
assert(server.includes("expireNumberModeReservations(tenantId"), "status/processos devem expirar NumberMode");
assert(server.includes("expireFazendinhaReservations(tenantId"), "status/processos devem expirar Fazendinha");
assert(server.includes("pixExpiresAt: reservedUntil"), "rifa tradicional deve salvar pixExpiresAt de 15 minutos");
assert(server.includes("pixExpiresAt: fastExpiresAt"), "Fazendinha e NumberMode devem salvar pixExpiresAt de 5 minutos");
assert(server.includes("flow.trigger_type === \"abandoned_pix_recovery\""), "recuperacao PIX deve validar expiracao antes de enviar");
assert(server.includes("PIX expirado"), "endpoint de status deve retornar PIX expirado");
assert(raffle.includes("props.purchase?.pixExpiresAt || props.purchase?.reservedUntil"), "contador da rifa deve usar expiracao retornada pelo backend");
assert(farmSection.includes("usePixCountdown") && farmSection.includes("Expira em {pixCountdown}"), "Fazendinha Home deve mostrar contador de 5 minutos");
assert(farmPage.includes("usePixCountdown") && farmPage.includes("Expira em {pixCountdown}"), "Fazendinha dedicada deve mostrar contador de 5 minutos");
assert(numberMode.includes("usePixCountdown") && numberMode.includes("Expira em {pixCountdown}"), "NumberMode deve mostrar contador de 5 minutos");

console.log("pix-expiration-worker-hard ok");
