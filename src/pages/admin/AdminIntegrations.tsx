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
      toast.success("Integracao salva");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "JSON invalido");
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
                    <p className="font-semibold text-[var(--admin-text)]">{item.name}</p>
                    <p className="text-sm text-[var(--admin-muted)]">{item.provider} / {item.type}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{item.status}</span>
                </div>
                <div className="mt-3 text-xs text-[var(--admin-muted)]">
                  <p>Credenciais protegidas</p>
                  {item.last_error && <p className="mt-2 text-red-500">{item.last_error}</p>}
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
            Provedor
            <select value={selected} onChange={event => {
              const provider = providers.find(item => item.provider === event.target.value);
              setSelected(event.target.value);
              setSettings(JSON.stringify(provider?.defaultSettings || { sandbox: true, mock: true }, null, 2));
            }} className="admin-input mt-1 w-full">
              {providers.map(item => <option key={item.provider} value={item.provider}>{item.label} ({item.type})</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-[var(--admin-muted)]">
            Status
            <select value={status} onChange={event => setStatus(event.target.value as Integration["status"])} className="admin-input mt-1 w-full">
              <option value="active">Ativa</option>
              <option value="inactive">Inativa</option>
              <option value="pending_config">Pendente de configuração</option>
            </select>
          </label>
          <details className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--admin-text)]">Configurações Avançadas</summary>
            <div className="mt-4 space-y-4">
              <div className="space-y-2 rounded-lg border border-[var(--admin-border)] p-3 text-xs text-[var(--admin-muted)]">
                <p>Credenciais necessárias: {(selectedProvider?.requiredCredentials || []).join(", ") || "nenhuma"}</p>
                {Boolean(selectedProvider?.optionalCredentials?.length) && <p>Opcionais: {selectedProvider?.optionalCredentials?.join(", ")}</p>}
                <p>Homologação: {selectedProvider?.homologationStatus} / documentação: {selectedProvider?.documentationStatus}</p>
                <p>Validação de conexão: {selectedProvider?.webhookValidation}</p>
                <p>{selectedProvider?.notes}</p>
                <div className="flex flex-wrap gap-2">
                  {selectedProvider?.docs.map(doc => <a key={doc} href={doc} target="_blank" rel="noreferrer" className="text-[var(--admin-primary)] underline">documentação</a>)}
                </div>
              </div>
              <label className="block text-sm font-medium text-[var(--admin-muted)]">
                Credenciais JSON
                <textarea value={credentials} onChange={event => setCredentials(event.target.value)} className="admin-input mt-1 min-h-32 w-full font-mono text-xs" />
              </label>
              <label className="block text-sm font-medium text-[var(--admin-muted)]">
                Configurações JSON
                <textarea value={settings} onChange={event => setSettings(event.target.value)} className="admin-input mt-1 min-h-24 w-full font-mono text-xs" />
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
            Provedor
            <select value={whatsappConfig.provider || "mock"} onChange={event => setWhatsappConfig((current: any) => ({ ...current, provider: event.target.value }))} className="admin-input mt-1 w-full">
              <option value="mock">Validação interna</option>
              <option value="meta_cloud">Meta WhatsApp Cloud API</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-[var(--admin-muted)]">
            Ambiente
            <select value={whatsappConfig.environment || "sandbox"} onChange={event => setWhatsappConfig((current: any) => ({ ...current, environment: event.target.value }))} className="admin-input mt-1 w-full">
              <option value="sandbox">Validação</option>
              <option value="production">Produção</option>
            </select>
          </label>
          <details className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 lg:col-span-3">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--admin-text)]">Configurações Avançadas</summary>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <GatewayField label="Phone number ID" value={whatsappConfig.phone_number_id || ""} onChange={value => setWhatsappConfig((current: any) => ({ ...current, phone_number_id: value }))} />
              <GatewayField label="Business account ID" value={whatsappConfig.business_account_id || ""} onChange={value => setWhatsappConfig((current: any) => ({ ...current, business_account_id: value }))} />
              <GatewayField label="Access token" type="password" value={whatsappConfig.access_token || ""} onChange={value => setWhatsappConfig((current: any) => ({ ...current, access_token: value }))} />
              <GatewayField label="Verify token" type="password" value={whatsappConfig.webhook_verify_token || ""} onChange={value => setWhatsappConfig((current: any) => ({ ...current, webhook_verify_token: value }))} />
              <GatewayField label="Template padrão" value={whatsappConfig.template_namespace || ""} onChange={value => setWhatsappConfig((current: any) => ({ ...current, template_namespace: value }))} />
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
            <thead className="text-xs uppercase text-[var(--admin-muted)]"><tr><th className="py-2">Pedido</th><th>Telefone</th><th>Tipo</th><th>Provider</th><th>Status</th><th>Erro</th></tr></thead>
            <tbody>
              {whatsappMessages.slice(0, 10).map(message => (
                <tr key={message.id} className="border-t border-[var(--admin-border)]">
                  <td className="py-2">{message.order_id || "-"}</td>
                  <td>{message.phone}</td>
                  <td>{message.message_type}</td>
                  <td>{message.provider}</td>
                  <td>{message.status}</td>
                  <td className="max-w-xs truncate">{message.last_error || "-"}</td>
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
              <tr><th className="py-2">Provedor</th><th>Ação</th><th>Status</th><th>Observação</th><th>Data</th></tr>
            </thead>
            <tbody>
              {logs.slice(0, 12).map(log => (
                <tr key={log.id} className="border-t border-[var(--admin-border)]">
                  <td className="py-2">{log.provider}</td>
                  <td>{log.action}</td>
                  <td>{log.success ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : log.status_code}</td>
                  <td className="max-w-xs truncate">{log.error_message}</td>
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

function GatewayField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block text-sm font-medium text-[var(--admin-muted)]">
      {label}
      <input type={type} value={value} onChange={event => onChange(event.target.value)} className="admin-input mt-1 w-full" />
    </label>
  );
}
