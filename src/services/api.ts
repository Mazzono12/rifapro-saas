// /src/services/api.ts
// Arquitetura Clean: Todo o acesso externo passa por services estruturados
import { FazendinhaGroup, FazendinhaHomeMediaSettings, FazendinhaMediaSettings, FazendinhaPurchase, FazendinhaState, ModalidadesState, NumberModeId, NumberModeState, PromotionRule, PromotionSummary, Raffle } from '../types';

type CheckoutCustomerPayload = {
  name: string;
  phone: string;
  cpf: string;
  city?: string;
  state?: string;
  accessPassword?: string;
  browserId?: string;
};

export const raffleService = {
  // Num cenário Supabase, faríamos:
  // const { data } = await supabase.from('raffles').select('*').eq('status', 'active');
  // Por enquanto mantemos compatibilidade com o Express mockado e preparamos a assinatura local.
  
  async getRaffles() {
    const res = await fetch("/api/raffles");
    if (!res.ok) throw new Error("Falha ao buscar rifas");
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) throw new Error("Resposta invalida ao buscar rifas");
    const payload = await res.json();
    return Array.isArray(payload) ? payload as Raffle[] : [];
  },

  async getRaffleCatalog() {
    const res = await fetch("/api/public/raffles/catalog");
    if (!res.ok) throw new Error("Falha ao buscar sorteios");
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) throw new Error("Resposta invalida ao buscar sorteios");
    const payload = await res.json();
    return Array.isArray(payload) ? payload as Raffle[] : [];
  },

  async getRaffleById(id: string) {
    const res = await fetch(`/api/raffles/${id}`);
    if (!res.ok) throw new Error("Falha ao buscar detalhes da rifa");
    return res.json() as Promise<Raffle>;
  }
};

export const globalSettingsService = {
  async getSettings() {
    const res = await fetch("/api/settings");
    if (!res.ok) throw new Error("Falha ao carregar configurações");
    return res.json();
  }
};

