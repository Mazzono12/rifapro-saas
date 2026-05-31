import { request as httpsRequest } from "node:https";
import { URL } from "node:url";

export type CoraEnvironment = "sandbox" | "production";

export type CoraProviderConfig = {
  clientId: string;
  clientSecret?: string;
  certificate?: string;
  privateKey?: string;
  environment: CoraEnvironment;
  baseUrl?: string;
  tokenUrl?: string;
  timeoutMs?: number;
};

export type CoraPixPaymentPayload = {
  amount: number;
  customerName: string;
  customerEmail?: string;
  customerDocument: string;
  externalReference: string;
  description?: string;
  dueDate: string;
  notificationUrl?: string;
  idempotencyKey: string;
};

export type CoraWebhookResult = {
  eventId: string;
  providerPaymentId: string;
  txid: string;
  externalReference: string;
  status: string;
  endToEnd: string;
  shouldRelease: boolean;
};

type CachedToken = {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
};

const CORA_BASE_URLS: Record<CoraEnvironment, string> = {
  sandbox: "https://matls-clients.api.stage.cora.com.br",
  production: "https://matls-clients.api.cora.com.br"
};

const tokenCache = new Map<string, CachedToken>();

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "").slice(0, 14);
}

function normalizeEmail(value: string) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "cliente@rifapro.local";
}

function toCents(value: number) {
  return Math.max(1, Math.round(Number(value || 0) * 100));
}

function normalizeStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export class CoraProvider {
  readonly baseUrl: string;
  readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly certificate: string;
  private readonly privateKey: string;
  private readonly environment: CoraEnvironment;
  private readonly timeoutMs: number;

  constructor(config: CoraProviderConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret || "";
    this.certificate = config.certificate || "";
    this.privateKey = config.privateKey || "";
    this.environment = config.environment || "sandbox";
    this.baseUrl = (config.baseUrl || CORA_BASE_URLS[this.environment]).replace(/\/+$/, "");
    this.tokenUrl = (config.tokenUrl || `${this.baseUrl}/token`).replace(/\/+$/, "");
    this.timeoutMs = Math.max(2000, Number(config.timeoutMs || 12000));
  }

  private cacheKey() {
    return `${this.environment}:${this.baseUrl}:${this.clientId}`;
  }

  private assertMtlsCredentials() {
    if (!this.clientId) throw new Error("Client ID Cora nao configurado");
    if (!this.certificate || !this.privateKey) throw new Error("Certificado e chave privada Cora sao obrigatorios para Integracao Direta");
  }

  private async mtlsRequest(urlString: string, init: RequestInit, headers: Record<string, string>) {
    const url = new URL(urlString);
    const method = String(init.method || "GET").toUpperCase();
    const rawBody = init.body instanceof URLSearchParams ? init.body.toString() : typeof init.body === "string" ? init.body : init.body ? String(init.body) : "";
    const requestHeaders = {
      ...headers,
      ...(rawBody ? { "content-length": String(Buffer.byteLength(rawBody)) } : {})
    };
    return new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const req = httpsRequest({
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method,
        headers: requestHeaders,
        cert: this.certificate,
        key: this.privateKey,
        timeout: this.timeoutMs
      }, response => {
        const chunks: Buffer[] = [];
        response.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => resolve({
          statusCode: response.statusCode || 0,
          body: Buffer.concat(chunks).toString("utf8")
        }));
      });
      req.on("timeout", () => {
        const error = new Error("Timeout ao chamar Cora");
        error.name = "AbortError";
        req.destroy(error);
      });
      req.on("error", reject);
      if (rawBody) req.write(rawBody);
      req.end();
    });
  }

  private async request<T>(pathOrUrl: string, init: RequestInit = {}, authenticated = true): Promise<T> {
    this.assertMtlsCredentials();
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const headers: Record<string, string> = {
          accept: "application/json",
          ...(init.headers as Record<string, string> || {})
        };
        if (authenticated) {
          const token = await this.getAccessToken();
          headers.Authorization = `${token.tokenType} ${token.accessToken}`;
        }
        const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${this.baseUrl}${pathOrUrl}`;
        const response = await this.mtlsRequest(url, init, headers);
        const text = response.body;
        const data = text ? JSON.parse(text) : {};
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const message = data?.message || data?.error || data?.errors?.[0]?.message || `Cora respondeu HTTP ${response.statusCode}`;
          if (response.statusCode >= 500 && attempt === 0) {
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
      }
    }
    if (lastError instanceof Error && lastError.name === "AbortError") throw new Error("Timeout ao chamar Cora");
    throw lastError instanceof Error ? lastError : new Error("Falha ao chamar Cora");
  }

  async getAccessToken() {
    this.assertMtlsCredentials();
    const key = this.cacheKey();
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached;
    const body = new URLSearchParams();
    body.set("grant_type", "client_credentials");
    body.set("client_id", this.clientId);
    if (this.clientSecret) body.set("client_secret", this.clientSecret);
    const data = await this.request<{ access_token: string; token_type?: string; expires_in?: number }>(this.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    }, false);
    const token: CachedToken = {
      accessToken: data.access_token,
      tokenType: data.token_type || "Bearer",
      expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 86400) - 60) * 1000
    };
    tokenCache.set(key, token);
    return token;
  }

  async createPixPayment(payload: CoraPixPaymentPayload) {
    return this.request<Record<string, any>>("/v2/invoices/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": payload.idempotencyKey
      },
      body: JSON.stringify({
        code: String(payload.externalReference || "").slice(0, 100),
        customer: {
          name: String(payload.customerName || "Cliente").slice(0, 60),
          email: normalizeEmail(payload.customerEmail || ""),
          document: {
            identity: onlyDigits(payload.customerDocument),
            type: onlyDigits(payload.customerDocument).length > 11 ? "CNPJ" : "CPF"
          }
        },
        services: [{
          name: String(payload.description || "Compra de cotas").slice(0, 100),
          description: String(payload.description || "Compra de cotas").slice(0, 250),
          amount: toCents(payload.amount)
        }],
        payment_terms: {
          due_date: payload.dueDate
        },
        ...(payload.notificationUrl ? {
          notification: {
            channels: [{
              channel: "WEBHOOK",
              contact: payload.notificationUrl
            }]
          }
        } : {}),
        payment_forms: ["PIX"]
      })
    });
  }

  getPixQrCode(invoice: Record<string, any>) {
    const pix = invoice.pix || invoice.payment_options?.pix || invoice.qr_code || {};
    return {
      emv: String(invoice.emv || pix.emv || pix.qr_code || pix.payload || invoice.pix_copy_paste || ""),
      base64: String(pix.encoded_image || pix.qr_code_base64 || pix.image_base64 || invoice.qr_code_base64 || ""),
      txid: String(invoice.txid || pix.txid || invoice.id || invoice.code || ""),
      id: String(invoice.id || invoice.invoice_id || invoice.code || "")
    };
  }

  parsePaymentStatus(invoice: Record<string, any>) {
    return normalizeStatus(invoice.status || invoice.payment_status || invoice.payment?.status || invoice.event_type);
  }

  async getPayment(providerPaymentId: string) {
    return this.request<Record<string, any>>(`/v2/invoices/${encodeURIComponent(providerPaymentId)}`);
  }

  async testConnection() {
    return this.getAccessToken();
  }

  handleWebhook(payload: Record<string, any>): CoraWebhookResult {
    const invoice = payload.invoice && typeof payload.invoice === "object" ? payload.invoice : payload;
    const providerPaymentId = String(invoice.id || invoice.invoice_id || payload.invoice_id || payload.id || "");
    const txid = String(invoice.txid || payload.txid || "");
    const externalReference = String(invoice.code || invoice.external_reference || payload.code || payload.external_reference || "");
    const status = this.parsePaymentStatus(invoice);
    const endToEnd = String(invoice.end_to_end || invoice.endToEnd || payload.end_to_end || "");
    return {
      eventId: String(payload.event_id || payload.id || `${providerPaymentId || txid}:${status}:${endToEnd || "no-e2e"}`),
      providerPaymentId,
      txid,
      externalReference,
      status,
      endToEnd,
      shouldRelease: ["paid", "confirmed", "received", "settled"].includes(status)
    };
  }
}
