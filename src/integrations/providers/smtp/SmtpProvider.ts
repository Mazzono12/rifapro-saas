import { BaseProvider, ProviderContext, ProviderResult } from "../../core/BaseProvider";

export class SmtpProvider extends BaseProvider {
  id = "smtp" as const;
  type = "email" as const;

  async validateCredentials(context: ProviderContext): Promise<ProviderResult> {
    const missing = ["host", "port", "username", "password", "from"].filter(key => !context.credentials[key]);
    if (missing.length) return { success: false, statusCode: 400, error: `Credenciais ausentes: ${missing.join(", ")}` };
    return { success: true, statusCode: 200, data: { provider: this.id, mode: context.sandbox ? "sandbox" : "production", host: context.credentials.host, from: context.credentials.from } };
  }

  async sendEmail(context: ProviderContext, payload: Record<string, unknown>): Promise<ProviderResult> {
    if (!context.settings.mock) return this.missing("sendEmail");
    return { success: true, statusCode: 202, data: { provider: this.id, to: payload.to, subject: payload.subject, mocked: true } };
  }
}
