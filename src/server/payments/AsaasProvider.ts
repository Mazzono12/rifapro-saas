export type AsaasEnvironment = "sandbox" | "production";

export type AsaasProviderConfig = {
  apiKey: string;
  environment: AsaasEnvironment;
  userAgent: string;
  timeoutMs?: number;
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

export class AsaasProviderError extends Error {
  readonly status?: number;
  readonly path?: string;
  readonly bodySummary?: string;
  readonly method?: string;

  constructor(message: string, details: { status?: number; path?: string; bodySummary?: string; method?: string } = {}) {
    super(message);
    this.name = "AsaasProviderError";
    this.status = details.status;
    this.path = details.path;
    this.bodySummary = details.bodySummary;
    this.method = details.method;
  }
}

function summarizeAsaasBody(data: unknown, fallback = "") {
  const value = data && typeof data === "object" ? data : fallback;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/access_token["']?\s*:\s*["'][^"']+["']/gi, 'access_token:"[masked]"').slice(0, 1200);
}

export class AsaasProvider {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;

  constructor(config: AsaasProviderConfig) {
    this.apiKey = config.apiKey;
    this.userAgent = config.userAgent || "CIFHER Plataforma";
    this.timeoutMs = Math.max(1000, Number(config.timeoutMs || 15000));
    this.baseUrl = ASAAS_BASE_URLS[config.environment] || ASAAS_BASE_URLS.sandbox;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.apiKey) throw new Error("API Key Asaas nao configurada");
    const headers = {
      "accept": "application/json",
      "content-type": "application/json",
      "access_token": this.apiKey,
      "user-agent": this.userAgent,
      ...(init.headers || {})
    };
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          headers,
          signal: init.signal || controller.signal
        });
        const text = await response.text();
        let data: Record<string, any> | string = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = text;
        }
        if (!response.ok) {
          const dataRecord = data && typeof data === "object" ? data as Record<string, any> : {};
          const message = dataRecord?.errors?.[0]?.description || dataRecord?.message || `Asaas respondeu HTTP ${response.status}`;
          const providerError = new AsaasProviderError(message, {
            status: response.status,
            path,
            method: String(init.method || "GET").toUpperCase(),
            bodySummary: summarizeAsaasBody(data, text)
          });
          if (response.status >= 500 && attempt === 0) {
            lastError = providerError;
            continue;
          }
          throw providerError;
        }
        return data as T;
      } catch (error) {
        lastError = error;
        if (attempt > 0) break;
        if (error instanceof Error && !["AbortError", "TypeError"].includes(error.name)) break;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Falha ao chamar Asaas");
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

  async reconcile(paymentId: string) {
    return this.getPayment(paymentId);
  }

  normalizePixPaymentResult(payment: Record<string, any>, qrCode: { encodedImage?: string; payload?: string; expirationDate?: string } = {}) {
    return {
      provider: "asaas",
      provider_payment_id: String(payment.id || ""),
      provider_reference: String(payment.externalReference || payment.id || ""),
      pix_copy_paste: String(qrCode.payload || payment.pix_copy_paste || ""),
      qr_code_base64: String(qrCode.encodedImage || payment.qr_code_base64 || ""),
      status: String(payment.status || "PENDING"),
      expiration: String(qrCode.expirationDate || payment.dueDate || "")
    };
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
