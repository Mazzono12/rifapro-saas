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
import { sendMockWhatsAppMessage } from "./src/server/whatsapp/providers/mockWhatsAppProvider";
import { sendMetaCloudWhatsAppMessage } from "./src/server/whatsapp/providers/metaCloudWhatsAppProvider";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const TEST_VIDEO_URL = "/uploads/teste-video-principal-img-4992.mp4";
  const isProductionRuntime = process.env.NODE_ENV === "production" && !process.env.RIFAPRO_TEST_MODE;
  const testEndpointsEnabled = process.env.ENABLE_TEST_ENDPOINTS === "true" || !isProductionRuntime;

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
  let persistentStateReady = false;
  let persistentStateTimer: ReturnType<typeof setTimeout> | null = null;
  let persistentStateSaving = false;
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
    status: "active" | "inactive" | "suspended";
    logo_url: string;
    cor_primaria: string;
    plano: string;
    percentual_plataforma: number;
    criado_em: string;
    atualizado_em: string;
  };
  type SaaSPlanId = "gratis" | "basico" | "profissional" | "premium" | "white-label";
  type SaaSPlan = {
    id: SaaSPlanId;
    nome: string;
    limite_rifas: number;
    limite_vendas_mes: number;
    recursos: string[];
    dominio_proprio: boolean;
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
  type AuthSession = {
    sub: string;
    role: AuthRole;
    tenant_id: string | null;
    email: string;
    provider?: "local" | "supabase";
  };

  const tenantSeedTimestamp = new Date().toISOString();
  const tenants: TenantRecord[] = [
    {
      id: legacyTenantId,
      nome: "Plataforma Principal",
      slug: "principal",
      dominio_customizado: "",
      status: "active",
      logo_url: "",
      cor_primaria: "#06b6d4",
      plano: "plataforma",
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
      plano: "teste",
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
      plano: "teste",
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
      companyName: "NexusDraw",
      logoUrl: "",
      logoAlt: "NexusDraw"
    },
    theme: {
      defaultTheme: "apple-glass",
      paletteOverrides: {}
    },
    footer: {
      companyName: "NexusDraw",
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
      minWithdrawAmount: 50,
      allowBalancePayments: true
    },
    smsProvider: {
      enabled: false,
      provider: "local",
      sender: "NexusDraw",
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
      mediaType: "video",
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

  function normalizeSettingsShape(sourceSettings: typeof settings) {
    sourceSettings.socialLinks = {
      whatsapp: "",
      instagram: "",
      group: "",
      ...(sourceSettings.socialLinks || {})
    };
    return sourceSettings;
  }

  const tenantSettings: Record<string, typeof settings> = {};
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
  type AffiliateLedger = { amount: number; type: string; date: string };
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
    severity: "low" | "medium" | "high";
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
  type WhatsAppMessageQueueRecord = {
    id: string;
    tenant_id: string;
    order_id?: string;
    customer_id?: string;
    phone: string;
    message_type: "ticket_confirmation" | string;
    message_body: string;
    provider: "mock" | "meta_cloud" | string;
    status: "pending" | "sent" | "failed" | "retrying";
    attempts: number;
    max_attempts: number;
    last_error?: string;
    sent_at?: string;
    created_at: string;
    updated_at: string;
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
    useBalanceForPurchases: boolean;
    enabled: boolean;
    history: AffiliateLedger[];
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
      return [key, gatewaySensitiveFieldPattern.test(key) || isEncryptedGatewayValue(value) ? maskGatewaySecret(value) : String(value)];
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
    pixPayload: string;
    pixGateway?: PixGatewayId | string;
    pixWebhookUrl?: string;
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
    ticketWeights?: Array<{ number: number; weight: number; reason?: string }>;
    gamification?: {
      orderBump?: { offered: boolean; accepted: boolean; tickets: number; discountPercent: number; amount: number };
      luckyHour?: { applied: boolean; type?: string; value?: number; bonusTickets?: number; discount?: number; extraChance?: number };
      doubleChance?: { applied: boolean; weight: number };
      scratchcardEventId?: string;
      mysteryBoxEventId?: string;
      autoPrizes?: string[];
    };
  };
  type GamificationModuleId = "scratchcard" | "winningTicket" | "luckyHour" | "mysteryBox" | "doubleChance" | "extremeTickets" | "buyerRanking" | "orderBump";
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
    statusPagamento: "reserved" | "paid";
    dataCompra: string;
    customer: CustomerRecord;
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
    status: "reserved" | "paid";
    createdAt: string;
  };
  type NumberModePurchase = {
    id: string;
    tenant_id: string;
    mode: NumberModeId;
    numbers: string[];
    amount: number;
    status: "reserved" | "paid";
    createdAt: string;
    customer: CustomerRecord;
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

  let lootboxGuaranteedPool: GatewayPrize[] = [];
  let lootboxGuaranteedPools: Record<string, GatewayPrize[]> = {};

  let affiliates: Record<string, AffiliateRecord> = {};
  let customersByPhone: Record<string, CustomerRecord> = {};
  let customersByCpf: Record<string, CustomerRecord> = {};
  let customerMessages: CustomerMessage[] = [];
  let affiliateWithdrawals: AffiliateWithdrawal[] = [];
  let passwordResetCodes: PasswordResetCode[] = [];
  let supportTickets: SupportTicket[] = [];
  let auditLogs: AuditLog[] = [];
  let paymentWebhookLogs: PaymentWebhookLog[] = [];
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
      mediaType: "video",
      mediaAspect: "wide",
      mediaFit: "cover",
      checkoutMediaUrl: TEST_VIDEO_URL,
      checkoutMediaType: "video",
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
      mediaType: "video",
      mediaAspect: "wide",
      mediaFit: "cover",
      checkoutMediaUrl: TEST_VIDEO_URL,
      checkoutMediaType: "video",
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
    { id: "s1", tenant_id: legacyTenantId, title: "Entregando o Setup!", mediaUrl: TEST_VIDEO_URL, mediaType: "video", duration: 15, active: true },
    { id: "s2", tenant_id: legacyTenantId, title: "Próximo Prêmio", mediaUrl: TEST_VIDEO_URL, mediaType: "video", duration: 15, active: true }
  ];

  let winners = [
    { id: "w1", tenant_id: legacyTenantId, raffleName: "iPhone 15 Pro Max", winnerName: "João Silva", prizeDescription: "Levou o celular com 3 cotas", mediaUrl: TEST_VIDEO_URL, mediaType: "video", date: "2026-05-10T12:00:00Z" }
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

  let fazendinhaConfig = {
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
    mediaType: "video" as "image" | "video" | "youtube" | "vimeo" | "bunny",
    addonSuggestionTickets: 5
  };
  let fazendinhaGroups: FazendinhaGroup[] = fazendinhaSeed.map(([id, nomeBicho, numeros]) => ({
    id,
    tenant_id: legacyTenantId,
    nomeBicho,
    numeros: [...numeros],
    status: "available",
    preco: fazendinhaConfig.pricePerGroup,
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
      mediaType: "video",
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
      mediaType: "video",
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
      mediaType: "video",
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

  // === Anti-Fraud System ===
  const planCatalog: Record<SaaSPlanId, SaaSPlan> = {
    gratis: {
      id: "gratis",
      nome: "Gratis",
      limite_rifas: 1,
      limite_vendas_mes: 100,
      recursos: ["checkout", "pix_basico", "relatorios_basicos"],
      dominio_proprio: false,
      integracoes_liberadas: ["smtp"],
      percentual_comissao: 12
    },
    basico: {
      id: "basico",
      nome: "Basico",
      limite_rifas: 5,
      limite_vendas_mes: 1000,
      recursos: ["checkout", "pix", "relatorios", "afiliados"],
      dominio_proprio: false,
      integracoes_liberadas: ["smtp", "sendpulse"],
      percentual_comissao: 10
    },
    profissional: {
      id: "profissional",
      nome: "Profissional",
      limite_rifas: 25,
      limite_vendas_mes: 10000,
      recursos: ["checkout", "pix", "gamificacao", "relatorios", "afiliados", "integracoes_ads"],
      dominio_proprio: true,
      integracoes_liberadas: ["primepag", "paggue", "smtp", "sendpulse", "metaAds", "googleAds"],
      percentual_comissao: 7.5
    },
    premium: {
      id: "premium",
      nome: "Premium",
      limite_rifas: 100,
      limite_vendas_mes: 50000,
      recursos: ["checkout", "pix", "gamificacao", "relatorios_avancados", "afiliados", "integracoes", "webhooks"],
      dominio_proprio: true,
      integracoes_liberadas: ["primepag", "paggue", "smtp", "sendpulse", "metaAds", "googleAds", "wetalkie", "cashPay", "nuvenda", "fkeProcessor"],
      percentual_comissao: 5
    },
    "white-label": {
      id: "white-label",
      nome: "White-label",
      limite_rifas: 999999,
      limite_vendas_mes: 999999,
      recursos: ["checkout", "pix", "gamificacao", "relatorios_avancados", "afiliados", "integracoes", "webhooks", "white_label"],
      dominio_proprio: true,
      integracoes_liberadas: ["primepag", "paggue", "smtp", "sendpulse", "metaAds", "googleAds", "wetalkie", "cashPay", "nuvenda", "fkeProcessor"],
      percentual_comissao: 2.5
    }
  };
  const planAliases: Record<string, SaaSPlanId> = { free: "gratis", basic: "basico", pro: "profissional", profissional: "profissional", teste: "premium", enterprise: "white-label", whitelabel: "white-label" };
  const securityLogs: SecurityLog[] = [];
  let paymentQueue: PaymentQueueJob[] = [];
  let whatsappProviderConfigs: WhatsAppProviderConfigRecord[] = [];
  let whatsappMessageQueue: WhatsAppMessageQueueRecord[] = [];
  
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
    if ("status" in tenant && tenant.status) return tenant.status === "active";
    if ("ativo" in tenant) return tenant.ativo !== false;
    return true;
  }

  function normalizeTenantRecord(row: Record<string, any>): TenantRecord {
    const now = new Date().toISOString();
    const active = row.status ? row.status === "active" : row.ativo !== false;
    return {
      id: String(row.id || ""),
      nome: String(row.nome || row.name || row.slug || "Tenant"),
      slug: String(row.slug || row.id || "tenant").trim().toLowerCase(),
      dominio: row.dominio ? normalizeDomainName(row.dominio) : undefined,
      dominio_customizado: normalizeDomainName(row.dominio_customizado || row.dominio || ""),
      status: active ? "active" : "inactive",
      logo_url: String(row.logo_url || ""),
      cor_primaria: String(row.cor_primaria || "#06b6d4"),
      plano: String(row.plano || "basico"),
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
      [tenant.dominio, tenant.dominio_customizado].some(domain => normalizeDomainName(domain) === host)
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
      ? tenants.find(tenant => tenant.id === session.tenant_id && tenant.status === "active")
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

  app.get("/api/public/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/public/tenant-debug", async (req, res) => {
    res.json(await buildPublicTenantDebug(req));
  });

  function adminCanAccessTenant(req: express.Request, tenantId: string) {
    const session = getAuthSession(req);
    return Boolean(session && (normalizeAuthRole(session.role) === "superadmin" || session.tenant_id === tenantId));
  }

  function getTenantPlan(tenantIdOrPlan: string) {
    const rawPlan = tenants.find(tenant => tenant.id === tenantIdOrPlan)?.plano || tenantIdOrPlan || "basico";
    const normalized = planAliases[String(rawPlan).toLowerCase()] || String(rawPlan).toLowerCase();
    return planCatalog[normalized as SaaSPlanId] || planCatalog.basico;
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

  function scoped<T extends { tenant_id: string }>(items: T[], req: express.Request) {
    const session = getAuthSession(req);
    return normalizeAuthRole(session?.role) === "superadmin" ? items : items.filter(item => item.tenant_id === resolveRequestTenantId(req));
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
    res.json(Object.values(planCatalog));
  });

  app.post("/api/superadmin/tenants", (req, res) => {
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
    const plan = getTenantPlan(String(req.body.plano || "basico"));
    const tenant: TenantRecord = {
      id: String(req.body.id || createPublicId("TENANT_")),
      nome,
      slug,
      dominio_customizado: String(req.body.dominio_customizado || "").trim(),
      status: ["active", "inactive", "suspended"].includes(String(req.body.status)) ? req.body.status : "active",
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
    recordSecurityEvent({
      tenant_id: tenant.id,
      action: "TENANT_CREATED",
      ip: String(req.ip || req.socket.remoteAddress || ""),
      status: "INFO",
      severity: "low",
      actor: getAuthSession(req)?.email,
      detail: tenant.slug
    });
    res.status(201).json(tenant);
  });

  app.put("/api/superadmin/tenants/:id", (req, res) => {
    const tenant = tenants.find(item => item.id === req.params.id);
    if (!tenant) {
      res.status(404).json({ error: "Tenant nao encontrado" });
      return;
    }
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
    if (["active", "inactive", "suspended"].includes(String(req.body.status))) {
      tenant.status = req.body.status;
    }
    tenant.atualizado_em = new Date().toISOString();
    if (oldDomain !== tenant.dominio_customizado) {
      recordSecurityEvent({ tenant_id: tenant.id, action: "DOMAIN_CHANGED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "WARN", severity: "medium", actor: getAuthSession(req)?.email, detail: `${oldDomain || "(vazio)"} -> ${tenant.dominio_customizado || "(vazio)"}` });
    }
    if (oldPlan !== tenant.plano) {
      recordSecurityEvent({ tenant_id: tenant.id, action: "PLAN_CHANGED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "low", actor: getAuthSession(req)?.email, detail: `${oldPlan} -> ${tenant.plano}` });
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
    if (!["active", "inactive", "suspended"].includes(status)) {
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
        queuedPayments: paymentQueue.filter(job => ["pending", "processing"].includes(job.status)).length
      },
      charts: globalRevenue.charts,
      tenants: tenantSummaries,
      ranking: tenantRanking,
      plans: Object.values(planCatalog)
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
    res.json(paymentQueue.map(job => ({
      ...job,
      tenant: tenants.find(tenant => tenant.id === job.tenant_id)?.nome || job.tenant_id
    })));
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
    const processed = await processPaymentQueue(Number(req.body?.limit || 50));
    res.json({
      processed,
      jobs: paymentQueue.map(job => ({
        ...job,
        tenant: tenants.find(tenant => tenant.id === job.tenant_id)?.nome || job.tenant_id
      }))
    });
  });

  app.post("/api/superadmin/payments/reconcile", (req, res) => {
    const stalePending = purchases.filter(purchase => purchase.status === "pending" && Date.now() - new Date(purchase.createdAt).getTime() > 15 * 60 * 1000);
    stalePending.forEach(purchase => enqueuePaymentJob({
      tenant_id: purchase.tenant_id,
      gateway: String(purchase.pixGateway || "unknown"),
      purchaseId: purchase.purchaseId,
      eventStatus: "reconciliation.pending",
      payload: { purchaseId: purchase.purchaseId, status: "reconcile" }
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
    if (role !== "superadmin" && !tenants.some(tenant => tenant.id === tenantId && tenant.status === "active")) {
      res.status(400).json({ error: "Tenant ativo obrigatorio para este papel" });
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

  app.use(resolveTenant);

  app.use("/api/admin", rateLimiter, requireTenantAdmin);
  app.use("/api/admin", (req, res, next) => {
    res.on("finish", () => {
      if (req.method !== "GET") {
        recordAudit(`${req.method} ${req.path}`, req, res.statusCode);
      }
    });
    next();
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
      if (config.secret) headers["X-RifaPro-Secret"] = config.secret;
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

  function ensureAffiliateForCustomer(customer: CustomerRecord) {
    const key = tenantCustomerKey(customer.tenant_id, customer.affiliateRefCode);
    if (!affiliates[key]) {
      affiliates[key] = {
        tenant_id: customer.tenant_id,
        refCode: customer.affiliateRefCode,
        customerId: customer.id,
        clicks: 0,
        conversions: 0,
        referredCustomers: 0,
        revenue: 0,
        commission: 0,
        commissionBalance: 0,
        prizeBalance: 0,
        useBalanceForPurchases: false,
        enabled: customer.totalTickets >= settings.affiliateProgram.minTicketsToJoin,
        history: []
      };
    }
    affiliates[key].commissionBalance ??= affiliates[key].commission || 0;
    affiliates[key].prizeBalance ??= 0;
    affiliates[key].commission =
      affiliates[key].commissionBalance + affiliates[key].prizeBalance;
    affiliates[key].enabled =
      Boolean(affiliates[key].enabled) ||
      customer.totalTickets >= settings.affiliateProgram.minTicketsToJoin;
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
      return existing;
    }

    if (!payload.name || String(payload.name).trim().length < 3) throw new Error("Nome obrigatório");
    if (!phone || phone.length < 10) throw new Error("Telefone inválido");
    if (!cpf || cpf.length !== 11) throw new Error("CPF inválido");
    if (!accessPassword) throw new Error("Senha de 6 dígitos obrigatória");

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
    ensureAffiliateForCustomer(customer);

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

  function normalizeFazendinhaNumber(input: unknown) {
    const digits = String(input ?? "").replace(/\D/g, "").slice(-2);
    if (!digits) return "";
    return digits.padStart(2, "0");
  }

  function resetFazendinhaRound(tenantId = legacyTenantId) {
    fazendinhaGroups = fazendinhaSeed.map(([id, nomeBicho, numeros]) => ({
      id,
      tenant_id: tenantId,
      nomeBicho,
      numeros: [...numeros],
      status: "available",
      preco: fazendinhaConfig.pricePerGroup,
      imagemUrl: ""
    }));
    fazendinhaCompras = [];
    fazendinhaResultados = [];
    fazendinhaGanhadores = [];
    fazendinhaConfig.resultNumber = "";
    fazendinhaConfig.resultSource = "";
    fazendinhaConfig.status = "active";
    fazendinhaConfig.lootboxConfig = createFazendinhaLootboxConfig({
      ...fazendinhaConfig.lootboxConfig,
      prizeClaimed: false,
      winnerPurchaseId: undefined
    });
  }

  function resolveFazendinhaWinner(numeroSorteado: string, origemResultado = "Loteria", tenantId = legacyTenantId) {
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
    fazendinhaConfig.resultNumber = normalized;
    fazendinhaConfig.resultSource = origemResultado;
    fazendinhaConfig.status = "closed";

    const winner: FazendinhaWinner = purchase && group
      ? {
          id: createPublicId("FG_"),
          tenant_id: tenantId,
          usuarioId: purchase.usuarioId,
          grupoId: group.id,
          nomeBicho: group.nomeBicho,
          numeroSorteado: normalized,
          premio: fazendinhaConfig.mainPrize,
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

  function normalizeModeNumber(mode: NumberModeId, input: unknown) {
    const config = numberModeConfigs[mode];
    const digits = String(input ?? "").replace(/\D/g, "");
    if (digits.length > config.digits) return "";
    const value = Number(digits || 0);
    const max = Math.pow(10, config.digits) - 1;
    if (!Number.isInteger(value) || value < 0 || value > max) return "";
    return digits.padStart(config.digits, "0");
  }

  function normalizeModeResultNumber(mode: NumberModeId, input: unknown) {
    const config = numberModeConfigs[mode];
    const digits = String(input ?? "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.slice(-config.digits).padStart(config.digits, "0");
  }

  function getModeNumbers(mode: NumberModeId, tenantId = legacyTenantId) {
    const digits = numberModeConfigs[mode].digits;
    const max = Math.pow(10, digits);
    const sold = new Set(numberModeBets.filter(bet => bet.tenant_id === tenantId && bet.mode === mode).map(bet => bet.number));
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
      const config = numberModeConfigs[mode];
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
    const config = numberModeConfigs[mode];
    const number = normalizeModeResultNumber(mode, resultNumber);
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

  const RESERVATION_TTL_MS = Number(process.env.PURCHASE_RESERVATION_TTL_MS || 15 * 60 * 1000);

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
    expirePendingReservations(raffle.tenant_id, raffle.id);
    return assignAvailableNumbers(raffle, quantity);
  }

  function sanitizeRaffleForPublic(raffle: typeof raffles[number]) {
    const { soldNumbers, pixConfig, n8nEnabled, ...safeRaffle } = raffle;
    return {
      ...safeRaffle,
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
    return safeRaffle;
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
    res.json(raffles.filter(raffle => raffle.tenant_id === tenantId && raffle.status === "active").map(sanitizeRaffleForPublic));
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
    const affiliate = ensureAffiliateForCustomer(customer);
    res.json(stripSensitiveCustomerFields({ ...customer, affiliate }));
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
      customer: { ...customer, affiliate: ensureAffiliateForCustomer(customer) }
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
    res.json(stripSensitiveCustomerFields({ ...customer, affiliate: ensureAffiliateForCustomer(customer) }));
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
    const receivedSecret = String(req.headers["x-rifapro-secret"] || req.body.secret || "");
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
    ensureAffiliateForCustomer(customer);
  }

  function buildAdminCustomerProfile(customer: CustomerRecord) {
    return {
      ...customer,
      affiliate: ensureAffiliateForCustomer(customer),
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
    const config = numberModeConfigs[purchase.mode];
    if (!config) throw new Error("Modalidade da compra nao encontrada");
    const numbers = Array.from(new Set(
      (Array.isArray(numbersInput) ? numbersInput : String(numbersInput || "").split(/[,\s]+/))
        .map(value => normalizeModeNumber(purchase.mode, value))
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
    purchase.valorPago = Number((groups.reduce((sum, group) => sum + Number(group.preco || fazendinhaConfig.pricePerGroup), 0)).toFixed(2));
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
    res.json(buildAdminCustomerProfile(customer));
  });

  app.put("/api/admin/customers/:id/full", (req, res) => {
    const customer = Object.values(customersByPhone).find(c => c.id === req.params.id && adminCanAccessTenant(req, c.tenant_id));
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

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
    res.json(buildAdminCustomerProfile(customer));
  });

  app.post("/api/admin/customers/:id/block", (req, res) => {
    const customer = Object.values(customersByPhone).find(c => c.id === req.params.id && adminCanAccessTenant(req, c.tenant_id));
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    customer.blocked = Boolean(req.body.blocked ?? true);
    customer.blockedReason = customer.blocked ? String(req.body.reason || "Bloqueado pelo administrador") : "";
    recordAudit(customer.blocked ? "CUSTOMER_BLOCKED" : "CUSTOMER_UNBLOCKED", req, 200, customer.id);
    res.json(buildAdminCustomerProfile(customer));
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

  app.post("/api/checkout/preview", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const tenant = tenants.find(item => item.id === tenantId);
    if (!tenant || tenant.status !== "active") {
      res.status(403).json({ error: "Tenant inativo ou indisponivel para compras" });
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
        if (raffle.status !== "active") return res.status(403).json({ error: "Rifa encerrada ou indisponivel" });
        if (tickets === null) return res.status(400).json({ error: "Quantidade invalida" });
        expirePendingReservations(tenantId, raffle.id);
        const pixConfig = getRafflePixConfig(raffle);
        if (!pixConfig.enabled) return res.status(503).json({ error: "Gateway PIX indisponivel para este sorteio" });

        const addonTickets = normalizeTickets(req.body.addon?.tickets) || 0;
        const addonRaffle = req.body.addon?.raffleId ? raffles.find(item => item.tenant_id === tenantId && item.id === req.body.addon.raffleId) : null;
        if (addonRaffle) expirePendingReservations(tenantId, addonRaffle.id);

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
        const subtotal = tickets * raffle.price + (addonRaffle ? addonTickets * addonRaffle.price : 0) + orderBumpAmount;
        const couponBenefit = calculateCouponBenefit(coupon, subtotal, tickets);
        const total = Math.max(0, Number((subtotal - couponBenefit.discount - luckyDiscount).toFixed(2)));
        const quantity = tickets + couponBenefit.bonusTickets + luckyBonusTickets + luckyExtraChance + orderBumpTickets;
        if (raffle.soldTickets + quantity > raffle.totalTickets) return res.status(409).json({ error: "Cotas insuficientes para esta compra" });
        if (addonRaffle && addonRaffle.soldTickets + addonTickets > addonRaffle.totalTickets) return res.status(409).json({ error: "Cotas adicionais insuficientes" });

        const customerPayload = req.body.customer || {};
        const phone = normalizePhone(customerPayload.phone || req.body.contact);
        const existingCustomer = phone ? findCustomerByPhone(phone, tenantId) : undefined;
        if (existingCustomer && req.body.useBalance) {
          const ownAffiliate = ensureAffiliateForCustomer(existingCustomer);
          const walletBalance = (ownAffiliate.commissionBalance || 0) + (ownAffiliate.prizeBalance || 0);
          const tenantScopedSettings = getTenantSettings(tenantId);
          walletUsage.enabled = Boolean(tenantScopedSettings.affiliateProgram.allowBalancePayments && ownAffiliate.useBalanceForPurchases && walletBalance > 0);
          walletUsage.amount = walletUsage.enabled ? Math.min(total, walletBalance) : 0;
        }

        if (couponBenefit.bonusTickets || luckyBonusTickets || luckyExtraChance) warnings.push("Bonus recalculado pelo servidor antes da reserva.");
        res.json({
          quantity,
          subtotal,
          total,
          pixAmount: Math.max(0, Number((total - walletUsage.amount).toFixed(2))),
          gateway: pixConfig.gateway,
          packageLabel: tickets >= 100 ? `${tickets.toLocaleString("pt-BR")} cotas` : undefined,
          bonuses: {
            bonusTickets: couponBenefit.bonusTickets + luckyBonusTickets + luckyExtraChance + orderBumpTickets,
            doubleChance: Boolean(gamificationConfig.modules.doubleChance && isWithinWindow(Date.now(), gamificationConfig.doubleChance.startsAt, gamificationConfig.doubleChance.endsAt) && quantity >= gamificationConfig.doubleChance.minTickets),
            roulettes: Math.floor(quantity / 700),
            lootboxes: raffle.lootboxEnabled ? Math.floor(quantity / 1000) : 0,
            scratchcards: Math.floor(quantity / 1800),
            description: orderBump ? "Compra em dobro aplicada no resumo" : undefined
          },
          walletUsage,
          affiliateInfo,
          warnings
        });
        return;
      }

      if (type === "fazendinha") {
        if (!fazendinhaConfig.enabled || fazendinhaConfig.status !== "active") return res.status(403).json({ error: "A Fazendinha nao esta ativa no momento" });
        if (!tenantPixGateways.pix?.enabled) return res.status(503).json({ error: "Gateway PIX indisponivel" });
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
            lootboxes: fazendinhaConfig.lootboxEnabled ? selectedGroups.length : 0,
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
        const config = numberModeConfigs[mode];
        if (!config || config.tenant_id !== tenantId) return res.status(404).json({ error: "Modalidade nao encontrada" });
        if (!config.enabled || config.status !== "active") return res.status(403).json({ error: "Modalidade indisponivel no momento" });
        if (!tenantPixGateways.pix?.enabled) return res.status(503).json({ error: "Gateway PIX indisponivel" });
        const requestedNumbers: unknown[] = Array.isArray(req.body.numbers) ? req.body.numbers : [];
        const numbers = Array.from(new Set(requestedNumbers.map(item => normalizeModeNumber(mode, item)).filter((number): number is string => Boolean(number))));
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

  app.post("/api/raffles/:id/buy", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
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
    const subtotalAmount = tickets * raffle.price + (addonRaffle ? addonTickets * addonRaffle.price : 0) + orderBumpAmount;
    const couponBenefit = calculateCouponBenefit(coupon, subtotalAmount, tickets);
    const amount = Math.max(0, Number((subtotalAmount - couponBenefit.discount - luckyDiscount).toFixed(2)));
    const effectiveTickets = tickets + couponBenefit.bonusTickets + luckyBonusTickets + luckyExtraChance + orderBumpTickets;
    if (raffle.soldTickets + effectiveTickets > raffle.totalTickets) {
      res.status(400).json({ error: "Quantidade com bônus indisponível" });
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
    const reservedUntil = new Date(Date.now() + RESERVATION_TTL_MS).toISOString();
    
    const ownAffiliate = ensureAffiliateForCustomer(customer);
    const walletBalance = (ownAffiliate.commissionBalance || 0) + (ownAffiliate.prizeBalance || 0);
    const tenantScopedSettings = getTenantSettings(tenantId);
    const balancePayment = useBalance && tenantScopedSettings.affiliateProgram.allowBalancePayments && ownAffiliate.useBalanceForPurchases && walletBalance >= amount ? amount : 0;
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
      pixPayload: buildPixPayload(payableAmount, raffle, purchaseId),
      pixGateway: pixConfig.gateway,
      pixWebhookUrl: pixConfig.webhookUrl,
      createdAt: new Date().toISOString(),
      customer,
      paidWithBalance: balancePayment,
      couponCode: coupon?.code,
      discountAmount: couponBenefit.discount,
      bonusTickets: couponBenefit.bonusTickets + luckyBonusTickets + luckyExtraChance,
      gamification: {
        orderBump: orderBump ? { offered: true, accepted: true, tickets: orderBumpTickets, discountPercent: orderBumpDiscount, amount: orderBumpAmount } : (getActiveOrderBump(gamificationConfig) ? { offered: true, accepted: false, tickets: 0, discountPercent: 0, amount: 0 } : undefined),
        luckyHour: luckyHour ? { applied: true, type: luckyHour.type, value: luckyHour.value, bonusTickets: luckyBonusTickets, discount: luckyDiscount, extraChance: luckyExtraChance } : { applied: false },
        doubleChance: gamificationConfig.modules.doubleChance && isWithinWindow(Date.now(), gamificationConfig.doubleChance.startsAt, gamificationConfig.doubleChance.endsAt) && effectiveTickets >= gamificationConfig.doubleChance.minTickets
          ? { applied: true, weight: Math.max(2, Number(gamificationConfig.doubleChance.weight || 2)) }
          : { applied: false, weight: 1 }
      }
    };

    if (coupon) coupon.used++;

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
        pixPayload: purchase.pixPayload,
        pixGateway: pixConfig.gateway,
        pixWebhookUrl: pixConfig.webhookUrl,
        createdAt: purchase.createdAt,
        customer
      }];
    }

    if (balancePayment > 0) {
      debitAffiliateWallet(ownAffiliate, balancePayment);
      ownAffiliate.history.push({ amount: -balancePayment, type: "balance_purchase", date: new Date().toISOString() });
    }
    
    purchases.push(purchase);
    if (purchase.linkedPurchases) purchases.push(...purchase.linkedPurchases);
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
    res.json({
      config: fazendinhaConfig,
      groups: fazendinhaGroups.filter(item => item.tenant_id === tenantId),
      purchases: fazendinhaCompras.filter(item => item.tenant_id === tenantId),
      winners: fazendinhaGanhadores.filter(item => item.tenant_id === tenantId).slice(0, 8),
      results: fazendinhaResultados.filter(item => item.tenant_id === tenantId).slice(0, 5)
    });
  });

  app.get("/api/fazendinha/customer/:customerId/history", (req, res) => {
    res.json(fazendinhaCompras.filter(item => item.tenant_id === resolveRequestTenantId(req) && item.usuarioId === req.params.customerId));
  });

  app.get("/api/fazendinha/addon-suggestion", (req, res) => {
    const suggestion = raffles.find(r => r.tenant_id === resolveRequestTenantId(req) && r.status === "active" && r.soldTickets < r.totalTickets);
    if (!suggestion) {
      res.status(404).json({ error: "Nenhuma rifa ativa para sugestao" });
      return;
    }
    const tickets = Math.max(1, Number(fazendinhaConfig.addonSuggestionTickets || 5));
    const { soldNumbers, ...safeRaffle } = suggestion;
    res.json({ raffle: safeRaffle, tickets, amount: tickets * suggestion.price });
  });

  app.get("/api/modalidades", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
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
        ...fazendinhaConfig,
        id: "fazendinha",
        mediaUrl: fazendinhaConfig.mediaUrl,
        mediaType: fazendinhaConfig.mediaType,
        ranking: fazendinhaCompras.filter(item => item.tenant_id === tenantId).slice(0, 5)
      },
      numberModes: Object.values(numberModeConfigs)
        .filter(config => config.tenant_id === tenantId && config.enabled && config.status === "active")
        .map(config => ({
          ...config,
          ranking: getModeRanking(config.id, tenantId)
        }))
    });
  });

  app.get("/api/modalidades/:mode", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const mode = req.params.mode as NumberModeId;
    if (!numberModeConfigs[mode] || numberModeConfigs[mode].tenant_id !== tenantId) {
      res.status(404).json({ error: "Modalidade nao encontrada" });
      return;
    }
    const customerId = String(req.query.customerId || "");
    res.json({
      config: numberModeConfigs[mode],
      numbers: getModeNumbers(mode, tenantId),
      purchases: numberModePurchases.filter(item => item.tenant_id === tenantId && item.mode === mode),
      ranking: getModeRanking(mode, tenantId),
      winners: numberModeWinners.filter(item => item.tenant_id === tenantId && item.mode === mode).slice(0, 10),
      history: customerId ? numberModePurchases.filter(item => item.tenant_id === tenantId && item.mode === mode && item.customer.id === customerId) : []
    });
  });

  app.post("/api/modalidades/:mode/buy", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const mode = req.params.mode as NumberModeId;
    const config = numberModeConfigs[mode];
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
      .map((item: unknown) => normalizeModeNumber(mode, item))
      .filter((number): number is string => Boolean(number));
    const numbers: string[] = Array.from(new Set<string>(normalizedNumbers));
    if (!numbers.length) {
      res.status(400).json({ error: "Selecione ao menos um numero valido" });
      return;
    }
    const sold = new Set(numberModeBets.filter(bet => bet.tenant_id === tenantId && bet.mode === mode).map(bet => bet.number));
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

    const paid = req.body.statusPagamento === "paid" || req.body.simulatePayment !== false;
    const purchase: NumberModePurchase = {
      id: createPublicId("MO_"),
      tenant_id: tenantId,
      mode,
      numbers,
      amount: numbers.length * config.price,
      status: paid ? "paid" : "reserved",
      createdAt: new Date().toISOString(),
      customer
    };
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
        createdAt: purchase.createdAt
      });
    });

    config.lootboxConfig = createScopedLootboxConfig(config.lootboxConfig);
    const earnedLootboxes = paid && config.lootboxEnabled
      ? processLootboxDrops(customer.phone, numbers.length, purchase.id, config.lootboxConfig, `mode:${mode}`, mode, tenantId)
      : 0;
    purchase.earnedLootboxes = earnedLootboxes;
    res.json(stripSensitiveCustomerFields({ purchase, pixPayload: buildPixPayload(purchase.amount, undefined, purchase.id, tenantId), earnedLootboxes }));
  });

  app.post("/api/modalidades/purchases/:purchaseId/confirm-payment", (req, res) => {
    res.status(403).json({ error: "Confirmacao manual pelo cliente nao e permitida. Use Verificar pagamento e aguarde o webhook do gateway." });
  });

  function createFazendinhaPurchase(req: express.Request, res: express.Response, requestedGroupIds: string[]) {
    const tenantId = resolveRequestTenantId(req);
    if (!fazendinhaConfig.enabled || fazendinhaConfig.status !== "active") {
      res.status(403).json({ error: "A Fazendinha nao esta ativa no momento" });
      return null;
    }
    if (!gateways.pix?.enabled) {
      res.status(503).json({ error: "PIX temporariamente desabilitado pelo admin" });
      return null;
    }
    const groupIds = Array.from(new Set(requestedGroupIds.filter(Boolean)));
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

    const paid = req.body.statusPagamento === "paid" || req.body.simulatePayment !== false;
    const numeros = selectedGroups.flatMap(group => group.numeros);
    const amount = selectedGroups.reduce((sum, group) => sum + group.preco, 0);
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
      statusPagamento: paid ? "paid" : "reserved",
      dataCompra: new Date().toISOString(),
      customer
    };

    const addonTickets = normalizeTickets(req.body.addon?.tickets) || Math.max(1, Number(fazendinhaConfig.addonSuggestionTickets || 5));
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
        pixPayload: "",
        createdAt: purchase.dataCompra,
        customer
      };
      if (paid) confirmPurchase(linked);
      purchases.push(linked);
      purchase.linkedPurchases = [linked];
      purchase.valorPago += linked.amount;
    }

    const earnedLootboxes = paid && fazendinhaConfig.lootboxEnabled
      ? processFazendinhaLootboxDrops(customer.phone, selectedGroups.map(group => group.id), purchase.id, tenantId)
      : 0;
    purchase.earnedLootboxes = earnedLootboxes;
    if (paid) {
      customer.totalTickets += numeros.length;
      ensureAffiliateForCustomer(customer);
    }
    selectedGroups.forEach(group => {
      group.status = paid ? "sold" : "reserved";
      group.compradorId = customer.id;
      group.compraId = purchase.id;
    });
    fazendinhaCompras.unshift(purchase);
    const pixPayload = buildPixPayload(purchase.valorPago, undefined, purchase.id, tenantId);
    purchase.linkedPurchases?.forEach(linked => {
      linked.pixPayload = pixPayload;
    });
    return { purchase, groups: selectedGroups, pixPayload, earnedLootboxes };
  }

  function confirmFazendinhaPurchase(purchase: FazendinhaPurchase) {
    const groups = fazendinhaGroups.filter(group => group.tenant_id === purchase.tenant_id && (purchase.grupoIds?.includes(group.id) || group.compraId === purchase.id));
    if (purchase.statusPagamento !== "paid") {
      purchase.statusPagamento = "paid";
      groups.forEach(group => {
        group.status = "sold";
        group.compradorId = purchase.usuarioId;
        group.compraId = purchase.id;
      });
      purchase.customer.totalTickets += purchase.numeros.length;
      ensureAffiliateForCustomer(purchase.customer);
      purchase.linkedPurchases?.forEach(confirmPurchase);
      purchase.earnedLootboxes = fazendinhaConfig.lootboxEnabled
        ? processFazendinhaLootboxDrops(purchase.customer.phone, groups.map(group => group.id), purchase.id, purchase.tenant_id)
        : 0;
    }

    const pixPayload = buildPixPayload(purchase.valorPago, undefined, purchase.id, purchase.tenant_id);
    return {
      purchase,
      groups,
      pixPayload,
      earnedLootboxes: purchase.earnedLootboxes || 0
    };
  }

  app.post("/api/fazendinha/buy", (req, res) => {
    const groupIds = Array.isArray(req.body.groupIds) ? req.body.groupIds.map(String) : [];
    const result = createFazendinhaPurchase(req, res, groupIds);
    if (!result) return;
    res.json(stripSensitiveCustomerFields(result));
  });

  app.post("/api/fazendinha/groups/:groupId/buy", (req, res) => {
    const result = createFazendinhaPurchase(req, res, [req.params.groupId]);
    if (!result) return;
    res.json(stripSensitiveCustomerFields({ ...result, group: result.groups[0] }));
  });

  app.post("/api/fazendinha/purchases/:purchaseId/confirm-payment", (req, res) => {
    res.status(403).json({ error: "Confirmacao manual pelo cliente nao e permitida. Use Verificar pagamento e aguarde o webhook do gateway." });
  });

  app.get("/api/admin/fazendinha", (req, res) => {
    res.json({
      config: fazendinhaConfig,
      groups: scoped(fazendinhaGroups, req),
      purchases: scoped(fazendinhaCompras, req),
      results: scoped(fazendinhaResultados, req),
      winners: scoped(fazendinhaGanhadores, req)
    });
  });

  app.put("/api/admin/fazendinha/config", (req, res) => {
    fazendinhaConfig = {
      ...fazendinhaConfig,
      ...req.body,
      lootboxConfig: createFazendinhaLootboxConfig(req.body.lootboxConfig || fazendinhaConfig.lootboxConfig)
    };
    fazendinhaGroups = fazendinhaGroups.map(group => adminCanAccessTenant(req, group.tenant_id) ? ({
      ...group,
      preco: req.body.pricePerGroup !== undefined && group.status === "available"
        ? Number(req.body.pricePerGroup)
        : group.preco
    }) : group);
    res.json({ config: fazendinhaConfig, groups: scoped(fazendinhaGroups, req) });
  });

  app.post("/api/admin/fazendinha/result", (req, res) => {
    if (fazendinhaConfig.status === "closed" && fazendinhaConfig.resultNumber) {
      res.status(409).json({ error: "Rodada ja encerrada. Resete a rodada para lançar um novo resultado." });
      return;
    }
    const numeroSorteado = normalizeFazendinhaNumber(req.body.numeroSorteado);
    if (!numeroSorteado) {
      res.status(400).json({ error: "Numero sorteado invalido" });
      return;
    }
    res.json(resolveFazendinhaWinner(numeroSorteado, req.body.origemResultado || "Loteria", resolveRequestTenantId(req)));
  });

  app.get("/api/admin/modalidades", (req, res) => {
    res.json({
      configs: Object.values(numberModeConfigs).filter(item => adminCanAccessTenant(req, item.tenant_id)),
      purchases: scoped(numberModePurchases, req),
      bets: scoped(numberModeBets, req),
      winners: scoped(numberModeWinners, req),
      fazendinha: {
        config: fazendinhaConfig,
        groups: scoped(fazendinhaGroups, req),
        purchases: scoped(fazendinhaCompras, req),
        winners: scoped(fazendinhaGanhadores, req)
      }
    });
  });

  app.put("/api/admin/modalidades/:mode/config", (req, res) => {
    const mode = req.params.mode as NumberModeId;
    if (!numberModeConfigs[mode] || !adminCanAccessTenant(req, numberModeConfigs[mode].tenant_id)) {
      res.status(404).json({ error: "Modalidade nao encontrada" });
      return;
    }
    numberModeConfigs[mode] = {
      ...numberModeConfigs[mode],
      ...req.body,
      id: mode,
      tenant_id: numberModeConfigs[mode].tenant_id,
      digits: numberModeConfigs[mode].digits,
      lootboxConfig: createScopedLootboxConfig(req.body.lootboxConfig || numberModeConfigs[mode].lootboxConfig)
    };
    res.json(numberModeConfigs[mode]);
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
    if (!numberModeConfigs[mode] || !adminCanAccessTenant(req, numberModeConfigs[mode].tenant_id)) {
      res.status(404).json({ error: "Modalidade nao encontrada" });
      return;
    }
    const result = resolveSingleNumberModeResult(mode, String(req.body.resultNumber || req.body.officialResult || ""), req.body.origemResultado || "Loteria", resolveRequestTenantId(req));
    if (!result) {
      res.status(400).json({ error: "Resultado invalido para a modalidade" });
      return;
    }
    res.json(result);
  });

  app.post("/api/admin/fazendinha/reset", (req, res) => {
    resetFazendinhaRound(resolveRequestTenantId(req));
    res.json({ config: fazendinhaConfig, groups: scoped(fazendinhaGroups, req) });
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
      fazendinhaConfig.lootboxConfig = createFazendinhaLootboxConfig(fazendinhaConfig.lootboxConfig);
      return fazendinhaConfig.lootboxConfig;
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
     fazendinhaConfig.lootboxConfig = createFazendinhaLootboxConfig(fazendinhaConfig.lootboxConfig);
     const config = fazendinhaConfig.lootboxConfig;
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
      enqueueWhatsAppTicketConfirmation(purchase);
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
      const ownAffiliate = ensureAffiliateForCustomer(purchase.customer);
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

    const referrer = purchase.refCode ? affiliates[tenantCustomerKey(purchase.tenant_id, purchase.refCode)] : undefined;
    if (referrer && referrer.customerId !== purchase.customer?.id) {
      const affiliate = referrer;
      affiliate.conversions++;
      affiliate.revenue += purchase.amount;
      const tenantScopedSettings = getTenantSettings(purchase.tenant_id);
      const comm = purchase.amount * (tenantScopedSettings.affiliateProgram.commissionRate / 100);
      affiliate.commissionBalance += comm;
      affiliate.commission = affiliate.commissionBalance + affiliate.prizeBalance;
      affiliate.history.push({ amount: comm, type: 'conversion', date: new Date().toISOString() });
    }

    purchase.earnedLootboxes = raffle.lootboxEnabled === false
      ? 0
      : processLootboxDrops(purchase.contact, purchase.tickets, purchase.purchaseId, getRaffleLootboxConfig(raffle), `raffle:${raffle.id}`, "raffle", purchase.tenant_id);
    purchase.paymentHistory = purchase.paymentHistory?.length
      ? purchase.paymentHistory
      : [{ status: "paid", label: "Pagamento PIX aprovado", date: new Date().toISOString() }];
    if (getTenantSettings(purchase.tenant_id).n8nIntegration?.sendPurchaseTickets && isRaffleN8nEnabled(raffle)) {
      queueN8nEvent("purchase.tickets_confirmed", buildPurchaseN8nPayload(purchase), { target: purchase.contact, tenantId: purchase.tenant_id });
    }
    enqueueWhatsAppTicketConfirmation(purchase);
    return purchase;
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
    return entry;
  }

  function buildPaymentIdempotencyKey(input: { tenant_id: string; gateway: string; purchaseId?: string; eventStatus?: string; payload?: Record<string, unknown> }) {
    const nestedData = input.payload?.data;
    const nestedDataId = nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)
      ? (nestedData as Record<string, unknown>).id
      : "";
    const explicitEventId = input.payload?.eventId || input.payload?.id || nestedDataId;
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
    return job;
  }

  function markPaymentJob(job: PaymentQueueJob | undefined, status: PaymentQueueJob["status"], error = "") {
    if (!job) return;
    job.status = status;
    job.lastError = error;
    if (status !== "processing") job.attempts += 1;
    job.updatedAt = new Date().toISOString();
    job.nextRetryAt = status === "pending" || status === "failed"
      ? new Date(Date.now() + Math.min(job.attempts + 1, 5) * 30_000).toISOString()
      : "";
  }

  function extractPaymentReference(gateway: string, payload: Record<string, any>) {
    if (gateway === "mercadopago") return payload.external_reference || payload.purchaseId;
    if (gateway === "asaas") return payload.payment?.externalReference || payload.purchaseId;
    return payload.purchaseId || payload.external_reference || payload.reference;
  }

  function extractPaymentStatus(payload: Record<string, any>) {
    return String(
      payload.status ||
      payload.payment?.status ||
      payload.data?.status ||
      payload.event ||
      payload.action ||
      ""
    ).toLowerCase();
  }

  function isPaidPaymentEvent(rawStatus: string) {
    return ["paid", "approved", "confirmed", "received", "payment.updated", "payment.paid"].some(status => rawStatus.includes(status));
  }

  async function processPaymentJob(job: PaymentQueueJob) {
    if (!["pending", "failed"].includes(job.status)) return job;
    if (job.status === "failed" && job.attempts >= job.maxAttempts) return job;
    if (job.nextRetryAt && new Date(job.nextRetryAt).getTime() > Date.now()) return job;

    markPaymentJob(job, "processing");
    const rawStatus = job.eventStatus || extractPaymentStatus(job.payload as Record<string, any>);
    const isPaidEvent = isPaidPaymentEvent(rawStatus);
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
      confirmPurchase(purchase);
      purchase.linkedPurchases?.forEach(confirmPurchase);
      markPaymentJob(job, "paid");
      job.result = { success: true, purchaseId, earnedLootboxes: purchase.earnedLootboxes };
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
        processed += 1;
      }
      schedulePersistentStateSave("payment-worker");
      return processed;
    } finally {
      paymentWorkerRunning = false;
    }
  }

  // Universal Webhook for Payment Gateways (MercadoPago, Asaas, PagBank, etc)
  app.post("/api/webhooks/payment/:gateway", async (req, res) => {
    const gateway = normalizePaymentProvider(req.params.gateway);
    const tenant = getRequestTenant(req);
    const tenantId = tenant?.id || "unknown";
    const tenantPixGateways = tenant ? getTenantGateways(tenant.id) : gateways;
    const gatewayConfig = (tenantPixGateways[gateway] || {}) as Record<string, string>;
    const webhookSecret = tenantPixGateways.pix?.webhookSecret || gatewayConfig.webhookSecret || "";
    const providedSecret = String(req.headers["x-webhook-secret"] || req.headers["x-signature"] || req.query.secret || "");
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
    const purchase = purchases.find(item => item.tenant_id === tenantId && item.purchaseId === orderId);
    if (purchase) {
      const expired = purchase.status === "pending" && Boolean(purchase.reservedUntil) && new Date(purchase.reservedUntil || "").getTime() <= Date.now();
      const status = expired ? "expired" : purchase.status;
      res.json(stripSensitiveCustomerFields({
        orderId,
        type: "raffle",
        status,
        paymentStatus: status,
        paid: purchase.status === "paid",
        expired,
        pixPayload: purchase.status === "pending" && !expired ? purchase.pixPayload : "",
        purchase,
        ticketUrl: purchase.status === "paid" ? buildPublicTicketUrl(purchase) : "",
        message: purchase.status === "paid" ? "Pagamento confirmado" : expired ? "PIX expirado" : purchase.status === "cancelled" ? "Pedido cancelado" : "Aguardando pagamento"
      }));
      return;
    }
    const modePurchase = numberModePurchases.find(item => item.tenant_id === tenantId && item.id === orderId);
    if (modePurchase) {
      res.json(stripSensitiveCustomerFields({
        orderId,
        type: "modalidade",
        status: modePurchase.status,
        paymentStatus: modePurchase.status === "paid" ? "paid" : "pending",
        paid: modePurchase.status === "paid",
        expired: false,
        purchase: modePurchase,
        message: modePurchase.status === "paid" ? "Pagamento confirmado" : "Aguardando pagamento"
      }));
      return;
    }
    const farmPurchase = fazendinhaCompras.find(item => item.tenant_id === tenantId && item.id === orderId);
    if (farmPurchase) {
      res.json(stripSensitiveCustomerFields({
        orderId,
        type: "fazendinha",
        status: farmPurchase.statusPagamento === "paid" ? "paid" : "reserved",
        paymentStatus: farmPurchase.statusPagamento === "paid" ? "paid" : "pending",
        paid: farmPurchase.statusPagamento === "paid",
        expired: false,
        purchase: farmPurchase,
        message: farmPurchase.statusPagamento === "paid" ? "Pagamento confirmado" : "Aguardando pagamento"
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
      message_body: "Mensagem de teste RifaPro/CIFHER via WhatsApp sandbox.",
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

  app.get("/api/admin/payments/queue", (req, res) => {
    res.json(scoped(paymentQueue, req));
  });

  app.post("/api/admin/payments/queue/process", async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const processed = await processPaymentQueue(Number(req.body?.limit || 20));
    res.json({ processed, jobs: paymentQueue.filter(job => job.tenant_id === tenantId) });
  });

  app.get("/api/admin/audit/security", (req, res) => {
    res.json(scoped(securityLogs, req));
  });

  app.post("/api/admin/payments/reconcile", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const stalePending = purchases.filter(purchase => purchase.tenant_id === tenantId && purchase.status === "pending" && Date.now() - new Date(purchase.createdAt).getTime() > 15 * 60 * 1000);
    stalePending.forEach(purchase => enqueuePaymentJob({
      tenant_id: purchase.tenant_id,
      gateway: String(purchase.pixGateway || "unknown"),
      purchaseId: purchase.purchaseId,
      eventStatus: "reconciliation.pending",
      payload: { purchaseId: purchase.purchaseId, status: "reconcile" }
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
    const raffle = raffles.find(item => item.tenant_id === purchase.tenant_id && item.id === purchase.raffleId);
    if (raffle && purchase.numeros.length) releaseReservedNumbers(raffle, purchase.numeros);
    purchase.status = "cancelled";
    purchase.rejectedReason = req.body.reason || "Rejeitada pelo admin";
    purchase.paymentHistory = [
      ...(purchase.paymentHistory || []),
      { status: "cancelled", label: "Pagamento PIX rejeitado", date: new Date().toISOString(), admin: true, reason: purchase.rejectedReason }
    ];
    purchase.linkedPurchases?.forEach(linked => {
      const linkedRaffle = raffles.find(item => item.tenant_id === linked.tenant_id && item.id === linked.raffleId);
      if (linkedRaffle && linked.numeros.length) releaseReservedNumbers(linkedRaffle, linked.numeros);
      linked.status = "cancelled";
      linked.rejectedReason = purchase.rejectedReason;
      linked.paymentHistory = [
        ...(linked.paymentHistory || []),
        { status: "cancelled", label: "Pagamento PIX rejeitado", date: new Date().toISOString(), admin: true, reason: purchase.rejectedReason }
      ];
    });
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

  app.post("/api/admin/raffles/:id/draw", (req, res) => {
    const raffle = raffles.find(r => r.id === req.params.id && adminCanAccessTenant(req, r.tenant_id));
    const number = Number(req.body.number);
    if (!raffle || !Number.isInteger(number) || number < 1 || number > raffle.totalTickets) {
      res.status(400).json({ error: "Informe sorteio e cota validos" });
      return;
    }
    const purchase = purchases.find(p => p.tenant_id === raffle.tenant_id && p.raffleId === raffle.id && p.numeros.includes(number));
    if (!purchase) {
      res.json({
        status: "available",
        number,
        raffle: sanitizeRaffleForAdmin(raffle),
        message: "Cota disponivel. Sorteio sem comprador para este numero."
      });
      return;
    }
    recordSecurityEvent({ tenant_id: raffle.tenant_id, action: "DRAW_EXECUTED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "INFO", severity: "medium", actor: getAuthSession(req)?.email, detail: `${raffle.id}:${number}` });
    res.json({
      status: purchase.status === "paid" ? "winner" : "reserved",
      number,
      raffle: sanitizeRaffleForAdmin(raffle),
      purchase,
      customer: purchase.customer,
      customerProfile: purchase.customer ? buildAdminCustomerProfile(purchase.customer) : null,
      message: purchase.status === "paid" ? "Cota contemplada encontrada." : "Cota reservada, pagamento ainda nao aprovado."
    });
  });

  app.post("/api/admin/tickets/assign", (req, res) => {
    const raffle = raffles.find(r => r.id === req.body.raffleId && adminCanAccessTenant(req, r.tenant_id));
    const number = Number(req.body.number);
    const customer = Object.values(customersByPhone).find(c => c.id === req.body.customerId && raffle && c.tenant_id === raffle.tenant_id);
    if (!raffle || !Number.isInteger(number) || number < 1 || number > raffle.totalTickets || !customer) {
      res.status(400).json({ error: "Rifa, cota ou cliente invalido" });
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
      ensureAffiliateForCustomer(customer);
    }

    res.json({ status: status === "paid" ? "sold" : "reserved", purchase, customer });
  });

  // Admin: Stories CRUD
  app.post("/api/admin/stories", (req, res) => {
    const newStory = { id: createPublicId("S_"), ...req.body, tenant_id: resolveRequestTenantId(req) };
    stories.push(newStory);
    res.json(newStory);
  });
  app.put("/api/admin/stories/:id", (req, res) => {
    const index = stories.findIndex(s => s.id === req.params.id && adminCanAccessTenant(req, s.tenant_id));
    if (index !== -1) {
      stories[index] = { ...stories[index], ...req.body, tenant_id: stories[index].tenant_id };
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
      ...req.body,
      tenant_id: tenantId,
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
      raffles[index] = {
        ...raffles[index],
        ...req.body,
        tenant_id: raffles[index].tenant_id,
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
    const newWinner = { id: createPublicId("W_"), ...req.body, tenant_id: resolveRequestTenantId(req) };
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
    mercadopago: { accessToken: '', publicKey: '', webhookUrl: '', webhookSecret: '' },
    pagbank: { token: '', apiKey: '', webhookUrl: '', webhookSecret: '' },
    asaas: { apiKey: '', webhookUrl: '', webhookSecret: '' },
    infinitypay: { token: '', apiKey: '', webhookUrl: '', webhookSecret: '' },
    pay2m: { token: '', apiKey: '', webhookUrl: '', webhookSecret: '' },
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
    const value = String(provider || "mock").trim().toLowerCase().replace(/[\s_-]+/g, "");
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
    return aliases[value] || "mock";
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
      created_at: raw.created_at || now,
      updated_at: now
    };
  }

  function getPaymentGatewayConfigs(tenantId: string) {
    if (!paymentGatewayConfigs[tenantId]?.length) {
      paymentGatewayConfigs[tenantId] = [configFromLegacyGateway(tenantId)];
    }
    const hasDefault = paymentGatewayConfigs[tenantId].some(config => config.is_default && config.enabled);
    if (!hasDefault && paymentGatewayConfigs[tenantId][0]) paymentGatewayConfigs[tenantId][0].is_default = true;
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
      webhookUrl: `http://127.0.0.1:3000/api/webhooks/payment/${provider}`,
      webhookSecret: defaultConfig.webhook_secret || tenantPixGateways.pix?.webhookSecret || "",
      apiKey: defaultConfig.pix_key || tenantPixGateways.pix?.apiKey || ""
    };
    (tenantPixGateways as unknown as Record<string, Record<string, string>>)[provider] = {
      ...(tenantPixGateways[provider] || {}),
      ...Object.fromEntries(Object.entries(defaultConfig.credentials || {}).map(([key, value]) => [key, String(value || "")])),
      webhookSecret: defaultConfig.webhook_secret || "",
      webhookUrl: `http://127.0.0.1:3000/api/webhooks/payment/${provider}`
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
    return {
      tenants,
      authUsers,
      settings,
      tenantSettings,
      lootboxGuaranteedPool,
      lootboxGuaranteedPools,
      affiliates,
      customersByPhone,
      customersByCpf,
      customerMessages,
      affiliateWithdrawals,
      passwordResetCodes,
      supportTickets,
      auditLogs,
      paymentWebhookLogs,
      n8nEventLogs,
      integrations,
      integrationLogs,
      webhookEndpoints,
      webhookEvents,
      campaignCoupons,
      lootboxes,
      raffles,
      purchases,
      gamificationConfigs,
      gamificationEvents,
      gamificationWinners,
      instantPrizes,
      stories,
      winners,
      fazendinhaConfig,
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
      gateways: encryptLegacyGatewaysForStorage(gateways),
      tenantGateways: Object.fromEntries(Object.entries(tenantGateways).map(([tenantId, value]) => [tenantId, encryptLegacyGatewaysForStorage(value)])),
      paymentGatewayConfigs,
      tenantDomains,
      superadminImpersonationSessions,
      superadminAuditLogs,
      whatsappProviderConfigs,
      whatsappMessageQueue
    };
  }

  function assignPersistentCollection(collection: string, rawValue: unknown) {
    const value = revivePersistentValue(rawValue);
    switch (collection) {
      case "tenants": replaceArray(tenants, value); break;
      case "authUsers": replaceArray(authUsers, value); break;
      case "settings": settings = value || settings; break;
      case "tenantSettings": replaceObject(tenantSettings, value); break;
      case "lootboxGuaranteedPool": lootboxGuaranteedPool = Array.isArray(value) ? value : []; break;
      case "lootboxGuaranteedPools": lootboxGuaranteedPools = value || {}; break;
      case "affiliates": affiliates = value || {}; break;
      case "customersByPhone": customersByPhone = value || {}; break;
      case "customersByCpf": customersByCpf = value || {}; break;
      case "customerMessages": customerMessages = Array.isArray(value) ? value : []; break;
      case "affiliateWithdrawals": affiliateWithdrawals = Array.isArray(value) ? value : []; break;
      case "passwordResetCodes": passwordResetCodes = Array.isArray(value) ? value : []; break;
      case "supportTickets": supportTickets = Array.isArray(value) ? value : []; break;
      case "auditLogs": auditLogs = Array.isArray(value) ? value : []; break;
      case "paymentWebhookLogs": paymentWebhookLogs = Array.isArray(value) ? value : []; break;
      case "n8nEventLogs": n8nEventLogs = Array.isArray(value) ? value : []; break;
      case "integrations": integrations = Array.isArray(value) ? value : []; break;
      case "integrationLogs": integrationLogs = Array.isArray(value) ? value : []; break;
      case "webhookEndpoints": webhookEndpoints = Array.isArray(value) ? value : []; break;
      case "webhookEvents": webhookEvents = Array.isArray(value) ? value : []; break;
      case "campaignCoupons": campaignCoupons = Array.isArray(value) ? value : []; break;
      case "lootboxes": lootboxes = value || {}; break;
      case "raffles": raffles = Array.isArray(value) ? value.map((raffle: any) => ({ ...raffle, soldNumbers: raffle.soldNumbers instanceof Set ? raffle.soldNumbers : new Set(raffle.soldNumbers?.values || raffle.soldNumbers || []) })) : raffles; break;
      case "purchases": purchases = Array.isArray(value) ? value : []; break;
      case "gamificationConfigs": gamificationConfigs = Array.isArray(value) ? value : []; break;
      case "gamificationEvents": gamificationEvents = Array.isArray(value) ? value : []; break;
      case "gamificationWinners": gamificationWinners = Array.isArray(value) ? value : []; break;
      case "instantPrizes": instantPrizes = Array.isArray(value) ? value : []; break;
      case "stories": stories = Array.isArray(value) ? value : []; break;
      case "winners": winners = Array.isArray(value) ? value : []; break;
      case "fazendinhaConfig": fazendinhaConfig = value || fazendinhaConfig; break;
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
      case "gateways": gateways = value || gateways; break;
      case "tenantGateways": replaceObject(tenantGateways, value); break;
      case "paymentGatewayConfigs": replaceObject(paymentGatewayConfigs, value); break;
      case "tenantDomains": tenantDomains = Array.isArray(value) ? value : tenantDomains; break;
      case "superadminImpersonationSessions": superadminImpersonationSessions = Array.isArray(value) ? value : []; break;
      case "superadminAuditLogs": superadminAuditLogs = Array.isArray(value) ? value : []; break;
      case "whatsappProviderConfigs": whatsappProviderConfigs = Array.isArray(value) ? value : []; break;
      case "whatsappMessageQueue": whatsappMessageQueue = Array.isArray(value) ? value : []; break;
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

  function schedulePersistentStateSave(reason: string) {
    if (!persistentStateReady || !supabaseAdmin) return;
    if (persistentStateTimer) clearTimeout(persistentStateTimer);
    persistentStateTimer = setTimeout(() => {
      void persistAllState(reason);
    }, 50);
  }

  async function persistAllState(reason: string) {
    if (!supabaseAdmin || persistentStateSaving) return;
    persistentStateSaving = true;
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
    }
  }

  app.get("/api/admin/gateways", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const tenantPixGateways = getTenantGateways(tenantId);
    const configs = getPaymentGatewayConfigs(tenantId).map(sanitizePaymentGatewayConfig);
    const defaultConfig = getDefaultPaymentGatewayConfig(tenantId);
    res.json({
      ...maskLegacyGatewaysForResponse(tenantPixGateways),
      configs,
      paymentGatewayConfigs: configs,
      defaultProvider: defaultConfig.provider,
      environment: defaultConfig.environment
    });
  });
  app.post("/api/admin/gateways/test", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const tenantPixGateways = getTenantGateways(tenantId);
    const gateway = normalizePaymentProvider(req.body.gateway || getDefaultPaymentGatewayConfig(tenantId).provider || tenantPixGateways.active || "mercadopago");
    const pixConfig = (tenantPixGateways.pix || {}) as Record<string, string | boolean>;
    const gatewayConfig = (tenantPixGateways[gateway] || {}) as Record<string, string>;
    const credentialFields: Record<PixGatewayId, string[]> = {
      mercadopago: ["accessToken", "publicKey"],
      pagbank: ["token", "apiKey"],
      asaas: ["apiKey"],
      infinitypay: ["token", "apiKey"],
      pay2m: ["token", "apiKey"],
      cora: ["clientId", "clientSecret", "apiKey"],
      primepag: ["clientId", "clientSecret", "apiKey"],
      paggue: ["clientId", "clientSecret", "apiKey"],
      cashpay: ["clientId", "clientSecret", "apiKey"],
      fakeprocessor: ["apiKey"],
      sandbox: ["apiKey"],
      mock: ["apiKey"]
    };
    const fields = credentialFields[gateway] || [];
    const presentCredentials = fields.filter(field => Boolean(gatewayConfig[field]));
    const webhookUrl = gatewayConfig.webhookUrl || String(pixConfig.webhookUrl || "") || `http://127.0.0.1:3000/api/webhooks/payment/${gateway}`;
    const issues = [
      ...(!pixConfig.enabled ? ["PIX global está desabilitado"] : []),
      ...(presentCredentials.length === 0 && !pixConfig.apiKey ? ["Nenhuma credencial/API key configurada para este gateway"] : []),
      ...(!webhookUrl.includes(`/api/webhooks/payment/${gateway}`) ? [`Webhook recomendado deve apontar para /api/webhooks/payment/${gateway}`] : []),
    ];
    res.json({
      gateway,
      ok: issues.length === 0,
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
    if (incomingConfigs.length) {
      const currentConfigs = getPaymentGatewayConfigs(tenantId);
      paymentGatewayConfigs[tenantId] = incomingConfigs.map((config: Partial<PaymentGatewayConfigRecord>, index: number) => {
        const provider = normalizePaymentProvider(config.provider);
        const current = currentConfigs.find(item => item.id === config.id || normalizePaymentProvider(item.provider) === provider);
        return normalizePaymentGatewayConfig(tenantId, config, index === 0, current);
      });
      const defaults = paymentGatewayConfigs[tenantId].filter(config => config.is_default);
      if (defaults.length !== 1) {
        paymentGatewayConfigs[tenantId] = paymentGatewayConfigs[tenantId].map((config, index) => ({ ...config, is_default: index === 0 }));
      }
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
    updatedGateways.active = normalizePaymentProvider(req.body.active || req.body.pix?.gateway || updatedGateways.active);
    updatedGateways.pix = {
      ...updatedGateways.pix,
      webhookUrl: `http://127.0.0.1:3000/api/webhooks/payment/${updatedGateways.active}`
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
    syncLegacyGatewaysFromConfigs(tenantId);
    const configs = getPaymentGatewayConfigs(tenantId).map(sanitizePaymentGatewayConfig);
    recordSecurityEvent({ tenant_id: tenantId, action: "PIX_GATEWAY_CHANGED", ip: String(req.ip || req.socket.remoteAddress || ""), status: "WARN", severity: "medium", actor: getAuthSession(req)?.email, detail: String(getDefaultPaymentGatewayConfig(tenantId).provider || "") });
    res.json({ ...maskLegacyGatewaysForResponse(getTenantGateways(tenantId)), configs, paymentGatewayConfigs: configs, defaultProvider: getDefaultPaymentGatewayConfig(tenantId).provider });
  });

  // Settings
  app.get("/api/settings", (req, res) => res.json(sanitizePublicSettings(getTenantSettings(resolveRequestTenantId(req)))));
  app.put("/api/admin/settings", (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const currentSettings = getTenantSettings(tenantId);
    const incomingN8n = { ...(req.body.n8nIntegration || {}) };
    const incomingAffiliateVideo = { ...(req.body.affiliateInstructionVideo || {}) };
    if (incomingN8n.secret === "********") incomingN8n.secret = currentSettings.n8nIntegration.secret;
    const updatedSettings = {
      ...currentSettings,
      ...req.body,
      smsProvider: { ...currentSettings.smsProvider, ...(req.body.smsProvider || {}) },
      n8nIntegration: { ...currentSettings.n8nIntegration, ...incomingN8n },
      affiliateProgram: { ...currentSettings.affiliateProgram, ...(req.body.affiliateProgram || {}) },
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
    };
    tenantSettings[tenantId] = updatedSettings;
    if (tenantId === legacyTenantId) settings = updatedSettings;
    res.json(updatedSettings);
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

  app.post("/api/coupons/validate", (req, res) => {
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
      affiliates[key] = {
        tenant_id: tenantId,
        refCode,
        clicks: 0,
        conversions: 0,
        referredCustomers: 0,
        revenue: 0,
        commission: 0,
        commissionBalance: 0,
        prizeBalance: 0,
        useBalanceForPurchases: false,
        enabled: false,
        history: []
      };
    }
    res.json({ ...affiliates[key], rules: settings.affiliateProgram });
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
      useBalanceForPurchases: false,
      enabled: false,
      history: []
    };
    const customer = affiliate.customerId ? Object.values(customersByPhone).find(item => item.id === affiliate.customerId) : undefined;
    if (customer && requestOwnsCustomer(req, customer)) {
      res.json({ ...affiliate, rules: settings.affiliateProgram });
      return;
    }

    const { pixKey, history, ...publicAffiliate } = affiliate;
    res.json({ ...publicAffiliate, rules: settings.affiliateProgram });
  });

  app.get("/api/admin/affiliates/search", (req, res) => {
    const query = String(req.query.q || "");
    const digits = query.replace(/\D/g, "");
    const normalizedText = query.toLowerCase().trim();
    const results = Object.values(customersByPhone)
      .filter(customer => adminCanAccessTenant(req, customer.tenant_id))
      .filter(customer => {
        const affiliate = ensureAffiliateForCustomer(customer);
        const text = `${customer.name} ${customer.phone} ${customer.cpf} ${customer.city || ""} ${customer.state || ""} ${affiliate.refCode}`.toLowerCase();
        return !query || text.includes(normalizedText) || customer.phone.includes(digits) || customer.cpf.includes(digits);
      })
      .map(customer => {
        const affiliate = ensureAffiliateForCustomer(customer);
        return {
          customer,
          affiliate: { ...affiliate, rules: settings.affiliateProgram }
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
    const customer = affiliate.customerId ? Object.values(customersByPhone).find(item => item.id === affiliate.customerId) : undefined;
    if (!customer || !requestOwnsCustomer(req, customer)) {
      res.status(403).json({ error: "Acesso negado para este afiliado" });
      return;
    }
    affiliate.pixKey = req.body.pixKey ?? affiliate.pixKey;
    affiliate.useBalanceForPurchases = Boolean(req.body.useBalanceForPurchases);
    res.json({ ...affiliate, rules: settings.affiliateProgram });
  });

  app.post("/api/affiliates/:refCode/withdrawals", (req, res) => {
    const affiliate = affiliates[tenantCustomerKey(resolveRequestTenantId(req), req.params.refCode)];
    if (!affiliate) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const customer = affiliate.customerId ? Object.values(customersByPhone).find(item => item.id === affiliate.customerId) : undefined;
    if (!customer || !requestOwnsCustomer(req, customer)) {
      res.status(403).json({ error: "Acesso negado para este afiliado" });
      return;
    }
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
  const paymentWorkerInterval = setInterval(() => void processPaymentQueue(), 5_000);
  paymentWorkerInterval.unref?.();
  void processPaymentQueue();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
