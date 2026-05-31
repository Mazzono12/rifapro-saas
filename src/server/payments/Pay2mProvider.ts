export type Pay2mEnvironment = "sandbox" | "production";

export type Pay2mProviderConfig = {
  clientId: string;
  clientSecret: string;
  environment: Pay2mEnvironment;
  baseUrl?: string;
  timeoutMs?: number;
};

export type Pay2mPixPaymentPayload = {
  value: number;
  generatorName: string;
  generatorDocument: string;
  externalReference: string;
  expirationTime: number;
  payerMessage?: string;
  splitLink?: string;
};

export type Pay2mWebhookResult = {
  eventId: string;
  notificationType: string;
  referenceCode: string;
  externalReference: string;
  status: "awaiting_payment" | "paid" | "expired" | "canceled" | string;
  endToEnd: string;
  shouldRelease: boolean;
};

type CachedToken = {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
};

const PAY2M_BASE_URL = "https://portal.pay2m.com.br";
const tokenCache = new Map<string, CachedToken>();

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "").slice(0, 14);
}

function clampExpiration(value: number) {
  return Math.max(1, Math.min(3600, Math.floor(Number(value || 1800))));
}

export class Pay2mProvider {
  readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly environment: Pay2mEnvironment;
  private readonly timeoutMs: number;

  constructor(config: Pay2mProviderConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.environment = config.environment || "production";
    this.baseUrl = (config.baseUrl || PAY2M_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = Math.max(2000, Number(config.timeoutMs || 12000));
  }

  private cacheKey() {
    return `${this.environment}:${this.baseUrl}:${this.clientId}`;
  }

  private async request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        ...(init.headers as Record<string, string> || {})
      };
      if (authenticated) {
        const token = await this.getAccessToken();
        headers.Authorization = `${token.tokenType} ${token.accessToken}`;
      }
      const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers, signal: controller.signal });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) {
        const message = data?.error || data?.message || `Pay2M respondeu HTTP ${response.status}`;
        throw new Error(String(message));
      }
      return data as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("Timeout ao chamar Pay2M");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async getAccessToken() {
    if (!this.clientId || !this.clientSecret) throw new Error("CLIENT_ID/CLIENT_SECRET Pay2M nao configurados");
    const key = this.cacheKey();
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached;
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`, "utf8").toString("base64");
    const data = await this.request<{ access_token: string; token_type: string; expires_in: number }>("/api/auth/generate_token", {
      method: "POST",
      headers: { Authorization: `Basic ${basic}` },
      body: JSON.stringify({ grant_type: "client_credentials" })
    }, false);
    const token: CachedToken = {
      accessToken: data.access_token,
      tokenType: data.token_type || "Bearer",
      expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 1800) - 60) * 1000
    };
    tokenCache.set(key, token);
    return token;
  }

  async createPixPayment(payload: Pay2mPixPaymentPayload) {
    return this.request<{ reference_code: string; content: string }>("/api/v1/pix/qrcode", {
      method: "POST",
      body: JSON.stringify({
        value: Number(payload.value.toFixed(2)),
        generator_name: String(payload.generatorName || "").slice(0, 100),
        generator_document: onlyDigits(payload.generatorDocument),
        external_reference: String(payload.externalReference || "").slice(0, 100),
        expiration_time: clampExpiration(payload.expirationTime),
        payer_message: payload.payerMessage ? String(payload.payerMessage).slice(0, 100) : undefined,
        split_link: payload.splitLink || undefined
      })
    });
  }

  async getPixQrCode(referenceCode: string) {
    return this.getPayment(referenceCode);
  }

  async getPayment(referenceCode: string) {
    return this.request<Record<string, unknown>>(`/api/v1/pix/qrcode/${encodeURIComponent(referenceCode)}`);
  }

  async testConnection() {
    return this.getAccessToken();
  }

  handleWebhook(payload: Record<string, any>): Pay2mWebhookResult {
    const message = payload.message && typeof payload.message === "object" ? payload.message : {};
    const notificationType = String(payload.notification_type || "");
    const status = String(message.status || "").toLowerCase();
    const referenceCode = String(message.reference_code || "");
    const externalReference = String(message.external_reference || "");
    const endToEnd = String(message.end_to_end || "");
    return {
      eventId: `${referenceCode}:${status}:${endToEnd || "no-e2e"}`,
      notificationType,
      referenceCode,
      externalReference,
      status,
      endToEnd,
      shouldRelease: notificationType === "PIX:QRCODE" && status === "paid"
    };
  }
}
