export type IntegrationProviderId =
  | "primepag"
  | "nuvenda"
  | "fkeProcessor"
  | "sendpulse"
  | "paggue"
  | "cashPay"
  | "wetalkie"
  | "smtp"
  | "metaAds"
  | "googleAds";

export type IntegrationType = "pix" | "email" | "whatsapp" | "ads" | "generic";

export type ProviderContext = {
  tenantId: string;
  integrationId: string;
  provider: IntegrationProviderId;
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
  sandbox?: boolean;
};

export type ProviderResult<T = unknown> = {
  success: boolean;
  statusCode?: number;
  data?: T;
  error?: string;
};

export abstract class BaseProvider {
  abstract id: IntegrationProviderId;
  abstract type: IntegrationType;

  protected missing(method: string): ProviderResult {
    return { success: false, statusCode: 501, error: `${this.id}.${method} nao implementado: documentacao oficial/endpoints necessarios.` };
  }

  async validateCredentials(_context: ProviderContext): Promise<ProviderResult> { return this.missing("validateCredentials"); }
  async createPixCharge(_context: ProviderContext, _payload: Record<string, unknown>): Promise<ProviderResult> { return this.missing("createPixCharge"); }
  async checkPaymentStatus(_context: ProviderContext, _payload: Record<string, unknown>): Promise<ProviderResult> { return this.missing("checkPaymentStatus"); }
  async processWebhook(_context: ProviderContext, payload: Record<string, unknown>): Promise<ProviderResult> { return { success: true, data: payload }; }
  async sendMessage(_context: ProviderContext, _payload: Record<string, unknown>): Promise<ProviderResult> { return this.missing("sendMessage"); }
  async sendEmail(_context: ProviderContext, _payload: Record<string, unknown>): Promise<ProviderResult> { return this.missing("sendEmail"); }
  async sendConversionEvent(_context: ProviderContext, _payload: Record<string, unknown>): Promise<ProviderResult> { return this.missing("sendConversionEvent"); }
  async getHealthStatus(context: ProviderContext): Promise<ProviderResult> { return this.validateCredentials(context); }
}
