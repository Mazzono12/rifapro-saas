import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const widget = readFileSync("src/components/PublicConversionWidgets.tsx", "utf8");
const raffle = readFileSync("src/pages/RaffleDetails.tsx", "utf8");
const migration = readFileSync("supabase/migrations/28_public_activity_events.sql", "utf8");

function includesAll(source, terms, label) {
  for (const term of terms) assert(source.includes(term), `${label}: ausente ${term}`);
}

includesAll(server, [
  "PublicActivityEventRecord",
  "publicActivityEvents",
  "maskDisplayName",
  "tenantHasFeature(tenantId, \"realtime_social_proof\")",
  "recordPublicActivityEvent",
  "sanitizePublicActivityEvent",
  "getPublicRanking",
  "getPublicScarcity",
  "normalizeRaffleConversionPayload"
], "modelo prova social");

includesAll(server, [
  "/api/public/raffles/:raffleId/activity",
  "/api/public/raffles/:raffleId/ranking",
  "/api/public/raffles/:raffleId/scarcity",
  "feedEnabled",
  "toastEnabled",
  "showLivePurchaseFeed",
  "showSocialProofToast",
  "conversionProgressEnabled",
  "conversionProgressGoal",
  "Cache-Control",
  "display_name_masked",
  "metadata: {",
  "cpf",
  "email",
  "phone"
], "endpoints publicos");

assert(!/sanitizePublicActivityEvent[\s\S]{0,600}(cpf|email|phone|telefone)/i.test(server), "Evento publico nao pode expor CPF/email/telefone.");
assert(server.includes("purchase.tenant_id === tenantId && purchase.raffleId === raffleId && purchase.status === \"paid\""), "Feed deve usar somente compras pagas da mesma campanha e tenant.");
assert(server.includes(".slice(0, 20)") && server.includes("event_type: \"purchase_approved\""), "Feed deve limitar ultimas 20 compras pagas.");
assert(server.includes("event_type: \"instant_prize\""), "Premio instantaneo deve gerar evento publico.");
assert(server.includes("event_type: \"mystery_box\""), "Caixinha deve gerar evento publico.");
assert(server.includes("Math.min(100, Math.max(0, Number.isFinite(rawProgress) ? rawProgress : 0))"), "Barra deve limitar progresso entre 0 e 100 sem NaN.");
assert(server.includes("commercialGoal > 0 ? commercialGoal : Number(raffle.totalTickets || 0)"), "Barra deve usar meta comercial quando existir e fallback tradicional sem meta.");

includesAll(widget, [
  "PublicConversionWidgets",
  "LivePurchaseFeed",
  "SocialProofToast",
  "toast.custom",
  "position: \"top-center\"",
  "document.body.dataset.checkoutOpen",
  "purchase_approved",
  "Movimento em tempo real",
  "Top compradores",
  "meta comercial",
  "data-live-purchase-feed=\"paid-only\"",
  "relativeTime",
  "setInterval",
  "18000",
  "truncate",
  "overflow-hidden"
], "UI prova social");

const adminRaffles = readFileSync("src/pages/admin/AdminRaffles.tsx", "utf8");
includesAll(adminRaffles, [
  "Conversão social premium",
  "Exibir Feed de Compras",
  "Exibir Prova Social",
  "Exibir Barra de Progresso",
  "Meta visual de progresso",
  "Use uma meta comercial"
], "admin campanha configuracoes conversao social");

includesAll(raffle, ["PublicConversionWidgets", "<PublicConversionWidgets raffleId={id}"], "pagina publica rifa");

includesAll(migration, [
  "public_activity_events",
  "tenant_id uuid not null references public.tenants(id)",
  "event_type text not null",
  "display_name_masked text not null",
  "metadata jsonb",
  "visible boolean",
  "enable row level security",
  "public.can_access_tenant"
], "migration prova social");

console.log("[public-conversion-widgets] ok");
