export type AsaasEnvironment = "sandbox" | "production";

export type AsaasProviderConfig = {
  apiKey: string;
  environment: AsaasEnvironment;
  userAgent: string;
};

export type AsaasCustomerPayload = {
  name: string;
  cpfCnpj: string;
  mobilePhone?: string;
  email?: string;
  externalReference?: string;
};

export type AsaasPixPaymentPayload = {
  customerId: string;
  value: number;
  dueDate: string;
  externalReference: string;
  description?: string;
};

export type AsaasWebhookResult = {
  eventId: string;
  eventType: string;
  paymentId: string;
  externalReference: string;
  status: string;
  shouldRelease: boolean;
};

const ASAAS_BASE_URLS: Record<AsaasEnvironment, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3"
};

export class AsaasProvider {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly userAgent: string;

  constructor(config: AsaasProviderConfig) {
    this.apiKey = config.apiKey;
    this.userAgent = config.userAgent || "RifaPro SaaS";
    this.baseUrl = ASAAS_BASE_URLS[config.environment] || ASAAS_BASE_URLS.sandbox;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.apiKey) throw new Error("API Key Asaas nao configurada");
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "access_token": this.apiKey,
        "user-agent": this.userAgent,
        ...(init.headers || {})
      }
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message = data?.errors?.[0]?.description || data?.message || `Asaas respondeu HTTP ${response.status}`;
      throw new Error(message);
    }
    return data as T;
  }

  async createCustomer(payload: AsaasCustomerPayload) {
    return this.request<Record<string, unknown>>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        cpfCnpj: payload.cpfCnpj,
        mobilePhone: payload.mobilePhone,
        email: payload.email,
        externalReference: payload.externalReference,
        notificationDisabled: true
      })
    });
  }

  async createPixPayment(payload: AsaasPixPaymentPayload) {
    return this.request<Record<string, unknown>>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: payload.customerId,
        "billingType": "PIX",
        value: payload.value,
        dueDate: payload.dueDate,
        externalReference: payload.externalReference,
        description: payload.description
      })
    });
  }

  async getPixQrCode(paymentId: string) {
    return this.request<{ encodedImage?: string; payload?: string; expirationDate?: string }>(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
  }

  async getPayment(paymentId: string) {
    return this.request<Record<string, unknown>>(`/payments/${encodeURIComponent(paymentId)}`);
  }

  async testConnection() {
    return this.request<Record<string, unknown>>("/myAccount");
  }

  handleWebhook(payload: Record<string, any>, releaseOn: "PAYMENT_RECEIVED" | "PAYMENT_CONFIRMED" = "PAYMENT_RECEIVED"): AsaasWebhookResult {
    const payment = payload.payment && typeof payload.payment === "object" ? payload.payment : {};
    const eventType = String(payload.event || payload.eventType || "");
    const status = String(payment.status || payload.status || eventType.replace(/^PAYMENT_/, "") || "").toUpperCase();
    const eventId = String(payload.id || payload.eventId || `${eventType}:${payment.id || payment.externalReference || ""}`);
    return {
      eventId,
      eventType,
      paymentId: String(payment.id || payload.paymentId || payload.id || ""),
      externalReference: String(payment.externalReference || payload.externalReference || ""),
      status,
      shouldRelease: eventType === releaseOn || status === releaseOn.replace("PAYMENT_", "")
    };
  }
}
