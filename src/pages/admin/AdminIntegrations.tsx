import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle, Eye, MessageCircle, Plug, Save, Send, ShieldCheck } from "lucide-react";
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

export function AdminIntegrations() {
  const [providers, setProviders] = useState<ProviderCatalogEntry[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [whatsappConfig, setWhatsappConfig] = useState<any>({ provider: "mock", enabled: false, environment: "sandbox", default_language: "pt_BR" });
  const [whatsappMessages, setWhatsappMessages] = useState<any[]>([]);
  const [testPhone, setTestPhone] = useState("");
  const [selected, setSelected] = useState("primepag");
  const [credentials, setCredentials] = useState("{}");
  const [settings, setSettings] = useState("{\"sandbox\":true,\"mock\":true}");
  const [status, setStatus] = useState<Integration["status"]>("inactive");

  const selectedProvider = useMemo(() => providers.find(item => item.provider === selected), [providers, selected]);
  const selectedCredentialValues = useMemo(() => parseConfigText(credentials), [credentials]);
  const selectedSettingsValues = useMemo(() => parseConfigText(settings), [settings]);

  const load = async () => {
    const [integrationsRes, logsRes, whatsappConfigRes, whatsappMessagesRes] = await Promise.all([
      fetch("/api/admin/integrations/global"),
      fetch("/api/admin/integrations/global/logs"),
      fetch("/api/admin/whatsapp/config"),
      fetch("/api/admin/whatsapp/messages")
    ]);
    const data = await integrationsRes.json();
    setProviders(data.providers || []);
    setIntegrations(data.integrations || []);
    setLogs(await logsRes.json());
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
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{friendlyIntegrationStatus(item.status)}</span>
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
              setSettings(JSON.stringify(provider?.defaultSettings || { sandbox: true, mock: true }, null, 2));
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
            <select value={whatsappConfig.provider || "mock"} onChange={event => setWhatsappConfig((current: any) => ({ ...current, provider: event.target.value }))} className="admin-input mt-1 w-full">
              <option value="mock">Validação interna</option>
              <option value="meta_cloud">WhatsApp oficial</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-[var(--admin-muted)]">
            Situação do ambiente
            <select value={whatsappConfig.environment || "sandbox"} onChange={event => setWhatsappConfig((current: any) => ({ ...current, environment: event.target.value }))} className="admin-input mt-1 w-full">
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
