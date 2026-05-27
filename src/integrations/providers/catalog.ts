import { IntegrationProviderId, IntegrationType } from "../core/BaseProvider";

export type ProviderCatalogEntry = {
  provider: IntegrationProviderId;
  type: IntegrationType;
  label: string;
  documentationStatus: "official_public" | "official_portal" | "missing";
  homologationStatus: "ready" | "partial" | "placeholder";
  requiredCredentials: string[];
  optionalCredentials?: string[];
  defaultSettings: Record<string, unknown>;
  environments: {
    sandbox?: string;
    production?: string;
  };
  docs: string[];
  webhookValidation: "shared_secret" | "hmac_sha256" | "provider_specific" | "none";
  notes: string;
};

export const providerCatalog: Record<IntegrationProviderId, ProviderCatalogEntry> = {
  primepag: {
    provider: "primepag",
    type: "pix",
    label: "PrimePag",
    documentationStatus: "official_public",
    homologationStatus: "partial",
    requiredCredentials: ["clientId", "clientSecret"],
    optionalCredentials: ["webhookUsername", "webhookPassword"],
    defaultSettings: { sandbox: true, mock: true },
    environments: {
      sandbox: "https://api-stg.primepag.com.br",
      production: "https://api.primepag.com.br"
    },
    docs: [
      "https://developers-stg.primepag.com.br/docs/getting-started/authentication",
      "https://developers-stg.primepag.com.br/en/docs/getting-started/authentication"
    ],
    webhookValidation: "provider_specific",
    notes: "Documentacao oficial confirma OAuth2 e URLs sandbox/producao. Endpoints PIX devem ser homologados com credenciais PrimePag antes de chamadas reais."
  },
  paggue: {
    provider: "paggue",
    type: "pix",
    label: "Paggue",
    documentationStatus: "official_portal",
    homologationStatus: "placeholder",
    requiredCredentials: ["clientKey", "clientSecret"],
    defaultSettings: { sandbox: true, mock: true },
    environments: {},
    docs: [
      "https://paggue.io/venda-via-pix-no-seu-site/",
      "https://blog.paggue.io/como-criar-as-credenciais-da-api-pix-web-paggue/"
    ],
    webhookValidation: "shared_secret",
    notes: "Ha indicacao oficial de API e credenciais via portal Paggue, mas a referencia publica de endpoints nao foi encontrada. Manter placeholder ate receber documentacao/API Pix Web do portal."
  },
  cashPay: {
    provider: "cashPay",
    type: "pix",
    label: "Cash Pay",
    documentationStatus: "missing",
    homologationStatus: "placeholder",
    requiredCredentials: ["apiKey"],
    defaultSettings: { sandbox: true, mock: true },
    environments: {},
    docs: [],
    webhookValidation: "shared_secret",
    notes: "Documentacao oficial publica nao confirmada. Necessario endpoint base, autenticacao, criar cobranca PIX, consulta, cancelamento/estorno e contrato de webhook."
  },
  fkeProcessor: {
    provider: "fkeProcessor",
    type: "pix",
    label: "Fke Processor",
    documentationStatus: "missing",
    homologationStatus: "placeholder",
    requiredCredentials: ["apiKey"],
    defaultSettings: { sandbox: true, mock: true },
    environments: {},
    docs: [],
    webhookValidation: "shared_secret",
    notes: "Documentacao oficial publica nao confirmada. Necessario endpoint base, autenticacao, criar cobranca PIX, consulta, cancelamento/estorno e contrato de webhook."
  },
  nuvenda: {
    provider: "nuvenda",
    type: "pix",
    label: "Nuvende/Nuvenda",
    documentationStatus: "official_public",
    homologationStatus: "partial",
    requiredCredentials: ["clientId", "clientSecret"],
    defaultSettings: { sandbox: true, mock: true },
    environments: {
      sandbox: "https://api-h.nuvende.com.br",
      production: "https://api.nuvende.com.br"
    },
    docs: [
      "https://docs.nuvende.com.br/",
      "https://docs.nuvende.com.br/tecnica/sandbox/ambientes",
      "https://docs.nuvende.com.br/reference"
    ],
    webhookValidation: "shared_secret",
    notes: "Documentacao oficial confirma homologacao/producao e client credentials. Endpoints de cobranca Pix devem ser mapeados com o contrato final de Cob/QR Code Dinamico."
  },
  sendpulse: {
    provider: "sendpulse",
    type: "email",
    label: "SendPulse",
    documentationStatus: "official_public",
    homologationStatus: "partial",
    requiredCredentials: ["apiKey"],
    optionalCredentials: ["clientId", "clientSecret"],
    defaultSettings: { sandbox: true, mock: true },
    environments: {
      production: "https://api.sendpulse.com"
    },
    docs: [
      "https://sendpulse.com/integrations/api"
    ],
    webhookValidation: "none",
    notes: "API oficial publica existe. O produto usado para envio transacional deve ser escolhido na homologacao para fixar endpoint/payload sem suposicao."
  },
  wetalkie: {
    provider: "wetalkie",
    type: "whatsapp",
    label: "Wetalkie",
    documentationStatus: "missing",
    homologationStatus: "placeholder",
    requiredCredentials: ["apiKey"],
    defaultSettings: { sandbox: true, mock: true },
    environments: {},
    docs: ["https://wetalkie.com/"],
    webhookValidation: "shared_secret",
    notes: "Site oficial menciona WhatsApp API e integracoes, mas documentacao tecnica publica nao foi encontrada. Necessario contrato de endpoints e payloads."
  },
  smtp: {
    provider: "smtp",
    type: "email",
    label: "SMTP",
    documentationStatus: "official_public",
    homologationStatus: "ready",
    requiredCredentials: ["host", "port", "username", "password", "from"],
    optionalCredentials: ["secure"],
    defaultSettings: { sandbox: true, mock: true },
    environments: {},
    docs: ["RFC 5321 / documentacao do provedor SMTP contratado"],
    webhookValidation: "none",
    notes: "Padrao SMTP pronto para homologacao com host/porta/usuario/senha do tenant. Envio real depende de biblioteca SMTP no runtime."
  },
  metaAds: {
    provider: "metaAds",
    type: "ads",
    label: "Meta Ads",
    documentationStatus: "official_public",
    homologationStatus: "partial",
    requiredCredentials: ["pixelId", "accessToken"],
    optionalCredentials: ["testEventCode"],
    defaultSettings: { sandbox: true, mock: true, apiVersion: "v20.0" },
    environments: {
      production: "https://graph.facebook.com"
    },
    docs: ["https://developers.facebook.com/docs/marketing-api/conversions-api/"],
    webhookValidation: "hmac_sha256",
    notes: "Pronto para configurar credenciais e testes. Envio real deve usar contrato oficial da Graph API/Conversions API e politica de deduplicacao por event_id."
  },
  googleAds: {
    provider: "googleAds",
    type: "ads",
    label: "Google Ads",
    documentationStatus: "official_public",
    homologationStatus: "partial",
    requiredCredentials: ["customerId", "conversionActionId", "developerToken", "clientId", "clientSecret", "refreshToken"],
    defaultSettings: { sandbox: true, mock: true },
    environments: {
      production: "https://googleads.googleapis.com"
    },
    docs: [
      "https://developers.google.com/google-ads/api/docs/conversions/upload-clicks",
      "https://support.google.com/google-ads/answer/2375503"
    ],
    webhookValidation: "none",
    notes: "Pronto para credenciais e testes mockados. Para novos adotantes, acompanhar migracao para Data Manager API anunciada pelo Google a partir de 15/06/2026."
  }
};

export function listProviderCatalog() {
  return Object.values(providerCatalog);
}
