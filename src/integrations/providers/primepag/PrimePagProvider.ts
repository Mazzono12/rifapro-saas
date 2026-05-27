import { BaseProvider, ProviderContext, ProviderResult } from "../../core/BaseProvider";
import { providerCatalog } from "../catalog";

export class PrimePagProvider extends BaseProvider {
  id = "primepag" as const;
  type = "pix" as const;
  private attempts = new Map<string, number>();

  async validateCredentials(context: ProviderContext): Promise<ProviderResult> {
    const missing = ["clientId", "clientSecret"].filter(key => !context.credentials[key]);
    if (missing.length) return { success: false, statusCode: 400, error: `Credenciais ausentes: ${missing.join(", ")}` };
    return {
      success: true,
      statusCode: 202,
      data: {
        provider: this.id,
        mode: context.sandbox ? "sandbox" : "production",
        baseUrl: context.sandbox ? providerCatalog.primepag.environments.sandbox : providerCatalog.primepag.environments.production,
        documentationStatus: providerCatalog.primepag.documentationStatus,
        homologationStatus: providerCatalog.primepag.homologationStatus,
        note: providerCatalog.primepag.notes
      }
    };
  }

  async createPixCharge(context: ProviderContext, payload: Record<string, unknown>): Promise<ProviderResult> {
    await this.throwOnceWhenRequested(context, "createPixCharge");
    if (!context.settings.mock) return this.missing("createPixCharge");
    const reference = String(payload.purchaseId || payload.reference || `PPG-${Date.now()}`);
    return {
      success: true,
      statusCode: 201,
      data: {
        provider: this.id,
        reference,
        qrCode: `mock-primepag-qrcode-${reference}`,
        copyPaste: `000201MOCKPRIMEPAG${reference}`,
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

  private async throwOnceWhenRequested(context: ProviderContext, action: string) {
    const key = `${context.integrationId}:${action}`;
    const count = this.attempts.get(key) || 0;
    if (context.settings.failOnce && count === 0) {
      this.attempts.set(key, count + 1);
      throw new Error("Falha temporaria simulada para validar retry");
    }
    this.attempts.set(key, count + 1);
  }
}
