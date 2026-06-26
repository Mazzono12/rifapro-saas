import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle, Copy, Eye, ListChecks, MessageCircle, PhoneCall, Plug, Save, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Integration = {
  id: string;
  provider: string;
  type: string;
  status: "active" | "inactive" | "error" | "pending_config";
  name: string;
  credentials?: Record<string, string>;
  settings?: Record<string, unknown>;
  last_error?: string;
  catalog?: ProviderCatalogEntry;
};

type ProviderCatalogEntry = {
  provider: string;
  type: string;
  label: string;
  documentationStatus: "official_public" | "official_portal" | "missing";
  homologationStatus: "ready" | "partial" | "placeholder";
  requiredCredentials: string[];
  optionalCredentials?: string[];
  defaultSettings: Record<string, unknown>;
  environments: { sandbox?: string; production?: string };
  docs: string[];
  webhookValidation: string;
  notes: string;
};

const defaultPixRecoveryMetrics = {
  pendingPix: 0,
  messagesSent: 0,
  recoveredSales: 0,
  recoveredValue: 0,
  recoveryRate: 0
};

const defaultPixRecoveryMessage = "Olá {{nome}}, seu PIX da campanha {{campanha}} ainda está aguardando pagamento. Sua reserva está ativa por pouco tempo. Finalize aqui: {{link}}";

