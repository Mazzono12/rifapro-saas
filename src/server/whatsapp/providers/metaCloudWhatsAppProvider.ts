import type { WhatsAppProviderMessage } from "./mockWhatsAppProvider";

export type MetaCloudWhatsAppConfig = {
  enabled: boolean;
  environment: "sandbox" | "production";
  phone_number_id?: string;
  access_token?: string;
  default_language?: string;
  template_namespace?: string;
};

export async function sendMetaCloudWhatsAppMessage(message: WhatsAppProviderMessage, config: MetaCloudWhatsAppConfig) {
  if (!config.enabled) throw new Error("WhatsApp Meta Cloud desativado para este tenant");
  if (config.environment === "production" && process.env.WHATSAPP_ENABLE_PRODUCTION_SEND !== "true") {
    throw new Error("Envio WhatsApp em producao bloqueado sem WHATSAPP_ENABLE_PRODUCTION_SEND=true");
  }
  if (!config.phone_number_id || !config.access_token) {
    throw new Error("Credenciais Meta Cloud incompletas");
  }

  const endpoint = `https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: message.to,
      type: "text",
      text: {
        preview_url: true,
        body: message.body
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Meta Cloud retornou HTTP ${response.status}`);
  }
  return {
    ok: true,
    providerMessageId: data?.messages?.[0]?.id || ""
  };
}
