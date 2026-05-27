import { BaseProvider, ProviderContext, ProviderResult } from "../../core/BaseProvider";
import { providerCatalog } from "../catalog";

export class NuvendeProvider extends BaseProvider {
  id = "nuvenda" as const;
  type = "pix" as const;

  async validateCredentials(context: ProviderContext): Promise<ProviderResult> {
    const missing = providerCatalog.nuvenda.requiredCredentials.filter(key => !context.credentials[key]);
    if (missing.length) return { success: false, statusCode: 400, error: `Credenciais ausentes: ${missing.join(", ")}` };
    return {
      success: true,
      statusCode: 202,
      data: {
        provider: this.id,
        mode: context.sandbox ? "sandbox" : "production",
        baseUrl: context.sandbox ? providerCatalog.nuvenda.environments.sandbox : providerCatalog.nuvenda.environments.production,
        documentationStatus: providerCatalog.nuvenda.documentationStatus,
        homologationStatus: providerCatalog.nuvenda.homologationStatus,
        note: providerCatalog.nuvenda.notes
      }
    };
  }

  async createPixCharge(): Promise<ProviderResult> {
    return this.missing("createPixCharge");
  }

  async checkPaymentStatus(): Promise<ProviderResult> {
    return this.missing("checkPaymentStatus");
  }
}