export function AdminIntegrations() {
  const [providers, setProviders] = useState<ProviderCatalogEntry[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [cloudConfig, setCloudConfig] = useState<any>({ enabled: false, environment: "production", webhook_url: "/api/webhooks/meta/whatsapp" });
  const [cloudLogs, setCloudLogs] = useState<any[]>([]);
  const [cloudTemplates, setCloudTemplates] = useState<any[]>([]);
  const [savedCloudTemplates, setSavedCloudTemplates] = useState<any[]>([]);
  const [cloudPhone, setCloudPhone] = useState<any>(null);
  const [templateTest, setTemplateTest] = useState({ to: "", templateName: "", language: "pt_BR", components: "[]" });
  const [pixRecoverySettings, setPixRecoverySettings] = useState<any>({
    enabled: false,
    pending_template_name: "",
    pending_template_language: "pt_BR",
    expired_template_name: "",
    expired_template_language: "pt_BR",
    min_age_minutes: 15,
    per_customer_cooldown_hours: 24,
    daily_tenant_limit: 100,
    mode: "manual"
  });
  const [pixRecoveryPreview, setPixRecoveryPreview] = useState<any[]>([]);
  const [pixRecoveryQueue, setPixRecoveryQueue] = useState<any[]>([]);
  const [pixRecoveryLogs, setPixRecoveryLogs] = useState<any[]>([]);
  const [pixRecoveryMetrics, setPixRecoveryMetrics] = useState(defaultPixRecoveryMetrics);
  const [purchaseConfirmationSettings, setPurchaseConfirmationSettings] = useState<any>({
    enabled: false,
    template_name: "",
    template_language: "pt_BR",
    mode: "manual",
    daily_tenant_limit: 100,
    paid_only: true
  });
  const [purchaseConfirmationQueue, setPurchaseConfirmationQueue] = useState<any[]>([]);
  const [purchaseConfirmationLogs, setPurchaseConfirmationLogs] = useState<any[]>([]);
  const [whatsappConfig, setWhatsappConfig] = useState<any>({ provider: "meta_cloud", enabled: false, environment: "production", default_language: "pt_BR" });
  const [whatsappMessages, setWhatsappMessages] = useState<any[]>([]);
  const [testPhone, setTestPhone] = useState("");
  const [selected, setSelected] = useState("primepag");
  const [credentials, setCredentials] = useState("{}");
  const [settings, setSettings] = useState("{\"sandbox\":false,\"mock\":false}");
  const [status, setStatus] = useState<Integration["status"]>("inactive");

  const selectedProvider = useMemo(() => providers.find(item => item.provider === selected), [providers, selected]);
  const selectedCredentialValues = useMemo(() => parseConfigText(credentials), [credentials]);
  const selectedSettingsValues = useMemo(() => parseConfigText(settings), [settings]);

  const load = async () => {
    const [integrationsRes, logsRes, whatsappCloudRes, whatsappCloudTemplatesRes, pixRecoverySettingsRes, pixRecoveryQueueRes, pixRecoveryLogsRes, purchaseConfirmationSettingsRes, purchaseConfirmationQueueRes, purchaseConfirmationLogsRes, whatsappConfigRes, whatsappMessagesRes] = await Promise.all([
      fetch("/api/admin/integrations/global"),
      fetch("/api/admin/integrations/global/logs"),
      fetch("/api/admin/whatsapp-cloud/settings"),
      fetch("/api/admin/whatsapp-cloud/templates/saved"),
      fetch("/api/admin/whatsapp-cloud/pix-recovery/settings"),
      fetch("/api/admin/whatsapp-cloud/pix-recovery/queue"),
      fetch("/api/admin/whatsapp-cloud/pix-recovery/logs"),
      fetch("/api/admin/whatsapp-cloud/purchase-confirmation/settings"),
      fetch("/api/admin/whatsapp-cloud/purchase-confirmation/queue"),
      fetch("/api/admin/whatsapp-cloud/purchase-confirmation/logs"),
      fetch("/api/admin/whatsapp/config"),
      fetch("/api/admin/whatsapp/messages")
    ]);
    const data = await integrationsRes.json();
    setProviders(data.providers || []);
    setIntegrations(data.integrations || []);
    setLogs(await logsRes.json());
    const cloudData = await whatsappCloudRes.json();
    setCloudConfig(cloudData.settings || { enabled: false, environment: "production", webhook_url: "/api/webhooks/meta/whatsapp" });
    setCloudLogs(cloudData.logs || []);
    const savedTemplatesData = await whatsappCloudTemplatesRes.json();
    setSavedCloudTemplates(savedTemplatesData.templates || []);
    const pixSettingsData = await pixRecoverySettingsRes.json();
    setPixRecoverySettings(pixSettingsData.settings || pixRecoverySettings);
    setPixRecoveryMetrics(pixSettingsData.metrics || defaultPixRecoveryMetrics);
    const pixQueueData = await pixRecoveryQueueRes.json();
    setPixRecoveryQueue(pixQueueData.queue || []);
    if (pixQueueData.metrics) setPixRecoveryMetrics(pixQueueData.metrics);
    const pixLogsData = await pixRecoveryLogsRes.json();
    setPixRecoveryLogs(pixLogsData.logs || []);
    if (pixLogsData.metrics) setPixRecoveryMetrics(pixLogsData.metrics);
    const purchaseSettingsData = await purchaseConfirmationSettingsRes.json();
    setPurchaseConfirmationSettings(purchaseSettingsData.settings || purchaseConfirmationSettings);
    const purchaseQueueData = await purchaseConfirmationQueueRes.json();
    setPurchaseConfirmationQueue(purchaseQueueData.queue || []);
    const purchaseLogsData = await purchaseConfirmationLogsRes.json();
    setPurchaseConfirmationLogs(purchaseLogsData.logs || []);
    setWhatsappConfig(await whatsappConfigRes.json());
    setWhatsappMessages(await whatsappMessagesRes.json());
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        provider: selected,
        type: selectedProvider?.type || "generic",
        status,
        name: selected,
        credentials: JSON.parse(credentials),
        settings: JSON.parse(settings)
      };
      const res = await fetch("/api/admin/integrations/global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar integracao");
      toast.success("Integração salva com sucesso");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Revise os dados de conexão");
    }
  };

  const test = async (id: string) => {
    const res = await fetch(`/api/admin/integrations/global/${id}/test`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.success) toast.error(data.error || "Falha no teste");
    else toast.success("Conexao validada");
    await load();
  };

  const saveWhatsApp = async (event: React.FormEvent) => {
    event.preventDefault();
    const res = await fetch("/api/admin/whatsapp/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(whatsappConfig)
    });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Erro ao salvar WhatsApp");
    else {
      toast.success("WhatsApp salvo");
      setWhatsappConfig(data);
      await load();
    }
  };

  const testWhatsApp = async () => {
    const res = await fetch("/api/admin/whatsapp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: testPhone })
    });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || data.message?.last_error || "Falha no teste WhatsApp");
    else toast.success("Mensagem WhatsApp enviada para validação");
    await load();
  };

  const saveCloud = async (event: React.FormEvent) => {
    event.preventDefault();
    const res = await fetch("/api/admin/whatsapp-cloud/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cloudConfig)
    });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Erro ao salvar WhatsApp Cloud");
    else {
      toast.success("WhatsApp Cloud salvo");
      setCloudConfig(data.settings);
      setCloudLogs(data.logs || []);
    }
  };

  const testCloudConnection = async () => {
    const res = await fetch("/api/admin/whatsapp-cloud/test", { method: "POST" });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Não foi possível testar a conexão");
    else toast.success("Conexão validada com a Meta");
    await load();
  };

  const validateCloudPhone = async () => {
    const res = await fetch("/api/admin/whatsapp-cloud/phone");
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Não foi possível validar o número");
    else {
      setCloudPhone(data.phone);
      toast.success("Número validado");
    }
    await load();
  };

  const listCloudTemplates = async () => {
    const res = await fetch("/api/admin/whatsapp-cloud/templates");
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Não foi possível listar templates");
    else {
      setCloudTemplates(data.templates || []);
      toast.success("Templates carregados");
    }
    await load();
  };

  const syncCloudTemplates = async () => {
    const res = await fetch("/api/admin/whatsapp-cloud/templates/sync", { method: "POST" });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Não foi possível sincronizar templates");
    else {
      setSavedCloudTemplates(data.templates || []);
      setCloudTemplates(data.templates || []);
      toast.success("Templates sincronizados");
    }
    await load();
  };

  const refreshSavedCloudTemplates = async () => {
    const res = await fetch("/api/admin/whatsapp-cloud/templates/saved");
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Não foi possível atualizar a lista");
    else {
      setSavedCloudTemplates(data.templates || []);
      toast.success("Lista atualizada");
    }
  };

  const sendCloudTemplateTest = async () => {
    let components: unknown[] = [];
    try {
      const parsed = JSON.parse(templateTest.components || "[]");
      components = Array.isArray(parsed) ? parsed : [];
    } catch {
      toast.error("Revise as variáveis do template");
      return;
    }
    const res = await fetch("/api/admin/whatsapp-cloud/test-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...templateTest, components })
    });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Não foi possível enviar o teste individual");
    else toast.success("Teste individual enviado");
    await load();
  };

  const savePixRecoverySettings = async () => {
    const res = await fetch("/api/admin/whatsapp-cloud/pix-recovery/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pixRecoverySettings)
    });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Não foi possível salvar a recuperação de PIX");
    else {
      setPixRecoverySettings(data.settings);
      setPixRecoveryMetrics(data.metrics || defaultPixRecoveryMetrics);
      toast.success("Recuperação de PIX salva");
    }
    await load();
  };

  const previewPixRecovery = async () => {
    const res = await fetch("/api/admin/whatsapp-cloud/pix-recovery/preview", { method: "POST" });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Não foi possível testar a regra");
    else {
      setPixRecoveryPreview(data.items || []);
      setPixRecoveryMetrics(data.metrics || defaultPixRecoveryMetrics);
      toast.success("Regra testada sem enviar mensagens");
    }
    await load();
  };

  const enqueuePixRecovery = async () => {
    const res = await fetch("/api/admin/whatsapp-cloud/pix-recovery/enqueue", { method: "POST" });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Não foi possível criar a fila");
    else {
      setPixRecoveryQueue(data.messages || []);
      setPixRecoveryMetrics(data.metrics || defaultPixRecoveryMetrics);
      toast.success(`${data.queued || 0} mensagem(ns) adicionada(s) à fila`);
    }
    await load();
  };

  const runPixRecoveryQueue = async () => {
    const res = await fetch("/api/admin/whatsapp-cloud/pix-recovery/run", { method: "POST" });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Não foi possível processar a fila");
    else {
      setPixRecoveryQueue(data.queue || []);
      setPixRecoveryMetrics(data.metrics || defaultPixRecoveryMetrics);
      toast.success(`${data.sent || 0} mensagem(ns) enviada(s)`);
    }
    await load();
  };

  const refreshPixRecoveryQueue = async () => {
    const [queueRes, logsRes] = await Promise.all([
      fetch("/api/admin/whatsapp-cloud/pix-recovery/queue"),
      fetch("/api/admin/whatsapp-cloud/pix-recovery/logs")
    ]);
    const queueData = await queueRes.json();
    const logsData = await logsRes.json();
    if (!queueRes.ok) toast.error(queueData.error || "Não foi possível ver a fila");
    else {
      setPixRecoveryQueue(queueData.queue || []);
      if (queueData.metrics) setPixRecoveryMetrics(queueData.metrics);
    }
    if (!logsRes.ok) toast.error(logsData.error || "Não foi possível ver os logs");
    else {
      setPixRecoveryLogs(logsData.logs || []);
      if (logsData.metrics) setPixRecoveryMetrics(logsData.metrics);
    }
  };

  const copyPixRecoveryTemplate = async () => {
    await navigator.clipboard.writeText(defaultPixRecoveryMessage);
    toast.success("Mensagem padrão copiada");
  };

  const savePurchaseConfirmationSettings = async () => {
    const res = await fetch("/api/admin/whatsapp-cloud/purchase-confirmation/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(purchaseConfirmationSettings)
    });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Não foi possível salvar as confirmações automáticas");
    else {
      setPurchaseConfirmationSettings(data.settings);
      toast.success("Confirmações automáticas salvas");
    }
    await load();
  };

  const testPurchaseConfirmationEvent = async () => {
    const res = await fetch("/api/admin/whatsapp-cloud/purchase-confirmation/test", { method: "POST" });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Não foi possível testar o evento");
    else {
      if (data.message) setPurchaseConfirmationQueue((current: any[]) => [data.message, ...current.filter(item => item.id !== data.message.id)]);
      toast.success(data.queued ? "Evento de confirmação enfileirado" : data.result?.reason || "Evento testado");
    }
    await load();
  };

  const refreshPurchaseConfirmationQueue = async () => {
    const [queueRes, logsRes] = await Promise.all([
      fetch("/api/admin/whatsapp-cloud/purchase-confirmation/queue"),
      fetch("/api/admin/whatsapp-cloud/purchase-confirmation/logs")
    ]);
    const queueData = await queueRes.json();
    const logsData = await logsRes.json();
    if (!queueRes.ok) toast.error(queueData.error || "Não foi possível ver a fila de confirmações");
    else setPurchaseConfirmationQueue(queueData.queue || []);
    if (!logsRes.ok) toast.error(logsData.error || "Não foi possível ver os logs de confirmações");
    else setPurchaseConfirmationLogs(logsData.logs || []);
  };

  const copyCloudWebhookUrl = async () => {
    const path = cloudConfig.webhook_url || "/api/webhooks/meta/whatsapp";
    const value = path.startsWith("http") ? path : `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(value);
    toast.success("URL do webhook copiada");
  };

  const updateCredential = (key: string, value: string) => {
    const next = { ...parseConfigText(credentials), [key]: value };
    setCredentials(JSON.stringify(next));
  };

  const updateSetting = (key: string, value: unknown) => {
    const next = { ...parseConfigText(settings), [key]: value };
    setSettings(JSON.stringify(next));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="admin-card">
          <div className="mb-4 flex items-center gap-2">
            <Plug className="h-5 w-5 text-[var(--admin-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Integrações do cliente</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {integrations.map(item => (
              <div key={item.id} className="rounded-lg border border-[var(--admin-border)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--admin-text)]">{friendlyIntegrationName(item)}</p>
                    <p className="text-sm text-[var(--admin-muted)]">{friendlyIntegrationType(item.type)}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{friendlyIntegrationStatus(item.status)}</span>
                </div>
                <div className="mt-3 text-xs text-[var(--admin-muted)]">
                  <p>Credenciais protegidas</p>
                  {item.last_error && <p className="mt-2 text-red-500">{friendlyOperationalMessage(item.last_error)}</p>}
                </div>
                <button onClick={() => test(item.id)} className="admin-button-secondary mt-4 w-full">
                  <ShieldCheck className="h-4 w-4" />
                  Testar conexão
                </button>
              </div>
            ))}
          </div>
        </section>

        <form onSubmit={save} className="admin-card space-y-4">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">Configurar</h2>
          <label className="block text-sm font-medium text-[var(--admin-muted)]">
            Canal de envio
            <select value={selected} onChange={event => {
              const provider = providers.find(item => item.provider === event.target.value);
              setSelected(event.target.value);
              setSettings(JSON.stringify(provider?.defaultSettings || { environment: "production", sandbox: false, mock: false }, null, 2));
            }} className="admin-input mt-1 w-full">
              {providers.map(item => <option key={item.provider} value={item.provider}>{item.label}</option>)}
            </select>
            <span className="mt-1 block text-xs text-[var(--admin-muted)]">Escolha o serviço que será conectado à operação.</span>
          </label>
          <label className="block text-sm font-medium text-[var(--admin-muted)]">
            Situação
            <select value={status} onChange={event => setStatus(event.target.value as Integration["status"])} className="admin-input mt-1 w-full">
              <option value="active">Ativa</option>
              <option value="inactive">Inativa</option>
              <option value="pending_config">Pendente de configuração</option>
            </select>
          </label>
          <details className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--admin-text)]">Dados de conexão</summary>
            <div className="mt-4 space-y-4">
              <div className="space-y-2 rounded-lg border border-[var(--admin-border)] p-3 text-xs text-[var(--admin-muted)]">
                <p>Preencha apenas os dados fornecidos pelo serviço escolhido. As chaves ficam protegidas e são usadas somente para validar a integração.</p>
                <p>Situação de implantação: {friendlyHomologation(selectedProvider?.homologationStatus)}.</p>
                <p>Documentação: {friendlyDocumentation(selectedProvider?.documentationStatus)}.</p>
                <p>Validação de conexão: {friendlyWebhookValidation(selectedProvider?.webhookValidation)}.</p>
                <p>{selectedProvider?.notes}</p>
                <div className="flex flex-wrap gap-2">
                  {selectedProvider?.docs.map(doc => <a key={doc} href={doc} target="_blank" rel="noreferrer" className="text-[var(--admin-primary)] underline">documentação</a>)}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(selectedProvider?.requiredCredentials || []).map(key => (
                  <GatewayField
                    key={key}
                    label={friendlyCredentialLabel(key)}
                    help={friendlyCredentialHelp(key)}
                    type={isSensitiveCredential(key) ? "password" : "text"}
                    value={String(selectedCredentialValues[key] || "")}
                    onChange={value => updateCredential(key, value)}
                  />
                ))}
                {(selectedProvider?.optionalCredentials || []).map(key => (
                  <GatewayField
                    key={key}
                    label={`${friendlyCredentialLabel(key)} opcional`}
                    help={friendlyCredentialHelp(key)}
                    type={isSensitiveCredential(key) ? "password" : "text"}
                    value={String(selectedCredentialValues[key] || "")}
                    onChange={value => updateCredential(key, value)}
                  />
                ))}
              </div>
              <label className="flex items-center justify-between gap-4 rounded-lg border border-[var(--admin-border)] p-3 text-sm font-medium text-[var(--admin-muted)]">
                <span>
                  <span className="block text-[var(--admin-text)]">Usar ambiente de validação</span>
                  <span className="block text-xs text-[var(--admin-muted)]">Ideal para testar antes de colocar a integração em produção.</span>
                </span>
                <input type="checkbox" checked={Boolean(selectedSettingsValues.sandbox ?? selectedSettingsValues.mock ?? true)} onChange={event => {
                  updateSetting("sandbox", event.target.checked);
                  updateSetting("mock", event.target.checked);
                }} />
              </label>
            </div>
          </details>
          <button className="admin-button-primary w-full">
            <Save className="h-4 w-4" />
            Salvar
          </button>
        </form>
      </div>

      <section className="admin-card">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-1 h-5 w-5 text-emerald-500" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">WhatsApp Cloud API</h2>
              <p className="text-sm text-[var(--admin-muted)]">Configure a conexão oficial da Meta, valide o número e prepare o webhook. Nenhuma mensagem é enviada nesta etapa.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={testCloudConnection} className="admin-button-secondary"><ShieldCheck className="h-4 w-4" />Testar conexão</button>
            <button type="button" onClick={validateCloudPhone} className="admin-button-secondary"><PhoneCall className="h-4 w-4" />Validar número</button>
            <button type="button" onClick={listCloudTemplates} className="admin-button-secondary"><ListChecks className="h-4 w-4" />Listar templates</button>
            <button type="button" onClick={copyCloudWebhookUrl} className="admin-button-secondary"><Copy className="h-4 w-4" />Copiar URL do webhook</button>
          </div>
        </div>

        <form onSubmit={saveCloud} className="grid gap-4 lg:grid-cols-3">
          <label className="flex items-center justify-between gap-4 rounded-lg border border-[var(--admin-border)] p-3 text-sm font-medium text-[var(--admin-muted)] lg:col-span-3" title="Ative somente quando as credenciais oficiais estiverem conferidas.">
            <span>
              <span className="block text-[var(--admin-text)]">Ativar WhatsApp Cloud</span>
              <span className="block text-xs text-[var(--admin-muted)]">Permite validar a conta e preparar o canal oficial da Meta.</span>
            </span>
            <input type="checkbox" checked={Boolean(cloudConfig.enabled)} onChange={event => setCloudConfig((current: any) => ({ ...current, enabled: event.target.checked }))} />
          </label>
          <GatewayField label="Nome da conta" help="Nome comercial para identificar esta conexão no painel." value={cloudConfig.account_name || ""} onChange={value => setCloudConfig((current: any) => ({ ...current, account_name: value }))} />
          <GatewayField label="ID da Business Manager" help="Identificador da empresa no painel da Meta." value={cloudConfig.business_manager_id || ""} onChange={value => setCloudConfig((current: any) => ({ ...current, business_manager_id: value }))} />
          <GatewayField label="ID da Conta WhatsApp Business" help="Conta WhatsApp Business usada para listar templates aprovados." value={cloudConfig.whatsapp_business_account_id || ""} onChange={value => setCloudConfig((current: any) => ({ ...current, whatsapp_business_account_id: value }))} />
          <GatewayField label="ID do Número de Telefone" help="Número aprovado pela Meta para operar o WhatsApp Cloud." value={cloudConfig.phone_number_id || ""} onChange={value => setCloudConfig((current: any) => ({ ...current, phone_number_id: value }))} />
          <GatewayField label="Token de Acesso" help="Token oficial da Meta. Depois de salvo, será exibido mascarado." type="password" value={cloudConfig.access_token || ""} onChange={value => setCloudConfig((current: any) => ({ ...current, access_token: value }))} />
          <GatewayField label="App Secret Meta" help="Usado para validar que os eventos recebidos vieram da Meta." type="password" value={cloudConfig.app_secret || ""} onChange={value => setCloudConfig((current: any) => ({ ...current, app_secret: value }))} />
          <GatewayField label="Verify Token do Webhook" help="Código usado pela Meta para confirmar o webhook desta loja." type="password" value={cloudConfig.webhook_verify_token || ""} onChange={value => setCloudConfig((current: any) => ({ ...current, webhook_verify_token: value }))} />
          <GatewayField label="URL do Webhook" help="Endereço informado no painel da Meta para receber eventos." value={cloudConfig.webhook_url || "/api/webhooks/meta/whatsapp"} onChange={value => setCloudConfig((current: any) => ({ ...current, webhook_url: value }))} />
          <label className="block text-sm font-medium text-[var(--admin-muted)]">
            Ambiente
            <select value={cloudConfig.environment || "production"} onChange={event => setCloudConfig((current: any) => ({ ...current, environment: event.target.value }))} className="admin-input mt-1 w-full">
              <option value="sandbox">Teste</option>
              <option value="production">Produção</option>
            </select>
            <span className="mt-1 block text-xs text-[var(--admin-muted)]">Use teste enquanto valida a configuração inicial.</span>
          </label>
          <div className="flex items-end lg:col-span-2">
            <button className="admin-button-primary"><Save className="h-4 w-4" />Salvar configuração</button>
          </div>
        </form>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[var(--admin-border)] p-4">
            <h3 className="mb-3 font-semibold text-[var(--admin-text)]">Validação e templates</h3>
            <div className="space-y-2 text-sm text-[var(--admin-muted)]">
              <p>Número: {cloudPhone?.display_phone_number || cloudPhone?.id || "Ainda não validado"}</p>
              <p>Nome verificado: {cloudPhone?.verified_name || "Aguardando consulta"}</p>
              <p>Templates carregados: {cloudTemplates.length}</p>
              {cloudTemplates.slice(0, 5).map(template => (
                <p key={`${template.name}-${template.language}`} className="rounded border border-[var(--admin-border)] px-3 py-2 text-[var(--admin-text)]">{template.name} · {template.language} · {template.status}</p>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--admin-border)] p-4">
            <h3 className="mb-3 font-semibold text-[var(--admin-text)]">Logs da Cloud API</h3>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1 text-sm">
              {cloudLogs.slice(0, 8).map(log => (
                <div key={log.id} className="rounded border border-[var(--admin-border)] px-3 py-2">
                  <p className="font-semibold text-[var(--admin-text)]">{friendlyCloudAction(log.action)} · {friendlyCloudStatus(log.status)}</p>
                  <p className="text-xs text-[var(--admin-muted)]">{log.message || "Evento registrado"} · {new Date(log.created_at).toLocaleString("pt-BR")}</p>
                </div>
              ))}
              {!cloudLogs.length && <p className="text-[var(--admin-muted)]">Nenhum log registrado ainda.</p>}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="rounded-lg border border-[var(--admin-border)] p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold text-[var(--admin-text)]">Templates Oficiais</h3>
                <p className="text-sm text-[var(--admin-muted)]">Sincronize os modelos aprovados na Meta e mantenha uma cópia segura por cliente.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={syncCloudTemplates} className="admin-button-secondary"><ListChecks className="h-4 w-4" />Sincronizar templates</button>
                <button type="button" onClick={refreshSavedCloudTemplates} className="admin-button-secondary"><Eye className="h-4 w-4" />Atualizar lista</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-[var(--admin-muted)]">
                  <tr>
                    <th className="py-2 pr-3">Nome</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Idioma</th>
                    <th className="py-2 pr-3">Categoria</th>
                    <th className="py-2">Última sincronização</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]">
                  {savedCloudTemplates.map(template => (
                    <tr key={`${template.name}-${template.language}`} className="text-[var(--admin-text)]">
                      <td className="py-2 pr-3 font-semibold">{template.name}</td>
                      <td className="py-2 pr-3">{friendlyTemplateStatus(template.status)}</td>
                      <td className="py-2 pr-3">{template.language || "pt_BR"}</td>
                      <td className="py-2 pr-3">{template.category || "Sem categoria"}</td>
                      <td className="py-2 text-[var(--admin-muted)]">{template.synced_at ? new Date(template.synced_at).toLocaleString("pt-BR") : "Ainda não sincronizado"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!savedCloudTemplates.length && <p className="py-6 text-sm text-[var(--admin-muted)]">Nenhum template sincronizado ainda.</p>}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--admin-border)] p-4">
            <h3 className="mb-2 font-semibold text-[var(--admin-text)]">Enviar teste individual</h3>
            <p className="mb-4 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600">Envio permitido apenas para teste individual. Campanhas e disparos em massa serão configurados em etapa futura.</p>
            <div className="space-y-3">
              <label className="block text-sm text-[var(--admin-muted)]">
                Número de teste
                <input
                  value={templateTest.to}
                  onChange={event => setTemplateTest(prev => ({ ...prev, to: event.target.value }))}
                  placeholder="5599999999999"
                  className="admin-input mt-1"
                />
              </label>
              <label className="block text-sm text-[var(--admin-muted)]">
                Template
                <select
                  value={templateTest.templateName ? `${templateTest.templateName}::${templateTest.language}` : ""}
                  onChange={event => {
                    const [templateName = "", language = "pt_BR"] = event.target.value.split("::");
                    setTemplateTest(prev => ({ ...prev, templateName, language }));
                  }}
                  className="admin-input mt-1"
                >
                  <option value="">Escolha um template aprovado</option>
                  {savedCloudTemplates.filter(template => String(template.status || "").toUpperCase() === "APPROVED").map(template => (
                    <option key={`${template.name}-${template.language}`} value={`${template.name}::${template.language || "pt_BR"}`}>{template.name} · {template.language || "pt_BR"}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-[var(--admin-muted)]">
                Idioma
                <input
                  value={templateTest.language}
                  onChange={event => setTemplateTest(prev => ({ ...prev, language: event.target.value }))}
                  placeholder="pt_BR"
                  className="admin-input mt-1"
                />
              </label>
              <label className="block text-sm text-[var(--admin-muted)]">
                Variáveis/componentes
                <textarea
                  value={templateTest.components}
                  onChange={event => setTemplateTest(prev => ({ ...prev, components: event.target.value }))}
                  rows={4}
                  className="admin-input mt-1"
                />
              </label>
              <button type="button" onClick={sendCloudTemplateTest} className="admin-button-primary w-full justify-center"><Send className="h-4 w-4" />Enviar teste</button>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-[var(--admin-border)] p-4">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="font-semibold text-[var(--admin-text)]">Recuperação automática de PIX</h3>
              <p className="text-sm text-[var(--admin-muted)]">Recupere compras com PIX pendente ou vencido usando apenas templates oficiais aprovados.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={savePixRecoverySettings} className="admin-button-primary"><Save className="h-4 w-4" />Salvar automação</button>
              <button type="button" onClick={previewPixRecovery} className="admin-button-secondary"><Eye className="h-4 w-4" />Testar regra</button>
              <button type="button" onClick={enqueuePixRecovery} className="admin-button-secondary"><ListChecks className="h-4 w-4" />Criar fila</button>
              <button type="button" onClick={runPixRecoveryQueue} className="admin-button-secondary"><Send className="h-4 w-4" />Processar fila</button>
              <button type="button" onClick={refreshPixRecoveryQueue} className="admin-button-secondary"><Eye className="h-4 w-4" />Ver fila</button>
              <button type="button" onClick={refreshPixRecoveryQueue} className="admin-button-secondary"><CheckCircle className="h-4 w-4" />Ver logs</button>
            </div>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <PixRecoveryMetricCard label="PIX pendentes" value={String(pixRecoveryMetrics.pendingPix || 0)} />
            <PixRecoveryMetricCard label="Mensagens enviadas" value={String(pixRecoveryMetrics.messagesSent || 0)} />
            <PixRecoveryMetricCard label="Vendas recuperadas" value={String(pixRecoveryMetrics.recoveredSales || 0)} />
            <PixRecoveryMetricCard label="Valor recuperado" value={formatCurrency(pixRecoveryMetrics.recoveredValue || 0)} />
            <PixRecoveryMetricCard label="Taxa de recuperação" value={`${Number(pixRecoveryMetrics.recoveryRate || 0).toFixed(1)}%`} />
          </div>

          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--admin-text)]">Mensagem padrão de retomada</p>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">{defaultPixRecoveryMessage}</p>
                <p className="mt-2 text-xs text-emerald-700">Link usado no envio: /checkout/orders/:orderId. PIX vencido não é enviado pela recuperação.</p>
              </div>
              <button type="button" onClick={copyPixRecoveryTemplate} className="admin-button-secondary shrink-0"><Copy className="h-4 w-4" />Copiar preview</button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex items-center gap-2 rounded-lg border border-[var(--admin-border)] px-3 py-2 text-sm text-[var(--admin-text)]">
              <input
                type="checkbox"
                checked={Boolean(pixRecoverySettings.enabled)}
                onChange={event => setPixRecoverySettings((prev: any) => ({ ...prev, enabled: event.target.checked }))}
              />
              Ativar recuperação automática
            </label>
            <label className="text-sm text-[var(--admin-muted)]">
              Template para PIX pendente
              <select
                value={pixRecoverySettings.pending_template_name ? `${pixRecoverySettings.pending_template_name}::${pixRecoverySettings.pending_template_language || "pt_BR"}` : ""}
                onChange={event => {
                  const [name = "", language = "pt_BR"] = event.target.value.split("::");
                  setPixRecoverySettings((prev: any) => ({ ...prev, pending_template_name: name, pending_template_language: language }));
                }}
                className="admin-input mt-1"
              >
                <option value="">Escolha um template aprovado</option>
                {savedCloudTemplates.filter(template => String(template.status || "").toUpperCase() === "APPROVED").map(template => (
                  <option key={`pending-${template.name}-${template.language}`} value={`${template.name}::${template.language || "pt_BR"}`}>{template.name} · {template.language || "pt_BR"}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[var(--admin-muted)]">
              Template para PIX vencido
              <select
                value={pixRecoverySettings.expired_template_name ? `${pixRecoverySettings.expired_template_name}::${pixRecoverySettings.expired_template_language || "pt_BR"}` : ""}
                onChange={event => {
                  const [name = "", language = "pt_BR"] = event.target.value.split("::");
                  setPixRecoverySettings((prev: any) => ({ ...prev, expired_template_name: name, expired_template_language: language }));
                }}
                className="admin-input mt-1"
              >
                <option value="">Escolha um template aprovado</option>
                {savedCloudTemplates.filter(template => String(template.status || "").toUpperCase() === "APPROVED").map(template => (
                  <option key={`expired-${template.name}-${template.language}`} value={`${template.name}::${template.language || "pt_BR"}`}>{template.name} · {template.language || "pt_BR"}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[var(--admin-muted)]">
              Modo
              <select
                value={pixRecoverySettings.mode || "manual"}
                onChange={event => setPixRecoverySettings((prev: any) => ({ ...prev, mode: event.target.value }))}
                className="admin-input mt-1"
              >
                <option value="manual">Manual: apenas criar fila</option>
                <option value="automatic">Automático: enviar pela fila</option>
              </select>
            </label>
            <label className="text-sm text-[var(--admin-muted)]">
              Tempo mínimo após geração do PIX
              <input
                type="number"
                min={1}
                value={pixRecoverySettings.min_age_minutes || 15}
                onChange={event => setPixRecoverySettings((prev: any) => ({ ...prev, min_age_minutes: Number(event.target.value) }))}
                className="admin-input mt-1"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {[15, 30, 60].map(minutes => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setPixRecoverySettings((prev: any) => ({ ...prev, min_age_minutes: minutes }))}
                    className={`rounded-md border px-2 py-1 text-xs ${Number(pixRecoverySettings.min_age_minutes || 15) === minutes ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : "border-[var(--admin-border)] text-[var(--admin-muted)]"}`}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
            </label>
            <label className="text-sm text-[var(--admin-muted)]">
              Limite por cliente
              <input
                type="number"
                min={1}
                value={pixRecoverySettings.per_customer_cooldown_hours || 24}
                onChange={event => setPixRecoverySettings((prev: any) => ({ ...prev, per_customer_cooldown_hours: Number(event.target.value) }))}
                className="admin-input mt-1"
              />
            </label>
            <label className="text-sm text-[var(--admin-muted)]">
              Limite diário por tenant
              <input
                type="number"
                min={1}
                value={pixRecoverySettings.daily_tenant_limit || 100}
                onChange={event => setPixRecoverySettings((prev: any) => ({ ...prev, daily_tenant_limit: Number(event.target.value) }))}
                className="admin-input mt-1"
              />
            </label>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            <div className="rounded-lg border border-[var(--admin-border)] p-3">
              <h4 className="mb-2 font-semibold text-[var(--admin-text)]">Prévia da regra</h4>
              <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {pixRecoveryPreview.slice(0, 8).map(item => (
                  <div key={`${item.purchaseId}-${item.eventType}`} className="rounded border border-[var(--admin-border)] px-3 py-2">
                    <p className="font-semibold text-[var(--admin-text)]">{item.customerName} · {item.campaign}</p>
                    <p className="text-xs text-[var(--admin-muted)]">{friendlyPixRecoveryEvent(item.eventType)} · {item.eligible ? "Pronto para fila" : item.reason}</p>
                  </div>
                ))}
                {!pixRecoveryPreview.length && <p className="text-[var(--admin-muted)]">Clique em testar regra para ver compras elegíveis.</p>}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--admin-border)] p-3">
              <h4 className="mb-2 font-semibold text-[var(--admin-text)]">Fila de recuperação</h4>
              <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {pixRecoveryQueue.slice(0, 8).map(item => (
                  <div key={item.id} className="rounded border border-[var(--admin-border)] px-3 py-2">
                    <p className="font-semibold text-[var(--admin-text)]">{friendlyPixRecoveryEvent(item.event_type)} · {friendlyQueueStatus(item.status)}</p>
                    <p className="text-xs text-[var(--admin-muted)]">{item.order_id || "Pedido"} · {item.phone} · {item.reason || item.last_error || "Aguardando"}</p>
                  </div>
                ))}
                {!pixRecoveryQueue.length && <p className="text-[var(--admin-muted)]">Nenhuma mensagem na fila.</p>}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--admin-border)] p-3">
              <h4 className="mb-2 font-semibold text-[var(--admin-text)]">Logs de recuperação</h4>
              <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {pixRecoveryLogs.slice(0, 8).map(log => (
                  <div key={log.id} className="rounded border border-[var(--admin-border)] px-3 py-2">
                    <p className="font-semibold text-[var(--admin-text)]">{friendlyCloudAction(log.action)} · {friendlyCloudStatus(log.status)}</p>
                    <p className="text-xs text-[var(--admin-muted)]">{log.message || "Evento registrado"} · {new Date(log.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                ))}
                {!pixRecoveryLogs.length && <p className="text-[var(--admin-muted)]">Nenhum log de recuperação ainda.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-card">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">Confirmações Automáticas</h2>
              <p className="text-sm text-[var(--admin-muted)]">Envie confirmação de compra apenas depois do pagamento definitivo e liberação das cotas.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={savePurchaseConfirmationSettings} className="admin-button-primary"><Save className="h-4 w-4" />Salvar</button>
            <button type="button" onClick={testPurchaseConfirmationEvent} className="admin-button-secondary"><Send className="h-4 w-4" />Testar evento</button>
            <button type="button" onClick={refreshPurchaseConfirmationQueue} className="admin-button-secondary"><Eye className="h-4 w-4" />Ver fila</button>
            <button type="button" onClick={refreshPurchaseConfirmationQueue} className="admin-button-secondary"><ListChecks className="h-4 w-4" />Ver logs</button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex items-center gap-2 rounded-lg border border-[var(--admin-border)] px-3 py-2 text-sm text-[var(--admin-text)]">
            <input
              type="checkbox"
              checked={Boolean(purchaseConfirmationSettings.enabled)}
              onChange={event => setPurchaseConfirmationSettings((prev: any) => ({ ...prev, enabled: event.target.checked }))}
            />
            Ativar confirmação automática
          </label>
          <label className="text-sm text-[var(--admin-muted)] xl:col-span-2">
            Template de confirmação
            <select
              value={purchaseConfirmationSettings.template_name ? `${purchaseConfirmationSettings.template_name}::${purchaseConfirmationSettings.template_language || "pt_BR"}` : ""}
              onChange={event => {
                const [name = "", language = "pt_BR"] = event.target.value.split("::");
                setPurchaseConfirmationSettings((prev: any) => ({ ...prev, template_name: name, template_language: language }));
              }}
              className="admin-input mt-1"
            >
              <option value="">Escolha um template aprovado</option>
              {savedCloudTemplates.filter(template => String(template.status || "").toUpperCase() === "APPROVED").map(template => (
                <option key={`purchase-confirmed-${template.name}-${template.language}`} value={`${template.name}::${template.language || "pt_BR"}`}>{template.name} · {template.language || "pt_BR"}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[var(--admin-muted)]">
            Modo
            <select
              value={purchaseConfirmationSettings.mode || "manual"}
              onChange={event => setPurchaseConfirmationSettings((prev: any) => ({ ...prev, mode: event.target.value }))}
              className="admin-input mt-1"
            >
              <option value="manual">Manual</option>
              <option value="automatic">Automático</option>
            </select>
          </label>
          <label className="text-sm text-[var(--admin-muted)]">
            Limite diário
            <input
              type="number"
              min={1}
              value={purchaseConfirmationSettings.daily_tenant_limit || 100}
              onChange={event => setPurchaseConfirmationSettings((prev: any) => ({ ...prev, daily_tenant_limit: Number(event.target.value) }))}
              className="admin-input mt-1"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-[var(--admin-border)] px-3 py-2 text-sm text-[var(--admin-text)]">
            <input
              type="checkbox"
              checked={purchaseConfirmationSettings.paid_only !== false}
              onChange={event => setPurchaseConfirmationSettings((prev: any) => ({ ...prev, paid_only: event.target.checked }))}
            />
            Enviar somente compras pagas
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-xs text-[var(--admin-muted)]">
          Variáveis permitidas: nome, campanha, quantidade_cotas, numeros, valor, link_campanha.
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-[var(--admin-border)] p-3">
            <h4 className="mb-2 font-semibold text-[var(--admin-text)]">Fila de confirmações</h4>
            <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {purchaseConfirmationQueue.slice(0, 8).map(item => (
                <div key={item.id} className="rounded border border-[var(--admin-border)] px-3 py-2">
                  <p className="font-semibold text-[var(--admin-text)]">purchase_confirmed · {friendlyQueueStatus(item.status)}</p>
                  <p className="text-xs text-[var(--admin-muted)]">{item.order_id || "Pedido"} · {item.phone} · {item.reason || item.last_error || "Aguardando"}</p>
                </div>
              ))}
              {!purchaseConfirmationQueue.length && <p className="text-[var(--admin-muted)]">Nenhuma confirmação na fila.</p>}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--admin-border)] p-3">
            <h4 className="mb-2 font-semibold text-[var(--admin-text)]">Logs de confirmações</h4>
            <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {purchaseConfirmationLogs.slice(0, 8).map(log => (
                <div key={log.id} className="rounded border border-[var(--admin-border)] px-3 py-2">
                  <p className="font-semibold text-[var(--admin-text)]">{friendlyCloudAction(log.action)} · {friendlyCloudStatus(log.status)}</p>
                  <p className="text-xs text-[var(--admin-muted)]">{log.message || "Evento registrado"} · {new Date(log.created_at).toLocaleString("pt-BR")}</p>
                </div>
              ))}
              {!purchaseConfirmationLogs.length && <p className="text-[var(--admin-muted)]">Nenhum log de confirmação ainda.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="admin-card">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">WhatsApp automático</h2>
        </div>
        <form onSubmit={saveWhatsApp} className="grid gap-4 lg:grid-cols-3">
          <label className="block text-sm font-medium text-[var(--admin-muted)]">
            Envio automático
            <select value={whatsappConfig.enabled ? "true" : "false"} onChange={event => setWhatsappConfig((current: any) => ({ ...current, enabled: event.target.value === "true" }))} className="admin-input mt-1 w-full">
              <option value="false">Desativado</option>
              <option value="true">Ativado</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-[var(--admin-muted)]">
            Serviço de envio
            <select value={whatsappConfig.provider || "meta_cloud"} onChange={event => setWhatsappConfig((current: any) => ({ ...current, provider: event.target.value }))} className="admin-input mt-1 w-full">
              <option value="mock">Validação interna</option>
              <option value="meta_cloud">WhatsApp oficial</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-[var(--admin-muted)]">
            Situação do ambiente
            <select value={whatsappConfig.environment || "production"} onChange={event => setWhatsappConfig((current: any) => ({ ...current, environment: event.target.value }))} className="admin-input mt-1 w-full">
              <option value="sandbox">Validação interna</option>
              <option value="production">Produção</option>
            </select>
          </label>
          <details className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 lg:col-span-3">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--admin-text)]">Conexão com WhatsApp oficial</summary>
            <p className="mt-2 text-xs text-[var(--admin-muted)]">Use estes campos apenas quando o número já estiver aprovado no painel da Meta. As chaves ficam protegidas e não aparecem para compradores.</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <GatewayField label="Número conectado" help="Identifica o número aprovado para enviar mensagens pelo WhatsApp oficial." value={whatsappConfig.phone_number_id || ""} onChange={value => setWhatsappConfig((current: any) => ({ ...current, phone_number_id: value }))} />
              <GatewayField label="Conta comercial" help="Conta empresarial onde o número foi cadastrado." value={whatsappConfig.business_account_id || ""} onChange={value => setWhatsappConfig((current: any) => ({ ...current, business_account_id: value }))} />
              <GatewayField label="Chave privada" help="Cole a chave fornecida pelo WhatsApp oficial. Ela será salva de forma protegida." type="password" value={whatsappConfig.access_token || ""} onChange={value => setWhatsappConfig((current: any) => ({ ...current, access_token: value }))} />
              <GatewayField label="Código de confirmação" help="Código usado para confirmar que o canal pertence a esta loja." type="password" value={whatsappConfig.webhook_verify_token || ""} onChange={value => setWhatsappConfig((current: any) => ({ ...current, webhook_verify_token: value }))} />
              <GatewayField label="Modelo de mensagem" help="Nome comercial do modelo aprovado para mensagens automáticas." value={whatsappConfig.template_namespace || ""} onChange={value => setWhatsappConfig((current: any) => ({ ...current, template_namespace: value }))} />
            </div>
          </details>
          <GatewayField label="Idioma" value={whatsappConfig.default_language || "pt_BR"} onChange={value => setWhatsappConfig((current: any) => ({ ...current, default_language: value }))} />
          <div className="flex gap-2 lg:col-span-3">
            <button className="admin-button-primary"><Save className="h-4 w-4" />Salvar WhatsApp</button>
            <input value={testPhone} onChange={event => setTestPhone(event.target.value)} className="admin-input flex-1" placeholder="Telefone para validação" />
            <button type="button" onClick={testWhatsApp} className="admin-button-secondary"><Send className="h-4 w-4" />Testar envio</button>
          </div>
        </form>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-[var(--admin-muted)]"><tr><th className="py-2">Compra</th><th>Telefone</th><th>Mensagem</th><th>Canal</th><th>Situação</th><th>Observação</th></tr></thead>
            <tbody>
              {whatsappMessages.slice(0, 10).map(message => (
                <tr key={message.id} className="border-t border-[var(--admin-border)]">
                  <td className="py-2">{message.order_id ? "Compra vinculada" : "-"}</td>
                  <td>{message.phone}</td>
                  <td>{friendlyMessageType(message.message_type)}</td>
                  <td>{friendlyProviderName(message.provider)}</td>
                  <td>{friendlyMessageStatus(message.status)}</td>
                  <td className="max-w-xs truncate">{friendlyOperationalMessage(message.last_error)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <div className="mb-4 flex items-center gap-2">
          <Eye className="h-5 w-5 text-[var(--admin-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">Últimos logs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-[var(--admin-muted)]">
              <tr><th className="py-2">Canal</th><th>Ação</th><th>Situação</th><th>Observação</th><th>Data</th></tr>
            </thead>
            <tbody>
              {logs.slice(0, 12).map(log => (
                <tr key={log.id} className="border-t border-[var(--admin-border)]">
                  <td className="py-2">{friendlyProviderName(log.provider)}</td>
                  <td>{friendlyLogAction(log.action)}</td>
                  <td>{log.success ? <span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle className="h-4 w-4" /> Concluída</span> : "Precisa de atenção"}</td>
                  <td className="max-w-xs truncate">{friendlyOperationalMessage(log.error_message)}</td>
                  <td>{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => integrations[0] && void fetch(`/api/admin/integrations/global/${integrations[0].id}/action/sendConversionEvent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventName: "Lead" }) }).then(load)} className="admin-button-secondary mt-4">
          <Send className="h-4 w-4" />
          Enviar evento de validação
        </button>
      </section>
    </div>
  );
}

