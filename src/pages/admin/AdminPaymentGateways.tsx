import React, { useEffect, useState } from "react";
import { Settings, Save, Link2, CreditCard, CheckCircle, ShieldCheck, RefreshCw, Activity } from "lucide-react";
import { toast } from "sonner";

const defaultGateways = {
  pix: {
    enabled: true,
    sandbox: false,
    apiKey: "",
    pixKey: "",
    webhookUrl: "/api/webhooks/asaas",
    webhookSecret: "",
    webhookEvents: "PAYMENT_RECEIVED,PAYMENT_CONFIRMED,PAYMENT_OVERDUE,PAYMENT_DELETED,PAYMENT_REFUNDED"
  },
  active: "asaas",
  mercadopago: {
    enabled: false,
    environment: "production",
    accessToken: "",
    publicKey: "",
    webhookUrl: "/api/webhooks/mercadopago",
    webhookSecret: "",
    expirationMinutes: "15",
    releaseStatus: "approved"
  },
  pagbank: {
    enabled: false,
    environment: "production",
    token: "",
    apiKey: "",
    webhookUrl: "/api/webhooks/pagbank",
    webhookSecret: "",
    expirationMinutes: "15",
    releaseStatus: "PAID"
  },
  asaas: {
    enabled: false,
    environment: "production",
    apiKey: "",
    userAgent: "CIFHER Prime",
    webhookUrl: "/api/webhooks/asaas",
    webhookSecret: "",
    releaseMode: "PAYMENT_RECEIVED",
    paymentMode: "pix_direct",
    orderExpirationMinutes: "15"
  },
  infinitypay: { token: "", apiKey: "", webhookUrl: "", webhookSecret: "" },
  pay2m: {
    enabled: false,
    environment: "production",
    clientId: "",
    clientSecret: "",
    webhookUrl: "/api/webhooks/pay2m",
    webhookSecret: "",
    expirationTime: "1800",
    splitLink: "",
    releaseStatus: "paid"
  },
  cora: { enabled: false, environment: "production", clientId: "", clientSecret: "", certificate: "", privateKey: "", apiKey: "", webhookUrl: "/api/webhooks/cora", webhookSecret: "", expirationMinutes: "15" },
  primepag: { enabled: false, environment: "production", clientId: "", clientSecret: "", accessToken: "", apiKey: "", webhookUrl: "/api/webhooks/primepag", webhookSecret: "", expirationTime: "1800" },
  paggue: { clientId: "", clientSecret: "", apiKey: "", webhookUrl: "", webhookSecret: "" },
  cashpay: { clientId: "", clientSecret: "", apiKey: "", webhookUrl: "", webhookSecret: "" },
  fakeprocessor: { apiKey: "", webhookUrl: "", webhookSecret: "" },
  sandbox: { apiKey: "sandbox-only", webhookUrl: "", webhookSecret: "" },
  mock: { apiKey: "mock-only", webhookUrl: "", webhookSecret: "" }
};

const gatewayIds = ["asaas", "sandbox", "mock", "primepag", "paggue", "cashpay", "fakeprocessor", "mercadopago", "pagbank", "infinitypay", "pay2m", "cora"];
const publicGatewayIds = ["asaas"];
const gatewayLabels: Record<string, string> = {
  sandbox: "Validação interna PIX",
  mock: "Simulação protegida",
  primepag: "PrimePag",
  paggue: "Paggue",
  cashpay: "Cash Pay",
  fakeprocessor: "Processador de validação",
  mercadopago: "Mercado Pago",
  pagbank: "PagBank",
  asaas: "Asaas",
  infinitypay: "InfinityPay",
  pay2m: "Pay2M",
  cora: "Cora"
};

const gatewayStatusLabels: Record<string, string> = {
  healthy: "Operando normalmente",
  ok: "Operando normalmente",
  success: "Operando normalmente",
  active: "Operando normalmente",
  pending: "Aguardando confirmação",
  warning: "Requer atenção",
  failed: "Requer atenção",
  error: "Requer atenção",
  inactive: "Inativo"
};