export const checkoutService = {
  async preview(payload: Record<string, unknown>) {
    const res = await fetch("/api/checkout/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Nao foi possivel calcular o resumo da compra");
    return data as Promise<{
      quantity: number;
      total: number;
      subtotal: number;
      pixAmount: number;
      gateway: string;
      packageLabel?: string;
      bonuses?: {
        bonusTickets?: number;
        doubleTickets?: { applied: boolean; bonusTickets: number; minTickets?: number; label?: string };
        doubleChance?: boolean;
        roulettes?: number;
        lootboxes?: number;
        scratchcards?: number;
        description?: string;
      };
      walletUsage?: { enabled: boolean; amount: number };
      affiliateInfo?: { refCode?: string; name?: string };
      promotionSummary?: PromotionSummary;
      upsellOffer?: PromotionSummary["upsellOffer"];
      warnings?: string[];
    }>;
  },

  async checkPixPaymentStatus(orderId: string) {
    const res = await fetch(`/api/checkout/orders/${orderId}/status`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Nao foi possivel verificar o pagamento");
    return data as Promise<{
      orderId: string;
      type: "raffle" | "fazendinha" | "modalidade";
      status: "pending" | "paid" | "cancelled" | "expired" | "reserved";
      paymentStatus: "pending" | "paid" | "cancelled" | "expired";
      paid: boolean;
      expired: boolean;
      pixPayload?: string;
      pixExpiresAt?: string;
      reservedUntil?: string;
      purchase?: any;
      ticketUrl?: string;
      message: string;
    }>;
  }
};

export const promotionService = {
  async getAdminPromotions() {
    const res = await fetch("/api/admin/promotions");
    if (!res.ok) throw new Error("Falha ao carregar promoções");
    return res.json() as Promise<{ rules: PromotionRule[]; usages: unknown[]; stats: Record<string, unknown> }>;
  },

  async savePromotion(payload: Partial<PromotionRule>) {
    const method = payload.id ? "PUT" : "POST";
    const url = payload.id ? `/api/admin/promotions/${payload.id}` : "/api/admin/promotions";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao salvar promoção");
    return data as PromotionRule;
  },

  async duplicatePromotion(id: string) {
    const res = await fetch(`/api/admin/promotions/${id}/duplicate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Duplicacao de promocao pelo admin" }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao duplicar promoção");
    return data as PromotionRule;
  },

  async deletePromotion(id: string) {
    const res = await fetch(`/api/admin/promotions/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Exclusao logica de promocao pelo admin" }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao excluir promoção");
    return data;
  },

  async getPublicPromotions(raffleId?: string) {
    const query = raffleId ? `?raffleId=${encodeURIComponent(raffleId)}` : "";
    const res = await fetch(`/api/public/promotions${query}`);
    if (!res.ok) throw new Error("Falha ao carregar promoções públicas");
    return res.json() as Promise<{ rules: PromotionRule[]; ranking: Array<{ name: string; tickets: number; amount: number }>; badges: Array<{ label: string; type: string; promotionId: string }> }>;
  }
};

export const fazendinhaService = {
  async getState() {
    const res = await fetch("/api/fazendinha");
    if (!res.ok) throw new Error("Falha ao carregar A Fazendinha");
    return res.json() as Promise<FazendinhaState>;
  },

  async buyGroup(groupId: string, customer: CheckoutCustomerPayload, simulatePayment = true) {
    const res = await fetch(`/api/fazendinha/groups/${groupId}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer, simulatePayment })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao reservar bichinho");
    return data as { purchase: FazendinhaPurchase; group: FazendinhaGroup; pixPayload: string; earnedLootboxes: number };
  },

  async buyGroups(groupIds: string[], customer: CheckoutCustomerPayload, simulatePayment = true, addon?: { raffleId: string; tickets: number }) {
    const res = await fetch("/api/fazendinha/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupIds, customer, simulatePayment, addon })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao comprar bichinhos");
    return data as { purchase: FazendinhaPurchase; groups: FazendinhaGroup[]; pixPayload: string; earnedLootboxes: number };
  },

  async confirmPayment(purchaseId: string) {
    const res = await fetch(`/api/fazendinha/purchases/${purchaseId}/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao confirmar pagamento");
    return data as { purchase: FazendinhaPurchase; groups: FazendinhaGroup[]; pixPayload: string; earnedLootboxes: number };
  },

  async getAddonSuggestion() {
    const res = await fetch("/api/fazendinha/addon-suggestion");
    if (!res.ok) return null;
    return res.json() as Promise<{ raffle: Raffle; tickets: number; amount: number }>;
  },

  async getHomeMedia() {
    const res = await fetch("/api/public/fazendinha/home-media");
    if (!res.ok) throw new Error("Falha ao carregar mídia da Fazendinha");
    return res.json() as Promise<FazendinhaHomeMediaSettings>;
  },

  async getMediaSettings() {
    const res = await fetch("/api/public/fazendinha/media-settings");
    if (!res.ok) throw new Error("Falha ao carregar mídias da Fazendinha");
    return res.json() as Promise<FazendinhaMediaSettings>;
  },

  async getAdminState() {
    const res = await fetch("/api/admin/fazendinha");
    if (!res.ok) throw new Error("Falha ao carregar admin da Fazendinha");
    return res.json() as Promise<FazendinhaState>;
  },

  async getAdminHomeMedia() {
    const res = await fetch("/api/admin/fazendinha/home-media");
    if (!res.ok) throw new Error("Falha ao carregar mídia da Home da Fazendinha");
    return res.json() as Promise<FazendinhaHomeMediaSettings>;
  },

  async getAdminMediaSettings() {
    const res = await fetch("/api/admin/fazendinha/media-settings");
    if (!res.ok) throw new Error("Falha ao carregar mídias da Fazendinha");
    return res.json() as Promise<FazendinhaMediaSettings>;
  },

  async updateHomeMedia(config: Partial<FazendinhaHomeMediaSettings>) {
    const res = await fetch("/api/admin/fazendinha/home-media", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao salvar mídia da Home da Fazendinha");
    return data as FazendinhaHomeMediaSettings;
  },

  async updateMediaSettings(config: Partial<FazendinhaMediaSettings>) {
    const res = await fetch("/api/admin/fazendinha/media-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao salvar mídias da Fazendinha");
    return data as FazendinhaMediaSettings;
  },

  async updateConfig(config: Partial<FazendinhaState["config"]>) {
    const res = await fetch("/api/admin/fazendinha/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao salvar Fazendinha");
    return data;
  },

  async publishResult(numeroSorteado: string, origemResultado: string) {
    const res = await fetch("/api/admin/fazendinha/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numeroSorteado, origemResultado })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao apurar resultado");
    return data;
  },

  async resetRound() {
    const res = await fetch("/api/admin/fazendinha/reset", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao resetar rodada");
    return data;
  }
};

export const modalidadesService = {
  async getLanding() {
    const res = await fetch("/api/modalidades");
    if (!res.ok) throw new Error("Falha ao carregar modalidades");
    return res.json() as Promise<ModalidadesState>;
  },

  async getMode(mode: NumberModeId, customerId?: string) {
    const params = customerId ? `?customerId=${encodeURIComponent(customerId)}` : "";
    const res = await fetch(`/api/modalidades/${mode}${params}`);
    if (!res.ok) throw new Error("Falha ao carregar modalidade");
    return res.json() as Promise<NumberModeState>;
  },

  async buyMode(mode: NumberModeId, numbers: string[], customer: CheckoutCustomerPayload, simulatePayment = false) {
    const res = await fetch(`/api/modalidades/${mode}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numbers, customer, simulatePayment })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao comprar numeros");
    return data;
  },

  async confirmModePayment(purchaseId: string) {
    const res = await fetch(`/api/modalidades/purchases/${purchaseId}/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao confirmar pagamento da modalidade");
    return data;
  },

  async getAdminState() {
    const res = await fetch("/api/admin/modalidades");
    if (!res.ok) throw new Error("Falha ao carregar admin de modalidades");
    return res.json();
  },

  async updateNumberMode(mode: NumberModeId, config: Partial<NumberModeState["config"]>) {
    const res = await fetch(`/api/admin/modalidades/${mode}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao salvar modalidade");
    return data;
  },

  async publishOfficialResult(officialResult: string, origemResultado: string) {
    const res = await fetch("/api/admin/modalidades/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ officialResult, origemResultado })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao apurar resultado");
    return data;
  },

  async publishModeResult(mode: NumberModeId, resultNumber: string, origemResultado: string) {
    const res = await fetch(`/api/admin/modalidades/${mode}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultNumber, origemResultado })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao apurar resultado da modalidade");
    return data;
  }
};