function GatewayField({ label, value, onChange, type = "text", help }: { key?: React.Key; label: string; value: string; onChange: (value: string) => void; type?: string; help?: string }) {
  return (
    <label className="block text-sm font-medium text-[var(--admin-muted)]">
      {label}
      <input type={type} value={value} onChange={event => onChange(event.target.value)} className="admin-input mt-1 w-full" />
      {help && <span className="mt-1 block text-xs text-[var(--admin-muted)]">{help}</span>}
    </label>
  );
}

function parseConfigText(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function PixRecoveryMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-card-muted)] px-3 py-2">
      <p className="text-xs text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--admin-text)]">{value}</p>
    </div>
  );
}

function friendlyProviderName(value?: string) {
  const labels: Record<string, string> = {
    mock: "Validação interna",
    meta_cloud: "WhatsApp oficial",
    primepag: "PrimePag",
    mercadopago: "Mercado Pago",
    pagbank: "PagBank",
    asaas: "Asaas"
  };
  return labels[String(value || "").toLowerCase()] || "Canal configurado";
}

function friendlyIntegrationName(item: Integration) {
  return item.catalog?.label || item.name || friendlyProviderName(item.provider);
}

function friendlyIntegrationType(value?: string) {
  const labels: Record<string, string> = {
    payment: "Pagamento",
    whatsapp: "WhatsApp",
    email: "E-mail",
    analytics: "Medição de conversões",
    generic: "Integração"
  };
  return labels[String(value || "").toLowerCase()] || "Integração";
}

