import type { WhatsAppProviderMessage } from "./mockWhatsAppProvider";

export type MetaCloudWhatsAppConfig = {
  enabled: boolean;
  environment: "sandbox" | "production";
  account_name?: string;
  business_manager_id?: string;
  phone_number_id?: string;
  whatsapp_business_account_id?: string;
  business_account_id?: string;
  access_token?: string;
  webhook_verify_token?: string;
  webhook_url?: string;
  default_language?: string;
  template_namespace?: string;
};

export type MetaWhatsAppCloudProviderLogInput = {
  action: string;
  status: "success" | "error" | "skipped";
  message?: string;
  metadata?: Record<string, unknown>;
};

export type MetaWhatsAppCloudProviderOptions = {
  fetchImpl?: typeof fetch;
  log?: (entry: MetaWhatsAppCloudProviderLogInput) => void;
};

export class MetaWhatsAppCloudProvider {
  private readonly config: MetaCloudWhatsAppConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly log?: (entry: MetaWhatsAppCloudProviderLogInput) => void;

  constructor(config: MetaCloudWhatsAppConfig, options: MetaWhatsAppCloudProviderOptions = {}) {
    this.config = config;
    this.fetchImpl = options.fetchImpl || fetch;
    this.log = options.log;
  }

  private get graphVersion() {
    return "v20.0";
  }

  private requireCredentials(scope: "phone" | "templates" | "connection") {
    if (!this.config.enabled) throw new Error("WhatsApp Cloud desativado");
    if (!this.config.access_token) throw new Error("Token de acesso nao configurado");
    if ((scope === "phone" || scope === "connection") && !this.config.phone_number_id) {
      throw new Error("ID do numero de telefone nao configurado");
    }
    if (scope === "templates" && !this.config.whatsapp_business_account_id && !this.config.business_account_id) {
      throw new Error("ID da Conta WhatsApp Business nao configurado");
    }
  }

  private async graphGet(path: string) {
    const response = await this.fetchImpl(`https://graph.facebook.com/${this.graphVersion}/${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.config.access_token || ""}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `Meta API retornou HTTP ${response.status}`);
    return data;
  }

  async testConnection() {
    this.requireCredentials("connection");
    const data = await this.graphGet(`${this.config.phone_number_id}?fields=id,display_phone_number,verified_name,quality_rating`);
    this.log?.({ action: "test_connection", status: "success", metadata: { phoneNumberId: data?.id || "" } });
    return { ok: true, data };
  }

  async getPhoneNumberInfo() {
    this.requireCredentials("phone");
    const data = await this.graphGet(`${this.config.phone_number_id}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`);
    this.log?.({ action: "phone_info", status: "success", metadata: { phoneNumberId: data?.id || "" } });
    return data;
  }

  async listTemplates() {
    this.requireCredentials("templates");
    const businessAccountId = this.config.whatsapp_business_account_id || this.config.business_account_id;
    const data = await this.graphGet(`${businessAccountId}/message_templates?fields=name,language,status,category`);
    this.log?.({ action: "list_templates", status: "success", metadata: { count: Array.isArray(data?.data) ? data.data.length : 0 } });
    return Array.isArray(data?.data) ? data.data : [];
  }

  validateWebhook(query: Record<string, unknown>) {
    const mode = String(query["hub.mode"] || "");
    const token = String(query["hub.verify_token"] || "");
    const challenge = String(query["hub.challenge"] || "");
    const valid = mode === "subscribe" && Boolean(this.config.webhook_verify_token) && token === this.config.webhook_verify_token;
    this.log?.({ action: "webhook_validate", status: valid ? "success" : "error", metadata: { mode } });
    return { valid, challenge };
  }

  handleWebhook(payload: unknown) {
    const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const entries = Array.isArray(body.entry) ? body.entry : [];
    this.log?.({ action: "webhook_received", status: "success", metadata: { entries: entries.length } });
    return { ok: true, entries: entries.length };
  }
}

export async function sendMetaCloudWhatsAppMessage(message: WhatsAppProviderMessage, config: MetaCloudWhatsAppConfig) {
  if (!config.enabled) throw new Error("WhatsApp Meta Cloud desativado para este tenant");
  if (config.environment === "production" && process.env.WHATSAPP_ENABLE_PRODUCTION_SEND !== "true") {
    throw new Error("Envio WhatsApp em producao bloqueado sem WHATSAPP_ENABLE_PRODUCTION_SEND=true");
  }
  if (!config.phone_number_id || !config.access_token) {
    throw new Error("Credenciais Meta Cloud incompletas");
  }

  const endpoint = `https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: message.to,
      type: "text",
      text: {
        preview_url: true,
        body: message.body
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Meta Cloud retornou HTTP ${response.status}`);
  }
  return {
    ok: true,
    providerMessageId: data?.messages?.[0]?.id || ""
  };
}
