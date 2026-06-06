import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, PackageCheck, Percent, RefreshCw, WalletCards } from "lucide-react";
import { toast } from "sonner";

type BillingTenantRow = {
  tenant: { id: string; nome: string; slug: string; status: string } | null;
  settings: { platformCommissionEnabled: boolean; platformCommissionRate: number; platformCommissionMode: "gross_revenue" | "net_after_gateway_fee" };
  grossRevenue: number;
  revenueShareAmount: number;
  addOnsAmount: number;
  totalDue: number;
  activeAddons: Array<{ addon_key: string; monthly_price: number; billing_status: string }>;
  statement?: { id: string; status: string } | null;
};

type TenantDetail = BillingTenantRow & {
  addonCatalog: Array<{ key: string; label: string; defaultMonthlyPrice: number }>;
  addonSubscriptions: Array<{ addon_key: string; enabled: boolean; monthly_price: number; billing_status: string }>;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function total(rows: BillingTenantRow[], key: keyof Pick<BillingTenantRow, "grossRevenue" | "revenueShareAmount" | "addOnsAmount" | "totalDue">) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function Metric({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: string }) {
  return (
    <div className="admin-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm text-[var(--admin-muted)]">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="text-2xl font-semibold text-[var(--admin-text)]">{value}</p>
    </div>
  );
}

export function SuperAdminPlatformBilling() {
  const [rows, setRows] = useState<BillingTenantRow[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [rate, setRate] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<"gross_revenue" | "net_after_gateway_fee">("gross_revenue");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/superadmin/platform-billing/summary");
    const data = await response.json();
    const tenants = Array.isArray(data.tenants) ? data.tenants : [];
    setRows(tenants);
    const fallbackTenantId = selectedTenantId || tenants[0]?.tenant?.id || "";
    if (fallbackTenantId) await loadTenant(fallbackTenantId);
    setLoading(false);
  }

  async function loadTenant(tenantId: string) {
    setSelectedTenantId(tenantId);
    const response = await fetch(`/api/superadmin/platform-billing/tenants/${tenantId}`);
    const data = await response.json();
    setDetail(data);
    setRate(Number(data.settings?.platformCommissionRate || 0));
    setEnabled(Boolean(data.settings?.platformCommissionEnabled));
    setMode(data.settings?.platformCommissionMode || "gross_revenue");
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedRow = useMemo(() => rows.find(row => row.tenant?.id === selectedTenantId) || null, [rows, selectedTenantId]);

  async function saveSettings() {
    await fetch(`/api/superadmin/platform-billing/tenants/${selectedTenantId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformCommissionEnabled: enabled, platformCommissionRate: rate, platformCommissionMode: mode })
    });
    toast.success("Comissão atualizada");
    await load();
  }

  async function saveAddon(addonKey: string, enabledValue: boolean, monthlyPrice: number) {
    await fetch(`/api/superadmin/platform-billing/tenants/${selectedTenantId}/addons`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addonKey, enabled: enabledValue, monthlyPrice, billingStatus: enabledValue ? "active" : "cancelled" })
    });
    toast.success("Add-on atualizado");
    await loadTenant(selectedTenantId);
    await load();
  }

  async function generateStatement() {
    const response = await fetch("/api/superadmin/platform-billing/statements/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: selectedTenantId })
    });
    if (!response.ok) return toast.error("Falha ao gerar fechamento");
    toast.success("Fechamento gerado");
    await load();
  }

  async function markStatement(action: "mark-paid" | "mark-overdue") {
    const statementId = selectedRow?.statement?.id || detail?.statement?.id;
    if (!statementId) return toast.error("Gere um fechamento primeiro");
    await fetch(`/api/superadmin/platform-billing/statements/${statementId}/${action}`, { method: "POST" });
    toast.success(action === "mark-paid" ? "Marcado como pago" : "Marcado como vencido");
    await load();
  }

  if (loading) return <div className="admin-card p-6 text-[var(--admin-muted)]">Carregando billing...</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric icon={WalletCards} label="Faturamento bruto" value={money.format(total(rows, "grossRevenue"))} />
        <Metric icon={Percent} label="Comissão gerada" value={money.format(total(rows, "revenueShareAmount"))} />
        <Metric icon={PackageCheck} label="Add-ons" value={money.format(total(rows, "addOnsAmount"))} />
        <Metric icon={FileText} label="Total devido" value={money.format(total(rows, "totalDue"))} />
      </div>

      <section className="admin-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] p-4">
          <h2 className="mb-0 text-lg font-semibold text-[var(--admin-text)]">Billing da Plataforma</h2>
          <button type="button" onClick={() => void load()} className="admin-icon-button" aria-label="Atualizar" title="Atualizar"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="text-[var(--admin-muted)]">
              <tr>
                <th className="p-3">Tenant</th>
                <th className="p-3">Faturamento</th>
                <th className="p-3">Comissão %</th>
                <th className="p-3">Comissão</th>
                <th className="p-3">Add-ons</th>
                <th className="p-3">Total devido</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.tenant?.id} onClick={() => row.tenant?.id && void loadTenant(row.tenant.id)} className="cursor-pointer border-t border-[var(--admin-border)] text-[var(--admin-text)] hover:bg-white/5">
                  <td className="p-3 font-semibold">{row.tenant?.nome || row.tenant?.id}</td>
                  <td className="p-3">{money.format(row.grossRevenue)}</td>
                  <td className="p-3">{row.settings.platformCommissionRate}%</td>
                  <td className="p-3">{money.format(row.revenueShareAmount)}</td>
                  <td className="p-3">{row.activeAddons.length} ativos · {money.format(row.addOnsAmount)}</td>
                  <td className="p-3 font-semibold">{money.format(row.totalDue)}</td>
                  <td className="p-3">{row.statement?.status || "open"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {detail && (
        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="admin-card p-4">
            <h2 className="mb-4 text-lg font-semibold text-[var(--admin-text)]">Configuração comercial</h2>
            <label className="mb-3 flex items-center gap-2 text-sm text-[var(--admin-text)]">
              <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />
              Comissão sobre faturamento ativa
            </label>
            <label className="mb-3 block text-sm text-[var(--admin-muted)]">
              Percentual
              <input className="admin-input mt-1" type="number" min={0} max={100} value={rate} onChange={event => setRate(Number(event.target.value))} />
            </label>
            <label className="mb-4 block text-sm text-[var(--admin-muted)]">
              Base de cálculo
              <select className="admin-input mt-1" value={mode} onChange={event => setMode(event.target.value as typeof mode)}>
                <option value="gross_revenue">Faturamento bruto</option>
                <option value="net_after_gateway_fee">Líquido após gateway</option>
              </select>
            </label>
            <button type="button" onClick={() => void saveSettings()} className="admin-button w-full"><CheckCircle2 className="h-4 w-4" /> Salvar comissão</button>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void generateStatement()} className="admin-button-secondary">Gerar fechamento</button>
              <button type="button" onClick={() => void markStatement("mark-paid")} className="admin-button-secondary">Marcar pago</button>
              <button type="button" onClick={() => void markStatement("mark-overdue")} className="admin-button-secondary col-span-2">Marcar vencido</button>
            </div>
          </div>

          <div className="admin-card p-4">
            <h2 className="mb-4 text-lg font-semibold text-[var(--admin-text)]">Add-ons mensais</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {detail.addonCatalog.map(addon => {
                const subscription = detail.addonSubscriptions.find(item => item.addon_key === addon.key);
                const enabledValue = Boolean(subscription?.enabled);
                const price = Number(subscription?.monthly_price ?? addon.defaultMonthlyPrice);
                return (
                  <div key={addon.key} className="rounded-[8px] border border-[var(--admin-border)] p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="font-semibold text-[var(--admin-text)]">{addon.label}</span>
                      <input type="checkbox" checked={enabledValue} onChange={event => void saveAddon(addon.key, event.target.checked, price)} />
                    </div>
                    <input className="admin-input" type="number" min={0} defaultValue={price} onBlur={event => void saveAddon(addon.key, enabledValue, Number(event.target.value))} />
                    <p className="mt-2 text-xs text-[var(--admin-muted)]">{subscription?.billing_status || "cancelled"}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