function friendlyIntegrationStatus(value?: string) {
  const labels: Record<string, string> = {
    active: "Ativa",
    inactive: "Inativa",
    error: "Precisa de atenção",
    pending_config: "Pendente de configuração"
  };
  return labels[String(value || "").toLowerCase()] || "Em revisão";
}

function friendlyCredentialLabel(key: string) {
  const labels: Record<string, string> = {
    access_token: "Chave privada",
    accessToken: "Chave privada",
    token: "Chave privada",
    apiKey: "Chave protegida",
    api_key: "Chave protegida",
    clientId: "Conta do serviço",
    client_id: "Conta do serviço",
    clientSecret: "Senha da conta do serviço",
    client_secret: "Senha da conta do serviço",
    publicKey: "Chave pública",
    public_key: "Chave pública",
    phone_number_id: "Número conectado",
    business_account_id: "Conta comercial",
    webhook_verify_token: "Código de confirmação"
  };
  return labels[key] || "Dado de conexão";
}

function friendlyCredentialHelp(key: string) {
  if (key.toLowerCase().includes("secret") || key.toLowerCase().includes("token") || key.toLowerCase().includes("key")) {
    return "Cole o valor fornecido pelo serviço. Ele será salvo de forma protegida.";
  }
  return "Use a informação exibida no painel do serviço conectado.";
}

