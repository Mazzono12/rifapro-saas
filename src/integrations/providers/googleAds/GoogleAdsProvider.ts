import { BaseProvider, ProviderContext, ProviderResult } from "../../core/BaseProvider";
import { providerCatalog } from "../catalog";

export class GoogleAdsProvider extends BaseProvider {
  id = "googleAds" as const;
  type = "ads" as const;

  async validateCredentials(context: ProviderContext): Promise<ProviderResult> {
    const required = ["customerId", "conversionActionId", "developerToken", "clientId", "clientSecret", "refreshToken"];
    const missing = required.filter(key => !context.credentials[key]);
    if (missing.length) return { success: false, statusCode: 400, error: `Credenciais ausentes: ${missing.join(", ")}` };
    return {
      success: true,
      statusCode: 200,
      data: {
        provider: this.id,
        mode: context.sandbox ? "sandbox" : "production",
        customerId: context.credentials.customerId,
        documentationStatus: providerCatalog.googleAds.documentationStatus,
        note: providerCatalog.googleAds.notes
      }
    };
  }

  async sendConversionEvent(context: ProviderContext, payload: Record<string, unknown>): Promise<ProviderResult> {
    if (context.settings.mock) {
      return { success: true, statusCode: 200, data: { provider: this.id, eventName: payload.eventName, mocked: true } };
    }
    return this.missing("sendConversionEvent");
  }
}
