export type PagbankEnvironment = "sandbox" | "production";

export type PagbankProviderConfig = {
  token: string;
  environment: PagbankEnvironment;
  baseUrl?: string;
  timeoutMs?: number;
};

export type PagbankPixPaymentPayload = {
  referenceId: string;
  itemReferenceId: string;
  customerName: string;
  customerEmail?: string;
  customerTaxId: string;
  customerPhone?: string;
  itemName: string;
  amountInCents: number;
  expirationDate: string;
  notificationUrl?: string;
};

export type PagbankPixQrCode = {
  id: string;
  text: string;
  amountValue: number;
  expirationDate: string;
  imageUrl: string;
};

export type PagbankWebhookResult = {
  eventId: string;
  orderId: string;
  referenceId: string;
  status: string;
  endToEnd: string;
  shouldRelease: boolean;
};

const PAGBANK_BASE_URLS: Record<PagbankEnvironment, string> = {
  sandbox: "https://sandbox.api.pagseguro.com",
  production: "https://api.pagseguro.com"
};

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function phoneParts(phone?: string) {
  const digits = onlyDigits(phone || "");
  const withoutCountry = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  return {
    country: "55",
    area: withoutCountry.slice(0, 2) || "11",
    number: withoutCountry.slice(2, 13) || "999999999",
    type: "MOBILE"
  };
}

function normalizeStatus(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export class PagbankProvider {
  readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(config: PagbankProviderConfig) {
    this.token = config.token;
    this.baseUrl = (config.baseUrl || PAGBANK_BASE_URLS[config.environment] || PAGBANK_BASE_URLS.sandbox).replace(/\/+$/, "");
    this.timeoutMs = Math.max(2000, Number(config.timeoutMs || 12000));
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.token) throw new Error("Token PagBank nao configurado");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          Authorization: `Bearer ${this.token}`,
          ...(init.headers || {})
        },
        signal: controller.signal
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) {
        const message = data?.message || data?.error_messages?.[0]?.description || data?.error || `PagBank respondeu HTTP ${response.status}`;
        throw new Error(String(message));
      }
      return data as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("Timeout ao chamar PagBank");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async createPixPayment(payload: PagbankPixPaymentPayload) {
    const amountInCents = Math.max(1, Math.round(Number(payload.amountInCents || 0)));
    return this.request<Record<string, unknown>>("/orders", {
      method: "POST",
      body: JSON.stringify({
        reference_id: String(payload.referenceId || "").slice(0, 100),
        customer: {
          name: String(payload.customerName || "Cliente").slice(0, 100),
          email: payload.customerEmail || "cliente@rifapro.local",
          tax_id: onlyDigits(payload.customerTaxId).slice(0, 14),
          phones: [phoneParts(payload.customerPhone)]
        },
        items: [{
          reference_id: String(payload.itemReferenceId || payload.referenceId || "").slice(0, 100),
          name: String(payload.itemName || "Compra de cotas").slice(0, 100),
          quantity: 1,
          unit_amount: amountInCents
        }],
        qr_codes: [{
          amount: { value: amountInCents },
          expiration_date: payload.expirationDate
        }],
        notification_urls: payload.notificationUrl ? [payload.notificationUrl] : undefined
      })
    });
  }

  parsePixQrCode(order: Record<string, any>): PagbankPixQrCode {
    const qrCode = Array.isArray(order.qr_codes) ? order.qr_codes[0] || {} : {};
    const links = Array.isArray(qrCode.links) ? qrCode.links : [];
    const imageLink = links.find((link: Record<string, unknown>) => String(link.rel || "").toUpperCase().includes("QRCODE") || String(link.media || "").includes("image")) || links[0] || {};
    return {
      id: String(qrCode.id || ""),
      text: String(qrCode.text || qrCode.emv || qrCode.payload || ""),
      amountValue: Number(qrCode.amount?.value || 0),
      expirationDate: String(qrCode.expiration_date || ""),
      imageUrl: String(imageLink.href || qrCode.image || "")
    };
  }

  parseOrderStatus(order: Record<string, any>) {
    const charges = Array.isArray(order.charges) ? order.charges : [];
    const chargeStatus = normalizeStatus(charges[0]?.status);
    const orderStatus = normalizeStatus(order.status);
    const qrCode = Array.isArray(order.qr_codes) ? order.qr_codes[0] || {} : {};
    const qrStatus = normalizeStatus(qrCode.status);
    return chargeStatus || orderStatus || qrStatus || "UNKNOWN";
  }

  async getPayment(orderId: string) {
    return this.request<Record<string, unknown>>(`/orders/${encodeURIComponent(orderId)}`);
  }

  async testConnection() {
    return this.request<Record<string, unknown>>("/orders?page=0&size=1");
  }

  handleWebhook(payload: Record<string, any>): PagbankWebhookResult {
    const order = payload.order && typeof payload.order === "object" ? payload.order : payload;
    const orderId = String(order.id || payload.id || payload.order_id || payload.orderId || "");
    const referenceId = String(order.reference_id || payload.reference_id || payload.referenceId || "");
    const status = this.parseOrderStatus(order || payload);
    const charges = Array.isArray(order.charges) ? order.charges : [];
    const endToEnd = String(order.end_to_end || charges[0]?.payment_response?.reference || charges[0]?.payment_response?.raw_data?.end_to_end_id || "");
    const eventId = String(payload.id || payload.event_id || payload.notification_id || `${orderId || referenceId}:${status}:${endToEnd || "no-e2e"}`);
    return {
      eventId,
      orderId,
      referenceId,
      status,
      endToEnd,
      shouldRelease: ["PAID", "AUTHORIZED", "AVAILABLE", "COMPLETED"].includes(status)
    };
  }
}