function safeText(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function safeRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function safeList<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeProviderId(value: unknown) {
  const normalized = safeText(value, "asaas").trim().toLowerCase().replace(/[\s_-]+/g, "");
  return normalized === "asaas" ? "asaas" : "asaas";
}

function friendlyGatewayName(value?: unknown) {
  return gatewayLabels[normalizeProviderId(value)] || "Gateway configurado";
}

function friendlyGatewayStatus(value?: unknown) {
  return gatewayStatusLabels[safeText(value).toLowerCase()] || "Em monitoramento";
}

function friendlyOperationalMessage(value?: unknown) {
  const text = safeText(value).trim();
  if (!text) return "Sem observações recentes.";
  const lower = text.toLowerCase();
  if (lower.includes("timeout") || lower.includes("econn") || lower.includes("network")) return "Conexão instável com o serviço.";
  if (lower.includes("unauthorized") || lower.includes("forbidden") || lower.includes("invalid token")) return "Revise as chaves de conexão.";
  if (lower.includes("{") || lower.includes("}") || lower.includes("payload") || lower.includes("json")) return "Detalhes técnicos protegidos pelo sistema.";
  if (/[a-f0-9]{24,}/i.test(text) || /\b(order_id|purchaseid|raffleid|provider)\b/i.test(text)) return "Detalhes técnicos protegidos pelo sistema.";
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function credentialLabel(field: string) {
  const labels: Record<string, string> = {
    apiKey: "Chave de conexão",
    token: "Chave de conexão",
    accessToken: "Chave privada",
    publicKey: "Chave pública",
    clientId: "Conta do gateway",
    clientSecret: "Senha do gateway",
    webhookSecret: "Chave de segurança",
    webhookUrl: "Canal de notificação",
    webhookEvents: "Eventos monitorados",
    certificate: "Certificado da conta",
    privateKey: "Chave privada da conta"
  };
  return labels[field] || "Dado de conexão";
}

function normalizeGatewaySection<T extends Record<string, unknown>>(defaults: T, input: unknown): T {
  const source = safeRecord(input);
  const merged = { ...defaults, ...source } as Record<string, unknown>;
  return Object.fromEntries(Object.entries(merged).map(([key, value]) => [
    key,
    typeof value === "boolean" ? value : safeText(value, safeText((defaults as Record<string, unknown>)[key]))
  ])) as T;
}

function getSafeGatewayConfig(provider: string, input?: unknown): Record<string, any> {
  const providerId = normalizeProviderId(provider);
  const source = safeRecord(input);
  const defaults = safeRecord((defaultGateways as Record<string, unknown>)[providerId]);
  const normalized = normalizeGatewaySection(defaults, source);
  return {
    ...normalized,
    provider: providerId,
    enabled: Boolean(source.enabled ?? normalized.enabled ?? false),
    is_default: Boolean(source.is_default ?? source.isDefault ?? false),
    pix: {
      enabled: Boolean(safeRecord(source.pix).enabled ?? false),
      ...safeRecord(source.pix)
    },
    credentials: safeRecord(source.credentials),
    settings: safeRecord(source.settings || source.config_json)
  };
}

function normalizeGateways(input: any) {
  const source = safeRecord(input);
  const configList = Array.isArray(source.configs)
    ? source.configs
    : Array.isArray(source.paymentGatewayConfigs)
      ? source.paymentGatewayConfigs
      : [];
  const findConfig = (provider: string) => configList.find((config: any) => normalizeProviderId(config?.provider) === provider) || null;
  const mercadoPagoConfig = findConfig("mercadopago");
  const mercadoPagoFromConfig = mercadoPagoConfig ? {
    enabled: Boolean(mercadoPagoConfig.enabled),
    environment: mercadoPagoConfig.environment || "production",
    accessToken: mercadoPagoConfig.credentials?.accessToken || mercadoPagoConfig.credentials?.access_token || mercadoPagoConfig.credentials?.token || "",
    publicKey: mercadoPagoConfig.credentials?.publicKey || mercadoPagoConfig.credentials?.public_key || "",
    webhookUrl: "/api/webhooks/mercadopago",
    webhookSecret: mercadoPagoConfig.webhook_secret || "",
    expirationMinutes: String(mercadoPagoConfig.config_json?.expirationMinutes || mercadoPagoConfig.credentials?.expirationMinutes || "15"),
    releaseStatus: mercadoPagoConfig.config_json?.releaseStatus || mercadoPagoConfig.credentials?.releaseStatus || "approved"
  } : {};
  const asaasConfig = findConfig("asaas");
  const asaasFromConfig = asaasConfig ? {
    enabled: Boolean(asaasConfig.enabled),
    environment: asaasConfig.environment || "production",
    apiKey: asaasConfig.credentials?.apiKey || "",
    userAgent: asaasConfig.config_json?.userAgent || asaasConfig.credentials?.userAgent || "CIFHER Prime",
    webhookUrl: "/api/webhooks/asaas",
    webhookSecret: asaasConfig.webhook_secret || "",
    releaseMode: asaasConfig.config_json?.releaseMode || asaasConfig.credentials?.releaseMode || "PAYMENT_RECEIVED",
    paymentMode: asaasConfig.config_json?.paymentMode || asaasConfig.credentials?.paymentMode || "pix_direct",
    orderExpirationMinutes: String(asaasConfig.config_json?.orderExpirationMinutes || asaasConfig.credentials?.orderExpirationMinutes || "15")
  } : {};
  const pay2mConfig = findConfig("pay2m");
  const pay2mFromConfig = pay2mConfig ? {
    enabled: Boolean(pay2mConfig.enabled),
    environment: pay2mConfig.environment || "production",
    clientId: pay2mConfig.credentials?.clientId || pay2mConfig.credentials?.client_id || "",
    clientSecret: pay2mConfig.credentials?.clientSecret || pay2mConfig.credentials?.client_secret || pay2mConfig.credentials?.apiKey || "",
    webhookUrl: "/api/webhooks/pay2m",
    webhookSecret: pay2mConfig.webhook_secret || "",
    expirationTime: String(pay2mConfig.config_json?.expirationTime || pay2mConfig.credentials?.expirationTime || "1800"),
    splitLink: pay2mConfig.config_json?.splitLink || pay2mConfig.credentials?.splitLink || "",
    releaseStatus: pay2mConfig.config_json?.releaseStatus || pay2mConfig.credentials?.releaseStatus || "paid"
  } : {};
  const pagbankConfig = findConfig("pagbank");
  const pagbankFromConfig = pagbankConfig ? {
    enabled: Boolean(pagbankConfig.enabled),
    environment: pagbankConfig.environment || "production",
    token: pagbankConfig.credentials?.token || pagbankConfig.credentials?.apiKey || "",
    apiKey: pagbankConfig.credentials?.token || pagbankConfig.credentials?.apiKey || "",
    webhookUrl: "/api/webhooks/pagbank",
    webhookSecret: pagbankConfig.webhook_secret || "",
    expirationMinutes: String(pagbankConfig.config_json?.expirationMinutes || pagbankConfig.credentials?.expirationMinutes || "15"),
    releaseStatus: pagbankConfig.config_json?.releaseStatus || pagbankConfig.credentials?.releaseStatus || "PAID"
  } : {};
  const coraConfig = findConfig("cora");
  const coraFromConfig = coraConfig ? {
    enabled: Boolean(coraConfig.enabled),
    environment: coraConfig.environment || "production",
    clientId: coraConfig.credentials?.clientId || coraConfig.credentials?.client_id || "",
    clientSecret: coraConfig.credentials?.clientSecret || coraConfig.credentials?.client_secret || "",
    certificate: coraConfig.credentials?.certificate || coraConfig.credentials?.certificado || "",
    privateKey: coraConfig.credentials?.privateKey || coraConfig.credentials?.private_key || "",
    webhookUrl: "/api/webhooks/cora",
    webhookSecret: coraConfig.webhook_secret || "",
    expirationMinutes: String(coraConfig.config_json?.expirationMinutes || coraConfig.credentials?.expirationMinutes || "15")
  } : {};
  const primepagConfig = findConfig("primepag");
  const primepagFromConfig = primepagConfig ? {
    enabled: Boolean(primepagConfig.enabled),
    environment: primepagConfig.environment || "production",
    clientId: primepagConfig.credentials?.clientId || primepagConfig.credentials?.client_id || "",
    clientSecret: primepagConfig.credentials?.clientSecret || primepagConfig.credentials?.client_secret || "",
    accessToken: primepagConfig.credentials?.accessToken || primepagConfig.credentials?.access_token || primepagConfig.credentials?.apiKey || "",
    apiKey: primepagConfig.credentials?.accessToken || primepagConfig.credentials?.access_token || primepagConfig.credentials?.apiKey || "",
    webhookUrl: "/api/webhooks/primepag",
    webhookSecret: primepagConfig.webhook_secret || "",
    expirationTime: String(primepagConfig.config_json?.expirationTime || primepagConfig.credentials?.expirationTime || "1800")
  } : {};
  const activeProvider = normalizeProviderId(source.defaultProvider || source.active || defaultGateways.active);
  return {
    ...defaultGateways,
    ...source,
    active: activeProvider,
    pix: { ...normalizeGatewaySection(defaultGateways.pix, source.pix), sandbox: false },
    mercadopago: getSafeGatewayConfig("mercadopago", { ...safeRecord(source.mercadopago), ...mercadoPagoFromConfig }),
    pagbank: getSafeGatewayConfig("pagbank", { ...safeRecord(source.pagbank), ...pagbankFromConfig }),
    asaas: getSafeGatewayConfig("asaas", { ...safeRecord(source.asaas), ...asaasFromConfig }),
    infinitypay: getSafeGatewayConfig("infinitypay", source.infinitypay),
    pay2m: getSafeGatewayConfig("pay2m", { ...safeRecord(source.pay2m), ...pay2mFromConfig }),
    cora: getSafeGatewayConfig("cora", { ...safeRecord(source.cora), ...coraFromConfig }),
    primepag: getSafeGatewayConfig("primepag", { ...safeRecord(source.primepag), ...primepagFromConfig }),
    paggue: getSafeGatewayConfig("paggue", source.paggue),
    cashpay: getSafeGatewayConfig("cashpay", source.cashpay),
    fakeprocessor: getSafeGatewayConfig("fakeprocessor", source.fakeprocessor),
    sandbox: getSafeGatewayConfig("sandbox", source.sandbox),
    mock: getSafeGatewayConfig("mock", source.mock),
  };
}

function hasGatewaySecret(value: unknown) {
  return String(value || "").trim().length > 0;
}

function validateAsaasGateway(config: any) {
  const missing = [
    !hasGatewaySecret(config.asaas?.apiKey) && "API Key"
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Asaas incompleto: informe ${missing.join(", ")} antes de salvar.`);
  }
}

function detectAsaasEnvironmentFromKey(apiKey: unknown) {
  const normalized = safeText(apiKey).trim().toLowerCase();
  if (normalized.includes("$aact_prod") || normalized.includes("aact_prod")) return "production";
  if (normalized) return "production";
  return "";
}

export function AdminPaymentGateways() {
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testingGateway, setTestingGateway] = useState("");
  const [gateways, setGateways] = useState<any>(defaultGateways);
  const [queueDashboard, setQueueDashboard] = useState<any>(null);
  const [processingQueues, setProcessingQueues] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/gateways")
      .then(res => res.json())
      .then(data => {
        if(data && Object.keys(data).length > 0) {
            setGateways(normalizeGateways(data));
            setHasPendingChanges(false);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
    loadPaymentQueues();
  }, []);

  const loadPaymentQueues = async () => {
    try {
      const res = await fetch("/api/admin/payments/queues");
      if (res.ok) setQueueDashboard(await res.json());
    } catch {
      setQueueDashboard(null);
    }
  };

  const processPaymentQueues = async () => {
    setProcessingQueues(true);
    try {
      const res = await fetch("/api/admin/payments/queues/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 25 }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao processar filas");
      setQueueDashboard(data.queues);
      toast.success("Workers de pagamento processados");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao processar filas");
    } finally {
      setProcessingQueues(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    let attemptedProvider = "asaas";
    try {
      const normalized = normalizeGateways({ ...gateways, active: "asaas" });
      normalized.active = "asaas";
      attemptedProvider = "asaas";
      validateAsaasGateway(normalized);
      const detectedEnvironment = detectAsaasEnvironmentFromKey(normalized.asaas.apiKey);
      const asaasEnvironment = detectedEnvironment || normalized.asaas.environment || "production";
      normalized.pix = { ...normalized.pix, enabled: true, sandbox: false, webhookUrl: "/api/webhooks/asaas" };
      normalized.asaas = { ...normalized.asaas, enabled: true, environment: asaasEnvironment, webhookUrl: "/api/webhooks/asaas" };
      const configs = [{
        provider: normalized.active,
        display_name: gatewayLabels[normalized.active] || normalized.active,
        enabled: Boolean(normalized.pix?.enabled),
        environment: "production",
        credentials: normalized.active === "mercadopago"
          ? { accessToken: normalized.mercadopago.accessToken, publicKey: normalized.mercadopago.publicKey, expirationMinutes: normalized.mercadopago.expirationMinutes, releaseStatus: normalized.mercadopago.releaseStatus }
          : normalized.active === "primepag"
            ? { clientId: normalized.primepag.clientId, clientSecret: normalized.primepag.clientSecret, accessToken: normalized.primepag.accessToken || normalized.primepag.apiKey, expirationTime: normalized.primepag.expirationTime }
          : normalized.active === "cora"
            ? { clientId: normalized.cora.clientId, clientSecret: normalized.cora.clientSecret, certificate: normalized.cora.certificate, privateKey: normalized.cora.privateKey, expirationMinutes: normalized.cora.expirationMinutes }
          : normalized.active === "asaas"
          ? { apiKey: normalized.asaas.apiKey, userAgent: normalized.asaas.userAgent, paymentMode: normalized.asaas.paymentMode, orderExpirationMinutes: normalized.asaas.orderExpirationMinutes, releaseMode: normalized.asaas.releaseMode }
          : normalized.active === "pay2m"
            ? { clientId: normalized.pay2m.clientId, clientSecret: normalized.pay2m.clientSecret, expirationTime: normalized.pay2m.expirationTime, splitLink: normalized.pay2m.splitLink, releaseStatus: normalized.pay2m.releaseStatus }
          : normalized.active === "pagbank"
            ? { token: normalized.pagbank.token || normalized.pagbank.apiKey, expirationMinutes: normalized.pagbank.expirationMinutes, releaseStatus: normalized.pagbank.releaseStatus }
          : normalized[normalized.active],
        webhook_secret: normalized.active === "primepag" ? normalized.primepag.webhookSecret : normalized.active === "cora" ? normalized.cora.webhookSecret : normalized.active === "mercadopago" ? normalized.mercadopago.webhookSecret : normalized.active === "asaas" ? normalized.asaas.webhookSecret : normalized.active === "pay2m" ? normalized.pay2m.webhookSecret : normalized.active === "pagbank" ? normalized.pagbank.webhookSecret : normalized.pix?.webhookSecret,
        pix_key: normalized.active === "primepag" || normalized.active === "cora" || normalized.active === "mercadopago" || normalized.active === "asaas" || normalized.active === "pay2m" || normalized.active === "pagbank" ? "" : normalized.pix?.apiKey,
        is_default: true,
        config_json: normalized.active === "mercadopago"
          ? { expirationMinutes: Math.max(1, Number(normalized.mercadopago.expirationMinutes || 15)), releaseStatus: normalized.mercadopago.releaseStatus }
          : normalized.active === "primepag"
            ? { expirationTime: Math.max(1, Math.min(86400, Number(normalized.primepag.expirationTime || 1800))) }
          : normalized.active === "cora"
            ? { expirationMinutes: Math.max(1, Number(normalized.cora.expirationMinutes || 15)) }
          : normalized.active === "asaas"
          ? { userAgent: normalized.asaas.userAgent, releaseMode: normalized.asaas.releaseMode, paymentMode: normalized.asaas.paymentMode, orderExpirationMinutes: Number(normalized.asaas.orderExpirationMinutes || 15) }
          : normalized.active === "pay2m"
            ? { expirationTime: Math.min(3600, Number(normalized.pay2m.expirationTime || 1800)), splitLink: normalized.pay2m.splitLink, releaseStatus: normalized.pay2m.releaseStatus }
          : normalized.active === "pagbank"
            ? { expirationMinutes: Math.max(1, Number(normalized.pagbank.expirationMinutes || 15)), releaseStatus: normalized.pagbank.releaseStatus }
          : {}
      }];
      const res = await fetch("/api/admin/gateways", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...normalized, configs, paymentGatewayConfigs: configs })
      });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => "");
      if (!res.ok) {
        const message = typeof data === "string" ? data : data?.error || data?.message;
        throw new Error(message || "Erro ao salvar recebimentos");
      }
      setGateways(normalizeGateways(data));
      setHasPendingChanges(false);
      toast.success("Recebimentos salvos com sucesso!");
    } catch (error) {
      console.error("Falha ao salvar gateway PIX", {
        provider: attemptedProvider,
        message: error instanceof Error ? error.message : error
      });
      toast.error("Não foi possível salvar o gateway. Verifique os dados e tente novamente.", {
        description: error instanceof Error ? error.message : undefined
      });
    } finally {
      setSaving(false);
    }
  };

  const updateGateway = (gateway: string, field: string, value: string) => {
    const normalized = normalizeGateways(gateways);
    const shouldActivateAsaas = gateway === "asaas" && String(value || "").trim().length > 0;
    const nextGateway = {
      ...normalized[gateway],
      [field]: value,
      ...(gateway === "asaas" ? { webhookUrl: "/api/webhooks/asaas" } : {})
    };
    setGateways({
      ...normalized,
      ...(shouldActivateAsaas ? { active: "asaas" } : {}),
      [gateway]: nextGateway,
      ...(shouldActivateAsaas ? {
        pix: {
          ...normalized.pix,
          enabled: true,
          sandbox: false,
          webhookUrl: "/api/webhooks/asaas"
        }
      } : {})
    });
    setHasPendingChanges(true);
  };

  const setActiveGateway = (_gateway: string) => {
    const normalized = normalizeGateways(gateways);
    setGateways({
      ...normalized,
      active: "asaas",
      asaas: {
        ...normalized.asaas,
        enabled: true
      },
      pix: {
        ...normalized.pix,
        enabled: true,
        sandbox: false,
        webhookUrl: "/api/webhooks/asaas"
      }
    });
    setHasPendingChanges(true);
  };

  const updatePix = (field: string, value: string | boolean) => {
    const normalized = normalizeGateways(gateways);
    setGateways({
      ...normalized,
      pix: {
        ...normalized.pix,
        [field]: value
      }
    });
    setHasPendingChanges(true);
  };

  const testGateway = async (gateway: string) => {
    const normalized = normalizeGateways(gateways);
    const testedGateway = normalizeProviderId(gateway);
    setTestingGateway(gateway);
    try {
      const res = await fetch("/api/admin/gateways/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway: testedGateway,
          active: testedGateway,
          pix: normalized.pix,
          config: normalized[testedGateway],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao testar gateway");
      setTestResults(current => ({ ...current, [gateway]: data }));
      if (data.ok) toast.success("Canal de recebimento validado");
      else toast.warning("Canal de recebimento precisa de ajuste", { description: data.issues?.[0] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao validar recebimento");
    } finally {
      setTestingGateway("");
    }
  };

  const testAllGateways = async () => {
    for (const gateway of publicGatewayIds) {
      await testGateway(gateway);
    }
  };

  const asaasConfigured = Boolean(String(gateways.asaas?.apiKey || "").trim());

  if (loading) return null;

  return (
    <div className="space-y-8 fade-in">
       <div className="flex justify-between items-center">
         <div>
            <h1 className="text-3xl font-display font-medium text-white flex items-center gap-3">
               <ShieldCheck className="w-8 h-8 text-emerald-400" /> Recebimentos
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Métodos de recebimento disponíveis para a operação.</p>
         </div>
         <button onClick={testAllGateways} className="rounded-xl border border-emerald-400/30 px-4 py-3 text-xs font-mono uppercase text-emerald-200 hover:bg-emerald-400/10">
           Validar recebimentos
         </button>
       </div>

       <form onSubmit={handleSave} className="space-y-8">
         {hasPendingChanges && (
           <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-sm text-slate-600">
             Alterações pendentes — clique em Salvar para aplicar.
           </div>
         )}
         
         <div className="glass-card p-6 border border-emerald-500/20 rounded-3xl space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-6 border-b border-white/5 pb-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <label className="flex items-center justify-between gap-4">
                        <span>
                            <span className="block text-lg font-display font-bold text-white">PIX habilitado</span>
                            <span className="block text-xs text-slate-400 mt-1">Quando desligado, novas compras retornam indisponível.</span>
                        </span>
                        <input
                            type="checkbox"
                            checked={Boolean(gateways.pix?.enabled)}
                            onChange={e => updatePix("enabled", e.target.checked)}
                            className="h-5 w-5"
                        />
                    </label>
                </div>

                <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <summary className="cursor-pointer text-sm font-bold text-white">Configurações Avançadas</summary>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <GatewayInput label="Chave PIX" type="password" value={gateways.pix?.apiKey || ""} onChange={value => updatePix("apiKey", value)} help="Cole a chave entregue pelo gateway para receber pagamentos PIX." />
                        <GatewayInput label="Chave de segurança" type="password" value={gateways.pix?.webhookSecret || ""} onChange={value => updatePix("webhookSecret", value)} help="Protege as confirmações automáticas de pagamento." />
                        <GatewayInput label="Canal de notificação" type="password" value={gateways.pix?.webhookUrl || ""} onChange={value => updatePix("webhookUrl", value)} help="Endereço usado pelo sistema para receber confirmações. Altere apenas com suporte técnico." />
                        <GatewayInput label="Confirmações acompanhadas" value={gateways.pix?.webhookEvents || ""} onChange={value => updatePix("webhookEvents", value)} help="Eventos de pagamento que o sistema acompanha automaticamente." />
                    </div>
                </details>
            </div>

            <div className="flex flex-col gap-2 border-b border-white/5 pb-4 mb-4">
                <label className="text-xs font-mono text-slate-400 uppercase tracking-widest">Canal ativo</label>
                <select 
                    value={gateways.active}
                    onChange={(e) => setActiveGateway(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-emerald-500/50 transition-all font-mono text-sm max-w-sm"
                >
                    {publicGatewayIds.map(gateway => (
                        <option key={gateway} value={gateway}>{gatewayLabels[gateway]}</option>
                    ))}
                </select>
            </div>

            <div className={`rounded-2xl border p-6 transition-colors ${gateways.active === "asaas" ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-display font-semibold text-white">
                    {gateways.active === "asaas" && <CheckCircle className="h-5 w-5 text-emerald-400" />}
                    Asaas Pix Produção
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">Gateway principal recomendado para gerar PIX real em produção.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-lg border px-2 py-1 text-[10px] font-mono uppercase ${asaasConfigured ? "border-emerald-400/30 text-emerald-200" : "border-slate-200 text-slate-600"}`}>
                    {asaasConfigured ? "Chave informada" : "Informe a chave"}
                  </span>
                  <button type="button" onClick={() => setActiveGateway("asaas")} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-[10px] font-mono uppercase text-emerald-200 hover:bg-emerald-400/10">
                    Ativar Asaas
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <GatewayInput label="Chave privada Asaas" type="password" value={gateways.asaas?.apiKey || ""} onChange={value => updateGateway("asaas", "apiKey", value)} />
                <GatewayInput label="Nome da aplicação / User-Agent" value={gateways.asaas?.userAgent || ""} onChange={value => updateGateway("asaas", "userAgent", value)} />
                <GatewayInput label="Chave de segurança do webhook" type="password" value={gateways.asaas?.webhookSecret || ""} onChange={value => updateGateway("asaas", "webhookSecret", value)} />
                <GatewayInput label="Prazo de expiração do pedido (min)" value={gateways.asaas?.orderExpirationMinutes || "15"} onChange={value => updateGateway("asaas", "orderExpirationMinutes", value)} />
                <div>
                  <label className="mb-1 block text-xs font-mono text-slate-400">Liberar cotas em</label>
                  <select value={gateways.asaas?.releaseMode || "PAYMENT_RECEIVED"} onChange={e => updateGateway("asaas", "releaseMode", e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/50 p-2 text-xs font-mono text-white outline-none focus:border-emerald-500/50">
                    <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
                    <option value="PAYMENT_CONFIRMED">PAYMENT_CONFIRMED</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-mono text-slate-400">Modo de pagamento</label>
                  <select value={gateways.asaas?.paymentMode || "pix_direct"} onChange={e => updateGateway("asaas", "paymentMode", e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/50 p-2 text-xs font-mono text-white outline-none focus:border-emerald-500/50">
                    <option value="pix_direct">Pix direto</option>
                    <option value="asaas_checkout">Checkout Asaas</option>
                    <option value="pix_boleto">Pix + Boleto</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-100">
                Ambiente fixo: Produção. O modo sandbox fica desativado permanentemente no checkout.
              </div>
              <GatewayTest gateway="asaas" result={testResults.asaas} testing={testingGateway === "asaas"} onTest={testGateway} />
            </div>

            <details className="hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5" aria-hidden="true">
              <summary className="cursor-pointer text-sm font-bold text-white">Configurações Avançadas</summary>
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-8">
                {["paggue", "cashpay"].map(gateway => (
                    <GenericGatewayCard
                        key={gateway}
                        gateway={gateway}
                        label={gatewayLabels[gateway]}
                        active={gateways.active === gateway}
                        config={gateways[gateway] || {}}
                        testing={testingGateway === gateway}
                        result={testResults[gateway]}
                        onActivate={setActiveGateway}
                        onUpdate={updateGateway}
                        onTest={testGateway}
                    />
                ))}

                {/* Mercado Pago */}
                <div className={`p-6 rounded-2xl border transition-colors ${gateways.active === 'mercadopago' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                            {gateways.active === 'mercadopago' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                            Mercado Pago Pix real
                        </h3>
                        <button type="button" onClick={() => setActiveGateway("mercadopago")} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-mono uppercase text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200">
                          Usar
                        </button>
                    </div>
                    <div className="space-y-4">
                        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                          Ativar Mercado Pago Pix
                          <input type="checkbox" checked={gateways.active === "mercadopago" && Boolean(gateways.pix?.enabled)} onChange={e => {
                            const normalized = normalizeGateways(gateways);
                            setGateways({
                              ...normalized,
                              active: "mercadopago",
                              pix: { ...normalized.pix, enabled: e.target.checked, sandbox: false, webhookUrl: "/api/webhooks/mercadopago" }
                            });
                            setHasPendingChanges(true);
                          }} />
                        </label>
                        <div>
                          <label className="block text-xs font-mono text-slate-400 mb-1">Ambiente</label>
                          <select value={gateways.mercadopago?.environment || "production"} onChange={e => updateGateway("mercadopago", "environment", e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500/50 outline-none">
                            <option value="production">Produção</option>
                          </select>
                        </div>
                        <GatewayInput label="Chave privada" type="password" value={gateways.mercadopago?.accessToken || ''} onChange={value => updateGateway('mercadopago', 'accessToken', value)} />
                        <GatewayInput label="Chave pública" value={gateways.mercadopago?.publicKey || ''} onChange={value => updateGateway('mercadopago', 'publicKey', value)} />
                        <GatewayInput label="Chave de segurança" type="password" value={gateways.mercadopago?.webhookSecret || ''} onChange={value => updateGateway('mercadopago', 'webhookSecret', value)} />
                        <GatewayInput label="Canal de notificação" type="password" value={gateways.mercadopago?.webhookUrl || '/api/webhooks/mercadopago'} onChange={value => updateGateway('mercadopago', 'webhookUrl', value)} />
                        <GatewayInput label="Expiração PIX (minutos)" value={gateways.mercadopago?.expirationMinutes || '15'} onChange={value => updateGateway('mercadopago', 'expirationMinutes', value)} />
                        <div>
                          <label className="block text-xs font-mono text-slate-400 mb-1">Liberar pedido quando</label>
                          <select value={gateways.mercadopago?.releaseStatus || "approved"} onChange={e => updateGateway("mercadopago", "releaseStatus", e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500/50 outline-none">
                            <option value="approved">pagamento aprovado</option>
                          </select>
                        </div>
                    </div>
                    <GatewayTest gateway="mercadopago" result={testResults.mercadopago} testing={testingGateway === "mercadopago"} onTest={testGateway} />
                </div>

                {/* PagBank */}
                <div className={`p-6 rounded-2xl border transition-colors ${gateways.active === 'pagbank' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                            {gateways.active === 'pagbank' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                            PagBank Pix real
                        </h3>
                        <button type="button" onClick={() => setActiveGateway("pagbank")} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-mono uppercase text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200">
                          Usar
                        </button>
                    </div>
                    <div className="space-y-4">
                        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                          Ativar PagBank Pix
                          <input type="checkbox" checked={gateways.active === "pagbank" && Boolean(gateways.pix?.enabled)} onChange={e => {
                            const normalized = normalizeGateways(gateways);
                            setGateways({
                              ...normalized,
                              active: "pagbank",
                              pix: { ...normalized.pix, enabled: e.target.checked, sandbox: false, webhookUrl: "/api/webhooks/pagbank" }
                            });
                            setHasPendingChanges(true);
                          }} />
                        </label>
                        <div>
                          <label className="block text-xs font-mono text-slate-400 mb-1">Ambiente</label>
                          <select value={gateways.pagbank?.environment || "production"} onChange={e => updateGateway("pagbank", "environment", e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500/50 outline-none">
                            <option value="production">Produção</option>
                          </select>
                        </div>
                        <GatewayInput label="Chave privada" type="password" value={gateways.pagbank?.token || gateways.pagbank?.apiKey || ''} onChange={value => {
                          const normalized = normalizeGateways(gateways);
                          setGateways({ ...normalized, pagbank: { ...normalized.pagbank, token: value, apiKey: value } });
                          setHasPendingChanges(true);
                        }} />
                        <GatewayInput label="Chave de segurança" type="password" value={gateways.pagbank?.webhookSecret || ''} onChange={value => updateGateway('pagbank', 'webhookSecret', value)} />
                        <GatewayInput label="Canal de notificação" type="password" value={gateways.pagbank?.webhookUrl || '/api/webhooks/pagbank'} onChange={value => updateGateway('pagbank', 'webhookUrl', value)} />
                        <GatewayInput label="Tempo de expiração padrão (minutos)" value={gateways.pagbank?.expirationMinutes || '15'} onChange={value => updateGateway('pagbank', 'expirationMinutes', value)} />
                        <div>
                          <label className="block text-xs font-mono text-slate-400 mb-1">Liberar pedido quando</label>
                          <select value={gateways.pagbank?.releaseStatus || "PAID"} onChange={e => updateGateway("pagbank", "releaseStatus", e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500/50 outline-none">
                            <option value="PAID">pagamento confirmado</option>
                          </select>
                        </div>
                    </div>
                    <GatewayTest gateway="pagbank" result={testResults.pagbank} testing={testingGateway === "pagbank"} onTest={testGateway} />
                </div>

                {/* InfinityPay */}
                <div className={`p-6 rounded-2xl border transition-colors ${gateways.active === 'infinitypay' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                        {gateways.active === 'infinitypay' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                        InfinityPay
                    </h3>
                    <div className="space-y-4">
                        <GatewayInput label="Chave privada" type="password" value={gateways.infinitypay?.token || ''} onChange={value => updateGateway('infinitypay', 'token', value)} />
                        <GatewayInput label="Chave protegida" type="password" value={gateways.infinitypay?.apiKey || ''} onChange={value => updateGateway('infinitypay', 'apiKey', value)} />
                        <GatewayInput label="Canal de notificação" type="password" value={gateways.infinitypay?.webhookUrl || ''} onChange={value => updateGateway('infinitypay', 'webhookUrl', value)} />
                        <GatewayInput label="Chave de segurança" type="password" value={gateways.infinitypay?.webhookSecret || ''} onChange={value => updateGateway('infinitypay', 'webhookSecret', value)} />
                    </div>
                    <GatewayTest gateway="infinitypay" result={testResults.infinitypay} testing={testingGateway === "infinitypay"} onTest={testGateway} />
                </div>

                {/* Pay2M */}
                <div className={`p-6 rounded-2xl border transition-colors ${gateways.active === 'pay2m' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                            {gateways.active === 'pay2m' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                            Pay2M Pix real
                        </h3>
                        <button type="button" onClick={() => setActiveGateway("pay2m")} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-mono uppercase text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200">
                          Usar
                        </button>
                    </div>
                    <div className="space-y-4">
                        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                          Ativar Pay2M Pix
                          <input type="checkbox" checked={gateways.active === "pay2m" && Boolean(gateways.pix?.enabled)} onChange={e => {
                            const normalized = normalizeGateways(gateways);
                            setGateways({
                              ...normalized,
                              active: "pay2m",
                              pix: { ...normalized.pix, enabled: e.target.checked, sandbox: false, webhookUrl: "/api/webhooks/pay2m" }
                            });
                            setHasPendingChanges(true);
                          }} />
                        </label>
                        <div>
                          <label className="block text-xs font-mono text-slate-400 mb-1">Ambiente</label>
                          <select value={gateways.pay2m?.environment || "production"} onChange={e => updateGateway("pay2m", "environment", e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500/50 outline-none">
                            <option value="production">Produção</option>
                          </select>
                        </div>
                        <GatewayInput label="Conta do gateway" value={gateways.pay2m?.clientId || ''} onChange={value => updateGateway('pay2m', 'clientId', value)} />
                        <GatewayInput label="Senha do gateway" type="password" value={gateways.pay2m?.clientSecret || ''} onChange={value => updateGateway('pay2m', 'clientSecret', value)} />
                        <GatewayInput label="Chave de segurança" type="password" value={gateways.pay2m?.webhookSecret || ''} onChange={value => updateGateway('pay2m', 'webhookSecret', value)} />
                        <GatewayInput label="Canal de notificação" type="password" value={gateways.pay2m?.webhookUrl || '/api/webhooks/pay2m'} onChange={value => updateGateway('pay2m', 'webhookUrl', value)} />
                        <GatewayInput label="Tempo de expiração (segundos, máximo 3600)" value={gateways.pay2m?.expirationTime || '1800'} onChange={value => updateGateway('pay2m', 'expirationTime', value)} />
                        <GatewayInput label="Link de divisão opcional" value={gateways.pay2m?.splitLink || ''} onChange={value => updateGateway('pay2m', 'splitLink', value)} />
                        <div>
                          <label className="block text-xs font-mono text-slate-400 mb-1">Liberar pedido quando</label>
                          <select value={gateways.pay2m?.releaseStatus || "paid"} onChange={e => updateGateway("pay2m", "releaseStatus", e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500/50 outline-none">
                            <option value="paid">pagamento confirmado</option>
                          </select>
                        </div>
                    </div>
                    <GatewayTest gateway="pay2m" result={testResults.pay2m} testing={testingGateway === "pay2m"} onTest={testGateway} />
                </div>

                {/* PrimePag */}
                <div className={`p-6 rounded-2xl border transition-colors ${gateways.active === 'primepag' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                            {gateways.active === 'primepag' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                            PrimePag Pix real
                        </h3>
                        <button type="button" onClick={() => setActiveGateway("primepag")} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-mono uppercase text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200">
                          Usar
                        </button>
                    </div>
                    <div className="space-y-4">
                        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                          Ativar PrimePag Pix
                          <input type="checkbox" checked={gateways.active === "primepag" && Boolean(gateways.pix?.enabled)} onChange={e => {
                            const normalized = normalizeGateways(gateways);
                            setGateways({
                              ...normalized,
                              active: "primepag",
                              pix: { ...normalized.pix, enabled: e.target.checked, sandbox: false, webhookUrl: "/api/webhooks/primepag" }
                            });
                            setHasPendingChanges(true);
                          }} />
                        </label>
                        <p className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-3 text-xs text-sky-100">
                          PrimePag gera PIX interno com copia e cola.
                        </p>
                        <div>
                          <label className="block text-xs font-mono text-slate-400 mb-1">Ambiente</label>
                          <select value={gateways.primepag?.environment || "production"} onChange={e => updateGateway("primepag", "environment", e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500/50 outline-none">
                            <option value="production">Produção</option>
                          </select>
                        </div>
                        <GatewayInput label="Conta do gateway" value={gateways.primepag?.clientId || ''} onChange={value => updateGateway('primepag', 'clientId', value)} />
                        <GatewayInput label="Senha do gateway" type="password" value={gateways.primepag?.clientSecret || ''} onChange={value => updateGateway('primepag', 'clientSecret', value)} />
                        <GatewayInput label="Chave privada" type="password" value={gateways.primepag?.accessToken || gateways.primepag?.apiKey || ''} onChange={value => {
                          const normalized = normalizeGateways(gateways);
                          setGateways({ ...normalized, primepag: { ...normalized.primepag, accessToken: value, apiKey: value } });
                          setHasPendingChanges(true);
                        }} />
                        <GatewayInput label="Chave de segurança" type="password" value={gateways.primepag?.webhookSecret || ''} onChange={value => updateGateway('primepag', 'webhookSecret', value)} />
                        <GatewayInput label="Canal de notificação" type="password" value={gateways.primepag?.webhookUrl || '/api/webhooks/primepag'} onChange={value => updateGateway('primepag', 'webhookUrl', value)} />
                        <GatewayInput label="Tempo de expiração padrão (segundos)" value={gateways.primepag?.expirationTime || '1800'} onChange={value => updateGateway('primepag', 'expirationTime', value)} />
                    </div>
                    <GatewayTest gateway="primepag" result={testResults.primepag} testing={testingGateway === "primepag"} onTest={testGateway} />
                </div>

                {/* Cora */}
                <div className={`p-6 rounded-2xl border transition-colors ${gateways.active === 'cora' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                            {gateways.active === 'cora' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                            Banco Cora Pix real
                        </h3>
                        <button type="button" onClick={() => setActiveGateway("cora")} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-mono uppercase text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200">
                          Usar
                        </button>
                    </div>
                    <div className="space-y-4">
                        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                          Ativar Cora Pix
                          <input type="checkbox" checked={gateways.active === "cora" && Boolean(gateways.pix?.enabled)} onChange={e => {
                            const normalized = normalizeGateways(gateways);
                            setGateways({
                              ...normalized,
                              active: "cora",
                              pix: { ...normalized.pix, enabled: e.target.checked, sandbox: false, webhookUrl: "/api/webhooks/cora" }
                            });
                            setHasPendingChanges(true);
                          }} />
                        </label>
                        <p className="rounded-xl border border-slate-200 bg-slate-100 p-3 text-xs text-slate-600">
                          Banco Cora pode exigir CoraPro/Integração Direta com certificado e chave.
                        </p>
                        <div>
                          <label className="block text-xs font-mono text-slate-400 mb-1">Ambiente</label>
                          <select value={gateways.cora?.environment || "production"} onChange={e => updateGateway("cora", "environment", e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500/50 outline-none">
                            <option value="production">Produção</option>
                          </select>
                        </div>
                        <GatewayInput label="Conta do gateway" value={gateways.cora?.clientId || ''} onChange={value => updateGateway('cora', 'clientId', value)} />
                        <GatewayInput label="Senha do gateway" type="password" value={gateways.cora?.clientSecret || ''} onChange={value => updateGateway('cora', 'clientSecret', value)} />
                        <GatewayInput label="Certificado da conta" type="password" value={gateways.cora?.certificate || ''} onChange={value => updateGateway('cora', 'certificate', value)} />
                        <GatewayInput label="Chave privada da conta" type="password" value={gateways.cora?.privateKey || ''} onChange={value => updateGateway('cora', 'privateKey', value)} />
                        <GatewayInput label="Chave de segurança" type="password" value={gateways.cora?.webhookSecret || ''} onChange={value => updateGateway('cora', 'webhookSecret', value)} />
                        <GatewayInput label="Canal de notificação" type="password" value={gateways.cora?.webhookUrl || '/api/webhooks/cora'} onChange={value => updateGateway('cora', 'webhookUrl', value)} />
                        <GatewayInput label="Tempo de expiração PIX (min)" value={gateways.cora?.expirationMinutes || '15'} onChange={value => updateGateway('cora', 'expirationMinutes', value)} />
                    </div>
                    <GatewayTest gateway="cora" result={testResults.cora} testing={testingGateway === "cora"} onTest={testGateway} />
                </div>
              </div>
            </details>
         </div>
         
         <div className="flex justify-end pt-4">
           <button type="submit" disabled={saving} className="admin-action-button px-8 py-4 rounded-xl flex items-center gap-2 text-sm uppercase tracking-widest font-bold !shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:!shadow-[0_0_30px_rgba(16,185,129,0.5)] !border-emerald-500/50 disabled:opacity-60">
              <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar recebimentos"}
           </button>
         </div>
       </form>
       <PaymentQueuesDashboard dashboard={queueDashboard} processing={processingQueues} onRefresh={loadPaymentQueues} onProcess={processPaymentQueues} />
    </div>
  );
}

function PaymentQueuesDashboard({ dashboard, processing, onRefresh, onProcess }: { dashboard: any; processing: boolean; onRefresh: () => void; onProcess: () => void }) {
  const counts = dashboard?.counts || {};
  const gatewayHealthLogs = safeList<any>(dashboard?.logs?.gatewayHealth);
  const cards = [
    ["Confirmações", counts.webhook],
    ["Baixa", counts.settlement],
    ["Liberação", counts.release],
    ["Conciliação", counts.reconciliation],
    ["Revisão manual", counts.deadLetter]
  ];
  return (
    <section className="glass-card rounded-3xl border border-cyan-400/15 p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-display font-semibold text-white">
            <Activity className="h-5 w-5 text-cyan-300" /> Monitoramento de recebimentos
          </h2>
          <p className="mt-1 text-sm text-slate-400">Acompanhe confirmações, conciliação e liberação das vendas em um fluxo protegido.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onRefresh} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-mono uppercase text-slate-200 hover:border-cyan-300/40">
            <RefreshCw className="mr-2 inline h-3.5 w-3.5" /> Atualizar
          </button>
          <button type="button" onClick={onProcess} disabled={processing} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-mono uppercase text-cyan-100 disabled:opacity-50">
            {processing ? "Processando..." : "Processar agora"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {cards.map(([label, value]: any) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{value?.total || 0}</p>
            <p className="mt-1 text-xs text-slate-400">Pendentes: {value?.pending || 0} • Falhas: {value?.failed || 0}</p>
          </div>
        ))}
      </div>
      {!!gatewayHealthLogs.length && (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate-300">
            <thead className="text-[10px] uppercase tracking-widest text-slate-500">
              <tr><th className="py-2 pr-4">Gateway</th><th className="py-2 pr-4">Situação</th><th className="py-2 pr-4">Última atualização</th><th className="py-2">Mensagem</th></tr>
            </thead>
            <tbody>
              {gatewayHealthLogs.map((item: any) => (
                <tr key={`${item.provider}-${item.lastEventAt}`} className="border-t border-white/5">
                  <td className="py-2 pr-4">{friendlyGatewayName(item.provider)}</td>
                  <td className="py-2 pr-4">{friendlyGatewayStatus(item.status)}</td>
                  <td className="py-2 pr-4">{item.lastEventAt}</td>
                  <td className="py-2">{friendlyOperationalMessage(item.lastMessage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function GenericGatewayCard({
  gateway,
  label,
  active,
  config,
  testing,
  result,
  onActivate,
  onUpdate,
  onTest
}: {
  key?: React.Key;
  gateway: string;
  label: string;
  active: boolean;
  config: Record<string, string>;
  testing: boolean;
  result?: any;
  onActivate: (gateway: string) => void;
  onUpdate: (gateway: string, field: string, value: string) => void;
  onTest: (gateway: string) => void;
}) {
  const credentialFields = gateway === "fakeprocessor" || gateway === "sandbox" || gateway === "mock"
    ? ["apiKey"]
    : ["clientId", "clientSecret", "apiKey"];

  return (
    <div className={`p-6 rounded-2xl border transition-colors ${active ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/5 bg-white/[0.02]"}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          {active && <CheckCircle className="w-4 h-4 text-emerald-400" />}
          {label}
        </h3>
        <button type="button" onClick={() => onActivate(gateway)} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-mono uppercase text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200">
          Usar
        </button>
      </div>
      <div className="space-y-4">
        {credentialFields.map(field => (
          <GatewayInput
            key={field}
            label={credentialLabel(field)}
            type={field.toLowerCase().includes("secret") || field.toLowerCase().includes("key") ? "password" : "text"}
            value={config[field] || ""}
            onChange={value => onUpdate(gateway, field, value)}
          />
        ))}
        <GatewayInput label="Canal de notificação" type="password" value={config.webhookUrl || ""} onChange={value => onUpdate(gateway, "webhookUrl", value)} help="Usado para receber confirmações automáticas de pagamento." />
        <GatewayInput label="Chave de segurança" type="password" value={config.webhookSecret || ""} onChange={value => onUpdate(gateway, "webhookSecret", value)} help="Protege as notificações recebidas pelo gateway." />
      </div>
      <GatewayTest gateway={gateway} result={result} testing={testing} onTest={onTest} />
    </div>
  );
}

function GatewayTest({ gateway, result, testing, onTest }: { gateway: string; result?: any; testing: boolean; onTest: (gateway: string) => void }) {
  const issues = safeList<string>(result?.issues).filter(Boolean);
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Teste de pagamento PIX</span>
        <button type="button" onClick={() => onTest(gateway)} disabled={testing} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-[10px] font-mono uppercase text-emerald-200 disabled:opacity-50">
          {testing ? "Testando..." : "Testar"}
        </button>
      </div>
      {result && (
        <div className="mt-3 space-y-2 text-xs">
          <p className={result.ok ? "text-emerald-300" : "text-slate-600"}>{result.ok ? "Configuração coerente" : "Ajustes necessários"}</p>
          <p className="text-slate-500">Canal de notificação validado pelo sistema.</p>
          {!!issues.length && <p className="text-slate-600">{issues.join(" • ")}</p>}
        </div>
      )}
    </div>
  );
}

function GatewayInput({ label, value, onChange, type = "text", help }: { key?: React.Key; label: string; value: unknown; onChange: (value: string) => void; type?: string; help?: string }) {
  return (
    <div>
      <label className="block text-xs font-mono text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={safeText(value)}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500/50 outline-none"
      />
      {help && <p className="mt-1 text-[11px] text-slate-500">{help}</p>}
    </div>
  );
}

