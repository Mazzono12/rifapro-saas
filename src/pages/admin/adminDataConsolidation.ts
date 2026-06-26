import { useCallback, useEffect, useMemo, useState } from "react";

export type AdminPurchase = {
  id: string;
  tenantId: string;
  orderId: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string;
  campaignId: string;
  campaignName: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    cpf: string;
    email: string;
  };
  affiliate: {
    id: string;
    refCode: string;
    name: string;
    link: string;
    commissionGenerated: number;
    commissionPaid: number;
  };
};

export type ConsolidatedCustomer = {
  key: string;
  tenantId: string;
  name: string;
  phone: string;
  cpf: string;
  email: string;
  totalOrders: number;
  paidOrders: number;
  totalSpent: number;
  averageTicket: number;
  firstPurchaseAt: string;
  lastPurchaseAt: string;
  status: "ativo" | "pendente" | "inativo";
};

export type ConsolidatedAffiliate = {
  key: string;
  tenantId: string;
  affiliateId: string;
  refCode: string;
  name: string;
  link: string;
  referredCustomers: number;
  referredOrders: number;
  soldAmount: number;
  commissionGenerated: number;
  commissionPaid: number;
  commissionPending: number;
  lastSaleAt: string;
};

export type SalesSummary = {
  grossSales: number;
  platformFee: number;
  netSales: number;
  averageTicket: number;
  paidOrders: number;
  pendingOrders: number;
  conversionRate: number;
  topCampaigns: Array<{ key: string; name: string; amount: number; orders: number }>;
  topAffiliates: ConsolidatedAffiliate[];
  topCustomers: ConsolidatedCustomer[];
  recentDailySales: Array<{ key: string; label: string; amount: number; orders: number }>;
};

type AdminConsolidatedState = {
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  purchases: AdminPurchase[];
  customers: ConsolidatedCustomer[];
  affiliates: ConsolidatedAffiliate[];
  sales: SalesSummary;
  platformRate: number;
};

