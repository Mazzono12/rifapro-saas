import { BaseProvider, IntegrationProviderId, IntegrationType, ProviderContext, ProviderResult } from "../../core/BaseProvider";

export class PlaceholderProvider extends BaseProvider {
  constructor(public id: IntegrationProviderId, public type: IntegrationType, private requiredCredentials: string[], private note: string) {
    super();
  }

  async validateCredentials(context: ProviderContext): Promise<ProviderResult> {
    const missing = this.requiredCredentials.filter(key => !context.credentials[key]);
    if (missing.length) {
      return { success: false, statusCode: 400, error: `Credenciais ausentes: ${missing.join(", ")}. ${this.note}` };
    }
    return { success: true, statusCode: 202, data: { status: "pending_config", note: this.note } };
  }

  async getHealthStatus(context: ProviderContext): Promise<ProviderResult> {
    return this.validateCredentials(context);
  }
}
