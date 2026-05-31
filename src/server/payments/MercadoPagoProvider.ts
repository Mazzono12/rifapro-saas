export type MercadoPagoEnvironment = "sandbox" | "production";

export type MercadoPagoProviderConfig = {
  accessToken: string;
  environment: MercadoPagoEnvironment;
  baseUrl?: string;
  timeoutMs?: number;
};

export type MercadoPagoPixPaymentPayload = {
  amount: number;
  description: string;
  externalReference: string;
  notificationUrl: string;
  payerEmail: string;
  payerFirstName: string;
  payerLastName?: string;
  payerDocument: string;
  idempotencyKey: string;
};

export type MercadoPagoPixData = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
};

export type MercadoPagoWebhookResult = {
  eventId: string;
  paymentId: string;
  type: string;
  action: string;
};

const MERCADOPAGO_BASE_URL = "https://api.mercadopago.com";

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeEmail(value: string) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "cliente@rifapro.local";
}

function splitName(value: string) {
  const parts = String(value || "Cliente").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Cliente",
    lastName: parts.slice(1).join(" ") || "RifaPro"
  };
}

export class MercadoPagoProvider {
  readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly timeoutMs: number;

  constructor(config: MercadoPagoProviderConfig) {
    this.accessToken = config.accessToken;
    this.baseUrl = (config.baseUrl || MERCADOPAGO_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = Math.max(2000, Number(config.timeoutMs || 12000));
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error("Access Token Mercado Pago nao configurado");
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            Authorization: `Bearer ${this.accessToken}`,
            ...(init.headers || {})
          },
          signal: init.signal || controller.signal
        });
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) {
          const message = data?.message || data?.error || data?.cause?.[0]?.description || `Mercado Pago respondeu HTTP ${response.status}`;
          if (response.status >= 500 && attempt === 0) {
            lastError = new Error(String(message));
            continue;
          }
          throw new Error(String(message));
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
    if (lastError instanceof Error && lastError.name === "AbortError") throw new Error("Timeout ao chamar Mercado Pago");
    throw lastError instanceof Error ? lastError : new Error("Falha ao chamar Mercado Pago");
  }

  async createPixPayment(payload: MercadoPagoPixPaymentPayload) {
    const names = splitName(`${payload.payerFirstName || ""} ${payload.payerLastName || ""}`);
    const amount = Number(Number(payload.amount || 0).toFixed(2));
    if (amount <= 0) throw new Error("transaction_amount Mercado Pago deve ser positivo");
    return this.request<Record<string, any>>("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": payload.idempotencyKey },
      body: JSON.stringify({
        transaction_amount: amount,
        payment_method_id: "pix",
        description: String(payload.description || "Compra de cotas").slice(0, 255),
        external_reference: String(payload.externalReference || "").slice(0, 100),
        notification_url: payload.notificationUrl,
        payer: {
          email: normalizeEmail(payload.payerEmail),
          first_name: names.firstName.slice(0, 60),
          last_name: names.lastName.slice(0, 60),
          identification: {
            type: onlyDigits(payload.payerDocument).length > 11 ? "CNPJ" : "CPF",
            number: onlyDigits(payload.payerDocument).slice(0, 14)
          }
        }
      })
    });
  }

  parsePixQrCode(payment: Record<string, any>): MercadoPagoPixData {
    const transactionData = payment?.point_of_interaction?.transaction_data || {};
    return {
      qrCode: String(transactionData.qr_code || ""),
      qrCodeBase64: String(transactionData.qr_code_base64 || ""),
      ticketUrl: String(transactionData.ticket_url || "")
    };
  }

  parsePaymentStatus(payment: Record<string, any>) {
    return String(payment?.status || "").toLowerCase();
  }

  getPaymentStatus(payment: Record<string, any>) {
    return this.parsePaymentStatus(payment);
  }

  async getPayment(paymentId: string) {
    return this.request<Record<string, any>>(`/v1/payments/${encodeURIComponent(paymentId)}`);
  }

  async reconcile(paymentId: string) {
    return this.getPayment(paymentId);
  }

  normalizePixPaymentResult(payment: Record<string, any>, expiration = "") {
    const qrCode = this.parsePixQrCode(payment);
    return {
      provider: "mercadopago",
      provider_payment_id: String(payment.id || ""),
      provider_reference: String(payment.external_reference || ""),
      pix_copy_paste: qrCode.qrCode,
      qr_code_base64: qrCode.qrCodeBase64,
      status: this.parsePaymentStatus(payment) || "pending",
      expiration: String(payment.date_of_expiration || expiration || "")
    };
  }

  async testConnection() {
    return this.request<Record<string, any>>("/users/me");
  }

  handleWebhook(payload: Record<string, any>): MercadoPagoWebhookResult {
    const data = payload.data && typeof payload.data === "object" ? payload.data : {};
    const paymentId = String(data.id || payload.id || payload.payment_id || payload.paymentId || payload["data.id"] || "");
    const type = String(payload.type || payload.topic || "payment");
    const action = String(payload.action || payload.status || "");
    return {
      eventId: String(payload.id || payload.notification_id || `${type}:${paymentId}:${action || "updated"}`),
      paymentId,
      type,
      action
    };
  }
}
