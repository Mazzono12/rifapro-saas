import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle, Eye, Plug, Save, Send, ShieldCheck } from "lucide-react";
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
  const [selected, setSelected] = useState("primepag");
  const [credentials, setCredentials] = useState("{}");
  const [settings, setSettings] = useState("{\"sandbox\":true,\"mock\":true}");
  const [status, setStatus] = useState<Integration["status"]>("inactive");

  const selectedProvider = useMemo(() => providers.find(item => item.provider === selected), [providers, selected]);

  const load = async () => {
    const [integrationsRes, logsRes] = await Promise.all([
      fetch("/api/admin/integrations/global"),
      fetch("/api/admin/integrations/global/logs")
    ]);
    const data = await integrationsRes.json();
    setProviders(data.providers || []);
    setIntegrations(data.integrations || []);
    setLogs(await logsRes.json());
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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="admin-card">
          <div className="mb-4 flex items-center gap-2">
            <Plug className="h-5 w-5 text-[var(--admin-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Integrações do tenant</h2>
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
                  {Object.entries(item.credentials || {}).map(([key, value]) => <p key={key}>{key}: {String(value)}</p>)}
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
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="pending_config">pending_config</option>
            </select>
          </label>
          <div className="space-y-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            <p>Credenciais: {(selectedProvider?.requiredCredentials || []).join(", ")}</p>
            {Boolean(selectedProvider?.optionalCredentials?.length) && <p>Opcionais: {selectedProvider?.optionalCredentials?.join(", ")}</p>}
            <p>Homologação: {selectedProvider?.homologationStatus} / docs: {selectedProvider?.documentationStatus}</p>
            <p>Webhook: {selectedProvider?.webhookValidation}</p>
            <p>{selectedProvider?.notes}</p>
            <div className="flex flex-wrap gap-2">
              {selectedProvider?.docs.map(doc => <a key={doc} href={doc} target="_blank" rel="noreferrer" className="text-[var(--admin-primary)] underline">doc</a>)}
            </div>
          </div>
          <label className="block text-sm font-medium text-[var(--admin-muted)]">
            Credenciais JSON
            <textarea value={credentials} onChange={event => setCredentials(event.target.value)} className="admin-input mt-1 min-h-32 w-full font-mono text-xs" />
          </label>
          <label className="block text-sm font-medium text-[var(--admin-muted)]">
            Settings JSON
            <textarea value={settings} onChange={event => setSettings(event.target.value)} className="admin-input mt-1 min-h-24 w-full font-mono text-xs" />
          </label>
          <button className="admin-button-primary w-full">
            <Save className="h-4 w-4" />
            Salvar
          </button>
        </form>
      </div>

      <section className="admin-card">
        <div className="mb-4 flex items-center gap-2">
          <Eye className="h-5 w-5 text-[var(--admin-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">Últimos logs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-[var(--admin-muted)]">
              <tr><th className="py-2">Provedor</th><th>Ação</th><th>Status</th><th>Erro</th><th>Data</th></tr>
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
          Enviar evento teste
        </button>
      </section>
    </div>
  );
}
