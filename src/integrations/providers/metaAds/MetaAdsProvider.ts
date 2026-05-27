import { BaseProvider, ProviderContext, ProviderResult } from "../../core/BaseProvider";
import { providerCatalog } from "../catalog";

export class MetaAdsProvider extends BaseProvider {
  id = "metaAds" as const;
  type = "ads" as const;

  async validateCredentials(context: ProviderContext): Promise<ProviderResult> {
    const missing = ["pixelId", "accessToken"].filter(key => !context.credentials[key]);
    if (missing.length) return { success: false, statusCode: 400, error: `Credenciais ausentes: ${missing.join(", ")}` };
    return {
      success: true,
      statusCode: 200,
      data: {
        provider: this.id,
        mode: context.sandbox ? "sandbox" : "production",
        pixelId: context.credentials.pixelId,
        apiVersion: context.settings.apiVersion || providerCatalog.metaAds.defaultSettings.apiVersion,
        documentationStatus: providerCatalog.metaAds.documentationStatus
      }
    };
  }

  async sendConversionEvent(context: ProviderContext, payload: Record<string, unknown>): Promise<ProviderResult> {
    if (context.settings.mock) {
      return { success: true, statusCode: 200, data: { provider: this.id, eventName: payload.eventName, mocked: true } };
    }
    if (!context.settings.apiVersion) return { success: false, statusCode: 400, error: "Configure settings.apiVersion oficial da Meta Graph API" };
    return this.missing("sendConversionEvent");
  }
}
