export type PrimepagEnvironment = "sandbox" | "staging" | "production";

export type PrimepagProviderConfig = {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  environment: PrimepagEnvironment;
  baseUrl?: string;
  timeoutMs?: number;
};

export type PrimepagPixPaymentPayload = {
  amount: number;
  generatorName: string;
  generatorDocument: string;
  externalReference: string;
  expirationTime: number;
};

export type PrimepagWebhookResult = {
  eventId: string;
  notificationType: string;
  referenceCode: string;
  externalReference: string;
  status: string;
  endToEnd: string;
  paymentDate: string;
  valueCents: number;
  shouldRelease: boolean;
};

type CachedToken = {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
};

const PRIMEPAG_BASE_URLS: Record<PrimepagEnvironment, string> = {
  sandbox: "https://api-stg.primepag.com.br",
  staging: "https://api-stg.primepag.com.br",
  production: "https://api.primepag.com.br"
};

const tokenCache = new Map<string, CachedToken>();

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "").slice(0, 14);
}

function toCents(value: number) {
  return Math.max(1, Math.round(Number(value || 0) * 100));
}

function clampExpiration(value: number) {
  return Math.max(1, Math.min(86400, Math.floor(Number(value || 1800))));
}

function normalizeStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function extractQrCode(raw: Record<string, any>) {
  const qrcode = raw.qrcode && typeof raw.qrcode === "object" ? raw.qrcode : raw;
  return {
    referenceCode: String(qrcode.reference_code || qrcode.referenceCode || raw.reference_code || ""),
    externalReference: String(qrcode.external_reference || qrcode.externalReference || raw.external_reference || ""),
    content: String(qrcode.content || qrcode.pix_copy_paste || qrcode.copy_paste || raw.content || ""),
    imageBase64: qrcode.image_base64 ? String(qrcode.image_base64) : ""
  };
}

export class PrimepagProvider {
  readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly staticAccessToken: string;
  private readonly environment: PrimepagEnvironment;
  private readonly timeoutMs: number;

  constructor(config: PrimepagProviderConfig) {
    this.clientId = config.clientId || "";
    this.clientSecret = config.clientSecret || "";
    this.staticAccessToken = config.accessToken || "";
    this.environment = config.environment || "staging";
    this.baseUrl = (config.baseUrl || PRIMEPAG_BASE_URLS[this.environment]).replace(/\/+$/, "");
    this.timeoutMs = Math.max(2000, Number(config.timeoutMs || 12000));
  }

  private cacheKey() {
    return `${this.environment}:${this.baseUrl}:${this.clientId}`;
  }

  private async request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const headers: Record<string, string> = {
          accept: "application/json",
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
          const message = data?.message || data?.error || data?.errors?.[0]?.message || `PrimePag respondeu HTTP ${response.status}`;
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
    if (lastError instanceof Error && lastError.name === "AbortError") throw new Error("Timeout ao chamar PrimePag");
    throw lastError instanceof Error ? lastError : new Error("Falha ao chamar PrimePag");
  }

  async getAccessToken() {
    if (this.staticAccessToken) {
      return { accessToken: this.staticAccessToken, tokenType: "Bearer", expiresAt: Date.now() + 3600_000 };
    }
    if (!this.clientId || !this.clientSecret) throw new Error("CLIENT_ID/CLIENT_SECRET PrimePag nao configurados");
    const key = this.cacheKey();
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached;
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`, "utf8").toString("base64");
    const data = await this.request<{ access_token: string; token_type?: string; expires_in?: number }>("/auth/generate_token", {
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

  async createPixPayment(payload: PrimepagPixPaymentPayload) {
    return this.request<Record<string, any>>("/v1/pix/qrcodes", {
      method: "POST",
      body: JSON.stringify({
        value_cents: toCents(payload.amount),
        generator_name: String(payload.generatorName || "Cliente").slice(0, 100),
        generator_document: onlyDigits(payload.generatorDocument),
        expiration_time: String(clampExpiration(payload.expirationTime)),
        external_reference: String(payload.externalReference || "").slice(0, 100)
      })
    });
  }

  getQrCode(raw: Record<string, any>) {
    return extractQrCode(raw);
  }

  async getPayment(referenceCode: string) {
    return this.request<Record<string, any>>(`/v1/pix/qrcodes/${encodeURIComponent(referenceCode)}`);
  }

  parseQrCodeStatus(raw: Record<string, any>) {
    const qrcode = raw.qrcode && typeof raw.qrcode === "object" ? raw.qrcode : raw;
    return normalizeStatus(qrcode.status || qrcode.payment_status || qrcode.situation || raw.status);
  }

  async registerWebhook(typeId: number, url: string, authorization: string) {
    return this.request<Record<string, any>>(`/v1/webhooks/${encodeURIComponent(String(typeId))}`, {
      method: "POST",
      body: JSON.stringify({
        url,
        authorization
      })
    });
  }

  async testConnection() {
    return this.getAccessToken();
  }

  handleWebhook(payload: Record<string, any>): PrimepagWebhookResult {
    const message = payload.message && typeof payload.message === "object" ? payload.message : payload.qrcode && typeof payload.qrcode === "object" ? payload.qrcode : payload;
    const referenceCode = String(message.reference_code || message.referenceCode || payload.reference_code || "");
    const status = normalizeStatus(message.status || message.payment_status || payload.status);
    const endToEnd = String(message.end_to_end || message.endToEnd || payload.end_to_end || "");
    const notificationType = String(payload.notification_type || payload.type || payload.event || "pix_qrcode");
    return {
      eventId: String(payload.event_id || payload.id || `${referenceCode}:${status}:${endToEnd || "no-e2e"}`),
      notificationType,
      referenceCode,
      externalReference: String(message.external_reference || message.externalReference || payload.external_reference || ""),
      status,
      endToEnd,
      paymentDate: String(message.payment_date || message.paid_at || payload.payment_date || ""),
      valueCents: Number(message.value_cents || message.value || payload.value_cents || 0),
      shouldRelease: ["paid", "pago", "completed", "confirmed", "settled"].includes(status)
    };
  }
}
