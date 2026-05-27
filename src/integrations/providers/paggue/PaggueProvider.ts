import { BaseProvider, ProviderContext, ProviderResult } from "../../core/BaseProvider";
import { providerCatalog } from "../catalog";

export class PaggueProvider extends BaseProvider {
  id = "paggue" as const;
  type = "pix" as const;

  async validateCredentials(context: ProviderContext): Promise<ProviderResult> {
    const missing = ["clientKey", "clientSecret"].filter(key => !context.credentials[key]);
    if (missing.length) return { success: false, statusCode: 400, error: `Credenciais ausentes: ${missing.join(", ")}` };
    return {
      success: true,
      statusCode: 202,
      data: {
        provider: this.id,
        mode: context.sandbox ? "sandbox" : "production",
        documentationStatus: providerCatalog.paggue.documentationStatus,
        homologationStatus: providerCatalog.paggue.homologationStatus,
        note: providerCatalog.paggue.notes
      }
    };
  }

  async createPixCharge(context: ProviderContext, payload: Record<string, unknown>): Promise<ProviderResult> {
    if (!context.settings.mock) return this.missing("createPixCharge");
    const reference = String(payload.purchaseId || payload.reference || `PAG-${Date.now()}`);
    return {
      success: true,
      statusCode: 201,
      data: {
        provider: this.id,
        reference,
        qrCode: `mock-paggue-qrcode-${reference}`,
        copyPaste: `000201MOCKPAGGUE${reference}`,
        amount: Number(payload.amount || 0)
      }
    };
  }

  async checkPaymentStatus(context: ProviderContext, payload: Record<string, unknown>): Promise<ProviderResult> {
    if (!context.settings.mock) return this.missing("checkPaymentStatus");
    return { success: true, statusCode: 200, data: { reference: payload.reference, paid: Boolean(payload.paid), status: payload.paid ? "paid" : "pending" } };
  }

  async processWebhook(context: ProviderContext, payload: Record<string, unknown>): Promise<ProviderResult> {
    return { success: true, statusCode: 200, data: { provider: this.id, tenantId: context.tenantId, event: payload } };
  }
}
