import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "crypto";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { config as loadEnv } from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { IntegrationManager, IntegrationRecord, IntegrationLogRecord } from "./src/integrations/core/IntegrationManager";
import { WebhookService } from "./src/integrations/core/WebhookService";
import { BaseProvider, IntegrationProviderId, IntegrationType } from "./src/integrations/core/BaseProvider";
import { createDefaultProviders } from "./src/integrations/providers";
import { listProviderCatalog, providerCatalog } from "./src/integrations/providers/catalog";
import { atualizarCliente, buscarCliente, criarCliente, deletarCliente, listarClientes } from "./src/server/clientesRepository";
import { getSupabaseAdminClient } from "./src/server/supabaseAdmin";
import {
  buscarUsuarioPorEmail,
  criarUsuarioAuth,
  loginUsuario,
  logoutUsuario,
  normalizeAuthRole,
  publicSession,
  publicUsuario,
  refreshUsuario,
  solicitarResetSenha,
  validarAccessToken,
  type SaaSAuthRole,
  type UsuarioRecord
} from "./src/server/authRepository";
import {
  buildTicketConfirmationIdempotencyKey,
  buildTicketConfirmationMessage,
  isValidBrazilianWhatsAppPhone,
  maskPhone,
  normalizeBrazilianPhone,
  type TicketConfirmationOrder
} from "./src/server/whatsapp/whatsappService";
import {
  buildAbandonedPixRecoveryMessages,
  calculatePromotionSummary,
  evaluatePromotions,
  getActivePromotions,
  maskBuyerName,
  normalizePromotionRule,
  persistPromotionUsage,
  type PromotionRule,
  type PromotionSummary,
  type PromotionUsage
} from "./src/server/promotions/promotionEngine";
import { sendMockWhatsAppMessage } from "./src/server/whatsapp/providers/mockWhatsAppProvider";
import { MetaWhatsAppCloudProvider, sendMetaCloudWhatsAppMessage } from "./src/server/whatsapp/providers/metaCloudWhatsAppProvider";
import { AsaasProvider } from "./src/server/payments/AsaasProvider";
import { Pay2mProvider } from "./src/server/payments/Pay2mProvider";
import { PagbankProvider } from "./src/server/payments/PagbankProvider";
import { MercadoPagoProvider } from "./src/server/payments/MercadoPagoProvider";
import { CoraProvider } from "./src/server/payments/CoraProvider";
import { PrimepagProvider } from "./src/server/payments/PrimepagProvider";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv();

const APP_VERSION = process.env.APP_VERSION || process.env.npm_package_version || "0.0.0";
const SINGLE_PROCESS_SAFE = true;
const MULTI_INSTANCE_SAFE = false;
const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|service[_-]?role|database[_-]?url|jwt|authorization)/i;

function maskSecretText(input: string) {
  const envSecrets = [
    process.env.DATABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.ASAAS_API_KEY,
    process.env.ASAAS_WEBHOOK_TOKEN,
    process.env.JWT_SECRET,
    process.env.SESSION_SECRET,
    process.env.GATEWAY_CREDENTIALS_ENCRYPTION_KEY
  ].filter((value): value is string => Boolean(value && value.length >= 8));

  return envSecrets.reduce((text, secret) => text.split(secret).join("[masked]"), input)
    .replace(/(service_role_key|api[_-]?key|secret|token|password|authorization|database_url|jwt_secret|session_secret)\s*[:=]\s*["']?[^"',\s}]+/gi, "$1=[masked]");
}

function maskLogValue(value: unknown): unknown {
  if (typeof value === "string") return maskSecretText(value);
  if (!value || typeof value !== "object") return value;
  if (value instanceof Error) {
    value.message = maskSecretText(value.message);
    if (value.stack) value.stack = maskSecretText(value.stack);
    return value;
  }
  if (Array.isArray(value)) return value.map(maskLogValue);
  const safe: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    safe[key] = SECRET_VALUE_PATTERN.test(key) ? "[masked]" : maskLogValue(item);
  });
  return safe;
}

(["log", "info", "warn", "error"] as const).forEach(level => {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => original(...args.map(maskLogValue));
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const TEST_VIDEO_URL = "https://player.mediadelivery.net/play/670514/b27261d2-ffd9-4e39-aa23-d7c400424177";
  const TEST_VIDEO_MEDIA_TYPE = "bunny" as const;
  type MediaKind = "image" | "video" | "youtube" | "vimeo" | "bunny";
  function isMediaDeliveryPlayerUrl(value: unknown) {
    return typeof value === "string" && /(^https?:\/\/)?player\.mediadelivery\.net\/play\//i.test(value.trim());
  }
  function normalizeMediaTypeForUrl(mediaUrl: unknown, mediaType: unknown): MediaKind | unknown {
    return isMediaDeliveryPlayerUrl(mediaUrl) ? TEST_VIDEO_MEDIA_TYPE : mediaType;
  }
  function normalizeMediaPayload<T extends Record<string, any>>(payload: T): T {
    const next: Record<string, any> = { ...payload };
    if ("mediaUrl" in next) next.mediaType = normalizeMediaTypeForUrl(next.mediaUrl, next.mediaType) || next.mediaType;
    if ("checkoutMediaUrl" in next) next.checkoutMediaType = normalizeMediaTypeForUrl(next.checkoutMediaUrl, next.checkoutMediaType) || next.checkoutMediaType;
    return next as T;
  }
  const isNodeProduction = process.env.NODE_ENV === "production";
  const isProductionRuntime = isNodeProduction && !process.env.RIFAPRO_TEST_MODE;
  const testEndpointsEnabled = process.env.ENABLE_TEST_ENDPOINTS === "true" || !isProductionRuntime;
  const publicDebugEnabled = process.env.ENABLE_PUBLIC_DEBUG === "true";
  const productionRequiredEnv = [
    "NODE_ENV",
    "PORT",
    "DATABASE_URL",
    "STORAGE_DRIVER",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PUBLIC_BASE_URL",
    "ADMIN_BASE_URL",
    "JWT_SECRET",
    "SESSION_SECRET"
  ];
  const configuredStorageDriver = String(process.env.STORAGE_DRIVER || "").toLowerCase();
  const validStorageDriver = configuredStorageDriver === "postgres" || configuredStorageDriver === "persistent";
  const strongSecret = (value: unknown) => typeof value === "string" && value.length >= 32 && !/(troque|change|example|secret|senha|password|default)/i.test(value);
  const productionValidationErrors = isProductionRuntime
    ? [
        ...productionRequiredEnv.filter(key => !String(process.env[key] || "").trim()).map(key => `${key} obrigatoria`),
        process.env.NODE_ENV !== "production" ? "NODE_ENV deve ser production" : "",
        !validStorageDriver ? "STORAGE_DRIVER deve ser postgres ou persistent" : "",
        publicDebugEnabled ? "ENABLE_PUBLIC_DEBUG deve ser false em producao" : "",
        !strongSecret(process.env.JWT_SECRET) ? "JWT_SECRET deve ser forte (32+ caracteres, sem placeholder)" : "",
        !strongSecret(process.env.SESSION_SECRET) ? "SESSION_SECRET deve ser forte (32+ caracteres, sem placeholder)" : ""
      ].filter(Boolean)
    : [];

  if (productionValidationErrors.length) {
    console.error("Ambiente de producao invalido:", productionValidationErrors);
    process.exit(1);
  }
  if (isNodeProduction && !MULTI_INSTANCE_SAFE) {
    console.warn("multiInstanceSafe=false: deploy permitido apenas com 1 processo backend. Nao use cluster, PM2 cluster mode ou multiplas instancias.");
  }

  const allowedCorsOrigins = new Set(
    [
      process.env.PUBLIC_BASE_URL,
      process.env.ADMIN_BASE_URL,
      ...(process.env.CORS_ORIGINS || "").split(",")
    ]
      .map(value => String(value || "").trim())
      .filter(Boolean)
      .map(value => {
        try {
          return new URL(value).origin;
        } catch {
          return value.replace(/\/+$/, "");
        }
      })
  );

  app.use((req, res, next) => {
    const origin = String(req.headers.origin || "");
    if (origin) {
      const originAllowed = !isProductionRuntime || allowedCorsOrigins.has(origin);
      if (originAllowed) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id, X-Support-Session-Id, X-Webhook-Secret");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      } else if (req.method === "OPTIONS") {
        res.status(403).json({ error: "Origem nao permitida" });
        return;
      }
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: string }).rawBody = buf.toString("utf8");
    }
  }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });
  app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads"), {
    dotfiles: "deny",
    fallthrough: false,
    setHeaders: res => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=86400");
    }
  }));
  app.use("/api/teste", (req, res, next) => {
    if (testEndpointsEnabled) {
      next();
      return;
    }
    recordSecurityEvent({
      tenant_id: "platform",
      action: "TEST_ENDPOINT_BLOCKED",
      ip: String(req.ip || req.socket.remoteAddress || ""),
      status: "BLOCKED",
      severity: "high",
      detail: `${req.method} ${req.path}`
    });
    res.status(404).json({ error: "Endpoint nao encontrado" });
  });
  app.use((req, res, next) => {
    const requestId = String(req.headers["x-request-id"] || randomUUID());
    (req as express.Request & { requestId?: string }).requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    const shouldPersist = req.path.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (shouldPersist) {
      res.on("finish", () => {
        if (res.statusCode < 500) schedulePersistentStateSave(`${req.method} ${req.path}`);
      });
    }
    next();
  });
  registerPublicDebugRoutes();

  const superadminEmail = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const superadminPassword = String(process.env.SUPERADMIN_PASSWORD || "");
  const jwtSecret = process.env.JWT_SECRET || randomUUID();
  const legacyTenantId = process.env.DEFAULT_TENANT_ID || "tenant-principal";
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  const gatewayCredentialsEncryptionKey = process.env.GATEWAY_CREDENTIALS_ENCRYPTION_KEY || "";
  const supabaseAdmin: SupabaseClient | null = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  const persistenceMode = String(process.env.STORAGE_DRIVER || (supabaseAdmin ? "postgres" : "memory")).toLowerCase();
  const persistentStorageDrivers = new Set(["postgres", "persistent"]);
  const memoryStateRisk = !persistentStorageDrivers.has(persistenceMode);
  const productionSafe = !memoryStateRisk || !isNodeProduction || Boolean(process.env.RIFAPRO_TEST_MODE);
  let persistentStateReady = false;
  let persistentStateTimer: ReturnType<typeof setTimeout> | null = null;
  let persistentStateSaving = false;
  let persistentStateDirty = false;
  let persistentStateDirtyReason = "";
  if (isNodeProduction && memoryStateRisk && !process.env.RIFAPRO_TEST_MODE) {
    console.error(`STORAGE_DRIVER=${persistenceMode} nao e seguro para producao. Use STORAGE_DRIVER=postgres ou STORAGE_DRIVER=persistent antes do deploy.`);
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.warn("JWT_SECRET nao configurado; sessoes serao invalidas apos reiniciar o servidor.");
  }
  if (!superadminEmail || !superadminPassword) {
    console.warn("SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD nao configurados; login superadmin inicial indisponivel.");
  }
  if (!gatewayCredentialsEncryptionKey) {
    console.warn("GATEWAY_CREDENTIALS_ENCRYPTION_KEY nao configurada; use uma chave forte antes de salvar credenciais reais.");
  }

  type AuthRole = "superadmin" | "admin" | "operador" | "afiliado" | "tenant_admin" | "tenant_user";
  type TenantRecord = {
    id: string;
    nome: string;
    slug: string;
    dominio?: string;
    dominio_customizado: string;
    status: "trial" | "active" | "suspended" | "overdue" | "maintenance" | "blocked" | "canceled" | "inactive";
    logo_url: string;
    cor_primaria: string;
    plano: string;
    percentual_plataforma: number;
    criado_em: string;
    atualizado_em: string;
  };
  type SaaSPlanId = "starter" | "pro" | "premium" | "enterprise" | "white-label";
  type TenantFeatureFlag = "crm" | "automations" | "advanced_affiliates" | "wallet" | "provably_fair" | "reports_pdf" | "public_api" | "pwa" | "custom_theme" | "whatsapp_automation" | "realtime_social_proof";
  type SaaSPlan = {
    id: SaaSPlanId;
    nome: string;
    limite_rifas: number;
    limite_vendas_mes: number;
    max_campaigns: number;
    max_customers: number;
    max_admin_users: number;
    max_whatsapp_messages_month: number;
    recursos: string[];
    dominio_proprio: boolean;
    advanced_reports: boolean;
    public_api: boolean;
    included_features: TenantFeatureFlag[];
    integracoes_liberadas: IntegrationProviderId[];
    percentual_comissao: number;
  };
  type AuthUserRecord = {
    id: string;
    nome: string;
    email: string;
    senha_hash: string;
    role: AuthRole;
    tenant_id: string | null;
    ativo: boolean;
    criado_em: string;
  };
  type TenantBrandingMode = "vimeu_dark" | "dark" | "light" | "premium";
  type TenantBrandingSettings = {
    id: string;
    tenant_id: string;
    header_name: string;
    logo_url: string;
    logo_mime_type: string;
    favicon_url: string;
    primary_color: string;
    secondary_color: string;
    cta_color: string;
    theme_mode: TenantBrandingMode;
    slogan: string;
    support_whatsapp: string;
    footer_text: string;
    login_logo_url: string;
    login_title: string;
    login_subtitle: string;
    login_support_text: string;
    login_background_url: string;
    login_primary_color: string;
    login_accent_color: string;
    login_button_text: string;
    login_footer_text: string;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };
  type TenantThemeBlockId = "hero" | "banner" | "video" | "premio_principal" | "premios_extras" | "pacotes_cotas" | "roletas" | "caixinhas" | "raspadinhas" | "ranking" | "prova_social" | "faq" | "regulamento" | "rodape";
  type TenantThemeTemplateRecord = {
    id: string;
    tenant_id: string;
    theme_key: string;
    name: string;
    settings: {
      colors: { primary: string; secondary: string; cta: string; background: string };
      blocks: Array<{ id: TenantThemeBlockId; enabled: boolean; order: number; title: string; subtitle: string; imageUrl: string; videoUrl: string }>;
      metadata: Record<string, unknown>;
    };
    active: boolean;
    created_at: string;
  };
  type AuthSession = {
    sub: string;
    role: AuthRole;
    tenant_id: string | null;
    email: string;
    provider?: "local" | "supabase";
  };
  type TenantApiKeyScope = "raffles:read" | "raffles:write" | "orders:read" | "customers:read" | "affiliates:read" | "reports:read" | "webhooks:write";
  type TenantApiKeyRecord = {
    id: string;
    tenant_id: string;
    name: string;
    key_hash: string;
    prefix: string;
    scopes: TenantApiKeyScope[];
    active: boolean;
    last_used_at?: string;
    expires_at?: string;
    created_by?: string;
    created_at: string;
  };
  type TenantApiKeyAuth = {
    tenantId: string;
    keyId: string;
    prefix: string;
    scopes: TenantApiKeyScope[];
  };

  const tenantSeedTimestamp = new Date().toISOString();
  const tenants: TenantRecord[] = [
    {
      id: legacyTenantId,
      nome: "CIFHER Prime",
      slug: "principal",
      dominio_customizado: "",
      status: "active",
      logo_url: "",
      cor_primaria: "#06b6d4",
      plano: "enterprise",
      percentual_plataforma: 0,
      criado_em: tenantSeedTimestamp,
      atualizado_em: tenantSeedTimestamp
    },
    {
      id: "tenant-cliente-a",
      nome: "Cliente A",
      slug: "cliente-a",
      dominio_customizado: "",
      status: "active",
      logo_url: "",
      cor_primaria: "#10b981",
      plano: "premium",
      percentual_plataforma: 10,
      criado_em: tenantSeedTimestamp,
      atualizado_em: tenantSeedTimestamp
    },
    {
      id: "tenant-cliente-b",
      nome: "Cliente B",
      slug: "cliente-b",
      dominio_customizado: "",
      status: "active",
      logo_url: "",
      cor_primaria: "#f59e0b",
      plano: "premium",
      percentual_plataforma: 10,
      criado_em: tenantSeedTimestamp,
      atualizado_em: tenantSeedTimestamp
    }
  ];
  const authUsers: AuthUserRecord[] = [];
  if (superadminEmail && superadminPassword) {
    authUsers.push({
      id: "superadmin-inicial",
      nome: "Superadministrador",
      email: superadminEmail,
      senha_hash: await bcrypt.hash(superadminPassword, 12),
      role: "superadmin",
      tenant_id: null,
      ativo: true,
      criado_em: new Date().toISOString()
    });
  }

  type N8nIntegrationSettings = {
    enabled: boolean;
    webhookUrl: string;
    secret: string;
    sendPurchaseTickets: boolean;
    sendNewRaffleBroadcast: boolean;
    sendRaffleUpdateBroadcast: boolean;
    defaultAudience: string;
    channelEmail: boolean;
    channelWhatsapp: boolean;
    lastTestAt: string;
    lastStatus: string;
  };

  // === Mock DB ===
  let settings = {
    branding: {
      companyName: "CIFHER Prime",
      logoUrl: "",
      logoAlt: "CIFHER Prime"
    },
    theme: {
      defaultTheme: "vimeu_dark",
      paletteOverrides: {}
    },
    footer: {
      companyName: "CIFHER Prime",
      cnpj: "00.000.000/0001-00",
      email: "contato@nexusdraw.com",
      mission: "Rifas digitais premium com transparencia, velocidade e experiencia cinematografica.",
      terms: "Ao participar, voce declara estar de acordo com as regras da campanha e com a legislacao vigente.",
      faq: "Pagamentos via PIX sao confirmados automaticamente. As cotas sao geradas pelo sistema apos a confirmacao.",
      ownerName: "CIFHER",
      ownerLogoUrl: "",
      ownerContact: "contato@cifher.com",
      ownerSocial: "https://instagram.com/"
    },
    storiesPosition: "bottom", // 'top', 'bottom', 'floating-left', 'floating-right', 'hidden'
    storiesPlacements: ["home-bottom"],
    lootboxEconomy: {
       ticketsPerBox: 3, // How many tickets grant 1 unopened box
       globalTicketsCounter: 0, // Track total tickets sold
       boxRules: [
          { tickets: 3, boxes: 1 },
          { tickets: 5, boxes: 2 }
       ],
       milestones: [
          { tier: "mini", everyXTickets: 500, name: "R$ 5", type: "pix", value: 5, currentCounter: 0 },
          { tier: "medio", everyXTickets: 1000, name: "R$ 50", type: "pix", value: 50, currentCounter: 0 },
          { tier: "alto", everyXTickets: 2500, name: "R$ 100", type: "pix", value: 100, currentCounter: 0 },
       ],
       effects: {
          autoOpen: false,
          sfx: true,
          vfx: true,
          confetti: true
       }
    },
    affiliateProgram: {
      commissionRate: 10,
      minTicketsToJoin: 5,
      monthlyActivationAmount: 0,
      minWithdrawAmount: 50,
      allowBalancePayments: true
    },
    affiliatePerformanceRewards: {
      enabled: false,
      rules: [] as AffiliatePerformanceRewardRule[]
    },
    smsProvider: {
      enabled: false,
      provider: "local",
      sender: "CIFHER Prime",
      apiKeyConfigured: false
    },
    n8nIntegration: {
      enabled: false,
      webhookUrl: "",
      secret: "",
      sendPurchaseTickets: true,
      sendNewRaffleBroadcast: false,
      sendRaffleUpdateBroadcast: false,
      defaultAudience: "platform",
      channelEmail: true,
      channelWhatsapp: true,
      lastTestAt: "",
      lastStatus: "not_configured"
    },
    mainVideoPlayer: {
      enabled: true,
      autoplay: true,
      allowPause: true,
      allowMute: true,
      allowRewind: true,
      startMuted: false,
      tapToUnmute: false,
      tapToTogglePlay: true,
      unmuteOnViewMotion: false,
      pauseAudioOnScroll: false,
      focusModeEnabled: true,
      autoFocusOnAutoplay: true,
      hideHeaderOnPlay: true,
      hideHeroInfoOnPlay: true,
      refocusOnTopDelaySeconds: 3,
      autoplayCardsOnView: true,
      cardsAutoplayThreshold: 55,
      initialVolume: 40,
      showControls: false,
      labels: {
        play: "Play",
        pause: "Pause",
        mute: "Mutar",
        unmute: "Ouvir",
        rewind: "Voltar 10s",
        tapToUnmute: "Toque para ouvir",
        volume: "Volume"
      }
    },
    affiliateInstructionVideo: {
      enabled: true,
      title: "Como divulgar seu link",
      description: "Assista ao vídeo de instrução configurado pelo administrador.",
      mediaUrl: TEST_VIDEO_URL,
      mediaType: TEST_VIDEO_MEDIA_TYPE,
      videoConfig: {
        enabled: true,
        autoplay: false,
        allowPause: true,
        allowMute: true,
        allowRewind: true,
      startMuted: true,
      tapToUnmute: false,
      tapToTogglePlay: false,
        unmuteOnViewMotion: false,
        pauseAudioOnScroll: true,
        initialVolume: 50,
      showControls: false,
        labels: {
          play: "Play",
          pause: "Pause",
          mute: "Mutar",
          unmute: "Ouvir",
          rewind: "Voltar 10s",
          tapToUnmute: "Toque para ouvir",
          volume: "Volume"
        }
      }
    },
    socialLinks: {
      whatsapp: "https://wa.me/5511999999999",
      instagram: "https://instagram.com/",
      group: ""
    }
  };

  function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeAffiliatePerformanceRewardsSettings(input: any) {
    const validGoalTypes = new Set(["sales_count", "customers_count", "revenue_amount", "commission_amount"]);
    const validRewardTypes = new Set(["scratchcard", "wheel_spin", "super_quota", "bonus_number", "future_reward"]);
    const now = new Date().toISOString();
    const rules = Array.isArray(input?.rules) ? input.rules : [];
    return {
      enabled: Boolean(input?.enabled),
      rules: rules.map((rule: any, index: number): AffiliatePerformanceRewardRule => {
        const goalType = validGoalTypes.has(String(rule?.goalType)) ? String(rule.goalType) as AffiliateRewardGoalType : "sales_count";
        const rewardType = validRewardTypes.has(String(rule?.rewardType)) ? String(rule.rewardType) as AffiliateRewardType : "scratchcard";
        const threshold = Math.max(1, Number(rule?.threshold || 1));
        const rewardQuantity = Math.max(1, Math.floor(Number(rule?.rewardQuantity || 1)));
        return {
          id: String(rule?.id || createPublicId("AFR_")),
          name: String(rule?.name || `Regra ${index + 1}`).slice(0, 80),
          enabled: Boolean(rule?.enabled ?? true),
          goalType,
          threshold,
          rewardType,
          rewardQuantity,
          createdAt: String(rule?.createdAt || now)
        };
      }).slice(0, 20)
    };
  }

  function normalizeSettingsShape(sourceSettings: typeof settings) {
    sourceSettings.affiliateProgram = {
      ...settings.affiliateProgram,
      ...(sourceSettings.affiliateProgram || {}),
      monthlyActivationAmount: Math.max(0, Number(sourceSettings.affiliateProgram?.monthlyActivationAmount || 0))
    };
    sourceSettings.affiliatePerformanceRewards = normalizeAffiliatePerformanceRewardsSettings(sourceSettings.affiliatePerformanceRewards);
    sourceSettings.socialLinks = {
      whatsapp: "",
      instagram: "",
      group: "",
      ...(sourceSettings.socialLinks || {})
    };
    return sourceSettings;
  }

  const tenantSettings: Record<string, typeof settings> = {};
  const tenantBrandingSettings: Record<string, TenantBrandingSettings> = {};
  let tenantThemeTemplates: TenantThemeTemplateRecord[] = [];
  const legacyBrandNames = new Set(["RifaPro", "RifaPro SaaS", "CIFHER Plataforma", "Plataforma Principal", "Tenant Desenvolvimento"]);
  const legacyBrandFooters = new Set(["RifaPro", "RifaPro SaaS", "CIFHER Plataforma", "Tenant Desenvolvimento"]);
  const defaultPrimeSlogan = "Tecnologia premium para gestao avancada";
  const defaultLoginTitle = "CIFHER Prime";
  const defaultLoginSubtitle = "Acesse seu ambiente exclusivo com segurança, controle e alta performance.";
  const defaultLoginSupportText = "Tecnologia premium para gestão inteligente, operação avançada e crescimento profissional.";
  const defaultLoginButtonText = "Entrar com segurança";
  const defaultLoginFooterText = "Ambiente protegido • Acesso autorizado";

  function normalizeLegacyBrandText(value: unknown, fallback = "CIFHER Prime") {
    const text = String(value || "").trim();
    return !text || legacyBrandNames.has(text) ? fallback : text;
  }

  function normalizeLegacyFooterText(value: unknown, fallback = "CIFHER Prime") {
    const text = String(value || "").trim();
    return !text || legacyBrandFooters.has(text) ? fallback : text;
  }

  function defaultTenantBranding(tenantId: string): TenantBrandingSettings {
    const tenant = tenants.find(item => item.id === tenantId);
    const tenantScopedSettings = tenantSettings[tenantId] || settings;
    const now = new Date().toISOString();
    return {
      id: createPublicId("BRAND_"),
      tenant_id: tenantId,
      header_name: normalizeLegacyBrandText(tenantScopedSettings.branding?.companyName || tenant?.nome),
      logo_url: tenantScopedSettings.branding?.logoUrl || tenant?.logo_url || "",
      logo_mime_type: "",
      favicon_url: "",
      primary_color: tenant?.cor_primaria || "#00d66b",
      secondary_color: "#0f2d1d",
      cta_color: "#00d66b",
      theme_mode: "vimeu_dark",
      slogan: defaultPrimeSlogan,
      support_whatsapp: tenantScopedSettings.socialLinks?.whatsapp || "",
      footer_text: normalizeLegacyFooterText(tenantScopedSettings.footer?.mission),
      login_logo_url: tenantScopedSettings.branding?.logoUrl || tenant?.logo_url || "",
      login_title: defaultLoginTitle,
      login_subtitle: defaultLoginSubtitle,
      login_support_text: defaultLoginSupportText,
      login_background_url: "",
      login_primary_color: tenant?.cor_primaria || "#00d66b",
      login_accent_color: "#f5c451",
      login_button_text: defaultLoginButtonText,
      login_footer_text: defaultLoginFooterText,
      metadata: {},
      created_at: now,
      updated_at: now
    };
  }

  function getTenantBranding(tenantId: string) {
    tenantBrandingSettings[tenantId] ||= defaultTenantBranding(tenantId);
    const current = tenantBrandingSettings[tenantId];
    current.header_name = normalizeLegacyBrandText(current.header_name);
    current.footer_text = normalizeLegacyFooterText(current.footer_text);
    if (!String(current.slogan || "").trim() || current.slogan === "Sorteios premium com PIX automatico") current.slogan = defaultPrimeSlogan;
    current.login_logo_url ||= current.logo_url || "";
    current.login_title = String(current.login_title || "").trim() || defaultLoginTitle;
    current.login_subtitle = String(current.login_subtitle || "").trim() || defaultLoginSubtitle;
    current.login_support_text = String(current.login_support_text || "").trim() || defaultLoginSupportText;
    current.login_background_url ||= "";
    current.login_primary_color = isHexColor(current.login_primary_color) ? current.login_primary_color : current.primary_color;
    current.login_accent_color = isHexColor(current.login_accent_color) ? current.login_accent_color : "#f5c451";
    current.login_button_text = String(current.login_button_text || "").trim() || defaultLoginButtonText;
    current.login_footer_text = String(current.login_footer_text || "").trim() || defaultLoginFooterText;
    return tenantBrandingSettings[tenantId];
  }

  const themeMarketplacePresets = [
    { key: "premium-dark", name: "premium dark", colors: ["#00d66b", "#0f2d1d", "#00d66b", "#050807"] },
    { key: "cassino-neon", name: "cassino neon", colors: ["#22d3ee", "#7c3aed", "#facc15", "#070312"] },
    { key: "fazendinha", name: "fazendinha", colors: ["#84cc16", "#14532d", "#f97316", "#07130a"] },
    { key: "esportivo", name: "esportivo", colors: ["#38bdf8", "#0f172a", "#22c55e", "#020617"] },
    { key: "luxo-dourado", name: "luxo dourado", colors: ["#f5c451", "#23170a", "#facc15", "#060403"] },
    { key: "clean-claro", name: "clean claro", colors: ["#0ea5e9", "#e0f2fe", "#16a34a", "#f8fafc"] },
    { key: "black-friday", name: "black friday", colors: ["#ef4444", "#111827", "#facc15", "#020617"] }
  ] as const;
  const themeBlockIds: TenantThemeBlockId[] = ["hero", "banner", "video", "premio_principal", "premios_extras", "pacotes_cotas", "roletas", "caixinhas", "raspadinhas", "ranking", "prova_social", "faq", "regulamento", "rodape"];

  function sanitizeThemeText(value: unknown, max = 180) {
    return String(value || "").replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").replace(/[<>]/g, "").trim().slice(0, max);
  }

  function sanitizeThemeUrl(value: unknown) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (/^javascript:/i.test(url) || /<|>/g.test(url)) return "";
    if (/^(https?:\/\/|\/uploads\/|\/assets\/|\/icons\/)/i.test(url)) return url.slice(0, 600);
    return "";
  }

  function buildThemeSettings(themeKey = "premium-dark", incoming: any = {}) {
    const preset = themeMarketplacePresets.find(item => item.key === themeKey) || themeMarketplacePresets[0];
    const colors = incoming.colors || {};
    const incomingBlocks = Array.isArray(incoming.blocks) ? incoming.blocks : [];
    return {
      colors: {
        primary: isHexColor(colors.primary) ? colors.primary : preset.colors[0],
        secondary: isHexColor(colors.secondary) ? colors.secondary : preset.colors[1],
        cta: isHexColor(colors.cta) ? colors.cta : preset.colors[2],
        background: isHexColor(colors.background) ? colors.background : preset.colors[3]
      },
      blocks: themeBlockIds.map((id, index) => {
        const block = incomingBlocks.find((item: any) => item?.id === id) || {};
        return {
          id,
          enabled: block.enabled !== false,
          order: Number.isFinite(Number(block.order)) ? Number(block.order) : index,
          title: sanitizeThemeText(block.title || id.replace(/_/g, " "), 120),
          subtitle: sanitizeThemeText(block.subtitle || "", 240),
          imageUrl: sanitizeThemeUrl(block.imageUrl),
          videoUrl: sanitizeThemeUrl(block.videoUrl)
        };
      }).sort((a, b) => a.order - b.order),
      metadata: typeof incoming.metadata === "object" && incoming.metadata ? incoming.metadata : {}
    };
  }

  function defaultThemeTemplate(tenantId: string, themeKey = "premium-dark"): TenantThemeTemplateRecord {
    const preset = themeMarketplacePresets.find(item => item.key === themeKey) || themeMarketplacePresets[0];
    return {
      id: createPublicId("THEME_"),
      tenant_id: tenantId,
      theme_key: preset.key,
      name: preset.name,
      settings: buildThemeSettings(preset.key),
      active: true,
      created_at: new Date().toISOString()
    };
  }

  function ensureTenantThemeTemplate(tenantId: string) {
    let active = tenantThemeTemplates.find(item => item.tenant_id === tenantId && item.active);
    if (!active) {
      active = defaultThemeTemplate(tenantId);
      tenantThemeTemplates.unshift(active);
    }
    return active;
  }

  function saveTenantThemeTemplate(tenantId: string, input: any) {
    const current = input.id ? tenantThemeTemplates.find(item => item.id === input.id && item.tenant_id === tenantId) : ensureTenantThemeTemplate(tenantId);
    const themeKey = String(input.theme_key || current.theme_key || "premium-dark");
    const next: TenantThemeTemplateRecord = {
      ...current,
      theme_key: themeMarketplacePresets.some(item => item.key === themeKey) ? themeKey : current.theme_key,
      name: sanitizeThemeText(input.name || current.name, 80),
      settings: buildThemeSettings(themeKey, input.settings || current.settings),
      active: input.active !== false,
      created_at: current.created_at || new Date().toISOString()
    };
    tenantThemeTemplates = tenantThemeTemplates.filter(item => item.id !== current.id);
    if (next.active) tenantThemeTemplates.forEach(item => { if (item.tenant_id === tenantId) item.active = false; });
    tenantThemeTemplates.unshift(next);
    return next;
  }

  function publicTenantTheme(tenantId: string) {
    const template = ensureTenantThemeTemplate(tenantId);
    return { theme_key: template.theme_key, name: template.name, settings: template.settings, active: template.active };
  }

  function isHexColor(value: unknown) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""));
  }

  function normalizeTenantBranding(tenantId: string, incoming: Record<string, unknown>, current = getTenantBranding(tenantId)) {
    const themeMode = String(incoming.theme_mode || current.theme_mode || "vimeu_dark");
    const next: TenantBrandingSettings = {
      ...current,
      header_name: String(incoming.header_name ?? current.header_name ?? "").trim().slice(0, 80) || defaultTenantBranding(tenantId).header_name,
      logo_url: String(incoming.logo_url ?? current.logo_url ?? "").trim(),
      logo_mime_type: String(incoming.logo_mime_type ?? current.logo_mime_type ?? "").trim(),
      favicon_url: String(incoming.favicon_url ?? current.favicon_url ?? "").trim(),
      primary_color: isHexColor(incoming.primary_color) ? String(incoming.primary_color) : current.primary_color,
      secondary_color: isHexColor(incoming.secondary_color) ? String(incoming.secondary_color) : current.secondary_color,
      cta_color: isHexColor(incoming.cta_color) ? String(incoming.cta_color) : current.cta_color,
      theme_mode: ["vimeu_dark", "dark", "light", "premium"].includes(themeMode) ? themeMode as TenantBrandingMode : "vimeu_dark",
      slogan: String(incoming.slogan ?? current.slogan ?? "").trim().slice(0, 140),
      support_whatsapp: String(incoming.support_whatsapp ?? current.support_whatsapp ?? "").trim().slice(0, 80),
      footer_text: String(incoming.footer_text ?? current.footer_text ?? "").trim().slice(0, 280),
      login_logo_url: String(incoming.login_logo_url ?? current.login_logo_url ?? current.logo_url ?? "").trim().slice(0, 600),
      login_title: String(incoming.login_title ?? current.login_title ?? "").trim().slice(0, 80) || defaultLoginTitle,
      login_subtitle: String(incoming.login_subtitle ?? current.login_subtitle ?? "").trim().slice(0, 180) || defaultLoginSubtitle,
      login_support_text: String(incoming.login_support_text ?? current.login_support_text ?? "").trim().slice(0, 260) || defaultLoginSupportText,
      login_background_url: String(incoming.login_background_url ?? current.login_background_url ?? "").trim().slice(0, 600),
      login_primary_color: isHexColor(incoming.login_primary_color) ? String(incoming.login_primary_color) : current.login_primary_color || current.primary_color,
      login_accent_color: isHexColor(incoming.login_accent_color) ? String(incoming.login_accent_color) : current.login_accent_color || current.cta_color,
      login_button_text: String(incoming.login_button_text ?? current.login_button_text ?? "").trim().slice(0, 80) || defaultLoginButtonText,
      login_footer_text: String(incoming.login_footer_text ?? current.login_footer_text ?? "").trim().slice(0, 140) || defaultLoginFooterText,
      metadata: typeof incoming.metadata === "object" && incoming.metadata ? incoming.metadata as Record<string, unknown> : current.metadata,
      updated_at: new Date().toISOString()
    };
    tenantBrandingSettings[tenantId] = next;
    const scopedSettings = getTenantSettings(tenantId);
    scopedSettings.branding = { ...scopedSettings.branding, companyName: next.header_name, logoUrl: next.logo_url, logoAlt: next.header_name };
    scopedSettings.socialLinks = { ...scopedSettings.socialLinks, whatsapp: next.support_whatsapp };
    scopedSettings.footer = { ...scopedSettings.footer, companyName: next.header_name, mission: next.footer_text };
    return next;
  }

  function publicTenantBranding(branding: TenantBrandingSettings) {
    return {
      header_name: branding.header_name,
      logo_url: branding.logo_url,
      logo_mime_type: branding.logo_mime_type,
      favicon_url: branding.favicon_url,
      colors: {
        primary: branding.primary_color,
        secondary: branding.secondary_color,
        cta: branding.cta_color
      },
      theme_mode: branding.theme_mode,
      slogan: branding.slogan,
      footer_text: branding.footer_text,
      support_whatsapp: branding.support_whatsapp,
      login_logo_url: branding.login_logo_url,
      login_title: branding.login_title,
      login_subtitle: branding.login_subtitle,
      login_support_text: branding.login_support_text,
      login_background_url: branding.login_background_url,
      login_primary_color: branding.login_primary_color,
      login_accent_color: branding.login_accent_color,
      login_button_text: branding.login_button_text,
      login_footer_text: branding.login_footer_text
    };
  }

  async function saveBrandingAsset(req: express.Request, tenantId: string, kind: "logo" | "favicon") {
    const fileName = String(req.headers["x-file-name"] || kind).replace(/[^\w.\-]+/g, "-");
    const contentType = String(req.headers["content-type"] || "").split(";")[0].toLowerCase();
    const ext = path.extname(fileName).toLowerCase();
    const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);
    const allowedMime = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]);
    const maxBytes = Number(process.env.TENANT_BRANDING_MAX_BYTES || 4 * 1024 * 1024);
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!body.length) throw new Error("Arquivo vazio");
    if (body.length > maxBytes) {
      const error = new Error(`Arquivo acima de ${Math.round(maxBytes / 1024 / 1024)}MB`);
      (error as Error & { statusCode?: number }).statusCode = 413;
      throw error;
    }
    if (!allowedExtensions.has(ext) || !allowedMime.has(contentType)) {
      const error = new Error("Formato nao suportado. Use PNG, JPG, JPEG, WEBP, SVG seguro ou GIF animado.");
      (error as Error & { statusCode?: number }).statusCode = 415;
      throw error;
    }
    if (contentType === "image/svg+xml") {
      const svg = body.toString("utf8").toLowerCase();
      if (/<script|javascript:|onload=|onerror=|<foreignobject/.test(svg)) {
        const error = new Error("SVG contem conteudo potencialmente perigoso");
        (error as Error & { statusCode?: number }).statusCode = 415;
        throw error;
      }
    }
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "tenant-assets", tenantId, "branding");
    await mkdir(uploadsDir, { recursive: true });
    const storedName = `${kind}${ext}`;
    await writeFile(path.join(uploadsDir, storedName), body);
    return {
      url: `/uploads/tenant-assets/${tenantId}/branding/${storedName}`,
      mimeType: contentType,
      size: body.length,
      bucket: "tenant-assets",
      path: `tenant-assets/${tenantId}/branding/${storedName}`
    };
  }
  function getTenantSettings(tenantId: string) {
    if (!tenantSettings[tenantId]) {
      tenantSettings[tenantId] = tenantId === legacyTenantId ? settings : deepClone(settings);
      tenantSettings[tenantId].branding = {
        ...tenantSettings[tenantId].branding,
        companyName: tenants.find(tenant => tenant.id === tenantId)?.nome || tenantSettings[tenantId].branding.companyName
      };
    }
    return normalizeSettingsShape(tenantSettings[tenantId]);
  }

  type PrizeRarity = "common" | "rare" | "epic" | "legendary";
  type GatewayPrize = { name: string; value: number; type: string; rarity: PrizeRarity; tier?: string; wheelSegmentIndex?: number; wheelSegmentLabel?: string };
  type LootboxMilestone = { tier: string; everyXTickets: number; name: string; type: string; value: number; currentCounter?: number };
  type RewardWheelSegment = { label: string; color: string; imageUrl?: string; rewardEnabled?: boolean; reward?: LootboxMilestone };
  type LootboxEconomy = {
    experienceType: "box" | "wheel";
    rewardModes: { box: boolean; wheel: boolean };
    ticketsPerBox: number;
    globalTicketsCounter: number;
    boxRules: Array<{ tickets: number; boxes: number }>;
    milestones: LootboxMilestone[];
    wheelSegments: RewardWheelSegment[];
    effects: typeof settings.lootboxEconomy.effects;
  };
  type FazendinhaLootboxConfig = LootboxEconomy & {
    strategy: "group";
    winningGroupId: string;
    boxesPerGroup: number;
    prizeName: string;
    prizeType: string;
    prizeValue: number;
    prizeRarity: PrizeRarity;
    prizeClaimed: boolean;
    winnerPurchaseId?: string;
  };
  type LootboxRecord = {
    tenant_id: string;
    id: string;
    userId: string;
    purchaseId: string;
    scopeId?: string;
    scopeType?: "raffle" | "fazendinha" | "dezena" | "centena" | "milhar" | "global";
    experienceType?: "box" | "wheel";
    effects?: typeof settings.lootboxEconomy.effects;
    wheelSegments?: RewardWheelSegment[];
    status: "closed" | "opening" | "opened";
    premiada: boolean;
    valorPremio: number;
    tipoPremio?: string;
    premio?: GatewayPrize;
    lockedPrize?: GatewayPrize | null;
    openedAt?: string;
    createdAt: string;
  };
  type AffiliateCampaignType = "raffle" | "fazendinha" | "number_mode";
  type AffiliateCampaignRef = { type: AffiliateCampaignType; id: string };
  type AffiliateLedger = { amount: number; type: string; date: string; note?: string; campaignType?: AffiliateCampaignType; campaignId?: string };
  type AffiliateRewardGoalType = "sales_count" | "customers_count" | "revenue_amount" | "commission_amount";
  type AffiliateRewardType = "scratchcard" | "wheel_spin" | "super_quota" | "bonus_number" | "future_reward";
  type AffiliatePerformanceRewardRule = {
    id: string;
    name: string;
    enabled: boolean;
    goalType: AffiliateRewardGoalType;
    threshold: number;
    rewardType: AffiliateRewardType;
    rewardQuantity: number;
    createdAt: string;
  };
  type AffiliatePerformanceRewardLedger = {
    id: string;
    tenant_id: string;
    affiliateRefCode: string;
    ruleId: string;
    ruleName: string;
    goalType: AffiliateRewardGoalType;
    threshold: number;
    milestone: number;
    rewardType: AffiliateRewardType;
    rewardQuantity: number;
    source: string;
    createdAt: string;
  };
  type AffiliateRewardConsumptionLedger = {
    id: string;
    tenant_id: string;
    affiliateRefCode: string;
    customerId?: string;
    rewardType: AffiliateRewardType;
    quantity: number;
    status: "used";
    idempotencyKey: string;
    result: {
      label: string;
      eventId?: string;
      lootboxId?: string;
      benefitQuantity?: number;
      message?: string;
    };
    createdAt: string;
  };
  type AffiliateWithdrawal = {
    tenant_id: string;
    id: string;
    refCode: string;
    customerId?: string;
    customerName: string;
    customerPhone: string;
    pixKey: string;
    amount: number;
    status: "pending" | "paid" | "rejected";
    requestedAt: string;
    paidAt?: string;
    adminNote?: string;
  };
  type AuditLog = {
    tenant_id: string;
    id: string;
    action: string;
    method: string;
    path: string;
    status: number;
    actor: string;
    ip: string;
    createdAt: string;
    detail?: string;
  };
  type SecurityLog = {
    tenant_id: string;
    id: string;
    action: string;
    ip: string;
    status: "INFO" | "WARN" | "BLOCKED";
    severity: "low" | "medium" | "high" | "critical";
    actor?: string;
    detail?: string;
    date: string;
  };
  type PaymentWebhookLog = {
    tenant_id: string;
    id: string;
    gateway: string;
    purchaseId?: string;
    status: "received" | "confirmed" | "duplicate" | "ignored" | "invalid" | "failed";
    message: string;
    createdAt: string;
    statusCode: number;
    eventStatus?: string;
  };
  type PaymentLog = {
    tenant_id: string;
    id: string;
    provider: string;
    order_id?: string;
    provider_payment_id?: string;
    action: "payment_created" | "payment_updated" | "webhook_received" | "webhook_confirmed" | "reconcile" | "gateway_test";
    status: string;
    message: string;
    createdAt: string;
  };
  type WebhookLog = {
    tenant_id: string;
    id: string;
    provider: string;
    event_id?: string;
    status: string;
    httpStatus: number;
    latencyMs: number;
    message: string;
    createdAt: string;
  };
  type GatewayHealth = {
    tenant_id: string;
    provider: string;
    status: "healthy" | "degraded" | "down" | "unknown";
    lastStatusCode: number;
    lastEventAt: string;
    successCount: number;
    failureCount: number;
    lastMessage: string;
  };
  type PaymentQueueJob = {
    id: string;
    tenant_id: string;
    gateway: string;
    purchaseId?: string;
    status: "pending" | "processing" | "paid" | "failed" | "cancelled";
    attempts: number;
    maxAttempts: number;
    nextRetryAt: string;
    lastError: string;
    idempotencyKey: string;
    eventStatus: string;
    payload: Record<string, unknown>;
    result?: Record<string, unknown>;
    duplicateReceipt?: boolean;
    createdAt: string;
    updatedAt: string;
  };
  type PaymentWorkerJobStatus = "pending" | "processing" | "completed" | "failed" | "dead";
  type PaymentWebhookJob = {
    id: string;
    tenant_id: string;
    provider: string;
    event_id: string;
    eventStatus: string;
    payload: Record<string, unknown>;
    status: PaymentWorkerJobStatus;
    attempts: number;
    maxAttempts: number;
    nextRetryAt: string;
    lastError: string;
    idempotencyKey: string;
    createdAt: string;
    updatedAt: string;
  };
  type PaymentReconciliationJob = {
    id: string;
    tenant_id: string;
    provider: string;
    provider_payment_id?: string;
    provider_reference?: string;
    order_id?: string;
    status: PaymentWorkerJobStatus;
    attempts: number;
    maxAttempts: number;
    nextRetryAt: string;
    lastError: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
  type PaymentReleaseJob = {
    id: string;
    tenant_id: string;
    gateway: string;
    purchaseId: string;
    releaseType: "raffle" | "number_mode" | "fazendinha";
    paymentJobId?: string;
    status: PaymentWorkerJobStatus;
    attempts: number;
    maxAttempts: number;
    nextRetryAt: string;
    lastError: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    result?: Record<string, unknown>;
    duplicateReceipt?: boolean;
    createdAt: string;
    updatedAt: string;
  };
  type PaymentDeadLetterJob = {
    id: string;
    tenant_id: string;
    queue: "webhook" | "reconciliation" | "payment" | "release";
    sourceJobId: string;
    provider: string;
    idempotencyKey: string;
    attempts: number;
    reason: string;
    payload: Record<string, unknown>;
    createdAt: string;
  };
  type WhatsAppProviderConfigRecord = {
    id: string;
    tenant_id: string;
    provider: "mock" | "meta_cloud";
    enabled: boolean;
    environment: "sandbox" | "production";
    phone_number_id?: string;
    business_account_id?: string;
    access_token_encrypted?: string;
    webhook_verify_token_encrypted?: string;
    template_namespace?: string;
    default_language: string;
    created_at: string;
    updated_at: string;
  };
  type WhatsAppCloudConfigRecord = {
    id: string;
    tenant_id: string;
    enabled: boolean;
    account_name: string;
    business_manager_id: string;
    whatsapp_business_account_id: string;
    phone_number_id: string;
    access_token_encrypted: string;
    webhook_verify_token_encrypted: string;
    webhook_url: string;
    environment: "sandbox" | "production";
    created_at: string;
    updated_at: string;
  };
  type WhatsAppCloudLogRecord = {
    id: string;
    tenant_id: string;
    action: "settings_saved" | "test_connection" | "phone_info" | "list_templates" | "templates_synced" | "template_test_requested" | "template_test_sent" | "template_sent" | "crm_campaign_created" | "crm_campaign_preview" | "crm_campaign_enqueued" | "crm_campaign_cancelled" | "crm_campaign_send_requested" | "crm_campaign_sent" | "crm_campaign_failed" | "crm_campaign_skipped" | "pix_recovery_settings_saved" | "pix_recovery_preview" | "pix_recovery_enqueued" | "pix_recovery_sent" | "pix_recovery_skipped" | "purchase_confirmation_settings_saved" | "purchase_confirmation_event" | "purchase_confirmation_enqueued" | "purchase_confirmation_send_requested" | "purchase_confirmation_sent" | "purchase_confirmation_failed" | "purchase_confirmation_skipped" | "manual_reply_sent" | "manual_reply_failed" | "manual_template_sent" | "manual_template_failed" | "webhook_validate" | "webhook_received" | "credential_error" | "meta_api_error";
    status: "success" | "error" | "skipped";
    message: string;
    metadata: Record<string, unknown>;
    created_at: string;
  };
  type WhatsAppPixRecoveryEventType = "pix_pending_reminder" | "pix_expired_reminder";
  type WhatsAppPixRecoverySettingsRecord = {
    id: string;
    tenant_id: string;
    enabled: boolean;
    pending_template_name: string;
    pending_template_language: string;
    expired_template_name: string;
    expired_template_language: string;
    min_age_minutes: number;
    per_customer_cooldown_hours: number;
    daily_tenant_limit: number;
    mode: "manual" | "automatic";
    created_at: string;
    updated_at: string;
  };
  type WhatsAppPurchaseConfirmationEventType = "purchase_confirmed";
  type WhatsAppPurchaseConfirmationSettingsRecord = {
    id: string;
    tenant_id: string;
    enabled: boolean;
    template_name: string;
    template_language: string;
    mode: "manual" | "automatic";
    daily_tenant_limit: number;
    paid_only: boolean;
    created_at: string;
    updated_at: string;
  };
  type WhatsAppCloudTemplateRecord = {
    id: string;
    tenant_id: string;
    name: string;
    status: "APPROVED" | "PENDING" | "REJECTED" | string;
    language: string;
    category: string;
    components: unknown[];
    synced_at: string;
  };
  type WhatsAppContactRecord = {
    id: string;
    tenantId: string;
    customerId?: string;
    phone: string;
    displayName: string;
    source: string;
    optOut: boolean;
    optOutAt?: string;
    lastInboundAt?: string;
    lastOutboundAt?: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
  };
  type WhatsAppConversationStatus = "open" | "pending" | "resolved" | "waiting_customer";
  type WhatsAppConversationRecord = {
    id: string;
    tenantId: string;
    contactId: string;
    phone: string;
    status: WhatsAppConversationStatus;
    assignedUserId?: string;
    lastMessageAt?: string;
    serviceWindowExpiresAt?: string;
    unreadCount: number;
    createdAt: string;
    updatedAt: string;
  };
  type WhatsAppConversationMessageRecord = {
    id: string;
    tenantId: string;
    conversationId: string;
    direction: "inbound" | "outbound" | "system" | "internal_note";
    type: "text" | "template" | "image" | "audio" | "document" | "button" | "status" | "unknown";
    body: string;
    status?: string;
    metaMessageId?: string;
    receivedAt?: string;
    sentAt?: string;
    rawSummary: Record<string, unknown>;
  };
  type WhatsAppOptOutEventRecord = {
    id: string;
    tenantId: string;
    contactId: string;
    phone: string;
    reason: string;
    source: string;
    createdAt: string;
  };
  type WhatsAppCrmCampaignSegment = "today" | "last_7_days" | "vip" | "recurring" | "pix_pending" | "pix_expired" | "raffle" | "fazendinha" | "number_mode" | "inactive_30_days";
  type WhatsAppCrmCampaignStatus = "draft" | "ready" | "queued" | "sending" | "completed" | "cancelled";
  type WhatsAppCrmCampaignRecord = {
    id: string;
    tenant_id: string;
    name: string;
    segment: WhatsAppCrmCampaignSegment;
    template_name: string;
    language: string;
    components: unknown[];
    status: WhatsAppCrmCampaignStatus;
    predicted_recipients: number;
    queued_count: number;
    sent_count: number;
    failed_count: number;
    skipped_count: number;
    daily_tenant_limit: number;
    cooldown_hours: number;
    created_by: string;
    created_at: string;
    updated_at: string;
    cancelled_at?: string;
  };
  type WhatsAppMessageQueueRecord = {
    id: string;
    tenant_id: string;
    order_id?: string;
    customer_id?: string;
    phone: string;
    message_type: "ticket_confirmation" | string;
    message_body: string;
    provider: "mock" | "meta_cloud" | string;
    status: "queued" | "pending" | "sent" | "failed" | "retrying" | "skipped";
    attempts: number;
    max_attempts: number;
    last_error?: string;
    reason?: string;
    sent_at?: string;
    processed_at?: string;
    meta_message_id?: string;
    template_name?: string;
    language?: string;
    event_type?: WhatsAppPixRecoveryEventType | string;
    payload?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    idempotency_key: string;
  };
  type WhatsAppOrderType = "raffle" | "fazendinha" | "number_mode";
  type WhatsAppOrderSource = PurchaseRecord | FazendinhaPurchase | NumberModePurchase;
  type WhatsAppOrderCandidate = {
    tenantId: string;
    orderId: string;
    orderType: WhatsAppOrderType;
    customerId?: string;
    customerName: string;
    customerPhone: string;
    campaignName: string;
    quantity: number;
    numbersLabel: string;
    amount: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
    paidAt?: string | null;
    expiresAt?: string;
    publicLink: string;
    rawRef: WhatsAppOrderSource;
  };
  type AutomationTriggerType =
    | "abandoned_pix_recovery"
    | "payment_confirmed_ticket"
    | "post_purchase_thanks"
    | "raffle_ending_reminder"
    | "winner_announcement"
    | "affiliate_invite"
    | "inactive_customer_reactivation"
    | "birthday_message"
    | "vip_customer_offer"
    | "failed_payment_retry"
    | "purchase_created"
    | "payment_approved"
    | "order_expired"
    | "raffle_ending"
    | "raffle_closed"
    | "draw_completed"
    | "customer_inactive"
    | "affiliate_registered";
  type AutomationFlowRecord = {
    id: string;
    tenant_id: string;
    name: string;
    trigger_type: AutomationTriggerType | string;
    enabled: boolean;
    conditions: Record<string, unknown>;
    actions: Array<Record<string, unknown>>;
    delay_minutes: number;
    max_runs_per_customer: number;
    created_at: string;
    updated_at: string;
  };
  type AutomationRunRecord = {
    id: string;
    tenant_id: string;
    flow_id: string;
    customer_id?: string;
    order_id?: string;
    status: "scheduled" | "running" | "completed" | "failed" | "skipped";
    attempts: number;
    last_error?: string;
    scheduled_at: string;
    executed_at?: string;
    created_at: string;
    idempotency_key: string;
  };
  type TenantDomainRecord = {
    id: string;
    tenant_id: string;
    domain: string;
    type: "subdomain" | "custom_domain";
    status: "pending" | "verified" | "failed" | "disabled";
    verification_token: string;
    dns_target: string;
    ssl_status: "pending" | "issued" | "failed" | "not_configured" | string;
    is_primary: boolean;
    created_at: string;
    verified_at?: string;
  };
  type SuperadminImpersonationSession = {
    id: string;
    superadmin_user_id: string;
    tenant_id: string;
    reason: string;
    started_at: string;
    ended_at?: string;
    expires_at: string;
    ip_address: string;
    user_agent: string;
    active: boolean;
  };
  type SuperadminAuditLog = {
    id: string;
    superadmin_user_id: string;
    tenant_id?: string;
    action: string;
    resource_type?: string;
    resource_id?: string;
    metadata: Record<string, unknown>;
    ip_address: string;
    user_agent: string;
    created_at: string;
  };
  type WebhookEndpointRecord = {
    id: string;
    tenant_id: string;
    provider: IntegrationProviderId;
    url: string;
    secret: string;
    active: boolean;
    created_at: string;
  };
  type WebhookEventRecord = {
    id: string;
    tenant_id: string;
    provider: IntegrationProviderId;
    event_type: string;
    status?: string;
    external_reference?: string;
    reference_code?: string;
    provider_payment_id?: string;
    reference_id?: string;
    end_to_end?: string;
    payload: Record<string, unknown>;
    processed: boolean;
    processed_at: string;
    error_message: string;
    created_at: string;
  };
  type CampaignCoupon = {
    tenant_id: string;
    id: string;
    code: string;
    name: string;
    type: "percent" | "fixed" | "bonus";
    value: number;
    active: boolean;
    raffleId?: string;
    minTickets?: number;
    maxUses?: number;
    used: number;
    startsAt?: string;
    endsAt?: string;
    createdAt: string;
  };
  type N8nEventLog = {
    tenant_id: string;
    id: string;
    event: string;
    status: "queued" | "sent" | "failed" | "skipped";
    target: string;
    createdAt: string;
    deliveredAt?: string;
    attempts: number;
    statusCode?: number;
    error?: string;
    payloadPreview?: Record<string, unknown>;
  };
  type PasswordResetCode = {
    tenant_id: string;
    id: string;
    phone: string;
    code: string;
    expiresAt: string;
    used: boolean;
  };
  type SupportTicket = {
    id: string;
    tenant_id: string;
    accessToken?: string;
    customerId?: string;
    customerName: string;
    customerPhone: string;
    status: "open" | "answered" | "closed";
    assignedTo?: string;
    createdAt: string;
    updatedAt: string;
    messages: Array<{
      id: string;
      sender: "customer" | "admin" | "bot";
      body: string;
      createdAt: string;
      readByCustomer?: boolean;
      readByAdmin?: boolean;
    }>;
  };
  type CustomerMessage = {
    id: string;
    tenant_id: string;
    title: string;
    body: string;
    type: "promotion" | "notice";
    raffleId?: string;
    mediaUrl?: string;
    mediaType?: "image" | "video" | "youtube" | "vimeo" | "bunny";
    videoConfig?: {
      enabled: boolean;
      autoplay: boolean;
      allowPause: boolean;
      allowMute: boolean;
      allowRewind: boolean;
      startMuted: boolean;
      tapToUnmute: boolean;
      tapToTogglePlay?: boolean;
      unmuteOnViewMotion: boolean;
      pauseAudioOnScroll: boolean;
      initialVolume: number;
      showControls: boolean;
    };
    ctaLabel?: string;
    ctaUrl?: string;
    createdAt: string;
    createdBy: "admin";
    target: "all" | "customer";
    customerId?: string;
    readBy: string[];
  };
  type AffiliateRecord = {
    tenant_id: string;
    refCode: string;
    customerId?: string;
    clicks: number;
    conversions: number;
    referredCustomers: number;
    revenue: number;
    commission: number;
    commissionBalance: number;
    prizeBalance: number;
    pixKey?: string;
    useCustomCommission: boolean;
    customCommissionRate?: number;
    useBalanceForPurchases: boolean;
    enabled: boolean;
    history: AffiliateLedger[];
    performanceRewards?: AffiliatePerformanceRewardLedger[];
    performanceRewardBalances?: Partial<Record<AffiliateRewardType, number>>;
    performanceRewardConsumptions?: AffiliateRewardConsumptionLedger[];
  };
  type CustomerRecord = {
    id: string;
    tenant_id: string;
    name: string;
    phone: string;
    cpf: string;
    browserId?: string;
    accessPassword?: string;
    photoUrl?: string;
    createdAt: string;
    totalTickets: number;
    affiliateRefCode: string;
    referredBy?: string;
    city?: string;
    state?: string;
    latitude?: number;
    longitude?: number;
    blocked?: boolean;
    blockedReason?: string;
    gatewayCustomerIds?: Record<string, string>;
  };
  type CrmContactStatus = "lead" | "comprador" | "vip" | "inativo" | "bloqueado";
  type CrmPipelineStage = "novo lead" | "interessado" | "comprou" | "recorrente" | "vip" | "inativo" | "perdido";
  type CrmContactRecord = {
    id: string;
    tenant_id: string;
    customer_id?: string;
    nome: string;
    telefone: string;
    email?: string;
    cpf_mascarado: string;
    cidade?: string;
    estado?: string;
    origem: string;
    tags: string[];
    score: number;
    status: CrmContactStatus;
    pipeline_stage: CrmPipelineStage;
    last_purchase_at?: string;
    total_spent: number;
    total_orders: number;
    notes: string;
    created_at: string;
    updated_at: string;
  };
  type CrmContactOverride = Partial<Pick<CrmContactRecord, "origem" | "tags" | "score" | "status" | "pipeline_stage" | "notes" | "email">> & {
    updated_at?: string;
  };
  type PixGatewayId = "mercadopago" | "pagbank" | "asaas" | "infinitypay" | "pay2m" | "cora" | "primepag" | "paggue" | "cashpay" | "fakeprocessor" | "sandbox" | "mock";
  type RafflePixConfig = {
    inheritGlobal: boolean;
    enabled: boolean;
    gateway: PixGatewayId | string;
    sandbox: boolean;
    pixKey?: string;
    apiKey?: string;
    accessToken?: string;
    publicKey?: string;
    clientId?: string;
    clientSecret?: string;
    webhookUrl?: string;
    webhookSecret?: string;
    webhookEvents?: string;
  };
  type PaymentGatewayConfigRecord = {
    id: string;
    tenant_id: string;
    provider: PixGatewayId | string;
    display_name?: string;
    enabled: boolean;
    environment: "sandbox" | "production" | "mock" | string;
    credentials: Record<string, unknown>;
    webhook_secret?: string;
    pix_key?: string;
    priority: number;
    is_default: boolean;
    config_json?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };
  type PaymentRecord = {
    id: string;
    tenant_id: string;
    order_id: string;
    provider: PixGatewayId | string;
    asaas_payment_id?: string;
    provider_payment_id?: string;
    provider_reference?: string;
    qr_code_url?: string;
    ticket_url?: string;
    txid?: string;
    billing_type: "PIX" | string;
    status: string;
    qr_code_base64?: string;
    pix_payload?: string;
    pix_copy_paste?: string;
    end_to_end?: string;
    paid_at?: string;
    expiration_date?: string;
    raw_response: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };

  const encryptedGatewayValuePrefix = "enc:v1:";
  const gatewaySensitiveFieldPattern = /(api[_-]?key|secret|client[_-]?secret|token|password|credential|pix[_-]?key|access[_-]?token|webhook[_-]?secret)/i;

  function getGatewayCryptoKey() {
    const keyMaterial = gatewayCredentialsEncryptionKey || (process.env.NODE_ENV === "production" ? "" : `${jwtSecret}:local-gateway-credentials`);
    if (!keyMaterial) {
      throw new Error("GATEWAY_CREDENTIALS_ENCRYPTION_KEY ausente; nao e seguro salvar credenciais de gateway.");
    }
    return createHash("sha256").update(keyMaterial).digest();
  }

  function isEncryptedGatewayValue(value: unknown) {
    return typeof value === "string" && value.startsWith(encryptedGatewayValuePrefix);
  }

  function encryptGatewaySecret(value: unknown) {
    const plainText = String(value ?? "");
    if (!plainText || isEncryptedGatewayValue(plainText) || plainText === "********") return plainText;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", getGatewayCryptoKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${encryptedGatewayValuePrefix}${Buffer.concat([iv, tag, encrypted]).toString("base64url")}`;
  }

  function decryptGatewaySecret(value: unknown) {
    const encryptedValue = String(value ?? "");
    if (!isEncryptedGatewayValue(encryptedValue)) return encryptedValue;
    const payload = Buffer.from(encryptedValue.slice(encryptedGatewayValuePrefix.length), "base64url");
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", getGatewayCryptoKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }

  function encryptGatewayCredentialObject(credentials: Record<string, unknown> = {}) {
    return Object.fromEntries(Object.entries(credentials).map(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return [key, encryptGatewayCredentialObject(value as Record<string, unknown>)];
      }
      return [key, value ? encryptGatewaySecret(value) : value];
    }));
  }

  function decryptGatewayCredentialObject(credentials: Record<string, unknown> = {}) {
    return Object.fromEntries(Object.entries(credentials).map(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return [key, decryptGatewayCredentialObject(value as Record<string, unknown>)];
      }
      return [key, decryptGatewaySecret(value)];
    }));
  }

  function maskGatewaySecret(value: unknown) {
    const decrypted = decryptGatewaySecret(value);
    if (!decrypted) return "";
    const visible = decrypted.length <= 4 ? decrypted.length : 4;
    return `${"*".repeat(Math.max(4, decrypted.length - visible))}${decrypted.slice(-visible)}`;
  }

  function isMaskedGatewaySecret(value: unknown) {
    return typeof value === "string" && value.includes("*") && !isEncryptedGatewayValue(value);
  }

  function mergeGatewaySectionPreservingSecrets(current: Record<string, unknown>, incoming: Record<string, unknown> = {}) {
    const merged = { ...current };
    for (const [key, value] of Object.entries(incoming)) {
      merged[key] = gatewaySensitiveFieldPattern.test(key) && isMaskedGatewaySecret(value) ? current[key] : value;
    }
    return merged;
  }

  function maskGatewayCredentials(credentials: Record<string, unknown> = {}) {
    return Object.fromEntries(Object.entries(credentials).map(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return [key, maskGatewayCredentials(value as Record<string, unknown>)];
      }
      if (!value) return [key, ""];
      return [key, gatewaySensitiveFieldPattern.test(key) ? maskGatewaySecret(value) : decryptGatewaySecret(value)];
    }));
  }

  function decryptPaymentGatewayConfig(config: PaymentGatewayConfigRecord): PaymentGatewayConfigRecord {
    return {
      ...config,
      credentials: decryptGatewayCredentialObject(config.credentials || {}),
      webhook_secret: decryptGatewaySecret(config.webhook_secret || ""),
      pix_key: decryptGatewaySecret(config.pix_key || "")
    };
  }

  function sanitizePaymentGatewayConfig(config: PaymentGatewayConfigRecord): PaymentGatewayConfigRecord {
    return {
      ...config,
      credentials: maskGatewayCredentials(config.credentials || {}),
      webhook_secret: config.webhook_secret ? maskGatewaySecret(config.webhook_secret) : "",
      pix_key: config.pix_key ? maskGatewaySecret(config.pix_key) : ""
    };
  }
  type PurchaseRecord = {
    purchaseId: string;
    tenant_id: string;
    raffleId: string;
    contact: string;
    tickets: number;
    amount: number;
    refCode?: string;
    status: "pending" | "paid" | "cancelled";
    numeros: number[];
    reservedUntil?: string;
    pixExpiresAt?: string;
    pixPayload: string;
    pixGateway?: PixGatewayId | string;
    pixWebhookUrl?: string;
    externalReference?: string;
    externalPaymentId?: string;
    pixQrCodeBase64?: string;
    createdAt: string;
    customer?: CustomerRecord;
    linkedPurchases?: PurchaseRecord[];
    paidWithBalance?: number;
    premiosInstantaneos?: typeof instantPrizes;
    earnedLootboxes?: number;
    paymentHistory?: Array<{ status: string; label: string; date: string; admin?: boolean; reason?: string }>;
    rejectedReason?: string;
    couponCode?: string;
    discountAmount?: number;
    bonusTickets?: number;
    promotionSummary?: PromotionSummary;
    ticketWeights?: Array<{ number: number; weight: number; reason?: string }>;
    gamification?: {
      orderBump?: { offered: boolean; accepted: boolean; tickets: number; discountPercent: number; amount: number };
      luckyHour?: { applied: boolean; type?: string; value?: number; bonusTickets?: number; discount?: number; extraChance?: number };
      doubleTickets?: { applied: boolean; bonusTickets: number; minTickets: number; label: string };
      doubleChance?: { applied: boolean; weight: number };
      scratchcardEventId?: string;
      mysteryBoxEventId?: string;
      autoPrizes?: string[];
    };
  };
  type GamificationModuleId = "scratchcard" | "winningTicket" | "luckyHour" | "mysteryBox" | "doubleTickets" | "doubleChance" | "extremeTickets" | "buyerRanking" | "orderBump";
  type GamificationPrize = { id: string; name: string; type: "pix" | "bonus" | "product" | "empty"; value: number; stock: number; probability?: number };
  type GamificationConfig = {
    tenant_id: string;
    raffleId: string;
    status: "active" | "inactive";
    modules: Record<GamificationModuleId, boolean>;
    scratchcard: { prizes: GamificationPrize[]; winProbability: number };
    winningTicket: { prizes: Array<{ id: string; number: number; prize: string; value: number; status: "available" | "claimed" }> };
    luckyHour: { windows: Array<{ id: string; startsAt: string; endsAt: string; type: "bonus" | "discount" | "extraChance"; value: number; active: boolean }> };
    mysteryBox: { boxes: Array<{ id: string; label: string; prize: string; type: "pix" | "bonus" | "empty"; value: number; status: "available" | "opened" }> };
    doubleTickets: { startsAt: string; endsAt: string; minTickets: number; maxUsesPerCustomer: number; packageQuantities: number[]; label: string };
    doubleChance: { startsAt: string; endsAt: string; minTickets: number; weight: number };
    extremeTickets: { enabled: boolean; highPrize: string; lowPrize: string };
    buyerRanking: { visible: boolean; metric: "tickets" | "amount"; limit: number };
    orderBump: { enabled: boolean; tickets: number; discountPercent: number; label: string };
  };
  type GamificationEvent = {
    tenant_id: string;
    id: string;
    raffleId: string;
    purchaseId: string;
    customerId?: string;
    module: GamificationModuleId;
    status: "available" | "pending" | "won" | "lost" | "opened" | "skipped" | "claimed";
    result?: Record<string, unknown>;
    createdAt: string;
    resolvedAt?: string;
  };
  type GamificationWinner = {
    tenant_id: string;
    id: string;
    raffleId: string;
    purchaseId: string;
    customerId?: string;
    module: GamificationModuleId;
    prize: string;
    value: number;
    number?: number;
    createdAt: string;
  };
  type PublicActivityEventType = "purchase_created" | "purchase_approved" | "instant_prize" | "mystery_box" | "new_affiliate" | "raffle_ending";
  type PublicActivityEventRecord = {
    id: string;
    tenant_id: string;
    raffle_id: string;
    event_type: PublicActivityEventType;
    display_name_masked: string;
    amount: number;
    quantity: number;
    metadata: Record<string, unknown>;
    visible: boolean;
    created_at: string;
  };
  type FazendinhaStatus = "available" | "reserved" | "sold";
  type FazendinhaRoundStatus = "active" | "paused" | "closed";
  type FazendinhaGroup = {
    id: string;
    tenant_id: string;
    nomeBicho: string;
    numeros: string[];
    imagemUrl?: string;
    status: FazendinhaStatus;
    preco: number;
    compradorId?: string;
    compraId?: string;
  };
  type FazendinhaPurchase = {
    id: string;
    tenant_id: string;
    usuarioId: string;
    grupoId: string;
    grupoIds?: string[];
    nomeBicho: string;
    nomeBichos?: string[];
    numeros: string[];
    valorPago: number;
    statusPagamento: "reserved" | "paid" | "cancelled";
    paymentStatus?: "pending" | "paid" | "cancelled";
    paidAt?: string | null;
    confirmedAt?: string | null;
    dataCompra: string;
    reservedUntil?: string;
    pixExpiresAt?: string;
    customer: CustomerRecord;
    refCode?: string;
    earnedLootboxes?: number;
    linkedPurchases?: PurchaseRecord[];
  };
  type FazendinhaWinner = {
    id: string;
    tenant_id: string;
    usuarioId?: string;
    grupoId?: string;
    nomeBicho?: string;
    numeroSorteado: string;
    premio: string;
    data: string;
    semGanhador?: boolean;
  };
  type NumberModeId = "dezena" | "centena" | "milhar";
  type GameRoundStatus = "active" | "paused" | "closed";
  type NumberModeConfig = {
    id: NumberModeId;
    tenant_id: string;
    enabled: boolean;
    name: string;
    description: string;
    mediaUrl: string;
    mediaType: "image" | "video" | "youtube" | "vimeo" | "bunny";
    digits: number;
    price: number;
    prize: string;
    drawDate: string;
    resultNumber: string;
    status: GameRoundStatus;
    lootboxEnabled: boolean;
    lootboxConfig?: LootboxEconomy;
  };
  type NumberModeBet = {
    id: string;
    tenant_id: string;
    mode: NumberModeId;
    number: string;
    purchaseId: string;
    customerId: string;
    status: "reserved" | "paid" | "cancelled";
    createdAt: string;
    reservedUntil?: string;
    pixExpiresAt?: string;
  };
  type NumberModePurchase = {
    id: string;
    tenant_id: string;
    mode: NumberModeId;
    numbers: string[];
    amount: number;
    status: "reserved" | "paid" | "cancelled";
    paymentStatus?: "pending" | "paid" | "cancelled";
    paidAt?: string | null;
    confirmedAt?: string | null;
    createdAt: string;
    reservedUntil?: string;
    pixExpiresAt?: string;
    customer: CustomerRecord;
    refCode?: string;
    earnedLootboxes?: number;
  };
  type NumberModeWinner = {
    id: string;
    tenant_id: string;
    mode: NumberModeId;
    number: string;
    prize: string;
    origemResultado?: string;
    customer?: CustomerRecord;
    purchaseId?: string;
    createdAt: string;
    semGanhador?: boolean;
  };
  type AuditEventLedgerRecord = {
    id: string;
    tenant_id?: string;
    actor_user_id?: string;
    actor_role?: string;
    action: string;
    resource_type: string;
    resource_id?: string;
    before_data?: unknown;
    after_data?: unknown;
    reason: string;
    ip_address?: string;
    user_agent?: string;
    request_id?: string;
    hash: string;
    previous_hash?: string;
    created_at: string;
  };
  type TicketAdjustmentRecord = {
    id: string;
    tenant_id: string;
    order_id: string;
    customer_id?: string;
    raffle_id: string;
    adjustment_type: "add" | "remove" | "swap" | "move";
    old_numbers: number[];
    new_numbers: number[];
    reason: string;
    financial_impact: number;
    actor_user_id?: string;
    created_at: string;
  };
  type WalletLedgerRecord = {
    id: string;
    tenant_id: string;
    customer_id?: string;
    affiliate_ref?: string;
    source_type: "purchase" | "affiliate_commission" | "cashback" | "instant_prize" | "manual_credit" | "manual_debit" | "withdrawal_requested" | "withdrawal_approved" | "withdrawal_rejected" | "refund" | "ticket_adjustment";
    source_id?: string;
    amount: number;
    reason: string;
    actor_user_id?: string;
    created_at: string;
  };
  type RaffleDrawAuditRecord = {
    id: string;
    tenant_id: string;
    raffle_id: string;
    status?: "prepared" | "locked" | "executed" | "published";
    draw_method: string;
    public_seed: string;
    server_seed_secret?: string;
    server_seed_hash: string;
    server_seed_revealed: string;
    external_reference?: string;
    eligible_numbers_hash: string;
    eligible_numbers?: number[];
    locked_at?: string;
    scheduled_at?: string;
    executed_at?: string;
    published_at?: string;
    nonce?: number;
    verification_payload?: Record<string, unknown>;
    winning_number: string;
    algorithm_version: string;
    result_hash: string;
    audit_pdf_url?: string;
    created_at: string;
  };
  type ReportExportStatus = "generated" | "failed";
  type ReportExportRecord = {
    id: string;
    tenant_id: string | null;
    report_type: string;
    filters: Record<string, unknown>;
    format: "pdf" | "csv" | "xlsx";
    file_url: string;
    file_hash: string;
    generated_by: string;
    status: ReportExportStatus;
    request_id: string;
    qr_validation_url: string;
    created_at: string;
  };
  type CustomerConsentRecord = {
    id: string;
    tenant_id: string;
    customer_id: string;
    consent_type: string;
    status: "accepted" | "revoked";
    terms_version: string;
    ip_address?: string;
    user_agent?: string;
    created_at: string;
  };
  type DataPrivacyRequestRecord = {
    id: string;
    tenant_id: string;
    customer_id: string;
    request_type: "export" | "anonymize" | "block" | "logical_delete";
    status: "requested" | "completed" | "rejected";
    reason: string;
    result?: unknown;
    created_at: string;
    completed_at?: string;
  };
  type FraudSignalRecord = {
    id: string;
    tenant_id: string;
    customer_id?: string;
    order_id?: string;
    affiliate_id?: string;
    signal_type: string;
    severity: "low" | "medium" | "high";
    score?: number;
    metadata: Record<string, unknown>;
    status: "open" | "reviewed" | "dismissed" | "blocked" | "approved";
    reviewed_by?: string;
    reviewed_at?: string;
    created_at: string;
  };
  type FraudScoreEventRecord = FraudSignalRecord;
  type FraudCaseRecord = {
    id: string;
    tenant_id: string;
    customer_id?: string;
    order_id?: string;
    affiliate_id?: string;
    signal_type: string;
    severity: "low" | "medium" | "high";
    score: number;
    metadata: Record<string, unknown>;
    status: "open" | "manual_review" | "blocked" | "approved" | "rejected" | "dismissed";
    action: "log_only" | "alert_admin" | "manual_review" | "block_checkout" | "block_withdrawal" | "block_affiliate" | "mark_customer_risk";
    reviewed_by?: string;
    reviewed_at?: string;
    created_at: string;
  };

  let lootboxGuaranteedPool: GatewayPrize[] = [];
  let lootboxGuaranteedPools: Record<string, GatewayPrize[]> = {};

  let affiliates: Record<string, AffiliateRecord> = {};
  let customersByPhone: Record<string, CustomerRecord> = {};
  let customersByCpf: Record<string, CustomerRecord> = {};
  let crmContacts: CrmContactRecord[] = [];
  let crmContactOverrides: Record<string, CrmContactOverride> = {};
  let customerMessages: CustomerMessage[] = [];
  let affiliateWithdrawals: AffiliateWithdrawal[] = [];
  let passwordResetCodes: PasswordResetCode[] = [];
  let supportTickets: SupportTicket[] = [];
  let auditLogs: AuditLog[] = [];
  let paymentWebhookLogs: PaymentWebhookLog[] = [];
  let paymentLogs: PaymentLog[] = [];
  let webhookLogs: WebhookLog[] = [];
  let gatewayHealth: GatewayHealth[] = [];
  let payments: PaymentRecord[] = [];
  let auditEventLedger: AuditEventLedgerRecord[] = [];
  let ticketAdjustments: TicketAdjustmentRecord[] = [];
  let walletLedger: WalletLedgerRecord[] = [];
  let raffleDrawAudits: RaffleDrawAuditRecord[] = [];
  let reportExports: ReportExportRecord[] = [];
  let customerConsents: CustomerConsentRecord[] = [];
  let dataPrivacyRequests: DataPrivacyRequestRecord[] = [];
  let fraudSignals: FraudSignalRecord[] = [];
  let fraudScoreEvents: FraudScoreEventRecord[] = [];
  let fraudCases: FraudCaseRecord[] = [];
  let n8nEventLogs: N8nEventLog[] = [];
  const integrationManager = new IntegrationManager();
  createDefaultProviders().forEach(provider => integrationManager.register(provider));
  const webhookService = new WebhookService();
  let integrations: IntegrationRecord[] = [];
  let integrationLogs: IntegrationLogRecord[] = [];
  let webhookEndpoints: WebhookEndpointRecord[] = [];
  let webhookEvents: WebhookEventRecord[] = [];
  let campaignCoupons: CampaignCoupon[] = [
    {
      id: "CPN_WELCOME10",
      code: "BEMVINDO10",
      name: "Boas-vindas 10%",
      type: "percent",
      value: 10,
      active: true,
      minTickets: 10,
      used: 0,
      tenant_id: legacyTenantId,
      createdAt: new Date().toISOString()
    }
  ];
  let lootboxes: Record<string, { boxes: LootboxRecord[]; history: { prize: string; date: string; won: boolean }[] }> = {};

  let raffles = [
    {
      id: "1",
      tenant_id: legacyTenantId,
      title: "Land Rover Defender 2024",
      description: "Concorra a uma Land Rover 0km. O carro dos seus sonhos!",
      price: 0.50,
      totalTickets: 100000,
      soldTickets: 35000,
      image: "https://images.unsplash.com/photo-1698651817111-a8bbffc021ac?w=800&auto=format&fit=crop&q=60",
      mediaUrl: TEST_VIDEO_URL,
      mediaType: TEST_VIDEO_MEDIA_TYPE,
      mediaAspect: "wide",
      mediaFit: "cover",
      checkoutMediaUrl: TEST_VIDEO_URL,
      checkoutMediaType: TEST_VIDEO_MEDIA_TYPE,
      checkoutMediaAspect: "wide",
      checkoutMediaFit: "contain",
      heroContentPlacement: "below",
      heroEyebrow: "Plataforma de rifas premium",
      heroTitle: "Sorteios com experiência cinematográfica.",
      heroSubtitle: "Vídeo em tela cheia, ranking ao vivo, cotas premiadas, PIX e caixinha surpresa.",
      heroPrimaryButton: "Participar agora",
      heroSecondaryText: "",
      heroShowStats: true,
      status: "active",
      drawDate: "2026-10-15T20:00:00Z",
      countdownEnabled: false,
      countdownEndAt: "",
      salesEndAt: "",
      manuallyClosedAt: "",
      countdownLabel: "",
      videoConfig: { ...settings.mainVideoPlayer },
      pixConfig: {
        inheritGlobal: true,
        enabled: true,
        gateway: "mercadopago" as PixGatewayId,
        sandbox: true,
        apiKey: "",
        webhookUrl: "",
        webhookSecret: "",
        webhookEvents: "payment.created,payment.updated,payment.paid"
      },
      n8nEnabled: false,
      lootboxEnabled: true,
      lootboxConfig: createScopedLootboxConfig(),
      soldNumbers: new Set<number>() // Added to track sold numbers
    },
    {
      id: "2",
      tenant_id: legacyTenantId,
      title: "iPhone 15 Pro Max 1TB",
      description: "O smartphone mais cobiçado da Apple.",
      price: 0.10,
      totalTickets: 50000,
      soldTickets: 48000,
      image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=60",
      mediaUrl: TEST_VIDEO_URL,
      mediaType: TEST_VIDEO_MEDIA_TYPE,
      mediaAspect: "wide",
      mediaFit: "cover",
      checkoutMediaUrl: TEST_VIDEO_URL,
      checkoutMediaType: TEST_VIDEO_MEDIA_TYPE,
      checkoutMediaAspect: "wide",
      checkoutMediaFit: "contain",
      heroContentPlacement: "below",
      heroEyebrow: "Plataforma de rifas premium",
      heroTitle: "Sorteios com experiência cinematográfica.",
      heroSubtitle: "Vídeo em tela cheia, ranking ao vivo, cotas premiadas, PIX e caixinha surpresa.",
      heroPrimaryButton: "Participar agora",
      heroSecondaryText: "",
      heroShowStats: true,
      status: "active",
      drawDate: "2026-06-01T20:00:00Z",
      countdownEnabled: false,
      countdownEndAt: "",
      salesEndAt: "",
      manuallyClosedAt: "",
      countdownLabel: "",
      videoConfig: { ...settings.mainVideoPlayer },
      pixConfig: {
        inheritGlobal: true,
        enabled: true,
        gateway: "mercadopago" as PixGatewayId,
        sandbox: true,
        apiKey: "",
        webhookUrl: "",
        webhookSecret: "",
        webhookEvents: "payment.created,payment.updated,payment.paid"
      },
      n8nEnabled: false,
      lootboxEnabled: true,
      lootboxConfig: createScopedLootboxConfig(),
      soldNumbers: new Set<number>()
    }
  ];

  let purchases: PurchaseRecord[] = [];
  let promotionRules: PromotionRule[] = [];
  let promotionUsages: PromotionUsage[] = [];
  let tenantDomains: TenantDomainRecord[] = tenants.flatMap(tenant => ([
    {
      id: createPublicId("DOM_"),
      tenant_id: tenant.id,
      domain: `${tenant.slug}.meudominio.com`,
      type: "subdomain" as const,
      status: "verified" as const,
      verification_token: createPublicId("DNS_"),
      dns_target: "cname.rifapro.local",
      ssl_status: "pending",
      is_primary: false,
      created_at: tenant.criado_em,
      verified_at: tenant.criado_em
    },
    ...(tenant.dominio_customizado ? [{
      id: createPublicId("DOM_"),
      tenant_id: tenant.id,
      domain: tenant.dominio_customizado,
      type: "custom_domain" as const,
      status: "verified" as const,
      verification_token: createPublicId("DNS_"),
      dns_target: "cname.rifapro.local",
      ssl_status: "pending",
      is_primary: true,
      created_at: tenant.criado_em,
      verified_at: tenant.criado_em
    }] : [])
  ]));
  let superadminImpersonationSessions: SuperadminImpersonationSession[] = [];
  let superadminAuditLogs: SuperadminAuditLog[] = [];
  let gamificationConfigs: GamificationConfig[] = [];
  let gamificationEvents: GamificationEvent[] = [];
  let gamificationWinners: GamificationWinner[] = [];

  let instantPrizes = [
     { id: "p1", tenant_id: legacyTenantId, raffleId: "1", numeroPremiado: 777, valorPremio: 1000, status: "available" },
     { id: "p2", tenant_id: legacyTenantId, raffleId: "1", numeroPremiado: 888, valorPremio: 500, status: "available" },
     { id: "p3", tenant_id: legacyTenantId, raffleId: "2", numeroPremiado: 1234, valorPremio: 5000, status: "available" },
  ];

  let stories = [
    { id: "s1", tenant_id: legacyTenantId, title: "Entregando o Setup!", mediaUrl: TEST_VIDEO_URL, mediaType: TEST_VIDEO_MEDIA_TYPE, duration: 15, active: true },
    { id: "s2", tenant_id: legacyTenantId, title: "Próximo Prêmio", mediaUrl: TEST_VIDEO_URL, mediaType: TEST_VIDEO_MEDIA_TYPE, duration: 15, active: true }
  ];

  let winners = [
    { id: "w1", tenant_id: legacyTenantId, raffleName: "iPhone 15 Pro Max", winnerName: "João Silva", prizeDescription: "Levou o celular com 3 cotas", mediaUrl: TEST_VIDEO_URL, mediaType: TEST_VIDEO_MEDIA_TYPE, date: "2026-05-10T12:00:00Z" }
  ];

  const fazendinhaSeed = [
    ["avestruz", "Avestruz", ["01", "02", "03", "04"]],
    ["aguia", "Águia", ["05", "06", "07", "08"]],
    ["burro", "Burro", ["09", "10", "11", "12"]],
    ["borboleta", "Borboleta", ["13", "14", "15", "16"]],
    ["cachorro", "Cachorro", ["17", "18", "19", "20"]],
    ["cabra", "Cabra", ["21", "22", "23", "24"]],
    ["carneiro", "Carneiro", ["25", "26", "27", "28"]],
    ["camelo", "Camelo", ["29", "30", "31", "32"]],
    ["cobra", "Cobra", ["33", "34", "35", "36"]],
    ["coelho", "Coelho", ["37", "38", "39", "40"]],
    ["cavalo", "Cavalo", ["41", "42", "43", "44"]],
    ["elefante", "Elefante", ["45", "46", "47", "48"]],
    ["galo", "Galo", ["49", "50", "51", "52"]],
    ["gato", "Gato", ["53", "54", "55", "56"]],
    ["jacare", "Jacaré", ["57", "58", "59", "60"]],
    ["leao", "Leão", ["61", "62", "63", "64"]],
    ["macaco", "Macaco", ["65", "66", "67", "68"]],
    ["porco", "Porco", ["69", "70", "71", "72"]],
    ["pavao", "Pavão", ["73", "74", "75", "76"]],
    ["peru", "Peru", ["77", "78", "79", "80"]],
    ["touro", "Touro", ["81", "82", "83", "84"]],
    ["tigre", "Tigre", ["85", "86", "87", "88"]],
    ["urso", "Urso", ["89", "90", "91", "92"]],
    ["veado", "Veado", ["93", "94", "95", "96"]],
    ["vaca", "Vaca", ["97", "98", "99", "00"]],
  ] as const;

  const defaultFazendinhaConfig = {
    tenant_id: legacyTenantId,
    enabled: true,
    name: "A Fazendinha",
    description: "Escolha um grupo com 4 números e torça pelo resultado final informado pelo admin.",
    pricePerGroup: 10,
    mainPrize: "R$ 1.000,00",
    drawDate: "2026-12-31T20:00:00Z",
    resultNumber: "",
    resultSource: "",
    status: "active" as FazendinhaRoundStatus,
    lootboxEnabled: true,
    lootboxConfig: createFazendinhaLootboxConfig(),
    mediaUrl: TEST_VIDEO_URL,
    mediaType: TEST_VIDEO_MEDIA_TYPE as "image" | "video" | "youtube" | "vimeo" | "bunny",
    addonSuggestionTickets: 5
  };
  type FazendinhaConfig = typeof defaultFazendinhaConfig;
  let fazendinhaConfig: FazendinhaConfig = deepClone(defaultFazendinhaConfig);
  let fazendinhaConfigs: Record<string, FazendinhaConfig> = {
    [legacyTenantId]: fazendinhaConfig
  };
  type FazendinhaHomeMediaSettings = {
    tenant_id: string;
    enabled: boolean;
    mediaUrl: string;
    mediaType: "image" | "video" | "gif" | "youtube" | "vimeo" | "bunny";
    posterUrl: string;
    title: string;
    description: string;
    fitMode: "auto" | "contain" | "cover";
    alt: string;
    altText: string;
    linkUrl: string;
    linkTarget: "_self" | "_blank";
    position: "above-fazendinha" | "home-banner" | "checkout";
    updated_at: string;
  };
  type FazendinhaPremiumExperienceSettings = {
    premiumInfoEnabled: boolean;
    premiumTitle: string;
    premiumDescription: string;
    premiumHighlight: string;
    caixinhaHighlightEnabled: boolean;
    caixinhaTitle: string;
    caixinhaDescription: string;
    caixinhaPrizeValue: string;
    caixinhaIcon: string;
    extractionEnabled: boolean;
    extractionTime: string;
    extractionText: string;
    prizeLabel: string;
    prizeValue: string;
    ticketPriceLabel: string;
    ticketPriceValue: string;
    ctaLabel: string;
    ctaSubtitle: string;
  };
  type FazendinhaMediaSettings = {
    tenant_id: string;
    homeBanner: FazendinhaHomeMediaSettings;
    checkoutMedia: FazendinhaHomeMediaSettings;
    premiumExperience: FazendinhaPremiumExperienceSettings;
    updated_at: string;
  };
  const fazendinhaHomeMediaSettings: Record<string, FazendinhaHomeMediaSettings> = {};
  const fazendinhaCheckoutMediaSettings: Record<string, FazendinhaHomeMediaSettings> = {};
  const fazendinhaPremiumExperienceSettings: Record<string, FazendinhaPremiumExperienceSettings> = {};
  function defaultFazendinhaHomeMedia(tenantId: string): FazendinhaHomeMediaSettings {
    return {
      tenant_id: tenantId,
      enabled: false,
      mediaUrl: "",
      mediaType: "image",
      posterUrl: "",
      title: "A Fazendinha",
      description: "",
      fitMode: "auto",
      alt: "Mídia da Fazendinha",
      altText: "Mídia da Fazendinha",
      linkUrl: "",
      linkTarget: "_self",
      position: "home-banner",
      updated_at: new Date().toISOString()
    };
  }
  function defaultFazendinhaCheckoutMedia(tenantId: string): FazendinhaHomeMediaSettings {
    return {
      tenant_id: tenantId,
      enabled: false,
      mediaUrl: "",
      mediaType: "image",
      posterUrl: "",
      title: "Resumo da Fazendinha",
      description: "",
      fitMode: "auto",
      alt: "Mídia do checkout da Fazendinha",
      altText: "Mídia do checkout da Fazendinha",
      linkUrl: "",
      linkTarget: "_self",
      position: "checkout",
      updated_at: new Date().toISOString()
    };
  }
  function defaultFazendinhaPremiumExperience(tenantId: string): FazendinhaPremiumExperienceSettings {
    const config = getFazendinhaConfig(tenantId);
    return {
      premiumInfoEnabled: true,
      premiumTitle: "Escolha seus bichinhos da sorte",
      premiumDescription: "Participe da modalidade especial com grupos rápidos, PIX automático e experiência premium.",
      premiumHighlight: "Concorra com chances extras, prêmios instantâneos e caixinha premiada.",
      caixinhaHighlightEnabled: true,
      caixinhaTitle: "Caixinha Premiada",
      caixinhaDescription: "Compras confirmadas podem liberar uma caixinha com prêmio surpresa.",
      caixinhaPrizeValue: String(config.lootboxConfig?.prizeName || "Prêmio instantâneo"),
      caixinhaIcon: "🎁",
      extractionEnabled: true,
      extractionTime: "",
      extractionText: "Próxima extração",
      prizeLabel: "Prêmio",
      prizeValue: String(config.mainPrize || "Prêmio principal"),
      ticketPriceLabel: "Cada bichinho por apenas",
      ticketPriceValue: String(config.pricePerGroup || ""),
      ctaLabel: "Participar da Fazendinha",
      ctaSubtitle: "Escolha seus bichinhos e revise a compra antes do PIX."
    };
  }
  function normalizeFazendinhaMediaSlot(tenantId: string, input: Partial<FazendinhaHomeMediaSettings> = {}, current: FazendinhaHomeMediaSettings, position: FazendinhaHomeMediaSettings["position"]) {
    const mediaType = String(input.mediaType || current.mediaType || "image").toLowerCase();
    const fitMode = String(input.fitMode || current.fitMode || "auto").toLowerCase();
    const fallbackAlt = position === "checkout" ? "Mídia do checkout da Fazendinha" : "Mídia da Fazendinha";
    return {
      ...current,
      tenant_id: tenantId,
      enabled: Boolean(input.enabled ?? current.enabled),
      mediaUrl: String(input.mediaUrl ?? current.mediaUrl ?? "").trim(),
      mediaType: (["image", "video", "gif", "youtube", "vimeo", "bunny"].includes(mediaType) ? mediaType : "image") as FazendinhaHomeMediaSettings["mediaType"],
      posterUrl: String(input.posterUrl ?? current.posterUrl ?? "").trim(),
      title: String(input.title ?? current.title ?? "A Fazendinha").slice(0, 120),
      description: String(input.description ?? current.description ?? "").slice(0, 280),
      fitMode: (["auto", "contain", "cover"].includes(fitMode) ? fitMode : "auto") as FazendinhaHomeMediaSettings["fitMode"],
      alt: String(input.altText ?? input.alt ?? current.altText ?? current.alt ?? fallbackAlt).slice(0, 160),
      altText: String(input.altText ?? input.alt ?? current.altText ?? current.alt ?? fallbackAlt).slice(0, 160),
      linkUrl: sanitizeThemeUrl(input.linkUrl ?? current.linkUrl ?? ""),
      linkTarget: input.linkTarget === "_blank" || current.linkTarget === "_blank" ? "_blank" as const : "_self" as const,
      position,
      updated_at: new Date().toISOString()
    };
  }
  function normalizeFazendinhaPremiumExperience(tenantId: string, input: Partial<FazendinhaPremiumExperienceSettings> = {}) {
    const current = fazendinhaPremiumExperienceSettings[tenantId] || defaultFazendinhaPremiumExperience(tenantId);
    return {
      ...current,
      premiumInfoEnabled: Boolean(input.premiumInfoEnabled ?? current.premiumInfoEnabled),
      premiumTitle: String(input.premiumTitle ?? current.premiumTitle).slice(0, 140),
      premiumDescription: String(input.premiumDescription ?? current.premiumDescription).slice(0, 320),
      premiumHighlight: String(input.premiumHighlight ?? current.premiumHighlight).slice(0, 240),
      caixinhaHighlightEnabled: Boolean(input.caixinhaHighlightEnabled ?? current.caixinhaHighlightEnabled),
      caixinhaTitle: String(input.caixinhaTitle ?? current.caixinhaTitle).slice(0, 120),
      caixinhaDescription: String(input.caixinhaDescription ?? current.caixinhaDescription).slice(0, 280),
      caixinhaPrizeValue: String(input.caixinhaPrizeValue ?? current.caixinhaPrizeValue).slice(0, 120),
      caixinhaIcon: String(input.caixinhaIcon ?? (current.caixinhaIcon || "🎁")).slice(0, 8),
      extractionEnabled: Boolean(input.extractionEnabled ?? current.extractionEnabled),
      extractionTime: String(input.extractionTime ?? current.extractionTime).slice(0, 40),
      extractionText: String(input.extractionText ?? current.extractionText).slice(0, 120),
      prizeLabel: String(input.prizeLabel ?? current.prizeLabel).slice(0, 80),
      prizeValue: String(input.prizeValue ?? current.prizeValue).slice(0, 120),
      ticketPriceLabel: String(input.ticketPriceLabel ?? current.ticketPriceLabel).slice(0, 100),
      ticketPriceValue: String(input.ticketPriceValue ?? current.ticketPriceValue).slice(0, 80),
      ctaLabel: String(input.ctaLabel ?? current.ctaLabel).slice(0, 80),
      ctaSubtitle: String(input.ctaSubtitle ?? current.ctaSubtitle).slice(0, 180)
    };
  }
  function normalizeFazendinhaHomeMedia(tenantId: string, input: Partial<FazendinhaHomeMediaSettings> = {}) {
    const current = fazendinhaHomeMediaSettings[tenantId] || defaultFazendinhaHomeMedia(tenantId);
    return normalizeFazendinhaMediaSlot(tenantId, input, current, "home-banner");
  }
  function normalizeFazendinhaCheckoutMedia(tenantId: string, input: Partial<FazendinhaHomeMediaSettings> = {}) {
    const current = fazendinhaCheckoutMediaSettings[tenantId] || defaultFazendinhaCheckoutMedia(tenantId);
    return normalizeFazendinhaMediaSlot(tenantId, input, current, "checkout");
  }
  function getFazendinhaHomeMedia(tenantId: string) {
    fazendinhaHomeMediaSettings[tenantId] ||= defaultFazendinhaHomeMedia(tenantId);
    return fazendinhaHomeMediaSettings[tenantId];
  }
  function getFazendinhaCheckoutMedia(tenantId: string) {
    fazendinhaCheckoutMediaSettings[tenantId] ||= defaultFazendinhaCheckoutMedia(tenantId);
    return fazendinhaCheckoutMediaSettings[tenantId];
  }
  function publicFazendinhaHomeMedia(tenantId: string) {
    const { enabled, mediaUrl, mediaType, posterUrl, title, description, fitMode, alt, altText, linkUrl, linkTarget } = getFazendinhaHomeMedia(tenantId);
    return { enabled, mediaUrl, mediaType, posterUrl, title, description, fitMode, alt, altText, linkUrl, linkTarget, position: "home-banner" as const };
  }
  function publicFazendinhaCheckoutMedia(tenantId: string) {
    const { enabled, mediaUrl, mediaType, posterUrl, title, description, fitMode, alt, altText } = getFazendinhaCheckoutMedia(tenantId);
    return { enabled, mediaUrl, mediaType, posterUrl, title, description, fitMode, alt, altText, position: "checkout" as const };
  }
  function publicFazendinhaMediaSettings(tenantId: string) {
    fazendinhaPremiumExperienceSettings[tenantId] ||= defaultFazendinhaPremiumExperience(tenantId);
    return {
      homeBanner: publicFazendinhaHomeMedia(tenantId),
      checkoutMedia: publicFazendinhaCheckoutMedia(tenantId),
      premiumExperience: fazendinhaPremiumExperienceSettings[tenantId]
    };
  }
  function normalizeFazendinhaMediaSettings(tenantId: string, input: Partial<FazendinhaMediaSettings> = {}) {
    fazendinhaHomeMediaSettings[tenantId] = normalizeFazendinhaHomeMedia(tenantId, input.homeBanner || {});
    fazendinhaCheckoutMediaSettings[tenantId] = normalizeFazendinhaCheckoutMedia(tenantId, input.checkoutMedia || {});
    fazendinhaPremiumExperienceSettings[tenantId] = normalizeFazendinhaPremiumExperience(tenantId, input.premiumExperience || {});
    return publicFazendinhaMediaSettings(tenantId);
  }
  let fazendinhaGroups: FazendinhaGroup[] = fazendinhaSeed.map(([id, nomeBicho, numeros]) => ({
    id,
    tenant_id: legacyTenantId,
    nomeBicho,
    numeros: [...numeros],
    status: "available",
    preco: getFazendinhaConfig(legacyTenantId).pricePerGroup,
    imagemUrl: ""
  }));
  let fazendinhaCompras: FazendinhaPurchase[] = [];
  let fazendinhaResultados: Array<{ id: string; tenant_id: string; numeroSorteado: string; origemResultado: string; dataResultado: string; adminId?: string }> = [];
  let fazendinhaGanhadores: FazendinhaWinner[] = [];

  let numberModeConfigs: Record<NumberModeId, NumberModeConfig> = {
    dezena: {
      id: "dezena",
      tenant_id: legacyTenantId,
      enabled: true,
      name: "Dezena",
      description: "Escolha números de 00 a 99 e concorra pela dezena final do resultado oficial.",
      mediaUrl: TEST_VIDEO_URL,
      mediaType: TEST_VIDEO_MEDIA_TYPE,
      digits: 2,
      price: 2,
      prize: "R$ 100,00",
      drawDate: "2026-12-31T20:00:00Z",
      resultNumber: "",
      status: "active",
      lootboxEnabled: true,
      lootboxConfig: createScopedLootboxConfig()
    },
    centena: {
      id: "centena",
      tenant_id: legacyTenantId,
      enabled: true,
      name: "Centena",
      description: "Escolha números de 000 a 999 e concorra pela centena final do resultado oficial.",
      mediaUrl: TEST_VIDEO_URL,
      mediaType: TEST_VIDEO_MEDIA_TYPE,
      digits: 3,
      price: 3,
      prize: "R$ 500,00",
      drawDate: "2026-12-31T20:00:00Z",
      resultNumber: "",
      status: "active",
      lootboxEnabled: true,
      lootboxConfig: createScopedLootboxConfig()
    },
    milhar: {
      id: "milhar",
      tenant_id: legacyTenantId,
      enabled: true,
      name: "Milhar",
      description: "Escolha números de 0000 a 9999 e concorra pela milhar completa.",
      mediaUrl: TEST_VIDEO_URL,
      mediaType: TEST_VIDEO_MEDIA_TYPE,
      digits: 4,
      price: 5,
      prize: "R$ 5.000,00",
      drawDate: "2026-12-31T20:00:00Z",
      resultNumber: "",
      status: "active",
      lootboxEnabled: true,
      lootboxConfig: createScopedLootboxConfig()
    }
  };
  let numberModePurchases: NumberModePurchase[] = [];
  let numberModeBets: NumberModeBet[] = [];
  let numberModeWinners: NumberModeWinner[] = [];

  const numberModeIds: NumberModeId[] = ["dezena", "centena", "milhar"];

  function numberModeConfigKey(tenantId: string, mode: NumberModeId) {
    return `${tenantId}:${mode}`;
  }

  function cloneNumberModeConfigForTenant(config: NumberModeConfig, tenantId: string): NumberModeConfig {
    return {
      ...deepClone(config),
      tenant_id: tenantId,
      lootboxConfig: createScopedLootboxConfig(config.lootboxConfig)
    };
  }

  function ensureNumberModeConfigsForTenant(tenantId: string) {
    numberModeIds.forEach(mode => {
      const key = numberModeConfigKey(tenantId, mode);
      if (!numberModeConfigs[key]) {
        const base = numberModeConfigs[mode] || Object.values(numberModeConfigs).find(config => config.id === mode);
        if (base) numberModeConfigs[key] = cloneNumberModeConfigForTenant(base, tenantId);
      }
    });
  }

  function getNumberModeConfig(tenantId: string, mode: NumberModeId) {
    ensureNumberModeConfigsForTenant(tenantId);
    return numberModeConfigs[numberModeConfigKey(tenantId, mode)] || numberModeConfigs[mode];
  }

  function getNumberModeConfigsForTenant(tenantId: string) {
    ensureNumberModeConfigsForTenant(tenantId);
    return numberModeIds
      .map(mode => getNumberModeConfig(tenantId, mode))
      .filter((config): config is NumberModeConfig => Boolean(config));
  }

  function cloneFazendinhaConfigForTenant(config: Partial<FazendinhaConfig>, tenantId: string): FazendinhaConfig {
    return {
      ...deepClone(defaultFazendinhaConfig),
      ...deepClone(config),
      tenant_id: tenantId,
      lootboxConfig: createFazendinhaLootboxConfig(config.lootboxConfig)
    };
  }

  function getFazendinhaConfig(tenantId: string) {
    if (!fazendinhaConfigs[tenantId]) {
      const source = tenantId === legacyTenantId
        ? (fazendinhaConfigs[legacyTenantId] || fazendinhaConfig || defaultFazendinhaConfig)
        : defaultFazendinhaConfig;
      fazendinhaConfigs[tenantId] = cloneFazendinhaConfigForTenant(source, tenantId);
    }
    if (tenantId === legacyTenantId) fazendinhaConfig = fazendinhaConfigs[tenantId];
    return fazendinhaConfigs[tenantId];
  }

  function updateFazendinhaConfig(tenantId: string, input: Partial<FazendinhaConfig>) {
    const current = getFazendinhaConfig(tenantId);
    const next = cloneFazendinhaConfigForTenant({
      ...current,
      ...normalizeMediaPayload(input),
      lootboxConfig: createFazendinhaLootboxConfig(input.lootboxConfig || current.lootboxConfig)
    }, tenantId);
    fazendinhaConfigs[tenantId] = next;
    if (tenantId === legacyTenantId) fazendinhaConfig = next;
    return next;
  }

  function replaceFazendinhaConfigs(value: unknown) {
    const incoming = value && typeof value === "object" ? value as Record<string, Partial<FazendinhaConfig>> : {};
    Object.keys(fazendinhaConfigs).forEach(key => delete fazendinhaConfigs[key]);
    Object.entries(incoming).forEach(([tenantId, config]) => {
      if (tenantId) fazendinhaConfigs[tenantId] = cloneFazendinhaConfigForTenant(config || {}, tenantId);
    });
    fazendinhaConfigs[legacyTenantId] ||= cloneFazendinhaConfigForTenant(fazendinhaConfig || defaultFazendinhaConfig, legacyTenantId);
    fazendinhaConfig = fazendinhaConfigs[legacyTenantId];
  }

  function ensureFazendinhaConfigsForKnownTenants() {
    tenants.forEach(tenant => getFazendinhaConfig(tenant.id));
  }

  function ensureFazendinhaStateForTenant(tenantId: string) {
    const config = getFazendinhaConfig(tenantId);
    const hasGroups = fazendinhaGroups.some(group => group.tenant_id === tenantId);
    if (!hasGroups) {
      fazendinhaGroups.push(...fazendinhaSeed.map(([id, nomeBicho, numeros]) => ({
        id: `${tenantId}:${id}`,
        tenant_id: tenantId,
        nomeBicho,
        numeros: [...numeros],
        status: "available" as FazendinhaStatus,
        preco: config.pricePerGroup,
        imagemUrl: ""
      })));
    }
  }

  // === Anti-Fraud System ===
  const allTenantFeatureFlags: TenantFeatureFlag[] = ["crm", "automations", "advanced_affiliates", "wallet", "provably_fair", "reports_pdf", "public_api", "pwa", "custom_theme", "whatsapp_automation", "realtime_social_proof"];
  const planCatalog: Record<SaaSPlanId, SaaSPlan> = {
    starter: {
      id: "starter",
      nome: "Básico",
      limite_rifas: 1,
      limite_vendas_mes: 500,
      max_campaigns: 1,
      max_customers: 1000,
      max_admin_users: 2,
      max_whatsapp_messages_month: 500,
      recursos: ["checkout", "pix", "crm_basico"],
      dominio_proprio: false,
      advanced_reports: false,
      public_api: false,
      included_features: ["crm", "wallet", "whatsapp_automation"],
      integracoes_liberadas: ["smtp", "sendpulse"],
      percentual_comissao: 12
    },
    pro: {
      id: "pro",
      nome: "Profissional",
      limite_rifas: 25,
      limite_vendas_mes: 10000,
      max_campaigns: 25,
      max_customers: 20000,
      max_admin_users: 8,
      max_whatsapp_messages_month: 5000,
      recursos: ["checkout", "pix", "crm", "afiliados", "relatorios"],
      dominio_proprio: true,
      advanced_reports: true,
      public_api: false,
      included_features: ["crm", "automations", "advanced_affiliates", "wallet", "provably_fair", "reports_pdf", "custom_theme", "whatsapp_automation", "realtime_social_proof"],
      integracoes_liberadas: ["primepag", "paggue", "smtp", "sendpulse", "metaAds", "googleAds"],
      percentual_comissao: 7.5
    },
    premium: {
      id: "premium",
      nome: "Premium",
      limite_rifas: 100,
      limite_vendas_mes: 50000,
      max_campaigns: 100,
      max_customers: 100000,
      max_admin_users: 25,
      max_whatsapp_messages_month: 25000,
      recursos: ["checkout", "pix", "gamificacao", "relatorios_avancados", "afiliados", "integracoes", "webhooks"],
      dominio_proprio: true,
      advanced_reports: true,
      public_api: true,
      included_features: allTenantFeatureFlags,
      integracoes_liberadas: ["primepag", "paggue", "smtp", "sendpulse", "metaAds", "googleAds", "wetalkie", "cashPay", "nuvenda", "fkeProcessor"],
      percentual_comissao: 5
    },
    enterprise: {
      id: "enterprise",
      nome: "Empresa",
      limite_rifas: 999999,
      limite_vendas_mes: 999999,
      max_campaigns: 999999,
      max_customers: 999999,
      max_admin_users: 999999,
      max_whatsapp_messages_month: 999999,
      recursos: ["checkout", "pix", "gamificacao", "relatorios_avancados", "afiliados", "integracoes", "webhooks", "white_label", "sla"],
      dominio_proprio: true,
      advanced_reports: true,
      public_api: true,
      included_features: allTenantFeatureFlags,
      integracoes_liberadas: ["primepag", "paggue", "smtp", "sendpulse", "metaAds", "googleAds", "wetalkie", "cashPay", "nuvenda", "fkeProcessor"],
      percentual_comissao: 2.5
    },
    "white-label": {
      id: "white-label",
      nome: "White Label",
      limite_rifas: 999999,
      limite_vendas_mes: 999999,
      max_campaigns: 999999,
      max_customers: 999999,
      max_admin_users: 999999,
      max_whatsapp_messages_month: 999999,
      recursos: ["checkout", "pix", "gamificacao", "relatorios_avancados", "afiliados", "integracoes", "webhooks", "white_label", "sla"],
      dominio_proprio: true,
      advanced_reports: true,
      public_api: true,
      included_features: allTenantFeatureFlags,
      integracoes_liberadas: ["primepag", "paggue", "smtp", "sendpulse", "metaAds", "googleAds", "wetalkie", "cashPay", "nuvenda", "fkeProcessor"],
      percentual_comissao: 2.5
    }
  };
  const planAliases: Record<string, SaaSPlanId> = {
    gratis: "starter",
    free: "starter",
    starter: "starter",
    basico: "starter",
    "básico": "starter",
    basic: "starter",
    pro: "pro",
    profissional: "pro",
    teste: "premium",
    premium: "premium",
    enterprise: "enterprise",
    empresa: "enterprise",
    "white-label": "white-label",
    whitelabel: "white-label",
    "white label": "white-label",
    branca: "white-label",
    "marca branca": "white-label",
    plataforma: "enterprise"
  };
  const operationalTenantStatuses: TenantRecord["status"][] = ["trial", "active", "suspended", "overdue", "maintenance", "blocked", "canceled", "inactive"];

  function getSuperadminPlanCatalog(): Array<Omit<SaaSPlan, "id"> & { id: string; canonical_id?: SaaSPlanId }> {
    return Object.values(planCatalog).map(plan => ({ ...plan, canonical_id: plan.id }));
  }
  let tenantFeatureOverrides: Record<string, Partial<Record<TenantFeatureFlag, boolean>>> = {};
  const securityLogs: SecurityLog[] = [];
  let paymentQueue: PaymentQueueJob[] = [];
  let payment_webhook_jobs: PaymentWebhookJob[] = [];
  let payment_reconciliation_jobs: PaymentReconciliationJob[] = [];
  let payment_release_jobs: PaymentReleaseJob[] = [];
  let payment_dead_letter_queue: PaymentDeadLetterJob[] = [];
  const paymentReleaseLocks = new Set<string>();
  let whatsappProviderConfigs: WhatsAppProviderConfigRecord[] = [];
  let whatsappCloudConfigs: WhatsAppCloudConfigRecord[] = [];
  let whatsappCloudLogs: WhatsAppCloudLogRecord[] = [];
  let whatsappCloudTemplates: WhatsAppCloudTemplateRecord[] = [];
  let whatsappPixRecoverySettings: WhatsAppPixRecoverySettingsRecord[] = [];
  let whatsappPurchaseConfirmationSettings: WhatsAppPurchaseConfirmationSettingsRecord[] = [];
  let whatsappCrmCampaigns: WhatsAppCrmCampaignRecord[] = [];
  let whatsappMessageQueue: WhatsAppMessageQueueRecord[] = [];
  let whatsappContacts: WhatsAppContactRecord[] = [];
  let whatsappConversations: WhatsAppConversationRecord[] = [];
  let whatsappConversationMessages: WhatsAppConversationMessageRecord[] = [];
  let whatsappOptOutEvents: WhatsAppOptOutEventRecord[] = [];
  let automationFlows: AutomationFlowRecord[] = [];
  let automationRuns: AutomationRunRecord[] = [];
  let publicActivityEvents: PublicActivityEventRecord[] = [];
  let tenantApiKeys: TenantApiKeyRecord[] = [];
  
  // Basic Rate Limiter Dictionary
  const requestCounts = new Map<string, { count: number, resetAt: number }>();

  function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
     const ip = (req.ip || req.socket.remoteAddress) as string;
     const now = Date.now();
     const windowMs = 60 * 1000; // 1 minute
     const maxRequests = 120; // Admin dashboard loads several datasets; keep bot protection without blocking normal use.

     let record = requestCounts.get(ip);
     if (!record || record.resetAt <= now) {
         record = { count: 1, resetAt: now + windowMs };
         requestCounts.set(ip, record);
     } else {
         record.count++;
     }

     if (record.count > maxRequests) {
         recordSecurityEvent({ tenant_id: "unknown", action: "RATE_LIMIT_BLOCKED", ip, status: "BLOCKED", severity: "high", detail: "Limite de requisicoes excedido" });
         res.status(429).json({ error: "Muitas requisições no painel admin. Aguarde alguns segundos." });
         return;
     }
     next();
  }

  const criticalRequestCounts = new Map<string, { count: number; resetAt: number }>();
  function criticalRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
    const ip = String(req.ip || req.socket.remoteAddress || "unknown");
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 30;
    let record = criticalRequestCounts.get(key);
    if (!record || record.resetAt <= now) {
      record = { count: 1, resetAt: now + windowMs };
      criticalRequestCounts.set(key, record);
    } else {
      record.count++;
    }
    if (record.count > maxRequests) {
      recordSecurityEvent({ tenant_id: "unknown", action: "CRITICAL_RATE_LIMIT_BLOCKED", ip, status: "BLOCKED", severity: "high", detail: `${req.method} ${req.path}` });
      res.status(429).json({ error: "Muitas tentativas. Aguarde alguns segundos." });
      return;
    }
    next();
  }

  const apiRequestCounts = new Map<string, { count: number; resetAt: number }>();
  const allTenantApiKeyScopes: TenantApiKeyScope[] = ["raffles:read", "raffles:write", "orders:read", "customers:read", "affiliates:read", "reports:read", "webhooks:write"];

  function hashTenantApiKey(apiKey: string) {
    return createHash("sha256").update(apiKey).digest("hex");
  }

  function safeCompareHash(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  function normalizeTenantApiScopes(input: unknown): TenantApiKeyScope[] {
    const values = Array.isArray(input) ? input : [];
    const scopes = values.filter(scope => allTenantApiKeyScopes.includes(String(scope) as TenantApiKeyScope)) as TenantApiKeyScope[];
    return [...new Set(scopes)];
  }

  function sanitizeTenantApiKey(record: TenantApiKeyRecord) {
    const { key_hash, ...safe } = record;
    return safe;
  }

  function generateTenantApiKey() {
    const prefix = randomBytes(4).toString("hex");
    const secret = randomBytes(24).toString("hex");
    return { prefix, plainKey: `rfp_live_${prefix}_${secret}` };
  }

  function findTenantApiKeyByPlainKey(apiKey: string) {
    const keyHash = hashTenantApiKey(apiKey);
    const prefix = apiKey.split("_")[2] || "";
    return tenantApiKeys.find(record =>
      record.active &&
      (!prefix || record.prefix === prefix) &&
      safeCompareHash(record.key_hash, keyHash) &&
      (!record.expires_at || new Date(record.expires_at).getTime() > Date.now())
    );
  }

  function getApiKeyAuth(req: express.Request) {
    return (req as express.Request & { apiKeyAuth?: TenantApiKeyAuth }).apiKeyAuth;
  }

  function apiKeyRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = getBearerToken(req);
    const bucket = token ? `key:${token.split("_").slice(0, 3).join("_")}` : `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 180;
    const record = apiRequestCounts.get(bucket);
    if (!record || record.resetAt <= now) {
      apiRequestCounts.set(bucket, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    record.count++;
    if (record.count > maxRequests) {
      recordSecurityEvent({ tenant_id: "unknown", action: "PUBLIC_API_RATE_LIMIT_BLOCKED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "BLOCKED", severity: "medium", detail: bucket });
      res.status(429).json({ error: "Limite de requisicoes da API excedido" });
      return;
    }
    next();
  }

  function requireTenantApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
    const apiKey = getBearerToken(req);
    const record = apiKey ? findTenantApiKeyByPlainKey(apiKey) : undefined;
    if (!record) {
      res.status(401).json({ error: "API key invalida, expirada ou revogada" });
      return;
    }
    const tenant = tenants.find(item => item.id === record.tenant_id);
    if (!tenant || !["active", "trial"].includes(tenant.status)) {
      res.status(403).json({ error: "Tenant indisponivel para API" });
      return;
    }
    if (!tenantHasFeature(record.tenant_id, "public_api")) {
      res.status(403).json({ error: "API publica bloqueada pelo plano atual", feature: "public_api", upgradeRequired: true });
      return;
    }
    record.last_used_at = new Date().toISOString();
    (req as express.Request & { apiKeyAuth?: TenantApiKeyAuth }).apiKeyAuth = {
      tenantId: record.tenant_id,
      keyId: record.id,
      prefix: record.prefix,
      scopes: record.scopes
    };
    next();
  }

  function requireTenantApiScope(scope: TenantApiKeyScope) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const auth = getApiKeyAuth(req);
      if (!auth || !auth.scopes.includes(scope)) {
        res.status(403).json({ error: "Escopo insuficiente para este recurso", required_scope: scope });
        return;
      }
      next();
    };
  }

  function publicAuthUser(user: AuthUserRecord) {
    return {
      id: user.id,
      email: user.email,
      user_metadata: { name: user.nome },
    };
  }

  function publicAuthProfile(user: AuthUserRecord) {
    return { role: normalizeAuthRole(user.role), name: user.nome, tenantId: user.tenant_id };
  }

  function signAuthToken(user: AuthUserRecord) {
    return jwt.sign({
      sub: user.id,
      role: normalizeAuthRole(user.role),
      tenant_id: user.tenant_id,
      email: user.email
    }, jwtSecret, { expiresIn: "8h" });
  }

  function generateTemporaryPassword() {
    return `CIFHER${randomBytes(4).toString("hex")}!`;
  }

  async function createTenantAdminUser(tenantId: string, payload: Record<string, unknown>) {
    const tenant = tenants.find(item => item.id === tenantId && isActiveTenantRecord(item));
    const nome = String(payload.nome || payload.name || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    const temporaryPassword = String(payload.password || payload.senha || "") || generateTemporaryPassword();
    const role = String(payload.role || "tenant_admin") as AuthRole;
    if (!tenant) throw new Error("Tenant operacional obrigatorio");
    if (!nome || !email.includes("@") || temporaryPassword.length < 8) {
      throw new Error("Nome, email e senha com 8 caracteres sao obrigatorios");
    }
    if (!["tenant_admin", "admin", "operador", "tenant_user", "afiliado"].includes(role)) {
      throw new Error("Papel invalido para usuario do tenant");
    }
    if (authUsers.some(item => item.email === email)) {
      throw new Error("Email ja cadastrado");
    }
    const user: AuthUserRecord = {
      id: createPublicId("USR_"),
      nome,
      email,
      senha_hash: await bcrypt.hash(temporaryPassword, 12),
      role: role === "admin" ? "tenant_admin" : role,
      tenant_id: tenant.id,
      ativo: payload.ativo !== false,
      criado_em: new Date().toISOString()
    };
    authUsers.push(user);
    return { user, temporaryPassword };
  }

  function signSupabaseCompatToken(user: UsuarioRecord) {
    return jwt.sign({
      sub: user.id,
      role: normalizeAuthRole(user.role),
      tenant_id: user.tenant_id,
      email: user.email,
      provider: "supabase"
    }, jwtSecret, { expiresIn: "8h" });
  }

  function getBearerToken(req: express.Request) {
    const authHeader = req.headers.authorization || "";
    return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  }

  function getAuthSession(req: express.Request): AuthSession | null {
    const bearerToken = getBearerToken(req);
    const token = bearerToken || String(req.headers["x-admin-token"] || "");
    if (!token) return null;
    try {
      const payload = jwt.verify(token, jwtSecret) as AuthSession;
      if (payload.provider === "supabase") return payload;
      const user = authUsers.find(item => item.id === payload.sub && item.ativo);
      if (!user || normalizeAuthRole(user.role) !== normalizeAuthRole(payload.role) || user.tenant_id !== payload.tenant_id) return null;
      return payload;
    } catch {
      return null;
    }
  }

  async function getSupabaseAuthUser(req: express.Request) {
    const accessToken = getBearerToken(req);
    if (!accessToken) return null;
    try {
      return await validarAccessToken(accessToken);
    } catch {
      return null;
    }
  }

  async function requireSupabaseJwt(req: express.Request, res: express.Response, next: express.NextFunction) {
    const usuario = await getSupabaseAuthUser(req);
    if (!usuario) {
      const legacySession = getAuthSession(req);
      if (!legacySession) {
        res.status(401).json({ error: "Token invalido ou expirado" });
        return;
      }
      (req as express.Request & { authSession?: AuthSession }).authSession = legacySession;
      next();
      return;
    }

    const session: AuthSession = {
      sub: usuario.id,
      role: normalizeAuthRole(usuario.role),
      tenant_id: usuario.tenant_id,
      email: usuario.email,
      provider: "supabase"
    };
    (req as express.Request & { usuario?: UsuarioRecord; authSession?: AuthSession }).usuario = usuario;
    (req as express.Request & { usuario?: UsuarioRecord; authSession?: AuthSession }).authSession = session;
    next();
  }

  function requireRoles(...roles: SaaSAuthRole[]) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const session = (req as express.Request & { authSession?: AuthSession }).authSession || getAuthSession(req);
      if (!session) {
        res.status(401).json({ error: "Sessao invalida ou expirada" });
        return;
      }
      if (!roles.includes(normalizeAuthRole(session.role))) {
        res.status(403).json({ error: "Permissao insuficiente" });
        return;
      }
      next();
    };
  }

  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!getAuthSession(req)) {
      res.status(401).json({ error: "Sessao invalida ou expirada" });
      return;
    }
    next();
  }

  function requireSuperAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const session = getAuthSession(req);
    if (!session) {
      res.status(401).json({ error: "Sessao invalida ou expirada" });
      return;
    }
    if (normalizeAuthRole(session.role) !== "superadmin") {
      res.status(403).json({ error: "Acesso exclusivo do superadmin" });
      return;
    }
    next();
  }

  function requireTenantAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const session = getAuthSession(req);
    if (!session) {
      res.status(401).json({ error: "Sessao invalida ou expirada" });
      return;
    }
    if (!["superadmin", "admin"].includes(normalizeAuthRole(session.role))) {
      res.status(403).json({ error: "Permissao administrativa necessaria" });
      return;
    }
    next();
  }

  function requireLegacyTenantAccess(req: express.Request, res: express.Response, next: express.NextFunction) {
    const session = getAuthSession(req);
    if (normalizeAuthRole(session?.role) !== "superadmin" && session?.tenant_id !== legacyTenantId) {
      res.status(403).json({ error: "Este painel ainda nao possui dados migrados para o seu tenant" });
      return;
    }
    next();
  }

  function firstHeaderValue(value: unknown) {
    const raw = Array.isArray(value) ? value[0] : value;
    return String(raw || "").split(",")[0].trim();
  }

  function normalizeDomainName(value: unknown) {
    let host = firstHeaderValue(value)
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (host.startsWith("[") && host.includes("]")) {
      return host.slice(1, host.indexOf("]"));
    }
    host = host.replace(/:\d+$/, "");
    return host;
  }

  function getRawRequestHost(req: express.Request) {
    return firstHeaderValue(req.headers["x-forwarded-host"] || req.headers["x-original-host"] || req.headers.host || "");
  }

  function getRequestHost(req: express.Request) {
    return normalizeDomainName(getRawRequestHost(req));
  }

  function getRequestTenant(req: express.Request) {
    return (req as express.Request & { resolvedTenant?: TenantRecord }).resolvedTenant;
  }

  type TenantResolutionSource = "tenant_domains" | "tenants.dominio" | "none";
  type TenantResolution = {
    hostRecebido: string;
    hostNormalizado: string;
    tenant: TenantRecord | null;
    fonte: TenantResolutionSource;
    reason: string;
  };

  function isLocalhost(host: string) {
    return !host || host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function isActiveTenantRecord(tenant: Partial<TenantRecord> & { ativo?: boolean } | null | undefined) {
    if (!tenant) return false;
    if ("status" in tenant && tenant.status) return tenant.status !== "canceled" && tenant.status !== "inactive";
    if ("ativo" in tenant) return tenant.ativo !== false;
    return true;
  }

  function normalizeTenantRecord(row: Record<string, any>): TenantRecord {
    const now = new Date().toISOString();
    const rawStatus = String(row.status || "").toLowerCase();
    const knownStatus = ["trial", "active", "suspended", "overdue", "maintenance", "blocked", "canceled", "inactive"].includes(rawStatus);
    return {
      id: String(row.id || ""),
      nome: String(row.nome || row.name || row.slug || "Tenant"),
      slug: String(row.slug || row.id || "tenant").trim().toLowerCase(),
      dominio: row.dominio ? normalizeDomainName(row.dominio) : undefined,
      dominio_customizado: normalizeDomainName(row.dominio_customizado || row.dominio || ""),
      status: knownStatus ? rawStatus as TenantRecord["status"] : row.ativo === false ? "inactive" : "active",
      logo_url: String(row.logo_url || ""),
      cor_primaria: String(row.cor_primaria || "#06b6d4"),
      plano: getTenantPlan(String(row.plano || "pro")).id,
      percentual_plataforma: Number(row.percentual_plataforma || 0),
      criado_em: String(row.criado_em || row.created_at || now),
      atualizado_em: String(row.atualizado_em || row.updated_at || row.created_at || now)
    };
  }

  function upsertTenantRecord(tenant: TenantRecord) {
    const index = tenants.findIndex(item => item.id === tenant.id);
    if (index >= 0) tenants[index] = { ...tenants[index], ...tenant };
    else tenants.push(tenant);
    return tenants.find(item => item.id === tenant.id) || tenant;
  }

  async function persistTenantPlanRecord(tenant: TenantRecord, reason: string) {
    if (supabaseAdmin) {
      const payloads = [
        { plano: tenant.plano, status: tenant.status, atualizado_em: tenant.atualizado_em },
        { plano: tenant.plano, status: tenant.status },
        { plano: tenant.plano }
      ];
      let persistedInTenantsTable = false;
      let lastErrorMessage = "";
      for (const payload of payloads) {
        try {
          const { data, error } = await supabaseAdmin.from("tenants").update(payload).eq("id", tenant.id).select("id").maybeSingle();
          if (!error && data?.id) {
            persistedInTenantsTable = true;
            break;
          }
          lastErrorMessage = error?.message || "tenant nao encontrado na tabela tenants";
        } catch (error) {
          lastErrorMessage = error instanceof Error ? error.message : "erro desconhecido";
        }
      }
      if (!persistedInTenantsTable && !process.env.RIFAPRO_TEST_MODE) {
        throw new Error(`Falha ao persistir plano do tenant: ${lastErrorMessage || "erro desconhecido"}`);
      }
      if (!persistedInTenantsTable) {
        console.warn(`Falha ao persistir plano em tenants (${reason}): ${lastErrorMessage || "erro desconhecido"}`);
      }
    }
    try {
      await persistAllState(reason);
    } catch (error) {
      if (!process.env.RIFAPRO_TEST_MODE) throw error;
      console.warn(`Falha ao persistir estado apos plano (${reason}): ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }
  }

  function upsertTenantDomainRecord(row: Record<string, any>, host: string) {
    const normalizedDomain = normalizeDomainName(row.domain || host);
    if (!normalizedDomain) return;
    const record: TenantDomainRecord = {
      id: String(row.id || `db:${row.tenant_id}:${normalizedDomain}`),
      tenant_id: String(row.tenant_id || ""),
      domain: normalizedDomain,
      type: row.type === "custom_domain" ? "custom_domain" : "subdomain",
      status: row.status === "verified" ? "verified" : row.status === "failed" ? "failed" : row.status === "disabled" ? "disabled" : "pending",
      verification_token: String(row.verification_token || ""),
      dns_target: String(row.dns_target || ""),
      ssl_status: String(row.ssl_status || "pending"),
      is_primary: Boolean(row.is_primary),
      created_at: String(row.created_at || new Date().toISOString()),
      verified_at: row.verified_at ? String(row.verified_at) : undefined
    };
    const index = tenantDomains.findIndex(item => item.id === record.id || normalizeDomainName(item.domain) === normalizedDomain);
    if (index >= 0) tenantDomains[index] = { ...tenantDomains[index], ...record };
    else tenantDomains.push(record);
  }

  function tenantDomainMatchesHost(domain: TenantDomainRecord, host: string) {
    return domain.status === "verified" &&
      normalizeDomainName(domain.domain) === host &&
      tenants.some(tenant => tenant.id === domain.tenant_id && isActiveTenantRecord(tenant));
  }

  async function findTenantFromSupabaseTenantDomains(host: string) {
    if (!supabaseAdmin || !host) return null;
    try {
      const { data: domains, error } = await supabaseAdmin
        .from("tenant_domains")
        .select("*")
        .ilike("domain", host)
        .eq("status", "verified")
        .limit(5);
      if (error) throw error;
      for (const domain of domains || []) {
        const tenantId = String(domain.tenant_id || "");
        if (!tenantId) continue;
        const { data: tenantRow, error: tenantError } = await supabaseAdmin
          .from("tenants")
          .select("*")
          .eq("id", tenantId)
          .maybeSingle();
        if (tenantError) throw tenantError;
        if (isActiveTenantRecord(tenantRow as any)) {
          upsertTenantDomainRecord(domain, host);
          return upsertTenantRecord(normalizeTenantRecord(tenantRow as Record<string, any>));
        }
      }
    } catch {
      console.warn(`[tenant-resolve] host=${host} reason=supabase_tenant_domains_error`);
    }
    return null;
  }

  async function findTenantFromSupabaseTenantsDominio(host: string) {
    if (!supabaseAdmin || !host) return null;
    try {
      const { data: tenantRows, error } = await supabaseAdmin
        .from("tenants")
        .select("*")
        .ilike("dominio", host)
        .limit(5);
      if (error) throw error;
      const tenantRow = (tenantRows || []).find(row => isActiveTenantRecord(row as any));
      if (tenantRow) return upsertTenantRecord(normalizeTenantRecord(tenantRow as Record<string, any>));
    } catch {
      console.warn(`[tenant-resolve] host=${host} reason=supabase_tenants_dominio_error`);
    }
    return null;
  }

  function findTenantFromLocalTenantDomains(host: string) {
    const domainTenant = tenantDomains.find(domain => tenantDomainMatchesHost(domain, host));
    if (!domainTenant) return null;
    return tenants.find(tenant => tenant.id === domainTenant.tenant_id && isActiveTenantRecord(tenant)) || null;
  }

  function findTenantFromLocalTenantsDominio(host: string) {
    return tenants.find(tenant =>
      isActiveTenantRecord(tenant) &&
      normalizeDomainName(tenant.dominio || tenant.dominio_customizado) === host
    ) || null;
  }

  async function resolveDomainTenantInfo(req: express.Request): Promise<TenantResolution> {
    const hostRecebido = getRawRequestHost(req);
    const host = normalizeDomainName(hostRecebido);
    if (isLocalhost(host)) {
      const tenant = tenants.find(item => item.id === legacyTenantId && isActiveTenantRecord(item)) ||
        tenants.find(item => item.slug === "dev" && isActiveTenantRecord(item)) ||
        tenants.find(item => isActiveTenantRecord(item)) ||
        null;
      return { hostRecebido, hostNormalizado: host, tenant, fonte: tenant ? "tenants.dominio" : "none", reason: tenant ? "localhost_fallback" : "localhost_no_active_tenant" };
    }
    if (host === "admin" || host.startsWith("admin.")) {
      return { hostRecebido, hostNormalizado: host, tenant: null, fonte: "none", reason: "superadmin_host" };
    }

    const supabaseDomainTenant = await findTenantFromSupabaseTenantDomains(host);
    if (supabaseDomainTenant) return { hostRecebido, hostNormalizado: host, tenant: supabaseDomainTenant, fonte: "tenant_domains", reason: "supabase_tenant_domains_verified" };

    const supabaseDominioTenant = await findTenantFromSupabaseTenantsDominio(host);
    if (supabaseDominioTenant) return { hostRecebido, hostNormalizado: host, tenant: supabaseDominioTenant, fonte: "tenants.dominio", reason: "supabase_tenants_dominio" };

    const localDomainTenant = findTenantFromLocalTenantDomains(host);
    if (localDomainTenant) return { hostRecebido, hostNormalizado: host, tenant: localDomainTenant, fonte: "tenant_domains", reason: "local_tenant_domains_verified" };

    const localDominioTenant = findTenantFromLocalTenantsDominio(host);
    if (localDominioTenant) return { hostRecebido, hostNormalizado: host, tenant: localDominioTenant, fonte: "tenants.dominio", reason: "local_tenants_dominio" };

    if (host.endsWith(".test.local")) {
      const testTenant = tenants.find(tenant => isActiveTenantRecord(tenant) && host.split(".")[0] === tenant.slug);
      if (testTenant) return { hostRecebido, hostNormalizado: host, tenant: testTenant, fonte: "tenants.dominio", reason: "test_local_slug_fallback" };
    }

    if (!isProductionRuntime) {
      const slugTenant = tenants.find(tenant => isActiveTenantRecord(tenant) && host.split(".")[0] === tenant.slug);
      if (slugTenant) return { hostRecebido, hostNormalizado: host, tenant: slugTenant, fonte: "tenants.dominio", reason: "dev_slug_fallback" };
    }

    return { hostRecebido, hostNormalizado: host, tenant: null, fonte: "none", reason: "no_domain_match" };
  }

  async function resolveDomainTenant(req: express.Request) {
    return (await resolveDomainTenantInfo(req)).tenant;
  }

  function resolveRequestTenantId(req: express.Request) {
    const session = getAuthSession(req);
    const supportSessionId = String(req.headers["x-support-session-id"] || req.query.supportSessionId || "");
    if (normalizeAuthRole(session?.role) === "superadmin" && supportSessionId) {
      const supportSession = superadminImpersonationSessions.find(item =>
        item.id === supportSessionId &&
        item.superadmin_user_id === session?.sub &&
        item.active &&
        new Date(item.expires_at).getTime() > Date.now()
      );
      if (supportSession) return supportSession.tenant_id;
    }
    if (normalizeAuthRole(session?.role) !== "superadmin" && session?.tenant_id) return session.tenant_id;
    const tenant = getRequestTenant(req);
    if (tenant) return tenant.id;
    throw new Error("Tenant nao resolvido para esta requisicao");
  }

  async function resolveTenant(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (req.body && typeof req.body === "object" && "tenant_id" in req.body) {
      delete req.body.tenant_id;
    }

    if (req.path.startsWith("/api/public/")) {
      next();
      return;
    }

    if (req.path.startsWith("/api/teste/")) {
      next();
      return;
    }

    const session = getAuthSession(req);
    const host = getRequestHost(req);
    const superAdminHost = host === "admin" || host.startsWith("admin.");
    (req as express.Request & { isSuperAdminHost?: boolean }).isSuperAdminHost = superAdminHost;

    if (superAdminHost) {
      if (req.method === "GET" && req.path === "/") {
        res.redirect("/superadmin");
        return;
      }
      if (req.path.startsWith("/api/") && !req.path.startsWith("/api/superadmin") && !req.path.startsWith("/api/auth")) {
        res.status(404).json({ error: "Tenant nao encontrado para este dominio" });
        return;
      }
      next();
      return;
    }

    if (!req.path.startsWith("/api/")) {
      next();
      return;
    }

    const sessionTenant = ["admin", "operador", "afiliado"].includes(normalizeAuthRole(session?.role)) && session?.tenant_id
      ? tenants.find(tenant => tenant.id === session.tenant_id && isActiveTenantRecord(tenant))
      : null;
    const resolution = await resolveDomainTenantInfo(req);
    const tenant = sessionTenant || resolution.tenant;

    if (!tenant) {
      if (isProductionRuntime) console.warn(`[tenant-resolve] host=${resolution.hostNormalizado} reason=${resolution.reason}`);
      if (req.path.startsWith("/api/")) {
        res.status(404).json({ error: "Tenant nao encontrado para este dominio" });
      } else {
        res.status(404).send("Tenant nao encontrado para este dominio");
      }
      return;
    }

    (req as express.Request & { resolvedTenant?: TenantRecord }).resolvedTenant = tenant;
    res.setHeader("X-Tenant-Slug", tenant.slug);
    next();
  }

  async function buildPublicTenantDebug(req: express.Request) {
    const hostHeader = firstHeaderValue(req.headers.host || "");
    const forwardedHost = firstHeaderValue(req.headers["x-forwarded-host"] || "");
    const originalHost = firstHeaderValue(req.headers["x-original-host"] || "");
    const hostRecebido = getRawRequestHost(req);
    const hostNormalizado = normalizeDomainName(hostRecebido);
    const dominioRailwayEsperado = "rifapro-saas-production.up.railway.app";
    const tenantFromDomains = await findTenantFromSupabaseTenantDomains(hostNormalizado) || findTenantFromLocalTenantDomains(hostNormalizado);
    const tenantFromDominio = await findTenantFromSupabaseTenantsDominio(hostNormalizado) || findTenantFromLocalTenantsDominio(hostNormalizado);
    const tenant = tenantFromDomains || tenantFromDominio;
    const motivoFalha = tenant
      ? ""
      : !hostNormalizado
        ? "host_vazio"
        : hostNormalizado === "admin" || hostNormalizado.startsWith("admin.")
          ? "host_superadmin_nao_resolve_tenant_publico"
          : "dominio_nao_encontrado_em_tenant_domains_verified_ou_tenants_dominio";

    if (isProductionRuntime) console.warn(`[tenant-resolve] host=${hostNormalizado} reason=${tenant ? "public_debug_match" : motivoFalha}`);

    return {
      hostRecebido,
      xForwardedHost: forwardedHost,
      xOriginalHost: originalHost,
      host: hostHeader,
      hostNormalizado,
      dominioRailwayEsperado,
      encontrouEmTenantDomains: Boolean(tenantFromDomains),
      encontrouEmTenantsDominio: Boolean(tenantFromDominio),
      slugEncontrado: tenant?.slug || "",
      tenantEncontrado: Boolean(tenant),
      fonte: tenantFromDomains ? "tenant_domains" : tenantFromDominio ? "tenants.dominio" : "none",
      motivoFalha
    };
  }

  async function buildPublicRafflesDebug(req: express.Request) {
    const resolution = await resolveDomainTenantInfo(req);
    const tenant = resolution.tenant || getRequestTenant(req) || null;
    const tenantRaffles = tenant ? raffles.filter(raffle => raffle.tenant_id === tenant.id) : [];
    const activeTenantRaffles = tenantRaffles.filter(raffle => raffle.status === "active");
    const reasonIfEmpty = !tenant
      ? `tenant_not_found:${resolution.reason}`
      : tenantRaffles.length === 0
        ? "no_raffles_for_tenant"
        : activeTenantRaffles.length === 0
          ? "no_active_raffles_for_tenant"
          : "";

    return {
      tenantId: tenant?.id || null,
      tenantSlug: tenant?.slug || null,
      totalRaffles: tenantRaffles.length,
      activeRaffles: activeTenantRaffles.length,
      campaigns: tenantRaffles.map(raffle => ({
        id: raffle.id,
        title: raffle.title,
        status: raffle.status,
        price: raffle.price,
        totalTickets: raffle.totalTickets,
        soldTickets: raffle.soldTickets,
        hasImage: Boolean(raffle.image),
        hasMedia: Boolean(raffle.mediaUrl || raffle.checkoutMediaUrl),
        mediaType: raffle.checkoutMediaType || raffle.mediaType || ""
      })),
      reasonIfEmpty
    };
  }

  function registerPublicDebugRoutes() {
    const publicDebugNotFound = { error: "Endpoint nao encontrado" };
    const canAccessPublicDebug = (req: express.Request) => {
      if (!isNodeProduction || publicDebugEnabled) return true;
      const session = getAuthSession(req);
      const role = normalizeAuthRole(session?.role);
      return role === "admin" || role === "superadmin";
    };

    app.get("/api/public/health", (_req, res) => {
      res.json({ ok: true, version: APP_VERSION });
    });

    app.get("/api/public/tenant-debug", async (req, res) => {
      if (!canAccessPublicDebug(req)) {
        res.status(404).json(publicDebugNotFound);
        return;
      }
      res.json(await buildPublicTenantDebug(req));
    });

    app.get("/api/public/raffles-debug", async (req, res) => {
      if (!canAccessPublicDebug(req)) {
        res.status(404).json(publicDebugNotFound);
        return;
      }
      const debug = await buildPublicRafflesDebug(req);
      if (isProductionRuntime && debug.reasonIfEmpty) {
        console.warn(`[public-raffles] tenant=${debug.tenantSlug || "none"} reason=${debug.reasonIfEmpty}`);
      }
      res.json(debug);
    });

    console.info("[routes] public debug routes registered");
  }

  app.get("/api/public/geo", (req, res) => {
    const decodeHeader = (value: unknown) => {
      const raw = Array.isArray(value) ? value[0] : value;
      if (!raw) return "";
      try {
        return decodeURIComponent(String(raw)).trim();
      } catch {
        return String(raw).trim();
      }
    };
    const city = decodeHeader(
      req.headers["x-vercel-ip-city"] ||
      req.headers["cf-ipcity"] ||
      req.headers["x-geo-city"] ||
      req.headers["x-railway-edge-city"]
    );
    const state = decodeHeader(
      req.headers["x-vercel-ip-country-region"] ||
      req.headers["cf-region-code"] ||
      req.headers["cf-region"] ||
      req.headers["x-geo-region"] ||
      req.headers["x-railway-edge-region"]
    ).slice(0, 2).toUpperCase();
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.json({ city, state, source: city ? "edge_headers" : "none" });
  });

  function buildSystemStatusPayload() {
    const storageDriver = persistenceMode;
    const databaseConnected = Boolean(supabaseAdmin && persistentStorageDrivers.has(storageDriver));
    const productionReady = productionValidationErrors.length === 0 &&
      (!isNodeProduction || (
        validStorageDriver &&
        !publicDebugEnabled &&
        databaseConnected &&
        strongSecret(process.env.JWT_SECRET) &&
        strongSecret(process.env.SESSION_SECRET)
      ));
    return {
      ok: true,
      version: APP_VERSION,
      uptime: process.uptime(),
      storageDriver,
      singleProcessSafe: true,
      multiInstanceSafe: false,
      databaseConnected,
      publicDebugEnabled,
      productionReady,
      memoryStateRisk,
      persistenceMode,
      productionSafe,
      warnings: [
        ...(memoryStateRisk ? ["Estado critico em memoria: use STORAGE_DRIVER=postgres ou persistent antes de producao real."] : []),
        ...(!MULTI_INSTANCE_SAFE ? ["multiInstanceSafe=false: manter exatamente 1 processo backend."] : [])
      ]
    };
  }

  app.get("/api/health", (_req, res) => {
    res.json(buildSystemStatusPayload());
  });

  app.get("/api/system/status", (_req, res) => {
    res.json(buildSystemStatusPayload());
  });

  app.get("/api/public/branding", async (req, res) => {
    const resolution = await resolveDomainTenantInfo(req);
    const tenant = resolution.tenant || getRequestTenant(req) || tenants.find(item => item.id === legacyTenantId);
    if (!tenant) {
      res.status(404).json({ error: "Tenant nao encontrado para este dominio" });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json(publicTenantBranding(getTenantBranding(tenant.id)));
  });

  app.get("/api/public/theme-template", async (req, res) => {
    const resolution = await resolveDomainTenantInfo(req);
    const tenant = resolution.tenant || getRequestTenant(req) || tenants.find(item => item.id === legacyTenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado para este dominio" });
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json(publicTenantTheme(tenant.id));
  });

  app.get("/manifest.webmanifest", async (req, res) => {
    const resolution = await resolveDomainTenantInfo(req);
    const tenant = resolution.tenant || getRequestTenant(req) || tenants.find(item => item.id === legacyTenantId);
    const branding = publicTenantBranding(getTenantBranding(tenant?.id || legacyTenantId));
    const primary = String(branding.colors?.primary || "#00d66b");
    const name = String(branding.header_name || tenant?.nome || "CIFHER Prime");
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json({
      id: `/${tenant?.slug || "rifapro"}`,
      name,
      short_name: name.slice(0, 12) || "CIFHER",
      description: String(branding.slogan || "Painel profissional para rifas, pagamentos, clientes e campanhas."),
      start_url: "/?source=pwa",
      scope: "/",
      display: "standalone",
      display_override: ["window-controls-overlay", "standalone", "browser"],
      orientation: "portrait-primary",
      background_color: "#050807",
      theme_color: primary,
      categories: ["business", "shopping", "entertainment"],
      icons: [
        { src: branding.logo_url || "/icons/pwa-icon.svg", sizes: "192x192", type: branding.logo_mime_type || "image/svg+xml", purpose: "any" },
        { src: "/icons/pwa-icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
        { src: "/icons/pwa-maskable.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" }
      ],
      screenshots: [
        { src: "/pwa-splash.svg", sizes: "1080x1920", type: "image/svg+xml", form_factor: "narrow", label: "CIFHER mobile" }
      ]
    });
  });

  function adminCanAccessTenant(req: express.Request, tenantId: string) {
    const session = getAuthSession(req);
    return Boolean(session && (normalizeAuthRole(session.role) === "superadmin" || session.tenant_id === tenantId));
  }

  function getTenantPlan(tenantIdOrPlan: string) {
    const rawPlan = tenants.find(tenant => tenant.id === tenantIdOrPlan)?.plano || tenantIdOrPlan || "pro";
    const normalized = planAliases[String(rawPlan).toLowerCase()] || String(rawPlan).toLowerCase();
    return planCatalog[normalized as SaaSPlanId] || planCatalog.pro;
  }

  function getTenantFeatures(tenantId: string) {
    const plan = getTenantPlan(tenantId);
    const enabled = Object.fromEntries(allTenantFeatureFlags.map(flag => [flag, plan.included_features.includes(flag)])) as Record<TenantFeatureFlag, boolean>;
    return { ...enabled, ...(tenantFeatureOverrides[tenantId] || {}) };
  }

  function tenantHasFeature(tenantId: string, feature: TenantFeatureFlag) {
    return Boolean(getTenantFeatures(tenantId)[feature]);
  }

  function assertTenantOperationalForCheckout(tenant: TenantRecord | undefined | null) {
    if (!tenant) throw new Error("Tenant inativo ou indisponivel para compras");
    if (["active", "trial"].includes(tenant.status)) return;
    if (tenant.status === "maintenance") throw new Error("Tenant em manutenção. Compras temporariamente indisponiveis.");
    if (tenant.status === "overdue") throw new Error("Tenant com pagamento em atraso. Checkout bloqueado.");
    if (tenant.status === "suspended") throw new Error("Tenant suspenso. Checkout bloqueado.");
    if (tenant.status === "blocked") throw new Error("Tenant bloqueado. Checkout indisponivel.");
    if (tenant.status === "canceled") throw new Error("Tenant cancelado. Checkout indisponivel.");
    throw new Error("Tenant inativo ou indisponivel para compras");
  }

  function tenantCanUseIntegration(tenantId: string, provider: IntegrationProviderId) {
    return getTenantPlan(tenantId).integracoes_liberadas.includes(provider);
  }

  function recordSecurityEvent(input: Omit<SecurityLog, "id" | "date">) {
    const event: SecurityLog = {
      id: createPublicId("SEC_"),
      date: new Date().toISOString(),
      ...input
    };
    securityLogs.unshift(event);
    securityLogs.splice(500);
    return event;
  }

  function requireAuditReason(reason: unknown) {
    const normalized = String(reason || "").trim();
    if (normalized.length < 6) {
      const error = new Error("Motivo obrigatorio com pelo menos 6 caracteres");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }
    return normalized;
  }

  function recordAuditLedger(req: express.Request, input: {
    tenant_id?: string;
    action: string;
    resource_type: string;
    resource_id?: string;
    before_data?: unknown;
    after_data?: unknown;
    reason: string;
  }) {
    const session = getAuthSession(req);
    const previous = auditEventLedger[0];
    const created_at = new Date().toISOString();
    const base = {
      id: createPublicId("AEL_"),
      tenant_id: input.tenant_id || resolveRequestTenantId(req),
      actor_user_id: session?.sub || "system",
      actor_role: normalizeAuthRole(session?.role || "admin"),
      action: input.action,
      resource_type: input.resource_type,
      resource_id: input.resource_id,
      before_data: input.before_data,
      after_data: input.after_data,
      reason: requireAuditReason(input.reason),
      ip_address: String(req.ip || req.socket.remoteAddress || ""),
      user_agent: String(req.headers["user-agent"] || ""),
      request_id: String((req as express.Request & { requestId?: string }).requestId || req.headers["x-request-id"] || ""),
      previous_hash: previous?.hash,
      created_at
    };
    const hash = createHash("sha256").update(JSON.stringify(base)).digest("hex");
    const event: AuditEventLedgerRecord = { ...base, hash };
    auditEventLedger.unshift(event);
    auditEventLedger = auditEventLedger.slice(0, 5000);
    return event;
  }

  function recordSystemAuditLedger(input: {
    tenant_id: string;
    action: string;
    resource_type: string;
    resource_id?: string;
    before_data?: unknown;
    after_data?: unknown;
    reason: string;
  }) {
    const previous = auditEventLedger[0];
    const created_at = new Date().toISOString();
    const base = {
      id: createPublicId("AEL_"),
      tenant_id: input.tenant_id,
      actor_user_id: "system",
      actor_role: "system",
      action: input.action,
      resource_type: input.resource_type,
      resource_id: input.resource_id,
      before_data: input.before_data,
      after_data: input.after_data,
      reason: requireAuditReason(input.reason),
      ip_address: "system",
      user_agent: "system",
      request_id: "",
      previous_hash: previous?.hash,
      created_at
    };
    const hash = createHash("sha256").update(JSON.stringify(base)).digest("hex");
    const event: AuditEventLedgerRecord = { ...base, hash };
    auditEventLedger.unshift(event);
    auditEventLedger = auditEventLedger.slice(0, 5000);
    return event;
  }

  function appendWalletLedger(req: express.Request, entry: Omit<WalletLedgerRecord, "id" | "created_at" | "actor_user_id"> & { actor_user_id?: string }) {
    const record: WalletLedgerRecord = {
      id: createPublicId("WAL_"),
      actor_user_id: entry.actor_user_id || getAuthSession(req)?.sub || "system",
      created_at: new Date().toISOString(),
      ...entry
    };
    const balance = walletLedger
      .filter(item => item.tenant_id === record.tenant_id && (record.customer_id ? item.customer_id === record.customer_id : item.affiliate_ref === record.affiliate_ref))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (balance + record.amount < -0.00001) {
      const error = new Error("Ledger financeiro nao permite saldo negativo");
      (error as Error & { statusCode?: number }).statusCode = 409;
      throw error;
    }
    walletLedger.unshift(record);
    return record;
  }

  function scoped<T extends { tenant_id: string }>(items: T[], req: express.Request) {
    const session = getAuthSession(req);
    return normalizeAuthRole(session?.role) === "superadmin" ? items : items.filter(item => item.tenant_id === resolveRequestTenantId(req));
  }

  function publicPromotionRule(rule: PromotionRule) {
    return {
      id: rule.id,
      raffleId: rule.raffle_id || null,
      name: rule.name,
      type: rule.type,
      enabled: rule.enabled,
      priority: rule.priority,
      startsAt: rule.starts_at,
      endsAt: rule.ends_at,
      publicText: rule.conditions.publicText || rule.rewards.label || rule.name,
      rewards: rule.rewards,
      stackable: rule.stackable
    };
  }

  function adminPromotionRule(rule: PromotionRule) {
    return {
      ...rule,
      raffleId: rule.raffle_id || "",
      startsAt: rule.starts_at || "",
      endsAt: rule.ends_at || ""
    };
  }

  function normalizePromotionPayload(req: express.Request, current?: PromotionRule) {
    const tenantId = current?.tenant_id || resolveRequestTenantId(req);
    const body = req.body || {};
    const parsedJson = (value: unknown, fallback: Record<string, unknown>) => {
      if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
      if (typeof value === "string" && value.trim()) {
        try {
          const parsed = JSON.parse(value);
          return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : fallback;
        } catch {
          return fallback;
        }
      }
      return fallback;
    };
    return normalizePromotionRule({
      ...(current || {}),
      id: current?.id || body.id || createPublicId("PROM_"),
      tenant_id: tenantId,
      raffle_id: body.raffle_id ?? body.raffleId ?? current?.raffle_id ?? null,
      name: body.name ?? current?.name ?? "Promocao",
      type: body.type ?? current?.type ?? "double_tickets",
      enabled: body.enabled ?? current?.enabled ?? true,
      priority: Number(body.priority ?? current?.priority ?? 100),
      starts_at: body.starts_at ?? body.startsAt ?? current?.starts_at ?? null,
      ends_at: body.ends_at ?? body.endsAt ?? current?.ends_at ?? null,
      conditions: parsedJson(body.conditions, current?.conditions || {}),
      rewards: parsedJson(body.rewards, current?.rewards || {}),
      limits: parsedJson(body.limits, current?.limits || {}),
      stackable: Boolean(body.stackable ?? current?.stackable ?? false),
      created_by: current?.created_by || getAuthSession(req)?.sub || null,
      created_at: current?.created_at
    });
  }

  function evaluatePromotionForRaffle(input: {
    tenantId: string;
    raffleId?: string | null;
    customer?: CustomerRecord;
    quantity: number;
    amount: number;
    price?: number;
    availableTickets?: number;
    raffleStatus?: string;
    orderId?: string;
    refCode?: string;
    paymentStatus?: string;
  }) {
    return evaluatePromotions({
      tenantId: input.tenantId,
      raffleId: input.raffleId,
      customerId: input.customer?.id,
      customerName: input.customer?.name,
      customerPhone: input.customer?.phone,
      orderId: input.orderId,
      quantity: input.quantity,
      amount: input.amount,
      price: input.price,
      availableTickets: input.availableTickets,
      raffleStatus: input.raffleStatus,
      paymentStatus: input.paymentStatus,
      affiliateRefCode: input.refCode,
      isFirstPurchase: input.customer ? !purchases.some(item => item.tenant_id === input.tenantId && item.customer?.id === input.customer?.id && item.status === "paid") : false,
      isVip: Boolean(input.customer && input.customer.totalTickets >= 1000),
      rules: promotionRules,
      usages: promotionUsages
    });
  }

  function persistAppliedPromotions(context: { tenantId: string; raffleId?: string | null; orderId: string; customer?: CustomerRecord; amount: number; quantity: number }, summary?: PromotionSummary) {
    if (!summary) return [];
    const usages = summary.appliedRules.map(rule => persistPromotionUsage({
      tenantId: context.tenantId,
      raffleId: context.raffleId,
      orderId: context.orderId,
      customerId: context.customer?.id,
      quantity: context.quantity,
      amount: context.amount,
      rules: promotionRules,
      usages: promotionUsages
    }, rule, {
      usage_type: rule.type,
      quantity: rule.type === "double_tickets" ? summary.doubleTickets?.bonusTickets || 0 : context.quantity,
      amount: context.amount,
      metadata: { badges: summary.badges, rewards: summary.rewards, bonusTickets: summary.bonusTickets }
    }, promotionUsages));
    usages.forEach(usage => {
      recordSystemAuditLedger({
        tenant_id: context.tenantId,
        action: "PROMOTION_APPLIED",
        resource_type: "promotion_rule",
        resource_id: usage.promotion_id,
        before_data: null,
        after_data: usage,
        reason: "Promocao aplicada no checkout"
      });
    });
    return usages;
  }

  function recordSuperadminAudit(req: express.Request, action: string, input: Partial<Omit<SuperadminAuditLog, "id" | "superadmin_user_id" | "action" | "metadata" | "ip_address" | "user_agent" | "created_at">> & { metadata?: Record<string, unknown> } = {}) {
    const session = getAuthSession(req);
    const entry: SuperadminAuditLog = {
      id: createPublicId("SAD_"),
      superadmin_user_id: session?.sub || "unknown",
      action,
      resource_type: input.resource_type,
      resource_id: input.resource_id,
      tenant_id: input.tenant_id,
      metadata: input.metadata || {},
      ip_address: String(req.ip || req.socket.remoteAddress || ""),
      user_agent: String(req.headers["user-agent"] || ""),
      created_at: new Date().toISOString()
    };
    superadminAuditLogs.unshift(entry);
    superadminAuditLogs = superadminAuditLogs.slice(0, 2000);
    return entry;
  }

  function activeTenantOr404(tenantId: string) {
    return tenants.find(tenant => tenant.id === tenantId);
  }

  function normalizeDomainType(value: unknown): TenantDomainRecord["type"] {
    return value === "custom_domain" ? "custom_domain" : "subdomain";
  }

  function buildDomainRecord(tenantId: string, body: Record<string, unknown>) {
    const domain = normalizeDomainName(body.domain);
    if (!domain || !domain.includes(".")) throw new Error("Domínio inválido");
    if (!activeTenantOr404(tenantId)) throw new Error("Tenant não encontrado");
    if (tenantDomains.some(item => normalizeDomainName(item.domain) === domain)) throw new Error("Domínio já cadastrado");
    const type = normalizeDomainType(body.type);
    const now = new Date().toISOString();
    const record: TenantDomainRecord = {
      id: createPublicId("DOM_"),
      tenant_id: tenantId,
      domain,
      type,
      status: "pending",
      verification_token: createPublicId("DNS_"),
      dns_target: type === "subdomain" ? "cname.rifapro.local" : "app.rifapro.local",
      ssl_status: "pending",
      is_primary: tenantDomains.every(item => item.tenant_id !== tenantId),
      created_at: now
    };
    return record;
  }

  function sanitizeTenantDomain(domain: TenantDomainRecord) {
    return {
      ...domain,
      dns_instructions: domain.type === "subdomain"
        ? `Crie um CNAME para ${domain.domain} apontando para ${domain.dns_target}.`
        : `Aponte ${domain.domain} por CNAME para ${domain.dns_target} ou configure A record conforme infraestrutura.`
    };
  }

  function verifyTenantDomain(domain: TenantDomainRecord) {
    domain.status = "verified";
    domain.ssl_status = domain.ssl_status || "pending";
    domain.verified_at = new Date().toISOString();
    const tenant = tenants.find(item => item.id === domain.tenant_id);
    if (tenant && domain.type === "custom_domain") {
      tenant.dominio_customizado = domain.domain;
      tenant.dominio = domain.domain;
      tenant.atualizado_em = new Date().toISOString();
    }
    return domain;
  }

  function setPrimaryTenantDomain(domain: TenantDomainRecord) {
    tenantDomains.forEach(item => {
      if (item.tenant_id === domain.tenant_id) item.is_primary = item.id === domain.id;
    });
    if (domain.type === "custom_domain") {
      const tenant = tenants.find(item => item.id === domain.tenant_id);
      if (tenant) {
        tenant.dominio_customizado = domain.domain;
        tenant.dominio = domain.domain;
      }
    }
    return domain;
  }

  function tenantCustomerKey(tenantId: string, value: string) {
    return `${tenantId}:${value}`;
  }

  function findCustomerByPhone(phone: string, tenantId: string) {
    return customersByPhone[tenantCustomerKey(tenantId, phone)];
  }

  function findCustomerByCpf(cpf: string, tenantId: string) {
    return customersByCpf[tenantCustomerKey(tenantId, cpf)];
  }

  async function handleSecureLogin(req: express.Request, res: express.Response) {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (supabaseAdmin && supabaseUrl && (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)) {
      try {
        const authResult = await loginUsuario(email, password);
        recordSecurityEvent({
          tenant_id: authResult.usuario.tenant_id || "platform",
          action: "LOGIN_SUCCESS",
          ip: String(req.ip || req.socket.remoteAddress || ""),
          status: "INFO",
          severity: "low",
          actor: authResult.usuario.email,
          detail: normalizeAuthRole(authResult.usuario.role)
        });
        res.json({
          token: signSupabaseCompatToken(authResult.usuario),
          access_token: authResult.session.access_token,
          refresh_token: authResult.session.refresh_token,
          session: publicSession(authResult.session),
          user: {
            id: authResult.usuario.id,
            email: authResult.usuario.email,
            user_metadata: { name: authResult.usuario.nome || "" }
          },
          usuario: publicUsuario(authResult.usuario),
          profile: {
            role: normalizeAuthRole(authResult.usuario.role),
            name: authResult.usuario.nome,
            tenantId: authResult.usuario.tenant_id
          }
        });
        return;
      } catch (error) {
        const maybeLocalUser = authUsers.find(item => item.email === email && item.ativo);
        if (!maybeLocalUser) {
          recordSecurityEvent({
            tenant_id: "unknown",
            action: "LOGIN_FAILED",
            ip: String(req.ip || req.socket.remoteAddress || ""),
            status: "WARN",
            severity: "medium",
            actor: email,
            detail: error instanceof Error ? error.message : "Falha Supabase Auth"
          });
          res.status(401).json({ error: "Credenciais invalidas" });
          return;
        }
      }
    }

    const user = authUsers.find(item => item.email === email && item.ativo);
    if (!user || !(await bcrypt.compare(password, user.senha_hash))) {
      recordSecurityEvent({
        tenant_id: user?.tenant_id || "unknown",
        action: "LOGIN_FAILED",
        ip: String(req.ip || req.socket.remoteAddress || ""),
        status: "WARN",
        severity: "medium",
        actor: email,
        detail: "Credenciais invalidas"
      });
      res.status(401).json({ error: "Credenciais invalidas" });
      return;
    }
    recordSecurityEvent({
      tenant_id: user.tenant_id || "platform",
      action: "LOGIN_SUCCESS",
      ip: String(req.ip || req.socket.remoteAddress || ""),
      status: "INFO",
      severity: "low",
      actor: user.email,
      detail: user.role
    });
    res.json({
      token: signAuthToken(user),
      user: publicAuthUser(user),
      profile: publicAuthProfile(user)
    });
  }

  app.post("/api/auth/signup", rateLimiter, async (req, res) => {
    try {
      const nome = String(req.body.nome || req.body.name || "").trim();
      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || req.body.senha || "");
      const requestedRole = normalizeAuthRole(req.body.role || "admin");
      if (isNodeProduction && requestedRole === "superadmin") {
        recordSecurityEvent({
          tenant_id: "platform",
          action: "PUBLIC_SUPERADMIN_SIGNUP_BLOCKED",
          ip: String(req.ip || req.socket.remoteAddress || ""),
          status: "BLOCKED",
          severity: "critical",
          actor: email,
          detail: "role=superadmin"
        });
        res.status(403).json({ error: "Cadastro publico de superadmin bloqueado em producao" });
        return;
      }
      const canUsePrivilegedSignupFields = !isProductionRuntime || process.env.ALLOW_PUBLIC_PRIVILEGED_SIGNUP === "true";
      const role = canUsePrivilegedSignupFields ? requestedRole : requestedRole === "superadmin" ? "superadmin" : "admin";
      const requestedTenantId = req.body.tenant_id ? String(req.body.tenant_id) : undefined;
      const tenant = await resolveDomainTenant(req);
      const tenantId = role === "superadmin"
        ? null
        : canUsePrivilegedSignupFields
          ? requestedTenantId || tenant?.id || legacyTenantId
          : tenant?.id || legacyTenantId;

      if (nome.length < 2 || !email.includes("@") || password.length < 6) {
        res.status(400).json({ error: "Nome, email valido e senha com 6+ caracteres sao obrigatorios" });
        return;
      }
      if (role === "superadmin" && getRequestHost(req) !== "admin" && !getRequestHost(req).startsWith("admin.")) {
        res.status(403).json({ error: "Cadastro de superadmin permitido apenas no host administrativo" });
        return;
      }
      if (requestedTenantId && !canUsePrivilegedSignupFields) {
        recordSecurityEvent({
          tenant_id: tenant?.id || "platform",
          action: "SIGNUP_TENANT_OVERRIDE_BLOCKED",
          ip: String(req.ip || req.socket.remoteAddress || ""),
          status: "BLOCKED",
          severity: "high",
          actor: email,
          detail: requestedTenantId
        });
        res.status(403).json({ error: "Tenant do cadastro deve ser definido pelo dominio da requisicao" });
        return;
      }

      if (!supabaseAdmin) {
        if (authUsers.some(item => item.email === email)) {
          res.status(409).json({ error: "Usuario ja cadastrado" });
          return;
        }
        const user: AuthUserRecord = {
          id: createPublicId("USR_"),
          nome,
          email,
          senha_hash: await bcrypt.hash(password, 12),
          role: role === "tenant_admin" ? "admin" : role,
          tenant_id: tenantId,
          ativo: true,
          criado_em: new Date().toISOString()
        };
        authUsers.push(user);
        res.status(201).json({
          usuario: {
            id: user.id,
            tenant_id: user.tenant_id,
            nome: user.nome,
            email: user.email,
            role: normalizeAuthRole(user.role),
            ativo: user.ativo,
            created_at: user.criado_em
          }
        });
        return;
      }

      const existing = await buscarUsuarioPorEmail(email);
      if (existing) {
        res.status(409).json({ error: "Usuario ja cadastrado" });
        return;
      }

      const usuario = await criarUsuarioAuth({ nome, email, password, tenant_id: tenantId, role });
      res.status(201).json({ usuario: publicUsuario(usuario) });
    } catch (error) {
      console.error("Erro signup Supabase Auth", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao criar usuario" });
    }
  });

  app.post("/api/auth/login", rateLimiter, handleSecureLogin);
  app.post("/api/auth/admin/login", rateLimiter, handleSecureLogin);

  app.post("/api/auth/refresh", rateLimiter, async (req, res) => {
    try {
      const refreshToken = String(req.body.refresh_token || req.body.refreshToken || "");
      if (!refreshToken) {
        res.status(400).json({ error: "refresh_token obrigatorio" });
        return;
      }
      const authResult = await refreshUsuario(refreshToken);
      res.json({
        token: signSupabaseCompatToken(authResult.usuario),
        access_token: authResult.session.access_token,
        refresh_token: authResult.session.refresh_token,
        session: publicSession(authResult.session),
        usuario: publicUsuario(authResult.usuario)
      });
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : "Refresh token invalido" });
    }
  });

  app.post("/api/auth/logout", rateLimiter, async (req, res) => {
    try {
      const accessToken = getBearerToken(req) || String(req.body.access_token || "");
      if (accessToken && supabaseAdmin) await logoutUsuario(accessToken);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao encerrar sessao" });
    }
  });

  app.post("/api/auth/reset-password", rateLimiter, async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const redirectTo = req.body.redirectTo ? String(req.body.redirectTo) : undefined;
      if (!email.includes("@")) {
        res.status(400).json({ error: "Email valido obrigatorio" });
        return;
      }
      await solicitarResetSenha(email, redirectTo);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao solicitar reset de senha" });
    }
  });

  app.get("/api/teste/auth-debug", async (_req, res) => {
    try {
      const admin = getSupabaseAdminClient();
      const { data: authData, error: authError } = await admin.auth.admin.listUsers();
      if (authError) throw authError;

      const { data: usuariosData, error: usuariosError } = await admin
        .from("usuarios")
        .select("id,tenant_id,nome,email,role,ativo,created_at")
        .order("created_at", { ascending: false });
      if (usuariosError) throw usuariosError;

      const { data: tenantsData, error: tenantsError } = await admin
        .from("tenants")
        .select("id,nome,slug,dominio,ativo,plano,created_at")
        .order("created_at", { ascending: true });
      if (tenantsError) throw tenantsError;

      const authUsers = authData.users.map(user => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        email_confirmed_at: user.email_confirmed_at,
        last_sign_in_at: user.last_sign_in_at,
        app_metadata: {
          role: user.app_metadata?.role,
          tenant_id: user.app_metadata?.tenant_id
        },
        user_metadata: {
          nome: user.user_metadata?.nome,
          role: user.user_metadata?.role,
          tenant_id: user.user_metadata?.tenant_id
        }
      }));
      const usuarios = (usuariosData || []).map(usuario => ({
        id: usuario.id,
        tenant_id: usuario.tenant_id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        ativo: usuario.ativo,
        created_at: usuario.created_at
      }));
      const tenantIds = new Set((tenantsData || []).map(tenant => tenant.id));
      const authIds = new Set(authUsers.map(user => user.id));
      const profileIds = new Set(usuarios.map(usuario => usuario.id));
      const inconsistencias = [
        ...authUsers
          .filter(user => !profileIds.has(user.id))
          .map(user => ({ tipo: "auth_sem_public_usuarios", id: user.id, email: user.email })),
        ...usuarios
          .filter(usuario => !authIds.has(usuario.id))
          .map(usuario => ({ tipo: "public_usuarios_sem_auth", id: usuario.id, email: usuario.email })),
        ...usuarios
          .filter(usuario => usuario.tenant_id && !tenantIds.has(usuario.tenant_id))
          .map(usuario => ({ tipo: "tenant_inexistente", id: usuario.id, email: usuario.email, tenant_id: usuario.tenant_id })),
        ...authUsers
          .filter(user => {
            const profile = usuarios.find(usuario => usuario.id === user.id);
            return profile && user.email && profile.email && user.email.toLowerCase() !== profile.email.toLowerCase();
          })
          .map(user => ({ tipo: "email_divergente", id: user.id, auth_email: user.email, public_email: usuarios.find(usuario => usuario.id === user.id)?.email }))
      ];

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        env: {
          supabase_url_configurado: Boolean(supabaseUrl),
          anon_key_configurada: Boolean(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
          service_role_configurada: Boolean(supabaseServiceKey),
          superadmin_email_configurado: Boolean(superadminEmail),
          superadmin_password_configurada: Boolean(superadminPassword),
          seed_dev_admin_email_configurado: Boolean(process.env.SEED_DEV_ADMIN_EMAIL),
          seed_dev_admin_password_configurada: Boolean(process.env.SEED_DEV_ADMIN_PASSWORD)
        },
        counts: {
          auth_users: authUsers.length,
          public_usuarios: usuarios.length,
          tenants: tenantsData?.length || 0,
          inconsistencias: inconsistencias.length
        },
        emails_encontrados: {
          auth_users: authUsers.map(user => user.email).filter(Boolean),
          public_usuarios: usuarios.map(usuario => usuario.email).filter(Boolean)
        },
        auth_users: authUsers,
        public_usuarios: usuarios,
        tenants: tenantsData || [],
        inconsistencias
      });
    } catch (error) {
      console.error("[auth-debug] erro", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Erro no diagnostico de autenticacao"
      });
    }
  });

  app.post("/api/auth/admin/session", (req, res) => {
    const token = String(req.body.token || "");
    const authorization = req.headers.authorization;
    req.headers.authorization = `Bearer ${token}`;
    const session = getAuthSession(req);
    req.headers.authorization = authorization;
    const user = session ? authUsers.find(item => item.id === session.sub) : undefined;
    if (!user) {
      res.status(401).json({ error: "Sessao invalida ou expirada" });
      return;
    }
    res.json({
      user: publicAuthUser(user),
      profile: publicAuthProfile(user)
    });
  });

  app.get("/api/auth/session", requireAuth, (req, res) => {
    const session = getAuthSession(req)!;
    const user = authUsers.find(item => item.id === session.sub)!;
    res.json({ user: publicAuthUser(user), profile: publicAuthProfile(user) });
  });

  app.get("/api/auth/me", requireSupabaseJwt, (req, res) => {
    const usuario = (req as express.Request & { usuario?: UsuarioRecord }).usuario;
    if (usuario) {
      res.json({ usuario: publicUsuario(usuario) });
      return;
    }
    const session = (req as express.Request & { authSession?: AuthSession }).authSession || getAuthSession(req);
    const legacyUser = session ? authUsers.find(item => item.id === session.sub) : undefined;
    if (!legacyUser) {
      res.status(401).json({ error: "Sessao invalida ou expirada" });
      return;
    }
    res.json({ user: publicAuthUser(legacyUser), profile: publicAuthProfile(legacyUser) });
  });

  app.use("/api/superadmin", rateLimiter, requireSuperAdmin);

  app.get("/api/superadmin/tenants", (req, res) => {
    res.json(tenants);
  });

  app.get("/api/superadmin/plans", (req, res) => {
    res.json(getSuperadminPlanCatalog());
  });

  app.post("/api/superadmin/tenants", async (req, res) => {
    const nome = String(req.body.nome || "").trim();
    const slug = String(req.body.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    const percentualPlataforma = Number(req.body.percentual_plataforma ?? 0);
    if (nome.length < 2 || slug.length < 2) {
      res.status(400).json({ error: "Nome e slug do tenant sao obrigatorios" });
      return;
    }
    if (!Number.isFinite(percentualPlataforma) || percentualPlataforma < 0 || percentualPlataforma > 100) {
      res.status(400).json({ error: "Percentual da plataforma deve estar entre 0 e 100" });
      return;
    }
    const now = new Date().toISOString();
    const requestedPlan = String(req.body.plano || "starter").trim().toLowerCase();
    const plan = getTenantPlan(requestedPlan);
    const tenant: TenantRecord = {
      id: String(req.body.id || createPublicId("TENANT_")),
      nome,
      slug,
      dominio_customizado: String(req.body.dominio_customizado || "").trim(),
      status: operationalTenantStatuses.includes(String(req.body.status) as TenantRecord["status"]) ? req.body.status : "active",
      logo_url: String(req.body.logo_url || "").trim(),
      cor_primaria: String(req.body.cor_primaria || "#06b6d4"),
      plano: plan.id,
      percentual_plataforma: req.body.percentual_plataforma !== undefined ? percentualPlataforma : plan.percentual_comissao,
      criado_em: now,
      atualizado_em: now
    };
    if (tenants.some(item => item.id === tenant.id || item.slug === tenant.slug)) {
      res.status(409).json({ error: "Tenant ja existe" });
      return;
    }
    tenants.push(tenant);
    let initialAdmin: ReturnType<typeof publicAuthUser> | null = null;
    let initialAdminProfile: ReturnType<typeof publicAuthProfile> | null = null;
    let temporaryPassword: string | undefined;
    if (req.body.admin || req.body.admin_email) {
      try {
        const adminPayload = req.body.admin || {
          nome: req.body.admin_nome || `${nome} Admin`,
          email: req.body.admin_email,
          password: req.body.admin_password
        };
        const created = await createTenantAdminUser(tenant.id, adminPayload);
        initialAdmin = publicAuthUser(created.user);
        initialAdminProfile = publicAuthProfile(created.user);
        temporaryPassword = created.temporaryPassword;
        recordSecurityEvent({
          tenant_id: tenant.id,
          action: "TENANT_ADMIN_CREATED",
          ip: String(req.ip || req.socket.remoteAddress || ""),
          status: "INFO",
          severity: "medium",
          actor: getAuthSession(req)?.email,
          detail: created.user.email
        });
      } catch (error) {
        tenants.splice(tenants.findIndex(item => item.id === tenant.id), 1);
        res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao criar admin inicial" });
        return;
      }
    }
    recordSecurityEvent({
      tenant_id: tenant.id,
      action: "TENANT_CREATED",
      ip: String(req.ip || req.socket.remoteAddress || ""),
      status: "INFO",
      severity: "low",
      actor: getAuthSession(req)?.email,
      detail: tenant.slug
    });
    res.status(201).json({
      ...tenant,
      plan: getTenantPlan(tenant.id),
      tenant,
      admin: initialAdmin ? { user: initialAdmin, profile: initialAdminProfile, temporaryPassword } : null
    });
  });

  app.post("/api/superadmin/tenants/:tenantId/admins", async (req, res) => {
    try {
      const created = await createTenantAdminUser(req.params.tenantId, { ...req.body, role: req.body.role || "tenant_admin" });
      recordSecurityEvent({
        tenant_id: req.params.tenantId,
        action: "TENANT_ADMIN_CREATED",
        ip: String(req.ip || req.socket.remoteAddress || ""),
        status: "INFO",
        severity: "medium",
        actor: getAuthSession(req)?.email,
        detail: created.user.email
      });
      res.status(201).json({
        user: publicAuthUser(created.user),
        profile: publicAuthProfile(created.user),
        temporaryPassword: created.temporaryPassword
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao criar admin do tenant";
      res.status(message.includes("cadastrado") ? 409 : 400).json({ error: message });
    }
  });

  app.post("/api/superadmin/tenants/:tenantId/admins/:userId/reset-password", async (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.tenantId && isActiveTenantRecord(item));
    const user = authUsers.find(item => item.id === req.params.userId && item.tenant_id === req.params.tenantId && normalizeAuthRole(item.role) === "admin");
    if (!tenant || !user) {
      res.status(404).json({ error: "Admin do tenant nao encontrado" });
      return;
    }
    const temporaryPassword = String(req.body.password || req.body.senha || "") || generateTemporaryPassword();
    if (temporaryPassword.length < 8) {
      res.status(400).json({ error: "Senha temporaria deve ter pelo menos 8 caracteres" });
      return;
    }
    user.senha_hash = await bcrypt.hash(temporaryPassword, 12);
    recordSecurityEvent({
      tenant_id: tenant.id,
      action: "TENANT_ADMIN_PASSWORD_RESET",
      ip: String(req.ip || req.socket.remoteAddress || ""),
      status: "WARN",
      severity: "medium",
      actor: getAuthSession(req)?.email,
      detail: user.email
    });
    res.json({ user: publicAuthUser(user), profile: publicAuthProfile(user), temporaryPassword });
  });

  app.put("/api/superadmin/tenants/:id", async (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.id);
    if (!tenant) {
      res.status(404).json({ error: "Tenant nao encontrado" });
      return;
    }
    const before = deepClone(tenant);
    const nome = req.body.nome !== undefined ? String(req.body.nome).trim() : tenant.nome;
    const slug = req.body.slug !== undefined
      ? String(req.body.slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, "")
      : tenant.slug;
    const percentualPlataforma = req.body.percentual_plataforma !== undefined
      ? Number(req.body.percentual_plataforma)
      : tenant.percentual_plataforma;
    if (nome.length < 2 || slug.length < 2) {
      res.status(400).json({ error: "Nome e slug do tenant sao obrigatorios" });
      return;
    }
    if (tenants.some(item => item.id !== tenant.id && item.slug === slug)) {
      res.status(409).json({ error: "Slug ja utilizado por outro tenant" });
      return;
    }
    if (!Number.isFinite(percentualPlataforma) || percentualPlataforma < 0 || percentualPlataforma > 100) {
      res.status(400).json({ error: "Percentual da plataforma deve estar entre 0 e 100" });
      return;
    }
    tenant.nome = nome;
    tenant.slug = slug;
    const oldDomain = tenant.dominio_customizado;
    const oldPlan = tenant.plano;
    tenant.dominio_customizado = req.body.dominio_customizado !== undefined ? String(req.body.dominio_customizado).trim() : tenant.dominio_customizado;
    tenant.logo_url = req.body.logo_url !== undefined ? String(req.body.logo_url).trim() : tenant.logo_url;
    tenant.cor_primaria = req.body.cor_primaria !== undefined ? String(req.body.cor_primaria) : tenant.cor_primaria;
    tenant.plano = req.body.plano !== undefined ? getTenantPlan(String(req.body.plano)).id : tenant.plano;
    tenant.percentual_plataforma = percentualPlataforma;
    if (operationalTenantStatuses.includes(String(req.body.status) as TenantRecord["status"])) {
      tenant.status = req.body.status;
    }
    tenant.atualizado_em = new Date().toISOString();
    if (oldDomain !== tenant.dominio_customizado) {
      recordSecurityEvent({ tenant_id: tenant.id, action: "DOMAIN_CHANGED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "WARN", severity: "medium", actor: getAuthSession(req)?.email, detail: `${oldDomain || "(vazio)"} -> ${tenant.dominio_customizado || "(vazio)"}` });
    }
    if (oldPlan !== tenant.plano) {
      recordSecurityEvent({ tenant_id: tenant.id, action: "PLAN_CHANGED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", actor: getAuthSession(req)?.email, detail: `${oldPlan} -> ${tenant.plano}` });
    }
    if (oldPlan !== tenant.plano) {
      try {
        await persistTenantPlanRecord(tenant, "superadmin-tenant-edit-plan");
      } catch (error) {
        Object.assign(tenant, before);
        res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao persistir plano do cliente" });
        return;
      }
    }
    res.json(tenant);
  });

  app.patch("/api/superadmin/tenants/:id/status", (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.id);
    const status = String(req.body.status || "");
    if (!tenant) {
      res.status(404).json({ error: "Tenant nao encontrado" });
      return;
    }
    if (!operationalTenantStatuses.includes(status as TenantRecord["status"])) {
      res.status(400).json({ error: "Status invalido" });
      return;
    }
    tenant.status = status as TenantRecord["status"];
    tenant.atualizado_em = new Date().toISOString();
    res.json(tenant);
  });

  function getTenantPaidRevenue(tenantId: string) {
    const traditional = purchases
      .filter(purchase => purchase.tenant_id === tenantId && purchase.status === "paid")
      .reduce((sum, purchase) => sum + purchase.amount, 0);
    const modes = numberModePurchases
      .filter(purchase => purchase.tenant_id === tenantId && purchase.status === "paid")
      .reduce((sum, purchase) => sum + purchase.amount, 0);
    const farm = fazendinhaCompras
      .filter(purchase => purchase.tenant_id === tenantId && purchase.statusPagamento === "paid")
      .reduce((sum, purchase) => sum + purchase.valorPago, 0);
    return Number((traditional + modes + farm).toFixed(2));
  }

  type RevenueRow = {
    tenant_id: string;
    tenant: string;
    campaignId: string;
    campaign: string;
    orderId: string;
    customer: string;
    amount: number;
    status: string;
    gateway: string;
    createdAt: string;
    paidAt: string;
    fee: number;
    netAmount: number;
    channel: string;
  };

  function findTenantName(tenantId: string) {
    return tenants.find(tenant => tenant.id === tenantId)?.nome || tenantId;
  }

  function paidAtFromHistory(history?: Array<{ status: string; date: string }>) {
    return history?.find(item => item.status === "paid")?.date || "";
  }

  function collectRevenueRows() {
    const rows: RevenueRow[] = [];
    purchases.forEach(purchase => {
      const raffle = raffles.find(item => item.tenant_id === purchase.tenant_id && item.id === purchase.raffleId);
      rows.push({
        tenant_id: purchase.tenant_id,
        tenant: findTenantName(purchase.tenant_id),
        campaignId: purchase.raffleId,
        campaign: raffle?.title || purchase.raffleId,
        orderId: purchase.purchaseId,
        customer: purchase.customer?.name || purchase.contact,
        amount: purchase.amount,
        status: purchase.status,
        gateway: String(purchase.pixGateway || "pix"),
        createdAt: purchase.createdAt,
        paidAt: paidAtFromHistory(purchase.paymentHistory),
        fee: 0,
        netAmount: purchase.amount,
        channel: "rifa"
      });
    });
    numberModePurchases.forEach(purchase => rows.push({
      tenant_id: purchase.tenant_id,
      tenant: findTenantName(purchase.tenant_id),
      campaignId: purchase.mode,
      campaign: purchase.mode.toUpperCase(),
      orderId: purchase.id,
      customer: purchase.customer?.name || purchase.customer?.phone || "",
      amount: purchase.amount,
      status: purchase.status === "paid" ? "paid" : "pending",
      gateway: "pix",
      createdAt: purchase.createdAt,
      paidAt: purchase.status === "paid" ? purchase.createdAt : "",
      fee: 0,
      netAmount: purchase.amount,
      channel: "modalidade"
    }));
    fazendinhaCompras.forEach(purchase => rows.push({
      tenant_id: purchase.tenant_id,
      tenant: findTenantName(purchase.tenant_id),
      campaignId: "fazendinha",
      campaign: "A Fazendinha",
      orderId: purchase.id,
      customer: purchase.customer?.name || purchase.customer?.phone || "",
      amount: purchase.valorPago,
      status: purchase.statusPagamento === "paid" ? "paid" : "pending",
      gateway: "pix",
      createdAt: purchase.dataCompra,
      paidAt: purchase.statusPagamento === "paid" ? purchase.dataCompra : "",
      fee: 0,
      netAmount: purchase.valorPago,
      channel: "fazendinha"
    }));
    return rows;
  }

  function resolveDateRange(query: express.Request["query"]) {
    const now = new Date();
    const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    const preset = String(query.period || query.preset || "");
    let start = query.startDate ? new Date(String(query.startDate)) : new Date(0);
    let end = query.endDate ? endOfDay(new Date(String(query.endDate))) : new Date("2999-12-31T23:59:59.999Z");
    if (preset === "today") { start = startOfDay(now); end = endOfDay(now); }
    if (preset === "yesterday") { const y = new Date(now); y.setDate(y.getDate() - 1); start = startOfDay(y); end = endOfDay(y); }
    if (preset === "last7") { start = startOfDay(new Date(now.getTime() - 6 * 86400000)); end = endOfDay(now); }
    if (preset === "last30") { start = startOfDay(new Date(now.getTime() - 29 * 86400000)); end = endOfDay(now); }
    if (preset === "currentMonth") { start = new Date(now.getFullYear(), now.getMonth(), 1); end = endOfDay(now); }
    if (preset === "previousMonth") { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); }
    if (preset === "currentYear") { start = new Date(now.getFullYear(), 0, 1); end = endOfDay(now); }
    return { start, end };
  }

  function groupSum(rows: RevenueRow[], key: (row: RevenueRow) => string) {
    return Object.values(rows.reduce<Record<string, { key: string; amount: number; orders: number }>>((acc, row) => {
      const itemKey = key(row);
      acc[itemKey] ||= { key: itemKey, amount: 0, orders: 0 };
      acc[itemKey].amount += row.amount;
      acc[itemKey].orders += 1;
      return acc;
    }, {})).map(item => ({ ...item, amount: Number(item.amount.toFixed(2)) }));
  }

  function buildRevenueReport(query: express.Request["query"], forcedTenantId?: string) {
    const { start, end } = resolveDateRange(query);
    const tenantId = forcedTenantId || String(query.tenant_id || query.tenantId || "");
    const gateway = String(query.gateway || "");
    const status = String(query.status || "");
    const campaignId = String(query.raffleId || query.campaignId || "");
    const rows = collectRevenueRows().filter(row => {
      const created = new Date(row.createdAt).getTime();
      return created >= start.getTime() &&
        created <= end.getTime() &&
        (!tenantId || row.tenant_id === tenantId) &&
        (!gateway || row.gateway === gateway) &&
        (!status || row.status === status) &&
        (!campaignId || row.campaignId === campaignId);
    });
    const paidRows = rows.filter(row => row.status === "paid");
    const totalRevenue = paidRows.reduce((sum, row) => sum + row.amount, 0);
    const pendingRevenue = rows.filter(row => row.status === "pending" || row.status === "reserved").reduce((sum, row) => sum + row.amount, 0);
    return {
      filters: { startDate: start.toISOString(), endDate: end.toISOString(), tenant_id: tenantId, gateway, status, campaignId },
      summary: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        pendingRevenue: Number(pendingRevenue.toFixed(2)),
        paidOrders: paidRows.length,
        pendingOrders: rows.filter(row => row.status === "pending" || row.status === "reserved").length,
        cancelledOrders: rows.filter(row => row.status === "cancelled").length,
        averageTicket: paidRows.length ? Number((totalRevenue / paidRows.length).toFixed(2)) : 0,
        conversionRate: rows.length ? Number(((paidRows.length / rows.length) * 100).toFixed(2)) : 0
      },
      charts: {
        byDay: groupSum(paidRows, row => row.createdAt.slice(0, 10)).sort((a, b) => a.key.localeCompare(b.key)),
        byMonth: groupSum(paidRows, row => row.createdAt.slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key)),
        byTenant: groupSum(paidRows, row => row.tenant),
        byGateway: groupSum(paidRows, row => row.gateway),
        byStatus: groupSum(rows, row => row.status),
        topRaffles: groupSum(paidRows, row => row.campaign).sort((a, b) => b.amount - a.amount).slice(0, 10)
      },
      rows: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    };
  }

  function revenueReportToCsv(rows: RevenueRow[]) {
    const header = ["tenant", "campanha", "pedido", "cliente", "valor", "status", "gateway", "data_criacao", "data_pagamento", "taxa", "valor_liquido"];
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    return [header.join(","), ...rows.map(row => [
      row.tenant, row.campaign, row.orderId, row.customer, row.amount, row.status, row.gateway, row.createdAt, row.paidAt, row.fee, row.netAmount
    ].map(escape).join(","))].join("\n");
  }

  function publicReportExport(exportRecord: ReportExportRecord) {
    const { file_url, ...safe } = exportRecord;
    return safe;
  }

  function reportContentType(format: string) {
    if (format === "pdf") return "application/pdf";
    if (format === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return "text/csv; charset=utf-8";
  }

  function reportExtension(format: string) {
    return format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv";
  }

  function escapePdfText(value: unknown) {
    return String(value ?? "").replace(/[\\()]/g, "\\$&").replace(/\r?\n/g, " ");
  }

  function buildPdfBuffer(lines: string[]) {
    const content = lines.slice(0, 56).map((line, index) => `BT /F1 9 Tf 36 ${790 - index * 13} Td (${escapePdfText(line).slice(0, 118)}) Tj ET`).join("\n");
    const objects = [
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
      "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
      `5 0 obj << /Length ${Buffer.byteLength(content, "utf8")} >> stream\n${content}\nendstream endobj`
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, "utf8"));
      pdf += `${object}\n`;
    }
    const xrefStart = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(pdf, "utf8");
  }

  function maskSensitiveReportRow(row: RevenueRow) {
    return { ...row, customer: maskDisplayName(row.customer) };
  }

  function buildOfficialReportPayload(input: { reportType: string; filters: Record<string, unknown>; tenantId?: string | null; global?: boolean }) {
    const reportType = input.reportType || "financial_tenant";
    const query = input.filters as express.Request["query"];
    const report = buildRevenueReport(query, input.global ? undefined : input.tenantId || undefined);
    const tenant = input.tenantId ? tenants.find(item => item.id === input.tenantId) : null;
    const rows = report.rows.map(maskSensitiveReportRow);
    if (reportType === "draw_report" || reportType === "draw_certificate") {
      const raffleId = String(input.filters.raffleId || input.filters.raffle_id || "");
      const audit = raffleDrawAudits.find(item => (!input.tenantId || item.tenant_id === input.tenantId) && (!raffleId || item.raffle_id === raffleId));
      return {
        title: reportType === "draw_certificate" ? "Certificado do sorteio auditavel" : "Relatorio de sorteio",
        tenant,
        summary: audit ? { winning_number: audit.winning_number, server_seed_hash: audit.server_seed_hash, eligible_numbers_hash: audit.eligible_numbers_hash, result_hash: audit.result_hash, algorithm_version: audit.algorithm_version } : {},
        rows: audit ? [sanitizeDrawAuditForPublic(audit)] : [],
        report
      };
    }
    const titles: Record<string, string> = {
      financial_tenant: "Relatorio financeiro por tenant",
      financial_global: "Relatorio financeiro global superadmin",
      sold_tickets: "Relatorio de cotas vendidas",
      ticket_adjustments: "Relatorio de alteracoes de cotas",
      audit_ledger: "Relatorio de auditoria",
      lgpd: "Relatorio LGPD",
      affiliates: "Relatorio de afiliados",
      whatsapp: "Relatorio de WhatsApp/envios"
    };
    return {
      title: titles[reportType] || "Relatorio oficial",
      tenant,
      summary: report.summary,
      rows,
      report
    };
  }

  function buildOfficialReportFile(input: { reportType: string; format: "pdf" | "csv" | "xlsx"; filters: Record<string, unknown>; tenantId?: string | null; global?: boolean; generatedBy: string; requestId: string; baseUrl: string }) {
    const generatedAt = new Date().toISOString();
    const payload = buildOfficialReportPayload(input);
    const tenantName = payload.tenant?.nome || (input.global ? "Global Plataforma" : findTenantName(input.tenantId || legacyTenantId));
    const validationPath = `/api/public/reports/validate/${input.requestId}`;
    const validationUrl = `${input.baseUrl}${validationPath}`;
    const baseLines = [
      "CIFHER Plataforma - Relatorio oficial auditavel",
      `Tipo: ${payload.title}`,
      `Tenant: ${tenantName}`,
      `CNPJ: ${(payload.tenant as any)?.cnpj || "Nao informado"}`,
      `Periodo/filtros: ${JSON.stringify(input.filters)}`,
      `Gerado em: ${generatedAt}`,
      `Gerado por: ${input.generatedBy}`,
      `Request ID: ${input.requestId}`,
      `Validacao publica/QR Code: ${validationUrl}`,
      `Totais: ${JSON.stringify(payload.summary)}`,
      "Assinatura digital/hash: calculada sobre o conteudo oficial do relatorio",
      "",
      "Amostra de registros:",
      ...payload.rows.slice(0, 30).map((row: any, index: number) => `${index + 1}. ${JSON.stringify(row)}`)
    ];
    const csv = input.reportType.includes("financial") || input.reportType === "sold_tickets"
      ? revenueReportToCsv((payload.rows as RevenueRow[]))
      : [Object.keys(payload.rows[0] || { tipo: input.reportType }).join(","), ...payload.rows.map((row: any) => Object.values(row).map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const body = input.format === "pdf" ? buildPdfBuffer(baseLines) : Buffer.from(csv, "utf8");
    const fileHash = createHash("sha256").update(body).digest("hex");
    const finalBody = input.format === "pdf"
      ? buildPdfBuffer([...baseLines, `Hash do relatorio: ${fileHash}`, `Assinatura digital/hash: ${fileHash}`])
      : Buffer.from(`${csv}\n# hash_relatorio,${fileHash}\n# request_id,${input.requestId}\n# validacao,${validationUrl}\n`, "utf8");
    const finalHash = createHash("sha256").update(finalBody).digest("hex");
    return { body: finalBody, fileHash: finalHash, validationUrl, payload, generatedAt };
  }

  function createReportExport(req: express.Request, input: { reportType: string; format?: "pdf" | "csv" | "xlsx"; filters?: Record<string, unknown>; tenantId?: string | null; global?: boolean }) {
    const session = getAuthSession(req);
    const requestId = (req as express.Request & { requestId?: string }).requestId || randomUUID();
    const format = input.format || "pdf";
    const protocol = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0];
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost")
      .split(",")[0]
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "")
      .replace(/:\d+$/, "");
    const baseUrl = `${protocol}://${host}`;
    const generatedBy = session?.email || "system";
    const file = buildOfficialReportFile({
      reportType: input.reportType,
      format,
      filters: input.filters || {},
      tenantId: input.tenantId,
      global: input.global,
      generatedBy,
      requestId,
      baseUrl
    });
    const id = createPublicId("REP_");
    const record: ReportExportRecord = {
      id,
      tenant_id: input.global ? null : input.tenantId || resolveRequestTenantId(req),
      report_type: input.reportType,
      filters: input.filters || {},
      format,
      file_url: `data:${reportContentType(format).split(";")[0]};base64,${file.body.toString("base64")}`,
      file_hash: file.fileHash,
      generated_by: generatedBy,
      status: "generated",
      request_id: requestId,
      qr_validation_url: file.validationUrl,
      created_at: file.generatedAt
    };
    reportExports.unshift(record);
    reportExports = reportExports.slice(0, 1000);
    return record;
  }

  function sendReportDownload(res: express.Response, record: ReportExportRecord) {
    const base64 = record.file_url.split(",")[1] || "";
    const body = Buffer.from(base64, "base64");
    res.setHeader("Content-Type", reportContentType(record.format));
    res.setHeader("Content-Disposition", `attachment; filename="${record.report_type}-${record.id}.${reportExtension(record.format)}"`);
    res.setHeader("X-Report-Hash", record.file_hash);
    res.send(body);
  }

  function buildTenantSummary(tenant: TenantRecord) {
    const paidRevenue = getTenantPaidRevenue(tenant.id);
    const commissionAmount = Number((paidRevenue * tenant.percentual_plataforma / 100).toFixed(2));
    const plan = getTenantPlan(tenant.id);
    return {
      ...tenant,
      plan,
      raffleCount: raffles.filter(raffle => raffle.tenant_id === tenant.id).length,
      activeRaffleCount: raffles.filter(raffle => raffle.tenant_id === tenant.id && raffle.status === "active").length,
      purchaseCount:
        purchases.filter(purchase => purchase.tenant_id === tenant.id).length +
        numberModePurchases.filter(purchase => purchase.tenant_id === tenant.id).length +
        fazendinhaCompras.filter(purchase => purchase.tenant_id === tenant.id).length,
      paidRevenue,
      platformCommission: commissionAmount,
      pendingPix: purchases.filter(purchase => purchase.tenant_id === tenant.id && purchase.status === "pending").length,
      webhookErrors: paymentWebhookLogs.filter(log => log.tenant_id === tenant.id && ["failed", "invalid"].includes(log.status)).length,
      planUsage: {
        raffles: `${raffles.filter(raffle => raffle.tenant_id === tenant.id).length}/${plan.limite_rifas}`,
        sales: `${purchases.filter(purchase => purchase.tenant_id === tenant.id).length}/${plan.limite_vendas_mes}`
      }
    };
  }

  app.get("/api/superadmin/overview", (req, res) => {
    const tenantSummaries = tenants.map(buildTenantSummary);
    const globalRevenue = buildRevenueReport(req.query);
    const todayRevenue = buildRevenueReport({ period: "today" });
    const last7Revenue = buildRevenueReport({ period: "last7" });
    const monthRevenue = buildRevenueReport({ period: "currentMonth" });
    const yearRevenue = buildRevenueReport({ period: "currentYear" });
    const tenantRanking = [...tenantSummaries]
      .sort((a, b) => b.paidRevenue - a.paidRevenue)
      .slice(0, 10)
      .map((tenant, index) => ({ position: index + 1, tenant_id: tenant.id, tenant: tenant.nome, paidRevenue: tenant.paidRevenue, platformCommission: tenant.platformCommission }));
    res.json({
      metrics: {
        tenants: tenants.length,
        activeTenants: tenants.filter(tenant => tenant.status === "active").length,
        inactiveTenants: tenants.filter(tenant => tenant.status !== "active").length,
        raffles: raffles.length,
        activeRaffles: raffles.filter(raffle => raffle.status === "active").length,
        purchases: purchases.length + numberModePurchases.length + fazendinhaCompras.length,
        paidRevenue: tenantSummaries.reduce((sum, tenant) => sum + tenant.paidRevenue, 0),
        revenueToday: todayRevenue.summary.totalRevenue,
        revenueLast7Days: last7Revenue.summary.totalRevenue,
        revenueCurrentMonth: monthRevenue.summary.totalRevenue,
        revenueCurrentYear: yearRevenue.summary.totalRevenue,
        platformCommission: tenantSummaries.reduce((sum, tenant) => sum + tenant.platformCommission, 0),
        pendingPix: purchases.filter(purchase => purchase.status === "pending").length,
        paidOrders: globalRevenue.summary.paidOrders,
        pendingOrders: globalRevenue.summary.pendingOrders,
        averageTicket: globalRevenue.summary.averageTicket,
        conversionRate: globalRevenue.summary.conversionRate,
        webhookErrors: paymentWebhookLogs.filter(log => ["failed", "invalid"].includes(log.status)).length,
        suspiciousAlerts: securityLogs.filter(log => ["WARN", "BLOCKED"].includes(log.status)).length,
        queuedPayments: paymentQueue.filter(job => ["pending", "processing"].includes(job.status)).length +
          payment_webhook_jobs.filter(job => ["pending", "processing"].includes(job.status)).length +
          payment_reconciliation_jobs.filter(job => ["pending", "processing"].includes(job.status)).length +
          payment_release_jobs.filter(job => ["pending", "processing"].includes(job.status)).length
      },
      charts: globalRevenue.charts,
      tenants: tenantSummaries,
      ranking: tenantRanking,
      plans: getSuperadminPlanCatalog()
    });
  });

  app.get("/api/superadmin/audit/security", (req, res) => {
    res.json(securityLogs);
  });

  app.get("/api/superadmin/raffles", (req, res) => {
    res.json(raffles.map(raffle => ({
      ...sanitizeRaffleForAdmin(raffle),
      tenant: tenants.find(tenant => tenant.id === raffle.tenant_id)?.nome || raffle.tenant_id
    })));
  });

  app.get("/api/superadmin/sales", (req, res) => {
    const traditional = purchases.map(purchase => ({
      id: purchase.purchaseId,
      tenant_id: purchase.tenant_id,
      tenant: tenants.find(tenant => tenant.id === purchase.tenant_id)?.nome || purchase.tenant_id,
      product: raffles.find(raffle => raffle.id === purchase.raffleId && raffle.tenant_id === purchase.tenant_id)?.title || purchase.raffleId,
      channel: "rifa",
      customer: purchase.customer?.name || purchase.contact,
      amount: purchase.amount,
      status: purchase.status,
      createdAt: purchase.createdAt
    }));
    const modes = numberModePurchases.map(purchase => ({
      id: purchase.id,
      tenant_id: purchase.tenant_id,
      tenant: tenants.find(tenant => tenant.id === purchase.tenant_id)?.nome || purchase.tenant_id,
      product: purchase.mode.toUpperCase(),
      channel: "modalidade",
      customer: purchase.customer.name,
      amount: purchase.amount,
      status: purchase.status === "reserved" ? "pending" : purchase.status,
      createdAt: purchase.createdAt
    }));
    const farm = fazendinhaCompras.map(purchase => ({
      id: purchase.id,
      tenant_id: purchase.tenant_id,
      tenant: tenants.find(tenant => tenant.id === purchase.tenant_id)?.nome || purchase.tenant_id,
      product: "Fazendinha",
      channel: "fazendinha",
      customer: purchase.customer.name,
      amount: purchase.valorPago,
      status: purchase.statusPagamento === "reserved" ? "pending" : purchase.statusPagamento,
      createdAt: purchase.dataCompra
    }));
    res.json([...traditional, ...modes, ...farm].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  app.get("/api/superadmin/commissions", (req, res) => {
    const byTenant = tenants.map(tenant => {
      const summary = buildTenantSummary(tenant);
      return {
        tenant_id: tenant.id,
        tenant: tenant.nome,
        percentual: tenant.percentual_plataforma,
        paidRevenue: summary.paidRevenue,
        platformCommission: summary.platformCommission
      };
    });
    res.json({
      total: byTenant.reduce((sum, item) => sum + item.platformCommission, 0),
      byTenant
    });
  });

  app.get("/api/superadmin/payments/pix", (req, res) => {
    res.json(purchases.map(purchase => ({
      id: purchase.purchaseId,
      tenant_id: purchase.tenant_id,
      tenant: tenants.find(tenant => tenant.id === purchase.tenant_id)?.nome || purchase.tenant_id,
      customer: purchase.customer?.name || purchase.contact,
      amount: purchase.amount,
      gateway: purchase.pixGateway || getTenantGateways(purchase.tenant_id).active,
      status: purchase.status,
      createdAt: purchase.createdAt
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  app.get("/api/superadmin/payments/webhooks", (req, res) => {
    res.json(paymentWebhookLogs);
  });

  app.get("/api/superadmin/payments/queue", (req, res) => {
    res.json({
      ...buildPaymentQueuesDashboard(),
      settlement: paymentQueue.map(job => ({
        ...job,
        tenant: tenants.find(tenant => tenant.id === job.tenant_id)?.nome || job.tenant_id
      }))
    });
  });

  app.get("/api/superadmin/whatsapp/overview", (_req, res) => {
    const sent = whatsappMessageQueue.filter(message => message.status === "sent").length;
    const failed = whatsappMessageQueue.filter(message => message.status === "failed").length;
    const pending = whatsappMessageQueue.filter(message => ["pending", "retrying"].includes(message.status)).length;
    res.json({
      metrics: {
        sent,
        failed,
        pending,
        activeTenants: whatsappProviderConfigs.filter(config => config.enabled).length,
        tenantsWithWhatsapp: whatsappProviderConfigs.length
      },
      byProvider: Object.values(whatsappMessageQueue.reduce<Record<string, { provider: string; total: number; sent: number; failed: number; pending: number }>>((acc, message) => {
        acc[message.provider] ||= { provider: message.provider, total: 0, sent: 0, failed: 0, pending: 0 };
        acc[message.provider].total += 1;
        if (message.status === "sent") acc[message.provider].sent += 1;
        else if (message.status === "failed") acc[message.provider].failed += 1;
        else acc[message.provider].pending += 1;
        return acc;
      }, {})),
      tenants: tenants.map(tenant => {
        const config = getWhatsAppConfig(tenant.id);
        const messages = whatsappMessageQueue.filter(message => message.tenant_id === tenant.id);
        return {
          tenant_id: tenant.id,
          tenant: tenant.nome,
          enabled: Boolean(config?.enabled),
          provider: config?.provider || "mock",
          environment: config?.environment || "sandbox",
          sent: messages.filter(message => message.status === "sent").length,
          failed: messages.filter(message => message.status === "failed").length,
          pending: messages.filter(message => ["pending", "retrying"].includes(message.status)).length
        };
      })
    });
  });

  app.get("/api/superadmin/whatsapp/messages", (_req, res) => {
    res.json(whatsappMessageQueue.map(message => ({
      ...message,
      phone: maskPhone(message.phone),
      tenant: tenants.find(tenant => tenant.id === message.tenant_id)?.nome || message.tenant_id
    })));
  });

  app.post("/api/superadmin/payments/queue/process", async (req, res) => {
    const processedDetails = await processAllPaymentWorkerQueues(Number(req.body?.limit || 50));
    const processed = Object.values(processedDetails).reduce((sum, value) => sum + Number(value || 0), 0);
    res.json({
      processed,
      processedDetails,
      queues: buildPaymentQueuesDashboard()
    });
  });

  app.post("/api/superadmin/payments/reconcile", (req, res) => {
    const stalePending = purchases.filter(purchase => purchase.status === "pending" && Date.now() - new Date(purchase.createdAt).getTime() > 15 * 60 * 1000);
    stalePending.forEach(purchase => enqueuePaymentReconciliationJob({
      tenant_id: purchase.tenant_id,
      provider: String(purchase.pixGateway || "unknown"),
      order_id: purchase.purchaseId,
      payload: { purchaseId: purchase.purchaseId, status: "reconciliation.pending" }
    }));
    res.json({
      queued: stalePending.length,
      pendingPurchases: stalePending.map(purchase => ({ tenant_id: purchase.tenant_id, purchaseId: purchase.purchaseId, amount: purchase.amount, createdAt: purchase.createdAt }))
    });
  });

  app.get("/api/superadmin/users", (req, res) => {
    res.json(authUsers.map(user => ({
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
      ativo: user.ativo,
      criado_em: user.criado_em
    })));
  });

  app.post("/api/superadmin/users", async (req, res) => {
    const nome = String(req.body.nome || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = String(req.body.role || "") as AuthRole;
    const tenantId = role === "superadmin" ? null : String(req.body.tenant_id || "");
    if (!nome || !email.includes("@") || password.length < 8 || !["superadmin", "tenant_admin", "tenant_user"].includes(role)) {
      res.status(400).json({ error: "Nome, email, senha com 8 caracteres e papel valido sao obrigatorios" });
      return;
    }
    if (role !== "superadmin" && !tenants.some(tenant => tenant.id === tenantId && isActiveTenantRecord(tenant))) {
      res.status(400).json({ error: "Tenant operacional obrigatorio para este papel" });
      return;
    }
    if (authUsers.some(item => item.email === email)) {
      res.status(409).json({ error: "Email ja cadastrado" });
      return;
    }
    const user: AuthUserRecord = {
      id: createPublicId("USR_"),
      nome,
      email,
      senha_hash: await bcrypt.hash(password, 12),
      role,
      tenant_id: tenantId,
      ativo: req.body.ativo !== false,
      criado_em: new Date().toISOString()
    };
    authUsers.push(user);
    res.status(201).json({ ...publicAuthUser(user), profile: publicAuthProfile(user) });
  });

  app.get("/api/superadmin/clientes", async (_req, res) => {
    try {
      res.json(await listarClientes());
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao listar clientes" });
    }
  });

  app.get("/api/superadmin/clientes/:id", async (req, res) => {
    try {
      res.json(await buscarCliente(req.params.id));
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Cliente nao encontrado" });
    }
  });

  app.post("/api/superadmin/clientes", async (req, res) => {
    try {
      res.status(201).json(await criarCliente(req.body));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao criar cliente" });
    }
  });

  app.put("/api/superadmin/clientes/:id", async (req, res) => {
    try {
      res.json(await atualizarCliente(req.params.id, req.body));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao atualizar cliente" });
    }
  });

  app.delete("/api/superadmin/clientes/:id", async (req, res) => {
    try {
      res.json(await deletarCliente(req.params.id));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao deletar cliente" });
    }
  });

  app.get("/api/superadmin/customers", (req, res) => {
    recordSuperadminAudit(req, "GLOBAL_CUSTOMERS_VIEW", { resource_type: "customer" });
    res.json(Object.values(customersByPhone).map(customer => ({ ...buildAdminCustomerProfile(customer), tenant: findTenantName(customer.tenant_id) })));
  });

  app.get("/api/superadmin/crm", (req, res) => {
    const contacts = listCrmContacts(req).map(contact => ({ ...contact, tenant: findTenantName(contact.tenant_id) }));
    recordSuperadminAudit(req, "GLOBAL_CRM_VIEW", { resource_type: "crm_contact" });
    res.json({ contacts, pipeline: buildCrmPipeline(contacts), segments: buildCrmSegments(contacts) });
  });

  app.put("/api/superadmin/customers/:id", (req, res) => {
    const customer = Object.values(customersByPhone).find(item => item.id === req.params.id);
    if (!customer) return res.status(404).json({ error: "Cliente nao encontrado" });
    let reason = "";
    try {
      reason = requireAuditReason(req.body.reason);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Motivo obrigatorio" });
    }
    const before = deepClone(customer);
    const oldPhone = customer.phone;
    const oldCpf = customer.cpf;
    customer.name = req.body.name ?? customer.name;
    customer.phone = req.body.phone ? normalizePhone(req.body.phone) : customer.phone;
    customer.cpf = req.body.cpf ? normalizeCpf(req.body.cpf) : customer.cpf;
    customer.city = req.body.city ?? customer.city;
    customer.state = req.body.state ?? customer.state;
    customer.blocked = req.body.blocked !== undefined ? Boolean(req.body.blocked) : customer.blocked;
    customer.blockedReason = req.body.blockedReason ?? customer.blockedReason;
    delete customersByPhone[tenantCustomerKey(customer.tenant_id, oldPhone)];
    delete customersByCpf[tenantCustomerKey(customer.tenant_id, oldCpf)];
    customersByPhone[tenantCustomerKey(customer.tenant_id, customer.phone)] = customer;
    customersByCpf[tenantCustomerKey(customer.tenant_id, customer.cpf)] = customer;
    purchases.forEach(purchase => {
      if (purchase.tenant_id === customer.tenant_id && purchase.customer?.id === customer.id) {
        purchase.customer = customer;
        purchase.contact = customer.phone;
      }
    });
    const after = buildAdminCustomerProfile(customer);
    recordSuperadminAudit(req, "GLOBAL_CUSTOMER_UPDATED", { tenant_id: customer.tenant_id, resource_type: "customer", resource_id: customer.id });
    recordAuditLedger(req, { tenant_id: customer.tenant_id, action: "SUPERADMIN_CUSTOMER_UPDATED", resource_type: "customer", resource_id: customer.id, before_data: before, after_data: after, reason });
    res.json(after);
  });

  app.get("/api/superadmin/integrations", (req, res) => {
    res.json({
      integrations: integrations.map(item => ({
        ...safeIntegration(item),
        tenant: tenants.find(tenant => tenant.id === item.tenant_id)?.nome || item.tenant_id
      })),
      summary: tenants.map(tenant => {
        const tenantIntegrations = integrations.filter(item => item.tenant_id === tenant.id);
        return {
          tenant_id: tenant.id,
          tenant: tenant.nome,
          active: tenantIntegrations.filter(item => item.status === "active").length,
          errors: tenantIntegrations.filter(item => item.status === "error").length,
          pending: tenantIntegrations.filter(item => item.status === "pending_config").length
        };
      })
    });
  });

  app.get("/api/superadmin/integration-logs", (req, res) => {
    res.json(integrationLogs.map(log => ({
      ...log,
      tenant: tenants.find(tenant => tenant.id === log.tenant_id)?.nome || log.tenant_id
    })));
  });

  app.get("/api/superadmin/webhooks", (req, res) => {
    res.json({
      endpoints: webhookEndpoints.map(endpoint => ({
        ...endpoint,
        secret: endpoint.secret ? "********" : "",
        tenant: tenants.find(tenant => tenant.id === endpoint.tenant_id)?.nome || endpoint.tenant_id
      })),
      events: webhookEvents.map(event => ({
        ...event,
        tenant: tenants.find(tenant => tenant.id === event.tenant_id)?.nome || event.tenant_id
      }))
    });
  });

  app.get("/api/superadmin/reports/revenue", (req, res) => {
    recordSuperadminAudit(req, "REPORT_REVENUE_VIEW", { resource_type: "report", metadata: { query: req.query } });
    res.json(buildRevenueReport(req.query));
  });

  app.get("/api/superadmin/reports/revenue/export", (req, res) => {
    const report = buildRevenueReport(req.query);
    recordSuperadminAudit(req, "REPORT_REVENUE_EXPORT", { resource_type: "report", metadata: { query: req.query, rows: report.rows.length } });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"revenue-global-${Date.now()}.csv\"`);
    res.send(revenueReportToCsv(report.rows));
  });

  app.get("/api/superadmin/tenants/:tenantId/reports/revenue", (req, res) => {
    if (!activeTenantOr404(req.params.tenantId)) return res.status(404).json({ error: "Tenant nao encontrado" });
    recordSuperadminAudit(req, "TENANT_REVENUE_VIEW", { tenant_id: req.params.tenantId, resource_type: "tenant", resource_id: req.params.tenantId, metadata: { query: req.query } });
    res.json(buildRevenueReport(req.query, req.params.tenantId));
  });

  app.get("/api/superadmin/tenants/:tenantId/reports/revenue/export", (req, res) => {
    if (!activeTenantOr404(req.params.tenantId)) return res.status(404).json({ error: "Tenant nao encontrado" });
    const report = buildRevenueReport(req.query, req.params.tenantId);
    recordSuperadminAudit(req, "TENANT_REVENUE_EXPORT", { tenant_id: req.params.tenantId, resource_type: "tenant", resource_id: req.params.tenantId, metadata: { query: req.query, rows: report.rows.length } });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"revenue-${req.params.tenantId}-${Date.now()}.csv\"`);
    res.send(revenueReportToCsv(report.rows));
  });

  app.get("/api/superadmin/reports", (_req, res) => {
    res.json(reportExports.map(publicReportExport));
  });

  app.post("/api/superadmin/reports/export", (req, res) => {
    const reportType = String(req.body.report_type || req.body.reportType || "financial_global");
    const format = (["pdf", "csv", "xlsx"].includes(String(req.body.format)) ? req.body.format : "pdf") as "pdf" | "csv" | "xlsx";
    const filters = { ...(req.body.filters || {}) };
    const tenantId = String(req.body.tenant_id || req.body.tenantId || "");
    const record = createReportExport(req, { reportType, format, filters, tenantId: tenantId || null, global: !tenantId && reportType === "financial_global" });
    recordSuperadminAudit(req, "OFFICIAL_REPORT_EXPORT", { tenant_id: tenantId || undefined, resource_type: "report_export", resource_id: record.id, metadata: { reportType, format, hash: record.file_hash } });
    recordAuditLedger(req, { tenant_id: tenantId || legacyTenantId, action: "OFFICIAL_REPORT_EXPORTED", resource_type: "report_export", resource_id: record.id, before_data: null, after_data: publicReportExport(record), reason: "Relatorio oficial auditavel exportado por superadmin" });
    res.status(201).json(publicReportExport(record));
  });

  app.get("/api/superadmin/reports/:id/download", (req, res) => {
    const record = reportExports.find(item => item.id === req.params.id);
    if (!record) return res.status(404).json({ error: "Relatorio nao encontrado" });
    sendReportDownload(res, record);
  });

  app.get("/api/superadmin/tenants/:tenantId/financeiro", (req, res) => {
    const tenant = activeTenantOr404(req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    const report = buildRevenueReport(req.query, tenant.id);
    res.json({
      tenant: buildTenantSummary(tenant),
      report,
      gateways: groupSum(report.rows.filter(row => row.status === "paid"), row => row.gateway),
      raffles: groupSum(report.rows.filter(row => row.status === "paid"), row => row.campaign),
      recentOrders: report.rows.slice(0, 25),
      customers: Object.values(customersByPhone).filter(customer => customer.tenant_id === tenant.id).length,
      closedRaffles: raffles.filter(raffle => raffle.tenant_id === tenant.id && raffle.status !== "active").length
    });
  });

  app.get("/api/superadmin/tenants/:tenantId/raffles", (req, res) => {
    const tenant = activeTenantOr404(req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    res.json(raffles.filter(raffle => raffle.tenant_id === tenant.id).map(sanitizeRaffleForAdmin));
  });

  app.get("/api/superadmin/tenants/:tenantId/orders", (req, res) => {
    const tenant = activeTenantOr404(req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    res.json(collectRevenueRows().filter(row => row.tenant_id === tenant.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  app.get("/api/superadmin/tenants/:tenantId/customers", (req, res) => {
    const tenant = activeTenantOr404(req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    res.json(Object.values(customersByPhone).filter(customer => customer.tenant_id === tenant.id).map(stripSensitiveCustomerFields));
  });

  app.post("/api/superadmin/tenants/:tenantId/impersonate/start", (req, res) => {
    const session = getAuthSession(req);
    const tenant = activeTenantOr404(req.params.tenantId);
    const reason = String(req.body.reason || "").trim();
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    if (reason.length < 8) return res.status(400).json({ error: "Informe um motivo com pelo menos 8 caracteres para o acesso assistido." });
    const now = new Date();
    const supportSession: SuperadminImpersonationSession = {
      id: createPublicId("SUP_"),
      superadmin_user_id: session?.sub || "unknown",
      tenant_id: tenant.id,
      reason,
      started_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      ip_address: String(req.ip || req.socket.remoteAddress || ""),
      user_agent: String(req.headers["user-agent"] || ""),
      active: true
    };
    superadminImpersonationSessions.unshift(supportSession);
    recordSuperadminAudit(req, "IMPERSONATION_START", { tenant_id: tenant.id, resource_type: "impersonation_session", resource_id: supportSession.id, metadata: { reason } });
    res.status(201).json({ session: supportSession, redirectUrl: `/admin?supportSession=${supportSession.id}` });
  });

  app.post("/api/superadmin/impersonate/end", (req, res) => {
    const session = getAuthSession(req);
    const supportSessionId = String(req.body.sessionId || req.headers["x-support-session-id"] || "");
    const supportSession = superadminImpersonationSessions.find(item => item.id === supportSessionId && item.superadmin_user_id === session?.sub && item.active);
    if (!supportSession) return res.status(404).json({ error: "Sessao assistida ativa nao encontrada" });
    supportSession.active = false;
    supportSession.ended_at = new Date().toISOString();
    recordSuperadminAudit(req, "IMPERSONATION_END", { tenant_id: supportSession.tenant_id, resource_type: "impersonation_session", resource_id: supportSession.id });
    res.json({ success: true, session: supportSession });
  });

  app.get("/api/superadmin/audit-logs", (req, res) => {
    res.json(superadminAuditLogs);
  });

  app.get("/api/superadmin/audit-ledger", (req, res) => {
    recordSuperadminAudit(req, "GLOBAL_AUDIT_LEDGER_VIEW", { resource_type: "audit_event_ledger" });
    res.json(auditEventLedger.map(event => ({ ...event, tenant: event.tenant_id ? findTenantName(event.tenant_id) : "platform" })));
  });

  app.get("/api/superadmin/compliance", (req, res) => {
    recordSuperadminAudit(req, "GLOBAL_COMPLIANCE_VIEW", { resource_type: "compliance" });
    res.json({
      consents: customerConsents,
      privacyRequests: dataPrivacyRequests,
      ticketAdjustments,
      drawAudits: raffleDrawAudits
    });
  });

  app.get("/api/superadmin/antifraud", (req, res) => {
    recordSuperadminAudit(req, "GLOBAL_ANTIFRAUD_VIEW", { resource_type: "fraud_signals" });
    res.json({
      signals: fraudSignals.map(signal => ({ ...signal, tenant: findTenantName(signal.tenant_id) })),
      scoreEvents: fraudScoreEvents.map(event => ({ ...event, tenant: findTenantName(event.tenant_id) })),
      cases: fraudCases.map(item => ({ ...item, tenant: findTenantName(item.tenant_id) })),
      summary: {
        totalCases: fraudCases.length,
        highRisk: fraudCases.filter(item => item.severity === "high").length,
        manualReview: fraudCases.filter(item => item.status === "manual_review").length
      }
    });
  });

  app.get("/api/superadmin/tenants/:tenantId/plan", (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    recordSuperadminAudit(req, "TENANT_PLAN_VIEW", { tenant_id: tenant.id, resource_type: "tenant", resource_id: tenant.id });
    res.json({ tenant: buildTenantSummary(tenant), plan: getTenantPlan(tenant.id), plans: getSuperadminPlanCatalog() });
  });

  app.put("/api/superadmin/tenants/:tenantId/plan", async (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    const before = deepClone(tenant);
    tenant.plano = getTenantPlan(String(req.body.planId || req.body.plano || tenant.plano)).id;
    if (req.body.status) tenant.status = String(req.body.status) as TenantRecord["status"];
    tenant.atualizado_em = new Date().toISOString();
    try {
      await persistTenantPlanRecord(tenant, "superadmin-tenant-plan-updated");
    } catch (error) {
      Object.assign(tenant, before);
      res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao persistir plano do cliente" });
      return;
    }
    recordSuperadminAudit(req, "TENANT_PLAN_UPDATED", { tenant_id: tenant.id, resource_type: "tenant", resource_id: tenant.id, metadata: { plan: tenant.plano, status: tenant.status } });
    recordAuditLedger(req, { tenant_id: tenant.id, action: "TENANT_PLAN_UPDATED", resource_type: "tenant", resource_id: tenant.id, before_data: before, after_data: tenant, reason: String(req.body.reason || "Alteracao de plano e governanca pelo superadmin") });
    res.json({ tenant: buildTenantSummary(tenant), plan: getTenantPlan(tenant.id) });
  });

  app.get("/api/superadmin/tenants/:tenantId/features", (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    recordSuperadminAudit(req, "TENANT_FEATURES_VIEW", { tenant_id: tenant.id, resource_type: "tenant_features", resource_id: tenant.id });
    res.json({ tenant_id: tenant.id, plan: getTenantPlan(tenant.id).id, features: getTenantFeatures(tenant.id), overrides: tenantFeatureOverrides[tenant.id] || {}, available: allTenantFeatureFlags });
  });

  app.put("/api/superadmin/tenants/:tenantId/features", (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    const before = getTenantFeatures(tenant.id);
    const incoming = (req.body.features || req.body || {}) as Partial<Record<TenantFeatureFlag, boolean>>;
    tenantFeatureOverrides[tenant.id] = Object.fromEntries(
      Object.entries(incoming)
        .filter(([flag]) => allTenantFeatureFlags.includes(flag as TenantFeatureFlag))
        .map(([flag, enabled]) => [flag, Boolean(enabled)])
    ) as Partial<Record<TenantFeatureFlag, boolean>>;
    const after = getTenantFeatures(tenant.id);
    recordSuperadminAudit(req, "TENANT_FEATURES_UPDATED", { tenant_id: tenant.id, resource_type: "tenant_features", resource_id: tenant.id, metadata: { overrides: tenantFeatureOverrides[tenant.id] } });
    recordAuditLedger(req, { tenant_id: tenant.id, action: "TENANT_FEATURES_UPDATED", resource_type: "tenant_features", resource_id: tenant.id, before_data: before, after_data: after, reason: String(req.body.reason || "Alteracao de feature flags pelo superadmin") });
    res.json({ tenant_id: tenant.id, plan: getTenantPlan(tenant.id).id, features: after, overrides: tenantFeatureOverrides[tenant.id] });
  });

  app.get("/api/superadmin/domains", (_req, res) => {
    res.json(tenantDomains.map(domain => ({ ...sanitizeTenantDomain(domain), tenant: findTenantName(domain.tenant_id) })));
  });

  app.post("/api/superadmin/tenants/:tenantId/domains", (req, res) => {
    try {
      const domain = buildDomainRecord(req.params.tenantId, req.body || {});
      tenantDomains.unshift(domain);
      recordSuperadminAudit(req, "TENANT_DOMAIN_CREATED", { tenant_id: domain.tenant_id, resource_type: "tenant_domain", resource_id: domain.id, metadata: { domain: domain.domain } });
      res.status(201).json(sanitizeTenantDomain(domain));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao criar dominio" });
    }
  });

  app.post("/api/superadmin/domains/:id/verify", (req, res) => {
    const domain = tenantDomains.find(item => item.id === req.params.id);
    if (!domain) return res.status(404).json({ error: "Dominio nao encontrado" });
    verifyTenantDomain(domain);
    recordSuperadminAudit(req, "TENANT_DOMAIN_VERIFIED", { tenant_id: domain.tenant_id, resource_type: "tenant_domain", resource_id: domain.id, metadata: { domain: domain.domain } });
    res.json(sanitizeTenantDomain(domain));
  });

  app.put("/api/superadmin/domains/:id/primary", (req, res) => {
    const domain = tenantDomains.find(item => item.id === req.params.id);
    if (!domain) return res.status(404).json({ error: "Dominio nao encontrado" });
    if (domain.status !== "verified") return res.status(409).json({ error: "Verifique o dominio antes de torna-lo principal" });
    setPrimaryTenantDomain(domain);
    recordSuperadminAudit(req, "TENANT_DOMAIN_PRIMARY", { tenant_id: domain.tenant_id, resource_type: "tenant_domain", resource_id: domain.id, metadata: { domain: domain.domain } });
    res.json(sanitizeTenantDomain(domain));
  });

  app.delete("/api/superadmin/domains/:id", (req, res) => {
    const domain = tenantDomains.find(item => item.id === req.params.id);
    if (!domain) return res.status(404).json({ error: "Dominio nao encontrado" });
    tenantDomains = tenantDomains.filter(item => item.id !== domain.id);
    recordSuperadminAudit(req, "TENANT_DOMAIN_DELETED", { tenant_id: domain.tenant_id, resource_type: "tenant_domain", resource_id: domain.id, metadata: { domain: domain.domain } });
    res.json({ success: true });
  });

  app.get("/api/superadmin/branding", (req, res) => {
    recordSuperadminAudit(req, "GLOBAL_BRANDING_VIEW", { tenant_id: legacyTenantId, resource_type: "tenant_branding_settings", resource_id: legacyTenantId });
    res.json(getTenantBranding(legacyTenantId));
  });

  app.put("/api/superadmin/branding", (req, res) => {
    const branding = normalizeTenantBranding(legacyTenantId, req.body || {});
    const tenant = tenants.find(item => item.id === legacyTenantId);
    if (tenant) {
      tenant.logo_url = branding.logo_url;
      tenant.cor_primaria = branding.primary_color;
    }
    recordSuperadminAudit(req, "GLOBAL_BRANDING_UPDATED", { tenant_id: legacyTenantId, resource_type: "tenant_branding_settings", resource_id: branding.id });
    res.json(branding);
  });

  app.post("/api/superadmin/branding/logo", express.raw({ type: "*/*", limit: "5mb" }), async (req, res) => {
    try {
      const asset = await saveBrandingAsset(req, legacyTenantId, "logo");
      const current = getTenantBranding(legacyTenantId);
      const branding = normalizeTenantBranding(legacyTenantId, { logo_url: asset.url, login_logo_url: current.login_logo_url || asset.url, logo_mime_type: asset.mimeType, metadata: { ...current.metadata, logoAsset: asset } });
      const tenant = tenants.find(item => item.id === legacyTenantId);
      if (tenant) tenant.logo_url = branding.logo_url;
      recordSuperadminAudit(req, "GLOBAL_BRANDING_LOGO_UPLOADED", { tenant_id: legacyTenantId, resource_type: "tenant_branding_settings", resource_id: branding.id, metadata: { mimeType: asset.mimeType, size: asset.size } });
      res.status(201).json({ branding, asset });
    } catch (error) {
      res.status((error as Error & { statusCode?: number }).statusCode || 400).json({ error: error instanceof Error ? error.message : "Erro ao enviar logo" });
    }
  });

  app.post("/api/superadmin/branding/favicon", express.raw({ type: "*/*", limit: "5mb" }), async (req, res) => {
    try {
      const asset = await saveBrandingAsset(req, legacyTenantId, "favicon");
      const branding = normalizeTenantBranding(legacyTenantId, { favicon_url: asset.url, metadata: { ...getTenantBranding(legacyTenantId).metadata, faviconAsset: asset } });
      recordSuperadminAudit(req, "GLOBAL_BRANDING_FAVICON_UPLOADED", { tenant_id: legacyTenantId, resource_type: "tenant_branding_settings", resource_id: branding.id, metadata: { mimeType: asset.mimeType, size: asset.size } });
      res.status(201).json({ branding, asset });
    } catch (error) {
      res.status((error as Error & { statusCode?: number }).statusCode || 400).json({ error: error instanceof Error ? error.message : "Erro ao enviar favicon" });
    }
  });

  app.post("/api/superadmin/branding/reset", (req, res) => {
    tenantBrandingSettings[legacyTenantId] = defaultTenantBranding(legacyTenantId);
    recordSuperadminAudit(req, "GLOBAL_BRANDING_RESET", { tenant_id: legacyTenantId, resource_type: "tenant_branding_settings", resource_id: tenantBrandingSettings[legacyTenantId].id });
    res.json(tenantBrandingSettings[legacyTenantId]);
  });

  app.get("/api/superadmin/tenants/:tenantId/branding", (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    recordSuperadminAudit(req, "TENANT_BRANDING_VIEW", { tenant_id: tenant.id, resource_type: "tenant_branding_settings", resource_id: tenant.id });
    res.json(getTenantBranding(tenant.id));
  });

  app.put("/api/superadmin/tenants/:tenantId/branding", (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    const branding = normalizeTenantBranding(tenant.id, req.body || {});
    tenant.logo_url = branding.logo_url;
    tenant.cor_primaria = branding.primary_color;
    recordSuperadminAudit(req, "TENANT_BRANDING_UPDATED", { tenant_id: tenant.id, resource_type: "tenant_branding_settings", resource_id: branding.id });
    res.json(branding);
  });

  app.post("/api/superadmin/tenants/:tenantId/branding/logo", express.raw({ type: "*/*", limit: "5mb" }), async (req, res) => {
    try {
      const tenant = tenants.find(item => item.id === req.params.tenantId);
      if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
      const asset = await saveBrandingAsset(req, tenant.id, "logo");
      const current = getTenantBranding(tenant.id);
      const branding = normalizeTenantBranding(tenant.id, { logo_url: asset.url, login_logo_url: current.login_logo_url || asset.url, logo_mime_type: asset.mimeType, metadata: { ...current.metadata, logoAsset: asset } });
      tenant.logo_url = branding.logo_url;
      recordSuperadminAudit(req, "TENANT_BRANDING_LOGO_UPLOADED", { tenant_id: tenant.id, resource_type: "tenant_branding_settings", resource_id: branding.id, metadata: { mimeType: asset.mimeType, size: asset.size } });
      res.status(201).json({ branding, asset });
    } catch (error) {
      res.status((error as Error & { statusCode?: number }).statusCode || 400).json({ error: error instanceof Error ? error.message : "Erro ao enviar logo" });
    }
  });

  app.post("/api/superadmin/tenants/:tenantId/branding/favicon", express.raw({ type: "*/*", limit: "5mb" }), async (req, res) => {
    try {
      const tenant = tenants.find(item => item.id === req.params.tenantId);
      if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
      const asset = await saveBrandingAsset(req, tenant.id, "favicon");
      const branding = normalizeTenantBranding(tenant.id, { favicon_url: asset.url, metadata: { ...getTenantBranding(tenant.id).metadata, faviconAsset: asset } });
      recordSuperadminAudit(req, "TENANT_BRANDING_FAVICON_UPLOADED", { tenant_id: tenant.id, resource_type: "tenant_branding_settings", resource_id: branding.id, metadata: { mimeType: asset.mimeType, size: asset.size } });
      res.status(201).json({ branding, asset });
    } catch (error) {
      res.status((error as Error & { statusCode?: number }).statusCode || 400).json({ error: error instanceof Error ? error.message : "Erro ao enviar favicon" });
    }
  });

  app.post("/api/superadmin/tenants/:tenantId/branding/reset", (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    tenantBrandingSettings[tenant.id] = defaultTenantBranding(tenant.id);
    recordSuperadminAudit(req, "TENANT_BRANDING_RESET", { tenant_id: tenant.id, resource_type: "tenant_branding_settings", resource_id: tenantBrandingSettings[tenant.id].id });
    res.json(tenantBrandingSettings[tenant.id]);
  });

  app.get("/api/superadmin/tenants/:tenantId/fazendinha/home-media", (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    res.json(publicFazendinhaHomeMedia(tenant.id));
  });

  app.put("/api/superadmin/tenants/:tenantId/fazendinha/home-media", (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    fazendinhaHomeMediaSettings[tenant.id] = normalizeFazendinhaHomeMedia(tenant.id, req.body || {});
    recordSuperadminAudit(req, "FAZENDINHA_HOME_MEDIA_UPDATED", { tenant_id: tenant.id, resource_type: "fazendinha_home_media", resource_id: tenant.id });
    res.json(publicFazendinhaHomeMedia(tenant.id));
  });

  app.get("/api/superadmin/tenants/:tenantId/fazendinha/media-settings", (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    res.json(publicFazendinhaMediaSettings(tenant.id));
  });

  app.put("/api/superadmin/tenants/:tenantId/fazendinha/media-settings", (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    const mediaSettings = normalizeFazendinhaMediaSettings(tenant.id, req.body || {});
    recordSuperadminAudit(req, "FAZENDINHA_MEDIA_SETTINGS_UPDATED", { tenant_id: tenant.id, resource_type: "fazendinha_media_settings", resource_id: tenant.id });
    res.json(mediaSettings);
  });

  app.get("/api/superadmin/theme-templates", (_req, res) => {
    res.json({ marketplace: themeMarketplacePresets, templates: tenantThemeTemplates });
  });

  app.post("/api/superadmin/theme-templates", (req, res) => {
    const tenantId = String(req.body.tenant_id || "global");
    const template = saveTenantThemeTemplate(tenantId, { ...req.body, active: req.body.active !== false });
    recordSuperadminAudit(req, "GLOBAL_THEME_TEMPLATE_CREATED", { tenant_id: tenantId === "global" ? undefined : tenantId, resource_type: "tenant_theme_template", resource_id: template.id });
    res.status(201).json(template);
  });

  app.post("/api/superadmin/theme-templates/:themeId/apply/:tenantId", (req, res) => {
    const source = tenantThemeTemplates.find(item => item.id === req.params.themeId) || tenantThemeTemplates.find(item => item.theme_key === req.params.themeId) || defaultThemeTemplate(req.params.tenantId, req.params.themeId);
    const template = saveTenantThemeTemplate(req.params.tenantId, { ...source, id: createPublicId("THEME_"), active: true });
    recordSuperadminAudit(req, "GLOBAL_THEME_TEMPLATE_APPLIED", { tenant_id: req.params.tenantId, resource_type: "tenant_theme_template", resource_id: template.id });
    res.json(template);
  });

  app.post("/api/superadmin/theme-templates/:themeId/duplicate", (req, res) => {
    const source = tenantThemeTemplates.find(item => item.id === req.params.themeId);
    if (!source) return res.status(404).json({ error: "Tema nao encontrado" });
    const tenantId = String(req.body.tenant_id || source.tenant_id);
    const template = saveTenantThemeTemplate(tenantId, { ...source, id: createPublicId("THEME_"), name: `${source.name} copia`, active: false });
    recordSuperadminAudit(req, "GLOBAL_THEME_TEMPLATE_DUPLICATED", { tenant_id: tenantId === "global" ? undefined : tenantId, resource_type: "tenant_theme_template", resource_id: template.id });
    res.status(201).json(template);
  });

  app.use("/api/v1", apiKeyRateLimiter, requireTenantApiKey);

  app.get("/api/v1/raffles", requireTenantApiScope("raffles:read"), (req, res) => {
    const auth = getApiKeyAuth(req)!;
    recordSecurityEvent({ tenant_id: auth.tenantId, action: "PUBLIC_API_RAFFLES_LIST", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", detail: auth.prefix });
    res.json(raffles.filter(item => item.tenant_id === auth.tenantId).map(sanitizeRaffleForPublic));
  });

  app.get("/api/v1/raffles/:id", requireTenantApiScope("raffles:read"), (req, res) => {
    const auth = getApiKeyAuth(req)!;
    const raffle = raffles.find(item => item.tenant_id === auth.tenantId && item.id === req.params.id);
    if (!raffle) return res.status(404).json({ error: "Rifa nao encontrada" });
    recordSecurityEvent({ tenant_id: auth.tenantId, action: "PUBLIC_API_RAFFLE_VIEW", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", detail: `${auth.prefix}:${raffle.id}` });
    res.json(sanitizeRaffleForPublic(raffle));
  });

  app.get("/api/v1/orders", requireTenantApiScope("orders:read"), (req, res) => {
    const auth = getApiKeyAuth(req)!;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));
    const rows = purchases
      .filter(item => item.tenant_id === auth.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(order => stripSensitiveCustomerFields(order));
    recordSecurityEvent({ tenant_id: auth.tenantId, action: "PUBLIC_API_ORDERS_LIST", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", detail: auth.prefix });
    res.json(rows);
  });

  app.get("/api/v1/customers", requireTenantApiScope("customers:read"), (req, res) => {
    const auth = getApiKeyAuth(req)!;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));
    const rows = Object.values(customersByPhone)
      .filter(customer => customer.tenant_id === auth.tenantId)
      .slice(0, limit)
      .map(customer => ({
        id: customer.id,
        name: customer.name,
        phone: maskPhone(customer.phone),
        cpf_masked: maskCpfForCrm(customer.cpf),
        city: customer.city || "",
        state: customer.state || "",
        totalTickets: customer.totalTickets,
        affiliateRefCode: customer.affiliateRefCode,
        blocked: Boolean(customer.blocked),
        createdAt: customer.createdAt
      }));
    recordSecurityEvent({ tenant_id: auth.tenantId, action: "PUBLIC_API_CUSTOMERS_LIST", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", detail: auth.prefix });
    res.json(rows);
  });

  app.get("/api/v1/reports/revenue", requireTenantApiScope("reports:read"), (req, res) => {
    const auth = getApiKeyAuth(req)!;
    const report = buildRevenueReport(req.query, auth.tenantId);
    recordSecurityEvent({ tenant_id: auth.tenantId, action: "PUBLIC_API_REVENUE_REPORT", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", detail: auth.prefix });
    res.json(report);
  });

  app.use(resolveTenant);

  app.use("/api/admin/whatsapp-center", rateLimiter, requireWhatsAppCenterAccess);

  app.get("/api/admin/whatsapp-center/dashboard", requireWhatsAppCrmCampaignAccess, (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    res.json(buildWhatsAppCenterDashboard(tenantId));
  });

  app.get("/api/admin/whatsapp-center/conversations", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const status = String(req.query.status || "");
    const q = String(req.query.q || "").trim().toLowerCase();
    const unreadOnly = String(req.query.unread || "") === "true" || status === "unread";
    const rows = whatsappConversations
      .filter(conversation => conversation.tenantId === tenantId)
      .filter(conversation => !status || status === "unread" || conversation.status === status)
      .filter(conversation => !unreadOnly || conversation.unreadCount > 0)
      .filter(conversation => {
        if (!q) return true;
        const contact = whatsappContacts.find(item => item.id === conversation.contactId);
        return [conversation.phone, contact?.displayName || "", contact?.phone || ""].some(value => String(value).toLowerCase().includes(q));
      })
      .sort((a, b) => new Date(b.lastMessageAt || b.updatedAt).getTime() - new Date(a.lastMessageAt || a.updatedAt).getTime())
      .map(publicWhatsAppConversation);
    res.json({ conversations: rows });
  });

  app.get("/api/admin/whatsapp-center/conversations/:id", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const conversation = whatsappConversations.find(item => item.id === req.params.id && item.tenantId === tenantId);
    if (!conversation) return res.status(404).json({ error: "Conversa nao encontrada" });
    conversation.unreadCount = 0;
    conversation.updatedAt = new Date().toISOString();
    schedulePersistentStateSave("whatsapp-center-read");
    const messages = whatsappConversationMessages
      .filter(message => message.tenantId === tenantId && message.conversationId === conversation.id)
      .sort((a, b) => new Date(a.receivedAt || a.sentAt || "").getTime() - new Date(b.receivedAt || b.sentAt || "").getTime())
      .map(publicWhatsAppMessage);
    const contact = whatsappContacts.find(item => item.id === conversation.contactId);
    res.json({ conversation: publicWhatsAppConversation(conversation), contact: contact ? publicWhatsAppContact(contact) : null, messages });
  });

  app.put("/api/admin/whatsapp-center/conversations/:id/status", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const status = String(req.body.status || "") as WhatsAppConversationStatus;
    if (!["open", "pending", "resolved", "waiting_customer"].includes(status)) return res.status(400).json({ error: "Status invalido" });
    const conversation = whatsappConversations.find(item => item.id === req.params.id && item.tenantId === tenantId);
    if (!conversation) return res.status(404).json({ error: "Conversa nao encontrada" });
    conversation.status = status;
    conversation.updatedAt = new Date().toISOString();
    schedulePersistentStateSave("whatsapp-center-status");
    res.json({ conversation: publicWhatsAppConversation(conversation) });
  });

  app.put("/api/admin/whatsapp-center/conversations/:id/assign", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const conversation = whatsappConversations.find(item => item.id === req.params.id && item.tenantId === tenantId);
    if (!conversation) return res.status(404).json({ error: "Conversa nao encontrada" });
    conversation.assignedUserId = String(req.body.assignedUserId || "").trim().slice(0, 120) || undefined;
    conversation.updatedAt = new Date().toISOString();
    schedulePersistentStateSave("whatsapp-center-assign");
    res.json({ conversation: publicWhatsAppConversation(conversation) });
  });

  app.post("/api/admin/whatsapp-center/conversations/:id/notes", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const conversation = whatsappConversations.find(item => item.id === req.params.id && item.tenantId === tenantId);
    if (!conversation) return res.status(404).json({ error: "Conversa nao encontrada" });
    const body = String(req.body.body || "").trim().slice(0, 4000);
    if (!body) return res.status(400).json({ error: "Nota vazia" });
    const now = new Date().toISOString();
    const message: WhatsAppConversationMessageRecord = {
      id: createPublicId("WAM_"),
      tenantId,
      conversationId: conversation.id,
      direction: "internal_note",
      type: "text",
      body,
      status: "internal",
      receivedAt: now,
      rawSummary: { source: "admin_note", actor: getAuthSession(req)?.sub || "admin" }
    };
    whatsappConversationMessages.push(message);
    conversation.lastMessageAt = now;
    conversation.updatedAt = now;
    schedulePersistentStateSave("whatsapp-center-note");
    res.status(201).json({ message: publicWhatsAppMessage(message), conversation: publicWhatsAppConversation(conversation) });
  });

  app.post("/api/admin/whatsapp-center/conversations/:id/messages", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const conversation = whatsappConversations.find(item => item.id === req.params.id && item.tenantId === tenantId);
    if (!conversation) return res.status(404).json({ error: "Conversa nao encontrada" });
    const contact = whatsappContacts.find(item => item.id === conversation.contactId && item.tenantId === tenantId);
    if (!contact) return res.status(404).json({ error: "Contato nao encontrado" });
    if (Array.isArray(req.body?.body) || Array.isArray(req.body?.to) || Array.isArray(req.body?.recipients) || Array.isArray(req.body?.phones)) {
      return res.status(400).json({ error: "Envio em massa nao permitido" });
    }
    if (contact.optOut) return res.status(409).json({ error: "Contato em opt-out. Envio bloqueado." });
    const expiresAt = conversation.serviceWindowExpiresAt ? new Date(conversation.serviceWindowExpiresAt).getTime() : 0;
    if (!expiresAt || Date.now() > expiresAt) {
      return res.status(409).json({ error: "A janela de atendimento expirou. Utilize um template aprovado." });
    }
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Mensagem vazia" });
    if (body.length > 4000) return res.status(400).json({ error: "Mensagem excede o limite de 4000 caracteres" });
    if (/[^\S\r\n]*(?:,|;)[^\S\r\n]*55?\d{10,}/.test(body)) return res.status(400).json({ error: "Envio para multiplos destinatarios nao permitido" });

    const now = new Date().toISOString();
    const message: WhatsAppConversationMessageRecord = {
      id: createPublicId("WAM_"),
      tenantId,
      conversationId: conversation.id,
      direction: "outbound",
      type: "text",
      body,
      status: "queued",
      sentAt: now,
      rawSummary: { source: "admin_manual_reply", actor: getAuthSession(req)?.sub || "admin", to: maskPhone(contact.phone) }
    };
    whatsappConversationMessages.push(message);
    let metaAccessToken = "";
    try {
      const config = decryptWhatsAppCloudConfig(getWhatsAppCloudConfig(tenantId));
      metaAccessToken = config?.access_token || "";
      const result = await sendMetaCloudWhatsAppMessage({
        tenantId,
        messageId: message.id,
        to: contact.phone,
        body
      }, config || { enabled: false, environment: "sandbox" });
      const sentAt = new Date().toISOString();
      message.status = "sent";
      message.metaMessageId = result.providerMessageId || "";
      message.sentAt = sentAt;
      message.rawSummary = { ...message.rawSummary, metaMessageId: message.metaMessageId ? "present" : "missing" };
      contact.lastOutboundAt = sentAt;
      contact.updatedAt = sentAt;
      conversation.lastMessageAt = sentAt;
      conversation.updatedAt = sentAt;
      whatsappContacts = whatsappContacts.map(item => item.id === contact.id ? contact : item);
      whatsappConversations = whatsappConversations.map(item => item.id === conversation.id ? conversation : item);
      recordWhatsAppCloudLog(tenantId, {
        action: "manual_reply_sent",
        status: "success",
        message: "Resposta manual enviada",
        metadata: { conversationId: conversation.id, messageId: message.id, to: maskPhone(contact.phone), adminId: getAuthSession(req)?.sub || "", metaMessageId: message.metaMessageId || "" }
      });
      schedulePersistentStateSave("whatsapp-center-manual-reply");
      res.status(201).json({ message: publicWhatsAppMessage(message), conversation: publicWhatsAppConversation(conversation) });
    } catch (error) {
      const failedAt = new Date().toISOString();
      const rawErrorMessage = error instanceof Error ? error.message : "Falha ao enviar resposta manual";
      const safeErrorMessage = maskSecretText(metaAccessToken ? rawErrorMessage.split(metaAccessToken).join("[masked]") : rawErrorMessage);
      message.status = "failed";
      message.rawSummary = { ...message.rawSummary, error: safeErrorMessage.slice(0, 300) };
      conversation.updatedAt = failedAt;
      whatsappConversations = whatsappConversations.map(item => item.id === conversation.id ? conversation : item);
      recordWhatsAppCloudLog(tenantId, {
        action: "manual_reply_failed",
        status: "error",
        message: safeErrorMessage,
        metadata: { conversationId: conversation.id, messageId: message.id, to: maskPhone(contact.phone), adminId: getAuthSession(req)?.sub || "" }
      });
      schedulePersistentStateSave("whatsapp-center-manual-reply-failed");
      res.status(502).json({ error: safeErrorMessage, message: publicWhatsAppMessage(message) });
    }
  });

  app.get("/api/admin/whatsapp-center/templates", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const templates = getSavedWhatsAppCloudTemplates(tenantId)
      .filter(template => String(template.status || "").toUpperCase() === "APPROVED")
      .map(template => ({ ...sanitizeWhatsAppCloudTemplate(template), buttons: getTemplateButtons(template) }));
    res.json({ templates });
  });

  app.post("/api/admin/whatsapp-center/conversations/:id/template", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const conversation = whatsappConversations.find(item => item.id === req.params.id && item.tenantId === tenantId);
    if (!conversation) return res.status(404).json({ error: "Conversa nao encontrada" });
    const contact = whatsappContacts.find(item => item.id === conversation.contactId && item.tenantId === tenantId);
    if (!contact) return res.status(404).json({ error: "Contato nao encontrado" });
    if (Array.isArray(req.body?.to) || Array.isArray(req.body?.recipients) || Array.isArray(req.body?.phones) || Array.isArray(req.body?.conversationIds)) {
      return res.status(400).json({ error: "Envio em massa nao permitido" });
    }
    if (contact.optOut) return res.status(409).json({ error: "Contato em opt-out. Envio bloqueado." });
    const templateName = String(req.body?.templateName || "").trim();
    const language = String(req.body?.language || "pt_BR").trim() || "pt_BR";
    if (!templateName) return res.status(400).json({ error: "Template obrigatorio" });
    const template = getSavedWhatsAppCloudTemplates(tenantId).find(item => item.name === templateName && item.language === language);
    if (!template) return res.status(404).json({ error: "Template nao encontrado" });
    if (String(template.status || "").toUpperCase() !== "APPROVED") return res.status(409).json({ error: "Template ainda nao esta aprovado para envio" });
    if (req.body?.components !== undefined && !Array.isArray(req.body.components)) {
      return res.status(400).json({ error: "Componentes invalidos" });
    }
    const components = Array.isArray(req.body?.components) ? req.body.components : [];
    try {
      validateWhatsAppTemplateComponents(template, components);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Componentes invalidos" });
    }

    const now = new Date().toISOString();
    const message: WhatsAppConversationMessageRecord = {
      id: createPublicId("WAM_"),
      tenantId,
      conversationId: conversation.id,
      direction: "outbound",
      type: "template",
      body: templateName,
      status: "queued",
      sentAt: now,
      rawSummary: {
        source: "admin_template_reply",
        actor: getAuthSession(req)?.sub || "admin",
        to: maskPhone(contact.phone),
        templateName,
        language,
        components: sanitizeTemplateComponentsForLog(components),
        buttons: getTemplateButtons(template)
      }
    };
    whatsappConversationMessages.push(message);
    let metaAccessToken = "";
    try {
      const config = decryptWhatsAppCloudConfig(getWhatsAppCloudConfig(tenantId));
      metaAccessToken = config?.access_token || "";
      const result = await createMetaWhatsAppCloudProvider(tenantId).sendTemplate({
        to: contact.phone,
        templateName,
        language,
        components,
        availableTemplates: [template]
      });
      const sentAt = new Date().toISOString();
      message.status = "sent";
      message.metaMessageId = result.data?.messages?.[0]?.id || "";
      message.sentAt = sentAt;
      message.rawSummary = { ...message.rawSummary, metaMessageId: message.metaMessageId ? "present" : "missing" };
      contact.lastOutboundAt = sentAt;
      contact.updatedAt = sentAt;
      conversation.lastMessageAt = sentAt;
      conversation.updatedAt = sentAt;
      whatsappContacts = whatsappContacts.map(item => item.id === contact.id ? contact : item);
      whatsappConversations = whatsappConversations.map(item => item.id === conversation.id ? conversation : item);
      recordWhatsAppCloudLog(tenantId, {
        action: "manual_template_sent",
        status: "success",
        message: "Template enviado pela Central WhatsApp",
        metadata: { conversationId: conversation.id, messageId: message.id, to: maskPhone(contact.phone), templateName, language, adminId: getAuthSession(req)?.sub || "", metaMessageId: message.metaMessageId || "" }
      });
      schedulePersistentStateSave("whatsapp-center-template-reply");
      res.status(201).json({ message: publicWhatsAppMessage(message), conversation: publicWhatsAppConversation(conversation) });
    } catch (error) {
      const failedAt = new Date().toISOString();
      const rawErrorMessage = error instanceof Error ? error.message : "Falha ao enviar template";
      const safeErrorMessage = maskSecretText(metaAccessToken ? rawErrorMessage.split(metaAccessToken).join("[masked]") : rawErrorMessage);
      message.status = "failed";
      message.rawSummary = { ...message.rawSummary, error: safeErrorMessage.slice(0, 300) };
      conversation.updatedAt = failedAt;
      whatsappConversations = whatsappConversations.map(item => item.id === conversation.id ? conversation : item);
      recordWhatsAppCloudLog(tenantId, {
        action: "manual_template_failed",
        status: "error",
        message: safeErrorMessage,
        metadata: { conversationId: conversation.id, messageId: message.id, to: maskPhone(contact.phone), templateName, language, adminId: getAuthSession(req)?.sub || "" }
      });
      schedulePersistentStateSave("whatsapp-center-template-reply-failed");
      res.status(502).json({ error: safeErrorMessage, message: publicWhatsAppMessage(message) });
    }
  });

  app.get("/api/admin/whatsapp-center/campaigns", requireWhatsAppCrmCampaignAccess, (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    res.json({ campaigns: whatsappCrmCampaigns.filter(item => item.tenant_id === tenantId).map(sanitizeWhatsAppCrmCampaign) });
  });

  app.post("/api/admin/whatsapp-center/campaigns", requireWhatsAppCrmCampaignAccess, (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (Array.isArray(req.body?.to) || Array.isArray(req.body?.recipients) || Array.isArray(req.body?.phones) || Array.isArray(req.body?.contacts)) {
      return res.status(400).json({ error: "Lista manual nao permitida nesta fase" });
    }
    const segment = String(req.body?.segment || "");
    if (!isWhatsAppCrmCampaignSegment(segment)) return res.status(400).json({ error: "Segmento CRM invalido" });
    const templateName = String(req.body?.templateName || req.body?.template_name || "").trim();
    const language = String(req.body?.language || "pt_BR").trim() || "pt_BR";
    if (!templateName) return res.status(400).json({ error: "Template obrigatorio" });
    const template = getApprovedWhatsAppTemplate(tenantId, templateName, language);
    if (!template) return res.status(409).json({ error: "Template aprovado nao encontrado" });
    if (req.body?.body || req.body?.message || req.body?.text) return res.status(400).json({ error: "Texto livre nao permitido em campanhas" });
    if (req.body?.components !== undefined && !Array.isArray(req.body.components)) return res.status(400).json({ error: "Componentes invalidos" });
    const components = Array.isArray(req.body?.components) ? req.body.components : [];
    try {
      validateWhatsAppTemplateComponents(template, components);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Componentes invalidos" });
    }
    const now = new Date().toISOString();
    const campaign: WhatsAppCrmCampaignRecord = {
      id: createPublicId("WAC_"),
      tenant_id: tenantId,
      name: String(req.body?.name || `Campanha ${segment}`).trim().slice(0, 120) || `Campanha ${segment}`,
      segment,
      template_name: templateName,
      language,
      components,
      status: "draft",
      predicted_recipients: 0,
      queued_count: 0,
      sent_count: 0,
      failed_count: 0,
      skipped_count: 0,
      daily_tenant_limit: Math.min(1000, Math.max(1, Math.floor(Number(req.body?.dailyTenantLimit ?? req.body?.daily_tenant_limit ?? 100)))),
      cooldown_hours: Math.min(720, Math.max(1, Math.floor(Number(req.body?.cooldownHours ?? req.body?.cooldown_hours ?? 24)))),
      created_by: getAuthSession(req)?.sub || "admin",
      created_at: now,
      updated_at: now
    };
    whatsappCrmCampaigns.unshift(campaign);
    recordWhatsAppCloudLog(tenantId, { action: "crm_campaign_created", status: "success", message: "Campanha CRM criada", metadata: { campaignId: campaign.id, segment, templateName, adminId: campaign.created_by } });
    schedulePersistentStateSave("whatsapp-crm-campaign-created");
    res.status(201).json({ campaign: sanitizeWhatsAppCrmCampaign(campaign) });
  });

  app.get("/api/admin/whatsapp-center/campaigns/queue", requireWhatsAppCrmCampaignAccess, (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    res.json({ queue: getWhatsAppCrmCampaignQueue(tenantId).slice(0, 300).map(sanitizeWhatsAppQueueRecord) });
  });

  app.get("/api/admin/whatsapp-center/campaigns/logs", requireWhatsAppCrmCampaignAccess, (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    res.json({ logs: getWhatsAppCrmCampaignLogs(tenantId, String(req.query.campaignId || "")) });
  });

  app.get("/api/admin/whatsapp-center/campaigns/:id", requireWhatsAppCrmCampaignAccess, (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const campaign = whatsappCrmCampaigns.find(item => item.id === req.params.id && item.tenant_id === tenantId);
    if (!campaign) return res.status(404).json({ error: "Campanha nao encontrada" });
    res.json({ campaign: sanitizeWhatsAppCrmCampaign(campaign), queue: getWhatsAppCrmCampaignQueue(tenantId, campaign.id).map(sanitizeWhatsAppQueueRecord), logs: getWhatsAppCrmCampaignLogs(tenantId, campaign.id) });
  });

  app.post("/api/admin/whatsapp-center/campaigns/:id/preview", requireWhatsAppCrmCampaignAccess, (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const campaign = whatsappCrmCampaigns.find(item => item.id === req.params.id && item.tenant_id === tenantId);
    if (!campaign) return res.status(404).json({ error: "Campanha nao encontrada" });
    const recipients = buildWhatsAppCrmCampaignRecipients(req, campaign);
    campaign.predicted_recipients = recipients.length;
    campaign.status = campaign.status === "draft" ? "ready" : campaign.status;
    campaign.updated_at = new Date().toISOString();
    recordWhatsAppCloudLog(tenantId, { action: "crm_campaign_preview", status: "success", message: "Preview de campanha CRM gerado", metadata: { campaignId: campaign.id, segment: campaign.segment, recipients: recipients.length, previewOnly: true } });
    schedulePersistentStateSave("whatsapp-crm-campaign-preview");
    res.json({ campaign: sanitizeWhatsAppCrmCampaign(campaign), recipients: recipients.slice(0, 100).map(item => ({ ...item, phone: maskPhone(item.phone) })), total: recipients.length });
  });

  app.post("/api/admin/whatsapp-center/campaigns/:id/enqueue", requireWhatsAppCrmCampaignAccess, (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const campaign = whatsappCrmCampaigns.find(item => item.id === req.params.id && item.tenant_id === tenantId);
    if (!campaign) return res.status(404).json({ error: "Campanha nao encontrada" });
    if (campaign.status === "cancelled") return res.status(409).json({ error: "Campanha cancelada" });
    const template = getApprovedWhatsAppTemplate(tenantId, campaign.template_name, campaign.language);
    if (!template) return res.status(409).json({ error: "Template aprovado nao encontrado" });
    const recipients = buildWhatsAppCrmCampaignRecipients(req, campaign);
    const now = new Date().toISOString();
    let queued = 0;
    let skipped = 0;
    for (const recipient of recipients) {
      const idempotencyKey = `whatsapp-crm-campaign:${tenantId}:${campaign.id}:${recipient.phone}:${campaign.template_name}`;
      if (whatsappMessageQueue.some(item => item.idempotency_key === idempotencyKey)) {
        skipped += 1;
        continue;
      }
      if (queued >= campaign.daily_tenant_limit || countWhatsAppCrmCampaignSentToday(tenantId) + queued >= campaign.daily_tenant_limit) {
        skipped += 1;
        continue;
      }
      if (hasRecentWhatsAppCrmCampaignForPhone(tenantId, recipient.phone, campaign.cooldown_hours)) {
        skipped += 1;
        continue;
      }
      whatsappMessageQueue.unshift({
        id: createPublicId("WAPP_"),
        tenant_id: tenantId,
        customer_id: recipient.customerId,
        phone: recipient.phone,
        message_type: "whatsapp_crm_campaign",
        message_body: "",
        provider: "meta_cloud",
        status: "queued",
        attempts: 0,
        max_attempts: 3,
        last_error: "",
        reason: "",
        template_name: campaign.template_name,
        language: campaign.language,
        event_type: "crm_campaign",
        payload: { campaignId: campaign.id, campaignName: campaign.name, segment: campaign.segment, customerName: recipient.name, statusComercial: recipient.statusComercial, components: campaign.components },
        created_at: now,
        updated_at: now,
        idempotency_key: idempotencyKey
      });
      queued += 1;
    }
    whatsappMessageQueue = whatsappMessageQueue.slice(0, 5000);
    campaign.predicted_recipients = recipients.length;
    campaign.queued_count = getWhatsAppCrmCampaignQueue(tenantId, campaign.id).filter(item => item.status === "queued").length;
    campaign.skipped_count += skipped;
    campaign.status = "queued";
    campaign.updated_at = now;
    recordWhatsAppCloudLog(tenantId, { action: "crm_campaign_enqueued", status: "success", message: "Campanha CRM enfileirada", metadata: { campaignId: campaign.id, segment: campaign.segment, queued, skipped, templateName: campaign.template_name } });
    schedulePersistentStateSave("whatsapp-crm-campaign-enqueue");
    res.json({ campaign: sanitizeWhatsAppCrmCampaign(campaign), queued, skipped, queue: getWhatsAppCrmCampaignQueue(tenantId, campaign.id).map(sanitizeWhatsAppQueueRecord) });
  });

  app.post("/api/admin/whatsapp-center/campaigns/:id/cancel", requireWhatsAppCrmCampaignAccess, (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const campaign = whatsappCrmCampaigns.find(item => item.id === req.params.id && item.tenant_id === tenantId);
    if (!campaign) return res.status(404).json({ error: "Campanha nao encontrada" });
    const now = new Date().toISOString();
    campaign.status = "cancelled";
    campaign.cancelled_at = now;
    campaign.updated_at = now;
    getWhatsAppCrmCampaignQueue(tenantId, campaign.id).filter(item => item.status === "queued").forEach(item => {
      item.status = "skipped";
      item.reason = "Campanha cancelada antes do envio";
      item.updated_at = now;
    });
    recordWhatsAppCloudLog(tenantId, { action: "crm_campaign_cancelled", status: "success", message: "Campanha CRM cancelada", metadata: { campaignId: campaign.id, adminId: getAuthSession(req)?.sub || "" } });
    schedulePersistentStateSave("whatsapp-crm-campaign-cancel");
    res.json({ campaign: sanitizeWhatsAppCrmCampaign(campaign) });
  });

  app.post("/api/admin/whatsapp-center/campaigns/queue/run", requireWhatsAppCrmCampaignAccess, async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const limit = Math.min(100, Math.max(1, Math.floor(Number(req.body?.limit || 20))));
    const provider = createMetaWhatsAppCloudProvider(tenantId);
    const templates = getSavedWhatsAppCloudTemplates(tenantId);
    const ready = getWhatsAppCrmCampaignQueue(tenantId).filter(item => item.status === "queued" && item.attempts < item.max_attempts).slice(0, limit);
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const message of ready) {
      const campaignId = String(message.payload?.campaignId || "");
      const campaign = whatsappCrmCampaigns.find(item => item.id === campaignId && item.tenant_id === tenantId);
      if (!campaign || campaign.status === "cancelled") {
        message.status = "skipped";
        message.reason = "Campanha cancelada ou indisponivel";
        message.updated_at = new Date().toISOString();
        skipped += 1;
        continue;
      }
      if (countWhatsAppCrmCampaignSentToday(tenantId) >= campaign.daily_tenant_limit || hasRecentWhatsAppCrmCampaignForPhone(tenantId, message.phone, campaign.cooldown_hours, message.id)) {
        message.status = "skipped";
        message.reason = "Limite diario ou intervalo por telefone respeitado";
        message.updated_at = new Date().toISOString();
        skipped += 1;
        recordWhatsAppCloudLog(tenantId, { action: "crm_campaign_skipped", status: "skipped", message: message.reason, metadata: { campaignId: campaign.id, to: maskPhone(message.phone), templateName: message.template_name } });
        continue;
      }
      try {
        campaign.status = "sending";
        message.attempts += 1;
        message.updated_at = new Date().toISOString();
        recordWhatsAppCloudLog(tenantId, { action: "crm_campaign_send_requested", status: "success", message: "Envio de campanha CRM solicitado", metadata: { campaignId: campaign.id, to: maskPhone(message.phone), templateName: message.template_name } });
        const result = await provider.sendTemplate({
          to: message.phone,
          templateName: String(message.template_name || ""),
          language: String(message.language || "pt_BR"),
          components: Array.isArray(message.payload?.components) ? message.payload.components : [],
          availableTemplates: templates
        });
        const processedAt = new Date().toISOString();
        message.status = "sent";
        message.sent_at = processedAt;
        message.processed_at = processedAt;
        message.updated_at = processedAt;
        message.meta_message_id = result.data?.messages?.[0]?.id || "";
        sent += 1;
        recordWhatsAppCloudLog(tenantId, { action: "crm_campaign_sent", status: "success", message: "Campanha CRM enviada", metadata: { campaignId: campaign.id, to: maskPhone(message.phone), templateName: message.template_name, metaMessageId: message.meta_message_id || "" } });
      } catch (error) {
        const processedAt = new Date().toISOString();
        message.status = message.attempts >= message.max_attempts ? "failed" : "queued";
        message.last_error = maskSecretText(error instanceof Error ? error.message : "Falha ao enviar campanha CRM");
        message.reason = message.last_error;
        message.processed_at = processedAt;
        message.updated_at = processedAt;
        failed += 1;
        recordWhatsAppCloudLog(tenantId, { action: "crm_campaign_failed", status: "error", message: message.last_error, metadata: { campaignId, to: maskPhone(message.phone), templateName: message.template_name } });
      }
    }
    whatsappCrmCampaigns.filter(item => item.tenant_id === tenantId).forEach(campaign => {
      const queue = getWhatsAppCrmCampaignQueue(tenantId, campaign.id);
      campaign.queued_count = queue.filter(item => item.status === "queued").length;
      campaign.sent_count = queue.filter(item => item.status === "sent").length;
      campaign.failed_count = queue.filter(item => item.status === "failed").length;
      campaign.skipped_count = queue.filter(item => item.status === "skipped").length;
      if (queue.length && !queue.some(item => item.status === "queued") && campaign.status !== "cancelled") campaign.status = "completed";
      campaign.updated_at = new Date().toISOString();
    });
    schedulePersistentStateSave("whatsapp-crm-campaign-run");
    res.json({ processed: ready.length, sent, failed, skipped, queue: getWhatsAppCrmCampaignQueue(tenantId).slice(0, 200).map(sanitizeWhatsAppQueueRecord) });
  });

  app.get("/api/admin/whatsapp-center/contacts/:id", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const contact = whatsappContacts.find(item => item.id === req.params.id && item.tenantId === tenantId);
    if (!contact) return res.status(404).json({ error: "Contato nao encontrado" });
    const conversations = whatsappConversations.filter(item => item.tenantId === tenantId && item.contactId === contact.id).map(publicWhatsAppConversation);
    const optOutEvents = whatsappOptOutEvents.filter(item => item.tenantId === tenantId && item.contactId === contact.id);
    res.json({ contact: publicWhatsAppContact(contact), conversations, optOutEvents });
  });

  app.put("/api/admin/whatsapp-center/contacts/:id/consent", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const contact = whatsappContacts.find(item => item.id === req.params.id && item.tenantId === tenantId);
    if (!contact) return res.status(404).json({ error: "Contato nao encontrado" });
    const optOut = Boolean(req.body.optOut);
    contact.optOut = optOut;
    contact.optOutAt = optOut ? (contact.optOutAt || new Date().toISOString()) : undefined;
    contact.updatedAt = new Date().toISOString();
    if (optOut) recordWhatsAppOptOut(tenantId, contact, String(req.body.reason || "admin_consent_update").slice(0, 160), "admin");
    whatsappContacts = whatsappContacts.map(item => item.id === contact.id ? contact : item);
    schedulePersistentStateSave("whatsapp-center-consent");
    res.json({ contact: publicWhatsAppContact(contact) });
  });

  app.use("/api/admin", rateLimiter, requireTenantAdmin);
  const adminFeatureRoutes: Array<{ pattern: RegExp; feature: TenantFeatureFlag }> = [
    { pattern: /^\/crm/, feature: "crm" },
    { pattern: /^\/customers/, feature: "crm" },
    { pattern: /^\/messages/, feature: "whatsapp_automation" },
    { pattern: /^\/reports/, feature: "reports_pdf" },
    { pattern: /^\/affiliates/, feature: "advanced_affiliates" },
    { pattern: /^\/wallet-ledger/, feature: "wallet" },
    { pattern: /^\/integrations/, feature: "automations" },
    { pattern: /^\/automations/, feature: "automations" }
  ];
  app.use("/api/admin", (req, res, next) => {
    if (["/plan", "/features", "/me", "/dashboard"].includes(req.path)) return next();
    const matched = adminFeatureRoutes.find(item => item.pattern.test(req.path));
    if (matched && !tenantHasFeature(resolveRequestTenantId(req), matched.feature)) {
      res.status(403).json({ error: "Recurso bloqueado pelo plano atual", feature: matched.feature, upgradeRequired: true });
      return;
    }
    next();
  });
  app.use("/api/admin", (req, res, next) => {
    res.on("finish", () => {
      if (req.method !== "GET") {
        recordAudit(`${req.method} ${req.path}`, req, res.statusCode);
      }
    });
    next();
  });

  app.get("/api/public/tenant-governance", (req, res) => {
    const tenant = getRequestTenant(req);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    res.json({
      status: tenant.status,
      plan: getTenantPlan(tenant.id).id,
      features: getTenantFeatures(tenant.id),
      checkoutAllowed: ["trial", "active"].includes(tenant.status),
      maintenance: tenant.status === "maintenance",
      blocked: ["suspended", "overdue", "blocked", "canceled", "inactive"].includes(tenant.status)
    });
  });

  app.get("/api/public/reports/validate/:requestId", (req, res) => {
    const record = reportExports.find(item => item.request_id === req.params.requestId);
    if (!record) return res.status(404).json({ error: "Relatorio nao encontrado" });
    res.json({
      valid: record.status === "generated",
      report_type: record.report_type,
      file_hash: record.file_hash,
      generated_by: record.generated_by,
      created_at: record.created_at,
      request_id: record.request_id
    });
  });

  app.get("/api/admin/me", (req, res) => {
    const session = getAuthSession(req);
    const tenantId = resolveRequestTenantId(req);
    const tenant = tenants.find(item => item.id === tenantId) || null;
    res.json({
      user: session ? {
        id: session.sub,
        email: session.email,
        role: normalizeAuthRole(session.role),
        tenant_id: session.tenant_id
      } : null,
      profile: session ? { role: normalizeAuthRole(session.role), tenantId } : null,
      tenant: tenant ? buildTenantSummary(tenant) : null
    });
  });

  app.get("/api/admin/plan", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const tenant = tenants.find(item => item.id === tenantId);
    const plan = getTenantPlan(tenantId);
    res.json({
      tenant: tenant ? buildTenantSummary(tenant) : null,
      plan,
      limits: {
        campaigns: `${raffles.filter(raffle => raffle.tenant_id === tenantId).length}/${plan.max_campaigns}`,
        customers: `${Object.values(customersByPhone).filter(customer => customer.tenant_id === tenantId).length}/${plan.max_customers}`,
        adminUsers: `${authUsers.filter(user => user.tenant_id === tenantId && ["admin", "operador", "tenant_admin"].includes(user.role)).length}/${plan.max_admin_users}`,
        whatsappMessagesMonth: `${whatsappMessageQueue.filter(message => message.tenant_id === tenantId).length}/${plan.max_whatsapp_messages_month}`
      }
    });
  });

  app.get("/api/admin/features", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    res.json({ tenant_id: tenantId, plan: getTenantPlan(tenantId).id, features: getTenantFeatures(tenantId), upgradeUrl: "/admin/meu-plano" });
  });

  app.get("/api/admin/api-keys", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    res.json(tenantApiKeys.filter(item => item.tenant_id === tenantId).map(sanitizeTenantApiKey));
  });

  app.post("/api/admin/api-keys", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!tenantHasFeature(tenantId, "public_api")) {
      res.status(403).json({ error: "API publica bloqueada pelo plano atual", feature: "public_api", upgradeRequired: true });
      return;
    }
    const name = String(req.body.name || "").trim().slice(0, 80);
    const scopes = normalizeTenantApiScopes(req.body.scopes);
    if (!name || scopes.length === 0) {
      res.status(400).json({ error: "Nome e ao menos um escopo sao obrigatorios", available_scopes: allTenantApiKeyScopes });
      return;
    }
    const { prefix, plainKey } = generateTenantApiKey();
    const record: TenantApiKeyRecord = {
      id: createPublicId("AK_"),
      tenant_id: tenantId,
      name,
      key_hash: hashTenantApiKey(plainKey),
      prefix,
      scopes,
      active: true,
      expires_at: req.body.expires_at ? String(req.body.expires_at) : undefined,
      created_by: getAuthSession(req)?.sub || getAuthSession(req)?.email || "admin",
      created_at: new Date().toISOString()
    };
    tenantApiKeys.unshift(record);
    recordAuditLedger(req, { tenant_id: tenantId, action: "TENANT_API_KEY_CREATED", resource_type: "tenant_api_key", resource_id: record.id, before_data: null, after_data: sanitizeTenantApiKey(record), reason: String(req.body.reason || "Criacao de API key por tenant") });
    res.status(201).json({ api_key: plainKey, key: sanitizeTenantApiKey(record), warning: "Guarde esta chave agora. Ela nao sera exibida novamente." });
  });

  app.delete("/api/admin/api-keys/:id", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const record = tenantApiKeys.find(item => item.id === req.params.id && item.tenant_id === tenantId);
    if (!record) return res.status(404).json({ error: "API key nao encontrada" });
    const before = sanitizeTenantApiKey(record);
    record.active = false;
    recordAuditLedger(req, { tenant_id: tenantId, action: "TENANT_API_KEY_REVOKED", resource_type: "tenant_api_key", resource_id: record.id, before_data: before, after_data: sanitizeTenantApiKey(record), reason: String(req.body?.reason || "Revogacao de API key por tenant") });
    res.json({ success: true, key: sanitizeTenantApiKey(record) });
  });

  app.get("/api/admin/dashboard", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const tenant = tenants.find(item => item.id === tenantId);
    if (!tenant) {
      res.status(404).json({ error: "Tenant nao encontrado" });
      return;
    }
    const tenantRaffles = raffles.filter(raffle => raffle.tenant_id === tenantId);
    const tenantPurchases = purchases.filter(purchase => purchase.tenant_id === tenantId);
    const paidPurchases = tenantPurchases.filter(purchase => purchase.status === "paid");
    res.json({
      tenant: buildTenantSummary(tenant),
      metrics: {
        activeRaffles: tenantRaffles.filter(raffle => raffle.status === "active").length,
        totalRaffles: tenantRaffles.length,
        paidOrders: paidPurchases.length,
        pendingOrders: tenantPurchases.filter(purchase => purchase.status === "pending").length,
        revenue: Number(paidPurchases.reduce((sum, purchase) => sum + purchase.amount, 0).toFixed(2)),
        customers: Object.values(customersByPhone).filter(customer => customer.tenant_id === tenantId).length,
        affiliates: Object.values(affiliates).filter(affiliate => affiliate.tenant_id === tenantId).length
      },
      recentOrders: tenantPurchases
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 25),
      raffles: tenantRaffles.map(sanitizeRaffleForAdmin)
    });
  });

  app.get("/api/admin/domains", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    res.json(tenantDomains.filter(domain => domain.tenant_id === tenantId).map(sanitizeTenantDomain));
  });

  app.post("/api/admin/domains", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    try {
      const domain = buildDomainRecord(tenantId, req.body || {});
      tenantDomains.unshift(domain);
      recordSecurityEvent({ tenant_id: tenantId, action: "DOMAIN_REQUESTED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", actor: getAuthSession(req)?.email, detail: domain.domain });
      res.status(201).json(sanitizeTenantDomain(domain));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao criar dominio" });
    }
  });

  app.post("/api/admin/domains/:id/verify", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const domain = tenantDomains.find(item => item.id === req.params.id && item.tenant_id === tenantId);
    if (!domain) return res.status(404).json({ error: "Dominio nao encontrado" });
    verifyTenantDomain(domain);
    recordSecurityEvent({ tenant_id: tenantId, action: "DOMAIN_VERIFIED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", actor: getAuthSession(req)?.email, detail: domain.domain });
    res.json(sanitizeTenantDomain(domain));
  });

  app.put("/api/admin/domains/:id/primary", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const domain = tenantDomains.find(item => item.id === req.params.id && item.tenant_id === tenantId);
    if (!domain) return res.status(404).json({ error: "Dominio nao encontrado" });
    if (domain.status !== "verified") return res.status(409).json({ error: "Verifique o dominio antes de torna-lo principal" });
    setPrimaryTenantDomain(domain);
    recordSecurityEvent({ tenant_id: tenantId, action: "DOMAIN_PRIMARY_CHANGED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "WARN", severity: "medium", actor: getAuthSession(req)?.email, detail: domain.domain });
    res.json(sanitizeTenantDomain(domain));
  });

  app.delete("/api/admin/domains/:id", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const domain = tenantDomains.find(item => item.id === req.params.id && item.tenant_id === tenantId);
    if (!domain) return res.status(404).json({ error: "Dominio nao encontrado" });
    tenantDomains = tenantDomains.filter(item => item.id !== domain.id);
    recordSecurityEvent({ tenant_id: tenantId, action: "DOMAIN_DELETED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "WARN", severity: "medium", actor: getAuthSession(req)?.email, detail: domain.domain });
    res.json({ success: true });
  });

  // Validate Purchase Fraud
  function normalizeTickets(input: unknown) {
    const value = Number(input);
    if (!Number.isInteger(value) || value < 1) return null;
    return value;
  }

  function createPublicId(prefix = "") {
    return `${prefix}${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  }

  function recordAudit(action: string, req: express.Request, status = 200, detail = "") {
    auditLogs.unshift({
      id: createPublicId("AUD_"),
      tenant_id: resolveRequestTenantId(req),
      action,
      method: req.method,
      path: req.originalUrl || req.url,
      status,
      actor: "admin",
      ip: String(req.ip || req.socket.remoteAddress || ""),
      createdAt: new Date().toISOString(),
      detail
    });
    auditLogs = auditLogs.slice(0, 500);
  }

  const integrationProviderTypes: Record<IntegrationProviderId, IntegrationType> = Object.fromEntries(
    listProviderCatalog().map(item => [item.provider, item.type])
  ) as Record<IntegrationProviderId, IntegrationType>;
  const integrationActions: Array<keyof BaseProvider> = [
    "validateCredentials",
    "createPixCharge",
    "checkPaymentStatus",
    "processWebhook",
    "sendMessage",
    "sendEmail",
    "sendConversionEvent",
    "getHealthStatus"
  ];

  function writeIntegrationLog(log: Omit<IntegrationLogRecord, "id" | "created_at">) {
    integrationLogs.unshift({
      id: createPublicId("ILOG_"),
      created_at: new Date().toISOString(),
      ...log
    });
    integrationLogs = integrationLogs.slice(0, 1000);
  }

  function safeIntegration(integration: IntegrationRecord) {
    return {
      ...integrationManager.maskIntegration(integration),
      catalog: providerCatalog[integration.provider]
    };
  }

  function findAdminIntegration(req: express.Request, id: string) {
    return integrations.find(item => item.id === id && adminCanAccessTenant(req, item.tenant_id));
  }

  function normalizeIntegrationPayload(req: express.Request, current?: IntegrationRecord) {
    const tenantId = current?.tenant_id || resolveRequestTenantId(req);
    const provider = String(req.body.provider || current?.provider || "") as IntegrationProviderId;
    if (!integrationProviderTypes[provider]) throw new Error("Provider invalido");
    const status = ["active", "inactive", "error", "pending_config"].includes(String(req.body.status))
      ? String(req.body.status)
      : current?.status || "pending_config";
    const now = new Date().toISOString();
    const credentials = req.body.credentials !== undefined
      ? (req.body.credentials || {})
      : current ? integrationManager.context(current).credentials : {};
    return {
      tenant_id: tenantId,
      provider,
      type: String(req.body.type || current?.type || integrationProviderTypes[provider]),
      status: status as IntegrationRecord["status"],
      name: String(req.body.name || current?.name || provider),
      encrypted_credentials: integrationManager.encryptCredentials(credentials),
      settings: { ...(providerCatalog[provider]?.defaultSettings || {}), ...(current?.settings || {}), ...(req.body.settings || {}) },
      last_sync_at: current?.last_sync_at || "",
      last_error: current?.last_error || "",
      created_at: current?.created_at || now,
      updated_at: now
    };
  }

  async function queueConversionEvent(tenantId: string, eventName: string, payload: Record<string, unknown>) {
    const activeAds = integrations.filter(item =>
      item.tenant_id === tenantId &&
      item.status === "active" &&
      ["metaAds", "googleAds"].includes(item.provider)
    );
    await Promise.all(activeAds.map(async integration => {
      await integrationManager.execute(integration, "sendConversionEvent", { eventName, ...payload }, writeIntegrationLog);
    }));
  }

  function normalizeCouponCode(value: unknown) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
  }

  function getActiveCoupon(rawCode: unknown, raffleId: string, tickets: number, tenantId = legacyTenantId) {
    const code = normalizeCouponCode(rawCode);
    if (!code) return null;
    const now = Date.now();
    const coupon = campaignCoupons.find(item => item.tenant_id === tenantId && item.code === code && item.active);
    if (!coupon) throw new Error("Cupom inválido ou inativo");
    if (coupon.raffleId && coupon.raffleId !== raffleId) throw new Error("Cupom não disponível para esta rifa");
    if (coupon.minTickets && tickets < coupon.minTickets) throw new Error(`Cupom válido a partir de ${coupon.minTickets} cotas`);
    if (coupon.maxUses && coupon.used >= coupon.maxUses) throw new Error("Cupom esgotado");
    if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) throw new Error("Cupom ainda não começou");
    if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now) throw new Error("Cupom expirado");
    return coupon;
  }

  function calculateCouponBenefit(coupon: CampaignCoupon | null, subtotal: number, tickets: number) {
    if (!coupon) return { discount: 0, bonusTickets: 0 };
    if (coupon.type === "bonus") return { discount: 0, bonusTickets: Math.max(0, Math.floor(coupon.value)) };
    const discount = coupon.type === "percent" ? subtotal * (coupon.value / 100) : coupon.value;
    return { discount: Math.max(0, Math.min(subtotal, Number(discount.toFixed(2)))), bonusTickets: 0 };
  }

  function sanitizeN8nSettings(sourceSettings = settings) {
    const config: Partial<N8nIntegrationSettings> = sourceSettings.n8nIntegration || {};
    return {
      ...config,
      secret: config.secret ? "********" : ""
    };
  }

  function sanitizePublicSettings(sourceSettings = settings) {
    const normalizedSettings = normalizeSettingsShape(sourceSettings);
    return {
      ...normalizedSettings,
      affiliateInstructionVideo: {
        ...normalizedSettings.affiliateInstructionVideo,
        videoConfig: {
          ...(normalizedSettings.affiliateInstructionVideo?.videoConfig || {}),
          showControls: false,
          tapToUnmute: false
        }
      },
      n8nIntegration: {
        enabled: Boolean(normalizedSettings.n8nIntegration?.enabled),
        channelWhatsapp: Boolean(normalizedSettings.n8nIntegration?.channelWhatsapp),
        channelEmail: Boolean(normalizedSettings.n8nIntegration?.channelEmail),
        lastStatus: normalizedSettings.n8nIntegration?.lastStatus || "not_configured"
      }
    };
  }

  function getRaffleAudience(raffleId?: string, audience = "platform", tenantId = legacyTenantId) {
    const customers = new Map<string, CustomerRecord>();
    const addCustomer = (customer?: CustomerRecord) => {
      if (customer?.id && !customer.blocked) customers.set(customer.id, customer);
    };

    if (audience === "raffle_previous" && raffleId) {
      purchases
        .filter(purchase => purchase.tenant_id === tenantId && purchase.raffleId === raffleId && purchase.status === "paid")
        .forEach(purchase => addCustomer(purchase.customer));
    } else {
      Object.values(customersByPhone).filter(customer => customer.tenant_id === tenantId).forEach(addCustomer);
    }

    return Array.from(customers.values()).map(customer => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: (customer as any).email || "",
      cpf: customer.cpf,
      city: customer.city,
      state: customer.state,
      affiliateRefCode: customer.affiliateRefCode
    }));
  }

  function createN8nEnvelope(event: string, payload: Record<string, unknown>, options: Record<string, unknown> = {}) {
    return {
      event,
      source: "rifapro-saas",
      createdAt: new Date().toISOString(),
      channels: {
        whatsapp: Boolean(settings.n8nIntegration?.channelWhatsapp),
        email: Boolean(settings.n8nIntegration?.channelEmail)
      },
      ...options,
      payload
    };
  }

  async function dispatchN8nEvent(event: string, payload: Record<string, unknown>, options: { target?: string; force?: boolean; tenantId?: string } = {}) {
    const config: Partial<N8nIntegrationSettings> = settings.n8nIntegration || {};
    const log: N8nEventLog = {
      id: createPublicId("N8N_"),
      tenant_id: options.tenantId || legacyTenantId,
      event,
      status: "queued",
      target: options.target || "n8n",
      createdAt: new Date().toISOString(),
      attempts: 0,
      payloadPreview: {
        event,
        customer: (payload.customer as any)?.phone || (payload.customer as any)?.id,
        raffle: (payload.raffle as any)?.id || (payload.raffle as any)?.title,
        audienceSize: Array.isArray(payload.audience) ? payload.audience.length : undefined
      }
    };
    n8nEventLogs.unshift(log);
    n8nEventLogs = n8nEventLogs.slice(0, 300);

    if (!config.webhookUrl || (!options.force && !config.enabled)) {
      log.status = "skipped";
      log.error = !config.webhookUrl ? "Integração n8n sem webhook configurado" : "Integração n8n desativada";
      settings.n8nIntegration.lastStatus = log.status;
      return log;
    }

    try {
      log.attempts += 1;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.secret) headers["X-CIFHER-Secret"] = config.secret;
      const response = await fetch(config.webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(createN8nEnvelope(event, payload))
      });
      log.statusCode = response.status;
      log.status = response.ok ? "sent" : "failed";
      log.deliveredAt = new Date().toISOString();
      if (!response.ok) log.error = `HTTP ${response.status}`;
      settings.n8nIntegration.lastStatus = log.status;
      return log;
    } catch (error) {
      log.status = "failed";
      log.error = error instanceof Error ? error.message : "Falha desconhecida no webhook";
      log.deliveredAt = new Date().toISOString();
      settings.n8nIntegration.lastStatus = log.status;
      return log;
    }
  }

  function queueN8nEvent(event: string, payload: Record<string, unknown>, options: { target?: string; force?: boolean; tenantId?: string } = {}) {
    dispatchN8nEvent(event, payload, options).catch(() => null);
  }

  function buildPurchaseN8nPayload(purchase: PurchaseRecord) {
    const raffle = raffles.find(item => item.tenant_id === purchase.tenant_id && item.id === purchase.raffleId);
    const ticketMessage = purchase.numeros.length <= 25
      ? `Suas cotas: ${purchase.numeros.join(", ")}.`
      : `Voce recebeu ${purchase.tickets} cotas. Consulte a lista completa no painel do cliente.`;
    return {
      purchase: {
        id: purchase.purchaseId,
        status: purchase.status,
        amount: purchase.amount,
        tickets: purchase.tickets,
        numbers: purchase.numeros,
        couponCode: purchase.couponCode,
        discountAmount: purchase.discountAmount,
        bonusTickets: purchase.bonusTickets,
        createdAt: purchase.createdAt
      },
      customer: purchase.customer ? stripSensitiveCustomerFields(purchase.customer) : { phone: purchase.contact },
      raffle: raffle ? sanitizeRaffleForPublic(raffle) : { id: purchase.raffleId },
      message: {
        whatsapp: `Ola ${purchase.customer?.name || "cliente"}, sua compra ${purchase.purchaseId} foi confirmada. ${ticketMessage}`,
        emailSubject: `Cotas confirmadas - ${raffle?.title || "Sorteio"}`,
        emailBody: `Compra ${purchase.purchaseId} confirmada. ${ticketMessage}`
      }
    };
  }

  function isRaffleN8nEnabled(raffle?: typeof raffles[number]) {
    return Boolean(raffle && getTenantSettings(raffle.tenant_id).n8nIntegration?.enabled && raffle.n8nEnabled);
  }

  function validatePurchaseFraud(contact: string, tickets: number, ip: string) {
     if (!Number.isInteger(tickets) || tickets < 1) return "Invalid ticket quantity";
     if (tickets > 10000) return "Exceeded max ticket limit per transaction";
     if (!contact || contact.replace(/\D/g, "").length < 10) return "Invalid contact details";
     // Simple bot heuristics can be added here
     return null;
  }

  function fraudSeverity(score: number): "low" | "medium" | "high" {
    if (score >= 71) return "high";
    if (score >= 31) return "medium";
    return "low";
  }

  function fraudAction(score: number, signalType: string): FraudCaseRecord["action"] {
    if (signalType === "saque_suspeito" && score >= 71) return "block_withdrawal";
    if (signalType === "afiliado_autoindicacao" && score >= 71) return "block_affiliate";
    if (score >= 90) return "block_checkout";
    if (score >= 71) return "manual_review";
    if (score >= 31) return "alert_admin";
    return "log_only";
  }

  function createFraudEvent(input: {
    tenant_id: string;
    customer_id?: string;
    order_id?: string;
    affiliate_id?: string;
    signal_type: string;
    score: number;
    metadata?: Record<string, unknown>;
    status?: FraudCaseRecord["status"];
  }) {
    const score = Math.max(0, Math.min(100, Math.round(input.score)));
    const severity = fraudSeverity(score);
    const now = new Date().toISOString();
    const event: FraudScoreEventRecord = {
      id: createPublicId("FSE_"),
      tenant_id: input.tenant_id,
      customer_id: input.customer_id,
      order_id: input.order_id,
      affiliate_id: input.affiliate_id,
      signal_type: input.signal_type,
      severity,
      score,
      metadata: input.metadata || {},
      status: "open",
      created_at: now
    };
    fraudScoreEvents.unshift(event);
    fraudSignals.unshift({ ...event, id: createPublicId("FRD_") });
    if (score >= 31) {
      const duplicate = fraudCases.find(item =>
        item.tenant_id === input.tenant_id &&
        item.signal_type === input.signal_type &&
        item.customer_id === input.customer_id &&
        item.order_id === input.order_id &&
        ["open", "manual_review", "blocked"].includes(item.status)
      );
      if (!duplicate) {
        fraudCases.unshift({
          id: createPublicId("FRC_"),
          tenant_id: input.tenant_id,
          customer_id: input.customer_id,
          order_id: input.order_id,
          affiliate_id: input.affiliate_id,
          signal_type: input.signal_type,
          severity,
          score,
          metadata: input.metadata || {},
          status: score >= 71 ? "manual_review" : "open",
          action: fraudAction(score, input.signal_type),
          created_at: now
        });
      }
    }
    fraudScoreEvents = fraudScoreEvents.slice(0, 2000);
    fraudSignals = fraudSignals.slice(0, 2000);
    fraudCases = fraudCases.slice(0, 1000);
    return event;
  }

  function getCustomerRiskScore(tenantId: string, customerId?: string) {
    if (!customerId) return 0;
    return Math.max(0, ...fraudCases.filter(item => item.tenant_id === tenantId && item.customer_id === customerId && ["open", "manual_review", "blocked"].includes(item.status)).map(item => item.score));
  }

  function evaluateAdvancedPurchaseFraud(req: express.Request, input: { tenantId: string; customer: CustomerRecord; tickets: number; amount?: number; refCode?: string; useBalance?: boolean }) {
    const ip = String(req.ip || req.socket.remoteAddress || "");
    const userAgent = String(req.headers["user-agent"] || "");
    const browserId = getBrowserIdFromRequest(req) || input.customer.browserId || "";
    const now = Date.now();
    const recentPurchases = purchases.filter(item => item.tenant_id === input.tenantId && new Date(item.createdAt).getTime() >= now - 60 * 60 * 1000);
    const sameIpCount = auditEventLedger.filter(item => item.tenant_id === input.tenantId && item.ip_address === ip && new Date(item.created_at).getTime() >= now - 60 * 60 * 1000).length;
    const cpfSet = new Set(Object.values(customersByCpf).filter(item => item.tenant_id === input.tenantId && item.cpf).map(item => item.cpf));
    const sameDevicePhones = browserId ? new Set(Object.values(customersByPhone).filter(item => item.tenant_id === input.tenantId && item.browserId === browserId).map(item => item.phone)).size : 0;
    const customerPurchases = purchases.filter(item => item.tenant_id === input.tenantId && item.customer?.id === input.customer.id);
    const avgAmount = customerPurchases.length ? customerPurchases.reduce((sum, item) => sum + item.amount, 0) / customerPurchases.length : 0;
    const amount = Number(input.amount || input.tickets);
    const signals: FraudScoreEventRecord[] = [];
    if (sameIpCount >= 8 || recentPurchases.length >= 12) signals.push(createFraudEvent({ tenant_id: input.tenantId, customer_id: input.customer.id, signal_type: "muitas_compras_mesmo_ip", score: Math.min(90, 25 + sameIpCount * 5 + recentPurchases.length), metadata: { ip, sameIpCount, recentPurchases: recentPurchases.length } }));
    if (cpfSet.size >= 6 && sameIpCount >= 5) signals.push(createFraudEvent({ tenant_id: input.tenantId, customer_id: input.customer.id, signal_type: "muitos_cpfs_mesmo_ip", score: 55, metadata: { ip, cpfCount: cpfSet.size } }));
    if (sameDevicePhones >= 3) signals.push(createFraudEvent({ tenant_id: input.tenantId, customer_id: input.customer.id, signal_type: "muitos_telefones_mesmo_dispositivo", score: Math.min(85, 25 + sameDevicePhones * 15), metadata: { browserId, phones: sameDevicePhones } }));
    const referrer = input.refCode ? affiliates[tenantCustomerKey(input.tenantId, input.refCode)] : undefined;
    if (referrer?.customerId && referrer.customerId === input.customer.id) signals.push(createFraudEvent({ tenant_id: input.tenantId, customer_id: input.customer.id, affiliate_id: referrer.refCode, signal_type: "afiliado_autoindicacao", score: 78, metadata: { refCode: referrer.refCode } }));
    if (input.useBalance && amount > 0) signals.push(createFraudEvent({ tenant_id: input.tenantId, customer_id: input.customer.id, signal_type: "uso_abusivo_saldo", score: amount > 500 ? 72 : 38, metadata: { amount } }));
    const similarAccounts = Object.values(customersByPhone).filter(item => item.tenant_id === input.tenantId && item.id !== input.customer.id && item.name?.slice(0, 8).toLowerCase() === input.customer.name?.slice(0, 8).toLowerCase()).length;
    if (similarAccounts >= 2) signals.push(createFraudEvent({ tenant_id: input.tenantId, customer_id: input.customer.id, signal_type: "multiplas_contas_similares", score: 48, metadata: { similarAccounts } }));
    if (customerPurchases.filter(item => item.status === "pending").length >= 4) signals.push(createFraudEvent({ tenant_id: input.tenantId, customer_id: input.customer.id, signal_type: "muitas_tentativas_pagamento", score: 52, metadata: { pendingOrders: customerPurchases.filter(item => item.status === "pending").length } }));
    if (avgAmount > 0 && amount > avgAmount * 8) signals.push(createFraudEvent({ tenant_id: input.tenantId, customer_id: input.customer.id, signal_type: "compra_muito_alta_fora_padrao", score: 74, metadata: { amount, avgAmount } }));
    if (/curl|bot|spider|python|scrapy|headless/i.test(userAgent)) signals.push(createFraudEvent({ tenant_id: input.tenantId, customer_id: input.customer.id, signal_type: "user_agent_suspeito", score: 82, metadata: { userAgent } }));
    if (/vpn|proxy/i.test(String(req.headers["x-network-type"] || req.headers["x-forwarded-for"] || ""))) signals.push(createFraudEvent({ tenant_id: input.tenantId, customer_id: input.customer.id, signal_type: "vpn_proxy_futuro", score: 62, metadata: { ip } }));
    if (input.customer.state && req.headers["x-geo-region"] && String(req.headers["x-geo-region"]).toUpperCase() !== String(input.customer.state).toUpperCase()) signals.push(createFraudEvent({ tenant_id: input.tenantId, customer_id: input.customer.id, signal_type: "localizacao_incompativel", score: 45, metadata: { customerState: input.customer.state, requestRegion: req.headers["x-geo-region"] } }));
    const maxScore = Math.max(getCustomerRiskScore(input.tenantId, input.customer.id), ...signals.map(item => item.score || 0), 0);
    return { score: maxScore, blocked: maxScore >= 90, signals };
  }

  function evaluateWithdrawalFraud(customer: CustomerRecord, affiliate: AffiliateRecord, amount: number) {
    const recentWithdrawals = affiliateWithdrawals.filter(item => item.tenant_id === affiliate.tenant_id && item.customerId === customer.id && new Date(item.requestedAt).getTime() >= Date.now() - 7 * 86400000);
    const score = amount > 1000 || recentWithdrawals.length >= 2 || getCustomerRiskScore(affiliate.tenant_id, customer.id) >= 71 ? 86 : amount > 500 ? 55 : 15;
    return createFraudEvent({ tenant_id: affiliate.tenant_id, customer_id: customer.id, affiliate_id: affiliate.refCode, signal_type: "saque_suspeito", score, metadata: { amount, recentWithdrawals: recentWithdrawals.length } });
  }

  function normalizePhone(phone: string) {
    return String(phone || "").replace(/\D/g, "");
  }

  function normalizeCpf(cpf: string) {
    return String(cpf || "").replace(/\D/g, "");
  }

  function getBrowserIdFromRequest(req: express.Request) {
    const cookieHeader = req.headers.cookie || "";
    const cookie = cookieHeader
      .split(";")
      .map(item => item.trim())
      .find(item => item.startsWith("nexusdraw_browser_id="));
    if (!cookie) return "";
    return decodeURIComponent(cookie.split("=").slice(1).join("="));
  }

  function normalizeAccessPassword(input: unknown) {
    const value = String(input || "").replace(/\D/g, "");
    return value.length === 6 ? value : "";
  }

  function stripSensitiveCustomerFields<T>(value: T): T {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(item => stripSensitiveCustomerFields(item)) as T;
    if (value instanceof Set) return value as T;

    const safe: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (key === "accessPassword") return;
      safe[key] = stripSensitiveCustomerFields(item);
    });
    return safe as T;
  }

  function requestOwnsCustomer(req: express.Request, customer: CustomerRecord) {
    const browserId = getBrowserIdFromRequest(req);
    return Boolean(browserId && customer.browserId && browserId === customer.browserId);
  }

  function requestHasAdminSession(req: express.Request, tenantId = resolveRequestTenantId(req)) {
    const session = getAuthSession(req);
    return Boolean(session && (
      session.role === "superadmin" ||
      (session.role === "tenant_admin" && session.tenant_id === tenantId)
    ));
  }

  function notifyCustomer(customer: CustomerRecord | undefined, title: string, body: string, ctaLabel = "", ctaUrl = "") {
    if (!customer) return;
    customerMessages.unshift({
      id: createPublicId("MSG_"),
      tenant_id: customer.tenant_id,
      title,
      body,
      type: "notice",
      ctaLabel,
      ctaUrl,
      createdAt: new Date().toISOString(),
      createdBy: "admin",
      target: "customer",
      customerId: customer.id,
      readBy: []
    });
  }

  function createAffiliateCode(name: string, phone: string) {
    const base = String(name || "cliente")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 6)
      .toUpperCase();
    return `${base || "VIP"}${phone.slice(-4)}`;
  }

  function createUniqueAffiliateCode(customer: CustomerRecord) {
    const base = createAffiliateCode(customer.name, customer.phone)
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .toUpperCase()
      .slice(0, 20) || "VIP";
    let candidate = customer.affiliateRefCode || base;
    let suffix = 1;
    while (affiliates[tenantCustomerKey(customer.tenant_id, candidate)]?.customerId && affiliates[tenantCustomerKey(customer.tenant_id, candidate)]?.customerId !== customer.id) {
      candidate = `${base}${suffix}`.slice(0, 24);
      suffix += 1;
    }
    customer.affiliateRefCode = candidate;
    return candidate;
  }

  function getAffiliateForCustomer(customer: CustomerRecord) {
    return affiliates[tenantCustomerKey(customer.tenant_id, customer.affiliateRefCode)];
  }

  const MAX_CUSTOM_AFFILIATE_COMMISSION_RATE = 100;

  function normalizeAffiliateCommissionRate(value: unknown) {
    return Math.max(0, Math.min(MAX_CUSTOM_AFFILIATE_COMMISSION_RATE, Number(value || 0)));
  }

  function resolveAffiliateCommissionRate(affiliate: AffiliateRecord) {
    if (affiliate.useCustomCommission) return normalizeAffiliateCommissionRate(affiliate.customCommissionRate);
    return normalizeAffiliateCommissionRate(getTenantSettings(affiliate.tenant_id).affiliateProgram.commissionRate);
  }

  function publicAffiliateView(affiliate?: AffiliateRecord | null) {
    if (!affiliate) return undefined;
    const { useCustomCommission, customCommissionRate, performanceRewards, performanceRewardBalances, performanceRewardConsumptions, tenant_id, customerId, ...publicAffiliate } = affiliate;
    return publicAffiliate;
  }

  function ensureAffiliateForCustomer(customer: CustomerRecord, options: { forceEnable?: boolean; source?: string } = {}) {
    const refCode = createUniqueAffiliateCode(customer);
    const key = tenantCustomerKey(customer.tenant_id, refCode);
    if (!affiliates[key]) {
      affiliates[key] = {
        tenant_id: customer.tenant_id,
        refCode,
        customerId: customer.id,
        clicks: 0,
        conversions: 0,
        referredCustomers: 0,
        revenue: 0,
        commission: 0,
        commissionBalance: 0,
        prizeBalance: 0,
        useCustomCommission: false,
        customCommissionRate: undefined,
        useBalanceForPurchases: false,
        enabled: Boolean(options.forceEnable) || customer.totalTickets >= getTenantSettings(customer.tenant_id).affiliateProgram.minTicketsToJoin,
        history: [],
        performanceRewards: [],
        performanceRewardBalances: {},
        performanceRewardConsumptions: []
      };
      if (options.source) {
        affiliates[key].history.push({ amount: 0, type: options.source, date: new Date().toISOString() });
      }
    }
    affiliates[key].commissionBalance ??= affiliates[key].commission || 0;
    affiliates[key].prizeBalance ??= 0;
    affiliates[key].useCustomCommission = Boolean(affiliates[key].useCustomCommission);
    affiliates[key].customCommissionRate = affiliates[key].useCustomCommission ? normalizeAffiliateCommissionRate(affiliates[key].customCommissionRate) : undefined;
    affiliates[key].performanceRewards ||= [];
    affiliates[key].performanceRewardBalances ||= {};
    affiliates[key].performanceRewardConsumptions ||= [];
    affiliates[key].commission =
      affiliates[key].commissionBalance + affiliates[key].prizeBalance;
    affiliates[key].enabled =
      Boolean(affiliates[key].enabled) ||
      Boolean(options.forceEnable) ||
      customer.totalTickets >= getTenantSettings(customer.tenant_id).affiliateProgram.minTicketsToJoin;
    return affiliates[key];
  }

  function debitAffiliateWallet(affiliate: AffiliateRecord, amount: number) {
    let remaining = amount;
    const prizeDebit = Math.min(affiliate.prizeBalance || 0, remaining);
    affiliate.prizeBalance -= prizeDebit;
    remaining -= prizeDebit;
    const commissionDebit = Math.min(affiliate.commissionBalance || 0, remaining);
    affiliate.commissionBalance -= commissionDebit;
    remaining -= commissionDebit;
    affiliate.commission = affiliate.commissionBalance + affiliate.prizeBalance;
    return remaining <= 0;
  }

  function findOrCreateCustomer(payload: any, refCode?: string, browserIdFromCookie = "", tenantId = legacyTenantId) {
    const phone = normalizePhone(payload.phone || payload.contact);
    const cpf = normalizeCpf(payload.cpf);
    const browserId = String(payload.browserId || browserIdFromCookie || "").slice(0, 80);
    const accessPassword = normalizeAccessPassword(payload.accessPassword || payload.password);
    if (!phone && !cpf) throw new Error("Informe telefone ou CPF");
    if (phone && phone.length < 10) throw new Error("Telefone inválido");

    const existing = findCustomerByPhone(phone, tenantId) || (cpf ? findCustomerByCpf(cpf, tenantId) : undefined);
    if (existing) {
      if (existing.blocked) throw new Error(existing.blockedReason || "Cliente bloqueado pelo administrador");
      if (cpf && existing.cpf !== cpf) throw new Error("CPF não confere com o cadastro deste telefone");
      const trustedBrowser = Boolean(browserId && existing.browserId && browserId === existing.browserId);
      if (!trustedBrowser) {
        if (!accessPassword) throw new Error("Senha de acesso obrigatória");
        if (existing.accessPassword && existing.accessPassword !== accessPassword) throw new Error("Senha de acesso inválida");
        if (browserId) existing.browserId = browserId;
      }
      existing.city = existing.city || payload.geoLocation?.city || payload.city || "Nao informado";
      existing.state = existing.state || payload.geoLocation?.state || payload.state || "Nao informado";
      existing.latitude = existing.latitude || Number(payload.geoLocation?.latitude || payload.latitude) || undefined;
      existing.longitude = existing.longitude || Number(payload.geoLocation?.longitude || payload.longitude) || undefined;
      existing.browserId = existing.browserId || browserId;
      if (accessPassword && (!existing.accessPassword || trustedBrowser)) existing.accessPassword = accessPassword;
      updateCrmAutomationForCustomer(existing);
      return existing;
    }

    if (!payload.name || String(payload.name).trim().length < 3) throw new Error("Nome obrigatório");
    if (!phone || phone.length < 10) throw new Error("Telefone inválido");
    if (!cpf || cpf.length !== 11) throw new Error("CPF inválido");
    if (!accessPassword) throw new Error("Senha de 6 dígitos obrigatória");
    const plan = getTenantPlan(tenantId);
    const currentCustomers = Object.values(customersByPhone).filter(customer => customer.tenant_id === tenantId).length;
    if (currentCustomers >= plan.max_customers) throw new Error(`Plano ${plan.nome} permite ate ${plan.max_customers} cliente(s)`);

    const customer: CustomerRecord = {
      id: createPublicId("C_"),
      tenant_id: tenantId,
      name: String(payload.name).trim(),
      phone,
      cpf,
      accessPassword,
      photoUrl: payload.photoUrl,
      createdAt: new Date().toISOString(),
      totalTickets: 0,
      affiliateRefCode: createAffiliateCode(payload.name, phone),
      referredBy: refCode,
      city: payload.geoLocation?.city || payload.city || "Nao informado",
      state: payload.geoLocation?.state || payload.state || "Nao informado",
      latitude: Number(payload.geoLocation?.latitude || payload.latitude) || undefined,
      longitude: Number(payload.geoLocation?.longitude || payload.longitude) || undefined,
      browserId
    };

    customersByPhone[tenantCustomerKey(tenantId, phone)] = customer;
    customersByCpf[tenantCustomerKey(tenantId, cpf)] = customer;
    updateCrmAutomationForCustomer(customer);

    const referrer = refCode ? affiliates[tenantCustomerKey(tenantId, refCode)] : undefined;
    if (referrer && referrer.customerId !== customer.id) {
      referrer.referredCustomers++;
    }

    return customer;
  }

  function getDefaultRafflePixConfig(): RafflePixConfig {
    return {
      inheritGlobal: true,
      enabled: true,
      gateway: "mercadopago",
      sandbox: true,
      apiKey: "",
      webhookUrl: "",
      webhookSecret: "",
      webhookEvents: "payment.created,payment.updated,payment.paid"
    };
  }

  function getRafflePixConfig(raffle?: { id?: string; tenant_id?: string; pixConfig?: Partial<RafflePixConfig> }, tenantId = raffle?.tenant_id || legacyTenantId) {
    const local = { ...getDefaultRafflePixConfig(), ...(raffle?.pixConfig || {}) };
    const tenantPixGateways = getTenantGateways(tenantId);
    const defaultGatewayConfig = getDefaultPaymentGatewayConfig(tenantId);
    const gateway = normalizePaymentProvider((local.inheritGlobal ? defaultGatewayConfig.provider : local.gateway) || "mercadopago");
    const gatewayConfig = (tenantPixGateways[gateway as PixGatewayId] || {}) as Record<string, string>;
    const normalizedCredentials = (defaultGatewayConfig.credentials || {}) as Record<string, string>;
    return {
      ...local,
      enabled: local.inheritGlobal ? Boolean(tenantPixGateways.pix?.enabled) : Boolean(local.enabled),
      sandbox: local.inheritGlobal ? defaultGatewayConfig.environment !== "production" : Boolean(local.sandbox),
      gateway,
      pixKey: local.inheritGlobal ? (defaultGatewayConfig.pix_key || tenantPixGateways.pix?.pixKey || gatewayConfig.pixKey || "") : (local.pixKey || ""),
      apiKey: local.inheritGlobal ? (tenantPixGateways.pix?.apiKey || normalizedCredentials.apiKey || gatewayConfig.apiKey || gatewayConfig.accessToken || gatewayConfig.token || "") : (local.apiKey || ""),
      accessToken: local.inheritGlobal ? (normalizedCredentials.accessToken || gatewayConfig.accessToken || gatewayConfig.token || "") : (local.accessToken || ""),
      publicKey: local.inheritGlobal ? (normalizedCredentials.publicKey || gatewayConfig.publicKey || "") : (local.publicKey || ""),
      clientId: local.inheritGlobal ? (normalizedCredentials.clientId || gatewayConfig.clientId || "") : (local.clientId || ""),
      clientSecret: local.inheritGlobal ? (normalizedCredentials.clientSecret || gatewayConfig.clientSecret || "") : (local.clientSecret || ""),
      webhookUrl: local.inheritGlobal
        ? (tenantPixGateways.pix?.webhookUrl || gatewayConfig.webhookUrl || `http://127.0.0.1:3000/api/webhooks/payment/${gateway}`)
        : (local.webhookUrl || `http://127.0.0.1:3000/api/webhooks/payment/${gateway}`),
      webhookSecret: local.inheritGlobal ? (defaultGatewayConfig.webhook_secret || tenantPixGateways.pix?.webhookSecret || gatewayConfig.webhookSecret || "") : (local.webhookSecret || ""),
      webhookEvents: local.inheritGlobal ? (tenantPixGateways.pix?.webhookEvents || local.webhookEvents || "") : (local.webhookEvents || "")
    };
  }

  function emvField(id: string, value: string) {
    return `${id}${String(value.length).padStart(2, "0")}${value}`;
  }

  function crc16(payload: string) {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let bit = 0; bit < 8; bit++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  function buildPixPayload(amount: number, raffle?: { id?: string; tenant_id?: string; pixConfig?: Partial<RafflePixConfig> }, txid = "***", tenantId = raffle?.tenant_id || legacyTenantId) {
    const pix = getRafflePixConfig(raffle, tenantId);
    if (!pix.enabled) {
      throw new Error("PIX desabilitado pelo admin para este sorteio");
    }
    const pixKey = (pix.pixKey || pix.apiKey || "123e4567-e89b-12d3-a456-426614174000").slice(0, 77);
    const merchantName = "RIFA PREMIUM".slice(0, 25);
    const merchantCity = "SAO PAULO".slice(0, 15);
    const safeTxid = String(txid || "***").replace(/[^A-Za-z0-9***_-]/g, "").slice(0, 25) || "***";
    const merchantAccount = emvField("00", "br.gov.bcb.pix") + emvField("01", pixKey);
    const payloadWithoutCrc = [
      emvField("00", "01"),
      emvField("26", merchantAccount),
      emvField("52", "0000"),
      emvField("53", "986"),
      emvField("54", Math.max(0.01, amount).toFixed(2)),
      emvField("58", "BR"),
      emvField("59", merchantName),
      emvField("60", merchantCity),
      emvField("62", emvField("05", safeTxid)),
      "6304"
    ].join("");
    return `${payloadWithoutCrc}${crc16(payloadWithoutCrc)}`;
  }

  function getAsaasGatewayConfig(tenantId: string) {
    const config = getDefaultPaymentGatewayConfig(tenantId);
    const provider = normalizePaymentProvider(config.provider);
    if (provider !== "asaas" || !config.enabled) return null;
    const credentials = config.credentials || {};
    const configJson = config.config_json || {};
    const apiKey = String(credentials.apiKey || config.pix_key || "");
    if (!apiKey || isMaskedGatewaySecret(apiKey)) return null;
    return {
      environment: config.environment === "production" ? "production" as const : "sandbox" as const,
      apiKey,
      webhookToken: String(config.webhook_secret || ""),
      userAgent: String(configJson.userAgent || credentials.userAgent || "CIFHER Plataforma"),
      releaseMode: String(configJson.releaseMode || credentials.releaseMode || "PAYMENT_RECEIVED") === "PAYMENT_CONFIRMED" ? "PAYMENT_CONFIRMED" as const : "PAYMENT_RECEIVED" as const,
      paymentMode: String(configJson.paymentMode || credentials.paymentMode || "pix_direct"),
      orderExpirationMinutes: Math.max(1, Number(configJson.orderExpirationMinutes || credentials.orderExpirationMinutes || 15))
    };
  }

  function getAsaasProvider(tenantId: string) {
    const config = getAsaasGatewayConfig(tenantId);
    return config ? { config, provider: new AsaasProvider(config) } : null;
  }

  function getMercadoPagoGatewayConfig(tenantId: string) {
    const config = getDefaultPaymentGatewayConfig(tenantId);
    const provider = normalizePaymentProvider(config.provider);
    if (provider !== "mercadopago" || !config.enabled) return null;
    const credentials = config.credentials || {};
    const configJson = config.config_json || {};
    const accessToken = String(credentials.accessToken || credentials.access_token || credentials.token || "");
    if (!accessToken || isMaskedGatewaySecret(accessToken)) return null;
    return {
      environment: config.environment === "production" ? "production" as const : "sandbox" as const,
      accessToken,
      webhookToken: String(config.webhook_secret || credentials.webhookToken || ""),
      expirationMinutes: Math.max(1, Math.min(1440, Number(configJson.expirationMinutes || credentials.expirationMinutes || 15))),
      releaseStatus: String(configJson.releaseStatus || credentials.releaseStatus || "approved").toLowerCase(),
      baseUrl: String(configJson.baseUrl || credentials.baseUrl || "")
    };
  }

  function getMercadoPagoProvider(tenantId: string) {
    const config = getMercadoPagoGatewayConfig(tenantId);
    return config ? { config, provider: new MercadoPagoProvider(config) } : null;
  }

  function getPay2mGatewayConfig(tenantId: string) {
    const config = getDefaultPaymentGatewayConfig(tenantId);
    const provider = normalizePaymentProvider(config.provider);
    if (provider !== "pay2m" || !config.enabled) return null;
    const credentials = config.credentials || {};
    const configJson = config.config_json || {};
    const clientId = String(credentials.clientId || credentials.client_id || "");
    const clientSecret = String(credentials.clientSecret || credentials.client_secret || credentials.apiKey || "");
    if (!clientId || !clientSecret || isMaskedGatewaySecret(clientId) || isMaskedGatewaySecret(clientSecret)) return null;
    return {
      environment: config.environment === "sandbox" ? "sandbox" as const : "production" as const,
      clientId,
      clientSecret,
      webhookToken: String(config.webhook_secret || credentials.webhookToken || ""),
      expirationTime: Math.max(1, Math.min(3600, Number(configJson.expirationTime || credentials.expirationTime || 1800))),
      splitLink: String(configJson.splitLink || credentials.splitLink || ""),
      releaseStatus: String(configJson.releaseStatus || credentials.releaseStatus || "paid"),
      baseUrl: String(configJson.baseUrl || credentials.baseUrl || "https://portal.pay2m.com.br")
    };
  }

  function getPay2mProvider(tenantId: string) {
    const config = getPay2mGatewayConfig(tenantId);
    return config ? { config, provider: new Pay2mProvider(config) } : null;
  }

  function getCoraGatewayConfig(tenantId: string) {
    const config = getDefaultPaymentGatewayConfig(tenantId);
    const provider = normalizePaymentProvider(config.provider);
    if (provider !== "cora" || !config.enabled) return null;
    const credentials = config.credentials || {};
    const configJson = config.config_json || {};
    const clientId = String(credentials.clientId || credentials.client_id || "");
    const clientSecret = String(credentials.clientSecret || credentials.client_secret || "");
    const certificate = String(credentials.certificate || credentials.certificado || "");
    const privateKey = String(credentials.privateKey || credentials.private_key || credentials.chavePrivada || "");
    if (!clientId || !certificate || !privateKey || isMaskedGatewaySecret(clientId) || isMaskedGatewaySecret(certificate) || isMaskedGatewaySecret(privateKey)) return null;
    return {
      environment: config.environment === "production" ? "production" as const : "sandbox" as const,
      clientId,
      clientSecret,
      certificate,
      privateKey,
      webhookToken: String(config.webhook_secret || credentials.webhookToken || ""),
      expirationMinutes: Math.max(1, Math.min(1440, Number(configJson.expirationMinutes || credentials.expirationMinutes || 15))),
      baseUrl: String(configJson.baseUrl || credentials.baseUrl || ""),
      tokenUrl: String(configJson.tokenUrl || credentials.tokenUrl || "")
    };
  }

  function getCoraProvider(tenantId: string) {
    const config = getCoraGatewayConfig(tenantId);
    return config ? { config, provider: new CoraProvider(config) } : null;
  }

  function getPrimepagGatewayConfig(tenantId: string) {
    const config = getDefaultPaymentGatewayConfig(tenantId);
    const provider = normalizePaymentProvider(config.provider);
    if (provider !== "primepag" || !config.enabled) return null;
    const credentials = config.credentials || {};
    const configJson = config.config_json || {};
    const clientId = String(credentials.clientId || credentials.client_id || "");
    const clientSecret = String(credentials.clientSecret || credentials.client_secret || "");
    const accessToken = String(credentials.accessToken || credentials.access_token || credentials.apiKey || credentials.api_token || config.pix_key || "");
    const hasStaticToken = Boolean(accessToken && !isMaskedGatewaySecret(accessToken));
    const hasOauthCredentials = Boolean(clientId && clientSecret && !isMaskedGatewaySecret(clientId) && !isMaskedGatewaySecret(clientSecret));
    if (!hasStaticToken && !hasOauthCredentials) return null;
    return {
      environment: config.environment === "production" ? "production" as const : config.environment === "sandbox" ? "sandbox" as const : "staging" as const,
      clientId,
      clientSecret,
      accessToken,
      webhookToken: String(config.webhook_secret || credentials.webhookToken || ""),
      expirationTime: Math.max(1, Math.min(86400, Number(configJson.expirationTime || credentials.expirationTime || 1800))),
      baseUrl: String(configJson.baseUrl || credentials.baseUrl || "")
    };
  }

  function getPrimepagProvider(tenantId: string) {
    const config = getPrimepagGatewayConfig(tenantId);
    return config ? { config, provider: new PrimepagProvider(config) } : null;
  }

  function getPagbankGatewayConfig(tenantId: string) {
    const config = getDefaultPaymentGatewayConfig(tenantId);
    const provider = normalizePaymentProvider(config.provider);
    if (provider !== "pagbank" || !config.enabled) return null;
    const credentials = config.credentials || {};
    const configJson = config.config_json || {};
    const token = String(credentials.token || credentials.apiKey || credentials.api_token || config.pix_key || "");
    if (!token || isMaskedGatewaySecret(token)) return null;
    return {
      environment: config.environment === "production" ? "production" as const : "sandbox" as const,
      token,
      webhookToken: String(config.webhook_secret || credentials.webhookToken || ""),
      expirationMinutes: Math.max(1, Math.min(1440, Number(configJson.expirationMinutes || credentials.expirationMinutes || 15))),
      releaseStatus: String(configJson.releaseStatus || credentials.releaseStatus || "PAID").toUpperCase(),
      baseUrl: String(configJson.baseUrl || credentials.baseUrl || "")
    };
  }

  function getPagbankProvider(tenantId: string) {
    const config = getPagbankGatewayConfig(tenantId);
    return config ? { config, provider: new PagbankProvider(config) } : null;
  }

  function buildTenantPublicUrl(tenantId: string, pathName: string, forceHttps = false) {
    const explicit = String(process.env.PUBLIC_BASE_URL || process.env.APP_URL || "").replace(/\/+$/, "");
    if (explicit) {
      const baseUrl = forceHttps ? explicit.replace(/^http:\/\//i, "https://") : explicit;
      return `${baseUrl}${pathName.startsWith("/") ? pathName : `/${pathName}`}`;
    }
    const tenant = tenants.find(item => item.id === tenantId);
    const verifiedDomain = tenantDomains.find(domain => domain.tenant_id === tenantId && domain.status === "verified" && domain.is_primary);
    const host = verifiedDomain?.domain || tenant?.dominio_customizado || tenant?.dominio || `${tenant?.slug || "rifapro"}.meudominio.com`;
    const protocol = forceHttps ? "https" : host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    return `${protocol}://${host}${pathName.startsWith("/") ? pathName : `/${pathName}`}`;
  }

  function toCents(value: number) {
    return Math.max(1, Math.round(Number(value || 0) * 100));
  }

  function recordPaymentLog(log: Omit<PaymentLog, "id" | "createdAt">) {
    const entry: PaymentLog = {
      id: createPublicId("PLOG_"),
      createdAt: new Date().toISOString(),
      ...log
    };
    paymentLogs.unshift(entry);
    paymentLogs = paymentLogs.slice(0, 1000);
    return entry;
  }

  function updateGatewayHealth(input: { tenant_id: string; provider: string; ok: boolean; statusCode: number; message: string }) {
    const current = gatewayHealth.find(item => item.tenant_id === input.tenant_id && item.provider === input.provider);
    const nextStatus: GatewayHealth["status"] = input.ok ? "healthy" : input.statusCode >= 500 ? "down" : "degraded";
    if (current) {
      current.status = nextStatus;
      current.lastStatusCode = input.statusCode;
      current.lastEventAt = new Date().toISOString();
      current.lastMessage = input.message;
      if (input.ok) current.successCount += 1;
      else current.failureCount += 1;
      return current;
    }
    const entry: GatewayHealth = {
      tenant_id: input.tenant_id,
      provider: input.provider,
      status: nextStatus,
      lastStatusCode: input.statusCode,
      lastEventAt: new Date().toISOString(),
      successCount: input.ok ? 1 : 0,
      failureCount: input.ok ? 0 : 1,
      lastMessage: input.message
    };
    gatewayHealth.unshift(entry);
    return entry;
  }

  function upsertPaymentRecord(record: PaymentRecord) {
    const current = payments.find(item => item.tenant_id === record.tenant_id && item.order_id === record.order_id && item.provider === record.provider);
    if (current) Object.assign(current, record, { id: current.id, created_at: current.created_at, updated_at: new Date().toISOString() });
    else payments.unshift(record);
    payments = payments.slice(0, 1000);
    recordPaymentLog({
      tenant_id: record.tenant_id,
      provider: String(record.provider),
      order_id: record.order_id,
      provider_payment_id: record.provider_payment_id,
      action: "payment_created",
      status: record.status,
      message: "Payment record normalizado criado/atualizado"
    });
    return current || record;
  }

  function updatePaymentRecordStatus(tenantId: string, provider: string, orderId: string, status: string, rawResponse: Record<string, unknown> = {}) {
    const payment = payments.find(item =>
      item.tenant_id === tenantId &&
      item.provider === provider &&
      (item.order_id === orderId || item.provider_payment_id === orderId || item.provider_reference === orderId || item.asaas_payment_id === orderId)
    );
    if (payment) {
      payment.status = status;
      payment.raw_response = { ...(payment.raw_response || {}), ...rawResponse };
      payment.updated_at = new Date().toISOString();
      if (status === "paid" && !payment.paid_at) payment.paid_at = new Date().toISOString();
      const payload = rawResponse.webhook && typeof rawResponse.webhook === "object" ? rawResponse.webhook as Record<string, any> : {};
      const message = payload.message && typeof payload.message === "object" ? payload.message : {};
      if (message.end_to_end) payment.end_to_end = String(message.end_to_end);
      recordPaymentLog({
        tenant_id: tenantId,
        provider,
        order_id: payment.order_id,
        provider_payment_id: payment.provider_payment_id,
        action: rawResponse.reconcile ? "reconcile" : "payment_updated",
        status,
        message: "Payment record atualizado"
      });
    }
    return payment;
  }

  function buildAsaasExternalReference(tenantId: string, orderId: string) {
    return `tenant:${encodeURIComponent(tenantId)}:order:${encodeURIComponent(orderId)}`;
  }

  function parseAsaasExternalReference(reference: unknown) {
    const value = String(reference || "").trim();
    const match = /^tenant:([^:]+):order:(.+)$/i.exec(value);
    if (!match) return { tenantId: "", orderId: value, signed: false };
    try {
      return {
        tenantId: decodeURIComponent(match[1]),
        orderId: decodeURIComponent(match[2]),
        signed: true
      };
    } catch {
      return { tenantId: "", orderId: "", signed: false };
    }
  }

  function resolveAsaasWebhookPayment(input: { externalReference?: unknown; paymentId?: unknown }) {
    const parsedReference = parseAsaasExternalReference(input.externalReference);
    const signedReference = String(input.externalReference || "").trim();
    const paymentId = String(input.paymentId || "").trim();
    const paymentByProvider = paymentId
      ? payments.find(item =>
          item.provider === "asaas" &&
          (item.provider_payment_id === paymentId || item.asaas_payment_id === paymentId)
        )
      : undefined;
    const paymentBySignedReference = parsedReference.signed && parsedReference.tenantId && parsedReference.orderId
      ? payments.find(item =>
          item.tenant_id === parsedReference.tenantId &&
          item.provider === "asaas" &&
          (item.provider_reference === signedReference || item.order_id === parsedReference.orderId)
        )
      : undefined;
    const paymentByLegacyOrder = !parsedReference.signed && parsedReference.orderId
      ? payments.find(item => item.provider === "asaas" && item.order_id === parsedReference.orderId)
      : undefined;
    const payment = paymentByProvider || paymentBySignedReference || paymentByLegacyOrder;
    const tenantId = payment?.tenant_id || parsedReference.tenantId || "";
    const orderId = payment?.order_id || parsedReference.orderId || "";
    const conflict = Boolean(
      (paymentByProvider && paymentBySignedReference && paymentByProvider.tenant_id !== paymentBySignedReference.tenant_id) ||
      (paymentByProvider && parsedReference.tenantId && paymentByProvider.tenant_id !== parsedReference.tenantId) ||
      (paymentByProvider && parsedReference.orderId && paymentByProvider.order_id !== parsedReference.orderId)
    );
    const source = paymentByProvider
      ? "provider_payment_id"
      : paymentBySignedReference
        ? "signed_external_reference"
        : paymentByLegacyOrder
          ? "legacy_order_id"
          : parsedReference.signed
            ? "signed_external_reference_only"
            : "unresolved";
    return { tenantId, orderId, payment, conflict, source, parsedReference };
  }

  async function attachAsaasPixToOrder(input: { tenantId: string; purchase: PurchaseRecord | FazendinhaPurchase | NumberModePurchase; customer: CustomerRecord; amount: number; description: string; pixExpiresAt?: string }) {
    const asaas = getAsaasProvider(input.tenantId);
    if (!asaas || input.amount <= 0) return null;
    const orderId = "purchaseId" in input.purchase ? input.purchase.purchaseId : input.purchase.id;
    const asaasExternalReference = buildAsaasExternalReference(input.tenantId, orderId);
    const customerGatewayKey = `${input.tenantId}:asaas:${asaas.config.environment}`;
    input.customer.gatewayCustomerIds ||= {};
    let asaasCustomerId = input.customer.gatewayCustomerIds[customerGatewayKey];
    if (!asaasCustomerId) {
      const createdCustomer = await asaas.provider.createCustomer({
        name: input.customer.name,
        cpfCnpj: input.customer.cpf,
        mobilePhone: input.customer.phone,
        externalReference: input.customer.id
      });
      asaasCustomerId = String(createdCustomer.id || "");
      if (!asaasCustomerId) throw new Error("Asaas nao retornou ID do cliente");
      input.customer.gatewayCustomerIds[customerGatewayKey] = asaasCustomerId;
      recordPaymentWebhookLog({ tenant_id: input.tenantId, gateway: "asaas", purchaseId: orderId, status: "received", message: "Cliente Asaas criado/reutilizado", statusCode: 201, eventStatus: "CUSTOMER_CREATED" });
    }
    const dueDate = new Date(input.pixExpiresAt || Date.now() + asaas.config.orderExpirationMinutes * 60_000).toISOString().slice(0, 10);
    const payment = await asaas.provider.createPixPayment({
      customerId: asaasCustomerId,
      value: Number(input.amount.toFixed(2)),
      dueDate,
      externalReference: asaasExternalReference,
      description: input.description
    });
    const asaasPaymentId = String(payment.id || "");
    if (!asaasPaymentId) throw new Error("Asaas nao retornou ID da cobranca");
    const qrCode = await asaas.provider.getPixQrCode(asaasPaymentId);
    const pixPayload = qrCode.payload || "ASAAS_PIX_PAYLOAD_PENDING";
    const pixExpiresAt = input.pixExpiresAt || qrCode.expirationDate || new Date(Date.now() + asaas.config.orderExpirationMinutes * 60_000).toISOString();
    Object.assign(input.purchase, {
      pixPayload,
      pixGateway: "asaas",
      pixWebhookUrl: "/api/webhooks/asaas",
      externalReference: asaasExternalReference,
      externalPaymentId: asaasPaymentId,
      pixQrCodeBase64: qrCode.encodedImage || "",
      pixExpiresAt
    });
    upsertPaymentRecord({
      id: createPublicId("PAY_"),
      tenant_id: input.tenantId,
      order_id: orderId,
      provider: "asaas",
      asaas_payment_id: asaasPaymentId,
      provider_payment_id: asaasPaymentId,
      provider_reference: asaasExternalReference,
      billing_type: "PIX",
      status: String(payment.status || "PENDING"),
      qr_code_base64: qrCode.encodedImage || "",
      pix_payload: pixPayload,
      pix_copy_paste: pixPayload,
      expiration_date: pixExpiresAt,
      raw_response: { payment, qrCode: { ...qrCode, encodedImage: qrCode.encodedImage ? "[base64]" : "" } },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    recordPaymentWebhookLog({ tenant_id: input.tenantId, gateway: "asaas", purchaseId: orderId, status: "received", message: "Cobranca Pix Asaas criada e QR Code gerado", statusCode: 201, eventStatus: "PAYMENT_CREATED" });
    return { payment, qrCode };
  }

  async function attachMercadoPagoPixToOrder(input: { tenantId: string; purchase: PurchaseRecord | FazendinhaPurchase | NumberModePurchase; customer: CustomerRecord; amount: number; description: string; pixExpiresAt?: string }) {
    const mercadoPago = getMercadoPagoProvider(input.tenantId);
    if (!mercadoPago || input.amount <= 0) return null;
    const orderId = "purchaseId" in input.purchase ? input.purchase.purchaseId : input.purchase.id;
    const pixExpiresAt = input.pixExpiresAt || new Date(Date.now() + mercadoPago.config.expirationMinutes * 60_000).toISOString();
    const payment = await mercadoPago.provider.createPixPayment({
      amount: Number(input.amount.toFixed(2)),
      description: input.description || "Compra de cotas",
      externalReference: orderId,
      notificationUrl: buildTenantPublicUrl(input.tenantId, "/api/webhooks/mercadopago", true),
      payerEmail: `${String(input.customer.id || orderId).toLowerCase().replace(/[^a-z0-9._-]/g, "") || "cliente"}@rifapro.local`,
      payerFirstName: input.customer.name,
      payerDocument: input.customer.cpf,
      idempotencyKey: randomUUID()
    });
    const mercadoPagoPaymentId = String(payment.id || "");
    const qrCode = mercadoPago.provider.parsePixQrCode(payment as Record<string, any>);
    if (!mercadoPagoPaymentId || !qrCode.qrCode) throw new Error("Mercado Pago nao retornou id/qr_code PIX");
    Object.assign(input.purchase, {
      pixPayload: qrCode.qrCode,
      pixGateway: "mercadopago",
      pixWebhookUrl: "/api/webhooks/mercadopago",
      externalReference: orderId,
      externalPaymentId: mercadoPagoPaymentId,
      pixQrCodeBase64: qrCode.qrCodeBase64,
      pixExpiresAt
    });
    upsertPaymentRecord({
      id: createPublicId("PAY_"),
      tenant_id: input.tenantId,
      order_id: orderId,
      provider: "mercadopago",
      provider_payment_id: mercadoPagoPaymentId,
      provider_reference: orderId,
      billing_type: "PIX",
      status: mercadoPago.provider.parsePaymentStatus(payment as Record<string, any>) || "pending",
      qr_code_base64: qrCode.qrCodeBase64,
      qr_code_url: qrCode.ticketUrl,
      ticket_url: qrCode.ticketUrl,
      pix_payload: qrCode.qrCode,
      pix_copy_paste: qrCode.qrCode,
      expiration_date: pixExpiresAt,
      raw_response: { payment: { ...payment, point_of_interaction: { transaction_data: { ...((payment as Record<string, any>).point_of_interaction?.transaction_data || {}), qr_code_base64: qrCode.qrCodeBase64 ? "[base64]" : "" } } } },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    recordPaymentWebhookLog({ tenant_id: input.tenantId, gateway: "mercadopago", purchaseId: orderId, status: "received", message: "Pagamento Pix Mercado Pago criado e QR Code gerado", statusCode: 201, eventStatus: "PAYMENT_CREATED" });
    return payment;
  }

  async function attachPay2mPixToOrder(input: { tenantId: string; purchase: PurchaseRecord | FazendinhaPurchase | NumberModePurchase; customer: CustomerRecord; amount: number; description: string; pixExpiresAt?: string }) {
    const pay2m = getPay2mProvider(input.tenantId);
    if (!pay2m || input.amount <= 0) return null;
    const orderId = "purchaseId" in input.purchase ? input.purchase.purchaseId : input.purchase.id;
    const payment = await pay2m.provider.createPixPayment({
      value: Number(input.amount.toFixed(2)),
      generatorName: input.customer.name,
      generatorDocument: input.customer.cpf,
      externalReference: orderId,
      expirationTime: pay2m.config.expirationTime,
      payerMessage: input.description,
      splitLink: pay2m.config.splitLink || undefined
    });
    const referenceCode = String(payment.reference_code || "");
    const pixPayload = String(payment.content || "");
    if (!referenceCode || !pixPayload) throw new Error("Pay2M nao retornou reference_code/content");
    const pixExpiresAt = input.pixExpiresAt || new Date(Date.now() + pay2m.config.expirationTime * 1000).toISOString();
    Object.assign(input.purchase, {
      pixPayload,
      pixGateway: "pay2m",
      pixWebhookUrl: "/api/webhooks/pay2m",
      externalReference: orderId,
      externalPaymentId: referenceCode,
      pixExpiresAt
    });
    upsertPaymentRecord({
      id: createPublicId("PAY_"),
      tenant_id: input.tenantId,
      order_id: orderId,
      provider: "pay2m",
      provider_payment_id: referenceCode,
      provider_reference: referenceCode,
      billing_type: "PIX",
      status: "awaiting_payment",
      pix_payload: pixPayload,
      pix_copy_paste: pixPayload,
      expiration_date: pixExpiresAt,
      raw_response: { payment },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    recordPaymentWebhookLog({ tenant_id: input.tenantId, gateway: "pay2m", purchaseId: orderId, status: "received", message: "Cobranca Pix Pay2M criada", statusCode: 201, eventStatus: "awaiting_payment" });
    return payment;
  }

  async function attachPrimepagPixToOrder(input: { tenantId: string; purchase: PurchaseRecord | FazendinhaPurchase | NumberModePurchase; customer: CustomerRecord; amount: number; description: string; pixExpiresAt?: string }) {
    const primepag = getPrimepagProvider(input.tenantId);
    if (!primepag || input.amount <= 0) return null;
    const orderId = "purchaseId" in input.purchase ? input.purchase.purchaseId : input.purchase.id;
    const pixExpiresAt = input.pixExpiresAt || new Date(Date.now() + primepag.config.expirationTime * 1000).toISOString();
    const payment = await primepag.provider.createPixPayment({
      amount: Number(input.amount.toFixed(2)),
      generatorName: input.customer.name,
      generatorDocument: input.customer.cpf,
      externalReference: orderId,
      expirationTime: primepag.config.expirationTime
    });
    const qrcode = primepag.provider.getQrCode(payment as Record<string, any>);
    const referenceCode = qrcode.referenceCode;
    const pixPayload = qrcode.content;
    if (!referenceCode || !pixPayload) throw new Error("PrimePag nao retornou reference_code/content do QR Code PIX");
    Object.assign(input.purchase, {
      pixPayload,
      pixGateway: "primepag",
      pixWebhookUrl: "/api/webhooks/primepag",
      externalReference: orderId,
      externalPaymentId: referenceCode,
      pixQrCodeBase64: qrcode.imageBase64,
      pixExpiresAt
    });
    upsertPaymentRecord({
      id: createPublicId("PAY_"),
      tenant_id: input.tenantId,
      order_id: orderId,
      provider: "primepag",
      provider_payment_id: referenceCode,
      provider_reference: qrcode.externalReference || orderId,
      billing_type: "PIX",
      status: primepag.provider.parseQrCodeStatus(payment as Record<string, any>) || "pending",
      qr_code_base64: qrcode.imageBase64,
      pix_payload: pixPayload,
      pix_copy_paste: pixPayload,
      expiration_date: pixExpiresAt,
      raw_response: { payment },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    recordPaymentWebhookLog({ tenant_id: input.tenantId, gateway: "primepag", purchaseId: orderId, status: "received", message: "QRCode Pix PrimePag criado", statusCode: 201, eventStatus: "pending" });
    return payment;
  }

  async function attachCoraPixToOrder(input: { tenantId: string; purchase: PurchaseRecord | FazendinhaPurchase | NumberModePurchase; customer: CustomerRecord; amount: number; description: string; pixExpiresAt?: string }) {
    const cora = getCoraProvider(input.tenantId);
    if (!cora || input.amount <= 0) return null;
    const orderId = "purchaseId" in input.purchase ? input.purchase.purchaseId : input.purchase.id;
    const pixExpiresAt = input.pixExpiresAt || new Date(Date.now() + cora.config.expirationMinutes * 60_000).toISOString();
    const payment = await cora.provider.createPixPayment({
      amount: Number(input.amount.toFixed(2)),
      customerName: input.customer.name,
      customerEmail: `${String(input.customer.id || orderId).toLowerCase().replace(/[^a-z0-9._-]/g, "") || "cliente"}@rifapro.local`,
      customerDocument: input.customer.cpf,
      externalReference: orderId,
      description: input.description || "Compra de cotas",
      dueDate: pixExpiresAt.slice(0, 10),
      notificationUrl: buildTenantPublicUrl(input.tenantId, "/api/webhooks/cora", true),
      idempotencyKey: randomUUID()
    });
    const qrCode = cora.provider.getPixQrCode(payment as Record<string, any>);
    const providerPaymentId = String(qrCode.id || (payment as Record<string, any>).id || orderId);
    const txid = String(qrCode.txid || providerPaymentId);
    if (!providerPaymentId || !qrCode.emv) throw new Error("Cora nao retornou id/emv do QR Code PIX");
    Object.assign(input.purchase, {
      pixPayload: qrCode.emv,
      pixGateway: "cora",
      pixWebhookUrl: "/api/webhooks/cora",
      externalReference: orderId,
      externalPaymentId: providerPaymentId,
      pixQrCodeBase64: qrCode.base64,
      pixExpiresAt
    });
    upsertPaymentRecord({
      id: createPublicId("PAY_"),
      tenant_id: input.tenantId,
      order_id: orderId,
      provider: "cora",
      provider_payment_id: providerPaymentId,
      provider_reference: orderId,
      txid,
      billing_type: "PIX",
      status: cora.provider.parsePaymentStatus(payment as Record<string, any>) || "pending",
      qr_code_base64: qrCode.base64,
      pix_payload: qrCode.emv,
      pix_copy_paste: qrCode.emv,
      expiration_date: pixExpiresAt,
      raw_response: { payment: { ...payment, qr_code_base64: qrCode.base64 ? "[base64]" : "" } },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    recordPaymentWebhookLog({ tenant_id: input.tenantId, gateway: "cora", purchaseId: orderId, status: "received", message: "QR Code Pix Cora criado", statusCode: 201, eventStatus: "PAYMENT_CREATED" });
    return payment;
  }

  async function attachPagbankPixToOrder(input: { tenantId: string; purchase: PurchaseRecord | FazendinhaPurchase | NumberModePurchase; customer: CustomerRecord; amount: number; description: string; pixExpiresAt?: string }) {
    const pagbank = getPagbankProvider(input.tenantId);
    if (!pagbank || input.amount <= 0) return null;
    const orderId = "purchaseId" in input.purchase ? input.purchase.purchaseId : input.purchase.id;
    const pixExpiresAt = input.pixExpiresAt || new Date(Date.now() + pagbank.config.expirationMinutes * 60_000).toISOString();
    const payment = await pagbank.provider.createPixPayment({
      referenceId: orderId,
      itemReferenceId: orderId,
      customerName: input.customer.name,
      customerEmail: `${String(input.customer.id || orderId).toLowerCase().replace(/[^a-z0-9._-]/g, "") || "cliente"}@rifapro.local`,
      customerTaxId: input.customer.cpf,
      customerPhone: input.customer.phone,
      itemName: input.description || "Compra de cotas",
      amountInCents: toCents(input.amount),
      expirationDate: pixExpiresAt,
      notificationUrl: buildTenantPublicUrl(input.tenantId, "/api/webhooks/pagbank", true)
    });
    const pagbankOrderId = String(payment.id || "");
    const qrCode = pagbank.provider.parsePixQrCode(payment as Record<string, any>);
    const pixPayload = qrCode.text;
    if (!pagbankOrderId || !pixPayload) throw new Error("PagBank nao retornou id/text do QR Code PIX");
    Object.assign(input.purchase, {
      pixPayload,
      pixGateway: "pagbank",
      pixWebhookUrl: "/api/webhooks/pagbank",
      externalReference: orderId,
      externalPaymentId: pagbankOrderId,
      pixQrCodeBase64: qrCode.imageUrl,
      pixExpiresAt: qrCode.expirationDate || pixExpiresAt
    });
    upsertPaymentRecord({
      id: createPublicId("PAY_"),
      tenant_id: input.tenantId,
      order_id: orderId,
      provider: "pagbank",
      provider_payment_id: pagbankOrderId,
      provider_reference: orderId,
      billing_type: "PIX",
      status: pagbank.provider.parseOrderStatus(payment as Record<string, any>),
      qr_code_base64: qrCode.imageUrl,
      qr_code_url: qrCode.imageUrl,
      pix_payload: pixPayload,
      pix_copy_paste: pixPayload,
      expiration_date: qrCode.expirationDate || pixExpiresAt,
      raw_response: { payment },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    recordPaymentWebhookLog({ tenant_id: input.tenantId, gateway: "pagbank", purchaseId: orderId, status: "received", message: "Pedido Pix PagBank criado e QR Code gerado", statusCode: 201, eventStatus: "ORDER_CREATED" });
    return payment;
  }

  async function attachActiveGatewayPixToOrder(input: { tenantId: string; purchase: PurchaseRecord | FazendinhaPurchase | NumberModePurchase; customer: CustomerRecord; amount: number; description: string; pixExpiresAt?: string }) {
    return (await attachMercadoPagoPixToOrder(input)) || (await attachAsaasPixToOrder(input)) || (await attachPay2mPixToOrder(input)) || (await attachPrimepagPixToOrder(input)) || (await attachPagbankPixToOrder(input)) || (await attachCoraPixToOrder(input));
  }

  function normalizeFazendinhaNumber(input: unknown) {
    const digits = String(input ?? "").replace(/\D/g, "").slice(-2);
    if (!digits) return "";
    return digits.padStart(2, "0");
  }

  function resetFazendinhaRound(tenantId = legacyTenantId) {
    const config = getFazendinhaConfig(tenantId);
    fazendinhaGroups = fazendinhaGroups.filter(group => group.tenant_id !== tenantId);
    fazendinhaGroups.push(...fazendinhaSeed.map(([id, nomeBicho, numeros]) => ({
      id: tenantId === legacyTenantId ? id : `${tenantId}:${id}`,
      tenant_id: tenantId,
      nomeBicho,
      numeros: [...numeros],
      status: "available" as FazendinhaStatus,
      preco: config.pricePerGroup,
      imagemUrl: ""
    })));
    fazendinhaCompras = fazendinhaCompras.filter(purchase => purchase.tenant_id !== tenantId);
    fazendinhaResultados = fazendinhaResultados.filter(result => result.tenant_id !== tenantId);
    fazendinhaGanhadores = fazendinhaGanhadores.filter(winner => winner.tenant_id !== tenantId);
    config.resultNumber = "";
    config.resultSource = "";
    config.status = "active";
    config.lootboxConfig = createFazendinhaLootboxConfig({
      ...config.lootboxConfig,
      prizeClaimed: false,
      winnerPurchaseId: undefined
    });
    updateFazendinhaConfig(tenantId, config);
  }

  function resolveFazendinhaWinner(numeroSorteado: string, origemResultado = "Loteria", tenantId = legacyTenantId) {
    const config = getFazendinhaConfig(tenantId);
    const normalized = normalizeFazendinhaNumber(numeroSorteado);
    const group = fazendinhaGroups.find(item => item.tenant_id === tenantId && item.numeros.includes(normalized));
    const purchase = group?.compraId ? fazendinhaCompras.find(item => item.tenant_id === tenantId && item.id === group.compraId) : undefined;
    const result = {
      id: createPublicId("FR_"),
      tenant_id: tenantId,
      numeroSorteado: normalized,
      origemResultado,
      dataResultado: new Date().toISOString()
    };
    fazendinhaResultados.unshift(result);
    config.resultNumber = normalized;
    config.resultSource = origemResultado;
    config.status = "closed";
    updateFazendinhaConfig(tenantId, config);

    const winner: FazendinhaWinner = purchase && group
      ? {
          id: createPublicId("FG_"),
          tenant_id: tenantId,
          usuarioId: purchase.usuarioId,
          grupoId: group.id,
          nomeBicho: group.nomeBicho,
          numeroSorteado: normalized,
          premio: config.mainPrize,
          data: result.dataResultado
        }
      : {
          id: createPublicId("FG_"),
          tenant_id: tenantId,
          numeroSorteado: normalized,
          premio: "Sem ganhador",
          data: result.dataResultado,
          semGanhador: true
        };

    fazendinhaGanhadores.unshift(winner);
    return { result, winner, group, purchase };
  }

  function normalizeModeNumber(mode: NumberModeId, input: unknown, tenantId = legacyTenantId) {
    const config = getNumberModeConfig(tenantId, mode);
    if (!config) return "";
    const digits = String(input ?? "").replace(/\D/g, "");
    if (digits.length > config.digits) return "";
    const value = Number(digits || 0);
    const max = Math.pow(10, config.digits) - 1;
    if (!Number.isInteger(value) || value < 0 || value > max) return "";
    return digits.padStart(config.digits, "0");
  }

  function normalizeModeResultNumber(mode: NumberModeId, input: unknown, tenantId = legacyTenantId) {
    const config = getNumberModeConfig(tenantId, mode);
    if (!config) return "";
    const digits = String(input ?? "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.slice(-config.digits).padStart(config.digits, "0");
  }

  function getModeNumbers(mode: NumberModeId, tenantId = legacyTenantId) {
    const config = getNumberModeConfig(tenantId, mode);
    const digits = config?.digits || 2;
    const max = Math.pow(10, digits);
    expireNumberModeReservations(tenantId, mode);
    const sold = new Set(numberModeBets.filter(bet => bet.tenant_id === tenantId && bet.mode === mode && ["reserved", "paid"].includes(bet.status)).map(bet => bet.number));
    return Array.from({ length: max }, (_, index) => {
      const number = String(index).padStart(digits, "0");
      return {
        number,
        status: sold.has(number) ? "sold" : "available"
      };
    });
  }

  function getModeRanking(mode: NumberModeId, tenantId = legacyTenantId) {
    const ranking = numberModePurchases
      .filter(purchase => purchase.tenant_id === tenantId && purchase.mode === mode && purchase.status === "paid")
      .reduce<Record<string, { name: string; phone: string; tickets: number; amount: number }>>((acc, purchase) => {
        const key = purchase.customer.id;
        if (!acc[key]) acc[key] = { name: purchase.customer.name, phone: purchase.customer.phone, tickets: 0, amount: 0 };
        acc[key].tickets += purchase.numbers.length;
        acc[key].amount += purchase.amount;
        return acc;
      }, {});
    return Object.values(ranking).sort((a, b) => b.tickets - a.tickets).slice(0, 10);
  }

  function getDefaultGamificationConfig(tenantId: string, raffleId: string): GamificationConfig {
    return {
      tenant_id: tenantId,
      raffleId,
      status: "active",
      modules: {
        scratchcard: false,
        winningTicket: false,
        luckyHour: false,
        mysteryBox: false,
        doubleTickets: false,
        doubleChance: false,
        extremeTickets: false,
        buyerRanking: false,
        orderBump: false
      },
      scratchcard: {
        winProbability: 0,
        prizes: [
          { id: "scratch-empty", name: "Tente novamente", type: "empty", value: 0, stock: 9999, probability: 100 }
        ]
      },
      winningTicket: { prizes: [] },
      luckyHour: { windows: [] },
      mysteryBox: { boxes: [] },
      doubleTickets: { startsAt: "", endsAt: "", minTickets: 1, maxUsesPerCustomer: 0, packageQuantities: [], label: "Cotas em dobro" },
      doubleChance: { startsAt: "", endsAt: "", minTickets: 1, weight: 2 },
      extremeTickets: { enabled: false, highPrize: "Maior cota", lowPrize: "Menor cota" },
      buyerRanking: { visible: false, metric: "tickets", limit: 10 },
      orderBump: { enabled: false, tickets: 10, discountPercent: 10, label: "Adicione mais 10 números com desconto" }
    };
  }

  function getGamificationConfig(tenantId: string, raffleId: string) {
    let config = gamificationConfigs.find(item => item.tenant_id === tenantId && item.raffleId === raffleId);
    if (!config) {
      config = getDefaultGamificationConfig(tenantId, raffleId);
      gamificationConfigs.push(config);
    } else if (!(config as Partial<GamificationConfig>).doubleTickets || !("doubleTickets" in config.modules)) {
      const normalized = normalizeGamificationConfig(getDefaultGamificationConfig(tenantId, raffleId), config);
      Object.assign(config, normalized);
    }
    return config;
  }

  function normalizeGamificationConfig(current: GamificationConfig, incoming: Partial<GamificationConfig>) {
    const next: GamificationConfig = {
      ...current,
      ...incoming,
      tenant_id: current.tenant_id,
      raffleId: current.raffleId,
      status: incoming.status === "inactive" ? "inactive" : "active",
      modules: { ...current.modules, ...(incoming.modules || {}) },
      scratchcard: {
        ...current.scratchcard,
        ...(incoming.scratchcard || {}),
        prizes: Array.isArray(incoming.scratchcard?.prizes) ? incoming.scratchcard!.prizes.map((prize, index) => ({
          id: String(prize.id || createPublicId("SCRP_")),
          name: String(prize.name || `Prêmio ${index + 1}`),
          type: (["pix", "bonus", "product", "empty"].includes(String(prize.type)) ? prize.type : "empty") as GamificationPrize["type"],
          value: Math.max(0, Number(prize.value || 0)),
          stock: Math.max(0, Math.floor(Number(prize.stock ?? 0))),
          probability: Math.max(0, Number(prize.probability || 0))
        })) : current.scratchcard.prizes,
        winProbability: Math.max(0, Math.min(100, Number(incoming.scratchcard?.winProbability ?? current.scratchcard.winProbability)))
      },
      winningTicket: {
        prizes: Array.isArray(incoming.winningTicket?.prizes) ? incoming.winningTicket!.prizes.map(prize => ({
          id: String(prize.id || createPublicId("BIL_")),
          number: Math.max(1, Math.floor(Number(prize.number || 0))),
          prize: String(prize.prize || "Bilhete premiado"),
          value: Math.max(0, Number(prize.value || 0)),
          status: prize.status === "claimed" ? "claimed" : "available"
        })) : current.winningTicket.prizes
      },
      luckyHour: {
        windows: Array.isArray(incoming.luckyHour?.windows) ? incoming.luckyHour!.windows.map(window => ({
          id: String(window.id || createPublicId("HRA_")),
          startsAt: String(window.startsAt || ""),
          endsAt: String(window.endsAt || ""),
          type: (["bonus", "discount", "extraChance"].includes(String(window.type)) ? window.type : "bonus") as "bonus" | "discount" | "extraChance",
          value: Math.max(0, Number(window.value || 0)),
          active: window.active !== false
        })) : current.luckyHour.windows
      },
      mysteryBox: {
        boxes: Array.isArray(incoming.mysteryBox?.boxes) ? incoming.mysteryBox!.boxes.map((box, index) => ({
          id: String(box.id || createPublicId("BOX_")),
          label: String(box.label || `Caixinha ${index + 1}`),
          prize: String(box.prize || ""),
          type: (["pix", "bonus", "empty"].includes(String(box.type)) ? box.type : "empty") as "pix" | "bonus" | "empty",
          value: Math.max(0, Number(box.value || 0)),
          status: box.status === "opened" ? "opened" : "available"
        })) : current.mysteryBox.boxes
      },
      doubleTickets: {
        ...current.doubleTickets,
        ...(incoming.doubleTickets || {}),
        startsAt: String(incoming.doubleTickets?.startsAt ?? current.doubleTickets.startsAt ?? ""),
        endsAt: String(incoming.doubleTickets?.endsAt ?? current.doubleTickets.endsAt ?? ""),
        minTickets: Math.max(1, Math.floor(Number(incoming.doubleTickets?.minTickets ?? current.doubleTickets.minTickets ?? 1))),
        maxUsesPerCustomer: Math.max(0, Math.floor(Number(incoming.doubleTickets?.maxUsesPerCustomer ?? current.doubleTickets.maxUsesPerCustomer ?? 0))),
        packageQuantities: Array.isArray(incoming.doubleTickets?.packageQuantities)
          ? incoming.doubleTickets!.packageQuantities.map(value => Math.max(1, Math.floor(Number(value)))).filter(Number.isFinite)
          : current.doubleTickets.packageQuantities,
        label: String(incoming.doubleTickets?.label ?? current.doubleTickets.label ?? "Cotas em dobro").slice(0, 80)
      },
      doubleChance: { ...current.doubleChance, ...(incoming.doubleChance || {}) },
      extremeTickets: { ...current.extremeTickets, ...(incoming.extremeTickets || {}) },
      buyerRanking: { ...current.buyerRanking, ...(incoming.buyerRanking || {}) },
      orderBump: { ...current.orderBump, ...(incoming.orderBump || {}) }
    };
    return next;
  }

  function isWithinWindow(now: number, startsAt?: string, endsAt?: string) {
    const start = startsAt ? new Date(startsAt).getTime() : Number.NEGATIVE_INFINITY;
    const end = endsAt ? new Date(endsAt).getTime() : Number.POSITIVE_INFINITY;
    return now >= start && now <= end;
  }

  function getActiveLuckyHour(config: GamificationConfig, createdAt = new Date().toISOString()) {
    if (!config.modules.luckyHour) return null;
    const now = new Date(createdAt).getTime();
    return config.luckyHour.windows.find(window => window.active && isWithinWindow(now, window.startsAt, window.endsAt)) || null;
  }

  function getActiveOrderBump(config: GamificationConfig) {
    if (!config.modules.orderBump || !config.orderBump.enabled) return null;
    return config.orderBump;
  }

  function getDoubleTicketsUsageCount(config: GamificationConfig, customer?: CustomerRecord | null) {
    if (!customer) return 0;
    return purchases.filter(purchase =>
      purchase.tenant_id === config.tenant_id &&
      purchase.raffleId === config.raffleId &&
      purchase.status !== "cancelled" &&
      Boolean(purchase.gamification?.doubleTickets?.applied) &&
      (purchase.customer?.id === customer.id || purchase.contact === customer.phone)
    ).length;
  }

  function getActiveDoubleTicketsPromotion(config: GamificationConfig, requestedTickets: number, customer?: CustomerRecord | null) {
    if (!config.modules.doubleTickets) return null;
    const rule = config.doubleTickets || getDefaultGamificationConfig(config.tenant_id, config.raffleId).doubleTickets;
    if (!isWithinWindow(Date.now(), rule.startsAt, rule.endsAt)) return null;
    const minTickets = Math.max(1, Math.floor(Number(rule.minTickets || 1)));
    if (requestedTickets < minTickets) return null;
    const packageQuantities = Array.isArray(rule.packageQuantities) ? rule.packageQuantities.filter(Number.isFinite) : [];
    if (packageQuantities.length && !packageQuantities.includes(requestedTickets)) return null;
    const maxUsesPerCustomer = Math.max(0, Math.floor(Number(rule.maxUsesPerCustomer || 0)));
    if (maxUsesPerCustomer > 0 && getDoubleTicketsUsageCount(config, customer) >= maxUsesPerCustomer) return null;
    return {
      ...rule,
      minTickets,
      maxUsesPerCustomer,
      packageQuantities,
      label: rule.label || "Cotas em dobro",
      bonusTickets: requestedTickets
    };
  }

  function getBuyerRanking(tenantId: string, raffleId: string, metric: "tickets" | "amount" = "tickets", limit = 10) {
    const ranking = purchases
      .filter(purchase => purchase.tenant_id === tenantId && purchase.raffleId === raffleId && purchase.status === "paid")
      .reduce<Record<string, { customerId: string; name: string; phone: string; tickets: number; amount: number }>>((acc, purchase) => {
        const key = purchase.customer?.id || purchase.contact;
        if (!acc[key]) {
          acc[key] = {
            customerId: key,
            name: purchase.customer?.name || `Cliente ${purchase.contact.slice(-4)}`,
            phone: purchase.contact,
            tickets: 0,
            amount: 0
          };
        }
        acc[key].tickets += purchase.tickets;
        acc[key].amount += purchase.amount;
        return acc;
      }, {});
    const sorted = Object.values(ranking).sort((a, b) => metric === "amount" ? b.amount - a.amount : b.tickets - a.tickets);
    return sorted.slice(0, limit);
  }

  function maskDisplayName(name?: string) {
    const clean = String(name || "Cliente").trim().replace(/\s+/g, " ");
    const parts = clean.split(" ").filter(Boolean);
    if (!parts.length) return "Cliente";
    const first = parts[0];
    const safeFirst = first.length <= 2 ? `${first[0] || "C"}***` : `${first.slice(0, 2)}***`;
    const second = parts[1] ? ` ${parts[1][0]}***` : "";
    return `${safeFirst}${second}`;
  }

  function socialProofEnabled(tenantId: string) {
    return tenantHasFeature(tenantId, "realtime_social_proof");
  }

  function sanitizePublicActivityEvent(event: PublicActivityEventRecord) {
    return {
      id: event.id,
      raffle_id: event.raffle_id,
      event_type: event.event_type,
      display_name_masked: event.display_name_masked,
      amount: event.amount,
      quantity: event.quantity,
      metadata: {
        label: event.metadata?.label || "",
        prize: event.metadata?.prize || "",
        source: event.metadata?.source || ""
      },
      created_at: event.created_at
    };
  }

  function recordPublicActivityEvent(input: Omit<PublicActivityEventRecord, "id" | "display_name_masked" | "visible" | "created_at"> & { customer?: CustomerRecord; display_name_masked?: string; visible?: boolean }) {
    if (!socialProofEnabled(input.tenant_id)) return null;
    const orderId = typeof input.metadata?.orderId === "string" ? input.metadata.orderId : "";
    if (orderId && publicActivityEvents.some(event => event.tenant_id === input.tenant_id && event.raffle_id === input.raffle_id && event.event_type === input.event_type && event.metadata?.orderId === orderId)) {
      return null;
    }
    const event: PublicActivityEventRecord = {
      id: createPublicId("PAE_"),
      tenant_id: input.tenant_id,
      raffle_id: input.raffle_id,
      event_type: input.event_type,
      display_name_masked: input.display_name_masked || maskDisplayName(input.customer?.name),
      amount: Math.max(0, Number(input.amount || 0)),
      quantity: Math.max(0, Number(input.quantity || 0)),
      metadata: input.metadata || {},
      visible: input.visible !== false,
      created_at: new Date().toISOString()
    };
    publicActivityEvents.unshift(event);
    publicActivityEvents = publicActivityEvents.slice(0, 1000);
    return event;
  }

  function getPublicActivity(tenantId: string, raffleId: string) {
    if (!socialProofEnabled(tenantId)) return [];
    return publicActivityEvents
      .filter(event => event.tenant_id === tenantId && event.raffle_id === raffleId && event.visible)
      .slice(0, 20)
      .map(sanitizePublicActivityEvent);
  }

  function getPublicRanking(tenantId: string, raffleId: string) {
    if (!socialProofEnabled(tenantId)) return { enabled: false, top_buyers: [], weekly_buyers: [], monthly_buyers: [], top_affiliates: [], top_winners: [] };
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const safeBuyer = (item: { name: string; tickets: number; amount: number }) => ({ name: maskDisplayName(item.name), tickets: item.tickets, amount: item.amount });
    const byPeriod = (since: number) => purchases
      .filter(purchase => purchase.tenant_id === tenantId && purchase.raffleId === raffleId && purchase.status === "paid" && new Date(purchase.createdAt).getTime() >= since)
      .reduce<Record<string, { name: string; tickets: number; amount: number }>>((acc, purchase) => {
        const key = purchase.customer?.id || purchase.contact;
        acc[key] ||= { name: purchase.customer?.name || "Cliente", tickets: 0, amount: 0 };
        acc[key].tickets += purchase.tickets;
        acc[key].amount += purchase.amount;
        return acc;
      }, {});
    const winnerRows = gamificationWinners
      .filter(winner => winner.tenant_id === tenantId && winner.raffleId === raffleId)
      .slice(0, 5)
      .map(winner => {
        const purchase = purchases.find(item => item.tenant_id === tenantId && item.purchaseId === winner.purchaseId);
        return { name: maskDisplayName(purchase?.customer?.name), prize: winner.prize, value: winner.value };
      });
    const affiliateRows = Object.values(affiliates)
      .filter(affiliate => affiliate.tenant_id === tenantId)
      .sort((a, b) => b.conversions - a.conversions || b.revenue - a.revenue)
      .slice(0, 5)
      .map(affiliate => {
        const customer = Object.values(customersByPhone).find(item => item.tenant_id === tenantId && item.id === affiliate.customerId);
        return { name: maskDisplayName(customer?.name), conversions: affiliate.conversions, revenue: affiliate.revenue };
      });
    return {
      enabled: true,
      top_buyers: getBuyerRanking(tenantId, raffleId, "tickets", 10).map(safeBuyer),
      weekly_buyers: Object.values(byPeriod(weekAgo)).sort((a, b) => b.tickets - a.tickets).slice(0, 5).map(safeBuyer),
      monthly_buyers: Object.values(byPeriod(monthAgo)).sort((a, b) => b.tickets - a.tickets).slice(0, 5).map(safeBuyer),
      top_affiliates: affiliateRows,
      top_winners: winnerRows
    };
  }

  function getPublicScarcity(tenantId: string, raffleId: string) {
    const raffle = raffles.find(item => item.tenant_id === tenantId && item.id === raffleId);
    if (!raffle) return null;
    const now = Date.now();
    const paidPurchases = purchases.filter(item => item.tenant_id === tenantId && item.raffleId === raffleId && item.status === "paid");
    const recentPurchases = paidPurchases.filter(item => new Date(item.createdAt).getTime() >= now - 60 * 60 * 1000);
    const soldLastHour = recentPurchases.reduce((sum, item) => sum + item.tickets, 0);
    const remaining = Math.max(0, raffle.totalTickets - raffle.soldTickets);
    const velocityPerHour = Math.max(0, soldLastHour);
    const estimatedHours = velocityPerHour > 0 ? remaining / velocityPerHour : null;
    return {
      enabled: socialProofEnabled(tenantId),
      totalTickets: raffle.totalTickets,
      soldTickets: raffle.soldTickets,
      remainingTickets: remaining,
      progress: raffle.totalTickets ? Math.round((raffle.soldTickets / raffle.totalTickets) * 10000) / 100 : 0,
      soldLastHour,
      velocityPerHour,
      estimatedEndAt: estimatedHours ? new Date(now + estimatedHours * 60 * 60 * 1000).toISOString() : null,
      lastTicketsAlert: remaining > 0 && remaining <= Math.max(25, Math.ceil(raffle.totalTickets * 0.08)),
      viewersOnline: socialProofEnabled(tenantId) ? Math.max(7, Math.min(247, 12 + recentPurchases.length * 3 + Math.floor((raffle.soldTickets % 19) * 1.7))) : 0
    };
  }

  function addGamificationLog(tenantId: string, action: string, detail: string) {
    auditLogs.unshift({
      id: createPublicId("AUD_"),
      tenant_id: tenantId,
      action,
      method: "SYSTEM",
      path: "/gamification",
      status: 200,
      actor: "gamification",
      ip: "system",
      createdAt: new Date().toISOString(),
      detail
    });
  }

  function resolveNumberModesFromOfficialResult(officialResult: string, origemResultado = "Loteria", tenantId = legacyTenantId) {
    const clean = String(officialResult || "").replace(/\D/g, "").padStart(4, "0").slice(-4);
    const winners = (["dezena", "centena", "milhar"] as NumberModeId[]).map(mode => {
      const config = getNumberModeConfig(tenantId, mode);
      const number = clean.slice(-config.digits);
      config.resultNumber = number;
      config.status = "closed";
      const bet = numberModeBets.find(item => item.tenant_id === tenantId && item.mode === mode && item.number === number && item.status === "paid");
      const purchase = bet ? numberModePurchases.find(item => item.tenant_id === tenantId && item.id === bet.purchaseId) : undefined;
      const winner: NumberModeWinner = purchase
        ? { id: createPublicId("MW_"), tenant_id: tenantId, mode, number, prize: config.prize, origemResultado, customer: purchase.customer, purchaseId: purchase.id, createdAt: new Date().toISOString() }
        : { id: createPublicId("MW_"), tenant_id: tenantId, mode, number, prize: "Sem ganhador", origemResultado, createdAt: new Date().toISOString(), semGanhador: true };
      numberModeWinners.unshift(winner);
      return winner;
    });
    const fazendinha = resolveFazendinhaWinner(clean.slice(-2), origemResultado, tenantId);
    return { officialResult: clean, winners, fazendinha };
  }

  function resolveSingleNumberModeResult(mode: NumberModeId, resultNumber: string, origemResultado = "Loteria", tenantId = legacyTenantId) {
    const config = getNumberModeConfig(tenantId, mode);
    const number = normalizeModeResultNumber(mode, resultNumber, tenantId);
    if (!config || !number) return null;
    config.resultNumber = number;
    config.status = "closed";
    const bet = numberModeBets.find(item => item.tenant_id === tenantId && item.mode === mode && item.number === number && item.status === "paid");
    const purchase = bet ? numberModePurchases.find(item => item.tenant_id === tenantId && item.id === bet.purchaseId) : undefined;
    const createdAt = new Date().toISOString();
    const winner: NumberModeWinner = purchase
      ? { id: createPublicId("MW_"), tenant_id: tenantId, mode, number, prize: config.prize, origemResultado, customer: purchase.customer, purchaseId: purchase.id, createdAt }
      : { id: createPublicId("MW_"), tenant_id: tenantId, mode, number, prize: "Sem ganhador", origemResultado, createdAt, semGanhador: true };
    numberModeWinners.unshift(winner);
    return { mode, result: { mode, number, origemResultado, createdAt }, winner };
  }

  const TRADITIONAL_RAFFLE_RESERVATION_TTL_MS = Number(process.env.PURCHASE_RESERVATION_TTL_MS || 15 * 60 * 1000);
  const FAST_MODALITY_RESERVATION_TTL_MS = Number(process.env.FAST_MODALITY_RESERVATION_TTL_MS || 5 * 60 * 1000);
  const RESERVATION_TTL_MS = TRADITIONAL_RAFFLE_RESERVATION_TTL_MS;

  function reservationExpiresAt(ttlMs: number) {
    return new Date(Date.now() + ttlMs).toISOString();
  }

  function isPastReservationExpiry(value?: string) {
    return Boolean(value) && new Date(value || "").getTime() <= Date.now();
  }

  function normalizeOptionalIsoDate(value: unknown) {
    if (value === null || value === undefined || value === "") return "";
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function getRaffleSalesDeadline(raffle: typeof raffles[number]) {
    if (raffle.countdownEnabled !== true) return "";
    const candidates = [raffle.countdownEndAt, raffle.salesEndAt]
      .map(normalizeOptionalIsoDate)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return candidates[0] || "";
  }

  function isRaffleSalesExpired(raffle: typeof raffles[number], now = Date.now()) {
    const deadline = getRaffleSalesDeadline(raffle);
    return Boolean(deadline) && new Date(deadline).getTime() <= now;
  }

  function assertRaffleOpenForCheckout(raffle: typeof raffles[number]) {
    if (raffle.status !== "active") throw new Error("Rifa encerrada ou indisponivel");
    if (isRaffleSalesExpired(raffle)) throw new Error("Vendas encerradas pelo contador regressivo");
  }

  function normalizeRaffleCountdownPayload(input: Record<string, any>, current?: Partial<typeof raffles[number]>) {
    const countdownEnabled = input.countdownEnabled !== undefined ? Boolean(input.countdownEnabled) : Boolean(current?.countdownEnabled);
    const countdownEndAt = input.countdownEndAt !== undefined
      ? normalizeOptionalIsoDate(input.countdownEndAt)
      : normalizeOptionalIsoDate(current?.countdownEndAt);
    const salesEndAt = input.salesEndAt !== undefined
      ? normalizeOptionalIsoDate(input.salesEndAt)
      : normalizeOptionalIsoDate(current?.salesEndAt);
    return {
      countdownEnabled,
      countdownEndAt,
      salesEndAt
    };
  }

  function isFazendinhaReservationExpired(purchase: FazendinhaPurchase) {
    return purchase.statusPagamento === "cancelled" ||
      (purchase.statusPagamento === "reserved" && isPastReservationExpiry(purchase.reservedUntil || purchase.pixExpiresAt));
  }

  function publicPendingPaymentState() {
    return {
      paymentStatus: "pending" as const,
      paidAt: null,
      confirmedAt: null
    };
  }

  function releaseReservedNumbers(raffle: typeof raffles[number], numbers: number[]) {
    numbers.forEach(number => raffle.soldNumbers.delete(number));
    raffle.soldTickets = Math.max(0, raffle.soldNumbers.size);
  }

  function expirePendingReservations(tenantId?: string, raffleId?: string) {
    const now = Date.now();
    purchases
      .filter(purchase =>
        purchase.status === "pending" &&
        purchase.reservedUntil &&
        new Date(purchase.reservedUntil).getTime() <= now &&
        (!tenantId || purchase.tenant_id === tenantId) &&
        (!raffleId || purchase.raffleId === raffleId)
      )
      .forEach(purchase => {
        const raffle = raffles.find(item => item.tenant_id === purchase.tenant_id && item.id === purchase.raffleId);
        if (raffle && purchase.numeros.length) {
          releaseReservedNumbers(raffle, purchase.numeros);
        }
        purchase.status = "cancelled";
        purchase.rejectedReason = "Reserva expirada";
        purchase.paymentHistory = [
          ...(purchase.paymentHistory || []),
          { status: "cancelled", label: "Reserva expirada automaticamente", date: new Date().toISOString() }
        ];
      });
  }

  function expireNumberModeReservations(tenantId?: string, mode?: NumberModeId) {
    numberModePurchases
      .filter(purchase =>
        purchase.status === "reserved" &&
        isPastReservationExpiry(purchase.reservedUntil || purchase.pixExpiresAt) &&
        (!tenantId || purchase.tenant_id === tenantId) &&
        (!mode || purchase.mode === mode)
      )
      .forEach(purchase => {
        purchase.status = "cancelled";
        purchase.paymentStatus = "cancelled";
        numberModeBets = numberModeBets.filter(bet => !(bet.tenant_id === purchase.tenant_id && bet.purchaseId === purchase.id));
        auditLogs.unshift({
          id: createPublicId("AUD_"),
          tenant_id: purchase.tenant_id,
          action: "NUMBER_MODE_RESERVATION_EXPIRED",
          method: "SYSTEM",
          path: "/workers/reservations",
          status: 200,
          actor: "reservation-worker",
          ip: "system",
          createdAt: new Date().toISOString(),
          detail: `${purchase.mode}:${purchase.id}`
        });
      });
  }

  function expireFazendinhaReservations(tenantId?: string) {
    fazendinhaCompras
      .filter(purchase =>
        purchase.statusPagamento === "reserved" &&
        isPastReservationExpiry(purchase.reservedUntil || purchase.pixExpiresAt) &&
        (!tenantId || purchase.tenant_id === tenantId)
      )
      .forEach(purchase => {
        purchase.statusPagamento = "cancelled";
        purchase.paymentStatus = "cancelled";
        fazendinhaGroups
          .filter(group => group.tenant_id === purchase.tenant_id && group.compraId === purchase.id && group.status === "reserved")
          .forEach(group => {
            group.status = "available";
            delete group.compradorId;
            delete group.compraId;
          });
        auditLogs.unshift({
          id: createPublicId("AUD_"),
          tenant_id: purchase.tenant_id,
          action: "FAZENDINHA_RESERVATION_EXPIRED",
          method: "SYSTEM",
          path: "/workers/reservations",
          status: 200,
          actor: "reservation-worker",
          ip: "system",
          createdAt: new Date().toISOString(),
          detail: purchase.id
        });
      });
  }

  function expireAllReservations(tenantId?: string) {
    expirePendingReservations(tenantId);
    expireNumberModeReservations(tenantId);
    expireFazendinhaReservations(tenantId);
  }

  function assignAvailableNumbers(raffle: typeof raffles[number], quantity: number) {
    const remaining = raffle.totalTickets - raffle.soldTickets;
    if (quantity > remaining) {
      throw new Error("Quantidade indisponível");
    }

    const assignedNumbers: number[] = [];
    const picked = new Set<number>();
    const density = raffle.soldTickets / raffle.totalTickets;

    if (density < 0.75) {
      let attempts = 0;
      const maxAttempts = Math.max(quantity * 30, 100);
      while (assignedNumbers.length < quantity && attempts < maxAttempts) {
        const randNum = randomInt(1, raffle.totalTickets + 1);
        if (!raffle.soldNumbers.has(randNum) && !picked.has(randNum)) {
          picked.add(randNum);
          assignedNumbers.push(randNum);
        }
        attempts++;
      }
    }

    if (assignedNumbers.length < quantity) {
      const available: number[] = [];
      for (let n = 1; n <= raffle.totalTickets; n++) {
        if (!raffle.soldNumbers.has(n) && !picked.has(n)) {
          available.push(n);
        }
      }

      while (assignedNumbers.length < quantity) {
        const index = randomInt(0, available.length);
        const [value] = available.splice(index, 1);
        assignedNumbers.push(value);
      }
    }

    assignedNumbers.forEach(n => raffle.soldNumbers.add(n));
    raffle.soldTickets += assignedNumbers.length;
    return assignedNumbers;
  }

  function reserveAvailableNumbers(raffle: typeof raffles[number], quantity: number) {
    assertRaffleOpenForCheckout(raffle);
    expirePendingReservations(raffle.tenant_id, raffle.id);
    return assignAvailableNumbers(raffle, quantity);
  }

  function sanitizeRaffleForPublic(raffle: typeof raffles[number]) {
    const { soldNumbers, pixConfig, n8nEnabled, ...safeRaffle } = raffle;
    const salesDeadline = getRaffleSalesDeadline(raffle);
    const salesExpired = isRaffleSalesExpired(raffle);
    return {
      ...safeRaffle,
      salesDeadline,
      salesExpired,
      countdownLabel: salesDeadline
        ? salesExpired
          ? "Vendas encerradas"
          : (raffle.countdownLabel || `Vendas ate ${new Date(salesDeadline).toLocaleString("pt-BR")}`)
        : "",
      pixConfig: pixConfig ? {
        inheritGlobal: pixConfig.inheritGlobal,
        enabled: pixConfig.enabled,
        gateway: pixConfig.gateway,
        sandbox: pixConfig.sandbox
      } : undefined
    };
  }

  function sanitizeRaffleForAdmin(raffle: typeof raffles[number]) {
    const { soldNumbers, ...safeRaffle } = raffle;
    return {
      ...safeRaffle,
      salesDeadline: getRaffleSalesDeadline(raffle),
      salesExpired: isRaffleSalesExpired(raffle)
    };
  }

  // === API Routes ===

  app.get("/api/admin/integrations/global", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    res.json({
      providers: listProviderCatalog(),
      integrations: scoped(integrations, req).map(safeIntegration),
      defaults: {
        pix: integrations.find(item => item.tenant_id === tenantId && item.type === "pix" && item.status === "active")?.provider || "",
        email: integrations.find(item => item.tenant_id === tenantId && item.type === "email" && item.status === "active")?.provider || "",
        whatsapp: integrations.find(item => item.tenant_id === tenantId && item.type === "whatsapp" && item.status === "active")?.provider || ""
      }
    });
  });

  app.post("/api/admin/integrations/global", async (req, res) => {
    try {
      const base = normalizeIntegrationPayload(req);
      if (!tenantCanUseIntegration(base.tenant_id, base.provider)) {
        res.status(403).json({ error: `Plano atual nao libera a integracao ${base.provider}` });
        return;
      }
      const integration: IntegrationRecord = { id: createPublicId("INT_"), ...base };
      const validation = await integrationManager.execute(integration, "validateCredentials", {}, writeIntegrationLog);
      integration.last_error = validation.success ? "" : validation.error || "Credenciais invalidas";
      integration.status = validation.success && req.body.status === "active" ? "active" : validation.success ? integration.status : "error";
      integrations.unshift(integration);
      res.status(201).json(safeIntegration(integration));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Integracao invalida" });
    }
  });

  app.put("/api/admin/integrations/global/:id", async (req, res) => {
    const index = integrations.findIndex(item => item.id === req.params.id && adminCanAccessTenant(req, item.tenant_id));
    if (index < 0) {
      res.status(404).json({ error: "Integracao nao encontrada" });
      return;
    }
    try {
      const current = integrations[index];
      const next: IntegrationRecord = { ...current, ...normalizeIntegrationPayload(req, current), id: current.id };
      const validation = await integrationManager.execute(next, "validateCredentials", {}, writeIntegrationLog);
      next.last_error = validation.success ? "" : validation.error || "Credenciais invalidas";
      if (!validation.success && next.status === "active") next.status = "error";
      integrations[index] = next;
      res.json(safeIntegration(next));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Integracao invalida" });
    }
  });

  app.post("/api/admin/integrations/global/:id/test", async (req, res) => {
    const integration = findAdminIntegration(req, req.params.id);
    if (!integration) {
      res.status(404).json({ error: "Integracao nao encontrada" });
      return;
    }
    const result = await integrationManager.execute(integration, "getHealthStatus", {}, writeIntegrationLog);
    integration.last_sync_at = new Date().toISOString();
    integration.last_error = result.success ? "" : result.error || "Falha no teste";
    if (!result.success) integration.status = "error";
    res.status(result.statusCode || (result.success ? 200 : 500)).json(result);
  });

  app.post("/api/admin/integrations/global/:id/action/:action", async (req, res) => {
    const integration = findAdminIntegration(req, req.params.id);
    const action = req.params.action as keyof BaseProvider;
    if (!integration) {
      res.status(404).json({ error: "Integracao nao encontrada" });
      return;
    }
    if (!integrationActions.includes(action)) {
      res.status(400).json({ error: "Acao de integracao invalida" });
      return;
    }
    const result = await integrationManager.execute(integration, action, req.body || {}, writeIntegrationLog);
    integration.last_sync_at = new Date().toISOString();
    integration.last_error = result.success ? "" : result.error || "Falha na acao";
    res.status(result.statusCode || (result.success ? 200 : 500)).json(result);
  });

  app.get("/api/admin/integrations/global/logs", (req, res) => {
    res.json(scoped(integrationLogs, req));
  });

  app.post("/api/admin/integrations/global/webhook-endpoints", (req, res) => {
    const provider = String(req.body.provider || "") as IntegrationProviderId;
    if (!integrationProviderTypes[provider]) {
      res.status(400).json({ error: "Provider invalido" });
      return;
    }
    const endpoint: WebhookEndpointRecord = {
      id: createPublicId("WH_"),
      tenant_id: resolveRequestTenantId(req),
      provider,
      url: `/api/integrations/webhooks/${provider}`,
      secret: String(req.body.secret || randomUUID()),
      active: req.body.active !== false,
      created_at: new Date().toISOString()
    };
    endpoint.url = `/api/integrations/webhooks/${provider}/${endpoint.id}`;
    webhookEndpoints.unshift(endpoint);
    res.status(201).json({ ...endpoint, secret: endpoint.secret ? "********" : "" });
  });

  app.get("/api/admin/integrations/global/webhook-events", (req, res) => {
    res.json(scoped(webhookEvents, req));
  });

  app.post("/api/integrations/webhooks/:provider/:endpointId", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const provider = String(req.params.provider || "") as IntegrationProviderId;
    const endpoint = webhookEndpoints.find(item => item.id === req.params.endpointId && item.tenant_id === tenantId && item.provider === provider && item.active);
    if (!endpoint) {
      res.status(404).json({ error: "Webhook endpoint nao encontrado para este tenant" });
      return;
    }
    const catalog = providerCatalog[provider];
    const secretHeader = String(req.headers["x-webhook-secret"] || req.query.secret || "");
    const hmacHeader = String(req.headers["x-hub-signature-256"] || req.headers["x-signature"] || "");
    const rawBody = (req as express.Request & { rawBody?: string }).rawBody || JSON.stringify(req.body || {});
    const validSharedSecret = endpoint.secret && webhookService.validateSharedSecret(endpoint.secret, secretHeader);
    const validHmac = endpoint.secret && catalog?.webhookValidation === "hmac_sha256" && hmacHeader
      ? webhookService.validateHmac(endpoint.secret, rawBody, hmacHeader)
      : false;
    if (endpoint.secret && !validSharedSecret && !validHmac) {
      webhookEvents.unshift({
        id: createPublicId("WEV_"),
        tenant_id: tenantId,
        provider,
        event_type: String(req.body?.event_type || req.body?.type || "invalid_signature"),
        payload: {},
        processed: false,
        processed_at: "",
        error_message: "Assinatura/secret invalido",
        created_at: new Date().toISOString()
      });
      res.status(401).json({ error: "Webhook invalido" });
      return;
    }
    const event: WebhookEventRecord = {
      id: createPublicId("WEV_"),
      tenant_id: tenantId,
      provider,
      event_type: String(req.body?.event_type || req.body?.type || "webhook.received"),
      payload: req.body || {},
      processed: false,
      processed_at: "",
      error_message: "",
      created_at: new Date().toISOString()
    };
    webhookEvents.unshift(event);
    const integration = integrations.find(item => item.tenant_id === tenantId && item.provider === provider && item.status === "active");
    if (integration) {
      const result = await integrationManager.execute(integration, "processWebhook", req.body || {}, writeIntegrationLog);
      event.processed = result.success;
      event.processed_at = new Date().toISOString();
      event.error_message = result.error || "";
    }
    res.json({ success: true, eventId: event.id, processed: event.processed });
  });
  
  app.get("/api/stories", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    res.json(stories.filter(s => s.tenant_id === tenantId && s.active));
  });

  app.get("/api/winners", (req, res) => {
    res.json(winners.filter(item => item.tenant_id === resolveRequestTenantId(req)));
  });

  app.get("/api/transparency", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const paidPurchases = purchases.filter(item => item.tenant_id === tenantId && item.status === "paid");
    const tenantRaffles = raffles.filter(item => item.tenant_id === tenantId);
    const tenantWinners = winners.filter(item => item.tenant_id === tenantId);
    const tenantPrizes = instantPrizes.filter(item => item.tenant_id === tenantId);
    res.json({
      generatedAt: new Date().toISOString(),
      totals: {
        raffles: tenantRaffles.length,
        activeRaffles: tenantRaffles.filter(item => item.status === "active").length,
        paidPurchases: paidPurchases.length,
        paidTickets: paidPurchases.reduce((sum, item) => sum + item.tickets, 0),
        winners: tenantWinners.length,
        instantPrizesClaimed: tenantPrizes.filter(item => item.status === "claimed").length
      },
      raffles: tenantRaffles.map(raffle => ({
        id: raffle.id,
        title: raffle.title,
        status: raffle.status,
        drawDate: raffle.drawDate,
        soldTickets: raffle.soldTickets,
        totalTickets: raffle.totalTickets,
        progress: raffle.totalTickets ? Math.round((raffle.soldTickets / raffle.totalTickets) * 10000) / 100 : 0
      })),
      winners: tenantWinners,
      instantPrizes: tenantPrizes.map(prize => ({
        id: prize.id,
        raffleId: prize.raffleId,
        numeroPremiado: prize.numeroPremiado,
        valorPremio: prize.valorPremio,
        status: prize.status
      }))
    });
  });

  app.get("/api/raffles", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const tenant = tenants.find(item => item.id === tenantId);
    const tenantRaffles = raffles.filter(raffle => raffle.tenant_id === tenantId);
    const activeTenantRaffles = tenantRaffles.filter(raffle => raffle.status === "active");
    if (isProductionRuntime && activeTenantRaffles.length === 0) {
      const reason = tenantRaffles.length === 0 ? "no_raffles_for_tenant" : "no_active_raffles_for_tenant";
      console.warn(`[public-raffles] tenant=${tenant?.slug || tenantId} reason=${reason}`);
    }
    res.json(activeTenantRaffles.map(sanitizeRaffleForPublic));
  });

  app.get("/api/raffles/:id", (req, res) => {
    const raffle = raffles.find(r => r.tenant_id === resolveRequestTenantId(req) && r.id === req.params.id);
    if (!raffle) {
       res.status(404).json({ error: "Raffle not found" });
       return;
    }
    res.json(sanitizeRaffleForPublic(raffle));
  });

  app.get("/api/raffles/:id/ranking", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const config = getGamificationConfig(tenantId, req.params.id);
    res.json(getBuyerRanking(tenantId, req.params.id, config.buyerRanking.metric, config.buyerRanking.limit));
  });

  app.get("/api/public/raffles/:raffleId/activity", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const raffle = raffles.find(item => item.tenant_id === tenantId && item.id === req.params.raffleId);
    if (!raffle) {
      res.status(404).json({ error: "Raffle not found" });
      return;
    }
    res.setHeader("Cache-Control", "private, max-age=8");
    res.json({ enabled: socialProofEnabled(tenantId), events: getPublicActivity(tenantId, raffle.id) });
  });

  app.get("/api/public/raffles/:raffleId/ranking", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const raffle = raffles.find(item => item.tenant_id === tenantId && item.id === req.params.raffleId);
    if (!raffle) {
      res.status(404).json({ error: "Raffle not found" });
      return;
    }
    res.setHeader("Cache-Control", "private, max-age=15");
    res.json(getPublicRanking(tenantId, raffle.id));
  });

  app.get("/api/public/raffles/:raffleId/scarcity", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const scarcity = getPublicScarcity(tenantId, req.params.raffleId);
    if (!scarcity) {
      res.status(404).json({ error: "Raffle not found" });
      return;
    }
    res.setHeader("Cache-Control", "private, max-age=10");
    res.json(scarcity);
  });

  app.get("/api/raffles/:id/gamification", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const raffle = raffles.find(r => r.tenant_id === tenantId && r.id === req.params.id);
    if (!raffle) {
      res.status(404).json({ error: "Raffle not found" });
      return;
    }
    const config = getGamificationConfig(tenantId, raffle.id);
    const ranking = config.modules.buyerRanking && config.buyerRanking.visible
      ? getBuyerRanking(tenantId, raffle.id, config.buyerRanking.metric, config.buyerRanking.limit)
      : [];
    const now = Date.now();
    res.json({
      raffleId: raffle.id,
      modules: config.modules,
      scratchcard: config.modules.scratchcard ? { enabled: true } : { enabled: false },
      luckyHour: {
        enabled: config.modules.luckyHour,
        active: Boolean(getActiveLuckyHour(config)),
        windows: config.luckyHour.windows.filter(window => window.active)
      },
      mysteryBox: config.modules.mysteryBox ? { enabled: true, boxes: config.mysteryBox.boxes.map(box => ({ id: box.id, label: box.label, status: box.status })) } : { enabled: false, boxes: [] },
      doubleTickets: {
        enabled: config.modules.doubleTickets,
        active: config.modules.doubleTickets && isWithinWindow(now, config.doubleTickets.startsAt, config.doubleTickets.endsAt),
        minTickets: config.doubleTickets.minTickets,
        maxUsesPerCustomer: config.doubleTickets.maxUsesPerCustomer,
        packageQuantities: config.doubleTickets.packageQuantities,
        label: config.doubleTickets.label
      },
      doubleChance: {
        enabled: config.modules.doubleChance,
        active: config.modules.doubleChance && isWithinWindow(now, config.doubleChance.startsAt, config.doubleChance.endsAt),
        weight: config.doubleChance.weight
      },
      orderBump: getActiveOrderBump(config),
      ranking
    });
  });

  app.post("/api/gamification/scratchcards/:eventId/reveal", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const event = gamificationEvents.find(item => item.tenant_id === tenantId && item.id === req.params.eventId && item.module === "scratchcard");
    if (!event) {
      res.status(404).json({ error: "Raspadinha nao encontrada" });
      return;
    }
    if (event.status !== "available") {
      res.status(409).json({ error: "Raspadinha ja utilizada", event });
      return;
    }
    const config = getGamificationConfig(tenantId, event.raffleId);
    if (!config.modules.scratchcard) {
      res.status(403).json({ error: "Raspadinha desativada" });
      return;
    }
    const wins = Math.random() * 100 < config.scratchcard.winProbability;
    const availablePrizes = config.scratchcard.prizes.filter(prize => prize.type !== "empty" && prize.stock > 0);
    const prize = wins && availablePrizes.length
      ? availablePrizes.sort((a, b) => (b.probability || 0) - (a.probability || 0))[0]
      : null;
    const now = new Date().toISOString();
    if (prize) {
      prize.stock -= 1;
      event.status = "won";
      event.result = { prize: prize.name, value: prize.value, type: prize.type };
      gamificationWinners.push({ tenant_id: tenantId, id: createPublicId("GWIN_"), raffleId: event.raffleId, purchaseId: event.purchaseId, customerId: event.customerId, module: "scratchcard", prize: prize.name, value: prize.value, createdAt: now });
    } else {
      event.status = "lost";
      event.result = { prize: "Nao foi dessa vez", value: 0, type: "empty" };
    }
    event.resolvedAt = now;
    addGamificationLog(tenantId, "SCRATCHCARD_REVEALED", `${event.id}:${event.status}`);
    res.json({ event, winner: prize ? event.result : null });
  });

  app.post("/api/gamification/mystery-boxes/:eventId/open", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const event = gamificationEvents.find(item => item.tenant_id === tenantId && item.id === req.params.eventId && item.module === "mysteryBox");
    if (!event) {
      res.status(404).json({ error: "Caixinha nao encontrada" });
      return;
    }
    if (event.status !== "available") {
      res.status(409).json({ error: "Caixinha ja aberta", event });
      return;
    }
    const config = getGamificationConfig(tenantId, event.raffleId);
    if (!config.modules.mysteryBox) {
      res.status(403).json({ error: "Caixinha desativada" });
      return;
    }
    const requestedBoxId = String(req.body.boxId || "");
    const box = config.mysteryBox.boxes.find(item => item.id === requestedBoxId && item.status === "available") || config.mysteryBox.boxes.find(item => item.status === "available");
    if (!box) {
      res.status(409).json({ error: "Sem caixinhas disponiveis" });
      return;
    }
    box.status = "opened";
    const now = new Date().toISOString();
    event.status = "opened";
    event.result = { boxId: box.id, label: box.label, prize: box.prize || "Vazio", type: box.type, value: box.value };
    event.resolvedAt = now;
    if (box.type !== "empty" && box.value > 0) {
      gamificationWinners.push({ tenant_id: tenantId, id: createPublicId("GWIN_"), raffleId: event.raffleId, purchaseId: event.purchaseId, customerId: event.customerId, module: "mysteryBox", prize: box.prize || box.label, value: box.value, createdAt: now });
    }
    addGamificationLog(tenantId, "MYSTERY_BOX_OPENED", `${event.id}:${box.id}`);
    res.json({ event, box: event.result });
  });

  app.get("/api/raffles/:id/instant-prizes", (req, res) => {
    res.json(
      instantPrizes
        .filter(p => p.tenant_id === resolveRequestTenantId(req) && p.raffleId === req.params.id)
        .map(p => ({
          id: p.id,
          numeroPremiado: p.numeroPremiado,
          valorPremio: p.valorPremio,
          status: p.status
        }))
    );
  });

  app.get("/api/customers/by-phone/:phone", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const customer = findCustomerByPhone(phone, resolveRequestTenantId(req));
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    if (!requestOwnsCustomer(req, customer)) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    const affiliate = getAffiliateForCustomer(customer);
    res.json(stripSensitiveCustomerFields({ ...customer, affiliate: publicAffiliateView(affiliate) }));
  });

  app.post("/api/customers/:id/photo", express.raw({ type: "*/*", limit: "20mb" }), async (req, res) => {
    const customer = Object.values(customersByPhone).find(c => c.tenant_id === resolveRequestTenantId(req) && c.id === req.params.id);
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    if (!requestOwnsCustomer(req, customer)) {
      res.status(403).json({ error: "Acesso negado para este cliente" });
      return;
    }

    const fileName = String(req.headers["x-file-name"] || "perfil").replace(/[^\w.\-]+/g, "-");
    const contentType = String(req.headers["content-type"] || "");
    const ext = path.extname(fileName).toLowerCase();
    const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
    const allowedMime = /^(image\/(jpeg|png|gif|webp)|application\/octet-stream)/i;

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "Arquivo vazio" });
      return;
    }
    if (req.body.length > 20 * 1024 * 1024) {
      res.status(413).json({ error: "A foto deve ter até 20MB" });
      return;
    }
    if (!allowedExtensions.has(ext) || !allowedMime.test(contentType)) {
      res.status(415).json({ error: "Formato não suportado. Use JPG, PNG, GIF ou WEBP." });
      return;
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const storedFileName = `${Date.now()}-${randomUUID()}${ext}`;
    await writeFile(path.join(uploadsDir, storedFileName), req.body);
    customer.photoUrl = `/uploads/${storedFileName}`;

    res.json(stripSensitiveCustomerFields({
      success: true,
      mediaUrl: customer.photoUrl,
      mediaType: "image",
      customer: { ...customer, affiliate: publicAffiliateView(getAffiliateForCustomer(customer)) }
    }));
  });

  app.put("/api/customers/:id", (req, res) => {
    const customer = Object.values(customersByPhone).find(c => c.tenant_id === resolveRequestTenantId(req) && c.id === req.params.id);
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    if (!requestOwnsCustomer(req, customer)) {
      res.status(403).json({ error: "Acesso negado para este cliente" });
      return;
    }
    const oldPhone = customer.phone;
    customer.name = req.body.name ?? customer.name;
    customer.phone = normalizePhone(req.body.phone || customer.phone);
    customer.photoUrl = req.body.photoUrl ?? customer.photoUrl;
    customer.city = req.body.city ?? customer.city;
    customer.state = req.body.state ?? customer.state;
    if (req.body.accessPassword !== undefined || req.body.password !== undefined) {
      const accessPassword = normalizeAccessPassword(req.body.accessPassword || req.body.password);
      if (!accessPassword) {
        res.status(400).json({ error: "Senha deve ter 6 dígitos" });
        return;
      }
      customer.accessPassword = accessPassword;
    }
    if (oldPhone !== customer.phone) delete customersByPhone[tenantCustomerKey(customer.tenant_id, oldPhone)];
    customersByPhone[tenantCustomerKey(customer.tenant_id, customer.phone)] = customer;
    res.json(stripSensitiveCustomerFields({ ...customer, affiliate: publicAffiliateView(getAffiliateForCustomer(customer)) }));
  });

  app.get("/api/customers/:id/purchases", (req, res) => {
    const customer = Object.values(customersByPhone).find(c => c.tenant_id === resolveRequestTenantId(req) && c.id === req.params.id);
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    if (!requestOwnsCustomer(req, customer)) {
      res.status(403).json({ error: "Acesso negado para este cliente" });
      return;
    }
    const traditional = purchases.filter(p => p.tenant_id === customer.tenant_id && (p.customer?.id === customer.id || p.contact === customer.phone) && p.status === "paid");
    const fazendinha = fazendinhaCompras
      .filter(p => p.tenant_id === customer.tenant_id && p.usuarioId === customer.id && p.statusPagamento === "paid")
      .map(p => ({
        purchaseId: p.id,
        raffleId: "fazendinha",
        raffleTitle: "A Fazendinha",
        contact: customer.phone,
        tickets: p.numeros.length,
        numeros: p.numeros,
        amount: p.valorPago,
        status: p.statusPagamento === "paid" ? "paid" : "pending",
        pixPayload: "",
        createdAt: p.dataCompra,
        customer,
      }));
    const modalidades = numberModePurchases
      .filter(p => p.tenant_id === customer.tenant_id && p.customer.id === customer.id && p.status === "paid")
      .map(p => ({
        purchaseId: p.id,
        raffleId: p.mode,
        raffleTitle: p.mode.toUpperCase(),
        contact: customer.phone,
        tickets: p.numbers.length,
        numeros: p.numbers,
        amount: p.amount,
        status: p.status === "paid" ? "paid" : "pending",
        pixPayload: "",
        createdAt: p.createdAt,
        customer,
      }));
    res.json(stripSensitiveCustomerFields([...traditional, ...fazendinha, ...modalidades].sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
  });

  app.get("/api/customers/:id/messages", (req, res) => {
    const customer = Object.values(customersByPhone).find(c => c.tenant_id === resolveRequestTenantId(req) && c.id === req.params.id);
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    if (!requestOwnsCustomer(req, customer)) {
      res.status(403).json({ error: "Acesso negado para este cliente" });
      return;
    }
    res.json(customerMessages
      .filter(message => message.tenant_id === customer.tenant_id && (message.target === "all" || message.customerId === customer.id))
      .map(message => ({ ...message, read: message.readBy.includes(customer.id) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  app.post("/api/customers/:id/messages/:messageId/read", (req, res) => {
    const customer = Object.values(customersByPhone).find(c => c.tenant_id === resolveRequestTenantId(req) && c.id === req.params.id);
    const message = customerMessages.find(item => item.tenant_id === resolveRequestTenantId(req) && item.id === req.params.messageId);
    if (!customer || !message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    if (!requestOwnsCustomer(req, customer)) {
      res.status(403).json({ error: "Acesso negado para este cliente" });
      return;
    }
    if (message.target !== "all" && message.customerId !== customer.id) {
      res.status(403).json({ error: "Mensagem nao destinada a este cliente" });
      return;
    }
    if (!message.readBy.includes(customer.id)) message.readBy.push(customer.id);
    res.json({ ...message, read: true });
  });

  app.post("/api/customers/password-reset/request", (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const tenantId = resolveRequestTenantId(req);
    const customer = findCustomerByPhone(phone, tenantId);
    if (!phone || phone.length < 10 || !customer) {
      res.status(404).json({ error: "Cliente nao encontrado para este telefone" });
      return;
    }
    const code = String(randomInt(100000, 999999));
    const reset: PasswordResetCode = {
      id: createPublicId("SMS_"),
      tenant_id: tenantId,
      phone,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      used: false
    };
    passwordResetCodes.unshift(reset);
    console.log(`[SMS SIMULADO] Codigo de redefinicao para ${phone}: ${code}`);
    res.json({
      success: true,
      message: "Codigo de redefinicao enviado por SMS.",
      resetId: reset.id,
      devCode: process.env.NODE_ENV === "production" ? undefined : code
    });
  });

  app.post("/api/customers/password-reset/confirm", (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const code = String(req.body.code || "").replace(/\D/g, "");
    const newPassword = normalizeAccessPassword(req.body.accessPassword || req.body.password);
    const tenantId = resolveRequestTenantId(req);
    const reset = passwordResetCodes.find(item => item.tenant_id === tenantId && item.phone === phone && item.code === code && !item.used);
    const customer = findCustomerByPhone(phone, tenantId);
    if (!customer || !reset || new Date(reset.expiresAt).getTime() < Date.now()) {
      res.status(400).json({ error: "Codigo invalido ou expirado" });
      return;
    }
    if (!newPassword) {
      res.status(400).json({ error: "Nova senha deve ter 6 digitos" });
      return;
    }
    reset.used = true;
    customer.accessPassword = newPassword;
    notifyCustomer(customer, "Senha redefinida com sucesso", "Sua senha de acesso foi alterada por verificacao via SMS.");
    res.json(stripSensitiveCustomerFields({ success: true, customer }));
  });

  app.post("/api/integrations/n8n/inbound", (req, res) => {
    const secret = settings.n8nIntegration?.secret || "";
    const receivedSecret = String(req.headers["x-cifher-secret"] || req.headers["x-rifapro-secret"] || req.body.secret || "");
    if (secret && receivedSecret !== secret) {
      res.status(401).json({ error: "Secret inválido" });
      return;
    }
    auditLogs.unshift({
      id: createPublicId("AUD_"),
      tenant_id: resolveRequestTenantId(req),
      action: `N8N_INBOUND_${String(req.body.event || "EVENT").toUpperCase()}`,
      method: req.method,
      path: req.originalUrl || req.url,
      status: 200,
      actor: "n8n",
      ip: String(req.ip || req.socket.remoteAddress || ""),
      createdAt: new Date().toISOString(),
      detail: String(req.body.message || req.body.status || "")
    });
    res.json({ success: true, receivedAt: new Date().toISOString() });
  });

  app.get("/api/support/tickets", (req, res) => {
    const customerId = String(req.query.customerId || "");
    const tenantId = resolveRequestTenantId(req);
    const customer = customerId ? Object.values(customersByPhone).find(item => item.tenant_id === tenantId && item.id === customerId) : undefined;
    if (!customer || !requestOwnsCustomer(req, customer)) {
      res.status(403).json({ error: "Acesso negado ao suporte deste cliente" });
      return;
    }
    res.json(supportTickets
      .filter(ticket => ticket.tenant_id === tenantId && (ticket.customerId === customer.id || ticket.customerPhone === customer.phone))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  });

  app.post("/api/support/tickets", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const customer = req.body.customerId ? Object.values(customersByPhone).find(item => item.tenant_id === tenantId && item.id === req.body.customerId) : undefined;
    if (customer && !requestOwnsCustomer(req, customer)) {
      res.status(403).json({ error: "Acesso negado ao suporte deste cliente" });
      return;
    }
    const customerPhone = normalizePhone(req.body.phone || customer?.phone);
    const customerName = String(req.body.name || customer?.name || "").trim();
    const body = String(req.body.message || req.body.body || "").trim();
    if (!customerPhone || customerPhone.length < 10 || !customerName || !body) {
      res.status(400).json({ error: "Nome, telefone e mensagem sao obrigatorios" });
      return;
    }
    const now = new Date().toISOString();
    const ticket: SupportTicket = {
      id: createPublicId("SUP_"),
      tenant_id: tenantId,
      accessToken: customer ? undefined : randomUUID(),
      customerId: customer?.id,
      customerName,
      customerPhone,
      status: "open",
      createdAt: now,
      updatedAt: now,
      messages: [
        { id: createPublicId("SUPM_"), sender: "customer", body, createdAt: now, readByAdmin: false, readByCustomer: true },
        { id: createPublicId("SUPM_"), sender: "bot", body: "Recebemos sua mensagem. Um atendente vai responder por aqui em breve.", createdAt: now, readByAdmin: true, readByCustomer: false }
      ]
    };
    supportTickets.unshift(ticket);
    res.json(ticket);
  });

  app.post("/api/support/tickets/:id/messages", (req, res) => {
    const ticket = supportTickets.find(item => item.tenant_id === resolveRequestTenantId(req) && item.id === req.params.id);
    if (!ticket) {
      res.status(404).json({ error: "Atendimento nao encontrado" });
      return;
    }
    const customer = ticket.customerId ? Object.values(customersByPhone).find(item => item.id === ticket.customerId) : undefined;
    if (customer && !requestOwnsCustomer(req, customer)) {
      res.status(403).json({ error: "Acesso negado ao suporte deste cliente" });
      return;
    }
    if (!customer && String(req.headers["x-support-token"] || "") !== ticket.accessToken) {
      res.status(403).json({ error: "Acesso negado ao atendimento" });
      return;
    }
    const body = String(req.body.message || req.body.body || "").trim();
    if (!body) {
      res.status(400).json({ error: "Mensagem obrigatoria" });
      return;
    }
    const now = new Date().toISOString();
    ticket.messages.push({ id: createPublicId("SUPM_"), sender: "customer", body, createdAt: now, readByAdmin: false, readByCustomer: true });
    ticket.status = "open";
    ticket.updatedAt = now;
    res.json(ticket);
  });

  app.get("/api/admin/customers", (req, res) => {
    const customers = Object.values(customersByPhone).filter(customer => adminCanAccessTenant(req, customer.tenant_id)).map(buildAdminCustomerProfile);
    res.json(customers);
  });

  app.get("/api/admin/crm", (req, res) => {
    const contacts = listCrmContacts(req);
    const segments = buildCrmSegments(contacts);
    res.json({
      contacts,
      pipeline: buildCrmPipeline(contacts),
      segments,
      metrics: {
        total: contacts.length,
        leads: contacts.filter(contact => contact.status === "lead").length,
        compradores: contacts.filter(contact => contact.status === "comprador").length,
        vips: contacts.filter(contact => contact.status === "vip").length,
        inativos: contacts.filter(contact => contact.status === "inativo").length,
        receita: Number(contacts.reduce((sum, contact) => sum + Number(contact.total_spent || 0), 0).toFixed(2))
      }
    });
  });

  app.get("/api/admin/crm/customers", (req, res) => {
    if (!requestHasAdminSession(req)) {
      res.status(403).json({ error: "Acesso administrativo obrigatorio" });
      return;
    }
    const customers = buildCrmBuyerCustomers(req);
    const segmentCounts = buildCrmBuyerSegmentCounts(customers);
    const filtered = sortCrmBuyerCustomers(
      filterCrmBuyerCustomers(customers, {
        search: String(req.query.search || ""),
        segment: String(req.query.segment || "")
      }),
      String(req.query.sortBy || "lastPurchaseAt"),
      String(req.query.sortDir || "desc")
    );
    const requestedLimit = Number.parseInt(String(req.query.limit || ""), 10);
    const limit = Math.min(MAX_CRM_CUSTOMERS_LIMIT, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : DEFAULT_CRM_CUSTOMERS_LIMIT));
    const requestedPage = Number.parseInt(String(req.query.page || ""), 10);
    const page = Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1);
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);
    res.json({
      customers: paginated,
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1
      },
      segmentCounts,
      metrics: {
        total: customers.length,
        totalComprado: Number(customers.reduce((sum, customer) => sum + Number(customer.totalComprado || 0), 0).toFixed(2)),
        compras: customers.reduce((sum, customer) => sum + Number(customer.quantidadeCompras || 0), 0),
        pixPendente: segmentCounts.pix_pending,
        vip: segmentCounts.vip,
        recorrentes: segmentCounts.recurring
      }
    });
  });

  app.get("/api/admin/crm/contacts", (req, res) => {
    const query = String(req.query.q || "").toLowerCase().trim();
    const status = String(req.query.status || "");
    const tag = String(req.query.tag || "");
    const segment = String(req.query.segment || "");
    const contacts = listCrmContacts(req).filter(contact => {
      const text = `${contact.nome} ${contact.telefone} ${contact.email || ""} ${contact.cpf_mascarado} ${contact.cidade || ""} ${contact.estado || ""} ${contact.origem} ${contact.tags.join(" ")}`.toLowerCase();
      if (query && !text.includes(query) && !contact.telefone.replace(/\D/g, "").includes(query.replace(/\D/g, ""))) return false;
      if (status && contact.status !== status) return false;
      if (tag && !contact.tags.includes(tag)) return false;
      if (segment === "inactive" && contact.status !== "inativo") return false;
      if (segment === "recurring" && contact.total_orders < 2) return false;
      if (segment === "high-ticket" && contact.total_spent < 500) return false;
      if (segment === "vip" && contact.status !== "vip") return false;
      return true;
    });
    res.json(contacts.sort((a, b) => Number(b.score || 0) - Number(a.score || 0)));
  });

  app.post("/api/admin/crm/contacts", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const nome = String(req.body.nome || req.body.name || "").trim();
    const telefone = normalizePhone(req.body.telefone || req.body.phone || "");
    if (nome.length < 2 || telefone.length < 10) return res.status(400).json({ error: "Nome e telefone validos sao obrigatorios" });
    const now = new Date().toISOString();
    const contact: CrmContactRecord = {
      id: createPublicId("CRM_"),
      tenant_id: tenantId,
      customer_id: req.body.customer_id ? String(req.body.customer_id) : undefined,
      nome,
      telefone,
      email: String(req.body.email || ""),
      cpf_mascarado: maskCpfForCrm(String(req.body.cpf || "")),
      cidade: String(req.body.cidade || req.body.city || ""),
      estado: String(req.body.estado || req.body.state || ""),
      origem: String(req.body.origem || req.body.source || "manual"),
      tags: Array.isArray(req.body.tags) ? req.body.tags.map(String) : [],
      score: Number(req.body.score || 0),
      status: ["lead", "comprador", "vip", "inativo", "bloqueado"].includes(String(req.body.status)) ? req.body.status : "lead",
      pipeline_stage: ["novo lead", "interessado", "comprou", "recorrente", "vip", "inativo", "perdido"].includes(String(req.body.pipeline_stage)) ? req.body.pipeline_stage : "novo lead",
      last_purchase_at: "",
      total_spent: 0,
      total_orders: 0,
      notes: String(req.body.notes || ""),
      created_at: now,
      updated_at: now
    };
    crmContacts.unshift(contact);
    recordAuditLedger(req, { tenant_id: tenantId, action: "CRM_CONTACT_CREATED", resource_type: "crm_contact", resource_id: contact.id, before_data: null, after_data: buildCrmContact(contact), reason: String(req.body.reason || "Criacao de contato CRM") });
    res.status(201).json(buildCrmContact(contact));
  });

  app.get("/api/admin/crm/contacts/:id", (req, res) => {
    const contact = listCrmContacts(req).find(item => item.id === req.params.id);
    if (!contact) return res.status(404).json({ error: "Contato CRM nao encontrado" });
    res.json({ contact, history: buildCrmContactHistory(contact, req) });
  });

  app.put("/api/admin/crm/contacts/:id", (req, res) => {
    const current = listCrmContacts(req).find(item => item.id === req.params.id);
    if (!current) return res.status(404).json({ error: "Contato CRM nao encontrado" });
    const before = deepClone(current);
    const reason = String(req.body.reason || "Atualizacao de contato CRM");
    if (current.customer_id) {
      crmContactOverrides[current.id] = {
        ...(crmContactOverrides[current.id] || {}),
        email: req.body.email !== undefined ? String(req.body.email) : crmContactOverrides[current.id]?.email,
        origem: req.body.origem !== undefined ? String(req.body.origem) : crmContactOverrides[current.id]?.origem,
        tags: Array.isArray(req.body.tags) ? req.body.tags.map(String) : crmContactOverrides[current.id]?.tags,
        score: req.body.score !== undefined ? Number(req.body.score) : crmContactOverrides[current.id]?.score,
        status: req.body.status || crmContactOverrides[current.id]?.status,
        pipeline_stage: req.body.pipeline_stage || crmContactOverrides[current.id]?.pipeline_stage,
        notes: req.body.notes !== undefined ? String(req.body.notes) : crmContactOverrides[current.id]?.notes,
        updated_at: new Date().toISOString()
      };
      const after = listCrmContacts(req).find(item => item.id === current.id)!;
      recordAuditLedger(req, { tenant_id: current.tenant_id, action: "CRM_CONTACT_UPDATED", resource_type: "crm_contact", resource_id: current.id, before_data: before, after_data: after, reason });
      return res.json(after);
    }
    const index = crmContacts.findIndex(item => item.id === current.id && adminCanAccessTenant(req, item.tenant_id));
    crmContacts[index] = { ...crmContacts[index], ...req.body, id: crmContacts[index].id, tenant_id: crmContacts[index].tenant_id, updated_at: new Date().toISOString() };
    const after = buildCrmContact(crmContacts[index]);
    recordAuditLedger(req, { tenant_id: current.tenant_id, action: "CRM_CONTACT_UPDATED", resource_type: "crm_contact", resource_id: current.id, before_data: before, after_data: after, reason });
    res.json(after);
  });

  app.post("/api/admin/crm/contacts/:id/notes", (req, res) => {
    const current = listCrmContacts(req).find(item => item.id === req.params.id);
    if (!current) return res.status(404).json({ error: "Contato CRM nao encontrado" });
    const note = String(req.body.note || req.body.notes || "").trim();
    if (!note) return res.status(400).json({ error: "Nota obrigatoria" });
    const notes = [current.notes, note].filter(Boolean).join("\n---\n");
    req.body.notes = notes;
    req.body.reason = req.body.reason || "Nota interna CRM";
    const before = deepClone(current);
    crmContactOverrides[current.id] = { ...(crmContactOverrides[current.id] || {}), notes, updated_at: new Date().toISOString() };
    const after = listCrmContacts(req).find(item => item.id === current.id)!;
    recordAuditLedger(req, { tenant_id: current.tenant_id, action: "CRM_CONTACT_NOTE_ADDED", resource_type: "crm_contact", resource_id: current.id, before_data: before, after_data: after, reason: String(req.body.reason) });
    res.json(after);
  });

  app.get("/api/admin/crm/pipeline", (req, res) => {
    res.json(buildCrmPipeline(listCrmContacts(req)));
  });

  app.get("/api/admin/crm/segments", (req, res) => {
    res.json(buildCrmSegments(listCrmContacts(req)));
  });

  app.get("/api/admin/crm/export.csv", (req, res) => {
    const contacts = listCrmContacts(req);
    const rows = [
      ["nome", "telefone", "email", "cpf_mascarado", "cidade", "estado", "origem", "tags", "score", "status", "pipeline", "last_purchase_at", "total_spent", "total_orders"],
      ...contacts.map(contact => [contact.nome, contact.telefone, contact.email || "", contact.cpf_mascarado, contact.cidade || "", contact.estado || "", contact.origem, contact.tags.join("|"), String(contact.score), contact.status, contact.pipeline_stage, contact.last_purchase_at || "", String(contact.total_spent), String(contact.total_orders)])
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=crm-contatos.csv");
    res.send(rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n"));
  });

  app.get("/api/admin/messages", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    res.json(scoped(customerMessages, req).map(message => ({
      ...message,
      deliveredTo: message.target === "customer" ? 1 : Object.values(customersByPhone).filter(customer => customer.tenant_id === tenantId).length,
      readCount: message.readBy.length,
      raffleTitle: message.raffleId ? raffles.find(raffle => raffle.id === message.raffleId)?.title : undefined
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  app.post("/api/admin/messages", (req, res) => {
    const title = String(req.body.title || "").trim();
    const body = String(req.body.body || "").trim();
    const raffleId = String(req.body.raffleId || "");
    if (!title || !body) {
      res.status(400).json({ error: "Titulo e mensagem sao obrigatorios" });
      return;
    }
    const tenantId = resolveRequestTenantId(req);
    const raffle = raffleId ? raffles.find(item => item.tenant_id === tenantId && item.id === raffleId) : undefined;
    const message: CustomerMessage = {
      id: createPublicId("MSG_"),
      tenant_id: tenantId,
      title,
      body,
      type: req.body.type === "promotion" ? "promotion" : "notice",
      raffleId: raffle?.id,
      mediaUrl: req.body.mediaUrl || "",
      mediaType: req.body.mediaType || undefined,
      videoConfig: req.body.videoConfig,
      ctaLabel: req.body.ctaLabel || (raffle ? "Comprar cotas" : ""),
      ctaUrl: req.body.ctaUrl || (raffle ? `/raffle/${raffle.id}` : ""),
      createdAt: new Date().toISOString(),
      createdBy: "admin",
      target: "all",
      readBy: []
    };
    customerMessages.unshift(message);
    res.json(message);
  });

  function maskCpfForCrm(cpf: string) {
    const digits = normalizeCpf(cpf);
    return digits.length === 11 ? `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}` : "";
  }

  function getCustomerPaidActivity(customer: CustomerRecord) {
    const traditional = purchases
      .filter(purchase => purchase.tenant_id === customer.tenant_id && (purchase.customer?.id === customer.id || purchase.contact === customer.phone) && purchase.status === "paid")
      .map(purchase => ({ id: purchase.purchaseId, type: "rifa", amount: Number(purchase.amount || 0), tickets: purchase.tickets, created_at: paidAtFromHistory(purchase.paymentHistory) || purchase.createdAt, status: purchase.status }));
    const modalidade = numberModePurchases
      .filter(purchase => purchase.tenant_id === customer.tenant_id && purchase.customer.id === customer.id && purchase.status === "paid")
      .map(purchase => ({ id: purchase.id, type: `modalidade:${purchase.mode}`, amount: Number(purchase.amount || 0), tickets: purchase.numbers.length, created_at: purchase.createdAt, status: purchase.status }));
    const fazendinha = fazendinhaCompras
      .filter(purchase => purchase.tenant_id === customer.tenant_id && purchase.usuarioId === customer.id && purchase.statusPagamento === "paid")
      .map(purchase => ({ id: purchase.id, type: "fazendinha", amount: Number(purchase.valorPago || 0), tickets: purchase.numeros.length, created_at: purchase.dataCompra, status: purchase.statusPagamento }));
    return [...traditional, ...modalidade, ...fazendinha].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  function getCustomerCommercialActivity(customer: CustomerRecord) {
    const traditional = purchases
      .filter(purchase => purchase.tenant_id === customer.tenant_id && (purchase.customer?.id === customer.id || purchase.contact === customer.phone))
      .map(purchase => ({
        id: purchase.purchaseId,
        type: "rifa",
        amount: Number(purchase.amount || 0),
        created_at: paidAtFromHistory(purchase.paymentHistory) || purchase.createdAt,
        status: purchase.status,
        campaignName: raffles.find(raffle => raffle.tenant_id === purchase.tenant_id && raffle.id === purchase.raffleId)?.title || purchase.raffleId,
        expiresAt: purchase.pixExpiresAt || purchase.reservedUntil || ""
      }));
    const modalidade = numberModePurchases
      .filter(purchase => purchase.tenant_id === customer.tenant_id && purchase.customer.id === customer.id)
      .map(purchase => ({
        id: purchase.id,
        type: "modalidade",
        amount: Number(purchase.amount || 0),
        created_at: purchase.paidAt || purchase.createdAt,
        status: purchase.status,
        campaignName: `Modalidade ${purchase.mode}`,
        expiresAt: purchase.pixExpiresAt || purchase.reservedUntil || ""
      }));
    const fazendinha = fazendinhaCompras
      .filter(purchase => purchase.tenant_id === customer.tenant_id && purchase.usuarioId === customer.id)
      .map(purchase => ({
        id: purchase.id,
        type: "fazendinha",
        amount: Number(purchase.valorPago || 0),
        created_at: purchase.paidAt || purchase.dataCompra,
        status: purchase.statusPagamento === "reserved" ? "pending" : purchase.statusPagamento,
        campaignName: "A Fazendinha",
        expiresAt: purchase.pixExpiresAt || purchase.reservedUntil || ""
      }));
    return [...traditional, ...modalidade, ...fazendinha].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  function commercialStatusForCustomer(input: { paidOrders: number; totalSpent: number; lastPaidAt: string; hasPendingPix: boolean }) {
    if (input.hasPendingPix) return "PIX pendente";
    if (input.totalSpent >= 1000 || input.paidOrders >= 5) return "VIP";
    if (input.lastPaidAt && Date.now() - new Date(input.lastPaidAt).getTime() >= 30 * 24 * 60 * 60 * 1000) return "Inativo";
    if (input.paidOrders >= 2) return "Recorrente";
    return "Novo cliente";
  }

  function buildCommercialMessage(status: string, name: string) {
    const firstName = String(name || "cliente").split(/\s+/)[0] || "cliente";
    if (status === "PIX pendente") return `Olá, ${firstName}! Vi que você iniciou uma compra, mas o PIX ainda está pendente. Quer finalizar sua participação?`;
    if (status === "Inativo") return `Olá, ${firstName}! Temos novas campanhas disponíveis. Dá uma olhada e participe novamente!`;
    if (status === "VIP") return `Olá, ${firstName}! Você está entre nossos clientes especiais. Separei uma campanha que pode te interessar.`;
    if (status === "Recorrente") return `Olá, ${firstName}! Obrigado por participar novamente. Temos novas oportunidades para você concorrer.`;
    return `Olá, ${firstName}! Temos campanhas disponíveis para você participar.`;
  }

  function buildCrmBuyerCustomers(req: express.Request) {
    const tenantId = resolveRequestTenantId(req);
    const now = Date.now();
    const customers = Object.values(customersByPhone)
      .filter(customer => adminCanAccessTenant(req, customer.tenant_id))
      .filter(customer => normalizeAuthRole(getAuthSession(req)?.role) === "superadmin" || customer.tenant_id === tenantId)
      .map(customer => {
        const activity = getCustomerCommercialActivity(customer);
        const paid = activity.filter(item => item.status === "paid");
        const pending = activity.filter(item => item.status === "pending" || item.status === "reserved");
        const expiredPending = activity.filter(item => ["pending", "reserved", "cancelled"].includes(item.status) && item.expiresAt && new Date(item.expiresAt).getTime() <= now);
        const lastPaidAt = paid[0]?.created_at || "";
        const latest = activity[0];
        const totalComprado = Number(paid.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2));
        const statusComercial = commercialStatusForCustomer({
          paidOrders: paid.length,
          totalSpent: totalComprado,
          lastPaidAt,
          hasPendingPix: pending.length > 0
        });
        return {
          id: customer.id,
          nome: customer.name,
          whatsapp: normalizePhone(customer.phone),
          totalComprado,
          quantidadeCompras: paid.length,
          ultimaCompra: lastPaidAt,
          campanhaMaisRecente: latest?.campaignName || "",
          statusComercial,
          tiposCompra: Array.from(new Set(paid.map(item => item.type))),
          flags: {
            comprouHoje: Boolean(lastPaidAt && new Date(lastPaidAt).toDateString() === new Date().toDateString()),
            comprouUltimos7Dias: Boolean(lastPaidAt && now - new Date(lastPaidAt).getTime() <= 7 * 24 * 60 * 60 * 1000),
            clienteVip: statusComercial === "VIP",
            compradorRecorrente: paid.length >= 2,
            pixPendente: pending.length > 0,
            pixVencido: expiredPending.length > 0,
            comprouRifa: paid.some(item => item.type === "rifa"),
            comprouFazendinha: paid.some(item => item.type === "fazendinha"),
            comprouModalidades: paid.some(item => item.type === "modalidade"),
            inativo30Dias: Boolean(lastPaidAt && now - new Date(lastPaidAt).getTime() >= 30 * 24 * 60 * 60 * 1000)
          },
          mensagemPronta: buildCommercialMessage(statusComercial, customer.name)
        };
      })
      .filter(customer => customer.quantidadeCompras > 0 || customer.flags.pixPendente)
      .sort((a, b) => String(b.ultimaCompra || "").localeCompare(String(a.ultimaCompra || "")));
    return customers;
  }

  const MAX_CRM_CUSTOMERS_LIMIT = 100;
  const DEFAULT_CRM_CUSTOMERS_LIMIT = 25;
  const crmBuyerSegmentPredicates = {
    today: (customer: ReturnType<typeof buildCrmBuyerCustomers>[number]) => customer.flags.comprouHoje,
    last_7_days: (customer: ReturnType<typeof buildCrmBuyerCustomers>[number]) => customer.flags.comprouUltimos7Dias,
    vip: (customer: ReturnType<typeof buildCrmBuyerCustomers>[number]) => customer.flags.clienteVip,
    recurring: (customer: ReturnType<typeof buildCrmBuyerCustomers>[number]) => customer.flags.compradorRecorrente,
    pix_pending: (customer: ReturnType<typeof buildCrmBuyerCustomers>[number]) => customer.flags.pixPendente,
    pix_expired: (customer: ReturnType<typeof buildCrmBuyerCustomers>[number]) => customer.flags.pixVencido,
    raffle: (customer: ReturnType<typeof buildCrmBuyerCustomers>[number]) => customer.flags.comprouRifa,
    fazendinha: (customer: ReturnType<typeof buildCrmBuyerCustomers>[number]) => customer.flags.comprouFazendinha,
    number_mode: (customer: ReturnType<typeof buildCrmBuyerCustomers>[number]) => customer.flags.comprouModalidades,
    inactive_30_days: (customer: ReturnType<typeof buildCrmBuyerCustomers>[number]) => customer.flags.inativo30Dias
  } as const;

  function buildCrmBuyerSegmentCounts(customers: ReturnType<typeof buildCrmBuyerCustomers>) {
    return Object.fromEntries(
      Object.entries(crmBuyerSegmentPredicates).map(([key, predicate]) => [key, customers.filter(predicate).length])
    ) as Record<keyof typeof crmBuyerSegmentPredicates, number>;
  }

  function filterCrmBuyerCustomers(customers: ReturnType<typeof buildCrmBuyerCustomers>, input: { search: string; segment: string }) {
    const query = String(input.search || "").toLowerCase().trim();
    const digits = query.replace(/\D/g, "");
    const segment = String(input.segment || "").trim() as keyof typeof crmBuyerSegmentPredicates;
    const predicate = crmBuyerSegmentPredicates[segment];
    return customers.filter(customer => {
      if (predicate && !predicate(customer)) return false;
      if (!query) return true;
      const haystack = `${customer.nome} ${customer.whatsapp} ${customer.campanhaMaisRecente} ${customer.statusComercial}`.toLowerCase();
      return haystack.includes(query) || Boolean(digits && customer.whatsapp.replace(/\D/g, "").includes(digits));
    });
  }

  function sortCrmBuyerCustomers(customers: ReturnType<typeof buildCrmBuyerCustomers>, sortBy: string, sortDir: string) {
    const direction = sortDir === "asc" ? 1 : -1;
    const safeSortBy = ["lastPurchaseAt", "totalPurchased", "purchaseCount", "name"].includes(sortBy) ? sortBy : "lastPurchaseAt";
    return [...customers].sort((left, right) => {
      if (safeSortBy === "name") return left.nome.localeCompare(right.nome, "pt-BR") * direction;
      if (safeSortBy === "totalPurchased") return (Number(left.totalComprado || 0) - Number(right.totalComprado || 0)) * direction;
      if (safeSortBy === "purchaseCount") return (Number(left.quantidadeCompras || 0) - Number(right.quantidadeCompras || 0)) * direction;
      return String(left.ultimaCompra || "").localeCompare(String(right.ultimaCompra || "")) * direction;
    });
  }

  function buildCrmBuyerSegments(customers: ReturnType<typeof buildCrmBuyerCustomers>) {
    return {
      compraramHoje: customers.filter(customer => customer.flags.comprouHoje),
      ultimos7Dias: customers.filter(customer => customer.flags.comprouUltimos7Dias),
      clientesVip: customers.filter(customer => customer.flags.clienteVip),
      compradoresRecorrentes: customers.filter(customer => customer.flags.compradorRecorrente),
      pixPendente: customers.filter(customer => customer.flags.pixPendente),
      pixVencido: customers.filter(customer => customer.flags.pixVencido),
      compraramRifa: customers.filter(customer => customer.flags.comprouRifa),
      compraramFazendinha: customers.filter(customer => customer.flags.comprouFazendinha),
      compraramModalidades: customers.filter(customer => customer.flags.comprouModalidades),
      inativos30Dias: customers.filter(customer => customer.flags.inativo30Dias)
    };
  }

  function inferCrmStatus(customer: CustomerRecord | undefined, totalSpent: number, totalOrders: number, lastPurchaseAt = ""): CrmContactStatus {
    if (customer?.blocked) return "bloqueado";
    if (totalSpent >= 1000 || totalOrders >= 5) return "vip";
    if (totalOrders > 0) return "comprador";
    if (lastPurchaseAt && Date.now() - new Date(lastPurchaseAt).getTime() > 90 * 24 * 60 * 60 * 1000) return "inativo";
    return "lead";
  }

  function inferCrmPipelineStage(status: CrmContactStatus, totalOrders: number): CrmPipelineStage {
    if (status === "bloqueado") return "perdido";
    if (status === "vip") return "vip";
    if (status === "inativo") return "inativo";
    if (totalOrders >= 2) return "recorrente";
    if (totalOrders === 1) return "comprou";
    return "novo lead";
  }

  function buildCrmContactFromCustomer(customer: CustomerRecord): CrmContactRecord {
    const purchasesActivity = getCustomerPaidActivity(customer);
    const totalSpent = Number(purchasesActivity.reduce((sum, purchase) => sum + purchase.amount, 0).toFixed(2));
    const totalOrders = purchasesActivity.length;
    const lastPurchaseAt = purchasesActivity[0]?.created_at || "";
    const id = `CRM_${customer.id}`;
    const override = crmContactOverrides[id] || {};
    const inferredStatus = inferCrmStatus(customer, totalSpent, totalOrders, lastPurchaseAt);
    const status = override.status || inferredStatus;
    const pipelineStage = override.pipeline_stage || inferCrmPipelineStage(status, totalOrders);
    const tags = Array.from(new Set([
      ...(override.tags || []),
      ...(status === "vip" ? ["vip", "alto-ticket"] : []),
      ...(totalOrders >= 2 ? ["recorrente"] : []),
      ...(customer.referredBy ? ["afiliado"] : []),
      ...(customer.blocked ? ["bloqueado"] : [])
    ].filter(Boolean)));
    const score = override.score ?? Math.min(100, totalOrders * 15 + Math.floor(totalSpent / 25) + (status === "vip" ? 25 : 0));
    return {
      id,
      tenant_id: customer.tenant_id,
      customer_id: customer.id,
      nome: customer.name,
      telefone: maskPhone(customer.phone),
      email: override.email || "",
      cpf_mascarado: maskCpfForCrm(customer.cpf),
      cidade: customer.city,
      estado: customer.state,
      origem: override.origem || (customer.referredBy ? `afiliado:${customer.referredBy}` : "checkout"),
      tags,
      score,
      status,
      pipeline_stage: pipelineStage,
      last_purchase_at: lastPurchaseAt,
      total_spent: totalSpent,
      total_orders: totalOrders,
      notes: override.notes || "",
      created_at: customer.createdAt,
      updated_at: override.updated_at || customer.createdAt
    };
  }

  function buildCrmContact(contact: CrmContactRecord) {
    const override = crmContactOverrides[contact.id] || {};
    return {
      ...contact,
      ...override,
      telefone: maskPhone(contact.telefone),
      cpf_mascarado: contact.cpf_mascarado || maskCpfForCrm("")
    };
  }

  function listCrmContacts(req: express.Request) {
    const tenantId = resolveRequestTenantId(req);
    const derived = Object.values(customersByPhone)
      .filter(customer => adminCanAccessTenant(req, customer.tenant_id))
      .map(buildCrmContactFromCustomer);
    const manual = scoped(crmContacts, req).map(buildCrmContact);
    const contacts = [...derived, ...manual].filter(contact => adminCanAccessTenant(req, contact.tenant_id));
    return normalizeAuthRole(getAuthSession(req)?.role) === "superadmin" ? contacts : contacts.filter(contact => contact.tenant_id === tenantId);
  }

  function buildCrmPipeline(contacts: CrmContactRecord[]) {
    const stages: CrmPipelineStage[] = ["novo lead", "interessado", "comprou", "recorrente", "vip", "inativo", "perdido"];
    return stages.map(stage => {
      const stageContacts = contacts.filter(contact => contact.pipeline_stage === stage);
      return {
        stage,
        total: stageContacts.length,
        value: Number(stageContacts.reduce((sum, contact) => sum + Number(contact.total_spent || 0), 0).toFixed(2)),
        contacts: stageContacts
      };
    });
  }

  function buildCrmSegments(contacts: CrmContactRecord[]) {
    return {
      inactive: contacts.filter(contact => contact.status === "inativo" || contact.pipeline_stage === "inativo"),
      recurring: contacts.filter(contact => contact.total_orders >= 2 || contact.pipeline_stage === "recorrente"),
      highTicket: contacts.filter(contact => contact.total_spent >= 500 || contact.tags.includes("alto-ticket")),
      vip: contacts.filter(contact => contact.status === "vip"),
      leads: contacts.filter(contact => contact.status === "lead"),
      blocked: contacts.filter(contact => contact.status === "bloqueado")
    };
  }

  function buildCrmContactHistory(contact: CrmContactRecord, req: express.Request) {
    const customer = contact.customer_id ? Object.values(customersByPhone).find(item => item.id === contact.customer_id && adminCanAccessTenant(req, item.tenant_id)) : undefined;
    if (!customer) {
      return { purchases: [], tickets: [], whatsapp: [], affiliate: null, wallet: [], notes: contact.notes ? [{ body: contact.notes, created_at: contact.updated_at }] : [], audit: [] };
    }
    return {
      purchases: getCustomerPaidActivity(customer),
      tickets: [
        ...purchases.filter(purchase => purchase.tenant_id === customer.tenant_id && purchase.customer?.id === customer.id).flatMap(purchase => purchase.numeros.map(number => ({ order_id: purchase.purchaseId, number, type: "rifa" }))),
        ...numberModePurchases.filter(purchase => purchase.tenant_id === customer.tenant_id && purchase.customer.id === customer.id).flatMap(purchase => purchase.numbers.map(number => ({ order_id: purchase.id, number, type: purchase.mode }))),
        ...fazendinhaCompras.filter(purchase => purchase.tenant_id === customer.tenant_id && purchase.usuarioId === customer.id).flatMap(purchase => purchase.numeros.map(number => ({ order_id: purchase.id, number, type: "fazendinha" })))
      ],
      whatsapp: whatsappMessageQueue.filter(message => message.tenant_id === customer.tenant_id && message.customer_id === customer.id).map(message => ({ ...message, phone: maskPhone(message.phone) })),
      affiliate: getAffiliateForCustomer(customer) || null,
      wallet: walletLedger.filter(item => item.tenant_id === customer.tenant_id && item.customer_id === customer.id),
      notes: contact.notes ? [{ body: contact.notes, created_at: contact.updated_at }] : [],
      audit: auditEventLedger.filter(event => event.tenant_id === customer.tenant_id && event.resource_id === customer.id)
    };
  }

  function updateCrmAutomationForCustomer(customer: CustomerRecord) {
    const contact = buildCrmContactFromCustomer(customer);
    crmContactOverrides[contact.id] = {
      ...(crmContactOverrides[contact.id] || {}),
      status: contact.status,
      pipeline_stage: contact.pipeline_stage,
      tags: contact.tags,
      score: contact.score,
      updated_at: new Date().toISOString()
    };
    return contact;
  }

  function recalculateCustomerPaidTickets(customer: CustomerRecord) {
    const traditionalTickets = purchases
      .filter(purchase => purchase.tenant_id === customer.tenant_id && purchase.customer?.id === customer.id && purchase.status === "paid")
      .reduce((sum, purchase) => sum + purchase.tickets, 0);
    const fazendinhaTickets = fazendinhaCompras
      .filter(purchase => purchase.tenant_id === customer.tenant_id && purchase.usuarioId === customer.id && purchase.statusPagamento === "paid")
      .reduce((sum, purchase) => sum + purchase.numeros.length, 0);
    const modalidadeTickets = numberModePurchases
      .filter(purchase => purchase.tenant_id === customer.tenant_id && purchase.customer.id === customer.id && purchase.status === "paid")
      .reduce((sum, purchase) => sum + purchase.numbers.length, 0);
    customer.totalTickets = traditionalTickets + fazendinhaTickets + modalidadeTickets;
    if (customer.totalTickets > 0) ensureAffiliateForCustomer(customer, { forceEnable: true, source: "affiliate_auto_first_paid_purchase" });
  }

  function buildAdminCustomerProfile(customer: CustomerRecord) {
    return {
      ...customer,
      affiliate: getAffiliateForCustomer(customer) || null,
      purchases: purchases
        .filter(purchase => purchase.tenant_id === customer.tenant_id && (purchase.customer?.id === customer.id || purchase.contact === customer.phone))
        .map(purchase => ({
          ...purchase,
          raffleTitle: raffles.find(raffle => raffle.id === purchase.raffleId)?.title || purchase.raffleId,
          editableNumbers: purchase.numeros.join(", ")
        })),
      fazendinhaPurchases: fazendinhaCompras
        .filter(purchase => purchase.tenant_id === customer.tenant_id && purchase.usuarioId === customer.id)
        .map(purchase => ({
          ...purchase,
          editableGroupIds: (purchase.grupoIds?.length ? purchase.grupoIds : [purchase.grupoId]).join(", ")
        })),
      modalidadePurchases: numberModePurchases
        .filter(purchase => purchase.tenant_id === customer.tenant_id && purchase.customer.id === customer.id)
        .map(purchase => ({
          ...purchase,
          editableNumbers: purchase.numbers.join(", ")
        }))
    };
  }

  function updateTraditionalPurchaseNumbers(purchase: PurchaseRecord, numbersInput: unknown) {
    if (numbersInput === undefined) return;
    const raffle = raffles.find(item => item.tenant_id === purchase.tenant_id && item.id === purchase.raffleId);
    if (!raffle) throw new Error("Rifa da compra nao encontrada");
    const numbers = Array.from(new Set(
      (Array.isArray(numbersInput) ? numbersInput : String(numbersInput || "").split(/[,\s]+/))
        .map(value => Number(value))
        .filter(value => Number.isInteger(value))
    ));
    if (!numbers.length) throw new Error("A compra de rifa precisa manter ao menos uma cota");
    if (numbers.some(number => number < 1 || number > raffle.totalTickets)) {
      throw new Error("Uma ou mais cotas estao fora do limite da rifa");
    }
    const conflict = purchases.find(other =>
      other.purchaseId !== purchase.purchaseId &&
      other.tenant_id === purchase.tenant_id &&
      other.raffleId === purchase.raffleId &&
      other.numeros.some(number => numbers.includes(number))
    );
    if (conflict) throw new Error(`Cota ja vinculada a outra compra: ${conflict.purchaseId}`);

    purchase.numeros.forEach(number => raffle.soldNumbers.delete(number));
    numbers.forEach(number => raffle.soldNumbers.add(number));
    purchase.numeros = numbers;
    purchase.tickets = numbers.length;
    purchase.amount = Number((numbers.length * raffle.price).toFixed(2));
    raffle.soldTickets = raffle.soldNumbers.size;
  }

  function updateNumberModePurchaseNumbers(purchase: NumberModePurchase, numbersInput: unknown) {
    if (numbersInput === undefined) return;
    const config = getNumberModeConfig(purchase.tenant_id, purchase.mode);
    if (!config) throw new Error("Modalidade da compra nao encontrada");
    const numbers = Array.from(new Set(
      (Array.isArray(numbersInput) ? numbersInput : String(numbersInput || "").split(/[,\s]+/))
        .map(value => normalizeModeNumber(purchase.mode, value, purchase.tenant_id))
        .filter((value): value is string => Boolean(value))
    ));
    if (!numbers.length) throw new Error("A modalidade precisa manter ao menos uma cota");
    const conflict = numberModeBets.find(bet =>
      bet.purchaseId !== purchase.id &&
      bet.tenant_id === purchase.tenant_id &&
      bet.mode === purchase.mode &&
      numbers.includes(bet.number)
    );
    if (conflict) throw new Error(`Cota ${conflict.number} ja esta vinculada a outra compra`);

    numberModeBets = numberModeBets.filter(bet => bet.tenant_id !== purchase.tenant_id || bet.purchaseId !== purchase.id);
    purchase.numbers = numbers;
    purchase.amount = Number((numbers.length * config.price).toFixed(2));
    numbers.forEach(number => {
      numberModeBets.push({
        id: createPublicId("AP_"),
        tenant_id: purchase.tenant_id,
        mode: purchase.mode,
        number,
        purchaseId: purchase.id,
        customerId: purchase.customer.id,
        status: purchase.status,
        createdAt: purchase.createdAt
      });
    });
  }

  function updateFazendinhaPurchaseGroups(purchase: FazendinhaPurchase, groupIdsInput: unknown) {
    if (groupIdsInput === undefined) return;
    const groupIds = Array.from(new Set(
      (Array.isArray(groupIdsInput) ? groupIdsInput : String(groupIdsInput || "").split(/[,\s]+/))
        .map(value => String(value || "").trim().toLowerCase())
        .filter(Boolean)
    ));
    if (!groupIds.length) throw new Error("A compra da Fazendinha precisa manter ao menos um grupo");

    const previousGroupIds = purchase.grupoIds?.length ? purchase.grupoIds : [purchase.grupoId];
    const selectedGroups = groupIds.map(groupId => fazendinhaGroups.find(group => group.tenant_id === purchase.tenant_id && group.id === groupId));
    if (selectedGroups.some(group => !group)) throw new Error("Grupo da Fazendinha inexistente");
    const unavailable = selectedGroups.find(group =>
      group &&
      group.compraId &&
      group.compraId !== purchase.id &&
      group.status !== "available"
    );
    if (unavailable) throw new Error(`Grupo ${unavailable.nomeBicho} ja esta reservado ou vendido`);

    fazendinhaGroups.filter(group => group.tenant_id === purchase.tenant_id).forEach(group => {
      if (previousGroupIds.includes(group.id) && group.compraId === purchase.id) {
        group.status = "available";
        group.compradorId = undefined;
        group.compraId = undefined;
      }
    });

    const groups = selectedGroups as FazendinhaGroup[];
    groups.forEach(group => {
      group.status = purchase.statusPagamento === "paid" ? "sold" : "reserved";
      group.compradorId = purchase.usuarioId;
      group.compraId = purchase.id;
    });

    purchase.grupoIds = groups.map(group => group.id);
    purchase.grupoId = groups[0].id;
    purchase.nomeBichos = groups.map(group => group.nomeBicho);
    purchase.nomeBicho = groups.map(group => group.nomeBicho).join(", ");
    purchase.numeros = groups.flatMap(group => group.numeros);
    const config = getFazendinhaConfig(purchase.tenant_id);
    purchase.valorPago = Number((groups.reduce((sum, group) => sum + Number(group.preco || config.pricePerGroup), 0)).toFixed(2));
  }

  app.get("/api/admin/customers/search", (req, res) => {
    const query = String(req.query.q || "");
    const digits = query.replace(/\D/g, "");
    const normalizedText = query.toLowerCase().trim();
    const results = Object.values(customersByPhone)
      .filter(customer => adminCanAccessTenant(req, customer.tenant_id))
      .filter(customer => {
        const text = `${customer.name} ${customer.phone} ${customer.cpf} ${customer.city || ""} ${customer.state || ""}`.toLowerCase();
        return !query || text.includes(normalizedText) || customer.phone.includes(digits) || customer.cpf.includes(digits);
      })
      .map(buildAdminCustomerProfile);
    res.json(results);
  });

  app.put("/api/admin/customers/:id", (req, res) => {
    const customer = Object.values(customersByPhone).find(c => c.id === req.params.id && adminCanAccessTenant(req, c.tenant_id));
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    let reason = "";
    try {
      reason = requireAuditReason(req.body.reason);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Motivo obrigatorio" });
      return;
    }

    const before = deepClone(customer);
    const oldPhone = customer.phone;
    const oldCpf = customer.cpf;
    customer.name = req.body.name ?? customer.name;
    customer.phone = req.body.phone ? normalizePhone(req.body.phone) : customer.phone;
    customer.cpf = req.body.cpf ? normalizeCpf(req.body.cpf) : customer.cpf;
    customer.photoUrl = req.body.photoUrl ?? customer.photoUrl;
    customer.city = req.body.city ?? customer.city;
    customer.state = req.body.state ?? customer.state;
    if (req.body.accessPassword !== undefined || req.body.password !== undefined) {
      const accessPassword = normalizeAccessPassword(req.body.accessPassword || req.body.password);
      if (!accessPassword) {
        res.status(400).json({ error: "Senha deve ter 6 dígitos" });
        return;
      }
      customer.accessPassword = accessPassword;
    }
    customer.latitude = req.body.latitude !== undefined ? Number(req.body.latitude) : customer.latitude;
    customer.longitude = req.body.longitude !== undefined ? Number(req.body.longitude) : customer.longitude;
    customer.totalTickets = req.body.totalTickets !== undefined ? Number(req.body.totalTickets) : customer.totalTickets;

    delete customersByPhone[tenantCustomerKey(customer.tenant_id, oldPhone)];
    delete customersByCpf[tenantCustomerKey(customer.tenant_id, oldCpf)];
    customersByPhone[tenantCustomerKey(customer.tenant_id, customer.phone)] = customer;
    customersByCpf[tenantCustomerKey(customer.tenant_id, customer.cpf)] = customer;
    purchases.forEach(purchase => {
      if (purchase.tenant_id === customer.tenant_id && purchase.customer?.id === customer.id) {
        purchase.customer = customer;
        purchase.contact = customer.phone;
      }
    });

    recalculateCustomerPaidTickets(customer);
    const after = buildAdminCustomerProfile(customer);
    recordAuditLedger(req, { tenant_id: customer.tenant_id, action: "CUSTOMER_UPDATED", resource_type: "customer", resource_id: customer.id, before_data: before, after_data: after, reason });
    res.json(after);
  });

  app.put("/api/admin/customers/:id/full", (req, res) => {
    const customer = Object.values(customersByPhone).find(c => c.id === req.params.id && adminCanAccessTenant(req, c.tenant_id));
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    let reason = "";
    try {
      reason = requireAuditReason(req.body.reason);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Motivo obrigatorio" });
      return;
    }

    const before = buildAdminCustomerProfile(customer);
    const oldPhone = customer.phone;
    const oldCpf = customer.cpf;
    customer.name = req.body.name ?? customer.name;
    customer.phone = req.body.phone ? normalizePhone(req.body.phone) : customer.phone;
    customer.cpf = req.body.cpf ? normalizeCpf(req.body.cpf) : customer.cpf;
    customer.photoUrl = req.body.photoUrl ?? customer.photoUrl;
    customer.city = req.body.city ?? customer.city;
    customer.state = req.body.state ?? customer.state;
    if (req.body.accessPassword !== undefined || req.body.password !== undefined) {
      const accessPassword = normalizeAccessPassword(req.body.accessPassword || req.body.password);
      if (!accessPassword) {
        res.status(400).json({ error: "Senha deve ter 6 dígitos" });
        return;
      }
      customer.accessPassword = accessPassword;
    }
    customer.latitude = req.body.latitude !== undefined ? Number(req.body.latitude) : customer.latitude;
    customer.longitude = req.body.longitude !== undefined ? Number(req.body.longitude) : customer.longitude;

    delete customersByPhone[tenantCustomerKey(customer.tenant_id, oldPhone)];
    delete customersByCpf[tenantCustomerKey(customer.tenant_id, oldCpf)];
    customersByPhone[tenantCustomerKey(customer.tenant_id, customer.phone)] = customer;
    customersByCpf[tenantCustomerKey(customer.tenant_id, customer.cpf)] = customer;

    purchases.forEach(purchase => {
      if (purchase.tenant_id === customer.tenant_id && purchase.customer?.id === customer.id) {
        purchase.customer = customer;
        purchase.contact = customer.phone;
      }
    });

    try {
      (req.body.purchases || []).forEach((update: any) => {
        const purchase = purchases.find(item => item.tenant_id === customer.tenant_id && item.purchaseId === update.purchaseId && item.customer?.id === customer.id);
        if (purchase) updateTraditionalPurchaseNumbers(purchase, update.numeros ?? update.editableNumbers);
      });
      (req.body.modalidadePurchases || []).forEach((update: any) => {
        const purchase = numberModePurchases.find(item => item.tenant_id === customer.tenant_id && item.id === update.id && item.customer.id === customer.id);
        if (purchase) updateNumberModePurchaseNumbers(purchase, update.numbers ?? update.editableNumbers);
      });
      (req.body.fazendinhaPurchases || []).forEach((update: any) => {
        const purchase = fazendinhaCompras.find(item => item.tenant_id === customer.tenant_id && item.id === update.id && item.usuarioId === customer.id);
        if (purchase) updateFazendinhaPurchaseGroups(purchase, update.grupoIds ?? update.editableGroupIds);
      });
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Erro ao editar cotas" });
      return;
    }

    recalculateCustomerPaidTickets(customer);
    const after = buildAdminCustomerProfile(customer);
    recordAuditLedger(req, { tenant_id: customer.tenant_id, action: "CUSTOMER_FULL_UPDATED", resource_type: "customer", resource_id: customer.id, before_data: before, after_data: after, reason });
    res.json(after);
  });

  app.post("/api/admin/customers/:id/block", (req, res) => {
    const customer = Object.values(customersByPhone).find(c => c.id === req.params.id && adminCanAccessTenant(req, c.tenant_id));
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    let reason = "";
    try {
      reason = requireAuditReason(req.body.reason);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Motivo obrigatorio" });
      return;
    }
    const before = deepClone(customer);
    customer.blocked = Boolean(req.body.blocked ?? true);
    customer.blockedReason = customer.blocked ? reason : "";
    recordAudit(customer.blocked ? "CUSTOMER_BLOCKED" : "CUSTOMER_UNBLOCKED", req, 200, customer.id);
    const after = buildAdminCustomerProfile(customer);
    recordAuditLedger(req, { tenant_id: customer.tenant_id, action: customer.blocked ? "CUSTOMER_BLOCKED" : "CUSTOMER_UNBLOCKED", resource_type: "customer", resource_id: customer.id, before_data: before, after_data: after, reason });
    res.json(after);
  });

  app.post("/api/admin/customers/:id/reset-password", (req, res) => {
    const customer = Object.values(customersByPhone).find(c => c.id === req.params.id && adminCanAccessTenant(req, c.tenant_id));
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    const accessPassword = normalizeAccessPassword(req.body.accessPassword || "123456");
    if (!accessPassword) {
      res.status(400).json({ error: "Senha deve ter 6 dígitos" });
      return;
    }
    customer.accessPassword = accessPassword;
    notifyCustomer(customer, "Senha redefinida pelo suporte", "Sua senha de acesso foi atualizada pelo administrador.", "Acessar conta", "/auth");
    recordAudit("CUSTOMER_PASSWORD_RESET", req, 200, customer.id);
    res.json({ success: true, customer: buildAdminCustomerProfile(customer), accessPassword });
  });

  app.get("/api/admin/audit-ledger", (req, res) => {
    res.json(scoped(auditEventLedger.filter(event => event.tenant_id) as Array<AuditEventLedgerRecord & { tenant_id: string }>, req));
  });

  app.get("/api/admin/ticket-adjustments", (req, res) => {
    res.json(scoped(ticketAdjustments, req));
  });

  app.get("/api/admin/wallet-ledger", (req, res) => {
    res.json(scoped(walletLedger, req));
  });

  app.post("/api/admin/wallet-ledger/manual", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const customer = req.body.customerId ? Object.values(customersByPhone).find(item => item.tenant_id === tenantId && item.id === req.body.customerId) : undefined;
    const amount = Number(req.body.amount || 0);
    let reason = "";
    try {
      reason = requireAuditReason(req.body.reason);
      if (!amount) throw new Error("Valor obrigatorio");
      const record = appendWalletLedger(req, {
        tenant_id: tenantId,
        customer_id: customer?.id,
        affiliate_ref: req.body.affiliateRef ? String(req.body.affiliateRef) : undefined,
        source_type: amount > 0 ? "manual_credit" : "manual_debit",
        source_id: createPublicId("MAN_"),
        amount,
        reason
      });
      recordAuditLedger(req, { tenant_id: tenantId, action: amount > 0 ? "WALLET_MANUAL_CREDIT" : "WALLET_MANUAL_DEBIT", resource_type: "wallet_ledger", resource_id: record.id, before_data: null, after_data: record, reason });
      res.json(record);
    } catch (error) {
      res.status((error as Error & { statusCode?: number }).statusCode || 400).json({ error: error instanceof Error ? error.message : "Ajuste financeiro invalido" });
    }
  });

  app.get("/api/admin/compliance", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const tenantSettings = getTenantSettings(tenantId) as any;
    res.json({
      terms: tenantSettings.terms || tenantSettings.footer?.terms || "",
      privacyPolicy: tenantSettings.privacyPolicy || "Politica de privacidade por tenant.",
      consents: customerConsents.filter(item => item.tenant_id === tenantId),
      requests: dataPrivacyRequests.filter(item => item.tenant_id === tenantId)
    });
  });

  app.post("/api/admin/compliance/customers/:customerId/export", (req, res) => {
    const customer = Object.values(customersByPhone).find(item => item.id === req.params.customerId && adminCanAccessTenant(req, item.tenant_id));
    if (!customer) return res.status(404).json({ error: "Cliente nao encontrado" });
    const reason = requireAuditReason(req.body.reason || "Exportacao LGPD solicitada");
    const result = buildAdminCustomerProfile(customer);
    const request: DataPrivacyRequestRecord = { id: createPublicId("DPR_"), tenant_id: customer.tenant_id, customer_id: customer.id, request_type: "export", status: "completed", reason, result, created_at: new Date().toISOString(), completed_at: new Date().toISOString() };
    dataPrivacyRequests.unshift(request);
    recordAuditLedger(req, { tenant_id: customer.tenant_id, action: "LGPD_EXPORT_COMPLETED", resource_type: "customer", resource_id: customer.id, before_data: null, after_data: { requestId: request.id }, reason });
    res.json({ request, data: result });
  });

  app.post("/api/admin/compliance/customers/:customerId/anonymize", (req, res) => {
    const customer = Object.values(customersByPhone).find(item => item.id === req.params.customerId && adminCanAccessTenant(req, item.tenant_id));
    if (!customer) return res.status(404).json({ error: "Cliente nao encontrado" });
    const reason = requireAuditReason(req.body.reason || "Anonimizacao LGPD solicitada");
    const before = deepClone(customer);
    customer.name = `Cliente anonimizado ${customer.id.slice(-6)}`;
    customer.phone = `anon-${customer.id}`;
    customer.cpf = "";
    customer.city = "";
    customer.state = "";
    customer.photoUrl = "";
    customer.blocked = true;
    customer.blockedReason = "Anonimizado por LGPD";
    const request: DataPrivacyRequestRecord = { id: createPublicId("DPR_"), tenant_id: customer.tenant_id, customer_id: customer.id, request_type: "anonymize", status: "completed", reason, result: { preservedFinancialRecords: true }, created_at: new Date().toISOString(), completed_at: new Date().toISOString() };
    dataPrivacyRequests.unshift(request);
    recordAuditLedger(req, { tenant_id: customer.tenant_id, action: "LGPD_CUSTOMER_ANONYMIZED", resource_type: "customer", resource_id: customer.id, before_data: before, after_data: customer, reason });
    res.json({ request, customer: buildAdminCustomerProfile(customer) });
  });

  app.post("/api/public/consents", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const customerId = String(req.body.customerId || "");
    const status = req.body.status === "revoked" ? "revoked" : "accepted";
    const consent: CustomerConsentRecord = {
      id: createPublicId("CNS_"),
      tenant_id: tenantId,
      customer_id: customerId,
      consent_type: String(req.body.consentType || "terms_privacy"),
      status,
      terms_version: String(req.body.termsVersion || "v1"),
      ip_address: String(req.ip || req.socket.remoteAddress || ""),
      user_agent: String(req.headers["user-agent"] || ""),
      created_at: new Date().toISOString()
    };
    customerConsents.unshift(consent);
    res.json(consent);
  });

  app.get("/api/admin/antifraud", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const cases = fraudCases.filter(item => item.tenant_id === tenantId);
    res.json({
      signals: scoped(fraudSignals, req),
      scoreEvents: scoped(fraudScoreEvents, req),
      cases,
      summary: {
        totalCases: cases.length,
        open: cases.filter(item => ["open", "manual_review"].includes(item.status)).length,
        highRisk: cases.filter(item => item.severity === "high").length,
        averageScore: cases.length ? Math.round(cases.reduce((sum, item) => sum + item.score, 0) / cases.length) : 0
      }
    });
  });

  app.post("/api/admin/antifraud/scan", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const now = new Date().toISOString();
    const byIp = auditEventLedger.filter(item => item.tenant_id === tenantId && item.ip_address).reduce<Record<string, number>>((acc, item) => {
      acc[item.ip_address || ""] = (acc[item.ip_address || ""] || 0) + 1;
      return acc;
    }, {});
    Object.entries(byIp).filter(([, count]) => count >= 5).forEach(([ip, count]) => {
      createFraudEvent({ tenant_id: tenantId, signal_type: "many_actions_same_ip", score: count > 20 ? 82 : 45, metadata: { ip, count } });
    });
    Object.values(customersByPhone)
      .filter(customer => customer.tenant_id === tenantId)
      .forEach(customer => {
        const samePhone = Object.values(customersByPhone).filter(item => item.tenant_id === tenantId && item.phone === customer.phone).length;
        if (samePhone > 1) createFraudEvent({ tenant_id: tenantId, customer_id: customer.id, signal_type: "telefone_repetido", score: 42, metadata: { phone: maskPhone(customer.phone), count: samePhone } });
      });
    res.json({ signals: scoped(fraudSignals, req), scoreEvents: scoped(fraudScoreEvents, req), cases: fraudCases.filter(item => item.tenant_id === tenantId) });
  });

  app.post("/api/admin/antifraud/cases/:id/review", (req, res) => {
    const fraudCase = fraudCases.find(item => item.id === req.params.id && adminCanAccessTenant(req, item.tenant_id));
    if (!fraudCase) return res.status(404).json({ error: "Caso antifraude nao encontrado" });
    const decision = ["approved", "rejected", "dismissed", "blocked"].includes(String(req.body.status)) ? String(req.body.status) as FraudCaseRecord["status"] : "approved";
    const before = { ...fraudCase };
    fraudCase.status = decision;
    fraudCase.reviewed_by = getAuthSession(req)?.email || "admin";
    fraudCase.reviewed_at = new Date().toISOString();
    const customer = fraudCase.customer_id ? Object.values(customersByPhone).find(item => item.tenant_id === fraudCase.tenant_id && item.id === fraudCase.customer_id) : undefined;
    if (customer && req.body.blockCustomer) {
      customer.blocked = true;
      customer.blockedReason = String(req.body.reason || "Bloqueado por revisao antifraude");
    }
    if (customer && req.body.releaseCustomer) {
      customer.blocked = false;
      customer.blockedReason = "";
    }
    fraudSignals.filter(item => item.tenant_id === fraudCase.tenant_id && item.signal_type === fraudCase.signal_type && item.customer_id === fraudCase.customer_id).forEach(item => {
      item.status = decision === "dismissed" ? "dismissed" : "reviewed";
      item.reviewed_by = fraudCase.reviewed_by;
      item.reviewed_at = fraudCase.reviewed_at;
    });
    recordAuditLedger(req, { tenant_id: fraudCase.tenant_id, action: "FRAUD_CASE_REVIEWED", resource_type: "fraud_case", resource_id: fraudCase.id, before_data: before, after_data: fraudCase, reason: String(req.body.reason || "Revisao antifraude") });
    res.json({ case: fraudCase, customer });
  });

  app.post("/api/checkout/preview", criticalRateLimiter, (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const tenant = tenants.find(item => item.id === tenantId);
    try {
      assertTenantOperationalForCheckout(tenant);
    } catch (error) {
      res.status(403).json({ error: error instanceof Error ? error.message : "Tenant inativo ou indisponivel para compras", tenantStatus: tenant?.status || "unknown" });
      return;
    }

    const type = String(req.body.type || "raffle");
    const warnings: string[] = [];
    const defaultGateway = getDefaultPaymentGatewayConfig(tenantId);
    const tenantPixGateways = getTenantGateways(tenantId);
    const gateway = normalizePaymentProvider(defaultGateway.provider || tenantPixGateways.active || "mercadopago");
    const walletUsage = { enabled: false, amount: 0 };
    const affiliateInfo = req.body.refCode ? { refCode: String(req.body.refCode) } : undefined;

    try {
      if (type === "raffle") {
        const raffleId = String(req.body.raffleId || req.body.id || "");
        const raffle = raffles.find(item => item.tenant_id === tenantId && item.id === raffleId);
        const tickets = normalizeTickets(req.body.tickets);
        if (!raffle) return res.status(404).json({ error: "Rifa nao encontrada" });
        try {
          assertRaffleOpenForCheckout(raffle);
        } catch (error) {
          return res.status(403).json({ error: error instanceof Error ? error.message : "Rifa encerrada ou indisponivel" });
        }
        if (tickets === null) return res.status(400).json({ error: "Quantidade invalida" });
        expirePendingReservations(tenantId, raffle.id);
        const pixConfig = getRafflePixConfig(raffle);
        if (!pixConfig.enabled) return res.status(503).json({ error: "Gateway PIX indisponivel para este sorteio" });

        const addonTickets = normalizeTickets(req.body.addon?.tickets) || 0;
        const addonRaffle = req.body.addon?.raffleId ? raffles.find(item => item.tenant_id === tenantId && item.id === req.body.addon.raffleId) : null;
        if (addonRaffle) expirePendingReservations(tenantId, addonRaffle.id);
        if (addonRaffle) {
          try {
            assertRaffleOpenForCheckout(addonRaffle);
          } catch (error) {
            return res.status(403).json({ error: error instanceof Error ? error.message : "Rifa adicional encerrada ou indisponivel" });
          }
        }

        let coupon: CampaignCoupon | null = null;
        if (req.body.couponCode) coupon = getActiveCoupon(req.body.couponCode, raffle.id, tickets, tenantId);
        const gamificationConfig = getGamificationConfig(tenantId, raffle.id);
        const orderBump = req.body.orderBumpAccepted || req.body.upsellAccepted ? getActiveOrderBump(gamificationConfig) : null;
        const orderBumpTickets = orderBump ? Math.max(1, Math.floor(Number(orderBump.tickets || 0))) : 0;
        const orderBumpDiscount = orderBump ? Math.max(0, Math.min(100, Number(orderBump.discountPercent || 0))) : 0;
        const orderBumpAmount = orderBump ? Number((orderBumpTickets * raffle.price * (1 - orderBumpDiscount / 100)).toFixed(2)) : 0;
        const luckyHour = getActiveLuckyHour(gamificationConfig);
        const luckyDiscount = luckyHour?.type === "discount" ? Math.max(0, Number(luckyHour.value || 0)) : 0;
        const luckyBonusTickets = luckyHour?.type === "bonus" ? Math.max(0, Math.floor(Number(luckyHour.value || 0))) : 0;
        const luckyExtraChance = luckyHour?.type === "extraChance" ? Math.max(0, Math.floor(Number(luckyHour.value || 0))) : 0;
        const customerPayload = req.body.customer || {};
        const phone = normalizePhone(customerPayload.phone || req.body.contact);
        const existingCustomer = phone ? findCustomerByPhone(phone, tenantId) : undefined;
        const doubleTicketsPromotion = getActiveDoubleTicketsPromotion(gamificationConfig, tickets, existingCustomer);
        const doubleTicketsBonus = doubleTicketsPromotion?.bonusTickets || 0;
        const subtotal = tickets * raffle.price + (addonRaffle ? addonTickets * addonRaffle.price : 0) + orderBumpAmount;
        const couponBenefit = calculateCouponBenefit(coupon, subtotal, tickets);
        const total = Math.max(0, Number((subtotal - couponBenefit.discount - luckyDiscount).toFixed(2)));
        const promotionSummary = evaluatePromotionForRaffle({
          tenantId,
          raffleId: raffle.id,
          customer: existingCustomer,
          quantity: tickets,
          amount: total,
          price: raffle.price,
          availableTickets: Math.max(0, raffle.totalTickets - raffle.soldTickets - tickets - couponBenefit.bonusTickets - luckyBonusTickets - luckyExtraChance - orderBumpTickets - doubleTicketsBonus),
          raffleStatus: raffle.status,
          refCode: affiliateInfo?.refCode,
          paymentStatus: "pending"
        });
        const promotionBonusTickets = promotionSummary.bonusTickets || 0;
        const quantity = tickets + couponBenefit.bonusTickets + luckyBonusTickets + luckyExtraChance + orderBumpTickets + doubleTicketsBonus + promotionBonusTickets;
        if (raffle.soldTickets + quantity > raffle.totalTickets) return res.status(409).json({ error: "Cotas insuficientes para esta compra" });
        if (addonRaffle && addonRaffle.soldTickets + addonTickets > addonRaffle.totalTickets) return res.status(409).json({ error: "Cotas adicionais insuficientes" });

        if (existingCustomer && req.body.useBalance) {
          const ownAffiliate = getAffiliateForCustomer(existingCustomer);
          if (ownAffiliate) {
            const walletBalance = (ownAffiliate.commissionBalance || 0) + (ownAffiliate.prizeBalance || 0);
            const tenantScopedSettings = getTenantSettings(tenantId);
            walletUsage.enabled = Boolean(tenantScopedSettings.affiliateProgram.allowBalancePayments && ownAffiliate.useBalanceForPurchases && walletBalance > 0);
            walletUsage.amount = walletUsage.enabled ? Math.min(total, walletBalance) : 0;
          }
        }

        if (couponBenefit.bonusTickets || luckyBonusTickets || luckyExtraChance || doubleTicketsBonus || promotionBonusTickets) warnings.push("Bonus recalculado pelo servidor antes da reserva.");
        res.json({
          quantity,
          subtotal,
          total,
          pixAmount: Math.max(0, Number((total - walletUsage.amount).toFixed(2))),
          gateway: pixConfig.gateway,
          packageLabel: tickets >= 100 ? `${tickets.toLocaleString("pt-BR")} cotas` : undefined,
          bonuses: {
            bonusTickets: couponBenefit.bonusTickets + luckyBonusTickets + luckyExtraChance + orderBumpTickets + doubleTicketsBonus + promotionBonusTickets,
            doubleTickets: promotionSummary.doubleTickets || (doubleTicketsPromotion ? { applied: true, bonusTickets: doubleTicketsBonus, minTickets: doubleTicketsPromotion.minTickets, label: doubleTicketsPromotion.label } : { applied: false, bonusTickets: 0 }),
            doubleChance: Boolean(gamificationConfig.modules.doubleChance && isWithinWindow(Date.now(), gamificationConfig.doubleChance.startsAt, gamificationConfig.doubleChance.endsAt) && quantity >= gamificationConfig.doubleChance.minTickets),
            roulettes: Math.floor(quantity / 700) + promotionSummary.rewards.filter(reward => reward.type === "roulette").reduce((sum, reward) => sum + reward.quantity, 0),
            lootboxes: (raffle.lootboxEnabled ? Math.floor(quantity / 1000) : 0) + promotionSummary.rewards.filter(reward => ["lootbox", "mystery_box"].includes(reward.type)).reduce((sum, reward) => sum + reward.quantity, 0),
            scratchcards: Math.floor(quantity / 1800) + promotionSummary.rewards.filter(reward => reward.type === "scratchcard").reduce((sum, reward) => sum + reward.quantity, 0),
            description: promotionSummary.badges.map(badge => badge.label).join(" • ") || (doubleTicketsPromotion ? `${doubleTicketsPromotion.label}: +${doubleTicketsBonus} cotas extras` : orderBump ? "Compra em dobro aplicada no resumo" : undefined)
          },
          promotionSummary,
          upsellOffer: promotionSummary.upsellOffer,
          walletUsage,
          affiliateInfo,
          warnings
        });
        return;
      }

      if (type === "fazendinha") {
        const fazConfig = getFazendinhaConfig(tenantId);
        if (!fazConfig.enabled || fazConfig.status !== "active") return res.status(403).json({ error: "A Fazendinha nao esta ativa no momento" });
        if (!tenantPixGateways.pix?.enabled) return res.status(503).json({ error: "Gateway PIX indisponivel" });
        ensureFazendinhaStateForTenant(tenantId);
        const groupIds = Array.from(new Set((Array.isArray(req.body.groupIds) ? req.body.groupIds : []).map(String).filter(Boolean)));
        const selectedGroups = groupIds.map(groupId => fazendinhaGroups.find(item => item.tenant_id === tenantId && item.id === groupId)).filter((group): group is FazendinhaGroup => Boolean(group));
        if (!selectedGroups.length || selectedGroups.length !== groupIds.length) return res.status(404).json({ error: "Selecione grupos validos da Fazendinha" });
        const unavailable = selectedGroups.find(group => group.status !== "available");
        if (unavailable) return res.status(409).json({ error: `${unavailable.nomeBicho} ja foi reservado ou vendido` });
        const subtotal = selectedGroups.reduce((sum, group) => sum + group.preco, 0);
        const addonTickets = normalizeTickets(req.body.addon?.tickets) || 0;
        const addonRaffle = req.body.addon?.raffleId ? raffles.find(item => item.tenant_id === tenantId && item.id === req.body.addon.raffleId) : null;
        const addonAmount = addonRaffle ? addonTickets * addonRaffle.price : 0;
        const total = Number((subtotal + addonAmount).toFixed(2));
        res.json({
          quantity: selectedGroups.flatMap(group => group.numeros).length,
          subtotal,
          total,
          pixAmount: total,
          gateway,
          packageLabel: `${selectedGroups.length} grupo(s)`,
          bonuses: {
            lootboxes: fazConfig.lootboxEnabled ? selectedGroups.length : 0,
            roulettes: Math.floor(selectedGroups.length / 2),
            description: addonRaffle ? "Rifa adicional incluida no resumo" : undefined
          },
          walletUsage,
          affiliateInfo,
          warnings
        });
        return;
      }

      if (type === "modalidade") {
        const mode = String(req.body.mode || "") as NumberModeId;
        const config = getNumberModeConfig(tenantId, mode);
        if (!config || config.tenant_id !== tenantId) return res.status(404).json({ error: "Modalidade nao encontrada" });
        if (!config.enabled || config.status !== "active") return res.status(403).json({ error: "Modalidade indisponivel no momento" });
        if (!tenantPixGateways.pix?.enabled) return res.status(503).json({ error: "Gateway PIX indisponivel" });
        const requestedNumbers: unknown[] = Array.isArray(req.body.numbers) ? req.body.numbers : [];
        const numbers = Array.from(new Set(requestedNumbers.map(item => normalizeModeNumber(mode, item, tenantId)).filter((number): number is string => Boolean(number))));
        if (!numbers.length) return res.status(400).json({ error: "Selecione ao menos um numero valido" });
        const sold = new Set(numberModeBets.filter(bet => bet.tenant_id === tenantId && bet.mode === mode).map(bet => bet.number));
        const duplicate = numbers.find(number => sold.has(number));
        if (duplicate) return res.status(409).json({ error: `Numero ${duplicate} ja foi reservado ou vendido` });
        const total = Number((numbers.length * config.price).toFixed(2));
        res.json({
          quantity: numbers.length,
          subtotal: total,
          total,
          pixAmount: total,
          gateway,
          packageLabel: `${numbers.length} numero(s)`,
          bonuses: {
            lootboxes: config.lootboxEnabled ? Math.floor(numbers.length / 5) : 0,
            scratchcards: Math.floor(numbers.length / 10)
          },
          walletUsage,
          affiliateInfo,
          warnings
        });
        return;
      }

      res.status(400).json({ error: "Tipo de checkout invalido" });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Nao foi possivel calcular o checkout" });
    }
  });

  app.post("/api/raffles/:id/buy", criticalRateLimiter, async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    try {
      assertTenantOperationalForCheckout(tenants.find(item => item.id === tenantId));
    } catch (error) {
      res.status(403).json({ error: error instanceof Error ? error.message : "Tenant inativo ou indisponivel para compras" });
      return;
    }
    const { id } = req.params;
    const tickets = normalizeTickets(req.body.tickets);
    const addonTickets = normalizeTickets(req.body.addon?.tickets) || 0;
    const { contact, refCode, useBalance } = req.body;
    
    // Anti-fraud validation
    const ip = (req.ip || req.socket.remoteAddress) as string;
    if (tickets === null) {
      res.status(400).json({ error: "Quantidade inválida" });
      return;
    }
    let customer: CustomerRecord;
    try {
      customer = findOrCreateCustomer({ ...req.body.customer, contact }, refCode, getBrowserIdFromRequest(req), tenantId);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Cadastro inválido" });
      return;
    }

    const validationError = validatePurchaseFraud(customer.phone, tickets, ip);
    if (validationError) {
        recordSecurityEvent({ tenant_id: tenantId, action: "PURCHASE_BLOCKED", ip, status: "BLOCKED", severity: "high", actor: customer.phone, detail: validationError });
        res.status(403).json({ error: validationError });
        return;
    }

    const raffle = raffles.find(r => r.tenant_id === tenantId && r.id === id);
    if (!raffle) {
        res.status(404).json({ error: "Raffle not found" });
        return;
    }
    try {
      assertRaffleOpenForCheckout(raffle);
    } catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : "Rifa encerrada ou indisponivel" });
        return;
    }
    try {
      assertRaffleNotDrawLocked(tenantId, id);
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Cotas bloqueadas apos lock do sorteio" });
      return;
    }
    const pixConfig = getRafflePixConfig(raffle);
    if (!pixConfig.enabled) {
      res.status(503).json({ error: "PIX temporariamente desabilitado para este sorteio" });
      return;
    }
    expirePendingReservations(tenantId, id);

    if (raffle.soldTickets + tickets > raffle.totalTickets) {
        res.status(400).json({ error: "Quantidade indisponível" });
        return;
    }

    const addonRaffle = req.body.addon?.raffleId ? raffles.find(r => r.tenant_id === tenantId && r.id === req.body.addon.raffleId) : null;
    if (addonRaffle) expirePendingReservations(tenantId, addonRaffle.id);
    if (addonRaffle) {
      try {
        assertRaffleOpenForCheckout(addonRaffle);
      } catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : "Rifa adicional encerrada ou indisponivel" });
        return;
      }
    }
    if (addonRaffle && addonRaffle.soldTickets + addonTickets > addonRaffle.totalTickets) {
      res.status(400).json({ error: "Quantidade adicional indisponível" });
      return;
    }

    let coupon: CampaignCoupon | null = null;
    try {
      coupon = getActiveCoupon(req.body.couponCode, id, tickets, tenantId);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Cupom inválido" });
      return;
    }

    const gamificationConfig = getGamificationConfig(tenantId, id);
    const acceptedOrderBump = Boolean(req.body.orderBumpAccepted || req.body.upsellAccepted);
    const orderBump = acceptedOrderBump ? getActiveOrderBump(gamificationConfig) : null;
    const orderBumpTickets = orderBump ? Math.max(1, Math.floor(Number(orderBump.tickets || 0))) : 0;
    const orderBumpDiscount = orderBump ? Math.max(0, Math.min(100, Number(orderBump.discountPercent || 0))) : 0;
    const orderBumpAmount = orderBump ? Number((orderBumpTickets * raffle.price * (1 - orderBumpDiscount / 100)).toFixed(2)) : 0;
    const luckyHour = getActiveLuckyHour(gamificationConfig);
    const luckyDiscount = luckyHour?.type === "discount" ? Math.max(0, Number(luckyHour.value || 0)) : 0;
    const luckyBonusTickets = luckyHour?.type === "bonus" ? Math.max(0, Math.floor(Number(luckyHour.value || 0))) : 0;
    const luckyExtraChance = luckyHour?.type === "extraChance" ? Math.max(0, Math.floor(Number(luckyHour.value || 0))) : 0;
    const doubleTicketsPromotion = getActiveDoubleTicketsPromotion(gamificationConfig, tickets, customer);
    const doubleTicketsBonus = doubleTicketsPromotion?.bonusTickets || 0;
    const subtotalAmount = tickets * raffle.price + (addonRaffle ? addonTickets * addonRaffle.price : 0) + orderBumpAmount;
    const couponBenefit = calculateCouponBenefit(coupon, subtotalAmount, tickets);
    const amount = Math.max(0, Number((subtotalAmount - couponBenefit.discount - luckyDiscount).toFixed(2)));
    const promotionSummary = evaluatePromotionForRaffle({
      tenantId,
      raffleId: id,
      customer,
      quantity: tickets,
      amount,
      price: raffle.price,
      availableTickets: Math.max(0, raffle.totalTickets - raffle.soldTickets - tickets - couponBenefit.bonusTickets - luckyBonusTickets - luckyExtraChance - orderBumpTickets - doubleTicketsBonus),
      raffleStatus: raffle.status,
      orderId: createPublicId("PRE_"),
      refCode,
      paymentStatus: "pending"
    });
    const promotionBonusTickets = promotionSummary.bonusTickets || 0;
    const effectiveTickets = tickets + couponBenefit.bonusTickets + luckyBonusTickets + luckyExtraChance + orderBumpTickets + doubleTicketsBonus + promotionBonusTickets;
    if (raffle.soldTickets + effectiveTickets > raffle.totalTickets) {
      res.status(400).json({ error: "Quantidade com bônus indisponível" });
      return;
    }
    const advancedFraud = evaluateAdvancedPurchaseFraud(req, { tenantId, customer, tickets: effectiveTickets, amount, refCode, useBalance });
    if (advancedFraud.blocked) {
      recordSecurityEvent({ tenant_id: tenantId, action: "ADVANCED_FRAUD_CHECKOUT_BLOCKED", ip, status: "BLOCKED", severity: "high", actor: customer.phone, detail: `score=${advancedFraud.score}` });
      res.status(403).json({ error: "Checkout bloqueado temporariamente para revisao antifraude", fraudScore: advancedFraud.score });
      return;
    }
    const purchaseId = createPublicId();
    let reservedNumbers: number[] = [];
    let addonReservedNumbers: number[] = [];
    try {
      reservedNumbers = reserveAvailableNumbers(raffle, effectiveTickets);
      if (addonRaffle && addonTickets > 0) {
        addonReservedNumbers = reserveAvailableNumbers(addonRaffle, addonTickets);
      }
    } catch (error) {
      if (reservedNumbers.length) releaseReservedNumbers(raffle, reservedNumbers);
      if (addonRaffle && addonReservedNumbers.length) releaseReservedNumbers(addonRaffle, addonReservedNumbers);
      res.status(409).json({ error: error instanceof Error ? error.message : "Nao foi possivel reservar cotas disponiveis" });
      return;
    }
    const reservedUntil = reservationExpiresAt(TRADITIONAL_RAFFLE_RESERVATION_TTL_MS);
    
    const ownAffiliate = getAffiliateForCustomer(customer);
    const walletBalance = ownAffiliate ? (ownAffiliate.commissionBalance || 0) + (ownAffiliate.prizeBalance || 0) : 0;
    const tenantScopedSettings = getTenantSettings(tenantId);
    const balancePayment = useBalance && ownAffiliate && tenantScopedSettings.affiliateProgram.allowBalancePayments && ownAffiliate.useBalanceForPurchases && walletBalance >= amount ? amount : 0;
    const payableAmount = amount - balancePayment;

    const purchase: PurchaseRecord = {
      tenant_id: tenantId,
      purchaseId,
      raffleId: id,
      contact: customer.phone,
      tickets: effectiveTickets,
      amount,
      refCode, // Save ref
      status: balancePayment >= amount ? "paid" as const : "pending" as const,
      numeros: reservedNumbers,
      reservedUntil,
      pixExpiresAt: reservedUntil,
      pixPayload: buildPixPayload(payableAmount, raffle, purchaseId),
      pixGateway: pixConfig.gateway,
      pixWebhookUrl: pixConfig.webhookUrl,
      createdAt: new Date().toISOString(),
      customer,
      paidWithBalance: balancePayment,
      couponCode: coupon?.code,
      discountAmount: couponBenefit.discount,
      bonusTickets: couponBenefit.bonusTickets + luckyBonusTickets + luckyExtraChance + doubleTicketsBonus + promotionBonusTickets,
      gamification: {
        orderBump: orderBump ? { offered: true, accepted: true, tickets: orderBumpTickets, discountPercent: orderBumpDiscount, amount: orderBumpAmount } : (getActiveOrderBump(gamificationConfig) ? { offered: true, accepted: false, tickets: 0, discountPercent: 0, amount: 0 } : undefined),
        luckyHour: luckyHour ? { applied: true, type: luckyHour.type, value: luckyHour.value, bonusTickets: luckyBonusTickets, discount: luckyDiscount, extraChance: luckyExtraChance } : { applied: false },
        doubleTickets: promotionSummary.doubleTickets
          ? { applied: true, bonusTickets: promotionSummary.doubleTickets.bonusTickets, minTickets: promotionSummary.doubleTickets.minTickets || gamificationConfig.doubleTickets.minTickets || tickets, label: promotionSummary.doubleTickets.label }
          : (doubleTicketsPromotion ? { applied: true, bonusTickets: doubleTicketsBonus, minTickets: doubleTicketsPromotion.minTickets, label: doubleTicketsPromotion.label } : { applied: false, bonusTickets: 0, minTickets: gamificationConfig.doubleTickets.minTickets, label: gamificationConfig.doubleTickets.label || "Cotas em dobro" }),
        doubleChance: gamificationConfig.modules.doubleChance && isWithinWindow(Date.now(), gamificationConfig.doubleChance.startsAt, gamificationConfig.doubleChance.endsAt) && effectiveTickets >= gamificationConfig.doubleChance.minTickets
          ? { applied: true, weight: Math.max(2, Number(gamificationConfig.doubleChance.weight || 2)) }
          : { applied: false, weight: 1 }
      },
      promotionSummary
    };

    if (addonRaffle && addonTickets > 0) {
      purchase.linkedPurchases = [{
        tenant_id: tenantId,
        purchaseId: createPublicId(),
        raffleId: addonRaffle.id,
        contact: customer.phone,
        tickets: addonTickets,
        amount: addonTickets * addonRaffle.price,
        refCode,
        status: purchase.status,
        numeros: addonReservedNumbers,
        reservedUntil,
        pixExpiresAt: reservedUntil,
        pixPayload: purchase.pixPayload,
        pixGateway: pixConfig.gateway,
        pixWebhookUrl: pixConfig.webhookUrl,
        createdAt: purchase.createdAt,
        customer
      }];
    }

    if (balancePayment > 0 && ownAffiliate) {
      debitAffiliateWallet(ownAffiliate, balancePayment);
      ownAffiliate.history.push({ amount: -balancePayment, type: "balance_purchase", date: new Date().toISOString() });
    }

    try {
      await attachActiveGatewayPixToOrder({
        tenantId,
        purchase,
        customer,
        amount: payableAmount,
        description: `Pedido ${purchase.purchaseId} - ${raffle.title}`,
        pixExpiresAt: reservedUntil
      });
      if (purchase.linkedPurchases?.length) {
        purchase.linkedPurchases.forEach(linked => {
          linked.pixPayload = purchase.pixPayload;
          linked.pixGateway = purchase.pixGateway;
          linked.pixWebhookUrl = purchase.pixWebhookUrl;
          linked.externalReference = purchase.externalReference;
          linked.externalPaymentId = purchase.externalPaymentId;
          linked.pixQrCodeBase64 = purchase.pixQrCodeBase64;
          linked.pixExpiresAt = purchase.pixExpiresAt;
        });
      }
    } catch (error) {
      releaseReservedNumbers(raffle, reservedNumbers);
      if (addonRaffle && addonReservedNumbers.length) releaseReservedNumbers(addonRaffle, addonReservedNumbers);
      purchase.status = "cancelled";
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "asaas", purchaseId, status: "failed", message: error instanceof Error ? error.message : "Falha ao criar PIX Asaas", statusCode: 502, eventStatus: "PAYMENT_CREATE_FAILED" });
      res.status(502).json({ error: error instanceof Error ? error.message : "Falha ao criar PIX Asaas" });
      return;
    }

    if (coupon) coupon.used++;
    
    purchases.push(purchase);
    if (purchase.linkedPurchases) purchases.push(...purchase.linkedPurchases);
    schedulePersistentStateSave("checkout-purchase-created", 0);
    persistAppliedPromotions({ tenantId, raffleId: id, orderId: purchase.purchaseId, customer, amount, quantity: effectiveTickets }, promotionSummary);
    if (purchase.status === "pending") {
      scheduleAutomation("abandoned_pix_recovery", { tenant_id: tenantId, customer_id: customer.id, order_id: purchase.purchaseId, purchase, customer });
    }
    recordPublicActivityEvent({
      tenant_id: tenantId,
      raffle_id: id,
      event_type: purchase.status === "paid" ? "purchase_approved" : "purchase_created",
      customer,
      amount,
      quantity: effectiveTickets,
      metadata: { label: purchase.status === "paid" ? "compra aprovada" : "PIX pendente", source: "checkout", orderId: purchase.purchaseId }
    });
    scheduleAutomation("purchase_created", { tenant_id: tenantId, customer_id: customer.id, order_id: purchase.purchaseId, purchase, customer });
    if (purchase.status === "pending") scheduleAutomation("abandoned_pix_recovery", { tenant_id: tenantId, customer_id: customer.id, order_id: purchase.purchaseId, purchase, customer });
    void queueConversionEvent(tenantId, "InitiateCheckout", {
      purchaseId,
      raffleId: id,
      value: amount,
      currency: "BRL",
      tickets: effectiveTickets
    });

    if (gamificationConfig.modules.scratchcard) {
      const event: GamificationEvent = {
        tenant_id: tenantId,
        id: createPublicId("SCR_"),
        raffleId: id,
        purchaseId,
        customerId: customer.id,
        module: "scratchcard",
        status: "available",
        createdAt: purchase.createdAt
      };
      gamificationEvents.push(event);
      purchase.gamification = { ...(purchase.gamification || {}), scratchcardEventId: event.id };
      addGamificationLog(tenantId, "SCRATCHCARD_CREATED", event.id);
    }
    if (gamificationConfig.modules.mysteryBox) {
      const event: GamificationEvent = {
        tenant_id: tenantId,
        id: createPublicId("BOXEV_"),
        raffleId: id,
        purchaseId,
        customerId: customer.id,
        module: "mysteryBox",
        status: "available",
        createdAt: purchase.createdAt
      };
      gamificationEvents.push(event);
      purchase.gamification = { ...(purchase.gamification || {}), mysteryBoxEventId: event.id };
      addGamificationLog(tenantId, "MYSTERY_BOX_CREATED", event.id);
    }
    if (purchase.gamification?.orderBump) {
      gamificationEvents.push({
        tenant_id: tenantId,
        id: createPublicId("BUMP_"),
        raffleId: id,
        purchaseId,
        customerId: customer.id,
        module: "orderBump",
        status: purchase.gamification.orderBump.accepted ? "claimed" : "skipped",
        result: purchase.gamification.orderBump,
        createdAt: purchase.createdAt,
        resolvedAt: purchase.createdAt
      });
    }

    if (purchase.status === "paid") {
      confirmPurchase(purchase);
      purchase.linkedPurchases?.forEach(confirmPurchase);
    }

    res.json(stripSensitiveCustomerFields(purchase));
  });

  app.get("/api/raffles/:id/addon-suggestion", (req, res) => {
    const current = req.params.id;
    const suggestion = raffles.find(r => r.tenant_id === resolveRequestTenantId(req) && r.id !== current && r.status === "active" && r.soldTickets < r.totalTickets);
    if (!suggestion) {
      res.status(404).json({ error: "No suggestion available" });
      return;
    }
    const tickets = suggestion.price <= 0.2 ? 10 : 3;
    const { soldNumbers, ...safeRaffle } = suggestion;
    res.json({ raffle: safeRaffle, tickets, amount: tickets * suggestion.price });
  });

  app.get("/api/fazendinha", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    ensureFazendinhaStateForTenant(tenantId);
    expireFazendinhaReservations(tenantId);
    const config = getFazendinhaConfig(tenantId);
    const { tenant_id: _tenantId, ...publicConfig } = config;
    res.json({
      config: publicConfig,
      homeMedia: publicFazendinhaHomeMedia(tenantId),
      mediaSettings: publicFazendinhaMediaSettings(tenantId),
      groups: fazendinhaGroups.filter(item => item.tenant_id === tenantId),
      purchases: fazendinhaCompras.filter(item => item.tenant_id === tenantId),
      winners: fazendinhaGanhadores.filter(item => item.tenant_id === tenantId).slice(0, 8),
      results: fazendinhaResultados.filter(item => item.tenant_id === tenantId).slice(0, 5)
    });
  });

  app.get("/api/public/fazendinha/home-media", async (req, res) => {
    const resolution = await resolveDomainTenantInfo(req);
    const tenant = resolution.tenant || getRequestTenant(req);
    const tenantId = tenant?.id || legacyTenantId;
    res.json(publicFazendinhaHomeMedia(tenantId));
  });

  app.get("/api/public/fazendinha/media-settings", async (req, res) => {
    const resolution = await resolveDomainTenantInfo(req);
    const tenant = resolution.tenant || getRequestTenant(req);
    const tenantId = tenant?.id || legacyTenantId;
    res.json(publicFazendinhaMediaSettings(tenantId));
  });

  app.get("/api/public/promotions", async (req, res) => {
    const resolution = await resolveDomainTenantInfo(req);
    const tenant = resolution.tenant || getRequestTenant(req);
    const tenantId = tenant?.id || legacyTenantId;
    const raffleId = String(req.query.raffleId || req.query.raffle_id || "");
    const raffle = raffleId ? raffles.find(item => item.tenant_id === tenantId && item.id === raffleId) : undefined;
    const rules = getActivePromotions(tenantId, raffleId || null, promotionRules, new Date())
      .filter(rule => !rule.deleted_at)
      .map(publicPromotionRule);
    const ranking = raffleId
      ? getBuyerRanking(tenantId, raffleId, "tickets", 10).map(item => ({ ...item, name: maskBuyerName(item.name) }))
      : [];
    res.json({
      rules,
      ranking,
      badges: rules.map(rule => ({ label: rule.publicText, type: rule.type, promotionId: rule.id })),
      raffleStatus: raffle?.status || null
    });
  });

  app.get("/api/fazendinha/customer/:customerId/history", (req, res) => {
    res.json(fazendinhaCompras.filter(item => item.tenant_id === resolveRequestTenantId(req) && item.usuarioId === req.params.customerId));
  });

  app.get("/api/fazendinha/addon-suggestion", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const config = getFazendinhaConfig(tenantId);
    const suggestion = raffles.find(r => r.tenant_id === tenantId && r.status === "active" && r.soldTickets < r.totalTickets);
    if (!suggestion) {
      res.status(404).json({ error: "Nenhuma rifa ativa para sugestao" });
      return;
    }
    const tickets = Math.max(1, Number(config.addonSuggestionTickets || 5));
    const { soldNumbers, ...safeRaffle } = suggestion;
    res.json({ raffle: safeRaffle, tickets, amount: tickets * suggestion.price });
  });

  app.get("/api/modalidades", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const fazConfig = getFazendinhaConfig(tenantId);
    res.json({
      rifas: {
        id: "rifas",
        enabled: true,
        name: "Rifas",
        description: "Rifas tradicionais com cotas aleatorias e experiencia premium.",
        mediaUrl: raffles.find(raffle => raffle.tenant_id === tenantId)?.image || "",
        mediaType: "image",
        status: "active",
        ranking: purchases.filter(p => p.tenant_id === tenantId && p.status === "paid").slice(0, 5)
      },
      fazendinha: {
        ...fazConfig,
        id: "fazendinha",
        mediaUrl: fazConfig.mediaUrl,
        mediaType: fazConfig.mediaType,
        ranking: fazendinhaCompras.filter(item => item.tenant_id === tenantId).slice(0, 5)
      },
      numberModes: getNumberModeConfigsForTenant(tenantId)
        .filter(config => config.enabled && config.status === "active")
        .map(config => ({
          ...config,
          ranking: getModeRanking(config.id, tenantId)
        }))
    });
  });

  app.get("/api/modalidades/:mode", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const mode = req.params.mode as NumberModeId;
    const config = getNumberModeConfig(tenantId, mode);
    if (!config || config.tenant_id !== tenantId) {
      res.status(404).json({ error: "Modalidade nao encontrada" });
      return;
    }
    const customerId = String(req.query.customerId || "");
    expireNumberModeReservations(tenantId, mode);
    res.json({
      config,
      numbers: getModeNumbers(mode, tenantId),
      purchases: numberModePurchases.filter(item => item.tenant_id === tenantId && item.mode === mode),
      ranking: getModeRanking(mode, tenantId),
      winners: numberModeWinners.filter(item => item.tenant_id === tenantId && item.mode === mode).slice(0, 10),
      history: customerId ? numberModePurchases.filter(item => item.tenant_id === tenantId && item.mode === mode && item.customer.id === customerId) : []
    });
  });

  app.post("/api/modalidades/:mode/buy", criticalRateLimiter, async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    try {
      assertTenantOperationalForCheckout(tenants.find(item => item.id === tenantId));
    } catch (error) {
      res.status(403).json({ error: error instanceof Error ? error.message : "Tenant inativo ou indisponivel para compras" });
      return;
    }
    const mode = req.params.mode as NumberModeId;
    const config = getNumberModeConfig(tenantId, mode);
    if (!config || config.tenant_id !== tenantId) {
      res.status(404).json({ error: "Modalidade nao encontrada" });
      return;
    }
    if (!config.enabled || config.status !== "active") {
      res.status(403).json({ error: "Modalidade indisponivel no momento" });
      return;
    }
    if (!gateways.pix?.enabled) {
      res.status(503).json({ error: "PIX temporariamente desabilitado pelo admin" });
      return;
    }
    const requestedNumbers: unknown[] = Array.isArray(req.body.numbers) ? req.body.numbers : [];
    const normalizedNumbers = requestedNumbers
      .map((item: unknown) => normalizeModeNumber(mode, item, tenantId))
      .filter((number): number is string => Boolean(number));
    const numbers: string[] = Array.from(new Set<string>(normalizedNumbers));
    if (!numbers.length) {
      res.status(400).json({ error: "Selecione ao menos um numero valido" });
      return;
    }
    expireNumberModeReservations(tenantId, mode);
    const sold = new Set(numberModeBets.filter(bet => bet.tenant_id === tenantId && bet.mode === mode && ["reserved", "paid"].includes(bet.status)).map(bet => bet.number));
    const duplicate = numbers.find(number => sold.has(number));
    if (duplicate) {
      res.status(409).json({ error: `Numero ${duplicate} ja foi reservado ou vendido` });
      return;
    }

    let customer: CustomerRecord;
    try {
      customer = findOrCreateCustomer(req.body.customer || {}, req.body.refCode, getBrowserIdFromRequest(req), tenantId);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Cadastro invalido" });
      return;
    }

    // Payload publico nunca liquida pagamento. Campos como statusPagamento,
    // paymentStatus, status, paid e confirmed sao ignorados aqui.
    const paid = false;
    const fastExpiresAt = reservationExpiresAt(FAST_MODALITY_RESERVATION_TTL_MS);
    const purchase: NumberModePurchase = {
      id: createPublicId("MO_"),
      tenant_id: tenantId,
      mode,
      numbers,
      amount: numbers.length * config.price,
      status: "reserved",
      ...publicPendingPaymentState(),
      createdAt: new Date().toISOString(),
      reservedUntil: fastExpiresAt,
      pixExpiresAt: fastExpiresAt,
      customer,
      refCode: req.body.refCode
    };
    try {
      await attachActiveGatewayPixToOrder({
        tenantId,
        purchase,
        customer,
        amount: purchase.amount,
        description: `Pedido ${purchase.id} - ${config.name}`,
        pixExpiresAt: fastExpiresAt
      });
    } catch (error) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "asaas", purchaseId: purchase.id, status: "failed", message: error instanceof Error ? error.message : "Falha ao criar PIX Asaas", statusCode: 502, eventStatus: "PAYMENT_CREATE_FAILED" });
      res.status(502).json({ error: error instanceof Error ? error.message : "Falha ao criar PIX Asaas" });
      return;
    }
    numberModePurchases.unshift(purchase);
    numbers.forEach(number => {
      numberModeBets.push({
        id: createPublicId("AP_"),
        tenant_id: tenantId,
        mode,
        number,
        purchaseId: purchase.id,
        customerId: customer.id,
        status: purchase.status,
        createdAt: purchase.createdAt,
        reservedUntil: purchase.reservedUntil,
        pixExpiresAt: purchase.pixExpiresAt
      });
    });
    schedulePersistentStateSave("number-mode-reservation-created", 0);

    config.lootboxConfig = createScopedLootboxConfig(config.lootboxConfig);
    const earnedLootboxes = paid && config.lootboxEnabled
      ? processLootboxDrops(customer.phone, numbers.length, purchase.id, config.lootboxConfig, `mode:${mode}`, mode, tenantId)
      : 0;
    purchase.earnedLootboxes = earnedLootboxes;
    if (paid) {
      customer.totalTickets += numbers.length;
      ensureAffiliateForCustomer(customer, { forceEnable: true, source: "affiliate_auto_first_paid_purchase" });
      updateCrmAutomationForCustomer(customer);
      creditAffiliateCommission({
        tenantId,
      refCode: purchase.refCode,
      buyerCustomerId: customer.id,
      amount: purchase.amount,
      source: `conversion:${purchase.id}`,
      campaign: { type: "number_mode", id: purchase.mode },
      saleCreatedAt: purchase.createdAt
      });
    }
    const pixPayload = (purchase as NumberModePurchase & { pixPayload?: string }).pixPayload || buildPixPayload(purchase.amount, undefined, purchase.id, tenantId);
    res.json(stripSensitiveCustomerFields({ purchase, pixPayload, pixExpiresAt: purchase.pixExpiresAt, reservedUntil: purchase.reservedUntil, earnedLootboxes }));
  });

  app.post("/api/modalidades/purchases/:purchaseId/confirm-payment", (req, res) => {
    res.status(403).json({ error: "Confirmacao manual pelo cliente nao e permitida. Use Verificar pagamento e aguarde o webhook do gateway." });
  });

  async function createFazendinhaPurchase(req: express.Request, res: express.Response, requestedGroupIds: string[]) {
    const tenantId = resolveRequestTenantId(req);
    ensureFazendinhaStateForTenant(tenantId);
    const config = getFazendinhaConfig(tenantId);
    try {
      assertTenantOperationalForCheckout(tenants.find(item => item.id === tenantId));
    } catch (error) {
      res.status(403).json({ error: error instanceof Error ? error.message : "Tenant inativo ou indisponivel para compras" });
      return null;
    }
    if (!config.enabled || config.status !== "active") {
      res.status(403).json({ error: "A Fazendinha nao esta ativa no momento" });
      return null;
    }
    if (!getTenantGateways(tenantId).pix?.enabled) {
      res.status(503).json({ error: "PIX temporariamente desabilitado pelo admin" });
      return null;
    }
    const groupIds = Array.from(new Set(requestedGroupIds.filter(Boolean)));
    expireFazendinhaReservations(tenantId);
    const selectedGroups = groupIds
      .map(groupId => fazendinhaGroups.find(item => item.tenant_id === tenantId && item.id === groupId))
      .filter((group): group is FazendinhaGroup => Boolean(group));
    if (!selectedGroups.length || selectedGroups.length !== groupIds.length) {
      res.status(404).json({ error: "Selecione grupos validos da Fazendinha" });
      return null;
    }
    const unavailable = selectedGroups.find(group => group.status !== "available");
    if (unavailable) {
      res.status(409).json({ error: `${unavailable.nomeBicho} ja foi reservado ou vendido` });
      return null;
    }

    let customer: CustomerRecord;
    try {
      customer = findOrCreateCustomer(req.body.customer || {}, req.body.refCode, getBrowserIdFromRequest(req), tenantId);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Cadastro invalido" });
      return null;
    }

    // Payload publico nunca liquida pagamento. Campos como statusPagamento,
    // paymentStatus, status, paid e confirmed sao ignorados aqui.
    const paid = false;
    const numeros = selectedGroups.flatMap(group => group.numeros);
    const amount = selectedGroups.reduce((sum, group) => sum + group.preco, 0);
    const fastExpiresAt = reservationExpiresAt(FAST_MODALITY_RESERVATION_TTL_MS);
    const purchase: FazendinhaPurchase = {
      id: createPublicId("FZ_"),
      tenant_id: tenantId,
      usuarioId: customer.id,
      grupoId: selectedGroups[0].id,
      grupoIds: selectedGroups.map(group => group.id),
      nomeBicho: selectedGroups.map(group => group.nomeBicho).join(", "),
      nomeBichos: selectedGroups.map(group => group.nomeBicho),
      numeros,
      valorPago: amount,
      statusPagamento: "reserved",
      ...publicPendingPaymentState(),
      dataCompra: new Date().toISOString(),
      reservedUntil: fastExpiresAt,
      pixExpiresAt: fastExpiresAt,
      customer,
      refCode: req.body.refCode
    };

    const addonTickets = normalizeTickets(req.body.addon?.tickets) || Math.max(1, Number(config.addonSuggestionTickets || 5));
    const addonRaffle = req.body.addon?.raffleId ? raffles.find(r => r.tenant_id === tenantId && r.id === req.body.addon.raffleId) : null;
    if (addonRaffle && addonRaffle.soldTickets + addonTickets > addonRaffle.totalTickets) {
      res.status(400).json({ error: "Quantidade adicional indisponivel" });
      return null;
    }
    if (addonRaffle && addonTickets > 0) {
      const linked: PurchaseRecord = {
        tenant_id: tenantId,
        purchaseId: createPublicId("FZADD_"),
        raffleId: addonRaffle.id,
        contact: customer.phone,
        tickets: addonTickets,
        amount: addonTickets * addonRaffle.price,
        refCode: req.body.refCode,
        status: paid ? "paid" : "pending",
        numeros: [],
        reservedUntil: fastExpiresAt,
        pixExpiresAt: fastExpiresAt,
        pixPayload: "",
        createdAt: purchase.dataCompra,
        customer
      };
      if (paid) confirmPurchase(linked);
      purchases.push(linked);
      purchase.linkedPurchases = [linked];
      purchase.valorPago += linked.amount;
    }

    try {
      await attachActiveGatewayPixToOrder({
        tenantId,
        purchase,
        customer,
        amount: purchase.valorPago,
        description: `Pedido ${purchase.id} - Fazendinha`,
        pixExpiresAt: fastExpiresAt
      });
      purchase.linkedPurchases?.forEach(linked => {
        linked.pixPayload = (purchase as FazendinhaPurchase & { pixPayload?: string }).pixPayload || "";
        linked.pixGateway = "asaas";
        linked.pixWebhookUrl = "/api/webhooks/asaas";
        linked.externalReference = purchase.id;
        linked.externalPaymentId = (purchase as FazendinhaPurchase & { externalPaymentId?: string }).externalPaymentId;
        linked.pixQrCodeBase64 = (purchase as FazendinhaPurchase & { pixQrCodeBase64?: string }).pixQrCodeBase64;
        linked.pixExpiresAt = purchase.pixExpiresAt;
      });
    } catch (error) {
      if (purchase.linkedPurchases?.length) {
        purchases = purchases.filter(item => !purchase.linkedPurchases?.some(linked => linked.purchaseId === item.purchaseId));
      }
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "asaas", purchaseId: purchase.id, status: "failed", message: error instanceof Error ? error.message : "Falha ao criar PIX Asaas", statusCode: 502, eventStatus: "PAYMENT_CREATE_FAILED" });
      res.status(502).json({ error: error instanceof Error ? error.message : "Falha ao criar PIX Asaas" });
      return null;
    }

    const earnedLootboxes = paid && config.lootboxEnabled
      ? processFazendinhaLootboxDrops(customer.phone, selectedGroups.map(group => group.id), purchase.id, tenantId)
      : 0;
    purchase.earnedLootboxes = earnedLootboxes;
    if (paid) {
      customer.totalTickets += numeros.length;
      ensureAffiliateForCustomer(customer, { forceEnable: true, source: "affiliate_auto_first_paid_purchase" });
      updateCrmAutomationForCustomer(customer);
      creditAffiliateCommission({
        tenantId,
        refCode: purchase.refCode,
        buyerCustomerId: customer.id,
        amount,
        source: `conversion:${purchase.id}`,
        campaign: { type: "fazendinha", id: "fazendinha" },
        saleCreatedAt: purchase.dataCompra
      });
    }
    selectedGroups.forEach(group => {
      group.status = paid ? "sold" : "reserved";
      group.compradorId = customer.id;
      group.compraId = purchase.id;
    });
    fazendinhaCompras.unshift(purchase);
    schedulePersistentStateSave("fazendinha-reservation-created", 0);
    const pixPayload = (purchase as FazendinhaPurchase & { pixPayload?: string }).pixPayload || buildPixPayload(purchase.valorPago, undefined, purchase.id, tenantId);
    purchase.linkedPurchases?.forEach(linked => {
      linked.pixPayload = pixPayload;
    });
    return { purchase, groups: selectedGroups, pixPayload, pixExpiresAt: purchase.pixExpiresAt, reservedUntil: purchase.reservedUntil, earnedLootboxes };
  }

  function confirmFazendinhaPurchase(purchase: FazendinhaPurchase) {
    const config = getFazendinhaConfig(purchase.tenant_id);
    expireFazendinhaReservations(purchase.tenant_id);
    if (isFazendinhaReservationExpired(purchase)) {
      purchase.statusPagamento = "cancelled";
      purchase.paymentStatus = "cancelled";
      throw new Error("Fazendinha reservation expired");
    }
    const expectedGroupIds = purchase.grupoIds?.length ? purchase.grupoIds : [purchase.grupoId].filter((id): id is string => Boolean(id));
    const groups = fazendinhaGroups.filter(group => group.tenant_id === purchase.tenant_id && (expectedGroupIds.includes(group.id) || group.compraId === purchase.id));
    if (groups.length < expectedGroupIds.length) throw new Error("Fazendinha reservation expired");
    if (purchase.statusPagamento !== "paid" && groups.some(group => group.compraId !== purchase.id || !["reserved", "sold"].includes(group.status))) {
      throw new Error("Fazendinha reservation expired");
    }
    if (purchase.statusPagamento !== "paid") {
      purchase.statusPagamento = "paid";
      purchase.paymentStatus = "paid";
      purchase.paidAt = purchase.paidAt || new Date().toISOString();
      purchase.confirmedAt = purchase.confirmedAt || purchase.paidAt;
      groups.forEach(group => {
        group.status = "sold";
        group.compradorId = purchase.usuarioId;
        group.compraId = purchase.id;
      });
      purchase.customer.totalTickets += purchase.numeros.length;
      ensureAffiliateForCustomer(purchase.customer, { forceEnable: true, source: "affiliate_auto_first_paid_purchase" });
      updateCrmAutomationForCustomer(purchase.customer);
      purchase.linkedPurchases?.forEach(confirmPurchase);
      creditAffiliateCommission({
        tenantId: purchase.tenant_id,
        refCode: purchase.refCode,
        buyerCustomerId: purchase.customer.id,
        amount: groups.reduce((sum, group) => sum + Number(group.preco || config.pricePerGroup), 0),
        source: `conversion:${purchase.id}`,
        campaign: { type: "fazendinha", id: "fazendinha" },
        saleCreatedAt: purchase.dataCompra
      });
      purchase.earnedLootboxes = config.lootboxEnabled
        ? processFazendinhaLootboxDrops(purchase.customer.phone, groups.map(group => group.id), purchase.id, purchase.tenant_id)
        : 0;
      handlePurchaseConfirmedWhatsAppCloudEvent(purchase, "confirmFazendinhaPurchase");
    }

    const pixPayload = buildPixPayload(purchase.valorPago, undefined, purchase.id, purchase.tenant_id);
    return {
      purchase,
      groups,
      pixPayload,
      earnedLootboxes: purchase.earnedLootboxes || 0
    };
  }

  function confirmNumberModePurchase(purchase: NumberModePurchase) {
    expireNumberModeReservations(purchase.tenant_id, purchase.mode);
    if (purchase.status === "cancelled") throw new Error("Number mode reservation expired");
    if (purchase.status === "paid") return purchase;
    const bets = numberModeBets.filter(bet => bet.tenant_id === purchase.tenant_id && bet.purchaseId === purchase.id);
    if (bets.length < purchase.numbers.length) throw new Error("Number mode reservation expired");
    purchase.status = "paid";
    purchase.paymentStatus = "paid";
    purchase.paidAt = purchase.paidAt || new Date().toISOString();
    purchase.confirmedAt = purchase.confirmedAt || purchase.paidAt;
    bets.forEach(bet => {
      bet.status = "paid";
    });
    purchase.customer.totalTickets += purchase.numbers.length;
    ensureAffiliateForCustomer(purchase.customer, { forceEnable: true, source: "affiliate_auto_first_paid_purchase" });
    updateCrmAutomationForCustomer(purchase.customer);
    creditAffiliateCommission({
      tenantId: purchase.tenant_id,
      refCode: purchase.refCode,
      buyerCustomerId: purchase.customer.id,
      amount: purchase.amount,
      source: `conversion:${purchase.id}`,
      campaign: { type: "number_mode", id: purchase.mode },
      saleCreatedAt: purchase.createdAt
    });
    const config = getNumberModeConfig(purchase.tenant_id, purchase.mode);
    purchase.earnedLootboxes = config?.lootboxEnabled
      ? processLootboxDrops(purchase.customer.phone, purchase.numbers.length, purchase.id, config.lootboxConfig, `mode:${purchase.mode}`, purchase.mode, purchase.tenant_id)
      : 0;
    handlePurchaseConfirmedWhatsAppCloudEvent(purchase, "confirmNumberModePurchase");
    return purchase;
  }

  app.post("/api/fazendinha/buy", criticalRateLimiter, async (req, res) => {
    const groupIds = Array.isArray(req.body.groupIds) ? req.body.groupIds.map(String) : [];
    const result = await createFazendinhaPurchase(req, res, groupIds);
    if (!result) return;
    res.json(stripSensitiveCustomerFields(result));
  });

  app.post("/api/fazendinha/groups/:groupId/buy", criticalRateLimiter, async (req, res) => {
    const result = await createFazendinhaPurchase(req, res, [req.params.groupId]);
    if (!result) return;
    res.json(stripSensitiveCustomerFields({ ...result, group: result.groups[0] }));
  });

  app.post("/api/fazendinha/purchases/:purchaseId/confirm-payment", (req, res) => {
    res.status(403).json({ error: "Confirmacao manual pelo cliente nao e permitida. Use Verificar pagamento e aguarde o webhook do gateway." });
  });

  app.get("/api/admin/fazendinha", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    ensureFazendinhaStateForTenant(tenantId);
    const config = getFazendinhaConfig(tenantId);
    res.json({
      config,
      homeMedia: publicFazendinhaHomeMedia(tenantId),
      mediaSettings: publicFazendinhaMediaSettings(tenantId),
      groups: scoped(fazendinhaGroups, req),
      purchases: scoped(fazendinhaCompras, req),
      results: scoped(fazendinhaResultados, req),
      winners: scoped(fazendinhaGanhadores, req)
    });
  });

  app.get("/api/admin/fazendinha/home-media", (req, res) => {
    res.json(publicFazendinhaHomeMedia(resolveRequestTenantId(req)));
  });

  app.put("/api/admin/fazendinha/home-media", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    fazendinhaHomeMediaSettings[tenantId] = normalizeFazendinhaHomeMedia(tenantId, req.body || {});
    recordAuditLedger(req, { tenant_id: tenantId, action: "FAZENDINHA_HOME_MEDIA_UPDATED", resource_type: "fazendinha_home_media", resource_id: tenantId, before_data: null, after_data: publicFazendinhaHomeMedia(tenantId), reason: String(req.body.reason || "Atualizacao da midia da Fazendinha na Home") });
    res.json(publicFazendinhaHomeMedia(tenantId));
  });

  app.get("/api/admin/fazendinha/media-settings", (req, res) => {
    res.json(publicFazendinhaMediaSettings(resolveRequestTenantId(req)));
  });

  app.put("/api/admin/fazendinha/media-settings", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const before = publicFazendinhaMediaSettings(tenantId);
    const after = normalizeFazendinhaMediaSettings(tenantId, req.body || {});
    recordAuditLedger(req, { tenant_id: tenantId, action: "FAZENDINHA_MEDIA_SETTINGS_UPDATED", resource_type: "fazendinha_media_settings", resource_id: tenantId, before_data: before, after_data: after, reason: String(req.body.reason || "Atualizacao das midias da Fazendinha") });
    res.json(after);
  });

  app.put("/api/admin/fazendinha/config", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const config = updateFazendinhaConfig(tenantId, req.body || {});
    fazendinhaGroups = fazendinhaGroups.map(group => group.tenant_id === tenantId ? ({
      ...group,
      preco: req.body.pricePerGroup !== undefined && group.status === "available"
        ? Number(req.body.pricePerGroup)
        : group.preco
    }) : group);
    res.json({ config, groups: scoped(fazendinhaGroups, req) });
  });

  app.post("/api/admin/fazendinha/result", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const config = getFazendinhaConfig(tenantId);
    if (config.status === "closed" && config.resultNumber) {
      res.status(409).json({ error: "Rodada ja encerrada. Resete a rodada para lançar um novo resultado." });
      return;
    }
    const numeroSorteado = normalizeFazendinhaNumber(req.body.numeroSorteado);
    if (!numeroSorteado) {
      res.status(400).json({ error: "Numero sorteado invalido" });
      return;
    }
    res.json(resolveFazendinhaWinner(numeroSorteado, req.body.origemResultado || "Loteria", tenantId));
  });

  app.get("/api/admin/modalidades", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    res.json({
      configs: getNumberModeConfigsForTenant(tenantId).filter(item => adminCanAccessTenant(req, item.tenant_id)),
      purchases: scoped(numberModePurchases, req),
      bets: scoped(numberModeBets, req),
      winners: scoped(numberModeWinners, req),
      fazendinha: {
        config: getFazendinhaConfig(tenantId),
        groups: scoped(fazendinhaGroups, req),
        purchases: scoped(fazendinhaCompras, req),
        winners: scoped(fazendinhaGanhadores, req)
      }
    });
  });

  app.put("/api/admin/modalidades/:mode/config", (req, res) => {
    const mode = req.params.mode as NumberModeId;
    const tenantId = resolveRequestTenantId(req);
    const config = getNumberModeConfig(tenantId, mode);
    if (!config || !adminCanAccessTenant(req, config.tenant_id)) {
      res.status(404).json({ error: "Modalidade nao encontrada" });
      return;
    }
    const key = numberModeConfigKey(tenantId, mode);
    numberModeConfigs[key] = {
      ...config,
      ...normalizeMediaPayload(req.body),
      id: mode,
      tenant_id: config.tenant_id,
      digits: config.digits,
      lootboxConfig: createScopedLootboxConfig(req.body.lootboxConfig || config.lootboxConfig)
    };
    res.json(numberModeConfigs[key]);
  });

  app.post("/api/admin/modalidades/result", (req, res) => {
    const officialResult = String(req.body.officialResult || "");
    if (officialResult.replace(/\D/g, "").length < 1) {
      res.status(400).json({ error: "Resultado oficial invalido" });
      return;
    }
    res.json(resolveNumberModesFromOfficialResult(officialResult, req.body.origemResultado || "Loteria", resolveRequestTenantId(req)));
  });

  app.post("/api/admin/modalidades/:mode/result", (req, res) => {
    const mode = req.params.mode as NumberModeId;
    const tenantId = resolveRequestTenantId(req);
    const config = getNumberModeConfig(tenantId, mode);
    if (!config || !adminCanAccessTenant(req, config.tenant_id)) {
      res.status(404).json({ error: "Modalidade nao encontrada" });
      return;
    }
    const result = resolveSingleNumberModeResult(mode, String(req.body.resultNumber || req.body.officialResult || ""), req.body.origemResultado || "Loteria", tenantId);
    if (!result) {
      res.status(400).json({ error: "Resultado invalido para a modalidade" });
      return;
    }
    res.json(result);
  });

  app.post("/api/admin/fazendinha/reset", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    ensureFazendinhaStateForTenant(tenantId);
    resetFazendinhaRound(tenantId);
    res.json({ config: getFazendinhaConfig(tenantId), groups: scoped(fazendinhaGroups, req) });
  });

  function createScopedLootboxConfig(config?: Partial<LootboxEconomy>): LootboxEconomy {
    const defaultWheelSegments: RewardWheelSegment[] = [
      { label: "PREMIO", color: "#f59e0b" },
      { label: "TENTE", color: "#334155" },
      { label: "PIX", color: "#06b6d4" },
      { label: "TENTE", color: "#475569" },
      { label: "BONUS", color: "#10b981" },
      { label: "TENTE", color: "#334155" },
      { label: "PREMIO", color: "#e11d48" },
      { label: "TENTE", color: "#475569" }
    ];
    const legacyExperience = config?.experienceType === "box" ? "box" : "wheel";
    const rewardModes = config?.rewardModes
      ? { box: Boolean(config.rewardModes.box), wheel: Boolean(config.rewardModes.wheel) }
      : { box: legacyExperience === "box", wheel: legacyExperience === "wheel" };
    return {
      experienceType: rewardModes.wheel ? "wheel" : "box",
      rewardModes,
      ticketsPerBox: Number(config?.ticketsPerBox || settings.lootboxEconomy.ticketsPerBox || 3),
      globalTicketsCounter: Number(config?.globalTicketsCounter || 0),
      boxRules: config?.boxRules?.length
        ? config.boxRules.map(rule => ({ tickets: Math.max(1, Number(rule.tickets || 1)), boxes: Math.max(1, Number(rule.boxes || 1)) }))
        : [{ tickets: Number(settings.lootboxEconomy.ticketsPerBox || 3), boxes: 1 }],
      milestones: config?.milestones?.length
        ? config.milestones.map(milestone => ({
          tier: milestone.tier || "mini",
          everyXTickets: Math.max(1, Number(milestone.everyXTickets || 500)),
          name: milestone.name || "R$ 5",
          type: milestone.type || "pix",
          value: Number(milestone.value || 5),
          currentCounter: Math.max(0, Number(milestone.currentCounter || 0))
        }))
        : settings.lootboxEconomy.milestones.map(milestone => ({ ...milestone, currentCounter: 0 })),
      wheelSegments: config?.wheelSegments?.length
        ? config.wheelSegments.slice(0, 10).map((segment, index) => ({
          label: String(segment.label || defaultWheelSegments[index % defaultWheelSegments.length].label).slice(0, 20),
          color: /^#[0-9a-f]{6}$/i.test(String(segment.color || "")) ? String(segment.color) : defaultWheelSegments[index % defaultWheelSegments.length].color,
          imageUrl: segment.imageUrl ? String(segment.imageUrl) : undefined,
          rewardEnabled: Boolean(segment.rewardEnabled),
          reward: segment.rewardEnabled ? {
            tier: segment.reward?.tier || "mini",
            everyXTickets: Math.max(1, Number(segment.reward?.everyXTickets || 500)),
            name: segment.reward?.name || segment.label || "Premio da paleta",
            type: segment.reward?.type || "pix",
            value: Number(segment.reward?.value || 0),
            currentCounter: Math.max(0, Number(segment.reward?.currentCounter || 0))
          } : undefined
        }))
        : defaultWheelSegments,
      effects: {
        autoOpen: Boolean(config?.effects?.autoOpen ?? settings.lootboxEconomy.effects.autoOpen),
        sfx: Boolean(config?.effects?.sfx ?? settings.lootboxEconomy.effects.sfx),
        vfx: Boolean(config?.effects?.vfx ?? settings.lootboxEconomy.effects.vfx),
        confetti: Boolean(config?.effects?.confetti ?? settings.lootboxEconomy.effects.confetti)
      }
    };
  }

  function createFazendinhaLootboxConfig(config?: Partial<FazendinhaLootboxConfig>): FazendinhaLootboxConfig {
    const base = createScopedLootboxConfig(config);
    const winningGroupId = fazendinhaSeed.some(([id]) => id === config?.winningGroupId)
      ? String(config?.winningGroupId)
      : "leao";

    return {
      ...base,
      strategy: "group",
      winningGroupId,
      boxesPerGroup: Math.max(1, Number(config?.boxesPerGroup || 1)),
      prizeName: config?.prizeName || "Presente da Caixinha",
      prizeType: config?.prizeType || "pix",
      prizeValue: Number(config?.prizeValue || 50),
      prizeRarity: config?.prizeRarity || "legendary",
      prizeClaimed: Boolean(config?.prizeClaimed),
      winnerPurchaseId: config?.winnerPurchaseId
    };
  }

  function getRaffleLootboxConfig(raffle: typeof raffles[number]) {
    raffle.lootboxConfig = createScopedLootboxConfig(raffle.lootboxConfig);
    return raffle.lootboxConfig;
  }

  function getLootboxConfigByScope(scopeId = "global") {
    if (scopeId === "fazendinha") {
      const config = getFazendinhaConfig(legacyTenantId);
      config.lootboxConfig = createFazendinhaLootboxConfig(config.lootboxConfig);
      updateFazendinhaConfig(legacyTenantId, config);
      return config.lootboxConfig;
    }

    if (scopeId.startsWith("mode:")) {
      const mode = scopeId.replace("mode:", "") as NumberModeId;
      if (numberModeConfigs[mode]) {
        numberModeConfigs[mode].lootboxConfig = createScopedLootboxConfig(numberModeConfigs[mode].lootboxConfig);
        return numberModeConfigs[mode].lootboxConfig;
      }
    }

    if (scopeId.startsWith("raffle:")) {
      const raffleId = scopeId.replace("raffle:", "");
      const raffle = raffles.find(item => String(item.id) === raffleId);
      if (raffle) return getRaffleLootboxConfig(raffle);
    }

    return createScopedLootboxConfig(settings.lootboxEconomy);
  }

  function calculateEarnedLootboxes(tickets: number, economy: LootboxEconomy) {
    const rules = economy.boxRules?.length
      ? economy.boxRules
      : [{ tickets: economy.ticketsPerBox, boxes: 1 }];

    return rules.reduce((best, rule) => {
      if (!rule.tickets || rule.tickets < 1) return best;
      return Math.max(best, Math.floor(tickets / rule.tickets) * Math.max(1, rule.boxes || 1));
    }, 0);
  }

  function getEnabledRewardModes(economy: LootboxEconomy): Array<"wheel" | "box"> {
    const modes: Array<"wheel" | "box"> = [];
    if (economy.rewardModes.box) modes.push("box");
    if (economy.rewardModes.wheel) modes.push("wheel");
    return modes;
  }

  function processLootboxDrops(
    contact: string,
    tickets: number,
    purchaseId: string,
    economy: LootboxEconomy = createScopedLootboxConfig(settings.lootboxEconomy),
    scopeId = "global",
    scopeType: LootboxRecord["scopeType"] = "global",
    tenantId = legacyTenantId
  ) {
     const userKey = tenantCustomerKey(tenantId, normalizePhone(contact) || contact);
     economy.globalTicketsCounter = Number(economy.globalTicketsCounter || 0) + tickets;
     const enabledModes = getEnabledRewardModes(economy);
     const wheelRewardRules = economy.wheelSegments
       .map((segment, index) => ({ segment, index }))
       .filter(item => item.segment.rewardEnabled && item.segment.reward);

     enabledModes.forEach(experienceType => {
       const poolKey = `${scopeId}:${experienceType}`;
       if (!lootboxGuaranteedPools[poolKey]) lootboxGuaranteedPools[poolKey] = [];
       const usesSharedFallback = experienceType === "wheel" && wheelRewardRules.length === 0 && !economy.rewardModes.box;
       const rewardRules: Array<{ milestone: LootboxMilestone; segmentIndex?: number; segmentLabel?: string }> = experienceType === "wheel" && wheelRewardRules.length
         ? wheelRewardRules.map(item => ({ milestone: item.segment.reward!, segmentIndex: item.index, segmentLabel: item.segment.label }))
         : experienceType === "box" || usesSharedFallback
           ? economy.milestones.map(milestone => ({ milestone }))
           : [];

       // Cada premio nasce pelas vendas do escopo e fica reservado ao jogo correspondente.
       rewardRules.forEach(({ milestone: m, segmentIndex, segmentLabel }) => {
         m.currentCounter = Number(m.currentCounter || 0) + tickets;
         while (m.currentCounter >= m.everyXTickets) {
           const rarity: PrizeRarity = m.tier === "alto" ? "legendary" : m.tier === "medio" ? "epic" : m.value >= 50 ? "rare" : "common";
           lootboxGuaranteedPools[poolKey].push({ name: m.name, value: m.value, type: m.type, rarity, tier: m.tier, wheelSegmentIndex: segmentIndex, wheelSegmentLabel: segmentLabel });
           m.currentCounter -= m.everyXTickets;
         }
       });
     });

     // A compra gera aberturas apenas pelas regras de cotas do cliente.
     if (!lootboxes[userKey]) {
         lootboxes[userKey] = { boxes: [], history: [] };
     }
     const earnedPerMode = calculateEarnedLootboxes(tickets, economy);
     const earnedBoxes = earnedPerMode * enabledModes.length;
     
     if (earnedPerMode > 0) {
       enabledModes.forEach(experienceType => {
          const poolKey = `${scopeId}:${experienceType}`;
          for (let i = 0; i < earnedPerMode; i++) {
             // Reserva FIFO: a primeira abertura adquirida apos a meta recebe o premio pendente do jogo escolhido.
             const lockedPrize = lootboxGuaranteedPools[poolKey].shift() || null;
             lootboxes[userKey].boxes.push({
              id: createPublicId("BOX_"),
              tenant_id: tenantId,
              userId: userKey,
              purchaseId,
              scopeId,
              scopeType,
              experienceType,
              effects: { ...economy.effects },
              wheelSegments: economy.wheelSegments.map(segment => ({ ...segment, reward: segment.reward ? { ...segment.reward } : undefined })),
              status: "closed",
              premiada: Boolean(lockedPrize),
              valorPremio: lockedPrize?.value || 0,
              tipoPremio: lockedPrize?.type,
              lockedPrize,
              createdAt: new Date().toISOString()
            });
          }
       });
     }

     return earnedBoxes;
   }

  function processFazendinhaLootboxDrops(contact: string, selectedGroupIds: string[], purchaseId: string, tenantId = legacyTenantId) {
     const fazConfig = getFazendinhaConfig(tenantId);
     fazConfig.lootboxConfig = createFazendinhaLootboxConfig(fazConfig.lootboxConfig);
     updateFazendinhaConfig(tenantId, fazConfig);
     const config = fazConfig.lootboxConfig;
     return processLootboxDrops(contact, selectedGroupIds.length, purchaseId, config, "fazendinha", "fazendinha", tenantId);
   }

  function getWhatsAppConfig(tenantId: string) {
    return whatsappProviderConfigs.find(config => config.tenant_id === tenantId) || null;
  }

  function sanitizeWhatsAppConfig(config: WhatsAppProviderConfigRecord | null) {
    if (!config) {
      return {
        provider: "mock",
        enabled: false,
        environment: "sandbox",
        phone_number_id: "",
        business_account_id: "",
        access_token: "",
        webhook_verify_token: "",
        template_namespace: "",
        default_language: "pt_BR"
      };
    }
    return {
      id: config.id,
      tenant_id: config.tenant_id,
      provider: config.provider,
      enabled: config.enabled,
      environment: config.environment,
      phone_number_id: config.phone_number_id || "",
      business_account_id: config.business_account_id || "",
      access_token: config.access_token_encrypted ? maskGatewaySecret(config.access_token_encrypted) : "",
      webhook_verify_token: config.webhook_verify_token_encrypted ? maskGatewaySecret(config.webhook_verify_token_encrypted) : "",
      template_namespace: config.template_namespace || "",
      default_language: config.default_language || "pt_BR",
      created_at: config.created_at,
      updated_at: config.updated_at
    };
  }

  function getWhatsAppCloudConfig(tenantId: string) {
    return whatsappCloudConfigs.find(config => config.tenant_id === tenantId) || null;
  }

  function sanitizeWhatsAppCloudConfig(config: WhatsAppCloudConfigRecord | null) {
    if (!config) {
      return {
        enabled: false,
        account_name: "",
        business_manager_id: "",
        whatsapp_business_account_id: "",
        phone_number_id: "",
        access_token: "",
        webhook_verify_token: "",
        webhook_url: "/api/webhooks/meta/whatsapp",
        environment: "sandbox",
        created_at: "",
        updated_at: ""
      };
    }
    return {
      id: config.id,
      tenant_id: config.tenant_id,
      enabled: config.enabled,
      account_name: config.account_name,
      business_manager_id: config.business_manager_id,
      whatsapp_business_account_id: config.whatsapp_business_account_id,
      phone_number_id: config.phone_number_id,
      access_token: config.access_token_encrypted ? maskGatewaySecret(config.access_token_encrypted) : "",
      webhook_verify_token: config.webhook_verify_token_encrypted ? maskGatewaySecret(config.webhook_verify_token_encrypted) : "",
      webhook_url: config.webhook_url || "/api/webhooks/meta/whatsapp",
      environment: config.environment,
      created_at: config.created_at,
      updated_at: config.updated_at
    };
  }

  function sanitizeWhatsAppCloudLog(log: WhatsAppCloudLogRecord) {
    return {
      ...log,
      message: maskSecretText(log.message),
      metadata: maskLogValue(log.metadata) as Record<string, unknown>
    };
  }

  function recordWhatsAppCloudLog(tenantId: string, input: Omit<WhatsAppCloudLogRecord, "id" | "tenant_id" | "created_at">) {
    const log: WhatsAppCloudLogRecord = {
      id: createPublicId("WCL_"),
      tenant_id: tenantId,
      action: input.action,
      status: input.status,
      message: maskSecretText(input.message || ""),
      metadata: (maskLogValue(input.metadata || {}) || {}) as Record<string, unknown>,
      created_at: new Date().toISOString()
    };
    whatsappCloudLogs.unshift(log);
    whatsappCloudLogs = whatsappCloudLogs.slice(0, 1000);
    return log;
  }

  function sanitizeWhatsAppCloudTemplate(template: WhatsAppCloudTemplateRecord) {
    return {
      id: template.id,
      tenant_id: template.tenant_id,
      name: template.name,
      status: template.status,
      language: template.language,
      category: template.category,
      components: Array.isArray(template.components) ? template.components : [],
      synced_at: template.synced_at
    };
  }

  function getSavedWhatsAppCloudTemplates(tenantId: string) {
    return whatsappCloudTemplates
      .filter(template => template.tenant_id === tenantId)
      .sort((a, b) => a.name.localeCompare(b.name) || a.language.localeCompare(b.language));
  }

  function normalizeWhatsAppCloudTemplateSnapshot(tenantId: string, template: Record<string, unknown>, syncedAt: string): WhatsAppCloudTemplateRecord {
    const name = String(template.name || "").trim();
    const language = String(template.language || "").trim() || "pt_BR";
    return {
      id: `${tenantId}:${name}:${language}`,
      tenant_id: tenantId,
      name,
      status: String(template.status || "PENDING").toUpperCase(),
      language,
      category: String(template.category || "").trim(),
      components: Array.isArray(template.components) ? template.components : [],
      synced_at: syncedAt
    };
  }

  function defaultWhatsAppPixRecoverySettings(tenantId: string): WhatsAppPixRecoverySettingsRecord {
    const now = new Date().toISOString();
    return {
      id: `${tenantId}:whatsapp-pix-recovery`,
      tenant_id: tenantId,
      enabled: false,
      pending_template_name: "",
      pending_template_language: "pt_BR",
      expired_template_name: "",
      expired_template_language: "pt_BR",
      min_age_minutes: 15,
      per_customer_cooldown_hours: 24,
      daily_tenant_limit: 100,
      mode: "manual",
      created_at: now,
      updated_at: now
    };
  }

  function getWhatsAppPixRecoverySettings(tenantId: string) {
    return whatsappPixRecoverySettings.find(item => item.tenant_id === tenantId) || defaultWhatsAppPixRecoverySettings(tenantId);
  }

  function sanitizeWhatsAppPixRecoverySettings(settingsRecord: WhatsAppPixRecoverySettingsRecord) {
    return {
      id: settingsRecord.id,
      tenant_id: settingsRecord.tenant_id,
      enabled: settingsRecord.enabled,
      pending_template_name: settingsRecord.pending_template_name,
      pending_template_language: settingsRecord.pending_template_language,
      expired_template_name: settingsRecord.expired_template_name,
      expired_template_language: settingsRecord.expired_template_language,
      min_age_minutes: settingsRecord.min_age_minutes,
      per_customer_cooldown_hours: settingsRecord.per_customer_cooldown_hours,
      daily_tenant_limit: settingsRecord.daily_tenant_limit,
      mode: settingsRecord.mode,
      created_at: settingsRecord.created_at,
      updated_at: settingsRecord.updated_at
    };
  }

  function upsertWhatsAppPixRecoverySettings(req: express.Request, tenantId: string) {
    const current = getWhatsAppPixRecoverySettings(tenantId);
    const now = new Date().toISOString();
    const next: WhatsAppPixRecoverySettingsRecord = {
      ...current,
      enabled: Boolean(req.body?.enabled),
      pending_template_name: String(req.body?.pending_template_name || req.body?.pendingTemplateName || current.pending_template_name || "").trim(),
      pending_template_language: String(req.body?.pending_template_language || req.body?.pendingTemplateLanguage || current.pending_template_language || "pt_BR").trim() || "pt_BR",
      expired_template_name: String(req.body?.expired_template_name || req.body?.expiredTemplateName || current.expired_template_name || "").trim(),
      expired_template_language: String(req.body?.expired_template_language || req.body?.expiredTemplateLanguage || current.expired_template_language || "pt_BR").trim() || "pt_BR",
      min_age_minutes: Math.min(24 * 60, Math.max(1, Math.floor(Number(req.body?.min_age_minutes ?? req.body?.minAgeMinutes ?? current.min_age_minutes ?? 15)))),
      per_customer_cooldown_hours: Math.min(168, Math.max(1, Math.floor(Number(req.body?.per_customer_cooldown_hours ?? req.body?.perCustomerCooldownHours ?? current.per_customer_cooldown_hours ?? 24)))),
      daily_tenant_limit: Math.min(1000, Math.max(1, Math.floor(Number(req.body?.daily_tenant_limit ?? req.body?.dailyTenantLimit ?? current.daily_tenant_limit ?? 100)))),
      mode: req.body?.mode === "automatic" ? "automatic" : "manual",
      updated_at: now
    };
    whatsappPixRecoverySettings = [
      next,
      ...whatsappPixRecoverySettings.filter(item => item.tenant_id !== tenantId)
    ];
    recordWhatsAppCloudLog(tenantId, {
      action: "pix_recovery_settings_saved",
      status: "success",
      message: "Recuperacao automatica de PIX salva",
      metadata: { mode: next.mode, enabled: next.enabled, adminId: getAuthSession(req)?.sub || "" }
    });
    schedulePersistentStateSave("whatsapp-pix-recovery-settings");
    return next;
  }

  function sanitizeWhatsAppQueueRecord(message: WhatsAppMessageQueueRecord) {
    return {
      ...message,
      phone: maskPhone(message.phone),
      payload: maskLogValue(message.payload || {}) as Record<string, unknown>
    };
  }

  function buildWhatsAppDashboardDaySeries(days: number) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) };
    });
  }

  function whatsappDashboardTimestamp(value: unknown) {
    const time = new Date(String(value || "")).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function whatsappDashboardMessageTime(message: WhatsAppConversationMessageRecord | WhatsAppMessageQueueRecord) {
    if ("tenantId" in message) return whatsappDashboardTimestamp(message.sentAt || message.receivedAt);
    return whatsappDashboardTimestamp(message.sent_at || message.processed_at || message.updated_at || message.created_at);
  }

  function whatsappDashboardOrderAmount(tenantId: string, message: WhatsAppMessageQueueRecord) {
    const orderType = (message.payload?.orderType === "fazendinha" || message.payload?.orderType === "number_mode" || message.payload?.orderType === "raffle")
      ? message.payload.orderType as WhatsAppOrderType
      : undefined;
    const order = message.order_id ? findWhatsAppOrderSource(tenantId, message.order_id, orderType) : null;
    if (!order) return { recovered: false, amount: 0, paidAt: "" };
    const candidate = buildWhatsAppOrderCandidate(order);
    const recovered = candidate.status === "paid" || candidate.paymentStatus === "paid";
    return { recovered, amount: recovered ? Number(candidate.amount || 0) : 0, paidAt: candidate.paidAt || "" };
  }

  function whatsappDashboardStatusRank(status: string) {
    const normalized = status.toLowerCase();
    if (normalized === "read") return 4;
    if (normalized === "delivered") return 3;
    if (normalized === "sent") return 2;
    if (normalized === "failed") return 1;
    return 0;
  }

  function whatsappDashboardEffectiveQueueStatus(tenantId: string, message: WhatsAppMessageQueueRecord) {
    const baseStatus = String(message.status || "").toLowerCase();
    const metaMessageId = String(message.meta_message_id || "");
    if (!metaMessageId) return baseStatus;
    return whatsappConversationMessages
      .filter(item => item.tenantId === tenantId && item.metaMessageId === metaMessageId)
      .map(item => String(item.status || item.body || "").toLowerCase())
      .reduce((best, status) => whatsappDashboardStatusRank(status) > whatsappDashboardStatusRank(best) ? status : best, baseStatus);
  }

  function buildWhatsAppCenterDashboard(tenantId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const outboundMessages = whatsappConversationMessages.filter(message => message.tenantId === tenantId && message.direction === "outbound");
    const queueMessages = whatsappMessageQueue.filter(message => message.tenant_id === tenantId);
    const queueStatus = (message: WhatsAppMessageQueueRecord) => whatsappDashboardEffectiveQueueStatus(tenantId, message);
    const queueSent = queueMessages.filter(message => ["sent", "delivered", "read"].includes(queueStatus(message)));
    const queueDelivered = queueMessages.filter(message => ["delivered", "read"].includes(queueStatus(message)));
    const queueRead = queueMessages.filter(message => queueStatus(message) === "read");
    const queueFailures = queueMessages.filter(message => queueStatus(message) === "failed");
    const deliveredMessages = outboundMessages.filter(message => String(message.status || "").toLowerCase() === "delivered");
    const readMessages = outboundMessages.filter(message => String(message.status || "").toLowerCase() === "read");
    const failedMessages = outboundMessages.filter(message => String(message.status || "").toLowerCase() === "failed");
    const sentToday = [
      ...outboundMessages.filter(message => ["sent", "delivered", "read"].includes(String(message.status || "").toLowerCase())),
      ...queueSent
    ].filter(message => new Date(whatsappDashboardMessageTime(message)).toISOString().slice(0, 10) === today).length;
    const sentTotal = outboundMessages.filter(message => ["sent", "delivered", "read"].includes(String(message.status || "").toLowerCase())).length + queueSent.length;
    const deliveredTotal = deliveredMessages.length + readMessages.length + queueDelivered.length;
    const readTotal = readMessages.length + queueRead.length;
    const failedTotal = failedMessages.length + queueFailures.length;
    const rate = (part: number, total: number) => total ? Number(((part / total) * 100).toFixed(1)) : 0;

    const pixRecoveryMessages = getWhatsAppPixRecoveryQueue(tenantId);
    const recoveredPix = pixRecoveryMessages
      .filter(message => message.status === "sent")
      .map(message => ({ message, order: whatsappDashboardOrderAmount(tenantId, message) }))
      .filter(item => item.order.recovered);
    const pixRecoveryCandidates = pixRecoveryMessages.filter(message => ["queued", "pending", "retrying", "sent"].includes(message.status)).length;
    const recoveredPixValue = Number(recoveredPix.reduce((sum, item) => sum + item.order.amount, 0).toFixed(2));

    const deliveryChart = buildWhatsAppDashboardDaySeries(7).map(day => {
      const dayOutbound = outboundMessages.filter(message => new Date(whatsappDashboardMessageTime(message)).toISOString().slice(0, 10) === day.date);
      const dayQueue = queueMessages.filter(message => new Date(whatsappDashboardMessageTime(message)).toISOString().slice(0, 10) === day.date);
      return {
        ...day,
        enviados: dayOutbound.filter(message => ["sent", "delivered", "read"].includes(String(message.status || "").toLowerCase())).length + dayQueue.filter(message => ["sent", "delivered", "read"].includes(queueStatus(message))).length,
        entregues: dayOutbound.filter(message => ["delivered", "read"].includes(String(message.status || "").toLowerCase())).length + dayQueue.filter(message => ["delivered", "read"].includes(queueStatus(message))).length,
        lidos: dayOutbound.filter(message => String(message.status || "").toLowerCase() === "read").length + dayQueue.filter(message => queueStatus(message) === "read").length,
        falhas: dayOutbound.filter(message => String(message.status || "").toLowerCase() === "failed").length + dayQueue.filter(message => queueStatus(message) === "failed").length
      };
    });

    const pixChart = buildWhatsAppDashboardDaySeries(30).map(day => {
      const recoveredForDay = recoveredPix.filter(item => {
        const paidOrSent = item.order.paidAt || item.message.sent_at || item.message.processed_at || item.message.updated_at || item.message.created_at;
        return new Date(paidOrSent).toISOString().slice(0, 10) === day.date;
      });
      return {
        ...day,
        recuperacoes: recoveredForDay.length,
        valor: Number(recoveredForDay.reduce((sum, item) => sum + item.order.amount, 0).toFixed(2))
      };
    });

    const templateStats = new Map<string, { template: string; envios: number; entregues: number; lidos: number }>();
    const addTemplate = (name: string, status: string) => {
      if (!name) return;
      const current = templateStats.get(name) || { template: name, envios: 0, entregues: 0, lidos: 0 };
      current.envios += ["sent", "delivered", "read"].includes(status) ? 1 : 0;
      current.entregues += ["delivered", "read"].includes(status) ? 1 : 0;
      current.lidos += status === "read" ? 1 : 0;
      templateStats.set(name, current);
    };
    outboundMessages
      .filter(message => message.type === "template")
      .forEach(message => addTemplate(String(message.rawSummary?.templateName || message.body || ""), String(message.status || "").toLowerCase()));
    queueMessages
      .filter(message => message.template_name)
      .forEach(message => addTemplate(String(message.template_name || ""), queueStatus(message)));

    const campaigns = whatsappCrmCampaigns
      .filter(campaign => campaign.tenant_id === tenantId)
      .map(campaign => {
        const queue = getWhatsAppCrmCampaignQueue(tenantId, campaign.id);
        return {
          id: campaign.id,
          campanha: campaign.name,
          destinatarios: campaign.predicted_recipients || queue.length,
          enviados: queue.filter(message => ["sent", "delivered", "read"].includes(queueStatus(message))).length,
          entregues: queue.filter(message => ["delivered", "read"].includes(queueStatus(message))).length,
          lidos: queue.filter(message => queueStatus(message) === "read").length,
          falhas: queue.filter(message => queueStatus(message) === "failed").length,
          status: campaign.status,
          updated_at: campaign.updated_at
        };
      })
      .sort((a, b) => (b.entregues + b.lidos + b.enviados) - (a.entregues + a.lidos + a.enviados));

    return {
      metrics: {
        sentToday,
        delivered: deliveredTotal,
        read: readTotal,
        failures: failedTotal,
        deliveryRate: rate(deliveredTotal, sentTotal),
        readRate: rate(readTotal, deliveredTotal || sentTotal),
        pixRecoveredCount: recoveredPix.length,
        pixRecoveredValue: recoveredPixValue,
        pixRecoveryRate: rate(recoveredPix.length, pixRecoveryCandidates),
        campaignsSent: whatsappCrmCampaigns.filter(campaign => campaign.tenant_id === tenantId && ["queued", "sending", "completed"].includes(campaign.status)).length,
        openConversations: whatsappConversations.filter(conversation => conversation.tenantId === tenantId && conversation.status === "open").length,
        pendingConversations: whatsappConversations.filter(conversation => conversation.tenantId === tenantId && conversation.status === "pending").length,
        waitingCustomerConversations: whatsappConversations.filter(conversation => conversation.tenantId === tenantId && conversation.status === "waiting_customer").length,
        resolvedConversations: whatsappConversations.filter(conversation => conversation.tenantId === tenantId && conversation.status === "resolved").length,
        optOuts: whatsappOptOutEvents.filter(event => event.tenantId === tenantId).length
      },
      charts: {
        last7Days: deliveryChart,
        pixRecoveryLast30Days: pixChart
      },
      campaigns: campaigns.slice(0, 12),
      templates: Array.from(templateStats.values()).sort((a, b) => b.envios - a.envios).slice(0, 12),
      conversations: {
        abertas: whatsappConversations.filter(conversation => conversation.tenantId === tenantId && conversation.status === "open").length,
        aguardandoCliente: whatsappConversations.filter(conversation => conversation.tenantId === tenantId && conversation.status === "waiting_customer").length,
        pendentes: whatsappConversations.filter(conversation => conversation.tenantId === tenantId && conversation.status === "pending").length,
        resolvidas: whatsappConversations.filter(conversation => conversation.tenantId === tenantId && conversation.status === "resolved").length
      }
    };
  }

  function getApprovedWhatsAppTemplate(tenantId: string, name: string, language: string) {
    return getSavedWhatsAppCloudTemplates(tenantId).find(template =>
      template.name === name &&
      template.language === language &&
      String(template.status || "").toUpperCase() === "APPROVED"
    ) || null;
  }

  function buildTenantPublicPath(tenantId: string, path: string) {
    const tenant = tenants.find(item => item.id === tenantId);
    const verifiedDomain = tenantDomains.find(domain => domain.tenant_id === tenantId && domain.status === "verified" && domain.is_primary);
    const host = verifiedDomain?.domain || tenant?.dominio_customizado || tenant?.dominio || `${tenant?.slug || "rifapro"}.meudominio.com`;
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    return `${protocol}://${host}${path.startsWith("/") ? path : `/${path}`}`;
  }

  function buildWhatsAppOrderCandidateFromPurchase(purchase: PurchaseRecord): WhatsAppOrderCandidate {
    const raffle = raffles.find(item => item.tenant_id === purchase.tenant_id && item.id === purchase.raffleId);
    const customer = purchase.customer || Object.values(customersByPhone).find(item => item.tenant_id === purchase.tenant_id && item.id === purchase.customer?.id);
    return {
      tenantId: purchase.tenant_id,
      orderId: purchase.purchaseId,
      orderType: "raffle",
      customerId: customer?.id || purchase.customer?.id,
      customerName: customer?.name || "Cliente",
      customerPhone: normalizeBrazilianPhone(customer?.phone || purchase.contact || ""),
      campaignName: raffle?.title || "Campanha",
      quantity: purchase.tickets,
      numbersLabel: (purchase.numeros || []).length ? purchase.numeros.join(", ") : "Confirmados",
      amount: purchase.amount,
      status: purchase.status,
      paymentStatus: purchase.status,
      createdAt: purchase.createdAt,
      paidAt: purchase.paymentHistory?.find(item => item.status === "paid")?.date || null,
      expiresAt: purchase.pixExpiresAt || purchase.reservedUntil,
      publicLink: raffle ? buildPublicTicketUrl(purchase).split("?")[0] : "",
      rawRef: purchase
    };
  }

  function buildWhatsAppOrderCandidateFromFazendinhaPurchase(purchase: FazendinhaPurchase): WhatsAppOrderCandidate {
    const config = getFazendinhaConfig(purchase.tenant_id);
    const animalNames = purchase.nomeBichos?.length ? purchase.nomeBichos : purchase.nomeBicho ? purchase.nomeBicho.split(",").map(item => item.trim()).filter(Boolean) : [];
    return {
      tenantId: purchase.tenant_id,
      orderId: purchase.id,
      orderType: "fazendinha",
      customerId: purchase.customer?.id || purchase.usuarioId,
      customerName: purchase.customer?.name || "Cliente",
      customerPhone: normalizeBrazilianPhone(purchase.customer?.phone || ""),
      campaignName: config.name || "Fazendinha",
      quantity: purchase.grupoIds?.length || animalNames.length || 1,
      numbersLabel: animalNames.length ? animalNames.join(", ") : purchase.numeros.join(", "),
      amount: purchase.valorPago,
      status: purchase.statusPagamento,
      paymentStatus: purchase.paymentStatus || (purchase.statusPagamento === "reserved" ? "pending" : purchase.statusPagamento),
      createdAt: purchase.dataCompra,
      paidAt: purchase.paidAt || purchase.confirmedAt || null,
      expiresAt: purchase.pixExpiresAt || purchase.reservedUntil,
      publicLink: buildTenantPublicPath(purchase.tenant_id, "/fazendinha"),
      rawRef: purchase
    };
  }

  function buildWhatsAppOrderCandidateFromNumberModePurchase(purchase: NumberModePurchase): WhatsAppOrderCandidate {
    const config = getNumberModeConfig(purchase.tenant_id, purchase.mode);
    return {
      tenantId: purchase.tenant_id,
      orderId: purchase.id,
      orderType: "number_mode",
      customerId: purchase.customer?.id,
      customerName: purchase.customer?.name || "Cliente",
      customerPhone: normalizeBrazilianPhone(purchase.customer?.phone || ""),
      campaignName: config?.name || purchase.mode,
      quantity: purchase.numbers.length,
      numbersLabel: purchase.numbers.join(", "),
      amount: purchase.amount,
      status: purchase.status,
      paymentStatus: purchase.paymentStatus || (purchase.status === "reserved" ? "pending" : purchase.status),
      createdAt: purchase.createdAt,
      paidAt: purchase.paidAt || purchase.confirmedAt || null,
      expiresAt: purchase.pixExpiresAt || purchase.reservedUntil,
      publicLink: buildTenantPublicPath(purchase.tenant_id, `/${purchase.mode}`),
      rawRef: purchase
    };
  }

  function buildWhatsAppOrderCandidate(order: WhatsAppOrderSource): WhatsAppOrderCandidate {
    if ("purchaseId" in order) return buildWhatsAppOrderCandidateFromPurchase(order);
    if ("statusPagamento" in order) return buildWhatsAppOrderCandidateFromFazendinhaPurchase(order);
    return buildWhatsAppOrderCandidateFromNumberModePurchase(order);
  }

  function findWhatsAppOrderSource(tenantId: string, orderId: string, orderType?: WhatsAppOrderType): WhatsAppOrderSource | null {
    if (!orderType || orderType === "raffle") {
      const purchase = purchases.find(item => item.tenant_id === tenantId && item.purchaseId === orderId);
      if (purchase || orderType === "raffle") return purchase || null;
    }
    if (!orderType || orderType === "fazendinha") {
      const purchase = fazendinhaCompras.find(item => item.tenant_id === tenantId && item.id === orderId);
      if (purchase || orderType === "fazendinha") return purchase || null;
    }
    if (!orderType || orderType === "number_mode") {
      const purchase = numberModePurchases.find(item => item.tenant_id === tenantId && item.id === orderId);
      if (purchase || orderType === "number_mode") return purchase || null;
    }
    return null;
  }

  function listWhatsAppOrderSourcesForPixRecovery(tenantId: string): WhatsAppOrderSource[] {
    return [
      ...purchases.filter(purchase => purchase.tenant_id === tenantId && purchase.status === "pending"),
      ...fazendinhaCompras.filter(purchase => purchase.tenant_id === tenantId && purchase.statusPagamento === "reserved"),
      ...numberModePurchases.filter(purchase => purchase.tenant_id === tenantId && purchase.status === "reserved")
    ];
  }

  function whatsappPixRecoveryEventForPurchase(purchase: PurchaseRecord): WhatsAppPixRecoveryEventType {
    return isPastReservationExpiry(purchase.pixExpiresAt || purchase.reservedUntil) ? "pix_expired_reminder" : "pix_pending_reminder";
  }

  function whatsappPixRecoveryEventForOrder(candidate: WhatsAppOrderCandidate): WhatsAppPixRecoveryEventType {
    return isPastReservationExpiry(candidate.expiresAt) ? "pix_expired_reminder" : "pix_pending_reminder";
  }

  function buildWhatsAppPixRecoveryComponents(input: { customerName: string; campaign: string; amount: number; link: string }) {
    return [
      {
        type: "body",
        parameters: [
          { type: "text", text: input.customerName || "Cliente" },
          { type: "text", text: input.campaign || "Campanha" },
          { type: "text", text: `R$ ${Number(input.amount || 0).toFixed(2)}` },
          { type: "text", text: input.link }
        ]
      }
    ];
  }

  function buildWhatsAppPixRecoveryCandidate(tenantId: string, purchase: PurchaseRecord, settingsRecord = getWhatsAppPixRecoverySettings(tenantId)) {
    return buildWhatsAppPixRecoveryCandidateFromOrder(tenantId, purchase, settingsRecord);
  }

  function buildWhatsAppPixRecoveryCandidateFromOrder(tenantId: string, order: WhatsAppOrderSource, settingsRecord = getWhatsAppPixRecoverySettings(tenantId)) {
    const orderCandidate = buildWhatsAppOrderCandidate(order);
    const eventType = whatsappPixRecoveryEventForOrder(orderCandidate);
    const templateName = eventType === "pix_expired_reminder" ? settingsRecord.expired_template_name : settingsRecord.pending_template_name;
    const language = eventType === "pix_expired_reminder" ? settingsRecord.expired_template_language : settingsRecord.pending_template_language;
    const customer = orderCandidate.customerId ? Object.values(customersByPhone).find(item => item.tenant_id === tenantId && item.id === orderCandidate.customerId) : undefined;
    const paymentLink = eventType === "pix_pending_reminder" && orderCandidate.orderType === "raffle" ? buildPublicTicketUrl(order as PurchaseRecord) : "";
    const campaignLink = orderCandidate.publicLink;
    const link = paymentLink || campaignLink;
    return {
      purchase: order,
      order: orderCandidate,
      customer,
      eventType,
      templateName,
      language,
      phone: orderCandidate.customerPhone,
      campaign: orderCandidate.campaignName,
      customerName: orderCandidate.customerName,
      link,
      idempotencyKey: `whatsapp-cloud-pix-recovery:${tenantId}:${orderCandidate.orderType}:${orderCandidate.orderId}:${eventType}`,
      components: buildWhatsAppPixRecoveryComponents({ customerName: orderCandidate.customerName, campaign: orderCandidate.campaignName, amount: orderCandidate.amount, link })
    };
  }

  function getWhatsAppPixRecoveryQueue(tenantId: string) {
    return whatsappMessageQueue.filter(message => message.tenant_id === tenantId && message.message_type === "whatsapp_cloud_pix_recovery");
  }

  function countWhatsAppPixRecoveryToday(tenantId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return getWhatsAppPixRecoveryQueue(tenantId).filter(message => {
      const time = new Date(message.sent_at || message.processed_at || message.created_at).getTime();
      return time >= start.getTime() && ["queued", "pending", "retrying", "sent"].includes(message.status);
    }).length;
  }

  function hasRecentWhatsAppPixRecoveryForCustomer(tenantId: string, customerId: string | undefined, eventType: WhatsAppPixRecoveryEventType, cooldownHours: number) {
    if (!customerId) return false;
    const since = Date.now() - Math.max(1, cooldownHours) * 60 * 60 * 1000;
    return getWhatsAppPixRecoveryQueue(tenantId).some(message =>
      message.customer_id === customerId &&
      message.event_type === eventType &&
      ["queued", "pending", "retrying", "sent"].includes(message.status) &&
      new Date(message.created_at).getTime() >= since
    );
  }

  function validateWhatsAppPixRecoveryCandidate(tenantId: string, purchase: PurchaseRecord, settingsRecord = getWhatsAppPixRecoverySettings(tenantId)) {
    return validateWhatsAppPixRecoveryCandidateFromOrder(tenantId, purchase, settingsRecord);
  }

  function validateWhatsAppPixRecoveryCandidateFromOrder(tenantId: string, order: WhatsAppOrderSource, settingsRecord = getWhatsAppPixRecoverySettings(tenantId)) {
    const candidate = buildWhatsAppPixRecoveryCandidateFromOrder(tenantId, order, settingsRecord);
    const cloudConfig = getWhatsAppCloudConfig(tenantId);
    const orderCandidate = candidate.order;
    const ageMinutes = (Date.now() - new Date(orderCandidate.createdAt).getTime()) / 60000;
    if (!settingsRecord.enabled) return { candidate, eligible: false, reason: "Recuperacao automatica desativada" };
    if (!cloudConfig?.enabled) return { candidate, eligible: false, reason: "WhatsApp Cloud inativo" };
    if (orderCandidate.tenantId !== tenantId) return { candidate, eligible: false, reason: "Compra de outro cliente da plataforma" };
    if (!["pending", "reserved"].includes(orderCandidate.status) && !["pending", "reserved"].includes(orderCandidate.paymentStatus)) return { candidate, eligible: false, reason: "Compra nao esta pendente" };
    if (orderCandidate.status === "cancelled" || orderCandidate.paymentStatus === "cancelled") return { candidate, eligible: false, reason: "Compra cancelada" };
    const pixOrder = order as WhatsAppOrderSource & { pixPayload?: string; pixGateway?: string; pixQrCodeBase64?: string };
    if (!pixOrder.pixPayload && !pixOrder.pixGateway && !pixOrder.pixQrCodeBase64) return { candidate, eligible: false, reason: "Compra nao parece ser PIX" };
    if (ageMinutes < settingsRecord.min_age_minutes && candidate.eventType === "pix_pending_reminder") return { candidate, eligible: false, reason: "Ainda dentro do tempo minimo" };
    if (!candidate.templateName) return { candidate, eligible: false, reason: "Template nao selecionado" };
    if (!getApprovedWhatsAppTemplate(tenantId, candidate.templateName, candidate.language)) return { candidate, eligible: false, reason: "Template oficial aprovado nao encontrado" };
    if (!isValidBrazilianWhatsAppPhone(candidate.phone)) return { candidate, eligible: false, reason: "Telefone invalido" };
    if (!candidate.link) return { candidate, eligible: false, reason: "Link de pagamento ou campanha indisponivel" };
    if (whatsappMessageQueue.some(message => message.idempotency_key === candidate.idempotencyKey)) return { candidate, eligible: false, reason: "Mensagem ja registrada para esta compra" };
    if (hasRecentWhatsAppPixRecoveryForCustomer(tenantId, candidate.customer?.id || orderCandidate.customerId, candidate.eventType, settingsRecord.per_customer_cooldown_hours)) return { candidate, eligible: false, reason: "Limite por cliente respeitado" };
    if (countWhatsAppPixRecoveryToday(tenantId) >= settingsRecord.daily_tenant_limit) return { candidate, eligible: false, reason: "Limite diario atingido" };
    return { candidate, eligible: true, reason: "" };
  }

  function listWhatsAppPixRecoveryCandidates(tenantId: string, settingsRecord = getWhatsAppPixRecoverySettings(tenantId)) {
    return listWhatsAppOrderSourcesForPixRecovery(tenantId)
      .map(purchase => validateWhatsAppPixRecoveryCandidateFromOrder(tenantId, purchase, settingsRecord));
  }

  function enqueueWhatsAppPixRecoveryMessage(tenantId: string, purchase: PurchaseRecord, settingsRecord = getWhatsAppPixRecoverySettings(tenantId)) {
    return enqueueWhatsAppPixRecoveryMessageFromOrder(tenantId, purchase, settingsRecord);
  }

  function enqueueWhatsAppPixRecoveryMessageFromOrder(tenantId: string, order: WhatsAppOrderSource, settingsRecord = getWhatsAppPixRecoverySettings(tenantId)) {
    const validation = validateWhatsAppPixRecoveryCandidateFromOrder(tenantId, order, settingsRecord);
    const orderCandidate = validation.candidate.order;
    const now = new Date().toISOString();
    if (!validation.eligible) {
      recordWhatsAppCloudLog(tenantId, {
        action: "pix_recovery_skipped",
        status: "skipped",
        message: validation.reason,
        metadata: { orderId: orderCandidate.orderId, purchaseId: orderCandidate.orderId, orderType: orderCandidate.orderType, campaignName: orderCandidate.campaignName, eventType: validation.candidate.eventType, status: orderCandidate.status, customerId: orderCandidate.customerId || "" }
      });
      return { message: null, validation };
    }
    const message: WhatsAppMessageQueueRecord = {
      id: createPublicId("WAPP_"),
      tenant_id: tenantId,
      order_id: orderCandidate.orderId,
      customer_id: validation.candidate.customer?.id || orderCandidate.customerId,
      phone: validation.candidate.phone,
      message_type: "whatsapp_cloud_pix_recovery",
      message_body: "",
      provider: "meta_cloud",
      status: "queued",
      attempts: 0,
      max_attempts: 3,
      last_error: "",
      reason: "",
      template_name: validation.candidate.templateName,
      language: validation.candidate.language,
      event_type: validation.candidate.eventType,
      payload: {
        orderId: orderCandidate.orderId,
        purchaseId: orderCandidate.orderId,
        orderType: orderCandidate.orderType,
        customerName: validation.candidate.customerName,
        campaign: validation.candidate.campaign,
        campaignName: orderCandidate.campaignName,
        status: orderCandidate.status,
        amount: orderCandidate.amount,
        link: validation.candidate.link,
        components: validation.candidate.components
      },
      created_at: now,
      updated_at: now,
      idempotency_key: validation.candidate.idempotencyKey
    };
    whatsappMessageQueue.unshift(message);
    whatsappMessageQueue = whatsappMessageQueue.slice(0, 2000);
    recordWhatsAppCloudLog(tenantId, {
      action: "pix_recovery_enqueued",
      status: "success",
      message: "Recuperacao de PIX adicionada a fila",
      metadata: { orderId: orderCandidate.orderId, purchaseId: orderCandidate.orderId, orderType: orderCandidate.orderType, campaignName: orderCandidate.campaignName, eventType: message.event_type, status: message.status, to: maskPhone(message.phone), templateName: message.template_name }
    });
    schedulePersistentStateSave("whatsapp-pix-recovery-enqueue");
    return { message, validation };
  }

  async function processWhatsappPixRecoveryQueue(tenantId: string, limit = 20) {
    const settingsRecord = getWhatsAppPixRecoverySettings(tenantId);
    const provider = createMetaWhatsAppCloudProvider(tenantId);
    const templates = getSavedWhatsAppCloudTemplates(tenantId);
    const ready = getWhatsAppPixRecoveryQueue(tenantId)
      .filter(message => message.status === "queued" && message.attempts < message.max_attempts)
      .slice(0, Math.max(1, Math.min(100, limit)));
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const message of ready) {
      const orderType = (message.payload?.orderType === "fazendinha" || message.payload?.orderType === "number_mode" || message.payload?.orderType === "raffle")
        ? message.payload.orderType as WhatsAppOrderType
        : undefined;
      const purchase = findWhatsAppOrderSource(tenantId, String(message.order_id || ""), orderType);
      const eventType = (message.event_type === "pix_expired_reminder" ? "pix_expired_reminder" : "pix_pending_reminder") as WhatsAppPixRecoveryEventType;
      const revalidation = purchase ? validateWhatsAppPixRecoveryCandidateFromOrder(tenantId, purchase, settingsRecord) : null;
      const allowedQueuedReasons = new Set(["Mensagem ja registrada para esta compra", "Limite por cliente respeitado", "Limite diario atingido"]);
      if (!purchase || (revalidation && !revalidation.eligible && !allowedQueuedReasons.has(revalidation.reason))) {
        message.status = "skipped";
        message.reason = revalidation?.reason || "Compra nao esta pendente";
        message.processed_at = new Date().toISOString();
        message.updated_at = message.processed_at;
        skipped += 1;
        recordWhatsAppCloudLog(tenantId, { action: "pix_recovery_skipped", status: "skipped", message: message.reason, metadata: { orderId: message.order_id || "", purchaseId: message.order_id || "", orderType: message.payload?.orderType || "", campaignName: message.payload?.campaignName || message.payload?.campaign || "", eventType, status: message.status } });
        continue;
      }
      if (countWhatsAppPixRecoveryToday(tenantId) > settingsRecord.daily_tenant_limit) {
        message.status = "skipped";
        message.reason = "Limite diario atingido";
        message.processed_at = new Date().toISOString();
        message.updated_at = message.processed_at;
        skipped += 1;
        recordWhatsAppCloudLog(tenantId, { action: "pix_recovery_skipped", status: "skipped", message: message.reason, metadata: { orderId: message.order_id || "", purchaseId: message.order_id || "", orderType: message.payload?.orderType || "", campaignName: message.payload?.campaignName || message.payload?.campaign || "", eventType, status: message.status } });
        continue;
      }
      try {
        message.attempts += 1;
        message.updated_at = new Date().toISOString();
        const result = await provider.sendTemplateTest({
          to: message.phone,
          templateName: String(message.template_name || ""),
          language: String(message.language || "pt_BR"),
          components: Array.isArray(message.payload?.components) ? message.payload.components : [],
          availableTemplates: templates
        });
        const processedAt = new Date().toISOString();
        message.status = "sent";
        message.sent_at = processedAt;
        message.processed_at = processedAt;
        message.updated_at = processedAt;
        message.meta_message_id = result.data?.messages?.[0]?.id || "";
        sent += 1;
        recordWhatsAppCloudLog(tenantId, {
          action: "pix_recovery_sent",
          status: "success",
          message: "Recuperacao de PIX enviada",
          metadata: { orderId: message.order_id || "", purchaseId: message.order_id || "", orderType: message.payload?.orderType || "", campaignName: message.payload?.campaignName || message.payload?.campaign || "", eventType, status: message.status, to: maskPhone(message.phone), templateName: message.template_name, metaMessageId: message.meta_message_id || "" }
        });
      } catch (error) {
        const processedAt = new Date().toISOString();
        message.status = message.attempts >= message.max_attempts ? "failed" : "queued";
        message.last_error = error instanceof Error ? error.message : "Falha ao enviar recuperacao de PIX";
        message.reason = message.last_error;
        message.processed_at = processedAt;
        message.updated_at = processedAt;
        failed += 1;
        recordWhatsAppCloudLog(tenantId, {
          action: "meta_api_error",
          status: "error",
          message: message.last_error,
          metadata: { orderId: message.order_id || "", purchaseId: message.order_id || "", orderType: message.payload?.orderType || "", campaignName: message.payload?.campaignName || message.payload?.campaign || "", eventType, status: message.status, to: maskPhone(message.phone), templateName: message.template_name }
        });
      }
    }
    schedulePersistentStateSave("whatsapp-pix-recovery-run");
    return { processed: ready.length, sent, failed, skipped };
  }

  function defaultWhatsAppPurchaseConfirmationSettings(tenantId: string): WhatsAppPurchaseConfirmationSettingsRecord {
    const now = new Date().toISOString();
    return {
      id: `${tenantId}:whatsapp-purchase-confirmation`,
      tenant_id: tenantId,
      enabled: false,
      template_name: "",
      template_language: "pt_BR",
      mode: "manual",
      daily_tenant_limit: 100,
      paid_only: true,
      created_at: now,
      updated_at: now
    };
  }

  function getWhatsAppPurchaseConfirmationSettings(tenantId: string) {
    return whatsappPurchaseConfirmationSettings.find(item => item.tenant_id === tenantId) || defaultWhatsAppPurchaseConfirmationSettings(tenantId);
  }

  function sanitizeWhatsAppPurchaseConfirmationSettings(settingsRecord: WhatsAppPurchaseConfirmationSettingsRecord) {
    return {
      id: settingsRecord.id,
      tenant_id: settingsRecord.tenant_id,
      enabled: settingsRecord.enabled,
      template_name: settingsRecord.template_name,
      template_language: settingsRecord.template_language,
      mode: settingsRecord.mode,
      daily_tenant_limit: settingsRecord.daily_tenant_limit,
      paid_only: settingsRecord.paid_only,
      created_at: settingsRecord.created_at,
      updated_at: settingsRecord.updated_at
    };
  }

  function upsertWhatsAppPurchaseConfirmationSettings(req: express.Request, tenantId: string) {
    const current = getWhatsAppPurchaseConfirmationSettings(tenantId);
    const now = new Date().toISOString();
    const next: WhatsAppPurchaseConfirmationSettingsRecord = {
      ...current,
      enabled: Boolean(req.body?.enabled),
      template_name: String(req.body?.template_name || req.body?.templateName || current.template_name || "").trim(),
      template_language: String(req.body?.template_language || req.body?.templateLanguage || current.template_language || "pt_BR").trim() || "pt_BR",
      mode: req.body?.mode === "automatic" ? "automatic" : "manual",
      daily_tenant_limit: Math.min(1000, Math.max(1, Math.floor(Number(req.body?.daily_tenant_limit ?? req.body?.dailyTenantLimit ?? current.daily_tenant_limit ?? 100)))),
      paid_only: req.body?.paid_only !== undefined ? Boolean(req.body.paid_only) : req.body?.paidOnly !== undefined ? Boolean(req.body.paidOnly) : true,
      updated_at: now
    };
    whatsappPurchaseConfirmationSettings = [
      next,
      ...whatsappPurchaseConfirmationSettings.filter(item => item.tenant_id !== tenantId)
    ];
    recordWhatsAppCloudLog(tenantId, {
      action: "purchase_confirmation_settings_saved",
      status: "success",
      message: "Confirmacao automatica de compra salva",
      metadata: { mode: next.mode, enabled: next.enabled, paidOnly: next.paid_only, adminId: getAuthSession(req)?.sub || "" }
    });
    schedulePersistentStateSave("whatsapp-purchase-confirmation-settings");
    return next;
  }

  function getWhatsAppPurchaseConfirmationQueue(tenantId: string) {
    return whatsappMessageQueue.filter(message => message.tenant_id === tenantId && message.message_type === "whatsapp_cloud_purchase_confirmation");
  }

  function countWhatsAppPurchaseConfirmationsToday(tenantId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return getWhatsAppPurchaseConfirmationQueue(tenantId).filter(message => {
      const time = new Date(message.sent_at || message.processed_at || message.created_at).getTime();
      return time >= start.getTime() && ["queued", "pending", "retrying", "sent"].includes(message.status);
    }).length;
  }

  function purchaseHasRefundOrChargeback(purchase: PurchaseRecord) {
    const relatedPayments = payments.filter(payment => payment.tenant_id === purchase.tenant_id && payment.order_id === purchase.purchaseId);
    return relatedPayments.some(payment => {
      const text = `${payment.status || ""} ${JSON.stringify(maskLogValue(payment.raw_response || {}))}`.toLowerCase();
      return ["refunded", "refund", "charged_back", "chargeback", "estornado", "estornada"].some(term => text.includes(term));
    });
  }

  function buildWhatsAppPurchaseConfirmationComponents(input: { customerName: string; campaign: string; quantity: number; numbers: number[] | string; amount: number; link: string }) {
    const numbersText = Array.isArray(input.numbers)
      ? (input.numbers.length ? input.numbers.join(", ").slice(0, 900) : "Confirmados")
      : String(input.numbers || "Confirmados").slice(0, 900);
    return [
      {
        type: "body",
        parameters: [
          { type: "text", text: input.customerName || "Cliente" },
          { type: "text", text: input.campaign || "Campanha" },
          { type: "text", text: String(input.quantity || input.numbers.length || 0) },
          { type: "text", text: numbersText },
          { type: "text", text: `R$ ${Number(input.amount || 0).toFixed(2)}` },
          { type: "text", text: input.link }
        ]
      }
    ];
  }

  function buildWhatsAppPurchaseConfirmationCandidate(tenantId: string, purchase: PurchaseRecord, settingsRecord = getWhatsAppPurchaseConfirmationSettings(tenantId)) {
    return buildWhatsAppPurchaseConfirmationCandidateFromOrder(tenantId, purchase, settingsRecord);
  }

  function buildWhatsAppPurchaseConfirmationCandidateFromOrder(tenantId: string, order: WhatsAppOrderSource, settingsRecord = getWhatsAppPurchaseConfirmationSettings(tenantId)) {
    const orderCandidate = buildWhatsAppOrderCandidate(order);
    const customer = orderCandidate.customerId ? Object.values(customersByPhone).find(item => item.tenant_id === tenantId && item.id === orderCandidate.customerId) : undefined;
    return {
      purchase: order,
      order: orderCandidate,
      customer,
      eventType: "purchase_confirmed" as WhatsAppPurchaseConfirmationEventType,
      templateName: settingsRecord.template_name,
      language: settingsRecord.template_language,
      phone: orderCandidate.customerPhone,
      campaign: orderCandidate.campaignName,
      customerName: orderCandidate.customerName,
      link: orderCandidate.publicLink,
      idempotencyKey: `whatsapp-cloud-purchase-confirmation:${tenantId}:${orderCandidate.orderType}:${orderCandidate.orderId}:purchase_confirmed`,
      components: buildWhatsAppPurchaseConfirmationComponents({ customerName: orderCandidate.customerName, campaign: orderCandidate.campaignName, quantity: orderCandidate.quantity, numbers: orderCandidate.numbersLabel, amount: orderCandidate.amount, link: orderCandidate.publicLink })
    };
  }

  function validateWhatsAppPurchaseConfirmationCandidate(tenantId: string, purchase: PurchaseRecord, settingsRecord = getWhatsAppPurchaseConfirmationSettings(tenantId)) {
    return validateWhatsAppPurchaseConfirmationCandidateFromOrder(tenantId, purchase, settingsRecord);
  }

  function validateWhatsAppPurchaseConfirmationCandidateFromOrder(tenantId: string, order: WhatsAppOrderSource, settingsRecord = getWhatsAppPurchaseConfirmationSettings(tenantId)) {
    const candidate = buildWhatsAppPurchaseConfirmationCandidateFromOrder(tenantId, order, settingsRecord);
    const cloudConfig = getWhatsAppCloudConfig(tenantId);
    const orderCandidate = candidate.order;
    if (!settingsRecord.enabled) return { candidate, eligible: false, reason: "Confirmacao automatica desativada" };
    if (!cloudConfig?.enabled) return { candidate, eligible: false, reason: "WhatsApp Cloud inativo" };
    if (orderCandidate.tenantId !== tenantId) return { candidate, eligible: false, reason: "Compra de outro cliente da plataforma" };
    if (orderCandidate.status === "cancelled" || orderCandidate.paymentStatus === "cancelled") return { candidate, eligible: false, reason: "Compra cancelada" };
    if (orderCandidate.orderType === "raffle" && purchaseHasRefundOrChargeback(order as PurchaseRecord)) return { candidate, eligible: false, reason: "Compra estornada" };
    if (orderCandidate.status !== "paid" && orderCandidate.paymentStatus !== "paid") return { candidate, eligible: false, reason: "Compra nao esta paga" };
    if (!orderCandidate.quantity || !orderCandidate.numbersLabel) return { candidate, eligible: false, reason: "Cotas ainda nao liberadas" };
    if (candidate.customer && candidate.customer.tenant_id !== tenantId) return { candidate, eligible: false, reason: "Cliente nao pertence ao tenant" };
    if (!candidate.templateName) return { candidate, eligible: false, reason: "Template nao selecionado" };
    if (!getApprovedWhatsAppTemplate(tenantId, candidate.templateName, candidate.language)) return { candidate, eligible: false, reason: "Template oficial aprovado nao encontrado" };
    if (!isValidBrazilianWhatsAppPhone(candidate.phone)) return { candidate, eligible: false, reason: "Telefone invalido" };
    if (!candidate.link) return { candidate, eligible: false, reason: "Link da campanha indisponivel" };
    if (whatsappMessageQueue.some(message => message.idempotency_key === candidate.idempotencyKey)) return { candidate, eligible: false, reason: "Mensagem ja registrada para esta compra" };
    if (countWhatsAppPurchaseConfirmationsToday(tenantId) >= settingsRecord.daily_tenant_limit) return { candidate, eligible: false, reason: "Limite diario atingido" };
    return { candidate, eligible: true, reason: "" };
  }

  function enqueueWhatsAppPurchaseConfirmationMessage(tenantId: string, purchase: PurchaseRecord, settingsRecord = getWhatsAppPurchaseConfirmationSettings(tenantId), source = "purchase_confirmed") {
    return enqueueWhatsAppPurchaseConfirmationMessageFromOrder(tenantId, purchase, settingsRecord, source);
  }

  function enqueueWhatsAppPurchaseConfirmationMessageFromOrder(tenantId: string, order: WhatsAppOrderSource, settingsRecord = getWhatsAppPurchaseConfirmationSettings(tenantId), source = "purchase_confirmed") {
    const orderCandidate = buildWhatsAppOrderCandidate(order);
    recordWhatsAppCloudLog(tenantId, {
      action: "purchase_confirmation_event",
      status: "success",
      message: "Compra confirmada recebida para WhatsApp Cloud",
      metadata: { orderId: orderCandidate.orderId, purchaseId: orderCandidate.orderId, orderType: orderCandidate.orderType, campaignName: orderCandidate.campaignName, eventType: "purchase_confirmed", status: orderCandidate.status, source }
    });
    const validation = validateWhatsAppPurchaseConfirmationCandidateFromOrder(tenantId, order, settingsRecord);
    const now = new Date().toISOString();
    if (!validation.eligible) {
      recordWhatsAppCloudLog(tenantId, {
        action: "purchase_confirmation_skipped",
        status: "skipped",
        message: validation.reason,
        metadata: { orderId: orderCandidate.orderId, purchaseId: orderCandidate.orderId, orderType: orderCandidate.orderType, campaignName: orderCandidate.campaignName, eventType: validation.candidate.eventType, status: orderCandidate.status, customerId: orderCandidate.customerId || "" }
      });
      return { message: null, validation };
    }
    const message: WhatsAppMessageQueueRecord = {
      id: createPublicId("WAPP_"),
      tenant_id: tenantId,
      order_id: orderCandidate.orderId,
      customer_id: validation.candidate.customer?.id || orderCandidate.customerId,
      phone: validation.candidate.phone,
      message_type: "whatsapp_cloud_purchase_confirmation",
      message_body: "",
      provider: "meta_cloud",
      status: "queued",
      attempts: 0,
      max_attempts: 3,
      last_error: "",
      reason: "",
      template_name: validation.candidate.templateName,
      language: validation.candidate.language,
      event_type: validation.candidate.eventType,
      payload: {
        orderId: orderCandidate.orderId,
        purchaseId: orderCandidate.orderId,
        orderType: orderCandidate.orderType,
        customerName: validation.candidate.customerName,
        campaign: validation.candidate.campaign,
        campaignName: orderCandidate.campaignName,
        quantity: orderCandidate.quantity,
        numbers: orderCandidate.numbersLabel,
        amount: orderCandidate.amount,
        status: orderCandidate.status,
        link: validation.candidate.link,
        components: validation.candidate.components
      },
      created_at: now,
      updated_at: now,
      idempotency_key: validation.candidate.idempotencyKey
    };
    whatsappMessageQueue.unshift(message);
    whatsappMessageQueue = whatsappMessageQueue.slice(0, 2000);
    recordWhatsAppCloudLog(tenantId, {
      action: "purchase_confirmation_enqueued",
      status: "success",
      message: "Confirmacao de compra adicionada a fila",
      metadata: { orderId: orderCandidate.orderId, purchaseId: orderCandidate.orderId, orderType: orderCandidate.orderType, campaignName: orderCandidate.campaignName, eventType: message.event_type, status: message.status, to: maskPhone(message.phone), templateName: message.template_name }
    });
    schedulePersistentStateSave("whatsapp-purchase-confirmation-enqueue");
    return { message, validation };
  }

  async function processWhatsappPurchaseConfirmationQueue(tenantId: string, limit = 20) {
    const settingsRecord = getWhatsAppPurchaseConfirmationSettings(tenantId);
    const provider = createMetaWhatsAppCloudProvider(tenantId);
    const templates = getSavedWhatsAppCloudTemplates(tenantId);
    const ready = getWhatsAppPurchaseConfirmationQueue(tenantId)
      .filter(message => message.status === "queued" && message.attempts < message.max_attempts)
      .slice(0, Math.max(1, Math.min(100, limit)));
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const message of ready) {
      const orderType = (message.payload?.orderType === "fazendinha" || message.payload?.orderType === "number_mode" || message.payload?.orderType === "raffle")
        ? message.payload.orderType as WhatsAppOrderType
        : undefined;
      const purchase = findWhatsAppOrderSource(tenantId, String(message.order_id || ""), orderType);
      const revalidation = purchase ? validateWhatsAppPurchaseConfirmationCandidateFromOrder(tenantId, purchase, settingsRecord) : null;
      const allowedQueuedReasons = new Set(["Mensagem ja registrada para esta compra", "Limite diario atingido"]);
      if (!purchase || (revalidation && !revalidation.eligible && !allowedQueuedReasons.has(revalidation.reason))) {
        message.status = "skipped";
        message.reason = revalidation?.reason || "Compra nao encontrada";
        message.processed_at = new Date().toISOString();
        message.updated_at = message.processed_at;
        skipped += 1;
        recordWhatsAppCloudLog(tenantId, { action: "purchase_confirmation_skipped", status: "skipped", message: message.reason, metadata: { orderId: message.order_id || "", purchaseId: message.order_id || "", orderType: message.payload?.orderType || "", campaignName: message.payload?.campaignName || message.payload?.campaign || "", eventType: "purchase_confirmed", status: message.status } });
        continue;
      }
      if (countWhatsAppPurchaseConfirmationsToday(tenantId) > settingsRecord.daily_tenant_limit) {
        message.status = "skipped";
        message.reason = "Limite diario atingido";
        message.processed_at = new Date().toISOString();
        message.updated_at = message.processed_at;
        skipped += 1;
        recordWhatsAppCloudLog(tenantId, { action: "purchase_confirmation_skipped", status: "skipped", message: message.reason, metadata: { orderId: message.order_id || "", purchaseId: message.order_id || "", orderType: message.payload?.orderType || "", campaignName: message.payload?.campaignName || message.payload?.campaign || "", eventType: "purchase_confirmed", status: message.status } });
        continue;
      }
      try {
        message.attempts += 1;
        message.updated_at = new Date().toISOString();
        recordWhatsAppCloudLog(tenantId, {
          action: "purchase_confirmation_send_requested",
          status: "success",
          message: "Envio de confirmacao de compra solicitado",
          metadata: { orderId: message.order_id || "", purchaseId: message.order_id || "", orderType: message.payload?.orderType || "", campaignName: message.payload?.campaignName || message.payload?.campaign || "", eventType: "purchase_confirmed", status: message.status, to: maskPhone(message.phone), templateName: message.template_name }
        });
        const result = await provider.sendTemplateTest({
          to: message.phone,
          templateName: String(message.template_name || ""),
          language: String(message.language || "pt_BR"),
          components: Array.isArray(message.payload?.components) ? message.payload.components : [],
          availableTemplates: templates
        });
        const processedAt = new Date().toISOString();
        message.status = "sent";
        message.sent_at = processedAt;
        message.processed_at = processedAt;
        message.updated_at = processedAt;
        message.meta_message_id = result.data?.messages?.[0]?.id || "";
        sent += 1;
        recordWhatsAppCloudLog(tenantId, {
          action: "purchase_confirmation_sent",
          status: "success",
          message: "Confirmacao de compra enviada",
          metadata: { orderId: message.order_id || "", purchaseId: message.order_id || "", orderType: message.payload?.orderType || "", campaignName: message.payload?.campaignName || message.payload?.campaign || "", eventType: "purchase_confirmed", status: message.status, to: maskPhone(message.phone), templateName: message.template_name, metaMessageId: message.meta_message_id || "" }
        });
      } catch (error) {
        const processedAt = new Date().toISOString();
        message.status = message.attempts >= message.max_attempts ? "failed" : "queued";
        message.last_error = error instanceof Error ? error.message : "Falha ao enviar confirmacao de compra";
        message.reason = message.last_error;
        message.processed_at = processedAt;
        message.updated_at = processedAt;
        failed += 1;
        recordWhatsAppCloudLog(tenantId, {
          action: "purchase_confirmation_failed",
          status: "error",
          message: message.last_error,
          metadata: { orderId: message.order_id || "", purchaseId: message.order_id || "", orderType: message.payload?.orderType || "", campaignName: message.payload?.campaignName || message.payload?.campaign || "", eventType: "purchase_confirmed", status: message.status, to: maskPhone(message.phone), templateName: message.template_name }
        });
      }
    }
    schedulePersistentStateSave("whatsapp-purchase-confirmation-run");
    return { processed: ready.length, sent, failed, skipped };
  }

  function handlePurchaseConfirmedWhatsAppCloudEvent(purchase: WhatsAppOrderSource, source = "purchase_confirmed") {
    const tenantId = buildWhatsAppOrderCandidate(purchase).tenantId;
    const settingsRecord = getWhatsAppPurchaseConfirmationSettings(tenantId);
    const result = enqueueWhatsAppPurchaseConfirmationMessageFromOrder(tenantId, purchase, settingsRecord, source);
    if (settingsRecord.mode === "automatic" && result.message) {
      void processWhatsappPurchaseConfirmationQueue(tenantId, Math.min(1, settingsRecord.daily_tenant_limit));
    }
    return result;
  }

  function decryptWhatsAppCloudConfig(config: WhatsAppCloudConfigRecord | null) {
    if (!config) return null;
    return {
      enabled: config.enabled,
      environment: config.environment,
      account_name: config.account_name,
      business_manager_id: config.business_manager_id,
      whatsapp_business_account_id: config.whatsapp_business_account_id,
      business_account_id: config.whatsapp_business_account_id,
      phone_number_id: config.phone_number_id,
      access_token: decryptGatewaySecret(config.access_token_encrypted || ""),
      webhook_verify_token: decryptGatewaySecret(config.webhook_verify_token_encrypted || ""),
      webhook_url: config.webhook_url
    };
  }

  function createMetaWhatsAppCloudProvider(tenantId: string) {
    const config = getWhatsAppCloudConfig(tenantId);
    return new MetaWhatsAppCloudProvider(decryptWhatsAppCloudConfig(config) || { enabled: false, environment: "sandbox" }, {
      log: entry => recordWhatsAppCloudLog(tenantId, {
        action: entry.action === "phone_info" ? "phone_info" : entry.action === "list_templates" ? "list_templates" : entry.action === "webhook_validate" ? "webhook_validate" : entry.action === "webhook_received" ? "webhook_received" : entry.action === "template_test_sent" ? "template_test_sent" : entry.action === "template_sent" ? "template_sent" : "test_connection",
        status: entry.status,
        message: entry.message || entry.action,
        metadata: entry.metadata || {}
      })
    });
  }

  function findWhatsAppCloudConfigByVerifyToken(token: string) {
    return whatsappCloudConfigs.find(config => {
      const verifyToken = decryptGatewaySecret(config.webhook_verify_token_encrypted || "");
      return Boolean(verifyToken && token && verifyToken === token);
    }) || null;
  }

  function findWhatsAppCloudConfigByWebhookPayload(payload: unknown) {
    const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const entries = Array.isArray(body.entry) ? body.entry as Array<Record<string, unknown>> : [];
    const phoneNumberIds = new Set<string>();
    entries.forEach(entry => {
      const changes = Array.isArray(entry.changes) ? entry.changes as Array<Record<string, unknown>> : [];
      changes.forEach(change => {
        const value = change.value && typeof change.value === "object" ? change.value as Record<string, unknown> : {};
        const metadata = value.metadata && typeof value.metadata === "object" ? value.metadata as Record<string, unknown> : {};
        const phoneNumberId = String(metadata.phone_number_id || "");
        if (phoneNumberId) phoneNumberIds.add(phoneNumberId);
      });
    });
    return whatsappCloudConfigs.find(config => phoneNumberIds.has(config.phone_number_id)) || null;
  }

  function requireWhatsAppCenterAccess(req: express.Request, res: express.Response, next: express.NextFunction) {
    const session = getAuthSession(req);
    if (!session) {
      res.status(401).json({ error: "Sessao invalida ou expirada" });
      return;
    }
    if (!["superadmin", "admin", "operador"].includes(normalizeAuthRole(session.role))) {
      res.status(403).json({ error: "Acesso restrito a admin ou operador" });
      return;
    }
    next();
  }

  function requireWhatsAppCrmCampaignAccess(req: express.Request, res: express.Response, next: express.NextFunction) {
    const session = getAuthSession(req);
    if (!session) {
      res.status(401).json({ error: "Sessao invalida ou expirada" });
      return;
    }
    if (!["superadmin", "admin"].includes(normalizeAuthRole(session.role))) {
      res.status(403).json({ error: "Acesso restrito a admin" });
      return;
    }
    next();
  }

  function normalizeWhatsAppCenterPhone(value: unknown) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.startsWith("55") ? digits : `55${digits}`;
  }

  function whatsappMessageType(message: Record<string, unknown>): WhatsAppConversationMessageRecord["type"] {
    const type = String(message.type || "").toLowerCase();
    if (["text", "template", "image", "audio", "document", "button"].includes(type)) return type as WhatsAppConversationMessageRecord["type"];
    const interactive = message.interactive && typeof message.interactive === "object" ? message.interactive as Record<string, unknown> : {};
    if (message.button || interactive.button_reply) return "button";
    return "unknown";
  }

  function summarizeWhatsAppInbound(message: Record<string, unknown>) {
    const type = whatsappMessageType(message);
    const button = message.button && typeof message.button === "object" ? message.button as Record<string, unknown> : {};
    const interactive = message.interactive && typeof message.interactive === "object" ? message.interactive as Record<string, unknown> : {};
    const buttonReply = interactive.button_reply && typeof interactive.button_reply === "object" ? interactive.button_reply as Record<string, unknown> : {};
    return {
      id: String(message.id || "").slice(0, 160),
      type,
      timestamp: String(message.timestamp || "").slice(0, 40),
      from: maskPhone(normalizeWhatsAppCenterPhone(message.from)),
      hasText: Boolean((message.text as Record<string, unknown> | undefined)?.body),
      hasMedia: ["image", "audio", "document"].includes(type),
      button: type === "button" ? {
        id: String(button.payload || buttonReply.id || "").slice(0, 160),
        title: String(button.text || buttonReply.title || "").slice(0, 160)
      } : undefined
    };
  }

  function summarizeWhatsAppStatus(status: Record<string, unknown>) {
    const conversation = status.conversation && typeof status.conversation === "object" ? status.conversation as Record<string, unknown> : {};
    return {
      id: String(status.id || "").slice(0, 160),
      status: String(status.status || "unknown").slice(0, 40),
      timestamp: String(status.timestamp || "").slice(0, 40),
      recipient: maskPhone(normalizeWhatsAppCenterPhone(status.recipient_id)),
      conversationId: String(conversation.id || "").slice(0, 160)
    };
  }

  function getWhatsAppInboundBody(message: Record<string, unknown>) {
    const text = message.text && typeof message.text === "object" ? message.text as Record<string, unknown> : {};
    const button = message.button && typeof message.button === "object" ? message.button as Record<string, unknown> : {};
    const interactive = message.interactive && typeof message.interactive === "object" ? message.interactive as Record<string, unknown> : {};
    const buttonReply = interactive.button_reply && typeof interactive.button_reply === "object" ? interactive.button_reply as Record<string, unknown> : {};
    return String(text.body || button.text || buttonReply.title || button.payload || buttonReply.id || "").trim().slice(0, 4000);
  }

  function countTemplatePlaceholders(value: unknown) {
    return new Set(String(value || "").match(/\{\{\s*\d+\s*\}\}/g) || []).size;
  }

  function templateComponentType(component: unknown) {
    return String((component && typeof component === "object" ? (component as Record<string, unknown>).type : "") || "").toUpperCase();
  }

  function getTemplateButtons(template: WhatsAppCloudTemplateRecord) {
    const buttonsComponent = (Array.isArray(template.components) ? template.components : []).find(component => templateComponentType(component) === "BUTTONS") as Record<string, unknown> | undefined;
    const buttons = Array.isArray(buttonsComponent?.buttons) ? buttonsComponent.buttons as Array<Record<string, unknown>> : [];
    return buttons.map((button, index) => ({
      index,
      type: String(button.type || "").toUpperCase(),
      text: String(button.text || "").slice(0, 120),
      url: String(button.url || "").slice(0, 500),
      phoneNumber: String(button.phone_number || button.phoneNumber || "").slice(0, 80)
    }));
  }

  function sanitizeTemplateComponentsForLog(components: unknown[]) {
    return components.map(component => {
      const item = component && typeof component === "object" ? component as Record<string, unknown> : {};
      return {
        type: String(item.type || "").slice(0, 40),
        sub_type: String(item.sub_type || "").slice(0, 40),
        index: String(item.index ?? "").slice(0, 10),
        parameterCount: Array.isArray(item.parameters) ? item.parameters.length : 0
      };
    });
  }

  function validateWhatsAppTemplateComponents(template: WhatsAppCloudTemplateRecord, components: unknown[]) {
    if (!Array.isArray(components)) throw new Error("Componentes invalidos");
    const templateComponents = Array.isArray(template.components) ? template.components as Array<Record<string, unknown>> : [];
    const bodyTemplate = templateComponents.find(component => templateComponentType(component) === "BODY");
    const headerTemplate = templateComponents.find(component => templateComponentType(component) === "HEADER");
    const bodyExpected = countTemplatePlaceholders(bodyTemplate?.text);
    const headerExpected = countTemplatePlaceholders(headerTemplate?.text);
    const approvedButtons = getTemplateButtons(template);
    const bodyComponent = components.find(component => templateComponentType(component) === "BODY") as Record<string, unknown> | undefined;
    const headerComponent = components.find(component => templateComponentType(component) === "HEADER") as Record<string, unknown> | undefined;
    const seenComponentKeys = new Set<string>();
    if (bodyExpected && (!bodyComponent || !Array.isArray(bodyComponent.parameters) || bodyComponent.parameters.length !== bodyExpected)) {
      throw new Error("Preencha todas as variaveis do template");
    }
    if (!bodyExpected && bodyComponent && Array.isArray(bodyComponent.parameters) && bodyComponent.parameters.length) {
      throw new Error("Este template nao aceita variaveis no corpo");
    }
    if (headerExpected && (!headerComponent || !Array.isArray(headerComponent.parameters) || headerComponent.parameters.length !== headerExpected)) {
      throw new Error("Preencha todas as variaveis do cabecalho");
    }
    components.forEach(component => {
      const item = component && typeof component === "object" ? component as Record<string, unknown> : {};
      const type = templateComponentType(item);
      if (!["BODY", "HEADER", "BUTTON"].includes(type)) throw new Error("Componente nao permitido para este template");
      const componentKey = `${type}:${type === "BUTTON" ? String(item.index ?? "") : "main"}`;
      if (seenComponentKeys.has(componentKey)) throw new Error("Componente duplicado no template");
      seenComponentKeys.add(componentKey);
      if (type !== "BUTTON") return;
      const index = Number(item.index);
      const subType = String(item.sub_type || "").toUpperCase();
      const approved = approvedButtons.find(button => button.index === index);
      if (!approved) throw new Error("Botao nao aprovado neste template");
      const allowedSubTypes = approved.type === "URL" ? ["URL"] : approved.type === "QUICK_REPLY" ? ["QUICK_REPLY"] : approved.type === "PHONE_NUMBER" ? ["PHONE_NUMBER"] : [approved.type];
      if (subType && !allowedSubTypes.includes(subType)) throw new Error("Botao nao aprovado neste template");
      const parameters = Array.isArray(item.parameters) ? item.parameters : [];
      if (approved.type === "PHONE_NUMBER" && parameters.length) throw new Error("Botao de telefone nao aceita variaveis livres");
      if ((approved.type === "URL" || approved.type === "QUICK_REPLY") && parameters.length > 1) throw new Error("Botao nao aprovado neste template");
    });
  }

  function isWhatsAppCrmCampaignSegment(value: unknown): value is WhatsAppCrmCampaignSegment {
    return Object.keys(crmBuyerSegmentPredicates).includes(String(value || ""));
  }

  function getWhatsAppCrmCampaignQueue(tenantId: string, campaignId?: string) {
    return whatsappMessageQueue.filter(message =>
      message.tenant_id === tenantId &&
      message.message_type === "whatsapp_crm_campaign" &&
      (!campaignId || message.payload?.campaignId === campaignId)
    );
  }

  function getWhatsAppCrmCampaignLogs(tenantId: string, campaignId?: string) {
    const actions = new Set(["crm_campaign_created", "crm_campaign_preview", "crm_campaign_enqueued", "crm_campaign_cancelled", "crm_campaign_send_requested", "crm_campaign_sent", "crm_campaign_failed", "crm_campaign_skipped"]);
    return whatsappCloudLogs
      .filter(log => log.tenant_id === tenantId && actions.has(log.action) && (!campaignId || log.metadata?.campaignId === campaignId))
      .slice(0, 200);
  }

  function sanitizeWhatsAppCrmCampaign(campaign: WhatsAppCrmCampaignRecord) {
    const queue = getWhatsAppCrmCampaignQueue(campaign.tenant_id, campaign.id);
    return {
      ...campaign,
      components: sanitizeTemplateComponentsForLog(campaign.components),
      queue: {
        total: queue.length,
        queued: queue.filter(item => item.status === "queued").length,
        sent: queue.filter(item => item.status === "sent").length,
        failed: queue.filter(item => item.status === "failed").length,
        skipped: queue.filter(item => item.status === "skipped").length
      }
    };
  }

  function buildWhatsAppCrmCampaignRecipients(req: express.Request, campaign: WhatsAppCrmCampaignRecord) {
    const tenantId = campaign.tenant_id;
    const customers = filterCrmBuyerCustomers(buildCrmBuyerCustomers(req), { search: "", segment: campaign.segment });
    const seenPhones = new Set<string>();
    return customers
      .map(customer => ({
        customerId: customer.id,
        name: customer.nome,
        phone: normalizeBrazilianPhone(customer.whatsapp),
        segment: campaign.segment,
        statusComercial: customer.statusComercial,
        campanhaMaisRecente: customer.campanhaMaisRecente
      }))
      .filter(recipient => {
        if (!isValidBrazilianWhatsAppPhone(recipient.phone)) return false;
        if (seenPhones.has(recipient.phone)) return false;
        seenPhones.add(recipient.phone);
        const contact = whatsappContacts.find(item => item.tenantId === tenantId && item.phone === recipient.phone);
        return !contact?.optOut;
      });
  }

  function countWhatsAppCrmCampaignSentToday(tenantId: string) {
    const today = new Date().toISOString().slice(0, 10);
    return getWhatsAppCrmCampaignQueue(tenantId).filter(message =>
      message.status === "sent" &&
      String(message.sent_at || message.processed_at || message.updated_at || "").startsWith(today)
    ).length;
  }

  function hasRecentWhatsAppCrmCampaignForPhone(tenantId: string, phone: string, cooldownHours: number, excludeMessageId = "") {
    const since = Date.now() - Math.max(1, cooldownHours) * 60 * 60 * 1000;
    return getWhatsAppCrmCampaignQueue(tenantId).some(message =>
      message.id !== excludeMessageId &&
      message.phone === phone &&
      ["queued", "sent"].includes(message.status) &&
      new Date(message.updated_at || message.created_at).getTime() >= since
    );
  }

  function isWhatsAppOptOutCommand(body: string) {
    const normalized = body.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
    return ["SAIR", "PARAR", "CANCELAR", "DESCADASTRAR", "STOP"].includes(normalized);
  }

  function findCustomerIdForWhatsAppContact(tenantId: string, phone: string) {
    const digits = phone.replace(/\D/g, "");
    const variants = new Set([digits, digits.replace(/^55/, "")]);
    return Object.values(customersByPhone).find(customer =>
      customer.tenant_id === tenantId &&
      variants.has(String(customer.phone || "").replace(/\D/g, "").replace(/^55/, ""))
    )?.id;
  }

  function upsertWhatsAppContact(tenantId: string, phone: string, displayName: string, source: string, inboundAt?: string) {
    const now = new Date().toISOString();
    const existing = whatsappContacts.find(contact => contact.tenantId === tenantId && contact.phone === phone);
    const contact: WhatsAppContactRecord = {
      id: existing?.id || createPublicId("WAC_"),
      tenantId,
      customerId: existing?.customerId || findCustomerIdForWhatsAppContact(tenantId, phone),
      phone,
      displayName: String(displayName || existing?.displayName || phone).trim().slice(0, 160),
      source: source || existing?.source || "meta_webhook",
      optOut: Boolean(existing?.optOut),
      optOutAt: existing?.optOutAt,
      lastInboundAt: inboundAt || existing?.lastInboundAt,
      lastOutboundAt: existing?.lastOutboundAt,
      tags: Array.isArray(existing?.tags) ? existing!.tags : [],
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    whatsappContacts = existing ? whatsappContacts.map(item => item.id === existing.id ? contact : item) : [contact, ...whatsappContacts];
    return contact;
  }

  function ensureWhatsAppConversation(tenantId: string, contact: WhatsAppContactRecord, inboundAt?: string) {
    const now = new Date().toISOString();
    const existing = whatsappConversations.find(conversation =>
      conversation.tenantId === tenantId &&
      conversation.contactId === contact.id &&
      conversation.status !== "resolved"
    );
    const serviceWindowExpiresAt = inboundAt ? new Date(new Date(inboundAt).getTime() + 24 * 60 * 60 * 1000).toISOString() : existing?.serviceWindowExpiresAt;
    const conversation: WhatsAppConversationRecord = {
      id: existing?.id || createPublicId("WCV_"),
      tenantId,
      contactId: contact.id,
      phone: contact.phone,
      status: existing?.status || "open",
      assignedUserId: existing?.assignedUserId,
      lastMessageAt: inboundAt || existing?.lastMessageAt || now,
      serviceWindowExpiresAt,
      unreadCount: existing?.unreadCount || 0,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    whatsappConversations = existing ? whatsappConversations.map(item => item.id === existing.id ? conversation : item) : [conversation, ...whatsappConversations];
    return conversation;
  }

  function publicWhatsAppContact(contact: WhatsAppContactRecord) {
    return { ...contact, phoneMasked: maskPhone(contact.phone) };
  }

  function publicWhatsAppConversation(conversation: WhatsAppConversationRecord) {
    const contact = whatsappContacts.find(item => item.id === conversation.contactId);
    return { ...conversation, contact: contact ? publicWhatsAppContact(contact) : null, phoneMasked: maskPhone(conversation.phone) };
  }

  function publicWhatsAppMessage(message: WhatsAppConversationMessageRecord) {
    return { ...message, rawSummary: maskLogValue(message.rawSummary) };
  }

  function recordWhatsAppOptOut(tenantId: string, contact: WhatsAppContactRecord, reason: string, source: string) {
    const now = new Date().toISOString();
    if (!contact.optOut) {
      contact.optOut = true;
      contact.optOutAt = now;
      contact.updatedAt = now;
      whatsappContacts = whatsappContacts.map(item => item.id === contact.id ? contact : item);
    }
    whatsappOptOutEvents.unshift({
      id: createPublicId("WAO_"),
      tenantId,
      contactId: contact.id,
      phone: contact.phone,
      reason,
      source,
      createdAt: now
    });
  }

  function processWhatsAppCenterInboundWebhook(tenantId: string, payload: unknown) {
    const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const entries = Array.isArray(body.entry) ? body.entry as Array<Record<string, unknown>> : [];
    let inboundCount = 0;
    let statusCount = 0;
    entries.forEach(entry => {
      const changes = Array.isArray(entry.changes) ? entry.changes as Array<Record<string, unknown>> : [];
      changes.forEach(change => {
        const value = change.value && typeof change.value === "object" ? change.value as Record<string, unknown> : {};
        const contacts = Array.isArray(value.contacts) ? value.contacts as Array<Record<string, unknown>> : [];
        const contactNames = new Map<string, string>();
        contacts.forEach(item => {
          const profile = item.profile && typeof item.profile === "object" ? item.profile as Record<string, unknown> : {};
          contactNames.set(normalizeWhatsAppCenterPhone(item.wa_id), String(profile.name || "").trim());
        });
        const messages = Array.isArray(value.messages) ? value.messages as Array<Record<string, unknown>> : [];
        messages.forEach(message => {
          const phone = normalizeWhatsAppCenterPhone(message.from);
          if (!phone) return;
          const receivedAt = message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString();
          const contact = upsertWhatsAppContact(tenantId, phone, contactNames.get(phone) || "", "meta_webhook", receivedAt);
          const conversation = ensureWhatsAppConversation(tenantId, contact, receivedAt);
          const bodyText = getWhatsAppInboundBody(message);
          whatsappConversationMessages.push({
            id: createPublicId("WAM_"),
            tenantId,
            conversationId: conversation.id,
            direction: "inbound",
            type: whatsappMessageType(message),
            body: bodyText,
            status: "received",
            metaMessageId: String(message.id || ""),
            receivedAt,
            rawSummary: summarizeWhatsAppInbound(message)
          });
          conversation.unreadCount += 1;
          conversation.lastMessageAt = receivedAt;
          conversation.serviceWindowExpiresAt = new Date(new Date(receivedAt).getTime() + 24 * 60 * 60 * 1000).toISOString();
          conversation.updatedAt = new Date().toISOString();
          whatsappConversations = whatsappConversations.map(item => item.id === conversation.id ? conversation : item);
          if (isWhatsAppOptOutCommand(bodyText)) recordWhatsAppOptOut(tenantId, contact, bodyText.toUpperCase(), "inbound_command");
          inboundCount += 1;
        });
        const statuses = Array.isArray(value.statuses) ? value.statuses as Array<Record<string, unknown>> : [];
        statuses.forEach(status => {
          const metaMessageId = String(status.id || "");
          const statusValue = String(status.status || "unknown").slice(0, 40);
          const existing = whatsappConversationMessages.find(message => message.tenantId === tenantId && message.metaMessageId === metaMessageId);
          if (existing) {
            existing.status = statusValue;
            existing.rawSummary = { ...existing.rawSummary, lastStatus: summarizeWhatsAppStatus(status) };
          } else {
            const phone = normalizeWhatsAppCenterPhone(status.recipient_id);
            const contact = phone ? upsertWhatsAppContact(tenantId, phone, "", "meta_status") : null;
            const conversation = contact ? ensureWhatsAppConversation(tenantId, contact) : null;
            if (conversation) {
              whatsappConversationMessages.push({
                id: createPublicId("WAM_"),
                tenantId,
                conversationId: conversation.id,
                direction: "system",
                type: "status",
                body: statusValue,
                status: statusValue,
                metaMessageId,
                receivedAt: new Date().toISOString(),
                rawSummary: summarizeWhatsAppStatus(status)
              });
            }
          }
          statusCount += 1;
        });
      });
    });
    if (inboundCount || statusCount) schedulePersistentStateSave("whatsapp-center-webhook");
    return { inboundCount, statusCount };
  }

  function upsertWhatsAppCloudConfig(req: express.Request, tenantId: string) {
    const now = new Date().toISOString();
    const existing = getWhatsAppCloudConfig(tenantId);
    const mergeSecret = (incoming: unknown, current?: string) => {
      const value = String(incoming || "").trim();
      if (!value || isMaskedGatewaySecret(value)) return current || "";
      return encryptGatewaySecret(value);
    };
    const config: WhatsAppCloudConfigRecord = {
      id: existing?.id || createPublicId("WCLD_"),
      tenant_id: tenantId,
      enabled: Boolean(req.body.enabled),
      account_name: String(req.body.account_name || existing?.account_name || "").trim().slice(0, 120),
      business_manager_id: String(req.body.business_manager_id || existing?.business_manager_id || "").trim().slice(0, 120),
      whatsapp_business_account_id: String(req.body.whatsapp_business_account_id || existing?.whatsapp_business_account_id || "").trim().slice(0, 120),
      phone_number_id: String(req.body.phone_number_id || existing?.phone_number_id || "").trim().slice(0, 120),
      access_token_encrypted: mergeSecret(req.body.access_token, existing?.access_token_encrypted),
      webhook_verify_token_encrypted: mergeSecret(req.body.webhook_verify_token, existing?.webhook_verify_token_encrypted),
      webhook_url: String(req.body.webhook_url || existing?.webhook_url || "/api/webhooks/meta/whatsapp").trim().slice(0, 500),
      environment: String(req.body.environment || existing?.environment || "sandbox") === "production" ? "production" : "sandbox",
      created_at: existing?.created_at || now,
      updated_at: now
    };
    whatsappCloudConfigs = existing
      ? whatsappCloudConfigs.map(item => item.id === existing.id ? config : item)
      : [config, ...whatsappCloudConfigs];
    recordWhatsAppCloudLog(tenantId, {
      action: "settings_saved",
      status: "success",
      message: "Configuração WhatsApp Cloud salva",
      metadata: {
        enabled: config.enabled,
        environment: config.environment,
        accountName: config.account_name,
        phoneNumberId: config.phone_number_id,
        businessManagerId: config.business_manager_id,
        whatsappBusinessAccountId: config.whatsapp_business_account_id
      }
    });
    recordSecurityEvent({ tenant_id: tenantId, action: "WHATSAPP_CLOUD_CONFIG_UPDATED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "medium", actor: getAuthSession(req)?.email, detail: `${config.environment}:${config.enabled}` });
    schedulePersistentStateSave("whatsapp-cloud-settings");
    return config;
  }

  function buildPublicTicketUrl(purchase: PurchaseRecord) {
    const tenant = tenants.find(item => item.id === purchase.tenant_id);
    const verifiedDomain = tenantDomains.find(domain => domain.tenant_id === purchase.tenant_id && domain.status === "verified" && domain.is_primary);
    const host = verifiedDomain?.domain || tenant?.dominio_customizado || tenant?.dominio || `${tenant?.slug || "rifapro"}.meudominio.com`;
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    return `${protocol}://${host}/rifa/${purchase.raffleId}?pedido=${encodeURIComponent(purchase.purchaseId)}`;
  }

  function getTicketConfirmationOrder(purchase: PurchaseRecord): TicketConfirmationOrder {
    const raffle = raffles.find(item => item.tenant_id === purchase.tenant_id && item.id === purchase.raffleId);
    return {
      orderId: purchase.purchaseId,
      tenantId: purchase.tenant_id,
      campaignName: raffle?.title || purchase.raffleId,
      quantity: purchase.tickets,
      numbers: purchase.numeros,
      amount: purchase.amount,
      phone: purchase.customer?.phone || purchase.contact,
      ticketUrl: buildPublicTicketUrl(purchase)
    };
  }

  const automationTemplates: Array<Omit<AutomationFlowRecord, "id" | "tenant_id" | "created_at" | "updated_at">> = [
    { name: "Recuperacao de PIX abandonado", trigger_type: "abandoned_pix_recovery", enabled: true, delay_minutes: 15, max_runs_per_customer: 2, conditions: { orderStatus: "pending" }, actions: [{ type: "send_whatsapp", template: "abandoned_pix_recovery" }, { type: "add_tag", tag: "pix-pendente" }, { type: "create_audit_event" }] },
    { name: "Bilhete apos pagamento", trigger_type: "payment_confirmed_ticket", enabled: true, delay_minutes: 0, max_runs_per_customer: 20, conditions: { orderStatus: "paid" }, actions: [{ type: "create_audit_event" }] },
    { name: "Agradecimento pos-compra", trigger_type: "post_purchase_thanks", enabled: true, delay_minutes: 0, max_runs_per_customer: 20, conditions: { orderStatus: "paid" }, actions: [{ type: "send_whatsapp", template: "post_purchase_thanks" }, { type: "add_tag", tag: "comprador" }] },
    { name: "Lembrete de rifa encerrando", trigger_type: "raffle_ending_reminder", enabled: false, delay_minutes: 60, max_runs_per_customer: 1, conditions: {}, actions: [{ type: "send_whatsapp", template: "raffle_ending_reminder" }] },
    { name: "Anuncio de ganhador", trigger_type: "winner_announcement", enabled: false, delay_minutes: 0, max_runs_per_customer: 1, conditions: {}, actions: [{ type: "send_whatsapp", template: "winner_announcement" }] },
    { name: "Convite para afiliado", trigger_type: "affiliate_invite", enabled: false, delay_minutes: 0, max_runs_per_customer: 1, conditions: {}, actions: [{ type: "send_whatsapp", template: "affiliate_invite" }, { type: "add_tag", tag: "afiliado-convidado" }] },
    { name: "Reativacao de cliente inativo", trigger_type: "inactive_customer_reactivation", enabled: false, delay_minutes: 0, max_runs_per_customer: 1, conditions: { inactiveDays: 60 }, actions: [{ type: "send_whatsapp", template: "inactive_customer_reactivation" }, { type: "add_tag", tag: "reativacao" }] },
    { name: "Mensagem de aniversario", trigger_type: "birthday_message", enabled: false, delay_minutes: 0, max_runs_per_customer: 1, conditions: {}, actions: [{ type: "send_whatsapp", template: "birthday_message" }] },
    { name: "Oferta cliente VIP", trigger_type: "vip_customer_offer", enabled: false, delay_minutes: 0, max_runs_per_customer: 2, conditions: { status: "vip" }, actions: [{ type: "send_whatsapp", template: "vip_customer_offer" }, { type: "add_tag", tag: "vip-oferta" }] },
    { name: "Retry pagamento falho", trigger_type: "failed_payment_retry", enabled: false, delay_minutes: 10, max_runs_per_customer: 2, conditions: {}, actions: [{ type: "send_whatsapp", template: "failed_payment_retry" }] }
  ];

  function ensureAutomationFlows(tenantId: string) {
    automationTemplates.forEach(template => {
      if (automationFlows.some(flow => flow.tenant_id === tenantId && flow.trigger_type === template.trigger_type)) return;
      const now = new Date().toISOString();
      automationFlows.push({ ...template, id: createPublicId("AUTO_"), tenant_id: tenantId, created_at: now, updated_at: now });
    });
    return automationFlows.filter(flow => flow.tenant_id === tenantId);
  }

  function getAutomationFlowsForRequest(req: express.Request) {
    const session = getAuthSession(req);
    if (normalizeAuthRole(session?.role) === "superadmin") {
      tenants.forEach(tenant => ensureAutomationFlows(tenant.id));
      return automationFlows;
    }
    return ensureAutomationFlows(resolveRequestTenantId(req));
  }

  function buildAutomationMessage(template: string, purchase?: PurchaseRecord, customer?: CustomerRecord) {
    const raffle = purchase ? raffles.find(item => item.tenant_id === purchase.tenant_id && item.id === purchase.raffleId) : undefined;
    const name = customer?.name || purchase?.customer?.name || "cliente";
    const campaign = raffle?.title || "campanha";
    const amount = purchase ? `R$ ${Number(purchase.amount || 0).toFixed(2)}` : "";
    const messages: Record<string, string> = {
      abandoned_pix_recovery: `Ola ${name}, seu PIX da campanha ${campaign} ainda esta pendente. Valor ${amount}. Finalize para garantir suas cotas.`,
      post_purchase_thanks: `Obrigado pela compra, ${name}! Recebemos seu pagamento da campanha ${campaign}. Boa sorte no sorteio.`,
      raffle_ending_reminder: `A campanha ${campaign} esta chegando ao fim. Ainda da tempo de participar.`,
      winner_announcement: `Resultado publicado para ${campaign}. Confira os ganhadores na plataforma.`,
      affiliate_invite: `${name}, voce ja pode participar do programa de afiliados e indicar amigos.`,
      inactive_customer_reactivation: `${name}, sentimos sua falta. Temos novas campanhas esperando por voce.`,
      birthday_message: `Feliz aniversario, ${name}! Preparamos uma oferta especial para voce.`,
      vip_customer_offer: `${name}, voce e VIP por aqui. Confira uma condicao especial nas campanhas ativas.`,
      failed_payment_retry: `${name}, nao conseguimos confirmar seu pagamento. Gere um novo PIX e tente novamente.`
    };
    return messages[template] || `Automacao CIFHER Plataforma para ${name}.`;
  }

  function enqueueAutomationWhatsApp(flow: AutomationFlowRecord, run: AutomationRunRecord, purchase?: PurchaseRecord, customer?: CustomerRecord) {
    const config = getWhatsAppConfig(flow.tenant_id);
    if (!config?.enabled) throw new Error("WhatsApp provider inativo para este tenant");
    const phone = normalizeBrazilianPhone(customer?.phone || purchase?.customer?.phone || purchase?.contact || "");
    if (!isValidBrazilianWhatsAppPhone(phone)) throw new Error("Telefone invalido para WhatsApp");
    const template = String(flow.actions.find(action => action.type === "send_whatsapp")?.template || flow.trigger_type);
    const idempotencyKey = `automation:${flow.id}:${run.order_id || ""}:${run.customer_id || ""}:${template}`;
    const duplicate = whatsappMessageQueue.find(message => message.idempotency_key === idempotencyKey);
    if (duplicate) return duplicate;
    const now = new Date().toISOString();
    const message: WhatsAppMessageQueueRecord = {
      id: createPublicId("WAPP_"),
      tenant_id: flow.tenant_id,
      order_id: run.order_id,
      customer_id: run.customer_id,
      phone,
      message_type: `automation:${template}`,
      message_body: buildAutomationMessage(template, purchase, customer),
      provider: config.provider || "mock",
      status: "pending",
      attempts: 0,
      max_attempts: 3,
      last_error: "",
      created_at: now,
      updated_at: now,
      idempotency_key: idempotencyKey
    };
    whatsappMessageQueue.unshift(message);
    whatsappMessageQueue = whatsappMessageQueue.slice(0, 1000);
    void sendQueuedWhatsAppMessage(message.id);
    return message;
  }

  function executeAutomationRun(run: AutomationRunRecord) {
    const flow = automationFlows.find(item => item.id === run.flow_id && item.tenant_id === run.tenant_id);
    if (!flow || !flow.enabled) {
      run.status = "skipped";
      run.last_error = "Fluxo desativado ou removido";
      run.executed_at = new Date().toISOString();
      return run;
    }
    const purchase = run.order_id ? purchases.find(item => item.tenant_id === run.tenant_id && item.purchaseId === run.order_id) : undefined;
    const customer = run.customer_id
      ? Object.values(customersByPhone).find(item => item.tenant_id === run.tenant_id && item.id === run.customer_id)
      : purchase?.customer;
    if (flow.trigger_type === "abandoned_pix_recovery") {
      expirePendingReservations(run.tenant_id, purchase?.raffleId);
      const expired = !purchase || purchase.status !== "pending" || isPastReservationExpiry(purchase.reservedUntil || purchase.pixExpiresAt);
      if (expired) {
        run.status = "skipped";
        run.last_error = "PIX expirado ou pedido nao pendente";
        run.executed_at = new Date().toISOString();
        return run;
      }
    }
    run.status = "running";
    run.attempts += 1;
    try {
      flow.actions.forEach(action => {
        const type = String(action.type || "");
        if (type === "send_whatsapp") enqueueAutomationWhatsApp(flow, run, purchase, customer);
        if (type === "add_tag" && customer) {
          const contact = buildCrmContactFromCustomer(customer);
          crmContactOverrides[contact.id] = {
            ...(crmContactOverrides[contact.id] || {}),
            tags: Array.from(new Set([...(contact.tags || []), String(action.tag || flow.trigger_type)])),
            updated_at: new Date().toISOString()
          };
        }
        if (type === "create_crm_task" && customer) {
          const contact = buildCrmContactFromCustomer(customer);
          crmContactOverrides[contact.id] = { ...(crmContactOverrides[contact.id] || {}), notes: [contact.notes, `Tarefa automatica: ${flow.name}`].filter(Boolean).join("\n"), updated_at: new Date().toISOString() };
        }
        if (type === "create_audit_event") {
          auditEventLedger.unshift({
            id: createPublicId("AUD_"),
            tenant_id: run.tenant_id,
            actor_role: "system",
            action: "AUTOMATION_EVENT",
            resource_type: "automation_run",
            resource_id: run.id,
            before_data: null,
            after_data: { flow: flow.name, trigger_type: flow.trigger_type, order_id: run.order_id, customer_id: run.customer_id },
            reason: "Execucao automatizada",
            hash: createHash("sha256").update(`${run.id}:${flow.id}:${Date.now()}`).digest("hex"),
            previous_hash: auditEventLedger[0]?.hash,
            created_at: new Date().toISOString()
          });
        }
      });
      run.status = "completed";
      run.last_error = "";
      run.executed_at = new Date().toISOString();
    } catch (error) {
      run.status = run.attempts >= 3 ? "failed" : "scheduled";
      run.last_error = error instanceof Error ? error.message : "Erro na automacao";
      run.scheduled_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    }
    return run;
  }

  function scheduleAutomation(triggerType: AutomationTriggerType | string, input: { tenant_id: string; customer_id?: string; order_id?: string; purchase?: PurchaseRecord; customer?: CustomerRecord }) {
    if (!tenantHasFeature(input.tenant_id, "automations")) return [];
    const flows = ensureAutomationFlows(input.tenant_id).filter(flow => flow.enabled && flow.trigger_type === triggerType);
    const created: AutomationRunRecord[] = [];
    flows.forEach(flow => {
      const existingRuns = automationRuns.filter(run => run.tenant_id === input.tenant_id && run.flow_id === flow.id && run.customer_id === input.customer_id && ["scheduled", "completed"].includes(run.status));
      if (input.customer_id && flow.max_runs_per_customer > 0 && existingRuns.length >= flow.max_runs_per_customer) return;
      const idempotencyKey = `automation:${flow.id}:${input.order_id || ""}:${input.customer_id || ""}:${triggerType}`;
      const duplicate = automationRuns.find(run => run.idempotency_key === idempotencyKey);
      if (duplicate) return;
      const now = new Date();
      const run: AutomationRunRecord = {
        id: createPublicId("ARUN_"),
        tenant_id: input.tenant_id,
        flow_id: flow.id,
        customer_id: input.customer_id,
        order_id: input.order_id,
        status: "scheduled",
        attempts: 0,
        last_error: "",
        scheduled_at: new Date(now.getTime() + Math.max(0, flow.delay_minutes || 0) * 60 * 1000).toISOString(),
        created_at: now.toISOString(),
        idempotency_key: idempotencyKey
      };
      automationRuns.unshift(run);
      created.push(run);
      if (flow.delay_minutes <= 0) executeAutomationRun(run);
    });
    automationRuns = automationRuns.slice(0, 5000);
    return created;
  }

  function processDueAutomationRuns(limit = 50) {
    const now = Date.now();
    const due = automationRuns
      .filter(run => run.status === "scheduled" && new Date(run.scheduled_at).getTime() <= now)
      .slice(0, limit);
    due.forEach(executeAutomationRun);
    return due.length;
  }

  function enqueueWhatsAppTicketConfirmation(purchaseOrOrderId: PurchaseRecord | string) {
    const purchase = typeof purchaseOrOrderId === "string"
      ? purchases.find(item => item.purchaseId === purchaseOrOrderId)
      : purchaseOrOrderId;
    if (!purchase || purchase.status !== "paid") return null;
    const config = getWhatsAppConfig(purchase.tenant_id);
    if (!config?.enabled) return null;

    const idempotencyKey = buildTicketConfirmationIdempotencyKey(purchase.purchaseId);
    const duplicate = whatsappMessageQueue.find(message => message.idempotency_key === idempotencyKey);
    if (duplicate) return duplicate;

    const order = getTicketConfirmationOrder(purchase);
    const phone = normalizeBrazilianPhone(order.phone);
    const now = new Date().toISOString();
    const message: WhatsAppMessageQueueRecord = {
      id: createPublicId("WAPP_"),
      tenant_id: purchase.tenant_id,
      order_id: purchase.purchaseId,
      customer_id: purchase.customer?.id,
      phone,
      message_type: "ticket_confirmation",
      message_body: buildTicketConfirmationMessage(order),
      provider: config.provider || "mock",
      status: isValidBrazilianWhatsAppPhone(phone) ? "pending" : "failed",
      attempts: 0,
      max_attempts: 3,
      last_error: isValidBrazilianWhatsAppPhone(phone) ? "" : "Telefone invalido para WhatsApp",
      created_at: now,
      updated_at: now,
      idempotency_key: idempotencyKey
    };
    whatsappMessageQueue.unshift(message);
    whatsappMessageQueue = whatsappMessageQueue.slice(0, 1000);
    auditLogs.unshift({
      id: createPublicId("AUD_"),
      tenant_id: purchase.tenant_id,
      action: message.status === "failed" ? "WHATSAPP_TICKET_FAILED" : "WHATSAPP_TICKET_ENQUEUED",
      method: "SYSTEM",
      path: "/whatsapp/ticket-confirmation",
      status: message.status === "failed" ? 422 : 202,
      actor: "payment-worker",
      ip: "system",
      createdAt: now,
      detail: `${purchase.purchaseId}:${maskPhone(phone)}`
    });
    if (message.status === "pending") {
      setTimeout(() => { void processWhatsAppQueue(10); }, 0);
    }
    return message;
  }

  async function sendQueuedWhatsAppMessage(messageId: string) {
    const message = whatsappMessageQueue.find(item => item.id === messageId);
    if (!message) throw new Error("Mensagem WhatsApp nao encontrada");
    if (message.status === "sent") return message;
    if (message.attempts >= message.max_attempts) {
      message.status = "failed";
      message.updated_at = new Date().toISOString();
      return message;
    }
    const config = getWhatsAppConfig(message.tenant_id);
    if (!config?.enabled) {
      message.status = "failed";
      message.last_error = "Envio automatico WhatsApp desativado para este tenant";
      message.updated_at = new Date().toISOString();
      return message;
    }
    if (!isValidBrazilianWhatsAppPhone(message.phone)) {
      message.status = "failed";
      message.last_error = "Telefone invalido para WhatsApp";
      message.updated_at = new Date().toISOString();
      return message;
    }

    message.attempts += 1;
    message.status = "retrying";
    message.updated_at = new Date().toISOString();
    try {
      if (message.provider === "meta_cloud") {
        await sendMetaCloudWhatsAppMessage({
          to: message.phone,
          body: message.message_body,
          tenantId: message.tenant_id,
          messageId: message.id
        }, {
          enabled: config.enabled,
          environment: config.environment,
          phone_number_id: config.phone_number_id,
          access_token: decryptGatewaySecret(config.access_token_encrypted || ""),
          default_language: config.default_language,
          template_namespace: config.template_namespace
        });
      } else {
        await sendMockWhatsAppMessage({
          to: message.phone,
          body: message.message_body,
          tenantId: message.tenant_id,
          messageId: message.id
        });
      }
      message.status = "sent";
      message.sent_at = new Date().toISOString();
      message.last_error = "";
      message.updated_at = message.sent_at;
      auditLogs.unshift({
        id: createPublicId("AUD_"),
        tenant_id: message.tenant_id,
        action: "WHATSAPP_TICKET_SENT",
        method: "SYSTEM",
        path: "/whatsapp/queue",
        status: 200,
        actor: message.provider,
        ip: "system",
        createdAt: message.sent_at,
        detail: `${message.order_id}:${maskPhone(message.phone)}`
      });
    } catch (error) {
      message.last_error = error instanceof Error ? error.message : "Falha desconhecida no WhatsApp";
      message.status = message.attempts >= message.max_attempts ? "failed" : "pending";
      message.updated_at = new Date().toISOString();
      auditLogs.unshift({
        id: createPublicId("AUD_"),
        tenant_id: message.tenant_id,
        action: message.status === "failed" ? "WHATSAPP_TICKET_FAILED" : "WHATSAPP_TICKET_RETRYING",
        method: "SYSTEM",
        path: "/whatsapp/queue",
        status: message.status === "failed" ? 500 : 202,
        actor: message.provider,
        ip: "system",
        createdAt: message.updated_at,
        detail: message.last_error
      });
    }
    return message;
  }

  let whatsappWorkerRunning = false;
  async function processWhatsAppQueue(limit = 20) {
    if (whatsappWorkerRunning) return 0;
    whatsappWorkerRunning = true;
    let processed = 0;
    try {
      const ready = whatsappMessageQueue
        .filter(message => ["pending", "retrying"].includes(message.status) && message.attempts < message.max_attempts)
        .slice(0, limit);
      for (const message of ready) {
        await sendQueuedWhatsAppMessage(message.id);
        processed += 1;
      }
      schedulePersistentStateSave("whatsapp-worker");
      return processed;
    } finally {
      whatsappWorkerRunning = false;
    }
  }

  function confirmPurchase(purchase: PurchaseRecord) {
    if (purchase.status === "paid" && purchase.numeros.length > 0) {
      if (purchase.customer) {
        ensureAffiliateForCustomer(purchase.customer, { forceEnable: true, source: "affiliate_auto_first_paid_purchase" });
      }
      recordPublicActivityEvent({
        tenant_id: purchase.tenant_id,
        raffle_id: purchase.raffleId,
        event_type: "purchase_approved",
        customer: purchase.customer,
        amount: purchase.amount,
        quantity: purchase.tickets,
        metadata: { label: "compra aprovada", source: "payment_status", orderId: purchase.purchaseId }
      });
      enqueueWhatsAppTicketConfirmation(purchase);
      scheduleAutomation("payment_confirmed_ticket", { tenant_id: purchase.tenant_id, customer_id: purchase.customer?.id, order_id: purchase.purchaseId, purchase, customer: purchase.customer });
      scheduleAutomation("post_purchase_thanks", { tenant_id: purchase.tenant_id, customer_id: purchase.customer?.id, order_id: purchase.purchaseId, purchase, customer: purchase.customer });
      return purchase;
    }
    const raffle = raffles.find(r => r.tenant_id === purchase.tenant_id && r.id === purchase.raffleId);
    if (!raffle) throw new Error("Raffle not found");

    expirePendingReservations(purchase.tenant_id, purchase.raffleId);
    if (purchase.status === "cancelled") throw new Error("Purchase reservation expired");
    const assignedNumbers = purchase.numeros.length >= purchase.tickets
      ? purchase.numeros.slice(0, purchase.tickets)
      : reserveAvailableNumbers(raffle, purchase.tickets);
    const premiosWon = instantPrizes.filter(
      p => p.tenant_id === purchase.tenant_id && p.raffleId === raffle.id && p.status === "available" && assignedNumbers.includes(p.numeroPremiado)
    );
    premiosWon.forEach(p => p.status = "claimed");

    purchase.status = "paid";
    purchase.numeros = assignedNumbers;
    purchase.premiosInstantaneos = premiosWon;
    recordPublicActivityEvent({
      tenant_id: purchase.tenant_id,
      raffle_id: purchase.raffleId,
      event_type: "purchase_approved",
      customer: purchase.customer,
      amount: purchase.amount,
      quantity: purchase.tickets,
      metadata: { label: "compra aprovada", source: "payment_status", orderId: purchase.purchaseId }
    });
    premiosWon.forEach(prize => recordPublicActivityEvent({
      tenant_id: purchase.tenant_id,
      raffle_id: purchase.raffleId,
      event_type: "instant_prize",
      customer: purchase.customer,
      amount: prize.valorPremio,
      quantity: 1,
      metadata: { label: "premio instantaneo", prize: `R$ ${Number(prize.valorPremio || 0).toFixed(2)}`, orderId: `${purchase.purchaseId}:${prize.id}` }
    }));
    void queueConversionEvent(purchase.tenant_id, "Purchase", {
      purchaseId: purchase.purchaseId,
      raffleId: purchase.raffleId,
      value: purchase.amount,
      currency: "BRL",
      tickets: purchase.tickets,
      customer: {
        id: purchase.customer?.id,
        phone: purchase.customer?.phone,
        city: purchase.customer?.city,
        state: purchase.customer?.state
      }
    });
    const gamificationConfig = getGamificationConfig(purchase.tenant_id, purchase.raffleId);
    const ticketWeight = purchase.gamification?.doubleChance?.applied ? Math.max(2, Number(purchase.gamification.doubleChance.weight || 2)) : 1;
    purchase.ticketWeights = assignedNumbers.map(number => ({
      number,
      weight: ticketWeight,
      reason: ticketWeight > 1 ? "chance_em_dobro" : "padrao"
    }));
    if (purchase.gamification?.doubleTickets?.applied) {
      recordSystemAuditLedger({
        tenant_id: purchase.tenant_id,
        action: "DOUBLE_TICKETS_APPLIED",
        resource_type: "purchase",
        resource_id: purchase.purchaseId,
        before_data: { paidTickets: purchase.tickets - purchase.gamification.doubleTickets.bonusTickets },
        after_data: {
          totalTickets: purchase.tickets,
          bonusTickets: purchase.gamification.doubleTickets.bonusTickets,
          numbers: assignedNumbers,
          label: purchase.gamification.doubleTickets.label
        },
        reason: "Promocao cotas em dobro aplicada"
      });
    }

    if (gamificationConfig.modules.winningTicket) {
      const autoPrizes = gamificationConfig.winningTicket.prizes.filter(prize => prize.status === "available" && assignedNumbers.includes(prize.number));
      autoPrizes.forEach(prize => {
        prize.status = "claimed";
        const winner: GamificationWinner = {
          tenant_id: purchase.tenant_id,
          id: createPublicId("GWIN_"),
          raffleId: purchase.raffleId,
          purchaseId: purchase.purchaseId,
          customerId: purchase.customer?.id,
          module: "winningTicket",
          prize: prize.prize,
          value: prize.value,
          number: prize.number,
          createdAt: new Date().toISOString()
        };
        gamificationWinners.push(winner);
        gamificationEvents.push({
          tenant_id: purchase.tenant_id,
          id: createPublicId("BIL_"),
          raffleId: purchase.raffleId,
          purchaseId: purchase.purchaseId,
          customerId: purchase.customer?.id,
          module: "winningTicket",
          status: "won",
          result: { prize: prize.prize, value: prize.value, number: prize.number, winnerId: winner.id },
          createdAt: winner.createdAt,
          resolvedAt: winner.createdAt
        });
        addGamificationLog(purchase.tenant_id, "WINNING_TICKET_CLAIMED", `${purchase.purchaseId}:${prize.number}`);
      });
      if (autoPrizes.length) {
        purchase.gamification = {
          ...(purchase.gamification || {}),
          autoPrizes: [...(purchase.gamification?.autoPrizes || []), ...autoPrizes.map(prize => prize.prize)]
        };
      }
    }

    if (purchase.customer) {
      purchase.customer.totalTickets += purchase.tickets;
      const ownAffiliate = ensureAffiliateForCustomer(purchase.customer, { forceEnable: true, source: "affiliate_auto_first_paid_purchase" });
      updateCrmAutomationForCustomer(purchase.customer);
      const prizeBalance = premiosWon.reduce((sum, prize) => sum + prize.valorPremio, 0);
      if (prizeBalance > 0) {
        ownAffiliate.prizeBalance += prizeBalance;
        ownAffiliate.commission = ownAffiliate.commissionBalance + ownAffiliate.prizeBalance;
        ownAffiliate.history.push({
          amount: prizeBalance,
          type: "instant_prize",
          date: new Date().toISOString()
        });
      }
    }

    creditAffiliateCommission({
      tenantId: purchase.tenant_id,
      refCode: purchase.refCode,
      buyerCustomerId: purchase.customer?.id,
      amount: purchase.amount,
      source: `conversion:${purchase.purchaseId}`,
      campaign: { type: "raffle", id: purchase.raffleId },
      saleCreatedAt: purchase.createdAt
    });

    purchase.earnedLootboxes = raffle.lootboxEnabled === false
      ? 0
      : processLootboxDrops(purchase.contact, purchase.tickets, purchase.purchaseId, getRaffleLootboxConfig(raffle), `raffle:${raffle.id}`, "raffle", purchase.tenant_id);
    if (purchase.earnedLootboxes > 0) {
      recordPublicActivityEvent({
        tenant_id: purchase.tenant_id,
        raffle_id: purchase.raffleId,
        event_type: "mystery_box",
        customer: purchase.customer,
        amount: 0,
        quantity: purchase.earnedLootboxes,
        metadata: { label: "caixinha premiada", source: "lootbox", orderId: `${purchase.purchaseId}:lootbox` }
      });
    }
    purchase.paymentHistory = purchase.paymentHistory?.length
      ? purchase.paymentHistory
      : [{ status: "paid", label: "Pagamento PIX aprovado", date: new Date().toISOString() }];
    if (getTenantSettings(purchase.tenant_id).n8nIntegration?.sendPurchaseTickets && isRaffleN8nEnabled(raffle)) {
      queueN8nEvent("purchase.tickets_confirmed", buildPurchaseN8nPayload(purchase), { target: purchase.contact, tenantId: purchase.tenant_id });
    }
    enqueueWhatsAppTicketConfirmation(purchase);
    handlePurchaseConfirmedWhatsAppCloudEvent(purchase, "confirmPurchase");
    scheduleAutomation("payment_confirmed_ticket", { tenant_id: purchase.tenant_id, customer_id: purchase.customer?.id, order_id: purchase.purchaseId, purchase, customer: purchase.customer });
    scheduleAutomation("post_purchase_thanks", { tenant_id: purchase.tenant_id, customer_id: purchase.customer?.id, order_id: purchase.purchaseId, purchase, customer: purchase.customer });
    return purchase;
  }

  function creditAffiliateCommission(input: { tenantId: string; refCode?: string; buyerCustomerId?: string; amount: number; source: string; campaign?: AffiliateCampaignRef; saleCreatedAt?: string }) {
    const referrer = input.refCode ? affiliates[tenantCustomerKey(input.tenantId, input.refCode)] : undefined;
    if (!referrer || referrer.customerId === input.buyerCustomerId) return null;
    const affiliate = referrer;
    const purchase = { amount: input.amount };
    if (affiliate.history.some(entry => entry.type === input.source || entry.type === `pending:${input.source}` || entry.type === `ineligible:${input.source}`)) return affiliate;
    const campaignEligibility = affiliateIsEligibleForCampaignCommission(affiliate, input.campaign, input.tenantId, input.saleCreatedAt || new Date().toISOString());
    if (!campaignEligibility.eligible) {
      affiliate.history.push({
        amount: 0,
        type: `ineligible:${input.source}`,
        date: new Date().toISOString(),
        note: campaignEligibility.reason,
        campaignType: input.campaign?.type,
        campaignId: input.campaign?.id
      });
      return affiliate;
    }
    const commissionRate = resolveAffiliateCommissionRate(affiliate);
    const comm = Number((purchase.amount * (commissionRate / 100)).toFixed(2));
    affiliate.conversions++;
    affiliate.revenue += purchase.amount;
    const eligibility = buildAffiliateMonthlyEligibility(affiliate);
    if (eligibility.isEligibleThisMonth) {
      affiliate.commissionBalance += comm;
      affiliate.commission = affiliate.commissionBalance + affiliate.prizeBalance;
      affiliate.history.push({ amount: comm, type: input.source, date: new Date().toISOString(), campaignType: input.campaign?.type, campaignId: input.campaign?.id });
      evaluateAffiliateRewards({ tenantId: input.tenantId, affiliate, source: input.source });
    } else {
      affiliate.history.push({ amount: comm, type: `pending:${input.source}`, date: new Date().toISOString(), campaignType: input.campaign?.type, campaignId: input.campaign?.id });
    }
    return affiliate;
  }

  function affiliateCommissionSourceId(entry: AffiliateLedger) {
    return String(entry.type || "").replace(/^pending:/, "").replace(/^conversion:/, "");
  }

  function isAffiliateRewardEligibleCommission(entry: AffiliateLedger) {
    const type = String(entry.type || "");
    return Number(entry.amount || 0) > 0 && type.startsWith("conversion:");
  }

  function affiliateRewardLabel(type: AffiliateRewardType, quantity: number) {
    const labels: Record<AffiliateRewardType, [string, string]> = {
      scratchcard: ["raspadinha", "raspadinhas"],
      wheel_spin: ["giro na roleta", "giros na roleta"],
      super_quota: ["super cota", "super cotas"],
      bonus_number: ["número bônus", "números bônus"],
      future_reward: ["recompensa futura", "recompensas futuras"]
    };
    const [single, plural] = labels[type] || labels.future_reward;
    return `${quantity} ${quantity === 1 ? single : plural}`;
  }

  function affiliateRewardGoalLabel(type: AffiliateRewardGoalType, threshold: number) {
    const value = Number(threshold || 0);
    if (type === "sales_count") return `${value} ${value === 1 ? "venda indicada" : "vendas indicadas"}`;
    if (type === "customers_count") return `${value} ${value === 1 ? "cliente indicado" : "clientes indicados"}`;
    if (type === "revenue_amount") return `R$ ${value.toFixed(2)} vendidos`;
    return `R$ ${value.toFixed(2)} comissionados`;
  }

  function affiliateRewardProgressValue(affiliate: AffiliateRecord, rule: AffiliatePerformanceRewardRule) {
    const createdAt = new Date(rule.createdAt || 0).getTime();
    const entries = affiliate.history.filter(entry => isAffiliateRewardEligibleCommission(entry) && new Date(entry.date).getTime() >= createdAt);
    if (rule.goalType === "sales_count") return entries.length;
    if (rule.goalType === "commission_amount") return Number(entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0).toFixed(2));
    const sourceIds = new Set(entries.map(affiliateCommissionSourceId));
    const orders = getAffiliatePaidOrders(affiliate.tenant_id, affiliate.refCode)
      .filter(order => sourceIds.has(order.id));
    if (rule.goalType === "customers_count") {
      return new Set(orders.map(order => order.customer?.id || order.id).filter(Boolean)).size;
    }
    return Number(orders.reduce((sum, order) => sum + Number(order.amount || 0), 0).toFixed(2));
  }

  function evaluateAffiliateRewards(input: { tenantId: string; affiliate: AffiliateRecord; source: string }) {
    const affiliate = input.affiliate;
    if (!affiliate || affiliate.tenant_id !== input.tenantId || !affiliate.enabled) return [];
    const settingsForTenant = getTenantSettings(input.tenantId).affiliatePerformanceRewards;
    if (!settingsForTenant?.enabled) return [];
    affiliate.performanceRewards ||= [];
    affiliate.performanceRewardBalances ||= {};
    const generated: AffiliatePerformanceRewardLedger[] = [];
    const now = new Date().toISOString();
    settingsForTenant.rules
      .filter(rule => rule.enabled && Number(rule.threshold || 0) > 0 && Number(rule.rewardQuantity || 0) > 0)
      .forEach(rule => {
        const progress = affiliateRewardProgressValue(affiliate, rule);
        const milestone = Math.floor(progress / Number(rule.threshold || 1));
        if (milestone <= 0) return;
        for (let current = 1; current <= milestone; current++) {
          const rewardId = `${rule.id}:${current}`;
          if (affiliate.performanceRewards?.some(reward => reward.id === rewardId)) continue;
          const reward: AffiliatePerformanceRewardLedger = {
            id: rewardId,
            tenant_id: input.tenantId,
            affiliateRefCode: affiliate.refCode,
            ruleId: rule.id,
            ruleName: rule.name,
            goalType: rule.goalType,
            threshold: rule.threshold,
            milestone: current,
            rewardType: rule.rewardType,
            rewardQuantity: rule.rewardQuantity,
            source: input.source,
            createdAt: now
          };
          affiliate.performanceRewards.push(reward);
          affiliate.performanceRewardBalances[rule.rewardType] = Number(affiliate.performanceRewardBalances[rule.rewardType] || 0) + rule.rewardQuantity;
          generated.push(reward);
        }
      });
    return generated;
  }

  function activeAffiliateRewardRaffle(tenantId: string, rewardType: AffiliateRewardType) {
    const activeRaffles = raffles.filter(raffle => raffle.tenant_id === tenantId && raffle.status === "active");
    if (rewardType === "scratchcard") {
      return activeRaffles.find(raffle => getGamificationConfig(tenantId, raffle.id).modules.scratchcard) || activeRaffles[0];
    }
    return activeRaffles[0];
  }

  function createAffiliateRewardScratchcard(input: { tenantId: string; customer: CustomerRecord; consumptionId: string }) {
    const raffle = activeAffiliateRewardRaffle(input.tenantId, "scratchcard");
    if (!raffle) throw new Error("Nenhuma campanha ativa para liberar raspadinha.");
    const config = getGamificationConfig(input.tenantId, raffle.id);
    config.modules.scratchcard = true;
    const event: GamificationEvent = {
      tenant_id: input.tenantId,
      id: createPublicId("GAM_"),
      raffleId: raffle.id,
      purchaseId: input.consumptionId,
      customerId: input.customer.id,
      module: "scratchcard",
      status: "available",
      result: { source: "affiliate_reward", label: "Raspadinha de afiliado" },
      createdAt: new Date().toISOString()
    };
    gamificationEvents.unshift(event);
    addGamificationLog(input.tenantId, "AFFILIATE_REWARD_SCRATCHCARD_CREATED", `${input.customer.id}:${event.id}`);
    return event;
  }

  function createAffiliateRewardWheelSpin(input: { tenantId: string; customer: CustomerRecord; consumptionId: string }) {
    const customerPhone = normalizePhone(input.customer.phone) || input.customer.phone;
    const userKey = tenantCustomerKey(input.tenantId, customerPhone);
    const economy = createScopedLootboxConfig({
      ...settings.lootboxEconomy,
      experienceType: "wheel",
      rewardModes: { box: false, wheel: true }
    });
    if (!lootboxes[userKey]) lootboxes[userKey] = { boxes: [], history: [] };
    const box: LootboxRecord = {
      tenant_id: input.tenantId,
      id: createPublicId("BOX_"),
      userId: userKey,
      purchaseId: input.consumptionId,
      scopeId: "affiliate_reward",
      scopeType: "global",
      experienceType: "wheel",
      effects: { ...economy.effects },
      wheelSegments: economy.wheelSegments.map(segment => ({ ...segment, reward: segment.reward ? { ...segment.reward } : undefined })),
      status: "closed",
      premiada: false,
      valorPremio: 0,
      lockedPrize: null,
      createdAt: new Date().toISOString()
    };
    lootboxes[userKey].boxes.push(box);
    lootboxes[userKey].history.push({ prize: "Giro de afiliado liberado", date: box.createdAt, won: false });
    return box;
  }

  function normalizeAffiliateRewardType(value: unknown): AffiliateRewardType | null {
    const type = String(value || "");
    return ["scratchcard", "wheel_spin", "super_quota", "bonus_number", "future_reward"].includes(type) ? type as AffiliateRewardType : null;
  }

  function consumeAffiliateReward(input: { tenantId: string; affiliate: AffiliateRecord; rewardType: AffiliateRewardType; quantity?: number; idempotencyKey?: string }) {
    const affiliate = input.affiliate;
    if (!affiliate || affiliate.tenant_id !== input.tenantId || !affiliate.enabled) throw new Error("Acesso negado para esta recompensa.");
    const customer = affiliateOwnerCustomer(affiliate);
    if (!customer) throw new Error("Cliente do afiliado nao encontrado.");
    affiliate.performanceRewardBalances ||= {};
    affiliate.performanceRewardConsumptions ||= [];
    const quantity = input.rewardType === "bonus_number" ? Math.max(1, Math.floor(Number(input.quantity || 1))) : 1;
    const idempotencyKey = String(input.idempotencyKey || "").trim() || createPublicId("AFC_KEY_");
    const existing = affiliate.performanceRewardConsumptions.find(item => item.idempotencyKey === idempotencyKey);
    if (existing) return existing;
    const currentBalance = Number(affiliate.performanceRewardBalances[input.rewardType] || 0);
    if (currentBalance < quantity) throw new Error("Saldo insuficiente para usar esta recompensa.");
    const consumptionId = createPublicId("AFC_");
    let result: AffiliateRewardConsumptionLedger["result"];
    if (input.rewardType === "scratchcard") {
      const event = createAffiliateRewardScratchcard({ tenantId: input.tenantId, customer, consumptionId });
      result = { label: "Raspadinha utilizada", eventId: event.id, message: "Raspadinha liberada para uso." };
    } else if (input.rewardType === "wheel_spin") {
      const box = createAffiliateRewardWheelSpin({ tenantId: input.tenantId, customer, consumptionId });
      result = { label: "Roleta utilizada", lootboxId: box.id, message: "Giro liberado na roleta." };
    } else if (input.rewardType === "super_quota") {
      result = { label: "Super Cota utilizada", benefitQuantity: quantity, message: "Super Cota registrada para atendimento pela operação." };
    } else if (input.rewardType === "bonus_number") {
      result = { label: "Número bônus utilizado", benefitQuantity: quantity, message: `${quantity} número(s) bônus registrado(s).` };
    } else {
      result = { label: "Recompensa futura utilizada", benefitQuantity: quantity, message: "Recompensa registrada para atendimento pela operação." };
    }
    affiliate.performanceRewardBalances[input.rewardType] = Number((currentBalance - quantity).toFixed(2));
    const now = new Date().toISOString();
    const consumption: AffiliateRewardConsumptionLedger = {
      id: consumptionId,
      tenant_id: input.tenantId,
      affiliateRefCode: affiliate.refCode,
      customerId: customer.id,
      rewardType: input.rewardType,
      quantity,
      status: "used",
      idempotencyKey,
      result,
      createdAt: now
    };
    affiliate.performanceRewardConsumptions.unshift(consumption);
    affiliate.history.push({ amount: 0, type: `reward_used:${input.rewardType}:${consumption.id}`, date: now, note: result.label });
    return consumption;
  }

  type AffiliatePaidOrder = {
    id: string;
    tenant_id: string;
    refCode?: string;
    customer?: CustomerRecord;
    amount: number;
    status: string;
    createdAt: string;
    channel: string;
  };

  function getAffiliatePaidOrders(tenantId: string, refCode: string): AffiliatePaidOrder[] {
    const traditional = purchases
      .filter(item => item.tenant_id === tenantId && item.refCode === refCode && item.status === "paid")
      .map(item => ({ id: item.purchaseId, tenant_id: item.tenant_id, refCode: item.refCode, customer: item.customer, amount: item.amount, status: item.status, createdAt: item.createdAt, channel: "rifa" }));
    const modes = numberModePurchases
      .filter(item => item.tenant_id === tenantId && item.refCode === refCode && item.status === "paid")
      .map(item => ({ id: item.id, tenant_id: item.tenant_id, refCode: item.refCode, customer: item.customer, amount: item.amount, status: item.status, createdAt: item.createdAt, channel: item.mode }));
    const farm = fazendinhaCompras
      .filter(item => item.tenant_id === tenantId && item.refCode === refCode && item.statusPagamento === "paid")
      .map(item => ({ id: item.id, tenant_id: item.tenant_id, refCode: item.refCode, customer: item.customer, amount: item.valorPago, status: item.statusPagamento, createdAt: item.paidAt || item.confirmedAt || item.dataCompra, channel: "fazendinha" }));
    return [...traditional, ...modes, ...farm].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function affiliateOwnerCustomer(affiliate: AffiliateRecord) {
    return affiliate.customerId
      ? Object.values(customersByPhone).find(item => item.tenant_id === affiliate.tenant_id && item.id === affiliate.customerId)
      : undefined;
  }

  function isAffiliateOwnerRequest(req: express.Request, affiliate: AffiliateRecord) {
    const customer = affiliateOwnerCustomer(affiliate);
    const session = getAuthSession(req);
    return Boolean(customer && (
      requestOwnsCustomer(req, customer) ||
      (
        session &&
        normalizeAuthRole(session.role) === "afiliado" &&
        session.tenant_id === affiliate.tenant_id &&
        session.sub === customer.id
      )
    ));
  }

  function monthWindow(date = new Date()) {
    return {
      startsAt: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
      endsAt: new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime()
    };
  }

  function buildAffiliateMonthlyEligibility(affiliate: AffiliateRecord, date = new Date()) {
    const tenantScopedSettings = getTenantSettings(affiliate.tenant_id);
    const monthlyRequiredAmount = Math.max(0, Number(tenantScopedSettings.affiliateProgram.monthlyActivationAmount || 0));
    const owner = affiliateOwnerCustomer(affiliate);
    const window = monthWindow(date);
    const monthlyPurchasedAmount = owner
      ? getCustomerPaidActivity(owner)
        .filter(purchase => {
          const createdAt = new Date(purchase.created_at).getTime();
          return createdAt >= window.startsAt && createdAt < window.endsAt;
        })
        .reduce((sum, purchase) => sum + Number(purchase.amount || 0), 0)
      : 0;
    const remainingAmount = Math.max(0, monthlyRequiredAmount - monthlyPurchasedAmount);
    const isEligibleThisMonth = monthlyRequiredAmount <= 0 || monthlyPurchasedAmount >= monthlyRequiredAmount;
    return {
      monthlyRequiredAmount: Number(monthlyRequiredAmount.toFixed(2)),
      monthlyPurchasedAmount: Number(monthlyPurchasedAmount.toFixed(2)),
      remainingAmount: Number(remainingAmount.toFixed(2)),
      isEligibleThisMonth,
      eligibilityStatus: isEligibleThisMonth ? "active" : "pending",
      blockedCommissionAmount: Number(affiliate.history
        .filter(entry => entry.type.startsWith("pending:conversion:"))
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
        .toFixed(2))
    };
  }

  function paidAtFromTraditionalPurchase(purchase: PurchaseRecord) {
    return paidAtFromHistory(purchase.paymentHistory) || purchase.createdAt;
  }

  function affiliateOwnCampaignPaidAt(affiliate: AffiliateRecord, campaign: AffiliateCampaignRef) {
    const owner = affiliateOwnerCustomer(affiliate);
    if (!owner || owner.tenant_id !== affiliate.tenant_id) return "";
    if (campaign.type === "raffle") {
      return purchases
        .filter(purchase =>
          purchase.tenant_id === affiliate.tenant_id &&
          purchase.raffleId === campaign.id &&
          purchase.status === "paid" &&
          (purchase.customer?.id === owner.id || purchase.contact === owner.phone)
        )
        .map(paidAtFromTraditionalPurchase)
        .sort()[0] || "";
    }
    if (campaign.type === "fazendinha") {
      return fazendinhaCompras
        .filter(purchase =>
          purchase.tenant_id === affiliate.tenant_id &&
          purchase.usuarioId === owner.id &&
          purchase.statusPagamento === "paid"
        )
        .map(purchase => purchase.paidAt || purchase.confirmedAt || purchase.dataCompra)
        .sort()[0] || "";
    }
    return numberModePurchases
      .filter(purchase =>
        purchase.tenant_id === affiliate.tenant_id &&
        purchase.mode === campaign.id &&
        purchase.customer.id === owner.id &&
        purchase.status === "paid"
      )
      .map(purchase => purchase.paidAt || purchase.confirmedAt || purchase.createdAt)
      .sort()[0] || "";
  }

  function affiliateIsEligibleForCampaignCommission(affiliate: AffiliateRecord, campaign: AffiliateCampaignRef | undefined, saleTenantId: string, saleCreatedAt: string) {
    if (!campaign) return { eligible: true, reason: "" };
    if (affiliate.tenant_id !== saleTenantId || !affiliate.enabled) {
      return { eligible: false, reason: "Afiliado ainda não participa desta campanha." };
    }
    const ownPaidAt = affiliateOwnCampaignPaidAt(affiliate, campaign);
    if (!ownPaidAt) return { eligible: false, reason: "Afiliado ainda não participa desta campanha." };
    const ownTime = new Date(ownPaidAt).getTime();
    const saleTime = new Date(saleCreatedAt).getTime();
    if (!Number.isFinite(ownTime) || !Number.isFinite(saleTime) || ownTime >= saleTime) {
      return { eligible: false, reason: "Afiliado ainda não participa desta campanha." };
    }
    return { eligible: true, reason: "" };
  }

  function buildAffiliateCampaignCommissionStatus(affiliate: AffiliateRecord, campaign?: AffiliateCampaignRef) {
    if (!campaign) {
      return { commissionEnabled: false, commissionStatusLabel: "Compre para liberar comissão nesta campanha" };
    }
    const ownPaidAt = affiliateOwnCampaignPaidAt(affiliate, campaign);
    const participates = Boolean(ownPaidAt && new Date(ownPaidAt).getTime() < Date.now());
    return {
      commissionEnabled: participates,
      commissionStatusLabel: participates
        ? "Você já participa: comissões liberadas"
        : "Compre para liberar comissão nesta campanha"
    };
  }

  function isPendingAffiliateCommission(entry: AffiliateLedger) {
    return Number(entry.amount || 0) > 0 && entry.type.startsWith("pending:conversion:");
  }

  function releaseEligiblePendingAffiliateCommissions(affiliate: AffiliateRecord) {
    const eligibility = buildAffiliateMonthlyEligibility(affiliate);
    if (!eligibility.isEligibleThisMonth) return eligibility;
    let releasedAmount = 0;
    affiliate.history.forEach(entry => {
      if (!isPendingAffiliateCommission(entry)) return;
      releasedAmount += Number(entry.amount || 0);
      entry.type = entry.type.replace(/^pending:/, "");
      evaluateAffiliateRewards({ tenantId: affiliate.tenant_id, affiliate, source: entry.type });
    });
    if (releasedAmount > 0) {
      affiliate.commissionBalance += Number(releasedAmount.toFixed(2));
      affiliate.commission = affiliate.commissionBalance + affiliate.prizeBalance;
    }
    return buildAffiliateMonthlyEligibility(affiliate);
  }

  function affiliateCommissionEntries(affiliate: AffiliateRecord) {
    return affiliate.history
      .filter(entry => Number(entry.amount || 0) > 0)
      .map(entry => ({
        id: entry.type,
        type: entry.type.startsWith("conversion:") || entry.type.startsWith("pending:conversion:") ? "sale_commission" : entry.type,
        source: entry.type,
        amount: Number(entry.amount || 0),
        status: isPendingAffiliateCommission(entry) ? "pending" : "released",
        createdAt: entry.date
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function affiliatePaidTotal(tenantId: string, refCode: string) {
    return affiliateWithdrawals
      .filter(item => item.tenant_id === tenantId && item.refCode === refCode && item.status === "paid")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }

  function buildAffiliateReferredCustomers(affiliate: AffiliateRecord) {
    const tenantSettings = getTenantSettings(affiliate.tenant_id);
    return Object.values(customersByPhone)
      .filter(customer => customer.tenant_id === affiliate.tenant_id && customer.referredBy === affiliate.refCode)
      .map(customer => {
        const paidOrders = getAffiliatePaidOrders(affiliate.tenant_id, affiliate.refCode)
          .filter(order => order.customer?.id === customer.id);
        const revenue = paidOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
        return {
          id: customer.id,
          customer: maskDisplayName(customer.name),
          plan: "Cliente",
          status: paidOrders.length ? "active" : "registered",
          registeredAt: customer.createdAt,
          lastPaymentAt: paidOrders[0]?.createdAt || "",
          commissionGenerated: Number((revenue * (tenantSettings.affiliateProgram.commissionRate / 100)).toFixed(2))
        };
      })
      .sort((a, b) => String(b.lastPaymentAt || b.registeredAt).localeCompare(String(a.lastPaymentAt || a.registeredAt)));
  }

  function buildAffiliateWithdrawals(affiliate: AffiliateRecord) {
    return affiliateWithdrawals
      .filter(item => item.tenant_id === affiliate.tenant_id && item.refCode === affiliate.refCode)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      .map(item => ({
        id: item.id,
        amount: item.amount,
        status: item.status,
        requestedAt: item.requestedAt,
        paidAt: item.paidAt || "",
        adminNote: item.status === "rejected" ? item.adminNote || "" : ""
      }));
  }

  function buildAffiliatePerformanceRewardsDashboard(affiliate: AffiliateRecord) {
    const rewardSettings = getTenantSettings(affiliate.tenant_id).affiliatePerformanceRewards;
    affiliate.performanceRewards ||= [];
    affiliate.performanceRewardConsumptions ||= [];
    const rules = (rewardSettings?.rules || [])
      .filter(rule => rule.enabled)
      .map(rule => {
        const progress = affiliateRewardProgressValue(affiliate, rule);
        const threshold = Math.max(1, Number(rule.threshold || 1));
        const completed = Math.floor(progress / threshold);
        const currentProgress = rule.goalType === "revenue_amount" || rule.goalType === "commission_amount"
          ? Number((progress % threshold).toFixed(2))
          : progress % threshold;
        return {
          id: rule.id,
          name: rule.name,
          goalType: rule.goalType,
          goalLabel: affiliateRewardGoalLabel(rule.goalType, threshold),
          threshold,
          progress,
          currentProgress,
          progressLabel: `${currentProgress}/${threshold}`,
          percent: Math.min(100, Number(((currentProgress / threshold) * 100).toFixed(2))),
          completed,
          nextReward: affiliateRewardLabel(rule.rewardType, rule.rewardQuantity),
          rewardType: rule.rewardType,
          rewardQuantity: rule.rewardQuantity
        };
      });
    return {
      enabled: Boolean(rewardSettings?.enabled),
      balances: {
        scratchcard: Number(affiliate.performanceRewardBalances?.scratchcard || 0),
        wheel_spin: Number(affiliate.performanceRewardBalances?.wheel_spin || 0),
        super_quota: Number(affiliate.performanceRewardBalances?.super_quota || 0),
        bonus_number: Number(affiliate.performanceRewardBalances?.bonus_number || 0),
        future_reward: Number(affiliate.performanceRewardBalances?.future_reward || 0)
      },
      rules,
      history: affiliate.performanceRewards
        .filter(reward => reward.tenant_id === affiliate.tenant_id && reward.affiliateRefCode === affiliate.refCode)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 50)
        .map(reward => ({
          id: reward.id,
          ruleName: reward.ruleName,
          reward: affiliateRewardLabel(reward.rewardType, reward.rewardQuantity),
          goalLabel: affiliateRewardGoalLabel(reward.goalType, reward.threshold),
          milestone: reward.milestone,
          createdAt: reward.createdAt
        })),
      consumptions: affiliate.performanceRewardConsumptions
        .filter(consumption => consumption.tenant_id === affiliate.tenant_id && consumption.affiliateRefCode === affiliate.refCode)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 50)
        .map(consumption => ({
          id: consumption.id,
          rewardType: consumption.rewardType,
          quantity: consumption.quantity,
          label: consumption.result.label,
          status: consumption.status,
          eventId: consumption.result.eventId,
          lootboxId: consumption.result.lootboxId,
          message: consumption.result.message,
          createdAt: consumption.createdAt
        }))
    };
  }

  function buildAffiliateRanking(tenantId: string, period: "month" | "year") {
    const now = new Date();
    const startsAt = new Date(period === "month" ? now.getFullYear() : now.getFullYear(), period === "month" ? now.getMonth() : 0, 1).getTime();
    return Object.values(affiliates)
      .filter(affiliate => affiliate.tenant_id === tenantId)
      .map(affiliate => {
        const owner = affiliateOwnerCustomer(affiliate);
        const orders = getAffiliatePaidOrders(tenantId, affiliate.refCode).filter(order => new Date(order.createdAt).getTime() >= startsAt);
        const referredCustomers = new Set(orders.map(order => order.customer?.id).filter(Boolean));
        const commissionGenerated = affiliate.history
          .filter(entry => Number(entry.amount || 0) > 0 && new Date(entry.date).getTime() >= startsAt)
          .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
        const clicks = Math.max(0, Number(affiliate.clicks || 0));
        const conversion = clicks > 0 ? Number(((orders.length / clicks) * 100).toFixed(2)) : orders.length > 0 ? 100 : 0;
        return {
          refCode: affiliate.refCode,
          affiliate: maskDisplayName(owner?.name || affiliate.refCode),
          customers: referredCustomers.size,
          conversions: orders.length,
          revenue: Number(orders.reduce((sum, order) => sum + Number(order.amount || 0), 0).toFixed(2)),
          commissionGenerated: Number(commissionGenerated.toFixed(2)),
          conversion
        };
      })
      .filter(item => item.customers > 0 || item.commissionGenerated > 0 || item.revenue > 0)
      .sort((a, b) => b.commissionGenerated - a.commissionGenerated || b.revenue - a.revenue)
      .slice(0, 10)
      .map((item, index) => ({
        position: index + 1,
        affiliate: item.affiliate,
        customers: item.customers,
        conversions: item.conversions,
        revenue: item.revenue,
        conversion: item.conversion
      }));
  }

  function buildAffiliateDashboard(req: express.Request, affiliate: AffiliateRecord) {
    const eligibility = releaseEligiblePendingAffiliateCommissions(affiliate);
    const tenantSettings = getTenantSettings(affiliate.tenant_id);
    const orders = getAffiliatePaidOrders(affiliate.tenant_id, affiliate.refCode);
    const commissions = affiliateCommissionEntries(affiliate);
    const generated = commissions.reduce((sum, item) => sum + item.amount, 0);
    const paid = affiliatePaidTotal(affiliate.tenant_id, affiliate.refCode);
    const released = Math.max(0, Number(affiliate.commissionBalance || 0));
    const pending = commissions
      .filter(item => item.status === "pending")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const referredCustomers = buildAffiliateReferredCustomers(affiliate);
    const withdrawals = buildAffiliateWithdrawals(affiliate);
    const origin = `${req.protocol}://${req.get("host")}`;
    const primaryLink = `${origin}/?ref=${encodeURIComponent(affiliate.refCode)}&utm_source=afiliado&utm_medium=painel`;
    const shortLink = `${origin}/?ref=${encodeURIComponent(affiliate.refCode)}`;
    return {
      refCode: affiliate.refCode,
      couponCode: affiliate.refCode.toUpperCase(),
      links: { primary: primaryLink, short: shortLink },
      rules: tenantSettings.affiliateProgram,
      metrics: {
        clicks: affiliate.clicks,
        conversions: orders.length,
        referredCustomers: referredCustomers.length,
        revenue: Number(orders.reduce((sum, order) => sum + order.amount, 0).toFixed(2)),
        conversionRate: affiliate.clicks > 0 ? Number(((orders.length / affiliate.clicks) * 100).toFixed(2)) : orders.length > 0 ? 100 : 0,
        commissionsTotal: Number(generated.toFixed(2)),
        commissionsPending: Number(pending.toFixed(2)),
        commissionsReleased: released,
        commissionsPaid: Number(paid.toFixed(2)),
        availableToWithdraw: Number(((affiliate.commissionBalance || 0) + (affiliate.prizeBalance || 0)).toFixed(2)),
        prizesBalance: Number((affiliate.prizeBalance || 0).toFixed(2))
      },
      recurring: {
        enabled: false,
        status: "preparation",
        monthlyCommission: 0,
        note: "Nao ha ledger de recorrencia ativo; valores recorrentes nao sao simulados."
      },
      eligibility,
      customers: referredCustomers,
      commissions,
      withdrawals,
      performanceRewards: buildAffiliatePerformanceRewardsDashboard(affiliate),
      ranking: {
        month: buildAffiliateRanking(affiliate.tenant_id, "month"),
        year: buildAffiliateRanking(affiliate.tenant_id, "year")
      }
    };
  }

  function buildAffiliateCampaignLinks(req: express.Request, affiliate: AffiliateRecord) {
    const origin = `${req.protocol}://${req.get("host")}`;
    const tenantId = affiliate.tenant_id;
    const ref = affiliate.refCode;
    const addAffiliateParams = (path: string, extra: Record<string, string> = {}) => {
      const url = new URL(path, origin);
      url.searchParams.set("ref", ref);
      Object.entries(extra).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });
      return url.toString();
    };
    const activeRaffles = raffles.filter(raffle => raffle.tenant_id === tenantId && raffle.status === "active");
    const activeRaffleIds = new Set(activeRaffles.map(raffle => raffle.id));
    const now = Date.now();
    const activeCoupons = campaignCoupons.filter(coupon => {
      if (coupon.tenant_id !== tenantId || !coupon.active) return false;
      if (coupon.maxUses && coupon.used >= coupon.maxUses) return false;
      if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) return false;
      if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now) return false;
      return !coupon.raffleId || activeRaffleIds.has(coupon.raffleId);
    });
    const fazendinha = getFazendinhaConfig(tenantId);
    const numberModes = getNumberModeConfigsForTenant(tenantId).filter(config => config.enabled && config.status === "active");

    return {
      campaigns: [
        ...activeRaffles.map(raffle => ({
          publicId: raffle.id,
          name: raffle.title,
          type: "Rifa",
          status: "Ativa",
          ...buildAffiliateCampaignCommissionStatus(affiliate, { type: "raffle", id: raffle.id }),
          publicPath: `/raffle/${encodeURIComponent(raffle.id)}`,
          affiliateUrl: addAffiliateParams(`/raffle/${encodeURIComponent(raffle.id)}`),
          imageUrl: raffle.image || raffle.mediaUrl || "",
          whatsappText: `Participe da campanha ${raffle.title} pelo meu link: ${addAffiliateParams(`/raffle/${encodeURIComponent(raffle.id)}`)}`
        })),
        ...(fazendinha.enabled && fazendinha.status === "active" ? [{
          publicId: "fazendinha",
          name: fazendinha.name || "A Fazendinha",
          type: "Fazendinha",
          status: "Ativa",
          ...buildAffiliateCampaignCommissionStatus(affiliate, { type: "fazendinha", id: "fazendinha" }),
          publicPath: "/fazendinha",
          affiliateUrl: addAffiliateParams("/fazendinha"),
          imageUrl: fazendinha.mediaUrl || "",
          whatsappText: `Escolha seus bichinhos na Fazendinha pelo meu link: ${addAffiliateParams("/fazendinha")}`
        }] : []),
        ...numberModes.map(config => ({
          publicId: config.id,
          name: config.name,
          type: "Número da Sorte",
          status: "Ativa",
          ...buildAffiliateCampaignCommissionStatus(affiliate, { type: "number_mode", id: config.id }),
          publicPath: `/${config.id}`,
          affiliateUrl: addAffiliateParams(`/${config.id}`),
          imageUrl: config.mediaUrl || "",
          whatsappText: `Participe da modalidade ${config.name} pelo meu link: ${addAffiliateParams(`/${config.id}`)}`
        })),
        ...activeCoupons.map(coupon => {
          const linkedRaffle = coupon.raffleId ? activeRaffles.find(raffle => raffle.id === coupon.raffleId) : undefined;
          const publicPath = linkedRaffle ? `/raffle/${encodeURIComponent(linkedRaffle.id)}` : "/";
          const affiliateUrl = addAffiliateParams(publicPath, { coupon: coupon.code });
          return {
            publicId: coupon.code,
            name: coupon.name || `Promoção ${coupon.code}`,
            type: "Promoção",
            status: "Ativa",
            ...buildAffiliateCampaignCommissionStatus(affiliate, linkedRaffle ? { type: "raffle", id: linkedRaffle.id } : undefined),
            publicPath,
            affiliateUrl,
            imageUrl: linkedRaffle?.image || linkedRaffle?.mediaUrl || "",
            whatsappText: `Use a promoção ${coupon.code} pelo meu link: ${affiliateUrl}`
          };
        })
      ]
    };
  }

  function manuallyConfirmPurchasePayment(purchase: PurchaseRecord, req: express.Request, reason: string) {
    const normalizedReason = String(reason || "").trim();
    if (!normalizedReason) throw new Error("Motivo da confirmacao manual e obrigatorio");
    if (purchase.status === "cancelled") throw new Error("Pedido cancelado nao pode ser confirmado");
    if (purchase.status === "paid") {
      recordSecurityEvent({
        tenant_id: purchase.tenant_id,
        action: "PAYMENT_MANUAL_CONFIRM_DUPLICATE",
        ip: String(req.ip || req.socket.remoteAddress || ""),
        status: "INFO",
        severity: "low",
        actor: getAuthSession(req)?.email,
        detail: purchase.purchaseId
      });
      return purchase;
    }
    const confirmed = confirmPurchase(purchase);
    purchase.linkedPurchases?.forEach(confirmPurchase);
    const alreadyLogged = purchase.paymentHistory?.some(item => item.status === "paid" && item.admin && item.reason === normalizedReason);
    if (!alreadyLogged) {
      purchase.paymentHistory = [
        ...(purchase.paymentHistory || []),
        { status: "paid", label: "Pagamento confirmado manualmente", date: new Date().toISOString(), admin: true, reason: normalizedReason }
      ];
    }
    recordSecurityEvent({
      tenant_id: purchase.tenant_id,
      action: "PAYMENT_MANUAL_CONFIRMED",
      ip: String(req.ip || req.socket.remoteAddress || ""),
      status: "WARN",
      severity: "medium",
      actor: getAuthSession(req)?.email,
      detail: `${purchase.purchaseId}: ${normalizedReason}`
    });
    return confirmed;
  }

  function recordPaymentWebhookLog(log: Omit<PaymentWebhookLog, "id" | "createdAt">) {
    const entry: PaymentWebhookLog = {
      id: createPublicId("PWH_"),
      createdAt: new Date().toISOString(),
      ...log
    };
    paymentWebhookLogs.unshift(entry);
    paymentWebhookLogs = paymentWebhookLogs.slice(0, 500);
    webhookLogs.unshift({
      tenant_id: entry.tenant_id,
      id: createPublicId("WHLOG_"),
      provider: entry.gateway,
      event_id: entry.purchaseId,
      status: entry.status,
      httpStatus: entry.statusCode,
      latencyMs: 0,
      message: entry.message,
      createdAt: entry.createdAt
    });
    webhookLogs = webhookLogs.slice(0, 1000);
    recordPaymentLog({
      tenant_id: entry.tenant_id,
      provider: entry.gateway,
      order_id: entry.purchaseId,
      action: entry.eventStatus === "CONNECTION_TEST" ? "gateway_test" : entry.status === "confirmed" ? "webhook_confirmed" : "webhook_received",
      status: entry.status,
      message: entry.message
    });
    updateGatewayHealth({
      tenant_id: entry.tenant_id,
      provider: entry.gateway,
      ok: !["failed", "invalid"].includes(entry.status),
      statusCode: entry.statusCode,
      message: entry.message
    });
    if (entry.status === "failed" || entry.status === "invalid") {
      const recentFailures = paymentWebhookLogs.filter(item => item.tenant_id === entry.tenant_id && item.gateway === entry.gateway && ["failed", "invalid"].includes(item.status) && new Date(item.createdAt).getTime() >= Date.now() - 60 * 60 * 1000).length;
      if (recentFailures >= 3) {
        createFraudEvent({ tenant_id: entry.tenant_id, order_id: entry.purchaseId, signal_type: "gateway_failures_repetidos", score: Math.min(88, 35 + recentFailures * 12), metadata: { gateway: entry.gateway, recentFailures, status: entry.status } });
      }
    }
    return entry;
  }

  function buildPaymentIdempotencyKey(input: { tenant_id: string; gateway: string; purchaseId?: string; eventStatus?: string; payload?: Record<string, unknown> }) {
    const nestedData = input.payload?.data;
    const nestedDataId = nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)
      ? (nestedData as Record<string, unknown>).id
      : "";
    const asaasPayment = input.payload?.payment && typeof input.payload.payment === "object" && !Array.isArray(input.payload.payment)
      ? input.payload.payment as Record<string, unknown>
      : null;
    const mercadoPagoPayment = input.payload?.payment && typeof input.payload.payment === "object" && !Array.isArray(input.payload.payment)
      ? input.payload.payment as Record<string, unknown>
      : input.payload || {};
    const coraInvoice = input.payload?.invoice && typeof input.payload.invoice === "object" && !Array.isArray(input.payload.invoice)
      ? input.payload.invoice as Record<string, unknown>
      : input.payload?.payment && typeof input.payload.payment === "object" && !Array.isArray(input.payload.payment)
        ? input.payload.payment as Record<string, unknown>
        : input.payload || {};
    const pay2mMessage = input.payload?.message && typeof input.payload.message === "object" && !Array.isArray(input.payload.message)
      ? input.payload.message as Record<string, unknown>
      : null;
    const primepagMessage = input.payload?.message && typeof input.payload.message === "object" && !Array.isArray(input.payload.message)
      ? input.payload.message as Record<string, unknown>
      : input.payload?.qrcode && typeof input.payload.qrcode === "object" && !Array.isArray(input.payload.qrcode)
        ? input.payload.qrcode as Record<string, unknown>
        : input.payload || {};
    const pagbankOrder = input.payload?.order && typeof input.payload.order === "object" && !Array.isArray(input.payload.order)
      ? input.payload.order as Record<string, unknown>
      : input.payload || {};
    const pagbankCharges = Array.isArray((pagbankOrder as Record<string, any>)?.charges) ? (pagbankOrder as Record<string, any>).charges : [];
    const pagbankEndToEnd = String(
      (pagbankOrder as Record<string, any>)?.end_to_end ||
      pagbankCharges[0]?.payment_response?.raw_data?.end_to_end_id ||
      pagbankCharges[0]?.payment_response?.reference ||
      "no-e2e"
    );
    const asaasPaymentId = String(asaasPayment?.id || input.payload?.paymentId || "no-payment");
    const asaasStatus = String(input.payload?.event || input.eventStatus || asaasPayment?.status || "unknown");
    const mercadoPagoPaymentId = String((mercadoPagoPayment as Record<string, unknown>)?.id || input.payload?.paymentId || input.purchaseId || "no-payment");
    const mercadoPagoStatus = String((mercadoPagoPayment as Record<string, unknown>)?.status || input.eventStatus || input.payload?.status || "unknown");
    const coraPaymentId = String((coraInvoice as Record<string, unknown>)?.id || (coraInvoice as Record<string, unknown>)?.invoice_id || input.payload?.providerPaymentId || input.purchaseId || "no-payment");
    const coraStatus = String((coraInvoice as Record<string, unknown>)?.status || input.eventStatus || input.payload?.status || "unknown");
    const coraEndToEnd = String((coraInvoice as Record<string, unknown>)?.end_to_end || input.payload?.end_to_end || "no-e2e");
    const primepagReferenceCode = String((primepagMessage as Record<string, unknown>)?.reference_code || input.payload?.reference_code || input.purchaseId || "no-reference");
    const primepagStatus = String((primepagMessage as Record<string, unknown>)?.status || input.eventStatus || input.payload?.status || "unknown");
    const primepagEndToEnd = String((primepagMessage as Record<string, unknown>)?.end_to_end || input.payload?.end_to_end || "no-e2e");
    const explicitEventId = input.gateway === "asaas"
      ? `${asaasPaymentId}:${asaasStatus}`
      : input.gateway === "mercadopago"
        ? `${mercadoPagoPaymentId}:${mercadoPagoStatus}`
        : input.gateway === "cora"
          ? `${coraPaymentId}:${coraStatus}:${coraEndToEnd}`
        : input.gateway === "primepag"
          ? `${primepagReferenceCode}:${primepagStatus}:${primepagEndToEnd}`
      : input.payload?.eventId || input.payload?.id || nestedDataId ||
      (input.gateway === "pay2m" ? `${pay2mMessage?.reference_code || input.purchaseId || "unknown"}:${pay2mMessage?.status || input.eventStatus || "unknown"}:${pay2mMessage?.end_to_end || "no-e2e"}` : "") ||
      (input.gateway === "pagbank" ? `${pagbankOrder?.id || "no-order"}:${pagbankOrder?.reference_id || input.purchaseId || "unknown"}:${input.eventStatus || pagbankOrder?.status || "unknown"}:${pagbankEndToEnd}` : "");
    if (explicitEventId) return `${input.tenant_id}:${input.gateway}:event:${String(explicitEventId)}`;
    return `${input.tenant_id}:${input.gateway}:purchase:${input.purchaseId || "unknown"}:${input.eventStatus || "unknown"}`;
  }

  function enqueuePaymentJob(input: { tenant_id: string; gateway: string; purchaseId?: string; eventStatus?: string; payload?: Record<string, unknown>; forceRetry?: boolean }) {
    const now = new Date().toISOString();
    const idempotencyKey = buildPaymentIdempotencyKey(input);
    const duplicate = paymentQueue.find(job => job.tenant_id === input.tenant_id && job.idempotencyKey === idempotencyKey);
    if (duplicate && !input.forceRetry) {
      duplicate.duplicateReceipt = true;
      duplicate.updatedAt = now;
      return duplicate;
    }
    const job: PaymentQueueJob = {
      id: createPublicId("PAYQ_"),
      tenant_id: input.tenant_id,
      gateway: input.gateway,
      purchaseId: input.purchaseId,
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      nextRetryAt: now,
      lastError: "",
      idempotencyKey,
      eventStatus: input.eventStatus || "",
      payload: input.payload || {},
      createdAt: now,
      updatedAt: now
    };
    paymentQueue.unshift(job);
    paymentQueue = paymentQueue.slice(0, 500);
    enqueuePaymentWebhookJob({
      tenant_id: input.tenant_id,
      provider: input.gateway,
      event_id: idempotencyKey,
      eventStatus: input.eventStatus,
      payload: input.payload,
      forceRetry: input.forceRetry
    });
    return job;
  }

  function markPaymentJob(job: PaymentQueueJob | undefined, status: PaymentQueueJob["status"], error = "") {
    if (!job) return;
    job.status = status;
    job.lastError = error;
    if (status !== "processing") job.attempts += 1;
    job.updatedAt = new Date().toISOString();
    job.nextRetryAt = status === "pending" || status === "failed"
      ? new Date(Date.now() + paymentWorkerBackoffMs(job.attempts)).toISOString()
      : "";
  }

  function paymentWorkerBackoffMs(attempts: number) {
    const base = 15_000;
    const exponential = base * Math.max(1, 2 ** Math.max(0, attempts - 1));
    return Math.min(exponential, 15 * 60_000);
  }

  function isPaymentWorkerJobReady(job: { status: string; attempts: number; maxAttempts: number; nextRetryAt?: string }) {
    return ["pending", "failed"].includes(job.status) &&
      job.attempts < job.maxAttempts &&
      (!job.nextRetryAt || new Date(job.nextRetryAt).getTime() <= Date.now());
  }

  function markPaymentWorkerJob<T extends { status: PaymentWorkerJobStatus; attempts: number; maxAttempts: number; nextRetryAt: string; lastError: string; updatedAt: string }>(
    job: T | undefined,
    status: PaymentWorkerJobStatus,
    error = ""
  ) {
    if (!job) return;
    job.status = status;
    job.lastError = error;
    if (status !== "processing") job.attempts += 1;
    job.updatedAt = new Date().toISOString();
    job.nextRetryAt = status === "pending" || status === "failed"
      ? new Date(Date.now() + paymentWorkerBackoffMs(job.attempts)).toISOString()
      : "";
  }

  function movePaymentJobToDeadLetter(
    queue: PaymentDeadLetterJob["queue"],
    job: PaymentWebhookJob | PaymentReconciliationJob | PaymentReleaseJob | PaymentQueueJob,
    reason: string
  ) {
    const provider = "provider" in job ? job.provider : job.gateway;
    if (!payment_dead_letter_queue.some(item => item.tenant_id === job.tenant_id && item.idempotencyKey === job.idempotencyKey && item.queue === queue)) {
      payment_dead_letter_queue.unshift({
        id: createPublicId("PAYDLQ_"),
        tenant_id: job.tenant_id,
        queue,
        sourceJobId: job.id,
        provider,
        idempotencyKey: job.idempotencyKey,
        attempts: job.attempts,
        reason,
        payload: "payload" in job ? job.payload : {},
        createdAt: new Date().toISOString()
      });
      payment_dead_letter_queue = payment_dead_letter_queue.slice(0, 1000);
    }
    recordPaymentLog({
      tenant_id: job.tenant_id,
      provider,
      action: "payment_updated",
      status: "dead_letter",
      message: `${queue} job movido para dead letter: ${reason}`,
      order_id: "purchaseId" in job ? job.purchaseId : "order_id" in job ? job.order_id : undefined,
      provider_payment_id: "provider_payment_id" in job ? job.provider_payment_id : undefined
    });
    schedulePersistentStateSave("payment-dead-letter");
  }

  function enqueuePaymentWebhookJob(input: { tenant_id: string; provider: string; event_id?: string; eventStatus?: string; payload?: Record<string, unknown>; forceRetry?: boolean }) {
    const now = new Date().toISOString();
    const eventId = String(input.event_id || input.payload?.id || input.payload?.eventId || `${input.provider}:${input.eventStatus || "unknown"}`);
    const idempotencyKey = `${input.tenant_id}:${input.provider}:webhook:${eventId}:${input.eventStatus || extractPaymentStatus(input.payload as Record<string, any> || {})}`;
    const duplicate = payment_webhook_jobs.find(job => job.tenant_id === input.tenant_id && job.provider === input.provider && job.idempotencyKey === idempotencyKey);
    if (duplicate && !input.forceRetry) {
      duplicate.updatedAt = now;
      return duplicate;
    }
    const job: PaymentWebhookJob = {
      id: createPublicId("PAYWH_"),
      tenant_id: input.tenant_id,
      provider: input.provider,
      event_id: eventId,
      eventStatus: input.eventStatus || "",
      payload: input.payload || {},
      status: "pending",
      attempts: 0,
      maxAttempts: 5,
      nextRetryAt: now,
      lastError: "",
      idempotencyKey,
      createdAt: now,
      updatedAt: now
    };
    payment_webhook_jobs.unshift(job);
    payment_webhook_jobs = payment_webhook_jobs.slice(0, 1000);
    recordPaymentLog({ tenant_id: input.tenant_id, provider: input.provider, action: "webhook_received", status: "queued", message: "Webhook recebido e enfileirado para processamento assincrono" });
    return job;
  }

  function enqueuePaymentReconciliationJob(input: { tenant_id: string; provider: string; provider_payment_id?: string; provider_reference?: string; order_id?: string; payload?: Record<string, unknown>; forceRetry?: boolean }) {
    const now = new Date().toISOString();
    const idempotencyKey = `${input.tenant_id}:${input.provider}:reconcile:${input.provider_payment_id || input.provider_reference || input.order_id || "unknown"}`;
    const duplicate = payment_reconciliation_jobs.find(job => job.tenant_id === input.tenant_id && job.provider === input.provider && job.idempotencyKey === idempotencyKey);
    if (duplicate && !input.forceRetry) {
      duplicate.updatedAt = now;
      return duplicate;
    }
    const job: PaymentReconciliationJob = {
      id: createPublicId("PAYREC_"),
      tenant_id: input.tenant_id,
      provider: input.provider,
      provider_payment_id: input.provider_payment_id,
      provider_reference: input.provider_reference,
      order_id: input.order_id,
      status: "pending",
      attempts: 0,
      maxAttempts: 5,
      nextRetryAt: now,
      lastError: "",
      idempotencyKey,
      payload: input.payload || {},
      createdAt: now,
      updatedAt: now
    };
    payment_reconciliation_jobs.unshift(job);
    payment_reconciliation_jobs = payment_reconciliation_jobs.slice(0, 1000);
    recordPaymentLog({ tenant_id: input.tenant_id, provider: input.provider, action: "reconcile", status: "queued", message: "Conciliação enfileirada", order_id: input.order_id, provider_payment_id: input.provider_payment_id });
    return job;
  }

  function enqueuePaymentReleaseJob(input: { tenant_id: string; gateway: string; purchaseId: string; releaseType: PaymentReleaseJob["releaseType"]; paymentJobId?: string; payload?: Record<string, unknown>; forceRetry?: boolean }) {
    const now = new Date().toISOString();
    const idempotencyKey = `${input.tenant_id}:${input.gateway}:release:${input.releaseType}:${input.purchaseId}`;
    const duplicate = payment_release_jobs.find(job => job.tenant_id === input.tenant_id && job.gateway === input.gateway && job.idempotencyKey === idempotencyKey);
    if (duplicate && !input.forceRetry) {
      duplicate.duplicateReceipt = true;
      duplicate.updatedAt = now;
      return duplicate;
    }
    const job: PaymentReleaseJob = {
      id: createPublicId("PAYREL_"),
      tenant_id: input.tenant_id,
      gateway: input.gateway,
      purchaseId: input.purchaseId,
      releaseType: input.releaseType,
      paymentJobId: input.paymentJobId,
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      nextRetryAt: now,
      lastError: "",
      idempotencyKey,
      payload: input.payload || {},
      createdAt: now,
      updatedAt: now
    };
    payment_release_jobs.unshift(job);
    payment_release_jobs = payment_release_jobs.slice(0, 1000);
    recordPaymentLog({ tenant_id: input.tenant_id, provider: input.gateway, action: "payment_updated", status: "release_queued", message: "Liberação de cotas/números enfileirada", order_id: input.purchaseId });
    return job;
  }

  function extractPaymentReference(gateway: string, payload: Record<string, any>) {
    if (gateway === "mercadopago") return payload.external_reference || payload.purchaseId;
    if (gateway === "asaas") return payload.payment?.externalReference || payload.purchaseId;
    if (gateway === "pay2m") return payload.message?.external_reference || payload.external_reference || payload.purchaseId;
    if (gateway === "pagbank") return payload.order?.reference_id || payload.reference_id || payload.referenceId || payload.purchaseId;
    return payload.purchaseId || payload.external_reference || payload.reference;
  }

  function extractPaymentStatus(payload: Record<string, any>) {
    return String(
      payload.status ||
      payload.payment?.status ||
      payload.message?.status ||
      payload.order?.status ||
      payload.data?.status ||
      payload.event ||
      payload.action ||
      ""
    ).toLowerCase();
  }

  function isPaidPaymentEvent(rawStatus: string) {
    return ["paid", "approved", "confirmed", "received", "payment.updated", "payment.paid"].some(status => rawStatus.includes(status));
  }

  function isPaidAsaasEvent(tenantId: string, rawStatus: string) {
    const normalized = rawStatus.toUpperCase();
    const releaseMode = getAsaasGatewayConfig(tenantId)?.releaseMode || "PAYMENT_RECEIVED";
    if (releaseMode === "PAYMENT_CONFIRMED") return normalized.includes("PAYMENT_CONFIRMED") || normalized === "CONFIRMED";
    return normalized.includes("PAYMENT_RECEIVED") || normalized === "RECEIVED";
  }

  function isPaidMercadoPagoEvent(rawStatus: string) {
    return String(rawStatus || "").toLowerCase() === "approved";
  }

  function isPaidCoraEvent(rawStatus: string) {
    return ["paid", "confirmed", "received", "settled"].includes(String(rawStatus || "").toLowerCase());
  }

  function isPaidPrimepagEvent(rawStatus: string) {
    return ["paid", "pago", "completed", "confirmed", "settled"].includes(String(rawStatus || "").toLowerCase());
  }

  function isPaidPay2mEvent(rawStatus: string) {
    return String(rawStatus || "").toLowerCase() === "paid";
  }

  function isPaidPagbankEvent(rawStatus: string) {
    return ["PAID", "AUTHORIZED", "AVAILABLE", "COMPLETED"].includes(String(rawStatus || "").toUpperCase());
  }

  async function processPaymentReleaseJob(job: PaymentReleaseJob) {
    if (!isPaymentWorkerJobReady(job)) return job;
    const lockKey = `${job.tenant_id}:${job.gateway}:${job.releaseType}:${job.purchaseId}`;
    if (paymentReleaseLocks.has(lockKey)) {
      job.lastError = "Release already locked";
      job.nextRetryAt = new Date(Date.now() + paymentWorkerBackoffMs(Math.max(1, job.attempts))).toISOString();
      return job;
    }
    paymentReleaseLocks.add(lockKey);
    markPaymentWorkerJob(job, "processing");
    try {
      if (job.releaseType === "number_mode") {
        const modePurchase = numberModePurchases.find(item => item.tenant_id === job.tenant_id && item.id === job.purchaseId);
        if (!modePurchase) throw new Error("Number mode purchase not found for tenant");
        if (modePurchase.status === "paid") {
          markPaymentWorkerJob(job, "completed", "Webhook duplicado idempotente");
          job.result = { duplicate: true, purchaseId: job.purchaseId, type: "modalidade" };
          return job;
        }
        confirmNumberModePurchase(modePurchase);
        updatePaymentRecordStatus(job.tenant_id, job.gateway, job.purchaseId, "paid", { releaseJobId: job.id, webhook: job.payload });
        markPaymentWorkerJob(job, "completed");
        job.result = { success: true, purchaseId: job.purchaseId, type: "modalidade", earnedLootboxes: modePurchase.earnedLootboxes };
        return job;
      }

      if (job.releaseType === "fazendinha") {
        const farmPurchase = fazendinhaCompras.find(item => item.tenant_id === job.tenant_id && item.id === job.purchaseId);
        if (!farmPurchase) throw new Error("Fazendinha purchase not found for tenant");
        if (farmPurchase.statusPagamento === "paid") {
          markPaymentWorkerJob(job, "completed", "Webhook duplicado idempotente");
          job.result = { duplicate: true, purchaseId: job.purchaseId, type: "fazendinha" };
          return job;
        }
        confirmFazendinhaPurchase(farmPurchase);
        updatePaymentRecordStatus(job.tenant_id, job.gateway, job.purchaseId, "paid", { releaseJobId: job.id, webhook: job.payload });
        markPaymentWorkerJob(job, "completed");
        job.result = { success: true, purchaseId: job.purchaseId, type: "fazendinha", earnedLootboxes: farmPurchase.earnedLootboxes };
        return job;
      }

      const purchase = purchases.find(item => item.tenant_id === job.tenant_id && item.purchaseId === job.purchaseId);
      if (!purchase) throw new Error("Purchase not found for tenant");
      if (purchase.status === "paid") {
        markPaymentWorkerJob(job, "completed", "Webhook duplicado idempotente");
        job.result = { duplicate: true, purchaseId: job.purchaseId, type: "raffle" };
        return job;
      }
      confirmPurchase(purchase);
      purchase.linkedPurchases?.forEach(confirmPurchase);
      updatePaymentRecordStatus(job.tenant_id, job.gateway, job.purchaseId, "paid", { releaseJobId: job.id, webhook: job.payload });
      markPaymentWorkerJob(job, "completed");
      job.result = { success: true, purchaseId: job.purchaseId, type: "raffle", earnedLootboxes: purchase.earnedLootboxes };
      return job;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na alocacao";
      markPaymentWorkerJob(job, job.attempts + 1 >= job.maxAttempts ? "dead" : "pending", message);
      if (job.status === "dead") movePaymentJobToDeadLetter("release", job, message);
      return job;
    } finally {
      paymentReleaseLocks.delete(lockKey);
    }
  }

  async function processPaymentJob(job: PaymentQueueJob) {
    if (!["pending", "failed"].includes(job.status)) return job;
    if (job.status === "failed" && job.attempts >= job.maxAttempts) return job;
    if (job.nextRetryAt && new Date(job.nextRetryAt).getTime() > Date.now()) return job;

    markPaymentJob(job, "processing");
    const rawStatus = job.eventStatus || extractPaymentStatus(job.payload as Record<string, any>);
    const isPaidEvent = job.gateway === "asaas"
      ? isPaidAsaasEvent(job.tenant_id, rawStatus)
      : job.gateway === "mercadopago"
        ? isPaidMercadoPagoEvent(rawStatus)
        : job.gateway === "cora"
          ? isPaidCoraEvent(rawStatus)
        : job.gateway === "primepag"
          ? isPaidPrimepagEvent(rawStatus)
      : job.gateway === "pay2m"
        ? isPaidPay2mEvent(rawStatus)
        : job.gateway === "pagbank"
          ? isPaidPagbankEvent(rawStatus)
          : isPaidPaymentEvent(rawStatus);
    const purchaseId = job.purchaseId || extractPaymentReference(job.gateway, job.payload as Record<string, any>);
    job.purchaseId = purchaseId || job.purchaseId;

    const simulateFailure = job.payload?.["simulateFailure"];
    if (simulateFailure && (simulateFailure !== "once" || job.attempts === 0)) {
      markPaymentJob(job, job.attempts + 1 >= job.maxAttempts ? "failed" : "pending", "Falha simulada para retry");
      if (simulateFailure === "once" && job.status === "pending") {
        job.nextRetryAt = new Date().toISOString();
      }
      recordPaymentWebhookLog({
        tenant_id: job.tenant_id,
        gateway: job.gateway,
        purchaseId: job.purchaseId,
        status: "failed",
        message: "Falha simulada para retry",
        statusCode: 503,
        eventStatus: rawStatus
      });
      return job;
    }

    if (!isPaidEvent) {
      markPaymentJob(job, "cancelled", "Evento nao confirma pagamento");
      recordPaymentWebhookLog({
        tenant_id: job.tenant_id,
        gateway: job.gateway,
        purchaseId: job.purchaseId,
        status: "ignored",
        message: "Webhook ignored because payment is not confirmed",
        statusCode: 202,
        eventStatus: rawStatus
      });
      return job;
    }

    if (!purchaseId) {
      markPaymentJob(job, job.attempts + 1 >= job.maxAttempts ? "failed" : "pending", "No reference provided");
      recordPaymentWebhookLog({
        tenant_id: job.tenant_id,
        gateway: job.gateway,
        status: "invalid",
        message: "No reference provided",
        statusCode: 400,
        eventStatus: rawStatus
      });
      return job;
    }

    const purchase = purchases.find(p => p.tenant_id === job.tenant_id && p.purchaseId === purchaseId);
    if (!purchase) {
      const modePurchase = numberModePurchases.find(item => item.tenant_id === job.tenant_id && item.id === purchaseId);
      if (modePurchase) {
        if (modePurchase.status === "paid") {
          markPaymentJob(job, "paid", "Webhook duplicado idempotente");
          job.result = { duplicate: true, purchaseId };
          recordPaymentWebhookLog({ tenant_id: job.tenant_id, gateway: job.gateway, purchaseId, status: "duplicate", message: "Webhook ignored because number mode purchase is already paid", statusCode: 200, eventStatus: rawStatus });
          return job;
        }
        try {
          const releaseJob = enqueuePaymentReleaseJob({ tenant_id: job.tenant_id, gateway: job.gateway, purchaseId, releaseType: "number_mode", paymentJobId: job.id, payload: job.payload });
          await processPaymentReleaseJob(releaseJob);
          if (releaseJob.status !== "completed") throw new Error(releaseJob.lastError || "Falha na alocacao");
          markPaymentJob(job, "paid");
          job.result = releaseJob.result || { success: true, purchaseId, type: "modalidade", earnedLootboxes: modePurchase.earnedLootboxes };
          recordPaymentWebhookLog({ tenant_id: job.tenant_id, gateway: job.gateway, purchaseId, status: "confirmed", message: "Pagamento de modalidade liquidado", statusCode: 200, eventStatus: rawStatus });
        } catch {
          markPaymentJob(job, job.attempts + 1 >= job.maxAttempts ? "failed" : "pending", "Falha na alocacao");
          recordPaymentWebhookLog({ tenant_id: job.tenant_id, gateway: job.gateway, purchaseId, status: "failed", message: "Reserva de modalidade expirada", statusCode: 409, eventStatus: rawStatus });
        }
        return job;
      }
      const farmPurchase = fazendinhaCompras.find(item => item.tenant_id === job.tenant_id && item.id === purchaseId);
      if (farmPurchase) {
        if (farmPurchase.statusPagamento === "paid") {
          markPaymentJob(job, "paid", "Webhook duplicado idempotente");
          job.result = { duplicate: true, purchaseId };
          recordPaymentWebhookLog({ tenant_id: job.tenant_id, gateway: job.gateway, purchaseId, status: "duplicate", message: "Webhook ignored because Fazendinha purchase is already paid", statusCode: 200, eventStatus: rawStatus });
          return job;
        }
        try {
          const releaseJob = enqueuePaymentReleaseJob({ tenant_id: job.tenant_id, gateway: job.gateway, purchaseId, releaseType: "fazendinha", paymentJobId: job.id, payload: job.payload });
          await processPaymentReleaseJob(releaseJob);
          if (releaseJob.status !== "completed") throw new Error(releaseJob.lastError || "Falha na alocacao");
          markPaymentJob(job, "paid");
          job.result = releaseJob.result || { success: true, purchaseId, type: "fazendinha", earnedLootboxes: farmPurchase.earnedLootboxes };
          recordPaymentWebhookLog({ tenant_id: job.tenant_id, gateway: job.gateway, purchaseId, status: "confirmed", message: "Pagamento da Fazendinha liquidado", statusCode: 200, eventStatus: rawStatus });
        } catch {
          markPaymentJob(job, job.attempts + 1 >= job.maxAttempts ? "failed" : "pending", "Falha na alocacao");
          recordPaymentWebhookLog({ tenant_id: job.tenant_id, gateway: job.gateway, purchaseId, status: "failed", message: "Reserva da Fazendinha expirada", statusCode: 409, eventStatus: rawStatus });
        }
        return job;
      }
      markPaymentJob(job, job.attempts + 1 >= job.maxAttempts ? "failed" : "pending", "Purchase not found for tenant");
      recordPaymentWebhookLog({
        tenant_id: job.tenant_id,
        gateway: job.gateway,
        purchaseId,
        status: "invalid",
        message: "Purchase not found for tenant",
        statusCode: 404,
        eventStatus: rawStatus
      });
      return job;
    }

    if (purchase.status === "paid") {
      markPaymentJob(job, "paid", "Webhook duplicado idempotente");
      job.result = { duplicate: true, purchaseId };
      recordPaymentWebhookLog({
        tenant_id: job.tenant_id,
        gateway: job.gateway,
        purchaseId,
        status: "duplicate",
        message: "Webhook ignored because purchase is already paid",
        statusCode: 200,
        eventStatus: rawStatus
      });
      return job;
    }

    try {
      const releaseJob = enqueuePaymentReleaseJob({ tenant_id: job.tenant_id, gateway: job.gateway, purchaseId, releaseType: "raffle", paymentJobId: job.id, payload: job.payload });
      await processPaymentReleaseJob(releaseJob);
      if (releaseJob.status !== "completed") throw new Error(releaseJob.lastError || "Falha na alocacao");
      markPaymentJob(job, "paid");
      job.result = releaseJob.result || { success: true, purchaseId, earnedLootboxes: purchase.earnedLootboxes };
      recordPaymentWebhookLog({
        tenant_id: job.tenant_id,
        gateway: job.gateway,
        purchaseId,
        status: "confirmed",
        message: "Pagamento liquidado e hashes gerados",
        statusCode: 200,
        eventStatus: rawStatus
      });
    } catch {
      markPaymentJob(job, job.attempts + 1 >= job.maxAttempts ? "failed" : "pending", "Falha na alocacao");
      recordPaymentWebhookLog({
        tenant_id: job.tenant_id,
        gateway: job.gateway,
        purchaseId,
        status: "failed",
        message: "Falha na alocacao",
        statusCode: 409,
        eventStatus: rawStatus
      });
    }
    return job;
  }

  let paymentWorkerRunning = false;
  async function processPaymentQueue(limit = 20) {
    if (paymentWorkerRunning) return 0;
    paymentWorkerRunning = true;
    let processed = 0;
    try {
      const ready = paymentQueue
        .filter(job => ["pending", "failed"].includes(job.status) && job.attempts < job.maxAttempts && (!job.nextRetryAt || new Date(job.nextRetryAt).getTime() <= Date.now()))
        .slice(0, limit);
      for (const job of ready) {
        await processPaymentJob(job);
        if (job.status === "failed" && job.attempts >= job.maxAttempts) {
          movePaymentJobToDeadLetter("payment", job, job.lastError || "Max attempts reached");
        }
        processed += 1;
      }
      schedulePersistentStateSave("payment-worker");
      return processed;
    } finally {
      paymentWorkerRunning = false;
    }
  }

  let paymentWebhookWorkerRunning = false;
  async function processPaymentWebhookJob(job: PaymentWebhookJob) {
    if (!isPaymentWorkerJobReady(job)) return job;
    markPaymentWorkerJob(job, "processing");
    try {
      const purchaseId = String(job.payload.purchaseId || extractPaymentReference(job.provider, job.payload as Record<string, any>) || "");
      enqueuePaymentJob({
        tenant_id: job.tenant_id,
        gateway: job.provider,
        purchaseId: purchaseId || undefined,
        eventStatus: job.eventStatus || extractPaymentStatus(job.payload as Record<string, any>),
        payload: job.payload
      });
      markPaymentWorkerJob(job, "completed");
      recordPaymentWebhookLog({
        tenant_id: job.tenant_id,
        gateway: job.provider,
        purchaseId: purchaseId || undefined,
        status: "received",
        message: "Webhook processado pela fila resiliente",
        statusCode: 200,
        eventStatus: job.eventStatus
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao processar webhook";
      markPaymentWorkerJob(job, job.attempts + 1 >= job.maxAttempts ? "dead" : "pending", message);
      if (job.status === "dead") movePaymentJobToDeadLetter("webhook", job, message);
    }
    return job;
  }

  async function processPaymentWebhookQueue(limit = 20) {
    if (paymentWebhookWorkerRunning) return 0;
    paymentWebhookWorkerRunning = true;
    let processed = 0;
    try {
      const ready = payment_webhook_jobs.filter(isPaymentWorkerJobReady).slice(0, limit);
      for (const job of ready) {
        await processPaymentWebhookJob(job);
        processed += 1;
      }
      schedulePersistentStateSave("payment-webhook-worker");
      return processed;
    } finally {
      paymentWebhookWorkerRunning = false;
    }
  }

  let paymentReconciliationWorkerRunning = false;
  async function processPaymentReconciliationJob(job: PaymentReconciliationJob) {
    if (!isPaymentWorkerJobReady(job)) return job;
    markPaymentWorkerJob(job, "processing");
    try {
      const payment = payments.find(item =>
        item.tenant_id === job.tenant_id &&
        item.provider === job.provider &&
        (
          (!!job.provider_payment_id && item.provider_payment_id === job.provider_payment_id) ||
          (!!job.provider_reference && item.provider_reference === job.provider_reference) ||
          (!!job.order_id && item.order_id === job.order_id)
        )
      );
      if (!payment) throw new Error("Payment not found for tenant");
      enqueuePaymentJob({
        tenant_id: job.tenant_id,
        gateway: job.provider,
        purchaseId: payment.order_id,
        eventStatus: String(job.payload.status || "reconciliation.paid"),
        payload: { ...job.payload, purchaseId: payment.order_id, provider_payment_id: payment.provider_payment_id }
      });
      markPaymentWorkerJob(job, "completed");
      recordPaymentLog({
        tenant_id: job.tenant_id,
        provider: job.provider,
        action: "reconcile",
        status: "queued",
        message: "Conciliação localizou pagamento e enfileirou baixa",
        order_id: payment.order_id,
        provider_payment_id: payment.provider_payment_id
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na reconciliacao";
      markPaymentWorkerJob(job, job.attempts + 1 >= job.maxAttempts ? "dead" : "pending", message);
      if (job.status === "dead") movePaymentJobToDeadLetter("reconciliation", job, message);
    }
    return job;
  }

  async function processPaymentReconciliationQueue(limit = 20) {
    if (paymentReconciliationWorkerRunning) return 0;
    paymentReconciliationWorkerRunning = true;
    let processed = 0;
    try {
      const ready = payment_reconciliation_jobs.filter(isPaymentWorkerJobReady).slice(0, limit);
      for (const job of ready) {
        await processPaymentReconciliationJob(job);
        processed += 1;
      }
      schedulePersistentStateSave("payment-reconciliation-worker");
      return processed;
    } finally {
      paymentReconciliationWorkerRunning = false;
    }
  }

  let paymentReleaseWorkerRunning = false;
  async function processPaymentReleaseQueue(limit = 20) {
    if (paymentReleaseWorkerRunning) return 0;
    paymentReleaseWorkerRunning = true;
    let processed = 0;
    try {
      const ready = payment_release_jobs.filter(isPaymentWorkerJobReady).slice(0, limit);
      for (const job of ready) {
        await processPaymentReleaseJob(job);
        processed += 1;
      }
      schedulePersistentStateSave("payment-release-worker");
      return processed;
    } finally {
      paymentReleaseWorkerRunning = false;
    }
  }

  async function processAllPaymentWorkerQueues(limit = 20) {
    const webhook = await processPaymentWebhookQueue(limit);
    const reconciliation = await processPaymentReconciliationQueue(limit);
    const settlement = await processPaymentQueue(limit);
    const release = await processPaymentReleaseQueue(limit);
    return { webhook, reconciliation, settlement, release };
  }

  function buildPaymentQueuesDashboard(tenantId?: string) {
    const filterTenant = <T extends { tenant_id: string }>(items: T[]) => tenantId ? items.filter(item => item.tenant_id === tenantId) : items;
    const webhook = filterTenant(payment_webhook_jobs);
    const reconciliation = filterTenant(payment_reconciliation_jobs);
    const settlement = filterTenant(paymentQueue);
    const release = filterTenant(payment_release_jobs);
    const deadLetter = filterTenant(payment_dead_letter_queue);
    const summarize = (items: Array<{ status: string }>) => ({
      total: items.length,
      pending: items.filter(item => item.status === "pending").length,
      processing: items.filter(item => item.status === "processing").length,
      failed: items.filter(item => item.status === "failed").length,
      completed: items.filter(item => item.status === "completed" || item.status === "paid").length,
      dead: items.filter(item => item.status === "dead").length
    });
    return {
      counts: {
        webhook: summarize(webhook),
        reconciliation: summarize(reconciliation),
        settlement: summarize(settlement),
        release: summarize(release),
        deadLetter: { total: deadLetter.length }
      },
      jobs: { webhook, reconciliation, settlement, release, deadLetter },
      logs: {
        paymentLogs: filterTenant(paymentLogs).slice(0, 50),
        webhookLogs: filterTenant(webhookLogs).slice(0, 50),
        gatewayHealth: filterTenant(gatewayHealth)
      }
    };
  }

  app.post("/api/webhooks/asaas", async (req, res) => {
    const gateway = "asaas";
    const payload = (req.body || {}) as Record<string, unknown>;
    const preParsed = new AsaasProvider({ apiKey: "webhook", environment: "sandbox", userAgent: "CIFHER Webhook" }).handleWebhook(payload as Record<string, any>);
    const paymentPayload = payload.payment && typeof payload.payment === "object" && !Array.isArray(payload.payment)
      ? payload.payment as Record<string, unknown>
      : {};
    const asaasPaymentId = String(preParsed.paymentId || paymentPayload.id || "");
    const externalReference = preParsed.externalReference || extractPaymentReference(gateway, payload as Record<string, any>);
    const resolved = resolveAsaasWebhookPayment({ externalReference, paymentId: asaasPaymentId });
    const tenantId = resolved.tenantId || "unknown";
    if (resolved.conflict) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: resolved.orderId || undefined, status: "invalid", message: "Asaas webhook reference/payment tenant mismatch; baixa bloqueada", statusCode: 200, eventStatus: preParsed.eventType || preParsed.status });
      res.status(200).json({ success: false, ignored: true, reason: "tenant_mismatch" });
      return;
    }
    if (!resolved.tenantId) {
      recordPaymentWebhookLog({ tenant_id: "unknown", gateway, purchaseId: resolved.orderId || undefined, status: "invalid", message: "Asaas webhook sem tenant resolvido por externalReference/payment", statusCode: 200, eventStatus: preParsed.eventType || preParsed.status });
      res.status(200).json({ success: false, ignored: true, reason: "tenant_not_resolved" });
      return;
    }
    const asaasConfig = getAsaasGatewayConfig(resolved.tenantId);
    const webhookSecret = asaasConfig?.webhookToken || "";
    const providedSecret = String(req.headers["asaas-access-token"] || "");
    if (webhookSecret) {
      const providedBuffer = Buffer.from(providedSecret);
      const expectedBuffer = Buffer.from(webhookSecret);
      if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
        recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "invalid", message: "Asaas webhook token invalid", statusCode: 401 });
        res.status(401).json({ error: "Asaas webhook token invalid" });
        return;
      }
    } else if (process.env.NODE_ENV === "production") {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "invalid", message: "Webhook token Asaas obrigatorio em producao", statusCode: 401 });
      res.status(401).json({ error: "Webhook token Asaas obrigatorio em producao" });
      return;
    }
    const parsed = new AsaasProvider({ apiKey: "webhook", environment: "sandbox", userAgent: "CIFHER Webhook" }).handleWebhook(payload as Record<string, any>, asaasConfig?.releaseMode || "PAYMENT_RECEIVED");
    const rawStatus = parsed.eventType || parsed.status || extractPaymentStatus(payload as Record<string, any>);
    const purchaseIdToConfirm = resolved.orderId || parseAsaasExternalReference(parsed.externalReference).orderId || extractPaymentReference(gateway, payload as Record<string, any>);
    const eventKey = buildPaymentIdempotencyKey({ tenant_id: tenantId, gateway, purchaseId: purchaseIdToConfirm || undefined, eventStatus: rawStatus, payload });
    const existingEvent = webhookEvents.find(item => item.tenant_id === tenantId && String(item.provider) === "asaas" && item.id === eventKey);
    if (existingEvent?.processed) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: purchaseIdToConfirm || undefined, status: "duplicate", message: "Webhook Asaas duplicado ignorado por event.id", statusCode: 200, eventStatus: rawStatus });
      res.json({ success: true, duplicate: true, eventId: eventKey });
      return;
    }
    webhookEvents.unshift({
      id: eventKey,
      tenant_id: tenantId,
      provider: "asaas" as IntegrationProviderId,
      event_type: String((payload as Record<string, any>).event || rawStatus || "PAYMENT_UPDATED"),
      status: rawStatus,
      external_reference: purchaseIdToConfirm,
      provider_payment_id: asaasPaymentId,
      payload,
      processed: false,
      processed_at: "",
      error_message: "",
      created_at: new Date().toISOString()
    });
    const payment = resolved.payment || payments.find(item =>
      item.tenant_id === tenantId &&
      item.provider === "asaas" &&
      (item.provider_payment_id === asaasPaymentId || item.asaas_payment_id === asaasPaymentId || item.order_id === purchaseIdToConfirm)
    );
    if (parsed.shouldRelease && !payment) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: purchaseIdToConfirm || undefined, status: "invalid", message: "Asaas pago sem payment interno tenant-scoped; baixa bloqueada", statusCode: 200, eventStatus: rawStatus });
      const event = webhookEvents.find(item => item.id === eventKey);
      if (event) {
        event.processed = true;
        event.processed_at = new Date().toISOString();
        event.error_message = "Payment interno nao encontrado para provider_payment_id do tenant";
      }
      res.status(200).json({ success: false, ignored: true, reason: "payment_not_found" });
      return;
    }
    const terminalStatus = ["PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED", "OVERDUE", "DELETED", "REFUNDED"];
    if (terminalStatus.some(status => String(rawStatus || "").toUpperCase().includes(status)) && payment?.status !== "paid") {
      updatePaymentRecordStatus(tenantId, gateway, payment?.order_id || asaasPaymentId, String(rawStatus).toLowerCase(), { webhook: payload });
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id || purchaseIdToConfirm, status: "ignored", message: `Asaas ${rawStatus}`, statusCode: 200, eventStatus: rawStatus });
      const event = webhookEvents.find(item => item.id === eventKey);
      if (event) {
        event.processed = true;
        event.processed_at = new Date().toISOString();
      }
      res.json({ success: true, status: rawStatus });
      return;
    }
    const queueJob = enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id || undefined, eventStatus: rawStatus, payload });
    await processPaymentJob(queueJob);
    const event = webhookEvents.find(item => item.id === queueJob.idempotencyKey);
    if (event) {
      event.processed = queueJob.status === "paid" || queueJob.status === "cancelled";
      event.processed_at = new Date().toISOString();
      event.error_message = queueJob.lastError || "";
    }
    if (queueJob.status === "paid") return res.json({ success: true, duplicate: Boolean(queueJob.duplicateReceipt || queueJob.result?.duplicate), jobId: queueJob.id });
    if (queueJob.status === "cancelled") return res.status(202).json({ success: true, message: "Evento Asaas recebido sem baixa", jobId: queueJob.id });
    res.status(queueJob.lastError === "Purchase not found for tenant" ? 404 : 503).json({ error: queueJob.lastError || "Webhook queued for retry", jobId: queueJob.id });
  });

  app.post("/api/admin/payments/asaas/reconcile", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const reference = String(req.body.paymentId || req.body.payment_id || req.body.orderId || req.body.order_id || "").trim();
    if (!reference) return res.status(400).json({ error: "payment_id/order_id obrigatorio" });
    const payment = payments.find(item => item.tenant_id === tenantId && item.provider === "asaas" && (item.provider_payment_id === reference || item.asaas_payment_id === reference || item.order_id === reference));
    if (!payment) return res.status(404).json({ error: "Pagamento Asaas nao encontrado para este tenant" });
    const asaas = getAsaasProvider(tenantId);
    if (!asaas) return res.status(503).json({ error: "Asaas nao configurado para este tenant" });
    try {
      const remote = await asaas.provider.getPayment(payment.provider_payment_id || payment.asaas_payment_id || reference);
      const status = String(remote.status || "").toUpperCase();
      if (isPaidAsaasEvent(tenantId, status)) {
        const payload = { event: `PAYMENT_${status}`, payment: { ...remote, id: payment.provider_payment_id || payment.asaas_payment_id, externalReference: payment.order_id } };
        const job = enqueuePaymentJob({ tenant_id: tenantId, gateway: "asaas", purchaseId: payment.order_id, eventStatus: status, payload, forceRetry: true });
        await processPaymentJob(job);
        return res.json({ ok: job.status === "paid", status, payment: updatePaymentRecordStatus(tenantId, "asaas", payment.order_id, "paid", { reconcile: remote }), job });
      }
      if (["OVERDUE", "DELETED", "REFUNDED"].includes(status) && payment.status !== "paid") {
        updatePaymentRecordStatus(tenantId, "asaas", payment.order_id, status.toLowerCase(), { reconcile: remote });
      }
      res.json({ ok: true, status, payment, remote });
    } catch (error) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "asaas", purchaseId: payment.order_id, status: "failed", message: error instanceof Error ? error.message : "Falha ao reconciliar Asaas", statusCode: 502, eventStatus: "RECONCILE_FAILED" });
      res.status(502).json({ error: error instanceof Error ? error.message : "Falha ao reconciliar Asaas" });
    }
  });

  app.post("/api/webhooks/mercadopago", async (req, res) => {
    const gateway = "mercadopago";
    const tenant = getRequestTenant(req);
    const tenantId = tenant?.id || "unknown";
    const mercadoPagoConfig = tenant ? getMercadoPagoGatewayConfig(tenant.id) : null;
    const webhookSecret = mercadoPagoConfig?.webhookToken || "";
    const providedSecret = String(req.headers["x-webhook-secret"] || req.headers["mercadopago-access-token"] || req.headers["authorization"] || req.query.secret || "").replace(/^Bearer\s+/i, "");
    if (webhookSecret) {
      const providedBuffer = Buffer.from(providedSecret);
      const expectedBuffer = Buffer.from(webhookSecret);
      if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
        recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "invalid", message: "Mercado Pago webhook token invalid", statusCode: 401 });
        res.status(200).json({ success: false, ignored: true });
        return;
      }
    }
    const payload = (req.body || {}) as Record<string, unknown>;
    const provider = tenant ? getMercadoPagoProvider(tenant.id) : null;
    if (!provider) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "ignored", message: "Mercado Pago nao configurado para este tenant", statusCode: 200 });
      res.status(200).json({ success: true, ignored: true });
      return;
    }
    const parsed = provider.provider.handleWebhook(payload as Record<string, any>);
    if (!parsed.paymentId) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "ignored", message: "Webhook Mercado Pago sem payment id", statusCode: 200, eventStatus: parsed.action });
      res.status(200).json({ success: true, ignored: true });
      return;
    }
    let remote: Record<string, any>;
    try {
      remote = await provider.provider.getPayment(parsed.paymentId);
    } catch (error) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "failed", message: error instanceof Error ? error.message : "Falha ao consultar Mercado Pago", statusCode: 200, eventStatus: parsed.action });
      res.status(200).json({ success: false, queued: true });
      return;
    }
    const status = provider.provider.parsePaymentStatus(remote);
    const eventKey = buildPaymentIdempotencyKey({ tenant_id: tenantId, gateway, purchaseId: parsed.paymentId, eventStatus: status, payload: { ...payload, payment: remote } });
    const existingEvent = webhookEvents.find(item => item.tenant_id === tenantId && String(item.provider) === "mercadopago" && item.id === eventKey);
    if (existingEvent?.processed) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: String(remote.external_reference || ""), status: "duplicate", message: "Webhook Mercado Pago duplicado ignorado por payment/status", statusCode: 200, eventStatus: status });
      res.json({ success: true, duplicate: true, eventId: eventKey });
      return;
    }
    webhookEvents.unshift({
      id: eventKey,
      tenant_id: tenantId,
      provider: "mercadopago" as IntegrationProviderId,
      event_type: parsed.type || "payment",
      status,
      external_reference: String(remote.external_reference || ""),
      provider_payment_id: String(remote.id || parsed.paymentId),
      payload: { webhook: payload, payment: remote },
      processed: false,
      processed_at: "",
      error_message: "",
      created_at: new Date().toISOString()
    });
    const payment = payments.find(item =>
      item.tenant_id === tenantId &&
      item.provider === "mercadopago" &&
      item.provider_payment_id === String(remote.id || parsed.paymentId)
    );
    if (isPaidMercadoPagoEvent(status) && !payment) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: String(remote.external_reference || ""), status: "invalid", message: "Mercado Pago aprovado sem payment interno tenant-scoped; baixa bloqueada", statusCode: 200, eventStatus: status });
      const event = webhookEvents.find(item => item.id === eventKey);
      if (event) {
        event.processed = true;
        event.processed_at = new Date().toISOString();
        event.error_message = "Payment interno nao encontrado para provider_payment_id do tenant";
      }
      res.status(200).json({ success: false, ignored: true, reason: "payment_not_found" });
      return;
    }
    if (["cancelled", "canceled", "rejected", "refunded", "charged_back"].includes(status) && payment?.status !== "paid") {
      updatePaymentRecordStatus(tenantId, gateway, payment?.order_id || String(remote.id || parsed.paymentId), status, { webhook: payload, payment: remote });
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id || String(remote.external_reference || ""), status: "ignored", message: `Mercado Pago ${status}`, statusCode: 200, eventStatus: status });
      const event = webhookEvents.find(item => item.id === eventKey);
      if (event) {
        event.processed = true;
        event.processed_at = new Date().toISOString();
      }
      res.json({ success: true, status });
      return;
    }
    const queueJob = enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id || undefined, eventStatus: status, payload: { ...payload, payment: remote } });
    await processPaymentJob(queueJob);
    const event = webhookEvents.find(item => item.id === eventKey);
    if (event) {
      event.processed = queueJob.status === "paid" || queueJob.status === "cancelled";
      event.processed_at = new Date().toISOString();
      event.error_message = queueJob.lastError || "";
    }
    if (queueJob.status === "paid") return res.json({ success: true, duplicate: Boolean(queueJob.duplicateReceipt || queueJob.result?.duplicate), jobId: queueJob.id });
    if (queueJob.status === "cancelled") return res.json({ success: true, ignored: true, jobId: queueJob.id });
    res.status(200).json({ success: false, queued: true, error: queueJob.lastError || "Webhook queued for retry", jobId: queueJob.id });
  });

  app.post("/api/admin/payments/mercadopago/reconcile", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const reference = String(req.body.provider_payment_id || req.body.paymentId || req.body.payment_id || "").trim();
    if (!reference) return res.status(400).json({ error: "provider_payment_id obrigatorio" });
    const payment = payments.find(item => item.tenant_id === tenantId && item.provider === "mercadopago" && item.provider_payment_id === reference);
    if (!payment) return res.status(404).json({ error: "Pagamento Mercado Pago nao encontrado para este tenant" });
    const mercadoPago = getMercadoPagoProvider(tenantId);
    if (!mercadoPago) return res.status(503).json({ error: "Mercado Pago nao configurado para este tenant" });
    try {
      const remote = await mercadoPago.provider.getPayment(payment.provider_payment_id || reference);
      const status = mercadoPago.provider.parsePaymentStatus(remote);
      if (isPaidMercadoPagoEvent(status)) {
        const payload = { payment: remote };
        const job = enqueuePaymentJob({ tenant_id: tenantId, gateway: "mercadopago", purchaseId: payment.order_id, eventStatus: status, payload, forceRetry: true });
        await processPaymentJob(job);
        return res.json({ ok: job.status === "paid", status, payment: updatePaymentRecordStatus(tenantId, "mercadopago", payment.order_id, "paid", { reconcile: remote }), job });
      }
      if (["cancelled", "canceled", "rejected", "refunded", "charged_back"].includes(status) && payment.status !== "paid") {
        updatePaymentRecordStatus(tenantId, "mercadopago", payment.order_id, status, { reconcile: remote });
      }
      res.json({ ok: true, status, payment, remote });
    } catch (error) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "mercadopago", purchaseId: payment.order_id, status: "failed", message: error instanceof Error ? error.message : "Falha ao reconciliar Mercado Pago", statusCode: 502, eventStatus: "RECONCILE_FAILED" });
      res.status(502).json({ error: error instanceof Error ? error.message : "Falha ao reconciliar Mercado Pago" });
    }
  });

  app.post("/api/webhooks/cora", async (req, res) => {
    const gateway = "cora";
    const tenant = getRequestTenant(req);
    const tenantId = tenant?.id || "unknown";
    const coraConfig = tenant ? getCoraGatewayConfig(tenant.id) : null;
    const webhookSecret = coraConfig?.webhookToken || "";
    const providedSecret = String(req.headers["x-webhook-secret"] || req.headers["cora-access-token"] || req.headers["authorization"] || req.query.secret || "").replace(/^Bearer\s+/i, "");
    if (webhookSecret) {
      const providedBuffer = Buffer.from(providedSecret);
      const expectedBuffer = Buffer.from(webhookSecret);
      if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
        recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "invalid", message: "Cora webhook token invalid", statusCode: 401 });
        res.status(200).json({ success: false, ignored: true });
        return;
      }
    }
    const payload = (req.body || {}) as Record<string, unknown>;
    const provider = tenant ? getCoraProvider(tenant.id) : null;
    if (!provider) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "ignored", message: "Cora nao configurado para este tenant", statusCode: 200 });
      res.status(200).json({ success: true, ignored: true });
      return;
    }
    const parsed = provider.provider.handleWebhook(payload as Record<string, any>);
    if (!parsed.providerPaymentId && !parsed.txid) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "ignored", message: "Webhook Cora sem invoice id/txid", statusCode: 200, eventStatus: parsed.status });
      res.status(200).json({ success: true, ignored: true });
      return;
    }
    let remote: Record<string, any> | null = null;
    try {
      remote = parsed.providerPaymentId ? await provider.provider.getPayment(parsed.providerPaymentId) : null;
    } catch {
      remote = null;
    }
    const effective = remote || payload;
    const status = remote ? provider.provider.parsePaymentStatus(remote) : parsed.status;
    const eventKey = buildPaymentIdempotencyKey({ tenant_id: tenantId, gateway, purchaseId: parsed.providerPaymentId || parsed.txid || undefined, eventStatus: status, payload: { ...payload, invoice: effective, end_to_end: parsed.endToEnd } });
    const existingEvent = webhookEvents.find(item => item.tenant_id === tenantId && String(item.provider) === "cora" && item.id === eventKey);
    if (existingEvent?.processed) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: parsed.externalReference, status: "duplicate", message: "Webhook Cora duplicado ignorado por payment/status/txid/end_to_end", statusCode: 200, eventStatus: status });
      res.json({ success: true, duplicate: true, eventId: eventKey });
      return;
    }
    webhookEvents.unshift({
      id: eventKey,
      tenant_id: tenantId,
      provider: "cora" as IntegrationProviderId,
      event_type: String((payload as Record<string, any>).event_type || "invoice.updated"),
      status,
      external_reference: parsed.externalReference,
      provider_payment_id: parsed.providerPaymentId,
      reference_id: parsed.txid,
      end_to_end: parsed.endToEnd,
      payload: { webhook: payload, invoice: effective },
      processed: false,
      processed_at: "",
      error_message: "",
      created_at: new Date().toISOString()
    });
    const payment = payments.find(item =>
      item.tenant_id === tenantId &&
      item.provider === "cora" &&
      (item.provider_payment_id === parsed.providerPaymentId || item.txid === parsed.txid)
    );
    if (isPaidCoraEvent(status) && !payment) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: parsed.externalReference, status: "invalid", message: "Cora pago sem payment interno tenant-scoped; baixa bloqueada", statusCode: 200, eventStatus: status });
      const event = webhookEvents.find(item => item.id === eventKey);
      if (event) {
        event.processed = true;
        event.processed_at = new Date().toISOString();
        event.error_message = "Payment interno nao encontrado para provider_payment_id/txid do tenant";
      }
      res.status(200).json({ success: false, ignored: true, reason: "payment_not_found" });
      return;
    }
    if (["expired", "cancelled", "canceled", "voided"].includes(String(status || "").toLowerCase()) && payment?.status !== "paid") {
      updatePaymentRecordStatus(tenantId, gateway, payment?.order_id || parsed.providerPaymentId || parsed.txid, status, { webhook: payload, invoice: effective });
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id || parsed.externalReference, status: "ignored", message: `Cora ${status}`, statusCode: 200, eventStatus: status });
      const event = webhookEvents.find(item => item.id === eventKey);
      if (event) {
        event.processed = true;
        event.processed_at = new Date().toISOString();
      }
      res.json({ success: true, status });
      return;
    }
    const queueJob = enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id || undefined, eventStatus: status, payload: { ...payload, invoice: effective } });
    await processPaymentJob(queueJob);
    const event = webhookEvents.find(item => item.id === eventKey);
    if (event) {
      event.processed = queueJob.status === "paid" || queueJob.status === "cancelled";
      event.processed_at = new Date().toISOString();
      event.error_message = queueJob.lastError || "";
    }
    if (queueJob.status === "paid") return res.json({ success: true, duplicate: Boolean(queueJob.duplicateReceipt || queueJob.result?.duplicate), jobId: queueJob.id });
    if (queueJob.status === "cancelled") return res.json({ success: true, ignored: true, jobId: queueJob.id });
    res.status(200).json({ success: false, queued: true, error: queueJob.lastError || "Webhook queued for retry", jobId: queueJob.id });
  });

  app.post("/api/admin/payments/cora/reconcile", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const reference = String(req.body.provider_payment_id || req.body.paymentId || req.body.txid || "").trim();
    if (!reference) return res.status(400).json({ error: "provider_payment_id/txid obrigatorio" });
    const payment = payments.find(item => item.tenant_id === tenantId && item.provider === "cora" && (item.provider_payment_id === reference || item.txid === reference || item.provider_reference === reference));
    if (!payment) return res.status(404).json({ error: "Pagamento Cora nao encontrado para este tenant" });
    const cora = getCoraProvider(tenantId);
    if (!cora) return res.status(503).json({ error: "Cora nao configurado para este tenant" });
    try {
      const remote = await cora.provider.getPayment(payment.provider_payment_id || reference);
      const status = cora.provider.parsePaymentStatus(remote);
      if (isPaidCoraEvent(status)) {
        const payload = { invoice: remote };
        const job = enqueuePaymentJob({ tenant_id: tenantId, gateway: "cora", purchaseId: payment.order_id, eventStatus: status, payload, forceRetry: true });
        await processPaymentJob(job);
        return res.json({ ok: job.status === "paid", status, payment: updatePaymentRecordStatus(tenantId, "cora", payment.order_id, "paid", { reconcile: remote }), job });
      }
      if (["expired", "cancelled", "canceled", "voided"].includes(status) && payment.status !== "paid") {
        updatePaymentRecordStatus(tenantId, "cora", payment.order_id, status, { reconcile: remote });
      }
      res.json({ ok: true, status, payment, remote });
    } catch (error) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "cora", purchaseId: payment.order_id, status: "failed", message: error instanceof Error ? error.message : "Falha ao reconciliar Cora", statusCode: 502, eventStatus: "RECONCILE_FAILED" });
      res.status(502).json({ error: error instanceof Error ? error.message : "Falha ao reconciliar Cora" });
    }
  });

  app.post("/api/webhooks/primepag", async (req, res) => {
    const gateway = "primepag";
    const tenant = getRequestTenant(req);
    const tenantId = tenant?.id || "unknown";
    const primepagConfig = tenant ? getPrimepagGatewayConfig(tenant.id) : null;
    const webhookSecret = primepagConfig?.webhookToken || "";
    const providedSecret = String(req.headers["authorization"] || req.headers["x-webhook-secret"] || req.headers["primepag-authorization"] || req.query.secret || "").replace(/^Bearer\s+/i, "");
    if (webhookSecret) {
      const providedBuffer = Buffer.from(providedSecret);
      const expectedBuffer = Buffer.from(webhookSecret);
      if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
        recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "invalid", message: "PrimePag webhook authorization invalid", statusCode: 401 });
        res.status(200).json({ success: false, ignored: true });
        return;
      }
    }
    const payload = (req.body || {}) as Record<string, unknown>;
    const provider = tenant ? getPrimepagProvider(tenant.id) : null;
    if (!provider) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "ignored", message: "PrimePag nao configurado para este tenant", statusCode: 200 });
      res.status(200).json({ success: true, ignored: true });
      return;
    }
    const parsed = provider.provider.handleWebhook(payload as Record<string, any>);
    if (!parsed.referenceCode) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "ignored", message: "Webhook PrimePag sem reference_code", statusCode: 200, eventStatus: parsed.status });
      res.status(200).json({ success: true, ignored: true });
      return;
    }
    let remote: Record<string, any> | null = null;
    try {
      remote = await provider.provider.getPayment(parsed.referenceCode);
    } catch {
      remote = null;
    }
    const effective = remote || payload;
    const status = remote ? provider.provider.parseQrCodeStatus(remote) || parsed.status : parsed.status;
    const eventKey = buildPaymentIdempotencyKey({ tenant_id: tenantId, gateway, purchaseId: parsed.referenceCode, eventStatus: status, payload: { ...payload, message: { reference_code: parsed.referenceCode, status, end_to_end: parsed.endToEnd } } });
    const existingEvent = webhookEvents.find(item => item.tenant_id === tenantId && String(item.provider) === "primepag" && item.id === eventKey);
    if (existingEvent?.processed) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: parsed.referenceCode, status: "duplicate", message: "Webhook PrimePag duplicado ignorado por reference_code/status/end_to_end", statusCode: 200, eventStatus: status });
      res.json({ success: true, duplicate: true, eventId: eventKey });
      return;
    }
    webhookEvents.unshift({
      id: eventKey,
      tenant_id: tenantId,
      provider: "primepag" as IntegrationProviderId,
      event_type: parsed.notificationType || "pix_qrcode",
      status,
      external_reference: parsed.externalReference,
      provider_payment_id: parsed.referenceCode,
      reference_id: parsed.referenceCode,
      end_to_end: parsed.endToEnd,
      payload: { webhook: payload, qrcode: effective },
      processed: false,
      processed_at: "",
      error_message: "",
      created_at: new Date().toISOString()
    });
    const payment = payments.find(item =>
      item.tenant_id === tenantId &&
      item.provider === "primepag" &&
      item.provider_payment_id === parsed.referenceCode
    );
    if (isPaidPrimepagEvent(status) && !payment) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: parsed.externalReference, status: "invalid", message: "PrimePag pago sem payment interno tenant-scoped; baixa bloqueada", statusCode: 200, eventStatus: status });
      const event = webhookEvents.find(item => item.id === eventKey);
      if (event) {
        event.processed = true;
        event.processed_at = new Date().toISOString();
        event.error_message = "Payment interno nao encontrado para reference_code do tenant";
      }
      res.status(200).json({ success: false, ignored: true, reason: "payment_not_found" });
      return;
    }
    if (["expired", "expirado", "cancelled", "canceled", "cancelado"].includes(String(status || "").toLowerCase()) && payment?.status !== "paid") {
      updatePaymentRecordStatus(tenantId, gateway, payment?.order_id || parsed.referenceCode, status, { webhook: payload, qrcode: effective });
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id || parsed.externalReference, status: "ignored", message: `PrimePag ${status}`, statusCode: 200, eventStatus: status });
      const event = webhookEvents.find(item => item.id === eventKey);
      if (event) {
        event.processed = true;
        event.processed_at = new Date().toISOString();
      }
      res.json({ success: true, status });
      return;
    }
    const job = isPaidPrimepagEvent(status) && payment
      ? enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment.order_id, eventStatus: status, payload: { ...payload, message: { reference_code: parsed.referenceCode, status, end_to_end: parsed.endToEnd } } })
      : null;
    const event = webhookEvents.find(item => item.id === eventKey);
    if (event) {
      event.processed = true;
      event.processed_at = new Date().toISOString();
    }
    recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id || parsed.externalReference, status: job?.status === "paid" ? "confirmed" : "received", message: `PrimePag ${status || "webhook"}`, statusCode: 200, eventStatus: status });
    res.json({ success: true, eventId: eventKey, queued: Boolean(job), status: job?.status || status });
  });

  app.post("/api/admin/payments/primepag/reconcile", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const referenceCode = String(req.body.reference_code || req.body.referenceCode || req.body.provider_payment_id || "").trim();
    if (!referenceCode) return res.status(400).json({ error: "reference_code obrigatorio" });
    const payment = payments.find(item => item.tenant_id === tenantId && item.provider === "primepag" && item.provider_payment_id === referenceCode);
    if (!payment) return res.status(404).json({ error: "Pagamento PrimePag nao encontrado para este tenant" });
    const primepag = getPrimepagProvider(tenantId);
    if (!primepag) return res.status(503).json({ error: "PrimePag nao configurado para este tenant" });
    try {
      const remote = await primepag.provider.getPayment(referenceCode);
      const status = primepag.provider.parseQrCodeStatus(remote);
      if (isPaidPrimepagEvent(status)) {
        const payload = { message: { ...remote, reference_code: referenceCode, status } };
        const job = enqueuePaymentJob({ tenant_id: tenantId, gateway: "primepag", purchaseId: payment.order_id, eventStatus: status, payload, forceRetry: true });
        recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "primepag", purchaseId: payment.order_id, status: job.status === "paid" ? "confirmed" : "received", message: "Reconciliacao PrimePag executada", statusCode: 200, eventStatus: status });
        return res.json({ ok: job.status === "paid", status, payment: updatePaymentRecordStatus(tenantId, "primepag", payment.order_id, "paid", { reconcile: remote }), job });
      }
      if (status) {
        updatePaymentRecordStatus(tenantId, "primepag", payment.order_id, status, { reconcile: remote });
      }
      return res.json({ ok: false, status: status || "unknown", payment });
    } catch (error) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "primepag", purchaseId: payment.order_id, status: "failed", message: error instanceof Error ? error.message : "Falha ao reconciliar PrimePag", statusCode: 502, eventStatus: "RECONCILE_FAILED" });
      return res.status(502).json({ error: error instanceof Error ? error.message : "Falha ao reconciliar PrimePag" });
    }
  });

  app.post("/api/webhooks/pay2m", async (req, res) => {
    const gateway = "pay2m";
    const tenant = getRequestTenant(req);
    const tenantId = tenant?.id || "unknown";
    const pay2mConfig = tenant ? getPay2mGatewayConfig(tenant.id) : null;
    const webhookSecret = pay2mConfig?.webhookToken || "";
    const providedSecret = String(req.headers["x-webhook-secret"] || req.headers["pay2m-access-token"] || req.headers["authorization"] || req.query.secret || "").replace(/^Bearer\s+/i, "");
    if (webhookSecret) {
      const providedBuffer = Buffer.from(providedSecret);
      const expectedBuffer = Buffer.from(webhookSecret);
      if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
        recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "invalid", message: "Pay2M webhook token invalid", statusCode: 401 });
        res.status(200).json({ success: false, ignored: true });
        return;
      }
    }
    const payload = (req.body || {}) as Record<string, unknown>;
    const parsed = new Pay2mProvider({ clientId: "webhook", clientSecret: "webhook", environment: "production" }).handleWebhook(payload as Record<string, any>);
    if (parsed.notificationType !== "PIX:QRCODE") {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "ignored", message: "Pay2M notification_type invalido", statusCode: 200, eventStatus: parsed.notificationType });
      res.status(200).json({ success: true, ignored: true });
      return;
    }
    const eventKey = buildPaymentIdempotencyKey({ tenant_id: tenantId, gateway, purchaseId: parsed.externalReference || undefined, eventStatus: parsed.status, payload });
    const existingEvent = webhookEvents.find(item => item.tenant_id === tenantId && String(item.provider) === "pay2m" && item.id === eventKey);
    if (existingEvent?.processed) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: parsed.externalReference, status: "duplicate", message: "Webhook Pay2M duplicado ignorado por reference/status/end_to_end", statusCode: 200, eventStatus: parsed.status });
      res.json({ success: true, duplicate: true, eventId: eventKey });
      return;
    }
    webhookEvents.unshift({
      id: eventKey,
      tenant_id: tenantId,
      provider: "pay2m" as IntegrationProviderId,
      event_type: parsed.notificationType,
      status: parsed.status,
      external_reference: parsed.externalReference,
      reference_code: parsed.referenceCode,
      end_to_end: parsed.endToEnd,
      payload,
      processed: false,
      processed_at: "",
      error_message: "",
      created_at: new Date().toISOString()
    });
    const payment = payments.find(item =>
      item.tenant_id === tenantId &&
      item.provider === "pay2m" &&
      (item.provider_payment_id === parsed.referenceCode || item.provider_reference === parsed.referenceCode)
    );
    if (isPaidPay2mEvent(parsed.status) && !payment) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: parsed.externalReference, status: "invalid", message: "Pay2M pago sem payment interno tenant-scoped; baixa bloqueada", statusCode: 200, eventStatus: parsed.status });
      const event = webhookEvents.find(item => item.id === eventKey);
      if (event) {
        event.processed = true;
        event.processed_at = new Date().toISOString();
        event.error_message = "Payment interno nao encontrado para reference_code do tenant";
      }
      res.status(200).json({ success: false, ignored: true, reason: "payment_not_found" });
      return;
    }
    if (["expired", "canceled"].includes(parsed.status) && payment?.status !== "paid") {
      updatePaymentRecordStatus(tenantId, gateway, payment.order_id, parsed.status, { webhook: payload });
      const purchase = purchases.find(item => item.tenant_id === tenantId && item.purchaseId === payment.order_id);
      const modePurchase = numberModePurchases.find(item => item.tenant_id === tenantId && item.id === payment.order_id);
      const farmPurchase = fazendinhaCompras.find(item => item.tenant_id === tenantId && item.id === payment.order_id);
      if (purchase?.status === "pending") {
        const raffle = raffles.find(item => item.tenant_id === tenantId && item.id === purchase.raffleId);
        if (raffle && purchase.numeros.length) releaseReservedNumbers(raffle, purchase.numeros);
        purchase.status = "cancelled";
      }
      if (modePurchase?.status === "reserved") modePurchase.status = "cancelled";
      if (farmPurchase?.statusPagamento === "reserved") farmPurchase.statusPagamento = "cancelled";
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: payment.order_id, status: "ignored", message: `Pay2M ${parsed.status}`, statusCode: 200, eventStatus: parsed.status });
      const event = webhookEvents.find(item => item.id === eventKey);
      if (event) {
        event.processed = true;
        event.processed_at = new Date().toISOString();
      }
      res.json({ success: true, status: parsed.status });
      return;
    }
    const queueJob = payment
      ? enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment.order_id, eventStatus: parsed.status, payload })
      : null;
    if (!queueJob) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: parsed.externalReference, status: "ignored", message: "Pay2M webhook sem payment tenant-scoped", statusCode: 200, eventStatus: parsed.status });
      res.status(200).json({ success: true, ignored: true });
      return;
    }
    await processPaymentJob(queueJob);
    const event = webhookEvents.find(item => item.id === eventKey);
    if (event) {
      event.processed = queueJob.status === "paid" || queueJob.status === "cancelled";
      event.processed_at = new Date().toISOString();
      event.error_message = queueJob.lastError || "";
    }
    if (queueJob.status === "paid") return res.json({ success: true, duplicate: Boolean(queueJob.duplicateReceipt || queueJob.result?.duplicate), jobId: queueJob.id });
    if (queueJob.status === "cancelled") return res.json({ success: true, ignored: true, jobId: queueJob.id });
    res.status(200).json({ success: false, queued: true, error: queueJob.lastError || "Webhook queued for retry", jobId: queueJob.id });
  });

  app.post("/api/admin/payments/pay2m/reconcile", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const referenceCode = String(req.body.referenceCode || req.body.reference_code || "").trim();
    const payment = payments.find(item => item.tenant_id === tenantId && item.provider === "pay2m" && (item.provider_payment_id === referenceCode || item.provider_reference === referenceCode));
    if (!referenceCode) return res.status(400).json({ error: "reference_code obrigatorio" });
    const pay2m = getPay2mProvider(tenantId);
    if (!pay2m) return res.status(503).json({ error: "Pay2M nao configurado para este tenant" });
    try {
      const remote = await pay2m.provider.getPayment(referenceCode);
      const status = String(remote.status || "").toLowerCase();
      const orderId = String(payment?.order_id || "");
      if (status === "paid" && orderId) {
        const payload = { notification_type: "PIX:QRCODE", message: { ...remote, reference_code: referenceCode, external_reference: orderId } };
        const job = enqueuePaymentJob({ tenant_id: tenantId, gateway: "pay2m", purchaseId: orderId, eventStatus: status, payload, forceRetry: true });
        await processPaymentJob(job);
        return res.json({ ok: job.status === "paid", status, payment: updatePaymentRecordStatus(tenantId, "pay2m", orderId, "paid", { reconcile: remote }), job });
      }
      if (payment && ["expired", "canceled"].includes(status) && payment.status !== "paid") {
        updatePaymentRecordStatus(tenantId, "pay2m", payment.order_id, status, { reconcile: remote });
      }
      res.json({ ok: true, status, payment, remote });
    } catch (error) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "pay2m", purchaseId: payment?.order_id, status: "failed", message: error instanceof Error ? error.message : "Falha ao reconciliar Pay2M", statusCode: 502, eventStatus: "RECONCILE_FAILED" });
      res.status(502).json({ error: error instanceof Error ? error.message : "Falha ao reconciliar Pay2M" });
    }
  });

  app.post("/api/webhooks/pagbank", async (req, res) => {
    const gateway = "pagbank";
    const tenant = getRequestTenant(req);
    const tenantId = tenant?.id || "unknown";
    const pagbankConfig = tenant ? getPagbankGatewayConfig(tenant.id) : null;
    const webhookSecret = pagbankConfig?.webhookToken || "";
    const providedSecret = String(req.headers["x-webhook-secret"] || req.headers["pagbank-access-token"] || req.headers["authorization"] || req.query.secret || "").replace(/^Bearer\s+/i, "");
    if (webhookSecret) {
      const providedBuffer = Buffer.from(providedSecret);
      const expectedBuffer = Buffer.from(webhookSecret);
      if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
        recordPaymentWebhookLog({ tenant_id: tenantId, gateway, status: "invalid", message: "PagBank webhook token invalid", statusCode: 401 });
        res.status(200).json({ success: false, ignored: true });
        return;
      }
    }
    const payload = (req.body || {}) as Record<string, unknown>;
    const parsed = new PagbankProvider({ token: "webhook", environment: "sandbox" }).handleWebhook(payload as Record<string, any>);
    const eventKey = buildPaymentIdempotencyKey({ tenant_id: tenantId, gateway, purchaseId: parsed.referenceId || undefined, eventStatus: parsed.status, payload });
    const existingEvent = webhookEvents.find(item => item.tenant_id === tenantId && String(item.provider) === "pagbank" && item.id === eventKey);
    if (existingEvent?.processed) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: parsed.referenceId, status: "duplicate", message: "Webhook PagBank duplicado ignorado por tenant/order/reference/status", statusCode: 200, eventStatus: parsed.status });
      res.json({ success: true, duplicate: true, eventId: eventKey });
      return;
    }
    webhookEvents.unshift({
      id: eventKey,
      tenant_id: tenantId,
      provider: "pagbank" as IntegrationProviderId,
      event_type: String(payload.event || payload.event_type || "ORDER_UPDATED"),
      status: parsed.status,
      external_reference: parsed.referenceId,
      reference_id: parsed.referenceId,
      provider_payment_id: parsed.orderId,
      end_to_end: parsed.endToEnd,
      payload,
      processed: false,
      processed_at: "",
      error_message: "",
      created_at: new Date().toISOString()
    });
    const payment = payments.find(item =>
      item.tenant_id === tenantId &&
      item.provider === "pagbank" &&
      (item.provider_payment_id === parsed.orderId || item.provider_reference === parsed.referenceId || item.order_id === parsed.referenceId)
    );
    if (parsed.shouldRelease && !payment) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: parsed.referenceId, status: "invalid", message: "PagBank pago sem payment interno tenant-scoped; baixa bloqueada", statusCode: 200, eventStatus: parsed.status });
      const event = webhookEvents.find(item => item.id === eventKey);
      if (event) {
        event.processed = true;
        event.processed_at = new Date().toISOString();
        event.error_message = "Payment interno nao encontrado para provider_payment_id/reference_id do tenant";
      }
      res.status(200).json({ success: false, ignored: true, reason: "payment_not_found" });
      return;
    }
    const terminalStatus = ["EXPIRED", "CANCELED", "CANCELLED", "DECLINED"];
    if (terminalStatus.includes(parsed.status) && payment?.status !== "paid") {
      updatePaymentRecordStatus(tenantId, gateway, payment.order_id, parsed.status.toLowerCase(), { webhook: payload });
      const purchase = purchases.find(item => item.tenant_id === tenantId && item.purchaseId === payment.order_id);
      const modePurchase = numberModePurchases.find(item => item.tenant_id === tenantId && item.id === payment.order_id);
      const farmPurchase = fazendinhaCompras.find(item => item.tenant_id === tenantId && item.id === payment.order_id);
      if (purchase?.status === "pending") {
        const raffle = raffles.find(item => item.tenant_id === tenantId && item.id === purchase.raffleId);
        if (raffle && purchase.numeros.length) releaseReservedNumbers(raffle, purchase.numeros);
        purchase.status = "cancelled";
      }
      if (modePurchase?.status === "reserved") modePurchase.status = "cancelled";
      if (farmPurchase?.statusPagamento === "reserved") farmPurchase.statusPagamento = "cancelled";
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway, purchaseId: payment.order_id, status: "ignored", message: `PagBank ${parsed.status}`, statusCode: 200, eventStatus: parsed.status });
      const event = webhookEvents.find(item => item.id === eventKey);
      if (event) {
        event.processed = true;
        event.processed_at = new Date().toISOString();
      }
      res.json({ success: true, status: parsed.status });
      return;
    }
    const queueJob = enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id || undefined, eventStatus: parsed.status, payload });
    await processPaymentJob(queueJob);
    const event = webhookEvents.find(item => item.id === eventKey);
    if (event) {
      event.processed = queueJob.status === "paid" || queueJob.status === "cancelled";
      event.processed_at = new Date().toISOString();
      event.error_message = queueJob.lastError || "";
    }
    if (queueJob.status === "paid") return res.json({ success: true, duplicate: Boolean(queueJob.duplicateReceipt || queueJob.result?.duplicate), jobId: queueJob.id });
    if (queueJob.status === "cancelled") return res.json({ success: true, ignored: true, jobId: queueJob.id });
    res.status(200).json({ success: false, queued: true, error: queueJob.lastError || "Webhook queued for retry", jobId: queueJob.id });
  });

  app.post("/api/admin/payments/pagbank/reconcile", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const reference = String(req.body.orderId || req.body.order_id || req.body.referenceId || req.body.reference_id || "").trim();
    if (!reference) return res.status(400).json({ error: "order_id/reference_id obrigatorio" });
    const payment = payments.find(item => item.tenant_id === tenantId && item.provider === "pagbank" && (item.provider_payment_id === reference || item.provider_reference === reference || item.order_id === reference));
    if (!payment) return res.status(404).json({ error: "Pagamento PagBank nao encontrado para este tenant" });
    const pagbank = getPagbankProvider(tenantId);
    if (!pagbank) return res.status(503).json({ error: "PagBank nao configurado para este tenant" });
    try {
      const remote = await pagbank.provider.getPayment(payment?.provider_payment_id || reference);
      const status = pagbank.provider.parseOrderStatus(remote as Record<string, any>);
      const orderId = String(remote.reference_id || payment?.order_id || "");
      if (isPaidPagbankEvent(status) && orderId) {
        const payload = { order: remote };
        const job = enqueuePaymentJob({ tenant_id: tenantId, gateway: "pagbank", purchaseId: orderId, eventStatus: status, payload, forceRetry: true });
        await processPaymentJob(job);
        return res.json({ ok: job.status === "paid", status, payment: updatePaymentRecordStatus(tenantId, "pagbank", orderId, "paid", { reconcile: remote }), job });
      }
      if (payment && ["EXPIRED", "CANCELED", "CANCELLED", "DECLINED"].includes(status) && payment.status !== "paid") {
        updatePaymentRecordStatus(tenantId, "pagbank", payment.order_id, status.toLowerCase(), { reconcile: remote });
      }
      res.json({ ok: true, status, payment, remote });
    } catch (error) {
      recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "pagbank", purchaseId: payment?.order_id, status: "failed", message: error instanceof Error ? error.message : "Falha ao reconciliar PagBank", statusCode: 502, eventStatus: "RECONCILE_FAILED" });
      res.status(502).json({ error: error instanceof Error ? error.message : "Falha ao reconciliar PagBank" });
    }
  });

  // Universal Webhook for Payment Gateways (MercadoPago, Asaas, PagBank, etc)
  app.post("/api/webhooks/payment/:gateway", async (req, res) => {
    const gateway = normalizePaymentProvider(req.params.gateway);
    const tenant = getRequestTenant(req);
    const tenantId = tenant?.id || "unknown";
    const tenantPixGateways = tenant ? getTenantGateways(tenant.id) : gateways;
    const gatewayConfig = (tenantPixGateways[gateway] || {}) as Record<string, string>;
    const asaasConfig = gateway === "asaas" && tenant ? getAsaasGatewayConfig(tenant.id) : null;
    const webhookSecret = gateway === "asaas" ? (asaasConfig?.webhookToken || tenantPixGateways.pix?.webhookSecret || gatewayConfig.webhookSecret || "") : (tenantPixGateways.pix?.webhookSecret || gatewayConfig.webhookSecret || "");
    const providedSecret = String(req.headers["asaas-access-token"] || req.headers["x-webhook-secret"] || req.headers["x-signature"] || req.query.secret || "");
    if (webhookSecret) {
      const providedBuffer = Buffer.from(providedSecret);
      const expectedBuffer = Buffer.from(webhookSecret);
      if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
        recordPaymentWebhookLog({
          tenant_id: tenantId,
          gateway,
          status: "invalid",
          message: "Webhook signature invalid",
          statusCode: 401
        });
        res.status(401).json({ error: "Webhook signature invalid" });
        return;
      }
    } else if (process.env.NODE_ENV === "production") {
      recordPaymentWebhookLog({
        tenant_id: tenantId,
        gateway,
        status: "invalid",
        message: "Webhook secret is required in production",
        statusCode: 401
      });
      res.status(401).json({ error: "Webhook secret is required in production" });
      return;
    }

    const payload = (req.body || {}) as Record<string, unknown>;
    const rawStatus = extractPaymentStatus(payload as Record<string, any>);
    const purchaseIdToConfirm = extractPaymentReference(gateway, payload as Record<string, any>);
    const queueJob = enqueuePaymentJob({
      tenant_id: tenantId,
      gateway,
      purchaseId: purchaseIdToConfirm || undefined,
      eventStatus: rawStatus,
      payload
    });
    await processPaymentJob(queueJob);

    if (queueJob.status === "paid") {
      if (queueJob.duplicateReceipt || queueJob.result?.duplicate) {
        recordPaymentWebhookLog({
          tenant_id: tenantId,
          gateway,
          purchaseId: queueJob.purchaseId,
          status: "duplicate",
          message: "Webhook ignored because payment is already paid",
          statusCode: 200,
          eventStatus: rawStatus
        });
        res.json({ success: true, message: "Ignored or already paid", duplicate: true, jobId: queueJob.id });
        return;
      }
      res.json({
        success: true,
        message: "Pagamento liquidado e hashes gerados.",
        earnedLootboxes: queueJob.result?.earnedLootboxes,
        jobId: queueJob.id
      });
      return;
    }

    if (queueJob.status === "cancelled") {
      res.status(202).json({ success: true, message: "Webhook ignored because payment is not confirmed", jobId: queueJob.id });
      return;
    }

    if (queueJob.lastError === "No reference provided") {
      res.status(400).json({ error: "No reference provided", jobId: queueJob.id });
      return;
    }

    if (queueJob.lastError === "Purchase not found for tenant") {
      res.status(404).json({ error: "Purchase not found for tenant", jobId: queueJob.id });
      return;
    }

    if (queueJob.lastError === "Falha na alocacao") {
      res.status(409).json({ error: "Falha na alocação, reembolso emitido.", jobId: queueJob.id });
      return;
    }

    res.status(503).json({ error: queueJob.lastError || "Webhook queued for retry", retry: true, jobId: queueJob.id });
  });

  // Mock Webhook for PIX Payment Confirmation
  app.post("/api/purchases/:purchaseId/confirm", requireTenantAdmin, (req, res) => {
    const { purchaseId } = req.params;
    const purchase = purchases.find(p => p.purchaseId === purchaseId && adminCanAccessTenant(req, p.tenant_id));
    
    if (!purchase) {
        res.status(404).json({ error: "Purchase not found" });
        return;
    }

    try {
      const reason = String(req.body?.reason || "").trim();
      manuallyConfirmPurchasePayment(purchase, req, reason);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na alocação, tente novamente ou solicite reembolso";
      res.status(message.includes("obrigatorio") ? 400 : 409).json({ error: message });
      return;
    }
    
    // Attach to purchase object so frontend polling / confirmation receives it
    const finalPurchase = { ...purchase, earnedLootboxes: purchase.earnedLootboxes };

    res.json(stripSensitiveCustomerFields(finalPurchase));
  });

  app.get("/api/checkout/orders/:orderId/status", (req, res) => {
    const orderId = String(req.params.orderId || "");
    const tenantId = resolveRequestTenantId(req);
    expireAllReservations(tenantId);
    const purchase = purchases.find(item => item.tenant_id === tenantId && item.purchaseId === orderId);
    if (purchase) {
      const expired = (purchase.status === "pending" && isPastReservationExpiry(purchase.reservedUntil || purchase.pixExpiresAt)) || (purchase.status === "cancelled" && /expirada/i.test(String(purchase.rejectedReason || "")));
      const status = expired ? "expired" : purchase.status;
      res.json(stripSensitiveCustomerFields({
        orderId,
        type: "raffle",
        status,
        paymentStatus: status,
        paid: purchase.status === "paid",
        expired,
        pixPayload: purchase.status === "pending" && !expired ? purchase.pixPayload : "",
        pixExpiresAt: purchase.pixExpiresAt || purchase.reservedUntil,
        reservedUntil: purchase.reservedUntil,
        purchase,
        ticketUrl: purchase.status === "paid" ? buildPublicTicketUrl(purchase) : "",
        message: purchase.status === "paid" ? "Pagamento confirmado" : expired ? "PIX expirado" : purchase.status === "cancelled" ? "Pedido cancelado" : "Aguardando pagamento"
      }));
      return;
    }
    const modePurchase = numberModePurchases.find(item => item.tenant_id === tenantId && item.id === orderId);
    if (modePurchase) {
      const expired = modePurchase.status === "cancelled" || (modePurchase.status === "reserved" && isPastReservationExpiry(modePurchase.reservedUntil || modePurchase.pixExpiresAt));
      const status = expired ? "expired" : modePurchase.status;
      res.json(stripSensitiveCustomerFields({
        orderId,
        type: "modalidade",
        status,
        paymentStatus: modePurchase.status === "paid" ? "paid" : expired ? "expired" : "pending",
        paid: modePurchase.status === "paid",
        expired,
        pixPayload: modePurchase.status === "reserved" && !expired ? ((modePurchase as NumberModePurchase & { pixPayload?: string }).pixPayload || buildPixPayload(modePurchase.amount, undefined, modePurchase.id, tenantId)) : "",
        pixExpiresAt: modePurchase.pixExpiresAt || modePurchase.reservedUntil,
        reservedUntil: modePurchase.reservedUntil,
        purchase: modePurchase,
        message: modePurchase.status === "paid" ? "Pagamento confirmado" : expired ? "PIX expirado" : "Aguardando pagamento"
      }));
      return;
    }
    const farmPurchase = fazendinhaCompras.find(item => item.tenant_id === tenantId && item.id === orderId);
    if (farmPurchase) {
      const expired = farmPurchase.statusPagamento === "cancelled" || (farmPurchase.statusPagamento === "reserved" && isPastReservationExpiry(farmPurchase.reservedUntil || farmPurchase.pixExpiresAt));
      const status = farmPurchase.statusPagamento === "paid" ? "paid" : expired ? "expired" : "reserved";
      res.json(stripSensitiveCustomerFields({
        orderId,
        type: "fazendinha",
        status,
        paymentStatus: farmPurchase.statusPagamento === "paid" ? "paid" : expired ? "expired" : "pending",
        paid: farmPurchase.statusPagamento === "paid",
        expired,
        pixPayload: farmPurchase.statusPagamento === "reserved" && !expired ? ((farmPurchase as FazendinhaPurchase & { pixPayload?: string }).pixPayload || buildPixPayload(farmPurchase.valorPago, undefined, farmPurchase.id, tenantId)) : "",
        pixExpiresAt: farmPurchase.pixExpiresAt || farmPurchase.reservedUntil,
        reservedUntil: farmPurchase.reservedUntil,
        purchase: farmPurchase,
        message: farmPurchase.statusPagamento === "paid" ? "Pagamento confirmado" : expired ? "PIX expirado" : "Aguardando pagamento"
      }));
      return;
    }
    res.status(404).json({ error: "Pedido nao encontrado" });
  });

  app.get("/api/purchases/:purchaseId", (req, res) => {
    const { purchaseId } = req.params;
    const purchase = purchases.find(p => p.tenant_id === resolveRequestTenantId(req) && p.purchaseId === purchaseId);
    if (!purchase) {
        res.status(404).json({ error: "Purchase not found" });
        return;
    }
    res.json(stripSensitiveCustomerFields(purchase));
  });

  // Admin insights & CRUD
  app.get("/api/admin/stats", (req, res) => {
    const tenantPurchases = scoped(purchases, req);
    const tenantRaffles = scoped(raffles, req);
    const totalRevenue = tenantPurchases.filter(p => p.status === "paid").reduce((acc, p) => acc + p.amount, 0);
    const blockedCount = securityLogs.length;
    res.json({
        totalRaffles: tenantRaffles.length,
        totalPurchases: tenantPurchases.length,
        totalRevenue: totalRevenue || 120500, // mock base revenue
        users: 1245,
        blockedRequests: blockedCount
    });
  });

  app.get("/api/admin/notifications", (req, res) => {
    const tenantPurchases = scoped(purchases, req);
    const tenantWithdrawals = scoped(affiliateWithdrawals, req);
    const tenantTickets = scoped(supportTickets, req);
    const pendingPix = tenantPurchases.filter(item => item.status === "pending").length;
    const pendingWithdrawals = tenantWithdrawals.filter(item => item.status === "pending").length;
    const openSupport = tenantTickets.filter(item => item.status !== "closed").length;
    const unreadSupport = tenantTickets.filter(ticket => ticket.messages.some(message => message.sender === "customer" && !message.readByAdmin)).length;
    const pixIssues = gateways.pix?.enabled ? 0 : 1;
    res.json({
      total: pendingPix + pendingWithdrawals + unreadSupport + pixIssues,
      pendingPix,
      pendingWithdrawals,
      openSupport,
      unreadSupport,
      pixIssues,
      latest: [
        ...tenantPurchases.filter(item => item.status === "pending").slice(-5).map(item => ({ type: "pix", title: "PIX pendente", detail: item.purchaseId, date: item.createdAt })),
        ...tenantWithdrawals.filter(item => item.status === "pending").slice(0, 5).map(item => ({ type: "withdrawal", title: "Saque solicitado", detail: item.customerName, date: item.requestedAt })),
        ...tenantTickets.filter(item => item.status !== "closed").slice(0, 5).map(item => ({ type: "support", title: "Atendimento aberto", detail: item.customerName, date: item.updatedAt }))
      ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
    });
  });

  app.get("/api/admin/promotions", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const rules = scoped(promotionRules, req)
      .filter(rule => !rule.deleted_at)
      .sort((a, b) => a.priority - b.priority || b.updated_at.localeCompare(a.updated_at));
    const tenantUsages = promotionUsages.filter(usage => adminCanAccessTenant(req, usage.tenant_id));
    res.json({
      rules: rules.map(adminPromotionRule),
      usages: tenantUsages,
      stats: {
        active: rules.filter(rule => rule.enabled).length,
        bonusTickets: tenantUsages.filter(usage => usage.usage_type === "double_tickets").reduce((sum, usage) => sum + Number(usage.quantity || 0), 0),
        recoveredPix: tenantUsages.filter(usage => usage.usage_type === "abandoned_pix_recovery").length,
        revenueAttributed: Number(tenantUsages.reduce((sum, usage) => sum + Number(usage.amount || 0), 0).toFixed(2)),
        tenantId
      }
    });
  });

  app.post("/api/admin/promotions", (req, res) => {
    try {
      const rule = normalizePromotionPayload(req);
      promotionRules.unshift(rule);
      recordAuditLedger(req, { tenant_id: rule.tenant_id, action: "PROMOTION_CREATED", resource_type: "promotion_rule", resource_id: rule.id, before_data: null, after_data: rule, reason: String(req.body.reason || "Criacao de promocao comercial") });
      res.status(201).json(adminPromotionRule(rule));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Nao foi possivel criar promocao" });
    }
  });

  app.put("/api/admin/promotions/:id", (req, res) => {
    const index = promotionRules.findIndex(rule => rule.id === req.params.id && adminCanAccessTenant(req, rule.tenant_id));
    if (index < 0) return res.status(404).json({ error: "Promocao nao encontrada" });
    const before = promotionRules[index];
    try {
      const after = normalizePromotionPayload(req, before);
      promotionRules[index] = after;
      recordAuditLedger(req, { tenant_id: after.tenant_id, action: "PROMOTION_UPDATED", resource_type: "promotion_rule", resource_id: after.id, before_data: before, after_data: after, reason: String(req.body.reason || "Atualizacao de promocao comercial") });
      res.json(adminPromotionRule(after));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Nao foi possivel atualizar promocao" });
    }
  });

  app.post("/api/admin/promotions/:id/duplicate", (req, res) => {
    const current = promotionRules.find(rule => rule.id === req.params.id && adminCanAccessTenant(req, rule.tenant_id));
    if (!current) return res.status(404).json({ error: "Promocao nao encontrada" });
    const clone = normalizePromotionRule({ ...current, id: createPublicId("PROM_"), name: `${current.name} (copia)`, created_at: undefined, created_by: getAuthSession(req)?.sub || null });
    promotionRules.unshift(clone);
    recordAuditLedger(req, { tenant_id: clone.tenant_id, action: "PROMOTION_DUPLICATED", resource_type: "promotion_rule", resource_id: clone.id, before_data: current, after_data: clone, reason: String(req.body.reason || "Duplicacao de promocao") });
    res.status(201).json(adminPromotionRule(clone));
  });

  app.delete("/api/admin/promotions/:id", (req, res) => {
    const rule = promotionRules.find(item => item.id === req.params.id && adminCanAccessTenant(req, item.tenant_id));
    if (!rule) return res.status(404).json({ error: "Promocao nao encontrada" });
    const before = { ...rule };
    rule.enabled = false;
    rule.deleted_at = new Date().toISOString();
    rule.updated_at = rule.deleted_at;
    recordAuditLedger(req, { tenant_id: rule.tenant_id, action: "PROMOTION_DELETED", resource_type: "promotion_rule", resource_id: rule.id, before_data: before, after_data: rule, reason: String(req.body?.reason || "Exclusao logica de promocao") });
    res.json({ success: true, rule: adminPromotionRule(rule) });
  });

  app.get("/api/admin/promotions/stats", (req, res) => {
    const rules = scoped(promotionRules, req).filter(rule => !rule.deleted_at);
    const usages = promotionUsages.filter(usage => adminCanAccessTenant(req, usage.tenant_id));
    res.json({
      activeRules: rules.filter(rule => rule.enabled).length,
      usages: usages.length,
      conversionRevenue: usages.reduce((sum, usage) => sum + Number(usage.amount || 0), 0),
      pixRecovered: usages.filter(usage => usage.usage_type === "abandoned_pix_recovery").length,
      bonusTicketsIssued: usages.filter(usage => usage.usage_type === "double_tickets" || usage.metadata?.bonusTickets).reduce((sum, usage) => sum + Number(usage.quantity || usage.metadata?.bonusTickets || 0), 0)
    });
  });

  app.post("/api/admin/promotions/process-abandoned-pix", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    expirePendingReservations(tenantId);
    const pendingPurchases = purchases.filter(purchase => purchase.tenant_id === tenantId && purchase.status === "pending" && !isPastReservationExpiry(purchase.reservedUntil || purchase.pixExpiresAt));
    const queued: WhatsAppMessageQueueRecord[] = [];
    pendingPurchases.forEach(purchase => {
      const messages = buildAbandonedPixRecoveryMessages({
        tenantId,
        raffleId: purchase.raffleId,
        orderId: purchase.purchaseId,
        customerId: purchase.customer?.id,
        customerName: purchase.customer?.name,
        customerPhone: purchase.customer?.phone || purchase.contact,
        quantity: purchase.tickets,
        amount: purchase.amount,
        paymentStatus: purchase.status,
        paymentLink: `/checkout/orders/${purchase.purchaseId}`,
        rules: promotionRules,
        usages: promotionUsages
      });
      const config = getWhatsAppConfig(tenantId);
      messages.forEach(message => {
        if (whatsappMessageQueue.some(item => item.idempotency_key === message.idempotencyKey)) return;
        const phone = normalizeBrazilianPhone(purchase.customer?.phone || purchase.contact || "");
        const now = new Date().toISOString();
        const item: WhatsAppMessageQueueRecord = {
          id: createPublicId("WAPP_"),
          tenant_id: tenantId,
          order_id: purchase.purchaseId,
          customer_id: purchase.customer?.id,
          phone,
          message_type: "abandoned_pix_recovery",
          message_body: message.message,
          provider: config?.provider || "mock",
          status: isValidBrazilianWhatsAppPhone(phone) ? "pending" : "failed",
          attempts: 0,
          max_attempts: 3,
          last_error: isValidBrazilianWhatsAppPhone(phone) ? "" : "Telefone invalido para WhatsApp",
          created_at: now,
          updated_at: now,
          idempotency_key: message.idempotencyKey
        };
        whatsappMessageQueue.unshift(item);
        queued.push(item);
      });
    });
    res.json({ queued: queued.length, messages: queued.map(item => ({ ...item, phone: maskPhone(item.phone) })) });
  });

  app.get("/api/admin/whatsapp-cloud/settings", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    res.json({
      settings: sanitizeWhatsAppCloudConfig(getWhatsAppCloudConfig(tenantId)),
      logs: whatsappCloudLogs.filter(log => log.tenant_id === tenantId).slice(0, 100).map(sanitizeWhatsAppCloudLog),
      queue: whatsappMessageQueue
        .filter(message => message.tenant_id === tenantId)
        .slice(0, 20)
        .map(message => ({ ...message, phone: maskPhone(message.phone) }))
    });
  });

  app.put("/api/admin/whatsapp-cloud/settings", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    const config = upsertWhatsAppCloudConfig(req, tenantId);
    res.json({
      settings: sanitizeWhatsAppCloudConfig(config),
      logs: whatsappCloudLogs.filter(log => log.tenant_id === tenantId).slice(0, 100).map(sanitizeWhatsAppCloudLog)
    });
  });

  app.post("/api/admin/whatsapp-cloud/test", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    try {
      const result = await createMetaWhatsAppCloudProvider(tenantId).testConnection();
      res.json({ success: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao testar conexão com WhatsApp Cloud";
      recordWhatsAppCloudLog(tenantId, {
        action: message.includes("configurado") || message.includes("desativado") ? "credential_error" : "meta_api_error",
        status: "error",
        message,
        metadata: { operation: "testConnection" }
      });
      res.status(message.includes("configurado") || message.includes("desativado") ? 409 : 502).json({ error: message });
    }
  });

  app.get("/api/admin/whatsapp-cloud/phone", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    try {
      const phone = await createMetaWhatsAppCloudProvider(tenantId).getPhoneNumberInfo();
      res.json({ phone });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao validar número do WhatsApp Cloud";
      recordWhatsAppCloudLog(tenantId, {
        action: message.includes("configurado") || message.includes("desativado") ? "credential_error" : "meta_api_error",
        status: "error",
        message,
        metadata: { operation: "getPhoneNumberInfo" }
      });
      res.status(message.includes("configurado") || message.includes("desativado") ? 409 : 502).json({ error: message });
    }
  });

  app.get("/api/admin/whatsapp-cloud/templates", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    try {
      const templates = await createMetaWhatsAppCloudProvider(tenantId).listTemplates();
      res.json({ templates });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao listar templates do WhatsApp Cloud";
      recordWhatsAppCloudLog(tenantId, {
        action: message.includes("configurado") || message.includes("desativado") ? "credential_error" : "meta_api_error",
        status: "error",
        message,
        metadata: { operation: "listTemplates" }
      });
      res.status(message.includes("configurado") || message.includes("desativado") ? 409 : 502).json({ error: message });
    }
  });

  app.post("/api/admin/whatsapp-cloud/templates/sync", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    try {
      const templates = await createMetaWhatsAppCloudProvider(tenantId).listTemplates();
      const syncedAt = new Date().toISOString();
      const snapshot = templates
        .map(template => normalizeWhatsAppCloudTemplateSnapshot(tenantId, template as Record<string, unknown>, syncedAt))
        .filter(template => template.name);
      whatsappCloudTemplates = [
        ...whatsappCloudTemplates.filter(template => template.tenant_id !== tenantId),
        ...snapshot
      ];
      recordWhatsAppCloudLog(tenantId, {
        action: "templates_synced",
        status: "success",
        message: "Templates oficiais sincronizados",
        metadata: { count: snapshot.length, adminId: getAuthSession(req)?.sub || "" }
      });
      schedulePersistentStateSave("whatsapp-cloud-templates-sync");
      res.json({ templates: snapshot.map(sanitizeWhatsAppCloudTemplate), syncedAt });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao sincronizar templates do WhatsApp Cloud";
      recordWhatsAppCloudLog(tenantId, {
        action: message.includes("configurado") || message.includes("desativado") ? "credential_error" : "meta_api_error",
        status: "error",
        message,
        metadata: { operation: "syncTemplates", adminId: getAuthSession(req)?.sub || "" }
      });
      res.status(message.includes("configurado") || message.includes("desativado") ? 409 : 502).json({ error: message });
    }
  });

  app.get("/api/admin/whatsapp-cloud/templates/saved", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    res.json({ templates: getSavedWhatsAppCloudTemplates(tenantId).map(sanitizeWhatsAppCloudTemplate) });
  });

  app.post("/api/admin/whatsapp-cloud/test-template", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    if (Array.isArray(req.body?.to) || Array.isArray(req.body?.recipients) || Array.isArray(req.body?.phones)) {
      return res.status(400).json({ error: "Informe apenas um numero de teste" });
    }
    const rawPhone = String(req.body?.to || "").trim();
    if (!rawPhone || /[,;\n]/.test(rawPhone)) return res.status(400).json({ error: "Informe apenas um numero de teste" });
    const phone = normalizeBrazilianPhone(rawPhone);
    if (!isValidBrazilianWhatsAppPhone(phone)) return res.status(400).json({ error: "Telefone de teste invalido" });
    const templateName = String(req.body?.templateName || "").trim();
    const language = String(req.body?.language || "pt_BR").trim() || "pt_BR";
    if (!templateName) return res.status(400).json({ error: "Template obrigatorio para o teste" });
    const templates = getSavedWhatsAppCloudTemplates(tenantId);
    const selectedTemplate = templates.find(template => template.name === templateName && template.language === language);
    if (!selectedTemplate) return res.status(409).json({ error: "Sincronize e escolha um template oficial antes do teste" });
    if (String(selectedTemplate.status || "").toUpperCase() !== "APPROVED") return res.status(409).json({ error: "Template ainda nao esta aprovado para envio" });
    const components = Array.isArray(req.body?.components) ? req.body.components : [];
    recordWhatsAppCloudLog(tenantId, {
      action: "template_test_requested",
      status: "success",
      message: "Envio de teste individual solicitado",
      metadata: { to: maskPhone(phone), templateName, language, adminId: getAuthSession(req)?.sub || "" }
    });
    try {
      const result = await createMetaWhatsAppCloudProvider(tenantId).sendTemplateTest({
        to: phone,
        templateName,
        language,
        components,
        availableTemplates: templates
      });
      recordWhatsAppCloudLog(tenantId, {
        action: "template_test_sent",
        status: "success",
        message: "Teste individual enviado pela Meta",
        metadata: { to: maskPhone(phone), templateName, language, adminId: getAuthSession(req)?.sub || "", metaMessageId: result.data?.messages?.[0]?.id || "" }
      });
      schedulePersistentStateSave("whatsapp-cloud-template-test");
      res.json({ success: true, to: maskPhone(phone), templateName, language, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no envio de teste individual";
      recordWhatsAppCloudLog(tenantId, {
        action: message.includes("configurado") || message.includes("desativado") ? "credential_error" : "meta_api_error",
        status: "error",
        message,
        metadata: { to: maskPhone(phone), templateName, language, adminId: getAuthSession(req)?.sub || "" }
      });
      res.status(message.includes("configurado") || message.includes("desativado") ? 409 : 502).json({ error: message });
    }
  });

  app.get("/api/admin/whatsapp-cloud/pix-recovery/settings", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    res.json({
      settings: sanitizeWhatsAppPixRecoverySettings(getWhatsAppPixRecoverySettings(tenantId)),
      templates: getSavedWhatsAppCloudTemplates(tenantId).map(sanitizeWhatsAppCloudTemplate)
    });
  });

  app.put("/api/admin/whatsapp-cloud/pix-recovery/settings", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    const settingsRecord = upsertWhatsAppPixRecoverySettings(req, tenantId);
    res.json({ settings: sanitizeWhatsAppPixRecoverySettings(settingsRecord) });
  });

  app.post("/api/admin/whatsapp-cloud/pix-recovery/preview", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    const settingsRecord = getWhatsAppPixRecoverySettings(tenantId);
    const items = listWhatsAppPixRecoveryCandidates(tenantId, settingsRecord).slice(0, 100).map(item => ({
      orderId: item.candidate.order.orderId,
      purchaseId: item.candidate.order.orderId,
      orderType: item.candidate.order.orderType,
      customerName: item.candidate.customerName,
      phone: maskPhone(item.candidate.phone),
      campaign: item.candidate.campaign,
      campaignName: item.candidate.order.campaignName,
      amount: item.candidate.order.amount,
      status: item.candidate.order.status,
      eventType: item.candidate.eventType,
      templateName: item.candidate.templateName,
      language: item.candidate.language,
      eligible: item.eligible,
      reason: item.reason || "Pronto para enfileirar"
    }));
    recordWhatsAppCloudLog(tenantId, {
      action: "pix_recovery_preview",
      status: "success",
      message: "Previa da recuperacao de PIX gerada",
      metadata: { total: items.length, eligible: items.filter(item => item.eligible).length, adminId: getAuthSession(req)?.sub || "" }
    });
    res.json({
      settings: sanitizeWhatsAppPixRecoverySettings(settingsRecord),
      total: items.length,
      eligible: items.filter(item => item.eligible).length,
      items
    });
  });

  app.post("/api/admin/whatsapp-cloud/pix-recovery/enqueue", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    const settingsRecord = getWhatsAppPixRecoverySettings(tenantId);
    const purchaseId = String(req.body?.purchaseId || req.body?.orderId || "").trim();
    const requestedOrderType = String(req.body?.orderType || "");
    const orderType = requestedOrderType === "raffle" || requestedOrderType === "fazendinha" || requestedOrderType === "number_mode"
      ? requestedOrderType as WhatsAppOrderType
      : undefined;
    const candidates = purchaseId
      ? [findWhatsAppOrderSource(tenantId, purchaseId, orderType)].filter((item): item is WhatsAppOrderSource => Boolean(item))
      : listWhatsAppOrderSourcesForPixRecovery(tenantId);
    const results = candidates.map(purchase => enqueueWhatsAppPixRecoveryMessageFromOrder(tenantId, purchase, settingsRecord));
    const queued = results.map(item => item.message).filter((item): item is WhatsAppMessageQueueRecord => Boolean(item));
    if (settingsRecord.mode === "automatic" && queued.length) {
      void processWhatsappPixRecoveryQueue(tenantId, Math.min(queued.length, settingsRecord.daily_tenant_limit));
    }
    res.json({
      mode: settingsRecord.mode,
      queued: queued.length,
      skipped: results.length - queued.length,
      messages: queued.map(sanitizeWhatsAppQueueRecord),
      results: results.map(item => ({
        orderId: item.validation.candidate.order.orderId,
        purchaseId: item.validation.candidate.order.orderId,
        orderType: item.validation.candidate.order.orderType,
        eventType: item.validation.candidate.eventType,
        eligible: item.validation.eligible,
        reason: item.validation.reason || "Enfileirado"
      }))
    });
  });

  app.post("/api/admin/whatsapp-cloud/pix-recovery/run", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    const limit = Math.max(1, Math.min(100, Number(req.body?.limit || 20)));
    const result = await processWhatsappPixRecoveryQueue(tenantId, limit);
    res.json({
      ...result,
      queue: getWhatsAppPixRecoveryQueue(tenantId).slice(0, 100).map(sanitizeWhatsAppQueueRecord)
    });
  });

  app.get("/api/admin/whatsapp-cloud/pix-recovery/queue", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    res.json({
      queue: getWhatsAppPixRecoveryQueue(tenantId).slice(0, 200).map(sanitizeWhatsAppQueueRecord)
    });
  });

  app.get("/api/admin/whatsapp-cloud/pix-recovery/logs", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    const actions = new Set(["pix_recovery_settings_saved", "pix_recovery_preview", "pix_recovery_enqueued", "pix_recovery_sent", "pix_recovery_skipped", "meta_api_error"]);
    res.json({
      logs: whatsappCloudLogs
        .filter(log => log.tenant_id === tenantId && actions.has(log.action))
        .slice(0, 100)
        .map(sanitizeWhatsAppCloudLog)
    });
  });

  app.get("/api/admin/whatsapp-cloud/purchase-confirmation/settings", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    res.json({
      settings: sanitizeWhatsAppPurchaseConfirmationSettings(getWhatsAppPurchaseConfirmationSettings(tenantId)),
      templates: getSavedWhatsAppCloudTemplates(tenantId).map(sanitizeWhatsAppCloudTemplate)
    });
  });

  app.put("/api/admin/whatsapp-cloud/purchase-confirmation/settings", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    const settingsRecord = upsertWhatsAppPurchaseConfirmationSettings(req, tenantId);
    res.json({ settings: sanitizeWhatsAppPurchaseConfirmationSettings(settingsRecord) });
  });

  app.post("/api/admin/whatsapp-cloud/purchase-confirmation/test", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    if (Array.isArray(req.body?.to) || Array.isArray(req.body?.recipients) || Array.isArray(req.body?.phones)) {
      return res.status(400).json({ error: "Envio em lote nao permitido para confirmacao de compra" });
    }
    const settingsRecord = getWhatsAppPurchaseConfirmationSettings(tenantId);
    const purchaseId = String(req.body?.purchaseId || "").trim();
    const purchase = purchaseId
      ? purchases.find(item => item.tenant_id === tenantId && item.purchaseId === purchaseId)
      : purchases.find(item => item.tenant_id === tenantId && item.status === "paid" && item.numeros.length > 0);
    if (!purchase) return res.status(404).json({ error: "Compra paga nao encontrada para teste do evento" });
    const result = enqueueWhatsAppPurchaseConfirmationMessage(tenantId, purchase, settingsRecord, "admin_test_event");
    if (settingsRecord.mode === "automatic" && result.message) {
      void processWhatsappPurchaseConfirmationQueue(tenantId, 1);
    }
    res.json({
      mode: settingsRecord.mode,
      queued: result.message ? 1 : 0,
      skipped: result.message ? 0 : 1,
      message: result.message ? sanitizeWhatsAppQueueRecord(result.message) : null,
      result: {
        orderId: result.validation.candidate.order.orderId,
        purchaseId: result.validation.candidate.order.orderId,
        orderType: result.validation.candidate.order.orderType,
        eventType: result.validation.candidate.eventType,
        eligible: result.validation.eligible,
        reason: result.validation.reason || "Enfileirado"
      }
    });
  });

  app.get("/api/admin/whatsapp-cloud/purchase-confirmation/queue", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    res.json({
      queue: getWhatsAppPurchaseConfirmationQueue(tenantId).slice(0, 200).map(sanitizeWhatsAppQueueRecord)
    });
  });

  app.get("/api/admin/whatsapp-cloud/purchase-confirmation/logs", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!requestHasAdminSession(req, tenantId)) return res.status(403).json({ error: "Acesso administrativo obrigatorio" });
    const actions = new Set(["purchase_confirmation_settings_saved", "purchase_confirmation_event", "purchase_confirmation_enqueued", "purchase_confirmation_send_requested", "purchase_confirmation_sent", "purchase_confirmation_failed", "purchase_confirmation_skipped"]);
    res.json({
      logs: whatsappCloudLogs
        .filter(log => log.tenant_id === tenantId && actions.has(log.action))
        .slice(0, 100)
        .map(sanitizeWhatsAppCloudLog)
    });
  });

  app.get("/api/webhooks/meta/whatsapp", (req, res) => {
    const token = String(req.query["hub.verify_token"] || "");
    const config = findWhatsAppCloudConfigByVerifyToken(token);
    if (!config) return res.status(403).send("Token de verificação inválido");
    const result = new MetaWhatsAppCloudProvider(decryptWhatsAppCloudConfig(config) || { enabled: false, environment: "sandbox" }, {
      log: entry => recordWhatsAppCloudLog(config.tenant_id, {
        action: "webhook_validate",
        status: entry.status,
        message: entry.message || "Validação do webhook Meta",
        metadata: entry.metadata || {}
      })
    }).validateWebhook(req.query as Record<string, unknown>);
    if (!result.valid) return res.status(403).send("Token de verificação inválido");
    res.status(200).send(result.challenge);
  });

  app.post("/api/webhooks/meta/whatsapp", (req, res) => {
    const config = findWhatsAppCloudConfigByWebhookPayload(req.body);
    const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
    const entries = Array.isArray(body.entry) ? body.entry : [];
    if (config) {
      createMetaWhatsAppCloudProvider(config.tenant_id).handleWebhook(req.body);
      processWhatsAppCenterInboundWebhook(config.tenant_id, req.body);
    } else {
      recordSecurityEvent({ tenant_id: "unknown", action: "WHATSAPP_CLOUD_WEBHOOK_UNMATCHED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", actor: "meta-webhook", detail: `entries:${entries.length}` });
    }
    res.status(200).json({ received: true, entries: entries.length, tenantResolved: Boolean(config) });
  });

  app.get("/api/admin/audit-logs", (req, res) => {
    res.json(scoped(auditLogs, req));
  });

  app.get("/api/admin/system-health", (req, res) => {
    const tenantPurchases = scoped(purchases, req);
    const tenantTickets = scoped(supportTickets, req);
    const tenantWithdrawals = scoped(affiliateWithdrawals, req);
    const tenantCustomers = Object.values(customersByPhone).filter(customer => adminCanAccessTenant(req, customer.tenant_id));
    const issues = [
      ...(!gateways.pix?.enabled ? [{ level: "critical", area: "PIX", message: "PIX global está desabilitado" }] : []),
      ...(!gateways.pix?.apiKey ? [{ level: "warning", area: "PIX", message: "Chave/API PIX global não configurada" }] : []),
      ...(tenantPurchases.filter(item => item.status === "pending").length > 0 ? [{ level: "info", area: "Pagamentos", message: `${tenantPurchases.filter(item => item.status === "pending").length} PIX pendente(s)` }] : []),
      ...(tenantTickets.filter(item => item.status === "open").length > 0 ? [{ level: "info", area: "Suporte", message: `${tenantTickets.filter(item => item.status === "open").length} chamado(s) aguardando atendimento` }] : []),
      ...(!settings.smsProvider?.enabled ? [{ level: "warning", area: "SMS", message: "Recuperação por SMS está em modo local/simulado" }] : [])
    ];
    res.json({
      ok: issues.every(issue => issue.level !== "critical"),
      checkedAt: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      counts: {
        customers: tenantCustomers.length,
        purchases: tenantPurchases.length,
        pendingPix: tenantPurchases.filter(item => item.status === "pending").length,
        supportOpen: tenantTickets.filter(item => item.status !== "closed").length,
        withdrawalsPending: tenantWithdrawals.filter(item => item.status === "pending").length
      },
      issues
    });
  });

  app.get("/api/admin/automations", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const flows = ensureAutomationFlows(tenantId).sort((a, b) => a.name.localeCompare(b.name));
    res.json({
      flows,
      runs: scoped(automationRuns, req).slice(0, 100),
      templates: automationTemplates,
      metrics: {
        enabled: flows.filter(flow => flow.enabled).length,
        scheduled: automationRuns.filter(run => run.tenant_id === tenantId && run.status === "scheduled").length,
        completed: automationRuns.filter(run => run.tenant_id === tenantId && run.status === "completed").length,
        failed: automationRuns.filter(run => run.tenant_id === tenantId && run.status === "failed").length
      }
    });
  });

  app.post("/api/admin/automations", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    if (!tenantHasFeature(tenantId, "automations")) return res.status(403).json({ error: "Plano atual nao libera automacoes" });
    const now = new Date().toISOString();
    const flow: AutomationFlowRecord = {
      id: createPublicId("AUTO_"),
      tenant_id: tenantId,
      name: String(req.body.name || "Nova automacao").trim(),
      trigger_type: String(req.body.trigger_type || "purchase_created"),
      enabled: req.body.enabled !== false,
      conditions: req.body.conditions && typeof req.body.conditions === "object" ? req.body.conditions : {},
      actions: Array.isArray(req.body.actions) ? req.body.actions : [{ type: "create_audit_event" }],
      delay_minutes: Math.max(0, Number(req.body.delay_minutes || 0)),
      max_runs_per_customer: Math.max(0, Number(req.body.max_runs_per_customer || 1)),
      created_at: now,
      updated_at: now
    };
    automationFlows.unshift(flow);
    recordAuditLedger(req, { tenant_id: tenantId, action: "AUTOMATION_FLOW_CREATED", resource_type: "automation_flow", resource_id: flow.id, before_data: null, after_data: flow, reason: String(req.body.reason || "Criacao de automacao") });
    res.status(201).json(flow);
  });

  app.put("/api/admin/automations/:id", (req, res) => {
    const flow = automationFlows.find(item => item.id === req.params.id && adminCanAccessTenant(req, item.tenant_id));
    if (!flow) return res.status(404).json({ error: "Automacao nao encontrada" });
    const before = deepClone(flow);
    flow.name = req.body.name !== undefined ? String(req.body.name).trim() : flow.name;
    flow.trigger_type = req.body.trigger_type !== undefined ? String(req.body.trigger_type) : flow.trigger_type;
    flow.enabled = req.body.enabled !== undefined ? Boolean(req.body.enabled) : flow.enabled;
    flow.conditions = req.body.conditions && typeof req.body.conditions === "object" ? req.body.conditions : flow.conditions;
    flow.actions = Array.isArray(req.body.actions) ? req.body.actions : flow.actions;
    flow.delay_minutes = req.body.delay_minutes !== undefined ? Math.max(0, Number(req.body.delay_minutes)) : flow.delay_minutes;
    flow.max_runs_per_customer = req.body.max_runs_per_customer !== undefined ? Math.max(0, Number(req.body.max_runs_per_customer)) : flow.max_runs_per_customer;
    flow.updated_at = new Date().toISOString();
    recordAuditLedger(req, { tenant_id: flow.tenant_id, action: "AUTOMATION_FLOW_UPDATED", resource_type: "automation_flow", resource_id: flow.id, before_data: before, after_data: flow, reason: String(req.body.reason || "Atualizacao de automacao") });
    res.json(flow);
  });

  app.post("/api/admin/automations/:id/toggle", (req, res) => {
    const flow = automationFlows.find(item => item.id === req.params.id && adminCanAccessTenant(req, item.tenant_id));
    if (!flow) return res.status(404).json({ error: "Automacao nao encontrada" });
    const before = deepClone(flow);
    flow.enabled = req.body.enabled !== undefined ? Boolean(req.body.enabled) : !flow.enabled;
    flow.updated_at = new Date().toISOString();
    recordAuditLedger(req, { tenant_id: flow.tenant_id, action: "AUTOMATION_FLOW_TOGGLED", resource_type: "automation_flow", resource_id: flow.id, before_data: before, after_data: flow, reason: String(req.body.reason || "Ativacao/desativacao de automacao") });
    res.json(flow);
  });

  app.get("/api/admin/automations/runs", (req, res) => {
    res.json(scoped(automationRuns, req).slice(0, 200));
  });

  app.post("/api/admin/automations/process-due", (req, res) => {
    const processed = processDueAutomationRuns();
    res.json({ processed, runs: scoped(automationRuns, req).slice(0, 100) });
  });

  app.get("/api/admin/whatsapp/config", (req, res) => {
    res.json(sanitizeWhatsAppConfig(getWhatsAppConfig(resolveRequestTenantId(req))));
  });

  app.post("/api/admin/whatsapp/config", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const now = new Date().toISOString();
    const existing = getWhatsAppConfig(tenantId);
    const provider = String(req.body.provider || existing?.provider || "mock") === "meta_cloud" ? "meta_cloud" : "mock";
    const environment = String(req.body.environment || existing?.environment || "sandbox") === "production" ? "production" : "sandbox";
    const mergeSecret = (incoming: unknown, current?: string) => {
      const value = String(incoming || "").trim();
      if (!value || isMaskedGatewaySecret(value)) return current || "";
      return encryptGatewaySecret(value);
    };
    const config: WhatsAppProviderConfigRecord = {
      id: existing?.id || createPublicId("WCFG_"),
      tenant_id: tenantId,
      provider,
      enabled: Boolean(req.body.enabled),
      environment,
      phone_number_id: String(req.body.phone_number_id || existing?.phone_number_id || "").trim(),
      business_account_id: String(req.body.business_account_id || existing?.business_account_id || "").trim(),
      access_token_encrypted: mergeSecret(req.body.access_token, existing?.access_token_encrypted),
      webhook_verify_token_encrypted: mergeSecret(req.body.webhook_verify_token, existing?.webhook_verify_token_encrypted),
      template_namespace: String(req.body.template_namespace || existing?.template_namespace || "").trim(),
      default_language: String(req.body.default_language || existing?.default_language || "pt_BR").trim() || "pt_BR",
      created_at: existing?.created_at || now,
      updated_at: now
    };
    whatsappProviderConfigs = existing
      ? whatsappProviderConfigs.map(item => item.id === existing.id ? config : item)
      : [config, ...whatsappProviderConfigs];
    recordSecurityEvent({ tenant_id: tenantId, action: "WHATSAPP_CONFIG_UPDATED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "medium", actor: getAuthSession(req)?.email, detail: `${config.provider}:${config.environment}:${config.enabled}` });
    res.json(sanitizeWhatsAppConfig(config));
  });

  app.post("/api/admin/whatsapp/test", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const config = getWhatsAppConfig(tenantId);
    if (!config?.enabled) return res.status(409).json({ error: "Ative a integracao WhatsApp antes de testar" });
    if (config.environment === "production" && isProductionRuntime) return res.status(403).json({ error: "Teste WhatsApp bloqueado em producao" });
    const phone = normalizeBrazilianPhone(String(req.body.phone || ""));
    const now = new Date().toISOString();
    const message: WhatsAppMessageQueueRecord = {
      id: createPublicId("WAPP_"),
      tenant_id: tenantId,
      phone,
      message_type: "test",
      message_body: "Mensagem de teste CIFHER Plataforma via WhatsApp sandbox.",
      provider: config.provider,
      status: "pending",
      attempts: 0,
      max_attempts: 1,
      last_error: "",
      created_at: now,
      updated_at: now,
      idempotency_key: `whatsapp:test:${tenantId}:${Date.now()}`
    };
    whatsappMessageQueue.unshift(message);
    await sendQueuedWhatsAppMessage(message.id);
    res.status(String(message.status) === "sent" ? 200 : 502).json({ message: { ...message, phone: maskPhone(message.phone) } });
  });

  app.get("/api/admin/whatsapp/messages", (req, res) => {
    res.json(scoped(whatsappMessageQueue, req).map(message => ({ ...message, phone: maskPhone(message.phone) })));
  });

  app.post("/api/admin/whatsapp/messages/:id/resend", async (req, res) => {
    const message = whatsappMessageQueue.find(item => item.id === req.params.id && adminCanAccessTenant(req, item.tenant_id));
    if (!message) return res.status(404).json({ error: "Mensagem WhatsApp nao encontrada para este tenant" });
    message.status = "pending";
    message.attempts = 0;
    message.last_error = "";
    message.updated_at = new Date().toISOString();
    await sendQueuedWhatsAppMessage(message.id);
    res.status(String(message.status) === "sent" ? 200 : 502).json({ message: { ...message, phone: maskPhone(message.phone) } });
  });

  app.get("/api/admin/finance-summary", (req, res) => {
    const tenantPurchases = scoped(purchases, req);
    const tenantWithdrawals = scoped(affiliateWithdrawals, req);
    const tenantModePurchases = scoped(numberModePurchases, req);
    const tenantFarmPurchases = scoped(fazendinhaCompras, req);
    const paid = tenantPurchases.filter(item => item.status === "paid");
    const pending = tenantPurchases.filter(item => item.status === "pending");
    const paidWithdrawals = tenantWithdrawals.filter(item => item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
    const pendingWithdrawals = tenantWithdrawals.filter(item => item.status === "pending").reduce((sum, item) => sum + item.amount, 0);
    const byRaffle = scoped(raffles, req).map(raffle => {
      const rafflePaid = paid.filter(item => item.raffleId === raffle.id);
      const rafflePending = pending.filter(item => item.raffleId === raffle.id);
      return {
        id: raffle.id,
        title: raffle.title,
        paidRevenue: rafflePaid.reduce((sum, item) => sum + item.amount, 0),
        pendingRevenue: rafflePending.reduce((sum, item) => sum + item.amount, 0),
        paidPurchases: rafflePaid.length,
        pendingPurchases: rafflePending.length,
        tickets: rafflePaid.reduce((sum, item) => sum + item.tickets, 0)
      };
    });
    const modalidadeRevenue = tenantModePurchases.filter(item => item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
    const fazendinhaRevenue = tenantFarmPurchases.filter(item => item.statusPagamento === "paid").reduce((sum, item) => sum + item.valorPago, 0);
    const grossRevenue = paid.reduce((sum, item) => sum + item.amount, 0) + modalidadeRevenue + fazendinhaRevenue;
    res.json({
      grossRevenue,
      pendingRevenue: pending.reduce((sum, item) => sum + item.amount, 0),
      paidWithdrawals,
      pendingWithdrawals,
      estimatedNet: grossRevenue - paidWithdrawals,
      channels: [
        { name: "Rifas", revenue: paid.reduce((sum, item) => sum + item.amount, 0), purchases: paid.length },
        { name: "Modalidades", revenue: modalidadeRevenue, purchases: tenantModePurchases.filter(item => item.status === "paid").length },
        { name: "Fazendinha", revenue: fazendinhaRevenue, purchases: tenantFarmPurchases.filter(item => item.statusPagamento === "paid").length }
      ],
      byRaffle
    });
  });

  app.get("/api/admin/reports", (req, res) => {
    res.json(reportExports
      .filter(item => item.tenant_id && adminCanAccessTenant(req, item.tenant_id))
      .map(publicReportExport));
  });

  app.post("/api/admin/reports/export", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const reportType = String(req.body.report_type || req.body.reportType || "financial_tenant");
    const format = (["pdf", "csv", "xlsx"].includes(String(req.body.format)) ? req.body.format : "pdf") as "pdf" | "csv" | "xlsx";
    const filters = { ...(req.body.filters || {}), tenant_id: tenantId };
    const record = createReportExport(req, { reportType, format, filters, tenantId, global: false });
    recordAuditLedger(req, { tenant_id: tenantId, action: "OFFICIAL_REPORT_EXPORTED", resource_type: "report_export", resource_id: record.id, before_data: null, after_data: publicReportExport(record), reason: "Relatorio oficial auditavel exportado pelo admin tenant" });
    res.status(201).json(publicReportExport(record));
  });

  app.get("/api/admin/reports/:id/download", (req, res) => {
    const record = reportExports.find(item => item.id === req.params.id && item.tenant_id && adminCanAccessTenant(req, item.tenant_id));
    if (!record) return res.status(404).json({ error: "Relatorio nao encontrado" });
    sendReportDownload(res, record);
  });

  app.get("/api/admin/reports/export", (req, res) => {
    const tenantPurchases = scoped(purchases, req);
    const tenantModePurchases = scoped(numberModePurchases, req);
    const tenantFarmPurchases = scoped(fazendinhaCompras, req);
    const rows = [
      ["nome_completo", "telefone", "cidade", "data_compra", "codigo_sorteio", "quantidade_cotas"],
      ...tenantPurchases.map(item => [
        item.customer?.name || "",
        item.customer?.phone || item.contact,
        item.customer?.city || "",
        item.createdAt,
        item.raffleId,
        item.tickets
      ]),
      ...tenantModePurchases.map(item => [
        item.customer.name,
        item.customer.phone,
        item.customer.city || "",
        item.createdAt,
        item.mode,
        item.numbers.length
      ]),
      ...tenantFarmPurchases.map(item => [
        item.customer.name,
        item.customer.phone,
        item.customer.city || "",
        item.dataCompra,
        "fazendinha",
        item.numeros.length
      ])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=relatorio-geral.csv");
    res.send(csv);
  });

  // Admin: Purchases
  app.get("/api/admin/purchases", (req, res) => {
    res.json(scoped(purchases, req));
  });

  function buildPixRecoveryMessage(input: { customerName: string; campaign: string; link: string; expired: boolean }) {
    if (input.expired) {
      return `Olá, ${input.customerName}! Vi que você iniciou sua compra na campanha ${input.campaign}, mas o PIX anterior venceu.\n\nPara participar, faça uma nova compra pelo link abaixo:\n\n${input.link}\n\nSe já pagou, pode desconsiderar esta mensagem. 🍀`;
    }
    return `Olá, ${input.customerName}! Vi que você iniciou sua compra na campanha ${input.campaign}, mas o pagamento via PIX ainda não foi concluído.\n\nPara garantir sua participação, finalize pelo link abaixo:\n\n${input.link}\n\nSe já pagou, pode desconsiderar esta mensagem. 🍀`;
  }

  function buildAdminPixPendingRecovery(req: express.Request, purchase: PurchaseRecord) {
    const raffle = raffles.find(item => item.tenant_id === purchase.tenant_id && item.id === purchase.raffleId);
    const expiresAt = purchase.pixExpiresAt || purchase.reservedUntil || "";
    const expired = isPastReservationExpiry(expiresAt);
    const origin = `${req.protocol}://${req.get("host")}`;
    const paymentLink = expired ? "" : `${origin}/checkout/orders/${encodeURIComponent(purchase.purchaseId)}`;
    const campaignLink = raffle ? `${origin}/raffle/${encodeURIComponent(raffle.id)}` : "";
    const link = paymentLink || campaignLink || origin;
    const customerName = purchase.customer?.name || "Cliente";
    const campaign = raffle?.title || "Campanha";
    return {
      id: purchase.purchaseId,
      customerName,
      whatsapp: purchase.customer?.phone || purchase.contact || "",
      campaign,
      amount: Number(purchase.amount || 0),
      status: expired ? "expired" : "pending",
      statusLabel: expired ? "PIX vencido" : "Aguardando pagamento",
      createdAt: purchase.createdAt,
      expiresAt,
      paymentLink,
      campaignLink,
      orderUrl: paymentLink,
      copyMessage: buildPixRecoveryMessage({ customerName, campaign, link, expired })
    };
  }

  app.get("/api/admin/recovery/pix-pending", (req, res) => {
    const now = Date.now();
    const minimumAgeMs = Math.max(60_000, Number(req.query.minimumAgeMinutes || 3) * 60_000);
    const tenantPurchases = scoped(purchases, req);
    const rows = tenantPurchases
      .filter(purchase => purchase.status === "pending")
      .filter(purchase => Boolean(purchase.pixPayload || purchase.pixGateway || purchase.pixExpiresAt || purchase.reservedUntil))
      .filter(purchase => {
        const createdAt = new Date(purchase.createdAt || "").getTime();
        const expired = isPastReservationExpiry(purchase.pixExpiresAt || purchase.reservedUntil);
        return expired || (Number.isFinite(createdAt) && now - createdAt >= minimumAgeMs);
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map(purchase => buildAdminPixPendingRecovery(req, purchase));
    res.json(rows);
  });

  app.get("/api/admin/clientes", async (_req, res) => {
    try {
      res.json(await listarClientes());
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao listar clientes" });
    }
  });

  app.get("/api/admin/clientes/:id", async (req, res) => {
    try {
      res.json(await buscarCliente(req.params.id));
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Cliente nao encontrado" });
    }
  });

  app.post("/api/admin/clientes", async (req, res) => {
    try {
      res.status(201).json(await criarCliente(req.body));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao criar cliente" });
    }
  });

  app.put("/api/admin/clientes/:id", async (req, res) => {
    try {
      res.json(await atualizarCliente(req.params.id, req.body));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao atualizar cliente" });
    }
  });

  app.delete("/api/admin/clientes/:id", async (req, res) => {
    try {
      res.json(await deletarCliente(req.params.id));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao deletar cliente" });
    }
  });

  app.post("/api/teste/clientes", async (req, res) => {
    try {
      const cliente = await criarCliente({
        nome: req.body.nome || "Cliente Teste",
        email: req.body.email || `cliente.teste.${Date.now()}@example.com`,
        telefone: req.body.telefone || "11999999999"
      });
      res.status(201).json(cliente);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao cadastrar cliente teste" });
    }
  });

  app.get("/api/teste/clientes", async (_req, res) => {
    try {
      res.json(await listarClientes());
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao listar clientes teste" });
    }
  });

  function isMissingClientesTable(error: unknown) {
    const message = error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message || "") : "";
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code || "") : "";
    return ["42P01", "PGRST106", "PGRST205"].includes(code) ||
      /clientes/i.test(message) && /(does not exist|not find|schema cache|relation|tabela|não existe|nao existe)/i.test(message);
  }

  function formatSupabaseError(error: unknown) {
    if (!error) return "Erro desconhecido no Supabase.";
    if (error instanceof Error) return error.message;
    if (typeof error === "object") {
      const details = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
      return [
        details.message ? `Mensagem: ${String(details.message)}` : "",
        details.code ? `Codigo: ${String(details.code)}` : "",
        details.details ? `Detalhes: ${String(details.details)}` : "",
        details.hint ? `Hint: ${String(details.hint)}` : ""
      ].filter(Boolean).join(" | ") || "Erro Supabase sem detalhes.";
    }
    return String(error);
  }

  app.get("/api/teste/supabase", async (_req, res) => {
    try {
      const { count, error } = await getSupabaseAdminClient()
        .from("clientes")
        .select("id", { count: "exact", head: true });

      if (error) throw error;

      console.log("✅ Supabase conectado");
      res.json({
        success: true,
        supabase: "online",
        total_clientes: count || 0,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const message = isMissingClientesTable(error)
        ? "Tabela clientes nao encontrada no Supabase. Aplique a migration supabase/migrations/13_clientes.sql antes de testar esta rota."
        : formatSupabaseError(error);
      console.error("❌ Erro Supabase", message);
      res.status(500).json({
        success: false,
        supabase: "offline",
        error: message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/teste/supabase/health", async (_req, res) => {
    try {
      const { error } = await getSupabaseAdminClient()
        .from("clientes")
        .select("id", { head: true })
        .limit(1);

      if (error) throw error;

      console.log("✅ Supabase conectado");
      res.json({ database: "ok" });
    } catch (error) {
      const message = isMissingClientesTable(error)
        ? "Banco respondeu, mas a tabela clientes nao existe. Aplique a migration supabase/migrations/13_clientes.sql."
        : formatSupabaseError(error);
      console.error("❌ Erro Supabase", message);
      res.status(500).json({ database: "error", error: message });
    }
  });

  app.get("/api/admin/payments/webhooks", (req, res) => {
    res.json(scoped(paymentWebhookLogs, req));
  });

  app.get("/api/admin/payments/logs", (req, res) => {
    res.json(scoped(paymentLogs, req));
  });

  app.get("/api/admin/payments/webhook-logs", (req, res) => {
    res.json(scoped(webhookLogs, req));
  });

  app.get("/api/admin/payments/gateway-health", (req, res) => {
    res.json(scoped(gatewayHealth, req));
  });

  app.get("/api/admin/payments/queue", (req, res) => {
    res.json(scoped(paymentQueue, req));
  });

  app.post("/api/admin/payments/queue/process", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const processedDetails = await processAllPaymentWorkerQueues(Number(req.body?.limit || 20));
    const processed = Object.values(processedDetails).reduce((sum, value) => sum + Number(value || 0), 0);
    res.json({ processed, processedDetails, queues: buildPaymentQueuesDashboard(tenantId), jobs: paymentQueue.filter(job => job.tenant_id === tenantId) });
  });

  app.get("/api/admin/payments/queues", (req, res) => {
    res.json(buildPaymentQueuesDashboard(resolveRequestTenantId(req)));
  });

  app.post("/api/admin/payments/queues/process", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const processed = await processAllPaymentWorkerQueues(Number(req.body?.limit || 20));
    res.json({ processed, queues: buildPaymentQueuesDashboard(tenantId) });
  });

  app.get("/api/admin/audit/security", (req, res) => {
    res.json(scoped(securityLogs, req));
  });

  app.post("/api/admin/payments/reconcile", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const stalePending = purchases.filter(purchase => purchase.tenant_id === tenantId && purchase.status === "pending" && Date.now() - new Date(purchase.createdAt).getTime() > 15 * 60 * 1000);
    stalePending.forEach(purchase => enqueuePaymentReconciliationJob({
      tenant_id: purchase.tenant_id,
      provider: String(purchase.pixGateway || "unknown"),
      order_id: purchase.purchaseId,
      payload: { purchaseId: purchase.purchaseId, status: "reconciliation.pending" }
    }));
    res.json({ queued: stalePending.length, pendingPurchases: stalePending.map(purchase => purchase.purchaseId) });
  });

  app.get("/api/admin/gamification", (req, res) => {
    const tenantRaffles = scoped(raffles, req).map(raffle => sanitizeRaffleForAdmin(raffle));
    res.json({
      configs: scoped(gamificationConfigs, req),
      events: scoped(gamificationEvents, req).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      winners: scoped(gamificationWinners, req).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      rankings: tenantRaffles.map(raffle => {
        const config = getGamificationConfig(raffle.tenant_id, raffle.id);
        return { raffleId: raffle.id, title: raffle.title, ranking: getBuyerRanking(raffle.tenant_id, raffle.id, config.buyerRanking.metric, config.buyerRanking.limit) };
      }),
      raffles: tenantRaffles
    });
  });

  app.get("/api/admin/gamification/:raffleId", (req, res) => {
    const raffle = raffles.find(item => item.id === req.params.raffleId && adminCanAccessTenant(req, item.tenant_id));
    if (!raffle) {
      res.status(404).json({ error: "Raffle not found" });
      return;
    }
    res.json({
      raffle: sanitizeRaffleForAdmin(raffle),
      config: getGamificationConfig(raffle.tenant_id, raffle.id),
      events: gamificationEvents.filter(item => item.tenant_id === raffle.tenant_id && item.raffleId === raffle.id),
      winners: gamificationWinners.filter(item => item.tenant_id === raffle.tenant_id && item.raffleId === raffle.id),
      ranking: getBuyerRanking(raffle.tenant_id, raffle.id)
    });
  });

  app.put("/api/admin/gamification/:raffleId", (req, res) => {
    const raffle = raffles.find(item => item.id === req.params.raffleId && adminCanAccessTenant(req, item.tenant_id));
    if (!raffle) {
      res.status(404).json({ error: "Raffle not found" });
      return;
    }
    const current = getGamificationConfig(raffle.tenant_id, raffle.id);
    const next = normalizeGamificationConfig(current, req.body || {});
    const index = gamificationConfigs.findIndex(item => item.tenant_id === raffle.tenant_id && item.raffleId === raffle.id);
    gamificationConfigs[index] = next;
    addGamificationLog(raffle.tenant_id, "GAMIFICATION_CONFIG_UPDATED", raffle.id);
    res.json(next);
  });

  app.post("/api/admin/gamification/:raffleId/extreme-tickets/calculate", (req, res) => {
    const raffle = raffles.find(item => item.id === req.params.raffleId && adminCanAccessTenant(req, item.tenant_id));
    if (!raffle) {
      res.status(404).json({ error: "Raffle not found" });
      return;
    }
    const config = getGamificationConfig(raffle.tenant_id, raffle.id);
    if (!config.modules.extremeTickets) {
      res.status(403).json({ error: "Maior e menor cota desativado" });
      return;
    }
    const paid = purchases.filter(item => item.tenant_id === raffle.tenant_id && item.raffleId === raffle.id && item.status === "paid" && item.numeros.length);
    const flattened = paid.flatMap(purchase => purchase.numeros.map(number => ({ number, purchase })));
    if (!flattened.length) {
      res.json({ winners: [] });
      return;
    }
    const high = flattened.reduce((best, item) => item.number > best.number ? item : best, flattened[0]);
    const low = flattened.reduce((best, item) => item.number < best.number ? item : best, flattened[0]);
    const now = new Date().toISOString();
    const winners = [
      { source: high, module: "extremeTickets" as GamificationModuleId, prize: config.extremeTickets.highPrize || "Maior cota", value: 0 },
      { source: low, module: "extremeTickets" as GamificationModuleId, prize: config.extremeTickets.lowPrize || "Menor cota", value: 0 }
    ].map(item => {
      let winner = gamificationWinners.find(existing => existing.tenant_id === raffle.tenant_id && existing.raffleId === raffle.id && existing.module === item.module && existing.prize === item.prize);
      if (!winner) {
        winner = {
          tenant_id: raffle.tenant_id,
          id: createPublicId("GWIN_"),
          raffleId: raffle.id,
          purchaseId: item.source.purchase.purchaseId,
          customerId: item.source.purchase.customer?.id,
          module: item.module,
          prize: item.prize,
          value: item.value,
          number: item.source.number,
          createdAt: now
        };
        gamificationWinners.push(winner);
      }
      return winner;
    });
    addGamificationLog(raffle.tenant_id, "EXTREME_TICKETS_CALCULATED", raffle.id);
    res.json({ winners });
  });

  app.get("/api/admin/raffles/:id/accounting", (req, res) => {
    const raffle = raffles.find(r => r.id === req.params.id && adminCanAccessTenant(req, r.tenant_id));
    if (!raffle) {
      res.status(404).json({ error: "Raffle not found" });
      return;
    }

    const rafflePurchases = purchases.filter(p => p.tenant_id === raffle.tenant_id && p.raffleId === raffle.id);
    const paidPurchases = rafflePurchases.filter(p => p.status === "paid");
    const pendingPurchases = rafflePurchases.filter(p => p.status === "pending");
    const customers = paidPurchases.reduce<Record<string, { id: string; name: string; phone: string; city: string; tickets: number; amount: number; firstPurchaseAt: string; lastPurchaseAt: string }>>((acc, purchase) => {
      const key = purchase.customer?.id || purchase.contact;
      if (!acc[key]) {
        acc[key] = {
          id: key,
          name: purchase.customer?.name || `Cliente ${purchase.contact.slice(-4)}`,
          phone: purchase.contact,
          city: purchase.customer?.city || "",
          tickets: 0,
          amount: 0,
          firstPurchaseAt: purchase.createdAt,
          lastPurchaseAt: purchase.createdAt
        };
      }
      acc[key].tickets += purchase.tickets;
      acc[key].amount += purchase.amount;
      if (purchase.createdAt < acc[key].firstPurchaseAt) acc[key].firstPurchaseAt = purchase.createdAt;
      if (purchase.createdAt > acc[key].lastPurchaseAt) acc[key].lastPurchaseAt = purchase.createdAt;
      return acc;
    }, {});
    const purchaseIds = new Set(rafflePurchases.map(p => p.purchaseId));
    const raffleLootboxes = Object.values(lootboxes)
      .flatMap(item => item.boxes)
      .filter(box => purchaseIds.has(box.purchaseId));
    const raffleInstantPrizes = instantPrizes.filter(prize => prize.tenant_id === raffle.tenant_id && prize.raffleId === raffle.id);
    const claimedInstantPrizes = raffleInstantPrizes.filter(prize => prize.status === "claimed");

    const { soldNumbers, ...safeRaffle } = raffle;
    res.json({
      raffle: safeRaffle,
      pix: getRafflePixConfig(raffle),
      accounting: {
        grossRevenue: paidPurchases.reduce((sum, purchase) => sum + purchase.amount, 0),
        pendingRevenue: pendingPurchases.reduce((sum, purchase) => sum + purchase.amount, 0),
        paidPurchases: paidPurchases.length,
        pendingPurchases: pendingPurchases.length,
        soldTickets: paidPurchases.reduce((sum, purchase) => sum + purchase.tickets, 0),
        reservedTickets: pendingPurchases.reduce((sum, purchase) => sum + purchase.tickets, 0),
        uniqueBuyers: Object.keys(customers).length,
        averageTicket: paidPurchases.length ? paidPurchases.reduce((sum, purchase) => sum + purchase.amount, 0) / paidPurchases.length : 0,
        instantPrizeLiability: raffleInstantPrizes.reduce((sum, prize) => sum + prize.valorPremio, 0),
        instantPrizePaid: claimedInstantPrizes.reduce((sum, prize) => sum + prize.valorPremio, 0),
        lootboxesGenerated: raffleLootboxes.length,
        lootboxesOpened: raffleLootboxes.filter(box => box.status === "opened").length
      },
      purchases: rafflePurchases.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      buyers: Object.values(customers).sort((a, b) => b.tickets - a.tickets),
      instantPrizes: raffleInstantPrizes,
      lootboxes: raffleLootboxes
    });
  });

  app.put("/api/admin/purchases/:purchaseId", (req, res) => {
    const purchase = purchases.find(p => p.purchaseId === req.params.purchaseId && adminCanAccessTenant(req, p.tenant_id));
    if (!purchase) {
      res.status(404).json({ error: "Purchase not found" });
      return;
    }
    let reason = "";
    try {
      reason = requireAuditReason(req.body.reason);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Motivo obrigatorio" });
      return;
    }
    const before = deepClone(purchase);
    const customer = req.body.customerId ? Object.values(customersByPhone).find(c => c.tenant_id === purchase.tenant_id && c.id === req.body.customerId) : purchase.customer;
    if (req.body.customerId && !customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    purchase.status = req.body.status || purchase.status;
    purchase.amount = req.body.amount !== undefined ? Number(req.body.amount) : purchase.amount;
    if (customer) {
      purchase.customer = customer;
      purchase.contact = customer.phone;
    }
    recordAuditLedger(req, { tenant_id: purchase.tenant_id, action: "PURCHASE_UPDATED", resource_type: "purchase", resource_id: purchase.purchaseId, before_data: before, after_data: purchase, reason });
    res.json(purchase);
  });

  app.post("/api/admin/purchases/:purchaseId/approve", (req, res) => {
    const purchase = purchases.find(p => p.purchaseId === req.params.purchaseId && adminCanAccessTenant(req, p.tenant_id));
    if (!purchase) {
      res.status(404).json({ error: "Purchase not found" });
      return;
    }
    try {
      manuallyConfirmPurchasePayment(purchase, req, String(req.body?.reason || ""));
      recordAuditLedger(req, { tenant_id: purchase.tenant_id, action: "PAYMENT_MANUALLY_CONFIRMED", resource_type: "purchase", resource_id: purchase.purchaseId, before_data: null, after_data: purchase, reason: String(req.body?.reason || "") });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao alocar cotas para esta compra";
      res.status(message.includes("obrigatorio") ? 400 : 409).json({ error: message });
      return;
    }
    res.json(purchase);
  });

  app.post("/api/admin/orders/:orderId/manual-confirm-payment", (req, res) => {
    const purchase = purchases.find(p => p.purchaseId === req.params.orderId && adminCanAccessTenant(req, p.tenant_id));
    if (!purchase) {
      res.status(404).json({ error: "Pedido nao encontrado" });
      return;
    }
    try {
      const confirmed = manuallyConfirmPurchasePayment(purchase, req, String(req.body?.reason || ""));
      recordAuditLedger(req, { tenant_id: purchase.tenant_id, action: "PAYMENT_MANUALLY_CONFIRMED", resource_type: "purchase", resource_id: purchase.purchaseId, before_data: null, after_data: confirmed, reason: String(req.body?.reason || "") });
      res.json(stripSensitiveCustomerFields({ purchase: confirmed, audit: "Esta ação será auditada" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao confirmar pagamento manualmente";
      res.status(message.includes("obrigatorio") ? 400 : 409).json({ error: message });
    }
  });

  app.post("/api/admin/purchases/:purchaseId/reject", (req, res) => {
    const purchase = purchases.find(p => p.purchaseId === req.params.purchaseId && adminCanAccessTenant(req, p.tenant_id));
    if (!purchase) {
      res.status(404).json({ error: "Purchase not found" });
      return;
    }
    if (purchase.status === "paid") {
      res.status(409).json({ error: "Compra ja paga nao pode ser rejeitada" });
      return;
    }
    let reason = "";
    try {
      reason = requireAuditReason(req.body.reason);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Motivo obrigatorio" });
      return;
    }
    const before = deepClone(purchase);
    const raffle = raffles.find(item => item.tenant_id === purchase.tenant_id && item.id === purchase.raffleId);
    if (raffle && purchase.numeros.length) releaseReservedNumbers(raffle, purchase.numeros);
    purchase.status = "cancelled";
    purchase.rejectedReason = req.body.reason || "Rejeitada pelo admin";
    purchase.paymentHistory = [
      ...(purchase.paymentHistory || []),
      { status: "cancelled", label: "Pagamento PIX rejeitado", date: new Date().toISOString(), admin: true, reason }
    ];
    purchase.linkedPurchases?.forEach(linked => {
      const linkedRaffle = raffles.find(item => item.tenant_id === linked.tenant_id && item.id === linked.raffleId);
      if (linkedRaffle && linked.numeros.length) releaseReservedNumbers(linkedRaffle, linked.numeros);
      linked.status = "cancelled";
      linked.rejectedReason = purchase.rejectedReason;
      linked.paymentHistory = [
        ...(linked.paymentHistory || []),
        { status: "cancelled", label: "Pagamento PIX rejeitado", date: new Date().toISOString(), admin: true, reason }
      ];
    });
    recordAuditLedger(req, { tenant_id: purchase.tenant_id, action: "PURCHASE_CANCELLED", resource_type: "purchase", resource_id: purchase.purchaseId, before_data: before, after_data: purchase, reason });
    res.json(purchase);
  });

  app.get("/api/admin/tickets/search", (req, res) => {
    const raffleId = String(req.query.raffleId || "");
    const number = Number(req.query.number);
    const raffle = raffles.find(r => r.id === raffleId && adminCanAccessTenant(req, r.tenant_id));
    if (!raffle || !Number.isInteger(number)) {
      res.status(400).json({ error: "Informe rifa e numero validos" });
      return;
    }

    const purchase = purchases.find(p => p.tenant_id === raffle.tenant_id && p.raffleId === raffleId && p.numeros.includes(number));
    if (!purchase) {
      res.json({ status: "available", raffleId, number, raffle: sanitizeRaffleForAdmin(raffle) });
      return;
    }
    res.json({
      status: purchase.status === "paid" ? "sold" : "reserved",
      raffleId,
      number,
      raffle: sanitizeRaffleForAdmin(raffle),
      purchase,
      customer: purchase.customer
    });
  });

  const provablyFairAlgorithmVersion = "rifapro-provably-fair-v2-sha256-mod";

  function getEligibleDrawNumbers(raffle: typeof raffles[number]) {
    return purchases
      .filter(purchase => purchase.tenant_id === raffle.tenant_id && purchase.raffleId === raffle.id && purchase.status === "paid")
      .flatMap(purchase => purchase.numeros)
      .filter(number => Number.isInteger(number) && number >= 1 && number <= raffle.totalTickets)
      .sort((a, b) => a - b);
  }

  function hashJson(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  function computeProvablyFairDraw(input: { serverSeed: string; publicSeed: string; raffleId: string; timestamp: string; nonce: number; eligibleNumbers: number[] }) {
    if (!input.eligibleNumbers.length) throw new Error("Lista elegivel vazia");
    const base = `${input.serverSeed}:${input.publicSeed}:${input.raffleId}:${input.timestamp}:${input.nonce}`;
    const digest = createHash("sha256").update(base).digest("hex");
    const index = Number(BigInt(`0x${digest}`) % BigInt(input.eligibleNumbers.length));
    const winningNumber = input.eligibleNumbers[index];
    return {
      base,
      random_hash: digest,
      selected_index: index,
      winning_number: winningNumber,
      result_hash: createHash("sha256").update(JSON.stringify({
        algorithm_version: provablyFairAlgorithmVersion,
        random_hash: digest,
        selected_index: index,
        winning_number: winningNumber,
        eligible_numbers_hash: hashJson(input.eligibleNumbers)
      })).digest("hex")
    };
  }

  function buildDrawCertificate(audit: RaffleDrawAuditRecord) {
    const certificate = [
      "CIFHER Plataforma - Certificado de Sorteio Auditavel",
      `raffle_id=${audit.raffle_id}`,
      `server_seed_hash=${audit.server_seed_hash}`,
      `server_seed_revealed=${audit.server_seed_revealed || "nao_revelada"}`,
      `public_seed=${audit.public_seed}`,
      `nonce=${audit.nonce ?? 0}`,
      `eligible_numbers_hash=${audit.eligible_numbers_hash}`,
      `winning_number=${audit.winning_number}`,
      `algorithm_version=${audit.algorithm_version}`,
      `result_hash=${audit.result_hash}`,
      `published_at=${audit.published_at || ""}`
    ].join("\n");
    return `data:application/pdf;base64,${Buffer.from(certificate, "utf8").toString("base64")}`;
  }

  function sanitizeDrawAuditForPublic(audit: RaffleDrawAuditRecord) {
    const revealed = ["executed", "published"].includes(audit.status || "") && Boolean(audit.server_seed_revealed);
    const safe: RaffleDrawAuditRecord = {
      ...audit,
      server_seed_secret: undefined,
      server_seed_revealed: revealed ? audit.server_seed_revealed : "",
      eligible_numbers: undefined,
      verification_payload: revealed ? audit.verification_payload : {
        algorithm_version: audit.algorithm_version,
        status: audit.status,
        nonce: audit.nonce,
        eligible_numbers_hash: audit.eligible_numbers_hash
      }
    };
    return safe;
  }

  function ensureDrawAuditPrepared(req: express.Request, raffle: typeof raffles[number]) {
    const existing = raffleDrawAudits.find(item => item.tenant_id === raffle.tenant_id && item.raffle_id === raffle.id);
    if (existing) return existing;
    if (!tenantHasFeature(raffle.tenant_id, "provably_fair")) throw new Error("Plano atual nao libera sorteio provably fair");
    const eligibleNumbers = getEligibleDrawNumbers(raffle);
    if (!eligibleNumbers.length) throw new Error("Nao ha cotas pagas elegiveis para travar");
    const serverSeed = randomBytes(32).toString("hex");
    const publicSeed = String((req.body && (req.body.publicSeed || req.body.public_seed)) || `rifapro-public-${raffle.id}-${new Date().toISOString()}`);
    const now = new Date().toISOString();
    const record: RaffleDrawAuditRecord = {
      id: createPublicId("RDA_"),
      tenant_id: raffle.tenant_id,
      raffle_id: raffle.id,
      status: "locked",
      draw_method: "provably_fair_sha256",
      public_seed: publicSeed,
      server_seed_secret: serverSeed,
      server_seed_hash: createHash("sha256").update(serverSeed).digest("hex"),
      server_seed_revealed: "",
      external_reference: req.body?.externalReference || req.body?.external_reference || "",
      eligible_numbers_hash: hashJson(eligibleNumbers),
      eligible_numbers: eligibleNumbers,
      locked_at: now,
      scheduled_at: String(req.body?.scheduledAt || req.body?.scheduled_at || raffle.drawDate || now),
      nonce: Number.isInteger(Number(req.body?.nonce)) ? Number(req.body.nonce) : 1,
      winning_number: "",
      algorithm_version: provablyFairAlgorithmVersion,
      result_hash: "",
      audit_pdf_url: "",
      created_at: now
    };
    raffleDrawAudits.unshift(record);
    recordAuditLedger(req, {
      tenant_id: raffle.tenant_id,
      action: "RAFFLE_DRAW_PARTICIPANTS_LOCKED",
      resource_type: "raffle_draw_audit",
      resource_id: record.id,
      before_data: null,
      after_data: { ...record, server_seed_secret: undefined, eligible_numbers: undefined },
      reason: "Participantes elegiveis travados antes do sorteio"
    });
    return record;
  }

  function assertRaffleNotDrawLocked(tenantId: string, raffleId: string) {
    const audit = raffleDrawAudits.find(item => item.tenant_id === tenantId && item.raffle_id === raffleId && ["locked", "executed", "published"].includes(item.status || ""));
    if (audit) throw new Error("Cotas bloqueadas: participantes elegiveis ja foram travados para o sorteio auditavel");
  }

  function executeProvablyFairDraw(req: express.Request, raffle: typeof raffles[number]) {
    const audit = ensureDrawAuditPrepared(req, raffle);
    if (audit.status === "published" || audit.status === "executed") return audit;
    const serverSeed = audit.server_seed_secret;
    if (!serverSeed) throw new Error("Server seed secreto indisponivel");
    const eligibleNumbers = audit.eligible_numbers?.length ? audit.eligible_numbers : getEligibleDrawNumbers(raffle);
    const currentHash = hashJson(eligibleNumbers);
    if (currentHash !== audit.eligible_numbers_hash) throw new Error("Lista elegivel diverge do hash travado");
    const executedAt = new Date().toISOString();
    const result = computeProvablyFairDraw({
      serverSeed,
      publicSeed: audit.public_seed,
      raffleId: raffle.id,
      timestamp: executedAt,
      nonce: audit.nonce || 1,
      eligibleNumbers
    });
    audit.status = "executed";
    audit.server_seed_revealed = serverSeed;
    audit.winning_number = String(result.winning_number);
    audit.executed_at = executedAt;
    audit.result_hash = result.result_hash;
    audit.verification_payload = {
      algorithm_version: audit.algorithm_version,
      raffle_id: raffle.id,
      public_seed: audit.public_seed,
      server_seed: serverSeed,
      server_seed_hash: audit.server_seed_hash,
      timestamp: executedAt,
      nonce: audit.nonce || 1,
      eligible_numbers_hash: audit.eligible_numbers_hash,
      eligible_numbers: eligibleNumbers,
      random_hash: result.random_hash,
      selected_index: result.selected_index,
      winning_number: result.winning_number,
      result_hash: result.result_hash
    };
    audit.audit_pdf_url = buildDrawCertificate(audit);
    recordAuditLedger(req, {
      tenant_id: raffle.tenant_id,
      action: "RAFFLE_DRAW_PROVABLY_FAIR_EXECUTED",
      resource_type: "raffle_draw_audit",
      resource_id: audit.id,
      before_data: { status: "locked", server_seed_hash: audit.server_seed_hash },
      after_data: sanitizeDrawAuditForPublic(audit),
      reason: "Sorteio deterministico executado com seed revelada"
    });
    return audit;
  }

  function createRaffleDrawAudit(req: express.Request, raffle: typeof raffles[number], winningNumber: number, method = "manual_admin") {
    const existing = raffleDrawAudits.find(item => item.tenant_id === raffle.tenant_id && item.raffle_id === raffle.id);
    if (existing) return existing;
    const eligibleNumbers = purchases
      .filter(purchase => purchase.tenant_id === raffle.tenant_id && purchase.raffleId === raffle.id && purchase.status === "paid")
      .flatMap(purchase => purchase.numeros)
      .sort((a, b) => a - b);
    const publicSeed = String((req.body && (req.body.publicSeed || req.body.public_seed)) || new Date().toISOString());
    const serverSeed = randomUUID();
    const serverSeedHash = createHash("sha256").update(serverSeed).digest("hex");
    const eligibleHash = createHash("sha256").update(JSON.stringify(eligibleNumbers)).digest("hex");
    const resultHash = createHash("sha256").update(JSON.stringify({ raffleId: raffle.id, publicSeed, serverSeed, winningNumber, eligibleHash })).digest("hex");
    const record: RaffleDrawAuditRecord = {
      id: createPublicId("RDA_"),
      tenant_id: raffle.tenant_id,
      raffle_id: raffle.id,
      draw_method: method,
      public_seed: publicSeed,
      server_seed_hash: serverSeedHash,
      server_seed_revealed: serverSeed,
      external_reference: req.body?.externalReference || req.body?.external_reference || "",
      eligible_numbers_hash: eligibleHash,
      winning_number: String(winningNumber),
      algorithm_version: "rifapro-provably-fair-v1",
      result_hash: resultHash,
      audit_pdf_url: "",
      created_at: new Date().toISOString()
    };
    raffleDrawAudits.unshift(record);
    recordAuditLedger(req, { tenant_id: raffle.tenant_id, action: "RAFFLE_DRAW_AUDIT_CREATED", resource_type: "raffle", resource_id: raffle.id, before_data: { serverSeedHash }, after_data: record, reason: "Sorteio auditavel executado" });
    return record;
  }

  app.post("/api/admin/raffles/:id/draw/prepare", (req, res) => {
    const raffle = raffles.find(r => r.id === req.params.id && adminCanAccessTenant(req, r.tenant_id));
    if (!raffle) {
      res.status(400).json({ error: "Informe sorteio e cota validos" });
      return;
    }
    try {
      const audit = ensureDrawAuditPrepared(req, raffle);
      res.json({ drawAudit: { ...sanitizeDrawAuditForPublic(audit), eligible_count: audit.eligible_numbers?.length || 0 }, message: "Participantes travados e hash publicado." });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Nao foi possivel preparar sorteio" });
    }
  });

  app.post("/api/admin/raffles/:id/draw/publish", (req, res) => {
    const raffle = raffles.find(r => r.id === req.params.id && adminCanAccessTenant(req, r.tenant_id));
    const audit = raffle ? raffleDrawAudits.find(item => item.tenant_id === raffle.tenant_id && item.raffle_id === raffle.id) : null;
    if (!raffle || !audit) {
      res.status(404).json({ error: "Auditoria de sorteio nao encontrada" });
      return;
    }
    if (audit.status !== "executed" && audit.status !== "published") {
      res.status(409).json({ error: "Execute o sorteio antes de publicar" });
      return;
    }
    audit.status = "published";
    audit.published_at = audit.published_at || new Date().toISOString();
    audit.audit_pdf_url = audit.audit_pdf_url || buildDrawCertificate(audit);
    recordAuditLedger(req, { tenant_id: raffle.tenant_id, action: "RAFFLE_DRAW_RESULT_PUBLISHED", resource_type: "raffle_draw_audit", resource_id: audit.id, before_data: { status: "executed" }, after_data: sanitizeDrawAuditForPublic(audit), reason: "Resultado provably fair publicado" });
    res.json({ drawAudit: sanitizeDrawAuditForPublic(audit), certificateUrl: audit.audit_pdf_url });
  });

  app.post("/api/admin/raffles/:id/draw/certificate", (req, res) => {
    const raffle = raffles.find(r => r.id === req.params.id && adminCanAccessTenant(req, r.tenant_id));
    const audit = raffle ? raffleDrawAudits.find(item => item.tenant_id === raffle.tenant_id && item.raffle_id === raffle.id) : null;
    if (!raffle || !audit || !audit.server_seed_revealed) {
      res.status(404).json({ error: "Certificado indisponivel" });
      return;
    }
    audit.audit_pdf_url = buildDrawCertificate(audit);
    recordAuditLedger(req, { tenant_id: raffle.tenant_id, action: "RAFFLE_DRAW_CERTIFICATE_GENERATED", resource_type: "raffle_draw_audit", resource_id: audit.id, before_data: null, after_data: { audit_pdf_url: audit.audit_pdf_url }, reason: "Certificado publico gerado" });
    res.json({ certificateUrl: audit.audit_pdf_url, drawAudit: sanitizeDrawAuditForPublic(audit) });
  });

  app.post("/api/admin/raffles/:id/draw", (req, res) => {
    const raffle = raffles.find(r => r.id === req.params.id && adminCanAccessTenant(req, r.tenant_id));
    if (!raffle) {
      res.status(400).json({ error: "Informe sorteio e cota validos" });
      return;
    }
    let drawAudit: RaffleDrawAuditRecord;
    try {
      drawAudit = executeProvablyFairDraw(req, raffle);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao realizar sorteio provably fair" });
      return;
    }
    const number = Number(drawAudit.winning_number);
    const purchase = purchases.find(p => p.tenant_id === raffle.tenant_id && p.raffleId === raffle.id && p.numeros.includes(number));
    if (!purchase) {
      res.json({
        status: "available",
        number,
        raffle: sanitizeRaffleForAdmin(raffle),
        drawAudit: sanitizeDrawAuditForPublic(drawAudit),
        message: "Cota disponivel. Sorteio sem comprador para este numero."
      });
      return;
    }
    recordSecurityEvent({ tenant_id: raffle.tenant_id, action: "DRAW_EXECUTED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "medium", actor: getAuthSession(req)?.email, detail: `${raffle.id}:${number}` });
    res.json({
      status: purchase.status === "paid" ? "winner" : "reserved",
      number,
      drawAudit: sanitizeDrawAuditForPublic(drawAudit),
      raffle: sanitizeRaffleForAdmin(raffle),
      purchase,
      customer: purchase.customer,
      customerProfile: purchase.customer ? buildAdminCustomerProfile(purchase.customer) : null,
      message: purchase.status === "paid" ? "Cota contemplada encontrada." : "Cota reservada, pagamento ainda nao aprovado."
    });
  });

  app.get("/api/public/raffles/:raffleId/draw-audit", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const audit = raffleDrawAudits.find(item => item.tenant_id === tenantId && item.raffle_id === req.params.raffleId);
    if (!audit) return res.status(404).json({ error: "Auditoria de sorteio nao encontrada" });
    res.json(sanitizeDrawAuditForPublic(audit));
  });

  app.post("/api/public/raffles/:raffleId/draw-audit/verify", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const audit = raffleDrawAudits.find(item => item.tenant_id === tenantId && item.raffle_id === req.params.raffleId);
    if (!audit || !audit.server_seed_revealed || !audit.verification_payload) {
      res.status(404).json({ error: "Prova publica indisponivel" });
      return;
    }
    const payload = audit.verification_payload as Record<string, unknown>;
    const eligibleNumbers = Array.isArray(payload.eligible_numbers) ? payload.eligible_numbers.map(Number) : [];
    const recomputed = computeProvablyFairDraw({
      serverSeed: String(payload.server_seed || ""),
      publicSeed: String(payload.public_seed || ""),
      raffleId: String(payload.raffle_id || audit.raffle_id),
      timestamp: String(payload.timestamp || audit.executed_at || ""),
      nonce: Number(payload.nonce || audit.nonce || 1),
      eligibleNumbers
    });
    const seedHashOk = createHash("sha256").update(String(payload.server_seed || "")).digest("hex") === audit.server_seed_hash;
    const eligibleHashOk = hashJson(eligibleNumbers) === audit.eligible_numbers_hash;
    const resultOk = String(recomputed.winning_number) === audit.winning_number && recomputed.result_hash === audit.result_hash;
    res.json({
      verified: seedHashOk && eligibleHashOk && resultOk,
      seedHashOk,
      eligibleHashOk,
      resultOk,
      recomputed,
      expected: {
        server_seed_hash: audit.server_seed_hash,
        eligible_numbers_hash: audit.eligible_numbers_hash,
        winning_number: audit.winning_number,
        result_hash: audit.result_hash
      }
    });
  });

  app.get("/api/admin/raffles/:raffleId/draw-audit", (req, res) => {
    const audit = raffleDrawAudits.find(item => item.raffle_id === req.params.raffleId && adminCanAccessTenant(req, item.tenant_id));
    if (!audit) return res.status(404).json({ error: "Auditoria de sorteio nao encontrada" });
    res.json({ ...audit, server_seed_secret: audit.status === "locked" ? undefined : audit.server_seed_secret });
  });

  app.post("/api/admin/tickets/assign", (req, res) => {
    const raffle = raffles.find(r => r.id === req.body.raffleId && adminCanAccessTenant(req, r.tenant_id));
    const number = Number(req.body.number);
    const customer = Object.values(customersByPhone).find(c => c.id === req.body.customerId && raffle && c.tenant_id === raffle.tenant_id);
    if (!raffle || !Number.isInteger(number) || number < 1 || number > raffle.totalTickets || !customer) {
      res.status(400).json({ error: "Rifa, cota ou cliente invalido" });
      return;
    }
    try {
      assertRaffleNotDrawLocked(raffle.tenant_id, raffle.id);
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Cotas bloqueadas apos lock do sorteio" });
      return;
    }

    const status = req.body.status === "paid" ? "paid" : "pending";
    const pixConfig = getRafflePixConfig(raffle);
    if (status !== "paid" && !pixConfig.enabled) {
      res.status(503).json({ error: "PIX temporariamente desabilitado para este sorteio" });
      return;
    }
    let purchase = purchases.find(p => p.tenant_id === raffle.tenant_id && p.raffleId === raffle.id && p.numeros.includes(number));
    if (!purchase && raffle.soldNumbers.has(number)) {
      res.status(409).json({ error: "Cota ja reservada" });
      return;
    }
    if (purchase?.customer && purchase.customer.id !== customer.id) {
      res.status(409).json({ error: "Cota vinculada a outro cliente. Use a ficha do cliente para transferir apenas esta cota." });
      return;
    }

    if (!purchase) {
      raffle.soldNumbers.add(number);
      raffle.soldTickets += 1;
      purchase = {
        tenant_id: raffle.tenant_id,
        purchaseId: createPublicId("ADM_"),
        raffleId: raffle.id,
        contact: customer.phone,
        tickets: 1,
        amount: raffle.price,
        status,
        numeros: [number],
        pixPayload: status === "paid" ? "ADMIN_PAID" : buildPixPayload(raffle.price, raffle, createPublicId("ADMPIX_")),
        pixGateway: pixConfig.gateway,
        pixWebhookUrl: pixConfig.webhookUrl,
        createdAt: new Date().toISOString(),
        customer
      };
      purchases.push(purchase);
    } else {
      purchase.customer = customer;
      purchase.contact = customer.phone;
      purchase.status = status;
      purchase.amount = req.body.amount !== undefined ? Number(req.body.amount) : purchase.amount;
    }

    if (status === "paid") {
      recalculateCustomerPaidTickets(customer);
      ensureAffiliateForCustomer(customer, { forceEnable: true, source: "affiliate_auto_first_paid_purchase" });
    }

    res.json({ status: status === "paid" ? "sold" : "reserved", purchase, customer });
  });

  function parseTicketNumbers(input: unknown) {
    return Array.from(new Set((Array.isArray(input) ? input : String(input || "").split(/[,\s]+/))
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value > 0)));
  }

  function assertTicketsAvailable(tenantId: string, raffleId: string, numbers: number[], ignorePurchaseId?: string) {
    const duplicated = purchases.find(purchase =>
      purchase.tenant_id === tenantId &&
      purchase.raffleId === raffleId &&
      purchase.purchaseId !== ignorePurchaseId &&
      purchase.status !== "cancelled" &&
      purchase.numeros.some(number => numbers.includes(number))
    );
    if (duplicated) throw new Error("Cota ja vinculada a outro pedido do tenant");
  }

  function recordTicketAdjustment(req: express.Request, purchase: PurchaseRecord, type: TicketAdjustmentRecord["adjustment_type"], oldNumbers: number[], newNumbers: number[], reason: string, financialImpact: number) {
    const adjustment: TicketAdjustmentRecord = {
      id: createPublicId("TAD_"),
      tenant_id: purchase.tenant_id,
      order_id: purchase.purchaseId,
      customer_id: purchase.customer?.id,
      raffle_id: purchase.raffleId,
      adjustment_type: type,
      old_numbers: oldNumbers,
      new_numbers: newNumbers,
      reason,
      financial_impact: financialImpact,
      actor_user_id: getAuthSession(req)?.sub || "system",
      created_at: new Date().toISOString()
    };
    ticketAdjustments.unshift(adjustment);
    const recentAdjustments = ticketAdjustments.filter(item => item.tenant_id === purchase.tenant_id && item.customer_id === purchase.customer?.id && new Date(item.created_at).getTime() >= Date.now() - 7 * 86400000).length;
    if (recentAdjustments >= 3) {
      createFraudEvent({ tenant_id: purchase.tenant_id, customer_id: purchase.customer?.id, order_id: purchase.purchaseId, signal_type: "muitas_alteracoes_cotas", score: Math.min(95, 45 + recentAdjustments * 10), metadata: { recentAdjustments, adjustment_type: type } });
    }
    recordAuditLedger(req, {
      tenant_id: purchase.tenant_id,
      action: `TICKET_${type.toUpperCase()}`,
      resource_type: "purchase",
      resource_id: purchase.purchaseId,
      before_data: { numeros: oldNumbers, amount: purchase.amount },
      after_data: { numeros: newNumbers, financialImpact },
      reason
    });
    if (financialImpact !== 0) {
      appendWalletLedger(req, {
        tenant_id: purchase.tenant_id,
        customer_id: purchase.customer?.id,
        source_type: "ticket_adjustment",
        source_id: adjustment.id,
        amount: financialImpact,
        reason
      });
    }
    return adjustment;
  }

  app.post("/api/admin/purchases/:purchaseId/tickets/adjust", (req, res) => {
    const purchase = purchases.find(p => p.purchaseId === req.params.purchaseId && adminCanAccessTenant(req, p.tenant_id));
    if (!purchase) {
      res.status(404).json({ error: "Pedido nao encontrado" });
      return;
    }
    const raffle = raffles.find(item => item.tenant_id === purchase.tenant_id && item.id === purchase.raffleId);
    if (!raffle) {
      res.status(404).json({ error: "Rifa nao encontrada" });
      return;
    }
    if (raffle.status !== "active" && !req.body.overrideClosed) {
      res.status(409).json({ error: "Rifa encerrada bloqueia alteracao de cotas por padrao" });
      return;
    }
    if (raffleDrawAudits.some(item => item.tenant_id === purchase.tenant_id && item.raffle_id === purchase.raffleId)) {
      res.status(409).json({ error: "Sorteio ja realizado bloqueia alteracao de cotas" });
      return;
    }
    let reason = "";
    try {
      reason = requireAuditReason(req.body.reason);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Motivo obrigatorio" });
      return;
    }
    if (req.body.confirmation !== "CONFIRMAR AJUSTE") {
      res.status(400).json({ error: "Confirmacao dupla obrigatoria" });
      return;
    }
    const type = String(req.body.adjustmentType || req.body.adjustment_type || "swap") as TicketAdjustmentRecord["adjustment_type"];
    const oldNumbers = [...purchase.numeros];
    const requested = parseTicketNumbers(req.body.numbers ?? req.body.newNumbers);
    let nextNumbers = oldNumbers;
    if (type === "add") nextNumbers = Array.from(new Set([...oldNumbers, ...requested]));
    if (type === "remove") nextNumbers = oldNumbers.filter(number => !requested.includes(number));
    if (type === "swap") nextNumbers = requested;
    if (type === "move") nextNumbers = oldNumbers.filter(number => !requested.includes(number));
    try {
      if (!nextNumbers.length) throw new Error("Pedido precisa manter ao menos uma cota");
      if (nextNumbers.some(number => number < 1 || number > raffle.totalTickets)) throw new Error("Cota fora do intervalo da rifa");
      assertTicketsAvailable(purchase.tenant_id, purchase.raffleId, nextNumbers, purchase.purchaseId);
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Ajuste invalido" });
      return;
    }
    oldNumbers.forEach(number => raffle.soldNumbers.delete(number));
    nextNumbers.forEach(number => raffle.soldNumbers.add(number));
    raffle.soldTickets = raffle.soldNumbers.size;
    purchase.numeros = nextNumbers;
    purchase.tickets = nextNumbers.length;
    const financialImpact = purchase.status === "paid" ? Number(((nextNumbers.length - oldNumbers.length) * raffle.price).toFixed(2)) : 0;
    const adjustment = recordTicketAdjustment(req, purchase, type, oldNumbers, nextNumbers, reason, financialImpact);
    if (purchase.customer) recalculateCustomerPaidTickets(purchase.customer);
    res.json({ purchase, adjustment, ticketUrl: `/api/tickets/${purchase.purchaseId}`, whatsappQueued: Boolean(purchase.customer?.phone) });
  });

  app.post("/api/admin/purchases/:purchaseId/tickets/resend-whatsapp", (req, res) => {
    const purchase = purchases.find(p => p.purchaseId === req.params.purchaseId && adminCanAccessTenant(req, p.tenant_id));
    if (!purchase || !purchase.customer) {
      res.status(404).json({ error: "Pedido nao encontrado" });
      return;
    }
    let reason = "";
    try {
      reason = requireAuditReason(req.body.reason || "Reenvio de bilhete solicitado pelo admin");
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Motivo obrigatorio" });
      return;
    }
    enqueueWhatsAppTicketConfirmation(purchase);
    recordAuditLedger(req, { tenant_id: purchase.tenant_id, action: "TICKET_WHATSAPP_RESENT", resource_type: "purchase", resource_id: purchase.purchaseId, before_data: null, after_data: { phone: maskPhone(purchase.customer.phone) }, reason });
    res.json({ success: true, purchaseId: purchase.purchaseId });
  });

  // Admin: Stories CRUD
  app.post("/api/admin/stories", (req, res) => {
    const newStory = { id: createPublicId("S_"), ...normalizeMediaPayload(req.body), tenant_id: resolveRequestTenantId(req) };
    stories.push(newStory);
    res.json(newStory);
  });
  app.put("/api/admin/stories/:id", (req, res) => {
    const index = stories.findIndex(s => s.id === req.params.id && adminCanAccessTenant(req, s.tenant_id));
    if (index !== -1) {
      stories[index] = { ...stories[index], ...normalizeMediaPayload(req.body), tenant_id: stories[index].tenant_id };
      res.json(stories[index]);
    } else {
      res.status(404).json({ error: "Story not found" });
    }
  });
  app.delete("/api/admin/stories/:id", (req, res) => {
    stories = stories.filter(s => s.id !== req.params.id || !adminCanAccessTenant(req, s.tenant_id));
    res.json({ success: true });
  });

  // Admin: Raffles CRUD
  app.get("/api/admin/raffles", (req, res) => {
    res.json(scoped(raffles, req).map(sanitizeRaffleForAdmin));
  });

  app.post("/api/admin/raffles", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const plan = getTenantPlan(tenantId);
    const currentRaffles = raffles.filter(raffle => raffle.tenant_id === tenantId).length;
    if (currentRaffles >= plan.limite_rifas) {
      res.status(403).json({ error: `Plano ${plan.nome} permite ate ${plan.limite_rifas} rifa(s)` });
      return;
    }
    const newRaffle = {
      id: createPublicId("R_"),
      soldNumbers: new Set<number>(),
      soldTickets: 0,
      ...normalizeMediaPayload(req.body),
      tenant_id: tenantId,
      ...normalizeRaffleCountdownPayload(req.body),
      manuallyClosedAt: req.body.status && req.body.status !== "active" ? new Date().toISOString() : "",
      pixConfig: { ...getDefaultRafflePixConfig(), ...(req.body.pixConfig || {}) },
      videoConfig: { ...settings.mainVideoPlayer, ...(req.body.videoConfig || {}) },
      n8nEnabled: Boolean(req.body.n8nEnabled),
      lootboxEnabled: req.body.lootboxEnabled !== undefined ? Boolean(req.body.lootboxEnabled) : true,
      lootboxConfig: createScopedLootboxConfig(req.body.lootboxConfig)
    };
    raffles.push(newRaffle);
    recordSecurityEvent({ tenant_id: newRaffle.tenant_id, action: "RAFFLE_CREATED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", actor: getAuthSession(req)?.email, detail: newRaffle.id });
    if (settings.n8nIntegration?.sendNewRaffleBroadcast && isRaffleN8nEnabled(newRaffle)) {
      queueN8nEvent("raffle.created", {
        raffle: sanitizeRaffleForAdmin(newRaffle),
        audience: getRaffleAudience(req.body.previousRaffleId, settings.n8nIntegration.defaultAudience, newRaffle.tenant_id),
        message: {
          whatsapp: `Nova rifa disponível: ${newRaffle.title}. Acesse a plataforma para participar.`,
          emailSubject: `Nova rifa: ${newRaffle.title}`,
          emailBody: `Nova campanha disponível: ${newRaffle.title}.`
        }
      }, { target: settings.n8nIntegration.defaultAudience, tenantId: newRaffle.tenant_id });
    }
    res.json(sanitizeRaffleForAdmin(newRaffle));
  });
  app.put("/api/admin/raffles/:id", (req, res) => {
    const index = raffles.findIndex(r => r.id === req.params.id && adminCanAccessTenant(req, r.tenant_id));
    if (index !== -1) {
      const currentSoldNumbers = raffles[index].soldNumbers;
      const nextCountdown = normalizeRaffleCountdownPayload(req.body, raffles[index]);
      const statusChangedToClosed = req.body.status !== undefined && req.body.status !== "active" && raffles[index].status === "active";
      const statusChangedToActive = req.body.status === "active";
      raffles[index] = {
        ...raffles[index],
        ...normalizeMediaPayload(req.body),
        tenant_id: raffles[index].tenant_id,
        ...nextCountdown,
        manuallyClosedAt: statusChangedToActive ? "" : statusChangedToClosed ? new Date().toISOString() : raffles[index].manuallyClosedAt,
        pixConfig: { ...getDefaultRafflePixConfig(), ...(raffles[index].pixConfig || {}), ...(req.body.pixConfig || {}) },
        videoConfig: { ...settings.mainVideoPlayer, ...(raffles[index].videoConfig || {}), ...(req.body.videoConfig || {}) },
        n8nEnabled: req.body.n8nEnabled !== undefined ? Boolean(req.body.n8nEnabled) : Boolean(raffles[index].n8nEnabled),
        lootboxEnabled: req.body.lootboxEnabled !== undefined ? Boolean(req.body.lootboxEnabled) : raffles[index].lootboxEnabled !== false,
        lootboxConfig: createScopedLootboxConfig(req.body.lootboxConfig || raffles[index].lootboxConfig),
        soldNumbers: currentSoldNumbers
      };
      recordSecurityEvent({ tenant_id: raffles[index].tenant_id, action: "RAFFLE_UPDATED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", actor: getAuthSession(req)?.email, detail: raffles[index].id });
      if (settings.n8nIntegration?.sendRaffleUpdateBroadcast && req.body.status === "active" && isRaffleN8nEnabled(raffles[index])) {
        queueN8nEvent("raffle.updated", {
          raffle: sanitizeRaffleForAdmin(raffles[index]),
          audience: getRaffleAudience(req.body.previousRaffleId || raffles[index].id, settings.n8nIntegration.defaultAudience, raffles[index].tenant_id),
          message: {
            whatsapp: `Atualização de rifa: ${raffles[index].title}. Confira as novidades na plataforma.`,
            emailSubject: `Atualização: ${raffles[index].title}`,
            emailBody: `A rifa ${raffles[index].title} recebeu uma atualização.`
          }
        }, { target: settings.n8nIntegration.defaultAudience, tenantId: raffles[index].tenant_id });
      }
      res.json(sanitizeRaffleForAdmin(raffles[index]));
    } else {
      res.status(404).json({ error: "Raffle not found" });
    }
  });
  app.delete("/api/admin/raffles/:id", (req, res) => {
    raffles = raffles.filter(r => r.id !== req.params.id || !adminCanAccessTenant(req, r.tenant_id));
    res.json({ success: true });
  });

  // Admin: Winners CRUD
  app.post("/api/admin/winners", (req, res) => {
    const newWinner = { id: createPublicId("W_"), ...normalizeMediaPayload(req.body), tenant_id: resolveRequestTenantId(req) };
    winners.push(newWinner);
    res.json(newWinner);
  });
  app.delete("/api/admin/winners/:id", (req, res) => {
    winners = winners.filter(w => w.id !== req.params.id || !adminCanAccessTenant(req, w.tenant_id));
    res.json({ success: true });
  });

  // Admin: Instant Prizes CRUD
  app.get("/api/admin/instant-prizes", (req, res) => {
     res.json(scoped(instantPrizes, req));
  });
  app.post("/api/admin/instant-prizes", (req, res) => {
    const prize = { id: createPublicId("P_"), status: "available", ...req.body, tenant_id: resolveRequestTenantId(req) };
    instantPrizes.push(prize);
    recordSecurityEvent({ tenant_id: prize.tenant_id, action: "PRIZE_CREATED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "medium", actor: getAuthSession(req)?.email, detail: prize.id });
    res.json(prize);
  });
  app.put("/api/admin/instant-prizes/:id", (req, res) => {
    const index = instantPrizes.findIndex(p => p.id === req.params.id && adminCanAccessTenant(req, p.tenant_id));
    if (index !== -1) {
      instantPrizes[index] = { ...instantPrizes[index], ...req.body, tenant_id: instantPrizes[index].tenant_id };
      recordSecurityEvent({ tenant_id: instantPrizes[index].tenant_id, action: "PRIZE_UPDATED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "medium", actor: getAuthSession(req)?.email, detail: instantPrizes[index].id });
      res.json(instantPrizes[index]);
    } else {
      res.status(404).json({ error: "Instant prize not found" });
    }
  });
  app.delete("/api/admin/instant-prizes/:id", (req, res) => {
    instantPrizes = instantPrizes.filter(p => p.id !== req.params.id || !adminCanAccessTenant(req, p.tenant_id));
    res.json({ success: true });
  });

  let gateways = {
    pix: {
      enabled: true,
      sandbox: true,
      apiKey: "",
      pixKey: "",
      webhookUrl: "http://127.0.0.1:3000/api/webhooks/payment/mercadopago",
      webhookSecret: "",
      webhookEvents: "payment.created,payment.updated,payment.paid"
    },
    active: 'mercadopago',
    mercadopago: { accessToken: '', publicKey: '', webhookUrl: '/api/webhooks/mercadopago', webhookSecret: '', environment: 'sandbox', expirationMinutes: '15', releaseStatus: 'approved' },
    pagbank: { token: '', apiKey: '', webhookUrl: '/api/webhooks/pagbank', webhookSecret: '', environment: 'sandbox', expirationMinutes: '15', releaseStatus: 'PAID' },
    asaas: { apiKey: '', webhookUrl: '', webhookSecret: '' },
    infinitypay: { token: '', apiKey: '', webhookUrl: '', webhookSecret: '' },
    pay2m: { clientId: '', clientSecret: '', webhookUrl: '/api/webhooks/pay2m', webhookSecret: '', environment: 'production', expirationTime: '1800', splitLink: '', releaseStatus: 'paid' },
    cora: { clientId: '', clientSecret: '', apiKey: '', webhookUrl: '', webhookSecret: '' },
    primepag: { clientId: '', clientSecret: '', apiKey: '', webhookUrl: '', webhookSecret: '' },
    paggue: { clientId: '', clientSecret: '', apiKey: '', webhookUrl: '', webhookSecret: '' },
    cashpay: { clientId: '', clientSecret: '', apiKey: '', webhookUrl: '', webhookSecret: '' },
    fakeprocessor: { apiKey: '', webhookUrl: '', webhookSecret: '' },
    sandbox: { apiKey: 'sandbox-only', webhookUrl: '', webhookSecret: '' },
    mock: { apiKey: 'mock-only', webhookUrl: '', webhookSecret: '' }
  };

  const tenantGateways: Record<string, typeof gateways> = {};
  const paymentGatewayConfigs: Record<string, PaymentGatewayConfigRecord[]> = {};

  function normalizePaymentProvider(provider: unknown): PixGatewayId {
    const value = String(provider || "mercadopago").trim().toLowerCase().replace(/[\s_-]+/g, "");
    const aliases: Record<string, PixGatewayId> = {
      mercadopago: "mercadopago",
      mp: "mercadopago",
      pagbank: "pagbank",
      asaas: "asaas",
      infinitypay: "infinitypay",
      pay2m: "pay2m",
      cora: "cora",
      primepag: "primepag",
      prime: "primepag",
      paggue: "paggue",
      cashpay: "cashpay",
      fkeprocessor: "fakeprocessor",
      fakeprocessor: "fakeprocessor",
      sandbox: "sandbox",
      mock: "mock"
    };
    return aliases[value] || "mercadopago";
  }

  function gatewayCredentialsFromLegacy(provider: PixGatewayId, tenantPixGateways: typeof gateways) {
    const gatewayConfig = (tenantPixGateways[provider] || {}) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(gatewayConfig).filter(([key, value]) => {
      return Boolean(value) && !["webhookUrl", "webhookSecret", "pixKey"].includes(key);
    }).map(([key, value]) => [key, decryptGatewaySecret(value)]));
  }

  function encryptLegacyGatewaysForStorage<T>(input: T): T {
    const cloned = deepClone(input) as Record<string, unknown>;
    for (const [sectionKey, sectionValue] of Object.entries(cloned)) {
      if (sectionValue && typeof sectionValue === "object" && !Array.isArray(sectionValue)) {
        const section = sectionValue as Record<string, unknown>;
        for (const [key, value] of Object.entries(section)) {
          if (value && gatewaySensitiveFieldPattern.test(key)) section[key] = encryptGatewaySecret(value);
        }
      }
    }
    return cloned as T;
  }

  function decryptLegacyGatewaysInMemory<T>(input: T): T {
    const target = input as Record<string, unknown>;
    for (const sectionValue of Object.values(target)) {
      if (sectionValue && typeof sectionValue === "object" && !Array.isArray(sectionValue)) {
        const section = sectionValue as Record<string, unknown>;
        for (const [key, value] of Object.entries(section)) {
          if (value && (gatewaySensitiveFieldPattern.test(key) || isEncryptedGatewayValue(value))) section[key] = decryptGatewaySecret(value);
        }
      }
    }
    return input;
  }

  function maskLegacyGatewaysForResponse<T>(input: T): T {
    const cloned = deepClone(input) as Record<string, unknown>;
    for (const sectionValue of Object.values(cloned)) {
      if (sectionValue && typeof sectionValue === "object" && !Array.isArray(sectionValue)) {
        const section = sectionValue as Record<string, unknown>;
        for (const [key, value] of Object.entries(section)) {
          if (value && gatewaySensitiveFieldPattern.test(key)) section[key] = maskGatewaySecret(value);
        }
      }
    }
    return cloned as T;
  }

  function configFromLegacyGateway(tenantId: string): PaymentGatewayConfigRecord {
    const tenantPixGateways = getTenantGateways(tenantId);
    const provider = normalizePaymentProvider(tenantPixGateways.active || "mercadopago");
    const gatewayConfig = (tenantPixGateways[provider] || {}) as Record<string, string>;
    const now = new Date().toISOString();
    return {
      id: `${tenantId}-${provider}-default`,
      tenant_id: tenantId,
      provider,
      display_name: provider,
      enabled: Boolean(tenantPixGateways.pix?.enabled),
      environment: tenantPixGateways.pix?.sandbox ? "sandbox" : "production",
      credentials: encryptGatewayCredentialObject(gatewayCredentialsFromLegacy(provider, tenantPixGateways)),
      webhook_secret: encryptGatewaySecret(tenantPixGateways.pix?.webhookSecret || gatewayConfig.webhookSecret || ""),
      pix_key: encryptGatewaySecret(tenantPixGateways.pix?.pixKey || gatewayConfig.pixKey || tenantPixGateways.pix?.apiKey || gatewayConfig.apiKey || ""),
      priority: 0,
      is_default: true,
      config_json: {
        userAgent: gatewayConfig.userAgent || "CIFHER Plataforma",
        releaseMode: gatewayConfig.releaseMode || "PAYMENT_RECEIVED",
        paymentMode: gatewayConfig.paymentMode || "pix_direct",
        orderExpirationMinutes: Number(gatewayConfig.orderExpirationMinutes || 15)
      },
      created_at: now,
      updated_at: now
    };
  }

  function mergeCredentialObjectPreservingMasked(current: Record<string, unknown> = {}, incoming: Record<string, unknown> = {}) {
    return Object.fromEntries(Object.entries(incoming).map(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return [key, mergeCredentialObjectPreservingMasked(current[key] as Record<string, unknown>, value as Record<string, unknown>)];
      }
      return [key, isMaskedGatewaySecret(value) ? current[key] : value];
    }));
  }

  function normalizePaymentGatewayConfig(tenantId: string, raw: Partial<PaymentGatewayConfigRecord>, fallbackDefault = false, current?: PaymentGatewayConfigRecord): PaymentGatewayConfigRecord {
    const provider = normalizePaymentProvider(raw.provider);
    const now = new Date().toISOString();
    const incomingCredentials = raw.credentials && typeof raw.credentials === "object" ? raw.credentials : {};
    const credentials = mergeCredentialObjectPreservingMasked(current?.credentials || {}, incomingCredentials);
    return {
      id: String(raw.id || `${tenantId}-${provider}-${createPublicId()}`),
      tenant_id: tenantId,
      provider,
      display_name: raw.display_name || provider,
      enabled: raw.enabled !== false,
      environment: raw.environment === "production" ? "production" : raw.environment === "mock" ? "mock" : "sandbox",
      credentials: encryptGatewayCredentialObject(credentials),
      webhook_secret: isMaskedGatewaySecret(raw.webhook_secret) ? (current?.webhook_secret || "") : encryptGatewaySecret(raw.webhook_secret || ""),
      pix_key: isMaskedGatewaySecret(raw.pix_key) ? (current?.pix_key || "") : encryptGatewaySecret(raw.pix_key || ""),
      priority: Number(raw.priority || 0),
      is_default: Boolean(raw.is_default || fallbackDefault),
      config_json: { ...(current?.config_json || {}), ...(raw.config_json || {}) },
      created_at: raw.created_at || now,
      updated_at: now
    };
  }

  function enforcePaymentGatewayPolicy(tenantId: string, preferredProvider?: PixGatewayId | string) {
    const configs = paymentGatewayConfigs[tenantId] || [];
    const preferred = preferredProvider ? normalizePaymentProvider(preferredProvider) : "";
    if (preferred) {
      configs.forEach(config => {
        if (normalizePaymentProvider(config.provider) === preferred) {
          config.enabled = true;
          config.priority = 0;
        }
      });
    }
    const enabled = configs
      .filter(config => config.enabled)
      .sort((a, b) => {
        if (preferred) {
          const aPreferred = normalizePaymentProvider(a.provider) === preferred;
          const bPreferred = normalizePaymentProvider(b.provider) === preferred;
          if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;
        }
        return Number(a.priority || 0) - Number(b.priority || 0);
      });
    configs.forEach(config => {
      config.is_default = false;
      config.config_json = { ...(config.config_json || {}) };
      delete config.config_json.gatewayPolicyError;
    });
    if (!enabled.length) return configs;
    enabled.forEach((config, index) => {
      config.priority = Number.isFinite(Number(config.priority)) ? Number(config.priority) : index * 100;
      if (index > 0 && config.priority <= enabled[index - 1].priority) config.priority = enabled[index - 1].priority + 100;
      config.config_json = {
        ...(config.config_json || {}),
        gatewayRole: index === 0 ? "primary" : "fallback",
        fallbackPriority: config.priority
      };
    });
    enabled[0].is_default = true;
    return configs;
  }

  function getPaymentGatewayConfigs(tenantId: string) {
    if (!paymentGatewayConfigs[tenantId]?.length) {
      paymentGatewayConfigs[tenantId] = [configFromLegacyGateway(tenantId)];
    }
    enforcePaymentGatewayPolicy(tenantId);
    return paymentGatewayConfigs[tenantId];
  }

  function getDefaultPaymentGatewayConfig(tenantId: string) {
    const configs = getPaymentGatewayConfigs(tenantId);
    const config = configs.find(config => config.is_default && config.enabled) || configs.find(config => config.enabled) || configFromLegacyGateway(tenantId);
    return decryptPaymentGatewayConfig(config);
  }

  function syncLegacyGatewaysFromConfigs(tenantId: string) {
    const tenantPixGateways = getTenantGateways(tenantId);
    const defaultConfig = getDefaultPaymentGatewayConfig(tenantId);
    const provider = normalizePaymentProvider(defaultConfig.provider);
    tenantPixGateways.active = provider;
    tenantPixGateways.pix = {
      ...tenantPixGateways.pix,
      enabled: defaultConfig.enabled,
      sandbox: defaultConfig.environment !== "production",
      webhookUrl: provider === "primepag" ? "/api/webhooks/primepag" : provider === "cora" ? "/api/webhooks/cora" : provider === "mercadopago" ? "/api/webhooks/mercadopago" : provider === "asaas" ? "/api/webhooks/asaas" : provider === "pay2m" ? "/api/webhooks/pay2m" : provider === "pagbank" ? "/api/webhooks/pagbank" : `http://127.0.0.1:3000/api/webhooks/payment/${provider}`,
      webhookSecret: defaultConfig.webhook_secret || tenantPixGateways.pix?.webhookSecret || "",
      apiKey: defaultConfig.pix_key || tenantPixGateways.pix?.apiKey || ""
    };
    (tenantPixGateways as unknown as Record<string, Record<string, string>>)[provider] = {
      ...(tenantPixGateways[provider] || {}),
      ...Object.fromEntries(Object.entries(defaultConfig.credentials || {}).map(([key, value]) => [key, String(value || "")])),
      ...Object.fromEntries(Object.entries(defaultConfig.config_json || {}).map(([key, value]) => [key, String(value || "")])),
      webhookSecret: defaultConfig.webhook_secret || "",
      webhookUrl: provider === "mercadopago" ? "/api/webhooks/mercadopago" : provider === "asaas" ? "/api/webhooks/asaas" : provider === "pay2m" ? "/api/webhooks/pay2m" : provider === "pagbank" ? "/api/webhooks/pagbank" : `http://127.0.0.1:3000/api/webhooks/payment/${provider}`
    };
    if (tenantId === legacyTenantId) gateways = tenantPixGateways;
  }

  function getTenantGateways(tenantId: string) {
    if (!tenantGateways[tenantId]) {
      tenantGateways[tenantId] = tenantId === legacyTenantId ? gateways : deepClone(gateways);
    }
    return decryptLegacyGatewaysInMemory(tenantGateways[tenantId]);
  }

  function serializePersistentValue(value: unknown) {
    return JSON.parse(JSON.stringify(value, (_key, item) => {
      if (item instanceof Set) return { __persistentType: "Set", values: [...item] };
      return item;
    }));
  }

  function revivePersistentValue(value: unknown): any {
    if (Array.isArray(value)) return value.map(revivePersistentValue);
    if (value && typeof value === "object") {
      const objectValue = value as Record<string, unknown>;
      if (objectValue.__persistentType === "Set") return new Set(Array.isArray(objectValue.values) ? objectValue.values : []);
      return Object.fromEntries(Object.entries(objectValue).map(([key, item]) => [key, revivePersistentValue(item)]));
    }
    return value;
  }

  function replaceArray<T>(target: T[], value: unknown) {
    target.splice(0, target.length, ...(Array.isArray(value) ? value as T[] : []));
  }

  function replaceObject<T extends Record<string, unknown>>(target: T, value: unknown) {
    Object.keys(target).forEach(key => delete target[key]);
    if (value && typeof value === "object") Object.assign(target, value);
  }

  function persistentCollections() {
    ensureFazendinhaConfigsForKnownTenants();
    return {
      tenants,
      authUsers,
      settings,
      tenantSettings,
      tenantBrandingSettings,
      tenantThemeTemplates,
      tenantFeatureOverrides,
      lootboxGuaranteedPool,
      lootboxGuaranteedPools,
      affiliates,
      customersByPhone,
      customersByCpf,
      crmContacts,
      crmContactOverrides,
      customerMessages,
      affiliateWithdrawals,
      passwordResetCodes,
      supportTickets,
      auditLogs,
      auditEventLedger,
      ticketAdjustments,
      walletLedger,
      raffleDrawAudits,
      reportExports,
      customerConsents,
      dataPrivacyRequests,
      fraudSignals,
      fraudScoreEvents,
      fraudCases,
      payments,
      paymentWebhookLogs,
      paymentLogs,
      webhookLogs,
      gatewayHealth,
      n8nEventLogs,
      integrations,
      integrationLogs,
      webhookEndpoints,
      webhookEvents,
      campaignCoupons,
      promotionRules,
      promotionUsages,
      lootboxes,
      raffles,
      purchases,
      gamificationConfigs,
      gamificationEvents,
      gamificationWinners,
      instantPrizes,
      stories,
      winners,
      fazendinhaConfigs,
      fazendinhaGroups,
      fazendinhaCompras,
      fazendinhaResultados,
      fazendinhaGanhadores,
      numberModeConfigs,
      numberModePurchases,
      numberModeBets,
      numberModeWinners,
      securityLogs,
      paymentQueue,
      payment_webhook_jobs,
      payment_reconciliation_jobs,
      payment_release_jobs,
      payment_dead_letter_queue,
      gateways: encryptLegacyGatewaysForStorage(gateways),
      tenantGateways: Object.fromEntries(Object.entries(tenantGateways).map(([tenantId, value]) => [tenantId, encryptLegacyGatewaysForStorage(value)])),
      paymentGatewayConfigs,
      tenantDomains,
      superadminImpersonationSessions,
      superadminAuditLogs,
      whatsappProviderConfigs,
      whatsappCloudConfigs,
      whatsappCloudLogs,
      whatsappCloudTemplates,
      whatsappPixRecoverySettings,
      whatsappPurchaseConfirmationSettings,
      whatsappCrmCampaigns,
      whatsappMessageQueue,
      whatsappContacts,
      whatsappConversations,
      whatsappConversationMessages,
      whatsappOptOutEvents,
      automationFlows,
      automationRuns,
      tenantApiKeys,
      publicActivityEvents
    };
  }

  function assignPersistentCollection(collection: string, rawValue: unknown) {
    const value = revivePersistentValue(rawValue);
    switch (collection) {
      case "tenants": replaceArray(tenants, value); break;
      case "authUsers": replaceArray(authUsers, value); break;
      case "settings": settings = value || settings; break;
      case "tenantSettings": replaceObject(tenantSettings, value); break;
      case "tenantBrandingSettings": replaceObject(tenantBrandingSettings, value); break;
      case "tenantThemeTemplates": tenantThemeTemplates = Array.isArray(value) ? value : []; break;
      case "tenantFeatureOverrides": tenantFeatureOverrides = value || {}; break;
      case "lootboxGuaranteedPool": lootboxGuaranteedPool = Array.isArray(value) ? value : []; break;
      case "lootboxGuaranteedPools": lootboxGuaranteedPools = value || {}; break;
      case "affiliates": affiliates = value || {}; break;
      case "customersByPhone": customersByPhone = value || {}; break;
      case "customersByCpf": customersByCpf = value || {}; break;
      case "crmContacts": crmContacts = Array.isArray(value) ? value : []; break;
      case "crmContactOverrides": crmContactOverrides = value || {}; break;
      case "customerMessages": customerMessages = Array.isArray(value) ? value : []; break;
      case "affiliateWithdrawals": affiliateWithdrawals = Array.isArray(value) ? value : []; break;
      case "passwordResetCodes": passwordResetCodes = Array.isArray(value) ? value : []; break;
      case "supportTickets": supportTickets = Array.isArray(value) ? value : []; break;
      case "auditLogs": auditLogs = Array.isArray(value) ? value : []; break;
      case "auditEventLedger": auditEventLedger = Array.isArray(value) ? value : []; break;
      case "ticketAdjustments": ticketAdjustments = Array.isArray(value) ? value : []; break;
      case "walletLedger": walletLedger = Array.isArray(value) ? value : []; break;
      case "raffleDrawAudits": raffleDrawAudits = Array.isArray(value) ? value : []; break;
      case "reportExports": reportExports = Array.isArray(value) ? value : []; break;
      case "customerConsents": customerConsents = Array.isArray(value) ? value : []; break;
      case "dataPrivacyRequests": dataPrivacyRequests = Array.isArray(value) ? value : []; break;
      case "fraudSignals": fraudSignals = Array.isArray(value) ? value : []; break;
      case "fraudScoreEvents": fraudScoreEvents = Array.isArray(value) ? value : []; break;
      case "fraudCases": fraudCases = Array.isArray(value) ? value : []; break;
      case "payments": payments = Array.isArray(value) ? value : []; break;
      case "paymentWebhookLogs": paymentWebhookLogs = Array.isArray(value) ? value : []; break;
      case "paymentLogs": paymentLogs = Array.isArray(value) ? value : []; break;
      case "webhookLogs": webhookLogs = Array.isArray(value) ? value : []; break;
      case "gatewayHealth": gatewayHealth = Array.isArray(value) ? value : []; break;
      case "n8nEventLogs": n8nEventLogs = Array.isArray(value) ? value : []; break;
      case "integrations": integrations = Array.isArray(value) ? value : []; break;
      case "integrationLogs": integrationLogs = Array.isArray(value) ? value : []; break;
      case "webhookEndpoints": webhookEndpoints = Array.isArray(value) ? value : []; break;
      case "webhookEvents": webhookEvents = Array.isArray(value) ? value : []; break;
      case "campaignCoupons": campaignCoupons = Array.isArray(value) ? value : []; break;
      case "promotionRules": promotionRules = Array.isArray(value) ? value.map((item: any) => normalizePromotionRule(item)) : []; break;
      case "promotionUsages": promotionUsages = Array.isArray(value) ? value : []; break;
      case "lootboxes": lootboxes = value || {}; break;
      case "raffles": raffles = Array.isArray(value) ? value.map((raffle: any) => ({ ...raffle, soldNumbers: raffle.soldNumbers instanceof Set ? raffle.soldNumbers : new Set(raffle.soldNumbers?.values || raffle.soldNumbers || []) })) : raffles; break;
      case "purchases": purchases = Array.isArray(value) ? value : []; break;
      case "gamificationConfigs": gamificationConfigs = Array.isArray(value) ? value : []; break;
      case "gamificationEvents": gamificationEvents = Array.isArray(value) ? value : []; break;
      case "gamificationWinners": gamificationWinners = Array.isArray(value) ? value : []; break;
      case "instantPrizes": instantPrizes = Array.isArray(value) ? value : []; break;
      case "stories": stories = Array.isArray(value) ? value : []; break;
      case "winners": winners = Array.isArray(value) ? value : []; break;
      case "fazendinhaConfig": fazendinhaConfig = cloneFazendinhaConfigForTenant(value || fazendinhaConfig, legacyTenantId); fazendinhaConfigs[legacyTenantId] = fazendinhaConfig; break;
      case "fazendinhaConfigs": replaceFazendinhaConfigs(value); break;
      case "fazendinhaGroups": fazendinhaGroups = Array.isArray(value) ? value : []; break;
      case "fazendinhaCompras": fazendinhaCompras = Array.isArray(value) ? value : []; break;
      case "fazendinhaResultados": fazendinhaResultados = Array.isArray(value) ? value : []; break;
      case "fazendinhaGanhadores": fazendinhaGanhadores = Array.isArray(value) ? value : []; break;
      case "numberModeConfigs": numberModeConfigs = value || numberModeConfigs; break;
      case "numberModePurchases": numberModePurchases = Array.isArray(value) ? value : []; break;
      case "numberModeBets": numberModeBets = Array.isArray(value) ? value : []; break;
      case "numberModeWinners": numberModeWinners = Array.isArray(value) ? value : []; break;
      case "securityLogs": replaceArray(securityLogs, value); break;
      case "paymentQueue": paymentQueue = Array.isArray(value) ? value : []; break;
      case "payment_webhook_jobs": payment_webhook_jobs = Array.isArray(value) ? value : []; break;
      case "payment_reconciliation_jobs": payment_reconciliation_jobs = Array.isArray(value) ? value : []; break;
      case "payment_release_jobs": payment_release_jobs = Array.isArray(value) ? value : []; break;
      case "payment_dead_letter_queue": payment_dead_letter_queue = Array.isArray(value) ? value : []; break;
      case "gateways": gateways = value || gateways; break;
      case "tenantGateways": replaceObject(tenantGateways, value); break;
      case "paymentGatewayConfigs": replaceObject(paymentGatewayConfigs, value); break;
      case "tenantDomains": tenantDomains = Array.isArray(value) ? value : tenantDomains; break;
      case "superadminImpersonationSessions": superadminImpersonationSessions = Array.isArray(value) ? value : []; break;
      case "superadminAuditLogs": superadminAuditLogs = Array.isArray(value) ? value : []; break;
      case "whatsappProviderConfigs": whatsappProviderConfigs = Array.isArray(value) ? value : []; break;
      case "whatsappCloudConfigs": whatsappCloudConfigs = Array.isArray(value) ? value : []; break;
      case "whatsappCloudLogs": whatsappCloudLogs = Array.isArray(value) ? value : []; break;
      case "whatsappCloudTemplates": whatsappCloudTemplates = Array.isArray(value) ? value : []; break;
      case "whatsappPixRecoverySettings": whatsappPixRecoverySettings = Array.isArray(value) ? value : []; break;
      case "whatsappPurchaseConfirmationSettings": whatsappPurchaseConfirmationSettings = Array.isArray(value) ? value : []; break;
      case "whatsappCrmCampaigns": whatsappCrmCampaigns = Array.isArray(value) ? value : []; break;
      case "whatsappMessageQueue": whatsappMessageQueue = Array.isArray(value) ? value : []; break;
      case "whatsappContacts": whatsappContacts = Array.isArray(value) ? value : []; break;
      case "whatsappConversations": whatsappConversations = Array.isArray(value) ? value : []; break;
      case "whatsappConversationMessages": whatsappConversationMessages = Array.isArray(value) ? value : []; break;
      case "whatsappOptOutEvents": whatsappOptOutEvents = Array.isArray(value) ? value : []; break;
      case "automationFlows": automationFlows = Array.isArray(value) ? value : []; break;
      case "automationRuns": automationRuns = Array.isArray(value) ? value : []; break;
      case "tenantApiKeys": tenantApiKeys = Array.isArray(value) ? value : []; break;
      case "publicActivityEvents": publicActivityEvents = Array.isArray(value) ? value : []; break;
    }
  }

  function normalizePersistentCollection(collection: unknown) {
    const value = String(collection || "").trim();
    return value || "default";
  }

  function buildPersistentRows() {
    const now = new Date().toISOString();
    return Object.entries(persistentCollections()).map(([collection, value]) => {
      const safeCollection = normalizePersistentCollection(collection);
      const serialized = serializePersistentValue(value);
      return {
        scope: "platform",
        state_key: safeCollection,
        state_value: serialized,
        tenant_id: "platform",
        collection: safeCollection,
        record_key: "singleton",
        data: serialized,
        updated_at: now
      };
    });
  }

  async function hydratePersistentState() {
    if (!supabaseAdmin) {
      console.warn("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes; usando seed em memoria sem persistencia Postgres.");
      persistentStateReady = true;
      return;
    }
    const { data, error } = await supabaseAdmin
      .from("persistent_state_records")
      .select("state_key,state_value")
      .eq("scope", "platform");
    if (!error && data?.length) {
      data.forEach(row => assignPersistentCollection(normalizePersistentCollection(row.state_key), row.state_value));
      persistentStateReady = true;
      return;
    }
    if (error) {
      const fallback = await supabaseAdmin
        .from("persistent_state_records")
        .select("collection,data")
        .eq("tenant_id", "platform")
        .eq("record_key", "singleton");
      if (fallback.error) {
        console.warn("Falha ao hidratar estado persistente do Supabase:", fallback.error.message);
        persistentStateReady = true;
        return;
      }
      if (fallback.data?.length) {
        fallback.data.forEach(row => assignPersistentCollection(normalizePersistentCollection(row.collection), row.data));
        persistentStateReady = true;
        return;
      }
    }
    await persistAllState("initial-seed");
    persistentStateReady = true;
  }

  function schedulePersistentStateSave(reason: string, delayMs = 50) {
    if (!persistentStateReady || !supabaseAdmin) return;
    if (persistentStateSaving) {
      persistentStateDirty = true;
      persistentStateDirtyReason = reason;
      return;
    }
    if (persistentStateTimer) clearTimeout(persistentStateTimer);
    persistentStateTimer = setTimeout(() => {
      void persistAllState(reason);
    }, Math.max(0, delayMs));
  }

  async function persistAllState(reason: string) {
    if (!supabaseAdmin) return;
    if (persistentStateSaving) {
      persistentStateDirty = true;
      persistentStateDirtyReason = reason;
      return;
    }
    persistentStateSaving = true;
    persistentStateDirty = false;
    persistentStateDirtyReason = "";
    try {
      const rows = buildPersistentRows();
      const { error } = await supabaseAdmin
        .from("persistent_state_records")
        .upsert(rows, { onConflict: "scope,state_key" });
      if (error) {
        const fallbackRows = rows.map(row => ({
          tenant_id: row.tenant_id,
          collection: row.collection || "default",
          record_key: row.record_key,
          data: row.data,
          updated_at: row.updated_at
        }));
        const fallback = await supabaseAdmin
          .from("persistent_state_records")
          .upsert(fallbackRows, { onConflict: "tenant_id,collection,record_key" });
        if (fallback.error) console.warn(`Falha ao persistir estado (${reason}):`, fallback.error.message);
      }
    } finally {
      persistentStateSaving = false;
      if (persistentStateDirty) {
        const dirtyReason = persistentStateDirtyReason || `${reason}:dirty`;
        persistentStateDirty = false;
        persistentStateDirtyReason = "";
        schedulePersistentStateSave(dirtyReason, 0);
      }
    }
  }

  app.get("/api/admin/gateways", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    syncLegacyGatewaysFromConfigs(tenantId);
    const tenantPixGateways = getTenantGateways(tenantId);
    const configs = getPaymentGatewayConfigs(tenantId).map(sanitizePaymentGatewayConfig);
    const defaultConfig = getDefaultPaymentGatewayConfig(tenantId);
    res.json({
      ...maskLegacyGatewaysForResponse(tenantPixGateways),
      active: defaultConfig.provider,
      configs,
      paymentGatewayConfigs: configs,
      defaultProvider: defaultConfig.provider,
      environment: defaultConfig.environment
    });
  });
  app.post("/api/admin/gateways/test", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const tenantPixGateways = getTenantGateways(tenantId);
    const gateway = normalizePaymentProvider(req.body.gateway || getDefaultPaymentGatewayConfig(tenantId).provider || tenantPixGateways.active || "mercadopago");
    const pixConfig = (tenantPixGateways.pix || {}) as Record<string, string | boolean>;
    const gatewayConfig = (tenantPixGateways[gateway] || {}) as Record<string, string>;
    const credentialFields: Record<PixGatewayId, string[]> = {
      mercadopago: ["accessToken", "publicKey"],
      pagbank: ["token"],
      asaas: ["apiKey"],
      infinitypay: ["token", "apiKey"],
      pay2m: ["clientId", "clientSecret"],
      cora: ["clientId", "clientSecret", "certificate", "privateKey", "apiKey"],
      primepag: ["clientId", "clientSecret", "accessToken", "apiKey"],
      paggue: ["clientId", "clientSecret", "apiKey"],
      cashpay: ["clientId", "clientSecret", "apiKey"],
      fakeprocessor: ["apiKey"],
      sandbox: ["apiKey"],
      mock: ["apiKey"]
    };
    const fields = credentialFields[gateway] || [];
    const presentCredentials = fields.filter(field => Boolean(gatewayConfig[field]));
    const hasGatewayCredentials = presentCredentials.length > 0 || (gateway !== "asaas" && Boolean(pixConfig.apiKey));
    const webhookUrl = gatewayConfig.webhookUrl || String(pixConfig.webhookUrl || "") || `http://127.0.0.1:3000/api/webhooks/payment/${gateway}`;
    const recommendedWebhookPath = gateway === "primepag" ? "/api/webhooks/primepag" : gateway === "cora" ? "/api/webhooks/cora" : gateway === "mercadopago" ? "/api/webhooks/mercadopago" : gateway === "asaas" ? "/api/webhooks/asaas" : gateway === "pay2m" ? "/api/webhooks/pay2m" : gateway === "pagbank" ? "/api/webhooks/pagbank" : `/api/webhooks/payment/${gateway}`;
    const issues = [
      ...(!pixConfig.enabled ? ["PIX global está desabilitado"] : []),
      ...(!hasGatewayCredentials ? ["Nenhuma credencial/API key configurada para este gateway"] : []),
      ...(!webhookUrl.includes(recommendedWebhookPath) ? [`Webhook recomendado deve apontar para ${recommendedWebhookPath}`] : []),
    ];
    if (gateway === "asaas" && issues.length === 0) {
      try {
        await getAsaasProvider(tenantId)?.provider.testConnection();
        recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "asaas", status: "received", message: "Conexao Asaas testada com sucesso", statusCode: 200, eventStatus: "CONNECTION_TEST" });
      } catch (error) {
        issues.push(error instanceof Error ? error.message : "Falha ao testar conexao Asaas");
      }
    }
    if (gateway === "pay2m" && issues.length === 0) {
      try {
        await getPay2mProvider(tenantId)?.provider.testConnection();
        recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "pay2m", status: "received", message: "Conexao Pay2M testada com sucesso", statusCode: 200, eventStatus: "CONNECTION_TEST" });
      } catch (error) {
        issues.push(error instanceof Error ? error.message : "Falha ao testar conexao Pay2M");
      }
    }
    if (gateway === "primepag" && issues.length === 0) {
      try {
        await getPrimepagProvider(tenantId)?.provider.testConnection();
        recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "primepag", status: "received", message: "Conexao PrimePag testada com sucesso", statusCode: 200, eventStatus: "CONNECTION_TEST" });
      } catch (error) {
        issues.push(error instanceof Error ? error.message : "Falha ao testar conexao PrimePag");
      }
    }
    if (gateway === "pagbank" && issues.length === 0) {
      try {
        await getPagbankProvider(tenantId)?.provider.testConnection();
        recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "pagbank", status: "received", message: "Conexao PagBank testada com sucesso", statusCode: 200, eventStatus: "CONNECTION_TEST" });
      } catch (error) {
        issues.push(error instanceof Error ? error.message : "Falha ao testar conexao PagBank");
      }
    }
    if (gateway === "mercadopago" && issues.length === 0) {
      try {
        await getMercadoPagoProvider(tenantId)?.provider.testConnection();
        recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "mercadopago", status: "received", message: "Conexao Mercado Pago testada com sucesso", statusCode: 200, eventStatus: "CONNECTION_TEST" });
      } catch (error) {
        issues.push(error instanceof Error ? error.message : "Falha ao testar conexao Mercado Pago");
      }
    }
    if (gateway === "cora" && issues.length === 0) {
      try {
        await getCoraProvider(tenantId)?.provider.testConnection();
        recordPaymentWebhookLog({ tenant_id: tenantId, gateway: "cora", status: "received", message: "Conexao Cora testada com sucesso", statusCode: 200, eventStatus: "CONNECTION_TEST" });
      } catch (error) {
        issues.push(error instanceof Error ? error.message : "Falha ao testar conexao Cora");
      }
    }
    res.json({
      gateway,
      ok: issues.length === 0,
      status: !hasGatewayCredentials ? "not_configured" : issues.length === 0 ? "configured" : "needs_attention",
      mode: pixConfig.sandbox ? "sandbox" : "production",
      webhookUrl,
      credentials: presentCredentials,
      issues,
      pixPayloadPreview: pixConfig.enabled ? buildPixPayload(1, {
        tenant_id: resolveRequestTenantId(req),
        pixConfig: {
          inheritGlobal: true,
          enabled: Boolean(pixConfig.enabled),
          gateway,
          sandbox: Boolean(pixConfig.sandbox)
        }
      }) : ""
    });
  });
  app.put("/api/admin/gateways", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const currentGateways = getTenantGateways(tenantId);
    const incomingConfigs = Array.isArray(req.body?.configs)
      ? req.body.configs
      : Array.isArray(req.body?.paymentGatewayConfigs)
        ? req.body.paymentGatewayConfigs
        : [];
    const requestedProvider = normalizePaymentProvider(
      req.body?.active ||
      incomingConfigs.find((config: Partial<PaymentGatewayConfigRecord>) => config?.is_default)?.provider ||
      incomingConfigs[0]?.provider ||
      req.body?.pix?.gateway ||
      currentGateways.active ||
      "mercadopago"
    );
    if (incomingConfigs.length) {
      const currentConfigs = getPaymentGatewayConfigs(tenantId);
      paymentGatewayConfigs[tenantId] = incomingConfigs.map((config: Partial<PaymentGatewayConfigRecord>, index: number) => {
        const provider = normalizePaymentProvider(config.provider);
        const current = currentConfigs.find(item => item.id === config.id || normalizePaymentProvider(item.provider) === provider);
        const isRequestedProvider = provider === requestedProvider;
        return normalizePaymentGatewayConfig(tenantId, {
          ...config,
          enabled: isRequestedProvider ? true : config.enabled,
          is_default: isRequestedProvider,
          priority: isRequestedProvider ? 0 : config.priority
        }, index === 0 && !requestedProvider, current);
      });
      if (!paymentGatewayConfigs[tenantId].some(config => normalizePaymentProvider(config.provider) === requestedProvider)) {
        paymentGatewayConfigs[tenantId].unshift(normalizePaymentGatewayConfig(tenantId, {
          provider: requestedProvider,
          enabled: true,
          environment: req.body?.pix?.sandbox ? "sandbox" : "production",
          credentials: gatewayCredentialsFromLegacy(requestedProvider, currentGateways),
          webhook_secret: String(req.body?.pix?.webhookSecret || currentGateways.pix?.webhookSecret || ""),
          pix_key: String(req.body?.pix?.apiKey || currentGateways.pix?.apiKey || ""),
          is_default: true,
          priority: 0
        }, true));
      }
      enforcePaymentGatewayPolicy(tenantId, requestedProvider);
    }
    const updatedGateways = {
      ...currentGateways,
      ...req.body,
      pix: mergeGatewaySectionPreservingSecrets(currentGateways.pix, req.body.pix || {}),
      mercadopago: mergeGatewaySectionPreservingSecrets(currentGateways.mercadopago, req.body.mercadopago || {}),
      pagbank: mergeGatewaySectionPreservingSecrets(currentGateways.pagbank, req.body.pagbank || {}),
      asaas: mergeGatewaySectionPreservingSecrets(currentGateways.asaas, req.body.asaas || {}),
      infinitypay: mergeGatewaySectionPreservingSecrets(currentGateways.infinitypay, req.body.infinitypay || {}),
      pay2m: mergeGatewaySectionPreservingSecrets(currentGateways.pay2m, req.body.pay2m || {}),
      cora: mergeGatewaySectionPreservingSecrets(currentGateways.cora, req.body.cora || {}),
      primepag: mergeGatewaySectionPreservingSecrets(currentGateways.primepag, req.body.primepag || {}),
      paggue: mergeGatewaySectionPreservingSecrets(currentGateways.paggue, req.body.paggue || {}),
      cashpay: mergeGatewaySectionPreservingSecrets(currentGateways.cashpay, req.body.cashpay || {}),
      fakeprocessor: mergeGatewaySectionPreservingSecrets(currentGateways.fakeprocessor, req.body.fakeprocessor || {}),
      sandbox: mergeGatewaySectionPreservingSecrets(currentGateways.sandbox, req.body.sandbox || {}),
      mock: mergeGatewaySectionPreservingSecrets(currentGateways.mock, req.body.mock || {})
    };
    updatedGateways.active = requestedProvider;
    updatedGateways.pix = {
      ...updatedGateways.pix,
      sandbox: updatedGateways.active === "primepag" ? updatedGateways.primepag?.environment !== "production" : updatedGateways.active === "cora" ? updatedGateways.cora?.environment !== "production" : updatedGateways.active === "mercadopago" ? updatedGateways.mercadopago?.environment !== "production" : updatedGateways.active === "asaas" ? updatedGateways.asaas?.environment !== "production" : updatedGateways.active === "pay2m" ? updatedGateways.pay2m?.environment !== "production" : updatedGateways.active === "pagbank" ? updatedGateways.pagbank?.environment !== "production" : updatedGateways.pix?.sandbox,
      webhookUrl: updatedGateways.active === "primepag" ? "/api/webhooks/primepag" : updatedGateways.active === "cora" ? "/api/webhooks/cora" : updatedGateways.active === "mercadopago" ? "/api/webhooks/mercadopago" : updatedGateways.active === "asaas" ? "/api/webhooks/asaas" : updatedGateways.active === "pay2m" ? "/api/webhooks/pay2m" : updatedGateways.active === "pagbank" ? "/api/webhooks/pagbank" : `http://127.0.0.1:3000/api/webhooks/payment/${updatedGateways.active}`
    };
    tenantGateways[tenantId] = updatedGateways;
    if (tenantId === legacyTenantId) gateways = updatedGateways;
    if (!incomingConfigs.length) {
      paymentGatewayConfigs[tenantId] = [normalizePaymentGatewayConfig(tenantId, {
        provider: updatedGateways.active,
        enabled: Boolean(updatedGateways.pix?.enabled),
        environment: updatedGateways.pix?.sandbox ? "sandbox" : "production",
        credentials: gatewayCredentialsFromLegacy(updatedGateways.active as PixGatewayId, updatedGateways),
        webhook_secret: String(updatedGateways.pix?.webhookSecret || ""),
        pix_key: String(updatedGateways.pix?.apiKey || ""),
        is_default: true
      }, true)];
    }
    enforcePaymentGatewayPolicy(tenantId, requestedProvider);
    syncLegacyGatewaysFromConfigs(tenantId);
    const configs = getPaymentGatewayConfigs(tenantId).map(sanitizePaymentGatewayConfig);
    recordSecurityEvent({ tenant_id: tenantId, action: "PIX_GATEWAY_CHANGED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "WARN", severity: "medium", actor: getAuthSession(req)?.email, detail: String(getDefaultPaymentGatewayConfig(tenantId).provider || "") });
    const defaultConfig = getDefaultPaymentGatewayConfig(tenantId);
    res.json({
      ...maskLegacyGatewaysForResponse(getTenantGateways(tenantId)),
      active: defaultConfig.provider,
      configs,
      paymentGatewayConfigs: configs,
      defaultProvider: defaultConfig.provider,
      environment: defaultConfig.environment
    });
  });

  // Settings
  app.get("/api/settings", (req, res) => res.json(sanitizePublicSettings(getTenantSettings(resolveRequestTenantId(req)))));
  app.put("/api/admin/settings", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const currentSettings = getTenantSettings(tenantId);
    const incomingN8n = { ...(req.body.n8nIntegration || {}) };
    const incomingAffiliateVideo = { ...(req.body.affiliateInstructionVideo || {}) };
    if (incomingN8n.secret === "********") incomingN8n.secret = currentSettings.n8nIntegration.secret;
    const updatedSettings = normalizeSettingsShape({
      ...currentSettings,
      ...req.body,
      smsProvider: { ...currentSettings.smsProvider, ...(req.body.smsProvider || {}) },
      n8nIntegration: { ...currentSettings.n8nIntegration, ...incomingN8n },
      affiliateProgram: { ...currentSettings.affiliateProgram, ...(req.body.affiliateProgram || {}) },
      affiliatePerformanceRewards: {
        ...currentSettings.affiliatePerformanceRewards,
        ...(req.body.affiliatePerformanceRewards || {})
      },
      affiliateInstructionVideo: {
        ...currentSettings.affiliateInstructionVideo,
        ...incomingAffiliateVideo,
        videoConfig: {
          ...(currentSettings.affiliateInstructionVideo?.videoConfig || {}),
          ...(incomingAffiliateVideo.videoConfig || {}),
          showControls: false,
          tapToUnmute: false
        }
      },
      footer: { ...currentSettings.footer, ...(req.body.footer || {}) },
      socialLinks: { ...currentSettings.socialLinks, ...(req.body.socialLinks || {}) },
      branding: { ...currentSettings.branding, ...(req.body.branding || {}) },
      theme: { ...currentSettings.theme, ...(req.body.theme || {}) },
      mainVideoPlayer: { ...currentSettings.mainVideoPlayer, ...(req.body.mainVideoPlayer || {}) }
    });
    tenantSettings[tenantId] = updatedSettings;
    if (tenantId === legacyTenantId) settings = updatedSettings;
    res.json(updatedSettings);
  });

  app.get("/api/admin/branding", (req, res) => {
    res.json(getTenantBranding(resolveRequestTenantId(req)));
  });

  app.put("/api/admin/branding", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const branding = normalizeTenantBranding(tenantId, req.body || {});
    const tenant = tenants.find(item => item.id === tenantId);
    if (tenant) {
      tenant.logo_url = branding.logo_url;
      tenant.cor_primaria = branding.primary_color;
    }
    recordSecurityEvent({ tenant_id: tenantId, action: "TENANT_BRANDING_UPDATED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", actor: getAuthSession(req)?.email, detail: branding.header_name });
    res.json(branding);
  });

  app.post("/api/admin/branding/logo", express.raw({ type: "*/*", limit: "5mb" }), async (req, res) => {
    try {
      const tenantId = resolveRequestTenantId(req);
      const asset = await saveBrandingAsset(req, tenantId, "logo");
      const current = getTenantBranding(tenantId);
      const branding = normalizeTenantBranding(tenantId, { logo_url: asset.url, login_logo_url: current.login_logo_url || asset.url, logo_mime_type: asset.mimeType, metadata: { ...current.metadata, logoAsset: asset } });
      const tenant = tenants.find(item => item.id === tenantId);
      if (tenant) tenant.logo_url = branding.logo_url;
      recordSecurityEvent({ tenant_id: tenantId, action: "TENANT_BRANDING_LOGO_UPLOADED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", actor: getAuthSession(req)?.email, detail: asset.mimeType });
      res.status(201).json({ branding, asset });
    } catch (error) {
      res.status((error as Error & { statusCode?: number }).statusCode || 400).json({ error: error instanceof Error ? error.message : "Erro ao enviar logo" });
    }
  });

  app.post("/api/admin/branding/favicon", express.raw({ type: "*/*", limit: "5mb" }), async (req, res) => {
    try {
      const tenantId = resolveRequestTenantId(req);
      const asset = await saveBrandingAsset(req, tenantId, "favicon");
      const branding = normalizeTenantBranding(tenantId, { favicon_url: asset.url, metadata: { ...getTenantBranding(tenantId).metadata, faviconAsset: asset } });
      recordSecurityEvent({ tenant_id: tenantId, action: "TENANT_BRANDING_FAVICON_UPLOADED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", actor: getAuthSession(req)?.email, detail: asset.mimeType });
      res.status(201).json({ branding, asset });
    } catch (error) {
      res.status((error as Error & { statusCode?: number }).statusCode || 400).json({ error: error instanceof Error ? error.message : "Erro ao enviar favicon" });
    }
  });

  app.post("/api/admin/branding/reset", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    tenantBrandingSettings[tenantId] = defaultTenantBranding(tenantId);
    recordSecurityEvent({ tenant_id: tenantId, action: "TENANT_BRANDING_RESET", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", actor: getAuthSession(req)?.email });
    res.json(tenantBrandingSettings[tenantId]);
  });

  app.get("/api/admin/theme-builder", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    res.json({
      marketplace: themeMarketplacePresets,
      template: ensureTenantThemeTemplate(tenantId),
      templates: tenantThemeTemplates.filter(item => item.tenant_id === tenantId)
    });
  });

  app.put("/api/admin/theme-builder", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const before = ensureTenantThemeTemplate(tenantId);
    const template = saveTenantThemeTemplate(tenantId, req.body || {});
    recordAuditLedger(req, { tenant_id: tenantId, action: "TENANT_THEME_TEMPLATE_UPDATED", resource_type: "tenant_theme_template", resource_id: template.id, before_data: before, after_data: template, reason: String(req.body.reason || "Atualizacao do construtor visual") });
    res.json(template);
  });

  app.post("/api/admin/theme-builder/publish", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const template = req.body?.id
      ? tenantThemeTemplates.find(item => item.id === req.body.id && item.tenant_id === tenantId)
      : ensureTenantThemeTemplate(tenantId);
    if (!template) return res.status(404).json({ error: "Tema nao encontrado" });
    tenantThemeTemplates.forEach(item => { if (item.tenant_id === tenantId) item.active = item.id === template.id; });
    template.active = true;
    recordAuditLedger(req, { tenant_id: tenantId, action: "TENANT_THEME_TEMPLATE_PUBLISHED", resource_type: "tenant_theme_template", resource_id: template.id, before_data: null, after_data: template, reason: String(req.body.reason || "Publicacao do tema visual") });
    res.json(template);
  });

  app.get("/api/admin/integrations/n8n", (req, res) => {
    res.json({ config: sanitizeN8nSettings(getTenantSettings(resolveRequestTenantId(req))), logs: scoped(n8nEventLogs, req) });
  });

  app.post("/api/admin/integrations/n8n/test", async (req, res) => {
    const tenantScopedSettings = getTenantSettings(resolveRequestTenantId(req));
    const phone = String(req.body.phone || "").replace(/\D/g, "");
    const email = String(req.body.email || "").trim();
    if (tenantScopedSettings.n8nIntegration?.channelWhatsapp && phone.length < 10) {
      return res.status(400).json({ error: "Informe um telefone WhatsApp valido para o teste oficial." });
    }
    if (tenantScopedSettings.n8nIntegration?.channelEmail && !email.includes("@")) {
      return res.status(400).json({ error: "Informe um e-mail valido para o teste." });
    }
    const payload = {
      test: true,
      customer: { name: "Cliente Teste", phone, email },
      message: {
        whatsapp: "Mensagem de teste enviada pela integração n8n da plataforma.",
        emailSubject: "Teste n8n",
        emailBody: "Se você recebeu esta mensagem, o webhook está conectado."
      }
    };
    const log = await dispatchN8nEvent("integration.test", payload, { target: "test", force: true, tenantId: resolveRequestTenantId(req) });
    tenantScopedSettings.n8nIntegration.lastTestAt = new Date().toISOString();
    res.status(log.status === "sent" ? 200 : 502).json({ config: sanitizeN8nSettings(tenantScopedSettings), log });
  });

  app.post("/api/admin/integrations/n8n/broadcast", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const tenantScopedSettings = getTenantSettings(tenantId);
    const audienceType = String(req.body.audience || tenantScopedSettings.n8nIntegration.defaultAudience || "platform");
    const raffleId = String(req.body.raffleId || "");
    const audience = getRaffleAudience(raffleId, audienceType, tenantId);
    const log = await dispatchN8nEvent("campaign.broadcast", {
      audience,
      raffle: raffleId ? raffles.find(item => item.tenant_id === tenantId && item.id === raffleId) : undefined,
      message: {
        whatsapp: String(req.body.whatsappMessage || "Tem novidade na plataforma. Confira agora."),
        emailSubject: String(req.body.emailSubject || "Novidade na plataforma"),
        emailBody: String(req.body.emailBody || req.body.whatsappMessage || "Tem novidade na plataforma.")
      }
    }, { target: audienceType, force: true, tenantId });
    res.status(log.status === "sent" || log.status === "skipped" ? 200 : 502).json({ audienceSize: audience.length, log });
  });

  app.get("/api/admin/campaigns", (req, res) => {
    res.json(scoped(campaignCoupons, req).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  app.post("/api/admin/campaigns", (req, res) => {
    const code = normalizeCouponCode(req.body.code);
    if (!code) {
      res.status(400).json({ error: "Código do cupom é obrigatório" });
      return;
    }
    const tenantId = resolveRequestTenantId(req);
    if (campaignCoupons.some(item => item.tenant_id === tenantId && item.code === code)) {
      res.status(409).json({ error: "Cupom já existe" });
      return;
    }
    const coupon: CampaignCoupon = {
      id: createPublicId("CPN_"),
      tenant_id: tenantId,
      code,
      name: String(req.body.name || code),
      type: (["fixed", "bonus"].includes(req.body.type) ? req.body.type : "percent") as CampaignCoupon["type"],
      value: Math.max(0, Number(req.body.value || 0)),
      active: req.body.active !== false,
      raffleId: req.body.raffleId || undefined,
      minTickets: req.body.minTickets ? Number(req.body.minTickets) : undefined,
      maxUses: req.body.maxUses ? Number(req.body.maxUses) : undefined,
      used: 0,
      startsAt: req.body.startsAt || undefined,
      endsAt: req.body.endsAt || undefined,
      createdAt: new Date().toISOString()
    };
    campaignCoupons.unshift(coupon);
    res.json(coupon);
  });

  app.put("/api/admin/campaigns/:id", (req, res) => {
    const index = campaignCoupons.findIndex(item => item.id === req.params.id && adminCanAccessTenant(req, item.tenant_id));
    if (index < 0) {
      res.status(404).json({ error: "Cupom não encontrado" });
      return;
    }
    campaignCoupons[index] = {
      ...campaignCoupons[index],
      ...req.body,
      tenant_id: campaignCoupons[index].tenant_id,
      code: req.body.code ? normalizeCouponCode(req.body.code) : campaignCoupons[index].code,
      value: req.body.value !== undefined ? Math.max(0, Number(req.body.value)) : campaignCoupons[index].value,
      minTickets: req.body.minTickets !== undefined ? Number(req.body.minTickets || 0) || undefined : campaignCoupons[index].minTickets,
      maxUses: req.body.maxUses !== undefined ? Number(req.body.maxUses || 0) || undefined : campaignCoupons[index].maxUses
    };
    res.json(campaignCoupons[index]);
  });

  app.delete("/api/admin/campaigns/:id", (req, res) => {
    campaignCoupons = campaignCoupons.filter(item => item.id !== req.params.id || !adminCanAccessTenant(req, item.tenant_id));
    res.json({ success: true });
  });

  app.post("/api/coupons/validate", criticalRateLimiter, (req, res) => {
    const raffleId = String(req.body.raffleId || "");
    const tickets = normalizeTickets(req.body.tickets) || 1;
    const tenantId = resolveRequestTenantId(req);
    const raffle = raffles.find(item => item.tenant_id === tenantId && item.id === raffleId);
    if (!raffle) {
      res.status(404).json({ error: "Rifa não encontrada" });
      return;
    }
    try {
      const coupon = getActiveCoupon(req.body.code, raffleId, tickets, tenantId);
      const subtotal = tickets * raffle.price;
      const benefit = calculateCouponBenefit(coupon, subtotal, tickets);
      res.json({ coupon, ...benefit, total: Math.max(0, subtotal - benefit.discount) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Cupom inválido" });
    }
  });

  app.post("/api/admin/media/upload", express.raw({ type: "*/*", limit: "100mb" }), async (req, res) => {
    const fileName = String(req.headers["x-file-name"] || "media").replace(/[^\w.\-]+/g, "-");
    const contentType = String(req.headers["content-type"] || "");
    const ext = path.extname(fileName).toLowerCase();
    const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".webm", ".wmv", ".wma", ".wmi"]);
    const allowedMime = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|quicktime|webm|x-ms-wmv)|audio\/x-ms-wma|application\/octet-stream)/i;

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "Arquivo vazio" });
      return;
    }
    if (req.body.length > 100 * 1024 * 1024) {
      res.status(413).json({ error: "Arquivo acima de 100MB" });
      return;
    }
    if (!allowedExtensions.has(ext) || !allowedMime.test(contentType)) {
      res.status(415).json({ error: "Formato não suportado. Use JPEG, PNG, GIF, MP4, WMV/WMA/WMI até 100MB." });
      return;
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const storedName = `${Date.now()}-${randomUUID()}${ext}`;
    await writeFile(path.join(uploadsDir, storedName), req.body);
    res.json({
      mediaUrl: `/uploads/${storedName}`,
      mediaType: /\.(mp4|mov|webm|wmv|wma|wmi)$/i.test(ext) ? "video" : "image",
      fileName: storedName,
      size: req.body.length
    });
  });

  // Affiliates
  app.post("/api/affiliates/register", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const refCode = req.body.refCode || createAffiliateCode(req.body.name, normalizePhone(req.body.phone || req.body.refCode));
    const key = tenantCustomerKey(tenantId, refCode);
    if (!affiliates[key]) {
      res.status(409).json({ error: "Afiliado ativado automaticamente apos a primeira compra confirmada" });
      return;
    }
    res.json({ ...publicAffiliateView(affiliates[key]), rules: settings.affiliateProgram });
  });
  app.get("/api/affiliates/:refCode", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const affiliate = affiliates[tenantCustomerKey(tenantId, req.params.refCode)] || {
      tenant_id: tenantId,
      refCode: req.params.refCode,
      clicks: 0,
      conversions: 0,
      referredCustomers: 0,
      revenue: 0,
      commission: 0,
      commissionBalance: 0,
      prizeBalance: 0,
      useCustomCommission: false,
      customCommissionRate: undefined,
      useBalanceForPurchases: false,
      enabled: false,
      history: []
    };
    if (isAffiliateOwnerRequest(req, affiliate)) {
      releaseEligiblePendingAffiliateCommissions(affiliate);
      res.json({ ...publicAffiliateView(affiliate), rules: settings.affiliateProgram });
      return;
    }

    const publicAffiliate = {
      tenant_id: affiliate.tenant_id,
      refCode: affiliate.refCode,
      enabled: affiliate.enabled
    };
    res.json({ ...publicAffiliate, rules: settings.affiliateProgram });
  });

  app.get("/api/affiliates/:refCode/dashboard", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const affiliate = affiliates[tenantCustomerKey(tenantId, req.params.refCode)];
    if (!affiliate) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    if (!isAffiliateOwnerRequest(req, affiliate)) {
      res.status(403).json({ error: "Acesso negado para este afiliado" });
      return;
    }
    res.json(buildAffiliateDashboard(req, affiliate));
  });

  app.post("/api/affiliates/:refCode/rewards/consume", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const affiliate = affiliates[tenantCustomerKey(tenantId, req.params.refCode)];
    if (!affiliate) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    if (!isAffiliateOwnerRequest(req, affiliate)) {
      res.status(403).json({ error: "Acesso negado para este afiliado" });
      return;
    }
    const rewardType = normalizeAffiliateRewardType(req.body.rewardType);
    if (!rewardType) {
      res.status(400).json({ error: "Recompensa invalida" });
      return;
    }
    try {
      const consumption = consumeAffiliateReward({
        tenantId,
        affiliate,
        rewardType,
        quantity: Number(req.body.quantity || 1),
        idempotencyKey: req.body.idempotencyKey
      });
      res.json({ consumption, dashboard: buildAffiliateDashboard(req, affiliate) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Nao foi possivel usar esta recompensa" });
    }
  });

  app.get("/api/affiliates/:refCode/campaign-links", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const affiliate = affiliates[tenantCustomerKey(tenantId, req.params.refCode)];
    if (!affiliate) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    if (!isAffiliateOwnerRequest(req, affiliate)) {
      res.status(403).json({ error: "Acesso negado para este afiliado" });
      return;
    }
    res.json(buildAffiliateCampaignLinks(req, affiliate));
  });

  app.get("/api/admin/affiliates/search", (req, res) => {
    const query = String(req.query.q || "");
    const digits = query.replace(/\D/g, "");
    const normalizedText = query.toLowerCase().trim();
    const results = Object.values(affiliates)
      .filter(affiliate => adminCanAccessTenant(req, affiliate.tenant_id))
      .map(affiliate => {
        const customer = affiliateOwnerCustomer(affiliate);
        return { affiliate, customer };
      })
      .filter(({ affiliate, customer }) => {
        const text = `${customer?.name || ""} ${customer?.phone || ""} ${customer?.cpf || ""} ${customer?.city || ""} ${customer?.state || ""} ${affiliate.refCode}`.toLowerCase();
        return !query || text.includes(normalizedText) || String(customer?.phone || "").includes(digits) || String(customer?.cpf || "").includes(digits);
      })
      .map(({ affiliate, customer }) => {
        const eligibility = releaseEligiblePendingAffiliateCommissions(affiliate);
        return {
          customer: customer || { affiliateRefCode: affiliate.refCode },
          affiliate: { ...affiliate, eligibility, rules: settings.affiliateProgram }
        };
      });
    res.json(results);
  });

  app.get("/api/admin/affiliates/withdrawals", (req, res) => {
    res.json(scoped(affiliateWithdrawals, req).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)));
  });

  app.post("/api/admin/affiliates/withdrawals/:id/status", (req, res) => {
    const withdrawal = affiliateWithdrawals.find(item => item.id === req.params.id && adminCanAccessTenant(req, item.tenant_id));
    if (!withdrawal) {
      res.status(404).json({ error: "Solicitacao de saque nao encontrada" });
      return;
    }
    const status = req.body.status === "rejected" ? "rejected" : "paid";
    const affiliate = affiliates[tenantCustomerKey(withdrawal.tenant_id, withdrawal.refCode)];
    const customer = withdrawal.customerId ? Object.values(customersByPhone).find(item => item.id === withdrawal.customerId) : undefined;
    withdrawal.status = status;
    withdrawal.adminNote = String(req.body.note || "");
    withdrawal.paidAt = new Date().toISOString();

    if (status === "paid" && affiliate) {
      debitAffiliateWallet(affiliate, withdrawal.amount);
      affiliate.history.push({ amount: -withdrawal.amount, type: "withdrawal_paid", date: withdrawal.paidAt });
      notifyCustomer(customer, "Pagamento efetuado com sucesso", `Seu saque PIX de R$ ${withdrawal.amount.toFixed(2)} foi marcado como pago pelo administrador.`, "Ver painel de afiliado", "/afiliados");
    } else if (status === "rejected") {
      notifyCustomer(customer, "Solicitacao de saque recusada", withdrawal.adminNote || "Sua solicitacao de saque foi recusada pelo administrador.", "Ver painel de afiliado", "/afiliados");
    }
    recordSecurityEvent({ tenant_id: withdrawal.tenant_id, action: "WITHDRAWAL_STATUS_CHANGED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "medium", actor: getAuthSession(req)?.email, detail: `${withdrawal.id}:${status}` });
    res.json(withdrawal);
  });

  app.get("/api/admin/support/tickets", (req, res) => {
    res.json(scoped(supportTickets, req).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  });

  app.post("/api/admin/support/tickets/:id/reply", (req, res) => {
    const ticket = supportTickets.find(item => item.id === req.params.id && adminCanAccessTenant(req, item.tenant_id));
    const body = String(req.body.message || req.body.body || "").trim();
    if (!ticket || !body) {
      res.status(400).json({ error: "Atendimento e mensagem sao obrigatorios" });
      return;
    }
    const now = new Date().toISOString();
    ticket.messages.forEach(message => {
      if (message.sender === "customer") message.readByAdmin = true;
    });
    ticket.messages.push({ id: createPublicId("SUPM_"), sender: "admin", body, createdAt: now, readByAdmin: true, readByCustomer: false });
    ticket.status = "answered";
    ticket.updatedAt = now;
    const customer = ticket.customerId ? Object.values(customersByPhone).find(item => item.id === ticket.customerId) : undefined;
    notifyCustomer(customer, "Atendente respondeu seu chamado", "Voce recebeu uma nova resposta no chat de suporte.", "Abrir suporte", "/");
    res.json(ticket);
  });

  app.put("/api/admin/support/tickets/:id", (req, res) => {
    const ticket = supportTickets.find(item => item.id === req.params.id && adminCanAccessTenant(req, item.tenant_id));
    if (!ticket) {
      res.status(404).json({ error: "Atendimento não encontrado" });
      return;
    }
    if (["open", "answered", "closed"].includes(req.body.status)) ticket.status = req.body.status;
    (ticket as any).assignedTo = String(req.body.assignedTo || (ticket as any).assignedTo || "");
    ticket.updatedAt = new Date().toISOString();
    res.json(ticket);
  });

  app.post("/api/admin/affiliates/manual", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const phone = normalizePhone(req.body.phone);
    const cpf = normalizeCpf(req.body.cpf);
    if (!phone || phone.length < 10 || !cpf || cpf.length !== 11 || !String(req.body.name || "").trim()) {
      res.status(400).json({ error: "Nome, telefone e CPF validos sao obrigatorios" });
      return;
    }

    let customer = findCustomerByPhone(phone, tenantId) || findCustomerByCpf(cpf, tenantId);
    if (!customer) {
      customer = {
        id: createPublicId("C_"),
        tenant_id: tenantId,
        name: String(req.body.name).trim(),
        phone,
        cpf,
        accessPassword: normalizeAccessPassword(req.body.accessPassword || req.body.password) || "123456",
        photoUrl: req.body.photoUrl || "",
        createdAt: new Date().toISOString(),
        totalTickets: 0,
        affiliateRefCode: createAffiliateCode(req.body.name, phone),
        city: req.body.city || "Nao informado",
        state: req.body.state || "Nao informado",
        browserId: ""
      };
      customersByPhone[tenantCustomerKey(tenantId, phone)] = customer;
      customersByCpf[tenantCustomerKey(tenantId, cpf)] = customer;
    } else {
      const oldPhone = customer.phone;
      const oldCpf = customer.cpf;
      customer.name = String(req.body.name || customer.name).trim();
      customer.phone = phone;
      customer.cpf = cpf;
      customer.city = req.body.city ?? customer.city;
      customer.state = req.body.state ?? customer.state;
      customer.photoUrl = req.body.photoUrl ?? customer.photoUrl;
      if (req.body.accessPassword || req.body.password) {
        const accessPassword = normalizeAccessPassword(req.body.accessPassword || req.body.password);
        if (!accessPassword) {
          res.status(400).json({ error: "Senha deve ter 6 digitos" });
          return;
        }
        customer.accessPassword = accessPassword;
      }
      delete customersByPhone[tenantCustomerKey(tenantId, oldPhone)];
      delete customersByCpf[tenantCustomerKey(tenantId, oldCpf)];
      customersByPhone[tenantCustomerKey(tenantId, customer.phone)] = customer;
      customersByCpf[tenantCustomerKey(tenantId, customer.cpf)] = customer;
    }

    const requestedRef = String(req.body.refCode || customer.affiliateRefCode || createAffiliateCode(customer.name, customer.phone))
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .toUpperCase()
      .slice(0, 24);
    const refCode = requestedRef || customer.affiliateRefCode;
    const existingOwner = affiliates[tenantCustomerKey(tenantId, refCode)]?.customerId;
    if (existingOwner && existingOwner !== customer.id) {
      res.status(409).json({ error: "Codigo de afiliado ja pertence a outro cliente" });
      return;
    }

    if (customer.affiliateRefCode !== refCode) {
      const oldAffiliate = affiliates[tenantCustomerKey(tenantId, customer.affiliateRefCode)];
      if (oldAffiliate?.customerId === customer.id && !oldAffiliate.history.length && oldAffiliate.commission === 0) {
        delete affiliates[tenantCustomerKey(tenantId, customer.affiliateRefCode)];
      }
      customer.affiliateRefCode = refCode;
    }

    const affiliate = ensureAffiliateForCustomer(customer);
    affiliate.enabled = true;
    affiliate.pixKey = req.body.pixKey ?? affiliate.pixKey;
    affiliate.useBalanceForPurchases = Boolean(req.body.useBalanceForPurchases ?? affiliate.useBalanceForPurchases);
    affiliate.history.push({ amount: 0, type: "admin_manual_affiliate_register", date: new Date().toISOString() });
    res.json({ customer: buildAdminCustomerProfile(customer), affiliate: { ...affiliate, rules: settings.affiliateProgram } });
  });

  app.post("/api/admin/affiliates/:refCode/wallet", (req, res) => {
    const affiliate = affiliates[tenantCustomerKey(resolveRequestTenantId(req), req.params.refCode)];
    if (!affiliate) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const amount = Math.max(0, Number(req.body.amount || 0));
    const action = String(req.body.action || "");
    const note = req.body.note || "Ajuste administrativo";
    const now = new Date().toISOString();

    if (action === "add_commission") {
      affiliate.commissionBalance += amount;
      affiliate.history.push({ amount, type: "admin_add_commission", date: now });
    } else if (action === "add_prize") {
      affiliate.prizeBalance += amount;
      affiliate.history.push({ amount, type: "admin_add_prize", date: now });
    } else if (action === "pay_commission") {
      const paid = Math.min(affiliate.commissionBalance, amount);
      affiliate.commissionBalance -= paid;
      affiliate.history.push({ amount: -paid, type: "commission_withdraw_paid", date: now });
    } else if (action === "pay_prize") {
      const paid = Math.min(affiliate.prizeBalance, amount);
      affiliate.prizeBalance -= paid;
      affiliate.history.push({ amount: -paid, type: "prize_withdraw_paid", date: now });
    } else if (action === "zero_commission") {
      affiliate.history.push({ amount: -affiliate.commissionBalance, type: "admin_zero_commission", date: now });
      affiliate.commissionBalance = 0;
    } else if (action === "zero_prize") {
      affiliate.history.push({ amount: -affiliate.prizeBalance, type: "admin_zero_prize", date: now });
      affiliate.prizeBalance = 0;
    } else if (action === "zero_all") {
      affiliate.history.push({ amount: -(affiliate.commissionBalance + affiliate.prizeBalance), type: "admin_zero_all", date: now });
      affiliate.commissionBalance = 0;
      affiliate.prizeBalance = 0;
    } else {
      res.status(400).json({ error: "Ação de carteira inválida" });
      return;
    }

    affiliate.commission = affiliate.commissionBalance + affiliate.prizeBalance;
    affiliate.history.push({ amount: 0, type: `admin_note:${note}`, date: now });
    res.json({ ...affiliate, rules: settings.affiliateProgram });
  });

  app.put("/api/admin/affiliates/:refCode/full", (req, res) => {
    const affiliate = affiliates[tenantCustomerKey(resolveRequestTenantId(req), req.params.refCode)];
    if (!affiliate) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const customer = Object.values(customersByPhone).find(item => item.id === affiliate.customerId);
    if (customer) {
      const oldPhone = customer.phone;
      const oldCpf = customer.cpf;
      customer.name = req.body.customer?.name ?? customer.name;
      customer.phone = req.body.customer?.phone ? normalizePhone(req.body.customer.phone) : customer.phone;
      customer.cpf = req.body.customer?.cpf ? normalizeCpf(req.body.customer.cpf) : customer.cpf;
      customer.city = req.body.customer?.city ?? customer.city;
      customer.state = req.body.customer?.state ?? customer.state;
      customer.photoUrl = req.body.customer?.photoUrl ?? customer.photoUrl;
      if (req.body.customer?.accessPassword !== undefined || req.body.customer?.password !== undefined) {
        const accessPassword = normalizeAccessPassword(req.body.customer.accessPassword || req.body.customer.password);
        if (!accessPassword) {
          res.status(400).json({ error: "Senha deve ter 6 dígitos" });
          return;
        }
        customer.accessPassword = accessPassword;
      }
      delete customersByPhone[tenantCustomerKey(customer.tenant_id, oldPhone)];
      delete customersByCpf[tenantCustomerKey(customer.tenant_id, oldCpf)];
      customersByPhone[tenantCustomerKey(customer.tenant_id, customer.phone)] = customer;
      customersByCpf[tenantCustomerKey(customer.tenant_id, customer.cpf)] = customer;
    }
    affiliate.pixKey = req.body.affiliate?.pixKey ?? affiliate.pixKey;
    affiliate.useBalanceForPurchases = Boolean(req.body.affiliate?.useBalanceForPurchases);
    affiliate.enabled = req.body.affiliate?.enabled !== undefined ? Boolean(req.body.affiliate.enabled) : affiliate.enabled;
    if (req.body.affiliate?.useCustomCommission !== undefined) {
      affiliate.useCustomCommission = Boolean(req.body.affiliate.useCustomCommission);
    }
    if (req.body.affiliate?.customCommissionRate !== undefined) {
      affiliate.customCommissionRate = normalizeAffiliateCommissionRate(req.body.affiliate.customCommissionRate);
    }
    if (!affiliate.useCustomCommission) {
      affiliate.customCommissionRate = undefined;
    }
    affiliate.commissionBalance = req.body.affiliate?.commissionBalance !== undefined ? Number(req.body.affiliate.commissionBalance) : affiliate.commissionBalance;
    affiliate.prizeBalance = req.body.affiliate?.prizeBalance !== undefined ? Number(req.body.affiliate.prizeBalance) : affiliate.prizeBalance;
    affiliate.commission = affiliate.commissionBalance + affiliate.prizeBalance;
    affiliate.history.push({ amount: 0, type: "admin_affiliate_full_update", date: new Date().toISOString() });
    res.json({ customer, affiliate: { ...affiliate, rules: settings.affiliateProgram } });
  });

  app.put("/api/affiliates/:refCode", (req, res) => {
    const affiliate = affiliates[tenantCustomerKey(resolveRequestTenantId(req), req.params.refCode)];
    if (!affiliate) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    if (!isAffiliateOwnerRequest(req, affiliate)) {
      res.status(403).json({ error: "Acesso negado para este afiliado" });
      return;
    }
    affiliate.pixKey = req.body.pixKey ?? affiliate.pixKey;
    affiliate.useBalanceForPurchases = Boolean(req.body.useBalanceForPurchases);
    res.json({ ...publicAffiliateView(affiliate), rules: settings.affiliateProgram });
  });

  app.post("/api/affiliates/:refCode/withdrawals", (req, res) => {
    const affiliate = affiliates[tenantCustomerKey(resolveRequestTenantId(req), req.params.refCode)];
    if (!affiliate) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const customer = affiliateOwnerCustomer(affiliate);
    if (!customer || !isAffiliateOwnerRequest(req, affiliate)) {
      res.status(403).json({ error: "Acesso negado para este afiliado" });
      return;
    }
    releaseEligiblePendingAffiliateCommissions(affiliate);
    const amount = Math.max(0, Number(req.body.amount || affiliate.commissionBalance + affiliate.prizeBalance || 0));
    const totalBalance = (affiliate.commissionBalance || 0) + (affiliate.prizeBalance || 0);
    const pixKey = String(req.body.pixKey || affiliate.pixKey || "").trim();
    if (!pixKey) {
      res.status(400).json({ error: "Configure sua chave PIX antes de solicitar saque" });
      return;
    }
    if (amount < settings.affiliateProgram.minWithdrawAmount || amount > totalBalance) {
      res.status(400).json({ error: "Valor de saque invalido para o saldo disponivel" });
      return;
    }
    const pending = affiliateWithdrawals.find(item => item.tenant_id === affiliate.tenant_id && item.refCode === affiliate.refCode && item.status === "pending");
    if (pending) {
      res.status(409).json({ error: "Voce ja possui uma solicitacao de saque pendente" });
      return;
    }
    const withdrawalRisk = evaluateWithdrawalFraud(customer, affiliate, amount);
    if ((withdrawalRisk.score || 0) >= 71) {
      recordSecurityEvent({ tenant_id: affiliate.tenant_id, action: "WITHDRAWAL_BLOCKED_BY_FRAUD_SCORE", ip: String(req.ip || req.socket.remoteAddress || ""), status: "BLOCKED", severity: "high", actor: customer.phone, detail: `score=${withdrawalRisk.score}` });
      res.status(403).json({ error: "Saque bloqueado para revisao manual antifraude", fraudScore: withdrawalRisk.score });
      return;
    }
    affiliate.pixKey = pixKey;
    const withdrawal: AffiliateWithdrawal = {
      id: createPublicId("WDR_"),
      tenant_id: affiliate.tenant_id,
      refCode: affiliate.refCode,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      pixKey,
      amount,
      status: "pending",
      requestedAt: new Date().toISOString()
    };
    affiliateWithdrawals.unshift(withdrawal);
    affiliate.history.push({ amount: 0, type: `withdrawal_requested:${withdrawal.id}`, date: withdrawal.requestedAt });
    notifyCustomer(customer, "Saque solicitado", `Recebemos sua solicitacao de saque PIX de R$ ${amount.toFixed(2)}. O admin fará a transferencia manual pelo banco.`);
    res.json({ withdrawal, affiliate: { ...affiliate, rules: settings.affiliateProgram } });
  });

  app.post("/api/affiliates/:refCode/click", (req, res) => {
    const affiliate = affiliates[tenantCustomerKey(resolveRequestTenantId(req), req.params.refCode)];
    if (affiliate) affiliate.clicks++;
    res.json({ success: true });
  });

  // Lootboxes
  app.get("/api/lootboxes/:userId", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const customerPhone = normalizePhone(req.params.userId) || req.params.userId;
    const userKey = tenantCustomerKey(tenantId, customerPhone);
    const customer = findCustomerByPhone(customerPhone, tenantId);
    if (!customer || (!requestHasAdminSession(req, tenantId) && !requestOwnsCustomer(req, customer))) {
      res.status(403).json({ error: "Voce nao tem permissao para acessar estes jogos" });
      return;
    }
    if (!lootboxes[userKey]) lootboxes[userKey] = { boxes: [], history: [] };
    const userLootboxes = lootboxes[userKey];
    res.json({
      available: userLootboxes.boxes.filter(b => b.status === "closed").length,
      boxes: userLootboxes.boxes.filter(b => b.status !== "opened"),
      history: userLootboxes.history
    });
  });
  app.post("/api/lootboxes/:userId/open", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const customerPhone = normalizePhone(req.params.userId) || req.params.userId;
    const userId = tenantCustomerKey(tenantId, customerPhone);
    const customer = findCustomerByPhone(customerPhone, tenantId);
    if (!customer || (!requestHasAdminSession(req, tenantId) && !requestOwnsCustomer(req, customer))) {
      res.status(403).json({ error: "Voce nao tem permissao para abrir estes jogos" });
      return;
    }
    if (!lootboxes[userId]) {
       res.status(400).json({ error: "Nenhuma caixinha disponível" });
       return;
    }

    const box = lootboxes[userId].boxes.find(b => b.status === "closed");
    if (!box) {
       res.status(400).json({ error: "Nenhuma caixinha disponível" });
       return;
    }

    // Lock anti-abuso: a mesma caixinha não pode ser aberta simultaneamente.
    box.status = "opening";

    // Pick from pool
    let wonPrize = null;
    const boxScopeId = box.scopeId || "global";
    const boxEconomy = getLootboxConfigByScope(boxScopeId);
    const boxExperienceType = box.experienceType || boxEconomy.experienceType;
    const boxEffects = box.effects || boxEconomy.effects;
    const boxWheelSegments = box.wheelSegments?.length ? box.wheelSegments : boxEconomy.wheelSegments;
     if (box.lockedPrize) {
         wonPrize = box.lockedPrize;
     }

    box.status = "opened";
    box.openedAt = new Date().toISOString();

    if (wonPrize) {
        box.premiada = true;
        box.premio = wonPrize;
        box.valorPremio = wonPrize.value;
        box.tipoPremio = wonPrize.type;
        if (customer) {
          const ownAffiliate = ensureAffiliateForCustomer(customer);
          ownAffiliate.prizeBalance += wonPrize.value;
          ownAffiliate.commission = ownAffiliate.commissionBalance + ownAffiliate.prizeBalance;
          ownAffiliate.history.push({ amount: wonPrize.value, type: "lootbox_prize", date: box.openedAt });
        }
        lootboxes[userId].history.push({ prize: wonPrize.name, date: box.openedAt, won: true });
        res.json({
          boxId: box.id,
          won: true,
          prize: wonPrize,
          remaining: lootboxes[userId].boxes.filter(b => b.status === "closed").length,
          effects: boxEffects,
          experienceType: boxExperienceType,
          wheelSegments: boxWheelSegments
        });
    } else {
        const nearMissPrize = (boxExperienceType === "wheel" && boxWheelSegments.some(segment => segment.rewardEnabled && segment.reward)
          ? boxWheelSegments.filter(segment => segment.rewardEnabled && segment.reward).map(segment => segment.reward!)
          : boxEconomy.milestones)
          .slice()
          .sort((a, b) => a.everyXTickets - b.everyXTickets)[0];
         lootboxes[userId].history.push({ prize: "Nao foi dessa vez, tente de novo.", date: box.openedAt, won: false });
        res.json({
          boxId: box.id,
          won: false,
          nearMiss: nearMissPrize ? {
            name: nearMissPrize.name,
            value: nearMissPrize.value,
            type: nearMissPrize.type,
            rarity: nearMissPrize.tier === "alto" ? "legendary" : nearMissPrize.tier === "medio" ? "epic" : "rare",
             progressText: "Nao foi dessa vez, tente de novo."
           } : null,
           message: "Nao foi dessa vez, tente de novo.",
          remaining: lootboxes[userId].boxes.filter(b => b.status === "closed").length,
          effects: boxEffects,
          experienceType: boxExperienceType,
          wheelSegments: boxWheelSegments
        });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const staticCandidates = Array.from(new Set([
      path.join(process.cwd(), "dist", "client"),
      path.join(process.cwd(), "dist"),
      path.join(process.cwd(), "client", "dist"),
      process.cwd(),
      path.join(__dirname, "client"),
      __dirname,
      path.join(__dirname, "..", "dist", "client"),
      path.join(__dirname, "..", "dist")
    ].map(candidate => path.resolve(candidate))));
    const staticRoot = staticCandidates.find(candidate => existsSync(path.join(candidate, "index.html"))) || __dirname;
    const indexHtmlPath = path.join(staticRoot, "index.html");
    console.info(`[spa] build dir detectado: ${staticRoot}`);
    console.info(`[spa] index path detectado: ${indexHtmlPath}`);
    app.get("/sw.js", (_req, res, next) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      next();
    });
    app.use(express.static(staticRoot));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) {
        res.status(404).json({ error: "Endpoint nao encontrado" });
        return;
      }
      if (!existsSync(indexHtmlPath)) {
        res.status(500).send("Frontend build nao encontrado");
        return;
      }
      res.sendFile(indexHtmlPath);
    });
  }

  await hydratePersistentState();
  const paymentWorkerIntervalMs = isProductionRuntime ? 15_000 : 8_000;
  const paymentWorkerInterval = setInterval(() => void processPaymentQueue(), paymentWorkerIntervalMs);
  paymentWorkerInterval.unref?.();
  const paymentWebhookWorkerInterval = setInterval(() => void processPaymentWebhookQueue(), paymentWorkerIntervalMs);
  paymentWebhookWorkerInterval.unref?.();
  const paymentReconciliationWorkerInterval = setInterval(() => void processPaymentReconciliationQueue(), isProductionRuntime ? 60_000 : 30_000);
  paymentReconciliationWorkerInterval.unref?.();
  const paymentReleaseWorkerInterval = setInterval(() => void processPaymentReleaseQueue(), paymentWorkerIntervalMs);
  paymentReleaseWorkerInterval.unref?.();
  const reservationWorkerInterval = setInterval(() => {
    expireAllReservations();
    schedulePersistentStateSave("reservation-expiration-worker");
  }, 30_000);
  reservationWorkerInterval.unref?.();
  expireAllReservations();
  void processAllPaymentWorkerQueues();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
