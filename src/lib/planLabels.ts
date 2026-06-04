export const commercialPlanLabels: Record<string, string> = {
  starter: "Básico",
  gratis: "Básico",
  free: "Básico",
  basico: "Básico",
  "básico": "Básico",
  basic: "Básico",
  pro: "Profissional",
  profissional: "Profissional",
  premium: "Premium",
  enterprise: "Empresa",
  empresa: "Empresa",
  "white-label": "White Label",
  whitelabel: "White Label",
  "white label": "White Label",
  branca: "White Label",
  "marca branca": "White Label"
};

export function formatPlanName(plan: unknown) {
  const source = typeof plan === "object" && plan
    ? (plan as { id?: unknown; canonical_id?: unknown; nome?: unknown; name?: unknown }).id
      ?? (plan as { canonical_id?: unknown }).canonical_id
      ?? (plan as { nome?: unknown }).nome
      ?? (plan as { name?: unknown }).name
    : plan;
  const key = String(source || "").trim().toLowerCase();
  return commercialPlanLabels[key] || String(source || "Básico");
}