function isSensitiveCredential(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes("secret") || normalized.includes("token") || normalized.includes("key");
}

function friendlyHomologation(value?: string) {
  const labels: Record<string, string> = {
    ready: "pronta para uso",
    partial: "em validação assistida",
    placeholder: "aguardando configuração"
  };
  return labels[String(value || "").toLowerCase()] || "em revisão";
}

function friendlyDocumentation(value?: string) {
  const labels: Record<string, string> = {
    official_public: "pública e oficial",
    official_portal: "disponível no portal do serviço",
    missing: "não informada"
  };
  return labels[String(value || "").toLowerCase()] || "não informada";
}

function friendlyWebhookValidation(value?: string) {
  if (!value) return "Validação automática";
  if (value.toLowerCase().includes("manual")) return "Validação manual";
  return "Validação automática";
}

function friendlyMessageType(value?: string) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("payment")) return "Pagamento";
  if (normalized.includes("reminder")) return "Lembrete";
  if (normalized.includes("conversion")) return "Conversão";
  return "Mensagem";
}

function friendlyMessageStatus(value?: string) {
  const labels: Record<string, string> = {
    sent: "Enviada",
    delivered: "Entregue",
    failed: "Falhou",
    pending: "Aguardando envio",
    queued: "Na fila"
  };
  return labels[String(value || "").toLowerCase()] || "Em processamento";
}

