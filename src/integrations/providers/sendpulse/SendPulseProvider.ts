import { BaseProvider, ProviderContext, ProviderResult } from "../../core/BaseProvider";
import { providerCatalog } from "../catalog";

export class SendPulseProvider extends BaseProvider {
  id = "sendpulse" as const;
  type = "email" as const;

  async validateCredentials(context: ProviderContext): Promise<ProviderResult> {
    const hasApiKey = Boolean(context.credentials.apiKey);
    const hasOAuthPair = Boolean(context.credentials.clientId && context.credentials.clientSecret);
    if (!hasApiKey && !hasOAuthPair) {
      return { success: false, statusCode: 400, error: "Credenciais ausentes: apiKey ou clientId/clientSecret" };
    }
    return {
      success: true,
      statusCode: 202,
      data: {
        provider: this.id,
        mode: context.sandbox ? "sandbox" : "production",
        baseUrl: providerCatalog.sendpulse.environments.production,
        documentationStatus: providerCatalog.sendpulse.documentationStatus,
        homologationStatus: providerCatalog.sendpulse.homologationStatus,
        note: providerCatalog.sendpulse.notes
      }
    };
  }

  async sendEmail(context: ProviderContext, payload: Record<string, unknown>): Promise<ProviderResult> {
    if (context.settings.mock) {
      return { success: true, statusCode: 202, data: { provider: this.id, to: payload.to, subject: payload.subject, mocked: true } };
    }
    return this.missing("sendEmail");
  }
}
