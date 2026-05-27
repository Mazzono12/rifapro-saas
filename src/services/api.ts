// /src/services/api.ts
// Arquitetura Clean: Todo o acesso externo passa por services estruturados
import { FazendinhaGroup, FazendinhaPurchase, FazendinhaState, ModalidadesState, NumberModeId, NumberModeState, Raffle } from '../types';

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
    return res.json() as Promise<Raffle[]>;
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

  async getAdminState() {
    const res = await fetch("/api/admin/fazendinha");
    if (!res.ok) throw new Error("Falha ao carregar admin da Fazendinha");
    return res.json() as Promise<FazendinhaState>;
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