function friendlyLogAction(value?: string) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("send")) return "Envio de mensagem";
  if (normalized.includes("test")) return "Teste de conexão";
  if (normalized.includes("conversion")) return "Conversão registrada";
  if (normalized.includes("save")) return "Configuração salva";
  return "Operação registrada";
}

function friendlyCloudAction(value?: string) {
  const labels: Record<string, string> = {
    settings_saved: "Configuração salva",
    test_connection: "Teste de conexão",
    phone_info: "Validação do número",
    list_templates: "Lista de templates",
    templates_synced: "Templates sincronizados",
    template_test_requested: "Teste individual solicitado",
    template_test_sent: "Teste individual enviado",
    pix_recovery_settings_saved: "Recuperação de PIX salva",
    pix_recovery_preview: "Prévia da recuperação",
    pix_recovery_enqueued: "Recuperação adicionada",
    pix_recovery_sent: "Recuperação enviada",
    pix_recovery_skipped: "Recuperação ignorada",
    purchase_confirmation_settings_saved: "Confirmação salva",
    purchase_confirmation_event: "Compra confirmada",
    purchase_confirmation_enqueued: "Confirmação adicionada",
    purchase_confirmation_send_requested: "Envio solicitado",
    purchase_confirmation_sent: "Confirmação enviada",
    purchase_confirmation_failed: "Falha na confirmação",
    purchase_confirmation_skipped: "Confirmação ignorada",
    webhook_validate: "Validação do webhook",
    webhook_received: "Webhook recebido",
    credential_error: "Credencial incompleta",
    meta_api_error: "Retorno da Meta"
  };
  return labels[String(value || "").toLowerCase()] || "Operação registrada";
}

