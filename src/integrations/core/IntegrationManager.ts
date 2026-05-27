import { BaseProvider, IntegrationProviderId, ProviderContext, ProviderResult } from "./BaseProvider";
import { CredentialVault } from "./CredentialVault";
import { RetryService } from "./RetryService";

export type IntegrationStatus = "active" | "inactive" | "error" | "pending_config";

export type IntegrationRecord = {
  id: string;
  tenant_id: string;
  provider: IntegrationProviderId;
  type: string;
  status: IntegrationStatus;
  name: string;
  encrypted_credentials: string;
  settings: Record<string, unknown>;
  last_sync_at: string;
  last_error: string;
  created_at: string;
  updated_at: string;
};

export type IntegrationLogRecord = {
  id: string;
  tenant_id: string;
  integration_id: string;
  provider: IntegrationProviderId;
  action: string;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown>;
  status_code: number;
  success: boolean;
  error_message: string;
  created_at: string;
};

export class IntegrationManager {
  private providers = new Map<IntegrationProviderId, BaseProvider>();
  private vault: CredentialVault;
  private retry: RetryService;

  constructor(options: { vault?: CredentialVault; retry?: RetryService } = {}) {
    this.vault = options.vault || new CredentialVault();
    this.retry = options.retry || new RetryService();
  }

  register(provider: BaseProvider) {
    this.providers.set(provider.id, provider);
    return this;
  }

  maskIntegration(integration: IntegrationRecord) {
    const credentials = this.vault.decrypt(integration.encrypted_credentials);
    return {
      ...integration,
      encrypted_credentials: undefined,
      credentials: this.vault.mask(credentials)
    };
  }

  context(integration: IntegrationRecord): ProviderContext {
    return {
      tenantId: integration.tenant_id,
      integrationId: integration.id,
      provider: integration.provider,
      credentials: this.vault.decrypt(integration.encrypted_credentials),
      settings: integration.settings || {},
      sandbox: Boolean(integration.settings?.sandbox)
    };
  }

  encryptCredentials(credentials: Record<string, unknown>) {
    return this.vault.encrypt(credentials);
  }

  async execute(
    integration: IntegrationRecord,
    action: keyof BaseProvider,
    payload: Record<string, unknown> = {},
    writeLog: (log: Omit<IntegrationLogRecord, "id" | "created_at">) => void
  ): Promise<ProviderResult> {
    if (!integration.tenant_id) return { success: false, statusCode: 400, error: "tenant_id obrigatorio" };
    if (integration.status !== "active" && action !== "validateCredentials" && action !== "getHealthStatus") {
      const result = { success: false, statusCode: 409, error: "Integracao inativa ou pendente" };
      writeLog(this.logShape(integration, String(action), payload, result));
      return result;
    }
    const provider = this.providers.get(integration.provider);
    if (!provider) {
      const result = { success: false, statusCode: 404, error: "Provider nao registrado" };
      writeLog(this.logShape(integration, String(action), payload, result));
      return result;
    }
    try {
      const method = provider[action] as unknown;
      if (typeof method !== "function") throw new Error(`Acao ${String(action)} indisponivel`);
      const result = await this.retry.run<ProviderResult>(() => method.call(provider, this.context(integration), payload) as Promise<ProviderResult>);
      writeLog(this.logShape(integration, String(action), payload, result));
      return result;
    } catch (error) {
      const result = { success: false, statusCode: 500, error: error instanceof Error ? error.message : "Falha desconhecida" };
      writeLog(this.logShape(integration, String(action), payload, result));
      return result;
    }
  }

  private logShape(integration: IntegrationRecord, action: string, payload: Record<string, unknown>, result: ProviderResult): Omit<IntegrationLogRecord, "id" | "created_at"> {
    return {
      tenant_id: integration.tenant_id,
      integration_id: integration.id,
      provider: integration.provider,
      action,
      request_payload: this.sanitize(payload),
      response_payload: this.sanitize((result.data as Record<string, unknown>) || {}),
      status_code: result.statusCode || (result.success ? 200 : 500),
      success: Boolean(result.success),
      error_message: result.error || ""
    };
  }

  private sanitize(payload: Record<string, unknown>) {
    const secretKeys = ["token", "secret", "key", "password", "authorization", "access_token", "client_secret"];
    return JSON.parse(JSON.stringify(payload || {}, (key, value) => secretKeys.some(item => key.toLowerCase().includes(item)) ? "***" : value));
  }
}
