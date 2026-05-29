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
  "getPublicScarcity"
], "modelo prova social");

includesAll(server, [
  "/api/public/raffles/:raffleId/activity",
  "/api/public/raffles/:raffleId/ranking",
  "/api/public/raffles/:raffleId/scarcity",
  "Cache-Control",
  "display_name_masked",
  "metadata: {",
  "cpf",
  "email",
  "phone"
], "endpoints publicos");

assert(!/sanitizePublicActivityEvent[\s\S]{0,600}(cpf|email|phone|telefone)/i.test(server), "Evento publico nao pode expor CPF/email/telefone.");
assert(server.includes("recordPublicActivityEvent({") && server.includes("event_type: purchase.status === \"paid\" ? \"purchase_approved\" : \"purchase_created\""), "Compra deve gerar evento publico mascarado.");
assert(server.includes("event_type: \"instant_prize\""), "Premio instantaneo deve gerar evento publico.");
assert(server.includes("event_type: \"mystery_box\""), "Caixinha deve gerar evento publico.");

includesAll(widget, [
  "PublicConversionWidgets",
  "toast.custom",
  "Compra recente",
  "Movimento em tempo real",
  "Top compradores",
  "cotas restantes",
  "setInterval",
  "18000",
  "truncate",
  "overflow-hidden"
], "UI prova social");

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