function friendlyPixRecoveryEvent(value?: string) {
  const labels: Record<string, string> = {
    pix_pending_reminder: "PIX pendente",
    pix_expired_reminder: "PIX vencido"
  };
  return labels[String(value || "").toLowerCase()] || "Recuperação de PIX";
}

function friendlyQueueStatus(value?: string) {
  const labels: Record<string, string> = {
    queued: "Na fila",
    pending: "Aguardando",
    retrying: "Tentando novamente",
    sent: "Enviado",
    failed: "Falhou",
    skipped: "Ignorado"
  };
  return labels[String(value || "").toLowerCase()] || "Aguardando";
}

function friendlyTemplateStatus(value?: string) {
  const labels: Record<string, string> = {
    approved: "Aprovado",
    pending: "Pendente",
    rejected: "Rejeitado"
  };
  return labels[String(value || "").toLowerCase()] || "Em análise";
}

function friendlyCloudStatus(value?: string) {
  const labels: Record<string, string> = {
    success: "Concluído",
    error: "Precisa de atenção",
    skipped: "Não executado"
  };
  return labels[String(value || "").toLowerCase()] || "Em análise";
}

function friendlyOperationalMessage(value?: unknown) {
  const text = String(value || "").trim();
  if (!text) return "-";
  const lower = text.toLowerCase();
  if (lower.includes("timeout") || lower.includes("econn") || lower.includes("network")) return "Conexão instável com o serviço.";
  if (lower.includes("unauthorized") || lower.includes("forbidden") || lower.includes("invalid token")) return "Revise as chaves de conexão.";
  if (lower.includes("{") || lower.includes("}") || lower.includes("payload") || lower.includes("json")) return "Detalhes técnicos protegidos pelo sistema.";
  if (/[a-f0-9]{24,}/i.test(text) || /\b(order_id|purchaseid|raffleid|provider|status_code)\b/i.test(text)) return "Detalhes técnicos protegidos pelo sistema.";
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