const emptySalesSummary: SalesSummary = {
  grossSales: 0,
  platformFee: 0,
  netSales: 0,
  averageTicket: 0,
  paidOrders: 0,
  pendingOrders: 0,
  conversionRate: 0,
  topCampaigns: [],
  topAffiliates: [],
  topCustomers: [],
  recentDailySales: []
};

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function objectOrEmpty(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function number(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function normalizeDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizePhone(value: unknown) {
  const digits = normalizeDigits(value);
  if (digits.startsWith("55") && digits.length > 11) return digits.slice(2);
  return digits;
}

export function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function isPaidStatus(status: unknown) {
  const normalized = String(status || "").toLowerCase();
  return ["paid", "confirmed", "received", "recebido", "confirmado", "approved", "aprovado"].some(item => normalized.includes(item));
}

export function isPendingStatus(status: unknown) {
  const normalized = String(status || "").toLowerCase();
  return ["pending", "reserved", "aguardando", "pendente"].some(item => normalized.includes(item));
}

function dateKey(value: string) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function compareIso(a: string, b: string, direction: "asc" | "desc") {
  const left = a ? new Date(a).getTime() : 0;
  const right = b ? new Date(b).getTime() : 0;
  return direction === "asc" ? left - right : right - left;
}

function customerConsolidationKey(purchase: AdminPurchase) {
  const phone = normalizePhone(purchase.customer.phone);
  const cpf = normalizeDigits(purchase.customer.cpf);
  const email = normalizeEmail(purchase.customer.email);
  const identity = phone || cpf || email || purchase.customer.id || purchase.orderId;
  return `${purchase.tenantId || "tenant"}:${identity}`;
}

function affiliateConsolidationKey(purchase: AdminPurchase) {
  const refCode = purchase.affiliate.refCode.toLowerCase();
  const affiliateId = purchase.affiliate.id;
  return `${purchase.tenantId || "tenant"}:${affiliateId || refCode}`;
}

export function normalizeAdminPurchase(rawValue: unknown): AdminPurchase {
  const raw = objectOrEmpty(rawValue);
  const customer = objectOrEmpty(raw.customer || raw.cliente || raw.buyer || raw.comprador);
  const affiliate = objectOrEmpty(raw.affiliate || raw.afiliado || raw.referrer);
  const orderId = text(raw.orderId, raw.purchaseId, raw.pedido, raw.id);
  const status = text(raw.statusPagamento, raw.paymentStatus, raw.status, raw.statusPedido, "pending");
  const amount = number(raw.amount, raw.valor, raw.total, raw.value);
  const refCode = text(
    raw.affiliateRefCode,
    raw.affiliateRef,
    raw.affiliate_ref,
    raw.refCode,
    raw.ref_code,
    raw.indicationCode,
    affiliate.refCode,
    affiliate.ref_code,
    customer.affiliateRefCode
  );
  return {
    id: text(raw.id, orderId),
    tenantId: text(raw.tenant_id, raw.tenantId, customer.tenant_id, customer.tenantId, "tenant"),
    orderId,
    amount,
    status,
    createdAt: text(raw.createdAt, raw.created_at, raw.dataCompra, raw.date),
    paidAt: text(raw.paidAt, raw.paid_at, raw.dataPagamento, raw.paymentDate),
    campaignId: text(raw.raffleId, raw.campaignId, raw.campanhaId, raw.raffle_id),
    campaignName: text(raw.raffleTitle, raw.campaignName, raw.campanha, raw.raffle?.title, raw.title, "Campanha"),
    customer: {
      id: text(customer.id, raw.customerId, raw.customer_id),
      name: text(customer.name, customer.nome, raw.customerName, raw.cliente, "Cliente"),
      phone: text(customer.phone, customer.telefone, raw.phone, raw.telefone, raw.contact),
      cpf: text(customer.cpf, customer.document, customer.documento, raw.cpf, raw.document),
      email: text(customer.email, raw.email)
    },
    affiliate: {
      id: text(raw.affiliate_id, raw.affiliateId, affiliate.id, affiliate.affiliate_id),
      refCode,
      name: text(affiliate.name, affiliate.nome, raw.affiliateName, raw.afiliadoNome, refCode),
      link: text(affiliate.link, raw.affiliateLink, raw.referralLink),
      commissionGenerated: number(raw.affiliateCommission, raw.commissionGenerated, raw.commission_amount, affiliate.commissionGenerated),
      commissionPaid: number(raw.affiliateCommissionPaid, raw.commissionPaid, affiliate.commissionPaid)
    }
  };
}

export function consolidateCustomers(purchases: AdminPurchase[]): ConsolidatedCustomer[] {
  const map = new Map<string, ConsolidatedCustomer>();
  purchases.forEach(purchase => {
    const key = customerConsolidationKey(purchase);
    const paid = isPaidStatus(purchase.status);
    const current = map.get(key) || {
      key,
      tenantId: purchase.tenantId,
      name: purchase.customer.name || "Cliente",
      phone: purchase.customer.phone,
      cpf: purchase.customer.cpf,
      email: purchase.customer.email,
      totalOrders: 0,
      paidOrders: 0,
      totalSpent: 0,
      averageTicket: 0,
      firstPurchaseAt: purchase.createdAt,
      lastPurchaseAt: purchase.createdAt,
      status: "pendente" as const
    };
    current.name = current.name === "Cliente" ? purchase.customer.name || current.name : current.name;
    current.phone ||= purchase.customer.phone;
    current.cpf ||= purchase.customer.cpf;
    current.email ||= purchase.customer.email;
    current.totalOrders += 1;
    current.paidOrders += paid ? 1 : 0;
    current.totalSpent += paid ? purchase.amount : 0;
    current.firstPurchaseAt = [current.firstPurchaseAt, purchase.createdAt].filter(Boolean).sort((a, b) => compareIso(a, b, "asc"))[0] || "";
    current.lastPurchaseAt = [current.lastPurchaseAt, purchase.createdAt].filter(Boolean).sort((a, b) => compareIso(a, b, "desc"))[0] || "";
    current.averageTicket = current.paidOrders ? current.totalSpent / current.paidOrders : 0;
    current.status = current.paidOrders > 0 ? "ativo" : "pendente";
    map.set(key, current);
  });
  return [...map.values()].sort((a, b) => b.totalSpent - a.totalSpent || compareIso(a.lastPurchaseAt, b.lastPurchaseAt, "desc"));
}

export function consolidateAffiliates(purchases: AdminPurchase[]): ConsolidatedAffiliate[] {
  const map = new Map<string, ConsolidatedAffiliate>();
  purchases.filter(purchase => purchase.affiliate.refCode || purchase.affiliate.id).forEach(purchase => {
    const key = affiliateConsolidationKey(purchase);
    const paid = isPaidStatus(purchase.status);
    const current = map.get(key) || {
      key,
      tenantId: purchase.tenantId,
      affiliateId: purchase.affiliate.id,
      refCode: purchase.affiliate.refCode,
      name: purchase.affiliate.name || purchase.affiliate.refCode || "Afiliado",
      link: purchase.affiliate.link || (purchase.affiliate.refCode ? `/afiliados?r=${encodeURIComponent(purchase.affiliate.refCode)}` : ""),
      referredCustomers: 0,
      referredOrders: 0,
      soldAmount: 0,
      commissionGenerated: 0,
      commissionPaid: 0,
      commissionPending: 0,
      lastSaleAt: ""
    };
    current.affiliateId ||= purchase.affiliate.id;
    current.refCode ||= purchase.affiliate.refCode;
    current.name = current.name === "Afiliado" ? purchase.affiliate.name || current.name : current.name;
    current.link ||= purchase.affiliate.link;
    current.referredOrders += 1;
    current.soldAmount += paid ? purchase.amount : 0;
    current.commissionGenerated += paid ? purchase.affiliate.commissionGenerated : 0;
    current.commissionPaid += purchase.affiliate.commissionPaid;
    current.commissionPending = Math.max(0, current.commissionGenerated - current.commissionPaid);
    current.lastSaleAt = [current.lastSaleAt, purchase.createdAt].filter(Boolean).sort((a, b) => compareIso(a, b, "desc"))[0] || "";
    map.set(key, current);
  });

  const customerSets = new Map<string, Set<string>>();
  purchases.filter(purchase => purchase.affiliate.refCode || purchase.affiliate.id).forEach(purchase => {
    const key = affiliateConsolidationKey(purchase);
    const set = customerSets.get(key) || new Set<string>();
    set.add(customerConsolidationKey(purchase));
    customerSets.set(key, set);
  });

  return [...map.values()]
    .map(affiliate => ({ ...affiliate, referredCustomers: customerSets.get(affiliate.key)?.size || 0 }))
    .sort((a, b) => b.soldAmount - a.soldAmount || compareIso(a.lastSaleAt, b.lastSaleAt, "desc"));
}

export function buildSalesSummary(purchases: AdminPurchase[], customers: ConsolidatedCustomer[], affiliates: ConsolidatedAffiliate[], platformRate: number): SalesSummary {
  const paid = purchases.filter(purchase => isPaidStatus(purchase.status));
  const pending = purchases.filter(purchase => isPendingStatus(purchase.status));
  const grossSales = paid.reduce((sum, purchase) => sum + purchase.amount, 0);
  const platformFee = grossSales * (Math.max(0, platformRate) / 100);
  const campaignMap = new Map<string, { key: string; name: string; amount: number; orders: number }>();
  paid.forEach(purchase => {
    const key = `${purchase.tenantId}:${purchase.campaignId || purchase.campaignName}`;
    const current = campaignMap.get(key) || { key, name: purchase.campaignName || "Campanha", amount: 0, orders: 0 };
    current.amount += purchase.amount;
    current.orders += 1;
    campaignMap.set(key, current);
  });

  const days = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const rows = paid.filter(purchase => dateKey(purchase.paidAt || purchase.createdAt) === key);
    return {
      key,
      label: date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      amount: rows.reduce((sum, purchase) => sum + purchase.amount, 0),
      orders: rows.length
    };
  });

  return {
    grossSales,
    platformFee,
    netSales: grossSales - platformFee,
    averageTicket: paid.length ? grossSales / paid.length : 0,
    paidOrders: paid.length,
    pendingOrders: pending.length,
    conversionRate: purchases.length ? (paid.length / purchases.length) * 100 : 0,
    topCampaigns: [...campaignMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
    topAffiliates: affiliates.slice(0, 5),
    topCustomers: customers.slice(0, 5),
    recentDailySales: days
  };
}

async function readJson(url: string, fallback: unknown) {
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return fallback;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

function extractPlatformRate(summary: unknown) {
  const data = objectOrEmpty(summary);
  return number(data.platformCommissionRate, data.commissionRate, data.settings?.platformCommissionRate, data.percentual_plataforma);
}

export function useAdminConsolidatedData(): AdminConsolidatedState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [purchases, setPurchases] = useState<AdminPurchase[]>([]);
  const [platformRate, setPlatformRate] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    const [purchasePayload, platformPayload] = await Promise.all([
      readJson("/api/admin/purchases", []),
      readJson("/api/admin/platform-billing/summary", {})
    ]);
    if (!Array.isArray(purchasePayload)) setError("Nao foi possivel carregar compras administrativas.");
    setPurchases(asArray(purchasePayload).map(normalizeAdminPurchase).filter(purchase => purchase.orderId));
    setPlatformRate(extractPlatformRate(platformPayload));
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const customers = useMemo(() => consolidateCustomers(purchases), [purchases]);
  const affiliates = useMemo(() => consolidateAffiliates(purchases), [purchases]);
  const sales = useMemo(() => buildSalesSummary(purchases, customers, affiliates, platformRate), [purchases, customers, affiliates, platformRate]);

  return { loading, error, reload, purchases, customers, affiliates, sales, platformRate };
}

export function money(value: unknown) {
  const parsed = Number(value || 0);
  return (Number.isFinite(parsed) ? parsed : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function percent(value: unknown) {
  const parsed = Number(value || 0);
  return `${(Number.isFinite(parsed) ? parsed : 0).toFixed(1)}%`;
}

export function dateLabel(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}


