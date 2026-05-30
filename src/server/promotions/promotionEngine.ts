export type PromotionType =
  | "double_tickets"
  | "buy_and_win"
  | "pre_pix_upsell"
  | "lucky_hour"
  | "abandoned_pix_recovery"
  | "package_bonus"
  | "affiliate_bonus"
  | "first_purchase_bonus"
  | "vip_bonus"
  | "buyer_ranking";

export type PromotionRuleStatus = "active" | "inactive" | "expired" | "scheduled";

export type PromotionRule = {
  id: string;
  tenant_id: string;
  raffle_id?: string | null;
  name: string;
  type: PromotionType;
  enabled: boolean;
  priority: number;
  starts_at?: string | null;
  ends_at?: string | null;
  conditions: Record<string, unknown>;
  rewards: Record<string, unknown>;
  limits: Record<string, unknown>;
  stackable: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type PromotionUsage = {
  id: string;
  tenant_id: string;
  promotion_id: string;
  raffle_id?: string | null;
  customer_id?: string | null;
  order_id?: string | null;
  usage_type: string;
  quantity: number;
  amount: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type PromotionEvaluationContext = {
  tenantId: string;
  raffleId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  orderId?: string | null;
  quantity: number;
  paidQuantity?: number;
  amount: number;
  price?: number;
  availableTickets?: number;
  packageLabel?: string;
  isFirstPurchase?: boolean;
  isVip?: boolean;
  affiliateRefCode?: string | null;
  raffleStatus?: string;
  paymentStatus?: string;
  pixExpiresAt?: string | null;
  paymentLink?: string | null;
  now?: Date | string | number;
  rules?: PromotionRule[];
  usages?: PromotionUsage[];
};

export type PromotionReward = {
  promotionId: string;
  type: string;
  quantity: number;
  label: string;
  metadata?: Record<string, unknown>;
};

export type PromotionUpsellOffer = {
  promotionId: string;
  label: string;
  description: string;
  extraTickets: number;
  extraAmount: number;
  rewardType: string;
  accepted?: boolean;
};

export type PromotionSummary = {
  appliedRules: PromotionRule[];
  badges: Array<{ label: string; type: PromotionType; promotionId: string }>;
  bonusTickets: number;
  doubleTickets?: { applied: boolean; bonusTickets: number; minTickets?: number; label: string; promotionId?: string };
  rewards: PromotionReward[];
  upsellOffer?: PromotionUpsellOffer;
  luckyHour?: { applied: boolean; label: string; promotionId: string; bonusTickets?: number; rewardType?: string };
  recoveryMessages: Array<{ delayMinutes: number; message: string; idempotencyKey: string }>;
  warnings: string[];
};

const defaultSummary = (): PromotionSummary => ({
  appliedRules: [],
  badges: [],
  bonusTickets: 0,
  rewards: [],
  recoveryMessages: [],
  warnings: []
});

function numberFrom(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function intFrom(value: unknown, fallback = 0) {
  return Math.max(0, Math.floor(numberFrom(value, fallback)));
}

function listFrom(value: unknown) {
  return Array.isArray(value) ? value.map(item => String(item)) : [];
}

function nowMs(value?: Date | string | number) {
  if (!value) return Date.now();
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : Date.now();
}

export function normalizePromotionRule(input: Partial<PromotionRule> & { tenant_id: string; name?: string; type?: string }): PromotionRule {
  const now = new Date().toISOString();
  const type = String(input.type || "double_tickets") as PromotionType;
  return {
    id: String(input.id || `PROM_${Math.random().toString(36).slice(2, 10).toUpperCase()}`),
    tenant_id: String(input.tenant_id),
    raffle_id: input.raffle_id ? String(input.raffle_id) : null,
    name: String(input.name || "Promocao").trim().slice(0, 120) || "Promocao",
    type,
    enabled: input.enabled !== false,
    priority: intFrom(input.priority, 100),
    starts_at: input.starts_at || null,
    ends_at: input.ends_at || null,
    conditions: input.conditions && typeof input.conditions === "object" ? input.conditions : {},
    rewards: input.rewards && typeof input.rewards === "object" ? input.rewards : {},
    limits: input.limits && typeof input.limits === "object" ? input.limits : {},
    stackable: Boolean(input.stackable),
    created_by: input.created_by || null,
    created_at: input.created_at || now,
    updated_at: now,
    deleted_at: input.deleted_at || null
  };
}

export function getPromotionStatus(rule: PromotionRule, dateLike?: Date | string | number): PromotionRuleStatus {
  if (!rule.enabled || rule.deleted_at) return "inactive";
  const at = nowMs(dateLike);
  if (rule.starts_at && new Date(rule.starts_at).getTime() > at) return "scheduled";
  if (rule.ends_at && new Date(rule.ends_at).getTime() < at) return "expired";
  return "active";
}

export function isPromotionActive(rule: PromotionRule, context: Pick<PromotionEvaluationContext, "tenantId" | "raffleId" | "raffleStatus" | "now">) {
  if (rule.tenant_id !== context.tenantId) return false;
  if (rule.raffle_id && context.raffleId && rule.raffle_id !== context.raffleId) return false;
  if (rule.raffle_id && !context.raffleId) return false;
  if (["completed", "closed", "cancelled", "paused"].includes(String(context.raffleStatus || ""))) return false;
  return getPromotionStatus(rule, context.now) === "active";
}

export function getActivePromotions(tenantId: string, raffleId?: string | null, rules: PromotionRule[] = [], now?: Date | string | number) {
  return rules
    .filter(rule => isPromotionActive(rule, { tenantId, raffleId, now }))
    .sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at));
}

function withinLimit(rule: PromotionRule, context: PromotionEvaluationContext, usageType: string) {
  const usages = context.usages || [];
  const customerLimit = intFrom(rule.limits.maxPerCustomer ?? rule.limits.max_per_customer, 0);
  const totalLimit = intFrom(rule.limits.maxTotal ?? rule.limits.max_total, 0);
  const matching = usages.filter(usage => usage.tenant_id === context.tenantId && usage.promotion_id === rule.id && usage.usage_type === usageType);
  if (totalLimit > 0 && matching.length >= totalLimit) return false;
  if (customerLimit > 0 && context.customerId) {
    const customerUsages = matching.filter(usage => usage.customer_id === context.customerId);
    if (customerUsages.length >= customerLimit) return false;
  }
  return true;
}

function isPackageEligible(rule: PromotionRule, quantity: number, packageLabel?: string) {
  const packages = listFrom(rule.conditions.packageQuantities ?? rule.conditions.packages);
  if (!packages.length) return true;
  return packages.includes(String(quantity)) || (packageLabel ? packages.includes(packageLabel) : false);
}

export function applyDoubleTickets(context: PromotionEvaluationContext, summary = defaultSummary()) {
  const rules = getActivePromotions(context.tenantId, context.raffleId, context.rules || [], context.now).filter(rule => rule.type === "double_tickets");
  for (const rule of rules) {
    const minQuantity = intFrom(rule.conditions.minQuantity ?? rule.conditions.min_tickets, 1);
    const multiplier = Math.max(1, numberFrom(rule.rewards.multiplier, 2));
    if (context.quantity < minQuantity || !isPackageEligible(rule, context.quantity, context.packageLabel) || !withinLimit(rule, context, "double_tickets")) continue;
    const requestedBonus = Math.floor(context.quantity * (multiplier - 1));
    const available = context.availableTickets ?? requestedBonus;
    const bonusTickets = Math.max(0, Math.min(requestedBonus, available));
    if (!bonusTickets) {
      summary.warnings.push("Promocao de cotas extras sem disponibilidade suficiente.");
      continue;
    }
    const label = String(rule.rewards.label || rule.conditions.publicText || rule.name || "Cotas em Dobro");
    summary.appliedRules.push(rule);
    summary.badges.push({ label, type: rule.type, promotionId: rule.id });
    summary.bonusTickets += bonusTickets;
    summary.doubleTickets = { applied: true, bonusTickets, minTickets: minQuantity, label, promotionId: rule.id };
    if (!rule.stackable) break;
  }
  return summary;
}

export function applyBuyAndWin(context: PromotionEvaluationContext, summary = defaultSummary()) {
  const rewardCountKeys = new Set(["scratchcard", "lootbox", "mystery_box", "roulette", "cashback", "coupon", "instant_prize", "extra_ticket"]);
  getActivePromotions(context.tenantId, context.raffleId, context.rules || [], context.now)
    .filter(rule => ["buy_and_win", "package_bonus", "affiliate_bonus", "first_purchase_bonus", "vip_bonus"].includes(rule.type))
    .forEach(rule => {
      const minQuantity = intFrom(rule.conditions.minQuantity ?? rule.conditions.min_tickets, 1);
      if (context.quantity < minQuantity || !withinLimit(rule, context, "reward")) return;
      if (rule.type === "first_purchase_bonus" && !context.isFirstPurchase) return;
      if (rule.type === "vip_bonus" && !context.isVip) return;
      if (rule.type === "affiliate_bonus" && !context.affiliateRefCode) return;
      const rewardType = String(rule.rewards.rewardType || rule.rewards.type || "extra_ticket");
      if (!rewardCountKeys.has(rewardType)) return;
      const quantity = intFrom(rule.rewards.quantity, 1);
      const label = String(rule.rewards.label || rule.name);
      if (rewardType === "extra_ticket") summary.bonusTickets += quantity;
      summary.rewards.push({ promotionId: rule.id, type: rewardType, quantity, label, metadata: rule.rewards });
      summary.appliedRules.push(rule);
      summary.badges.push({ label, type: rule.type, promotionId: rule.id });
    });
  return summary;
}

export function applyUpsell(context: PromotionEvaluationContext, summary = defaultSummary()) {
  const rule = getActivePromotions(context.tenantId, context.raffleId, context.rules || [], context.now)
    .find(item => item.type === "pre_pix_upsell" && withinLimit(item, context, "upsell"));
  if (!rule) return summary;
  const minQuantity = intFrom(rule.conditions.minQuantity ?? rule.conditions.min_tickets, 0);
  if (context.quantity < minQuantity) return summary;
  const extraTickets = intFrom(rule.rewards.extraTickets ?? rule.rewards.quantity, 0);
  const extraAmount = numberFrom(rule.rewards.extraAmount ?? rule.rewards.amount, Number((extraTickets * numberFrom(context.price, 0)).toFixed(2)));
  summary.upsellOffer = {
    promotionId: rule.id,
    label: String(rule.rewards.label || rule.name || "Oferta antes do PIX"),
    description: String(rule.rewards.description || "Adicione mais chances antes de gerar seu PIX."),
    extraTickets,
    extraAmount,
    rewardType: String(rule.rewards.rewardType || "tickets")
  };
  summary.badges.push({ label: summary.upsellOffer.label, type: rule.type, promotionId: rule.id });
  return summary;
}

function timeToMinutes(value: unknown) {
  const [hour, minute] = String(value || "00:00").split(":").map(part => intFrom(part, 0));
  return hour * 60 + minute;
}

export function applyLuckyHour(context: PromotionEvaluationContext, summary = defaultSummary()) {
  const date = new Date(nowMs(context.now));
  const currentDay = date.getDay();
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  getActivePromotions(context.tenantId, context.raffleId, context.rules || [], context.now)
    .filter(rule => rule.type === "lucky_hour")
    .forEach(rule => {
      const days = Array.isArray(rule.conditions.daysOfWeek) ? rule.conditions.daysOfWeek.map(Number) : [];
      const start = timeToMinutes(rule.conditions.startTime ?? rule.conditions.startsAtTime);
      const end = timeToMinutes(rule.conditions.endTime ?? rule.conditions.endsAtTime);
      const inDay = !days.length || days.includes(currentDay);
      const inWindow = start <= end ? currentMinutes >= start && currentMinutes <= end : currentMinutes >= start || currentMinutes <= end;
      if (!inDay || !inWindow || !withinLimit(rule, context, "lucky_hour")) return;
      const rewardType = String(rule.rewards.rewardType || rule.rewards.type || "bonus_tickets");
      const bonusTickets = rewardType === "bonus_tickets" ? intFrom(rule.rewards.quantity ?? rule.rewards.bonusTickets, 0) : 0;
      const label = String(rule.rewards.label || rule.name || "Hora Premiada");
      summary.bonusTickets += bonusTickets;
      summary.luckyHour = { applied: true, label, promotionId: rule.id, bonusTickets, rewardType };
      summary.appliedRules.push(rule);
      summary.badges.push({ label, type: rule.type, promotionId: rule.id });
    });
  return summary;
}

export function buildAbandonedPixRecoveryMessages(context: PromotionEvaluationContext) {
  if (!["pending", "reserved"].includes(String(context.paymentStatus || "pending"))) return [];
  return getActivePromotions(context.tenantId, context.raffleId, context.rules || [], context.now)
    .filter(rule => rule.type === "abandoned_pix_recovery")
    .flatMap(rule => {
      const delays = Array.isArray(rule.conditions.delaysMinutes) ? rule.conditions.delaysMinutes : [15, 45, 120];
      const template = String(rule.rewards.template || "Ola {name}, seu PIX de {amount} ainda esta pendente em {campaign}. Finalize pelo link: {paymentLink}");
      return delays.map(delay => {
        const delayMinutes = intFrom(delay, 15);
        const message = template
          .replaceAll("{name}", String(context.customerName || "cliente"))
          .replaceAll("{amount}", Number(context.amount || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))
          .replaceAll("{campaign}", String(context.raffleId || "campanha"))
          .replaceAll("{paymentLink}", String(context.paymentLink || ""));
        return {
          delayMinutes,
          message,
          idempotencyKey: `promotion:abandoned_pix_recovery:${rule.id}:${context.orderId || "preview"}:${delayMinutes}`
        };
      });
    });
}

export function applyLuckyHourAndRewards(context: PromotionEvaluationContext) {
  return applyLuckyHour(context, applyBuyAndWin(context, applyDoubleTickets(context)));
}

export function applyPromotionUsageLimits(summary: PromotionSummary) {
  return summary;
}

export function calculatePromotionSummary(context: PromotionEvaluationContext) {
  const summary = applyUpsell(context, applyLuckyHour(context, applyBuyAndWin(context, applyDoubleTickets(context))));
  summary.recoveryMessages = buildAbandonedPixRecoveryMessages(context);
  return summary;
}

export function evaluatePromotions(context: PromotionEvaluationContext) {
  const rules = getActivePromotions(context.tenantId, context.raffleId, context.rules || [], context.now);
  return calculatePromotionSummary({ ...context, rules });
}

export function persistPromotionUsage(context: PromotionEvaluationContext, rule: PromotionRule, input: Partial<PromotionUsage>, usages: PromotionUsage[] = []) {
  const usageType = String(input.usage_type || rule.type);
  const duplicate = usages.find(usage =>
    usage.tenant_id === context.tenantId &&
    usage.promotion_id === rule.id &&
    usage.order_id === (context.orderId || input.order_id || null) &&
    usage.usage_type === usageType
  );
  if (duplicate) return duplicate;
  const usage: PromotionUsage = {
    id: String(input.id || `PUSG_${Math.random().toString(36).slice(2, 10).toUpperCase()}`),
    tenant_id: context.tenantId,
    promotion_id: rule.id,
    raffle_id: context.raffleId || rule.raffle_id || null,
    customer_id: context.customerId || null,
    order_id: context.orderId || input.order_id || null,
    usage_type: usageType,
    quantity: intFrom(input.quantity, context.quantity),
    amount: numberFrom(input.amount, context.amount),
    metadata: input.metadata || {},
    created_at: String(input.created_at || new Date().toISOString())
  };
  usages.unshift(usage);
  return usage;
}

export function maskBuyerName(name: string) {
  const parts = String(name || "Cliente").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Cliente";
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return [first.slice(0, 1) + "***", last ? last.slice(0, 1) + "***" : ""].filter(Boolean).join(" ");
}

export function buildPromotionBadges(summary: PromotionSummary) {
  return summary.badges.map(badge => badge.label);
}
