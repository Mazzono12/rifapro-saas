import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, Percent, RefreshCw, WalletCards } from "lucide-react";
import { toast } from "sonner";

type BillingTenantRow = {
  tenant: { id: string; nome: string; slug: string; status: string } | null;
  settings: { platformCommissionEnabled: boolean; platformCommissionRate: number; platformCommissionMode: "gross_revenue" | "net_after_gateway_fee" };
  grossRevenue: number;
  revenueShareAmount: number;
  tenantNetAmount?: number;
  totalDue: number;
  statement?: { id: string; status: string } | null;
};

type TenantDetail = BillingTenantRow & {
  commissionEntries: Array<{ id: string; order_type: string; order_id: string; gross_amount: number; commission_rate: number; commission_amount: number; status: string; created_at: string }>;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function total(rows: BillingTenantRow[], key: keyof Pick<BillingTenantRow, "grossRevenue" | "revenueShareAmount" | "totalDue">) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function Metric({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: string }) {
  return <div className="admin-card p-4"><div className="mb-3 flex items-center gap-2 text-sm text-[var(--admin-muted)]"><Icon className="h-4 w-4" />{label}</div><p className="text-2xl font-semibold text-[var(--admin-text)]">{value}</p></div>;
}

export function SuperAdminPlatformBilling() {
  const [rows, setRows] = useState<BillingTenantRow[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [rate, setRate] = useState(10);
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
    setRate(Number(data.settings?.platformCommissionRate || 10));
    setMode(data.settings?.platformCommissionMode || "gross_revenue");
  }

  useEffect(() => { void load(); }, []);

  const selectedRow = useMemo(() => rows.find(row => row.tenant?.id === selectedTenantId) || null, [rows, selectedTenantId]);

  async function saveSettings() {
    await fetch(`/api/superadmin/platform-billing/tenants/${selectedTenantId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformCommissionRate: rate, platformCommissionMode: mode })
    });
    toast.success("Taxa percentual atualizada");
    await load();
  }

  async function generateStatement() {
    const response = await fetch("/api/superadmin/platform-billing/statements/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: selectedTenantId }) });
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

  if (loading) return <div className="admin-card p-6 text-[var(--admin-muted)]">Carregando comissões...</div>;

  return <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-4">
      <Metric icon={WalletCards} label="Vendas brutas pagas" value={money.format(total(rows, "grossRevenue"))} />
      <Metric icon={Percent} label="Comissão da plataforma" value={money.format(total(rows, "revenueShareAmount"))} />
      <Metric icon={FileText} label="Líquido dos tenants" value={money.format(total(rows, "grossRevenue") - total(rows, "revenueShareAmount"))} />
      <Metric icon={FileText} label="Total a receber" value={money.format(total(rows, "totalDue"))} />
    </div>

    <section className="admin-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] p-4">
        <div><h2 className="mb-0 text-lg font-semibold text-[var(--admin-text)]">Comissões da Plataforma</h2><p className="mt-1 text-sm text-[var(--admin-muted)]">Cobrança única por percentual sobre vendas pagas.</p></div>
        <button type="button" onClick={() => void load()} className="admin-icon-button" aria-label="Atualizar" title="Atualizar"><RefreshCw className="h-4 w-4" /></button>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="text-[var(--admin-muted)]"><tr><th className="p-3">Tenant</th><th className="p-3">Percentual</th><th className="p-3">Venda bruta</th><th className="p-3">Comissão</th><th className="p-3">Líquido tenant</th><th className="p-3">Status</th></tr></thead><tbody>{rows.map(row => <tr key={row.tenant?.id} onClick={() => row.tenant?.id && void loadTenant(row.tenant.id)} className="cursor-pointer border-t border-[var(--admin-border)] text-[var(--admin-text)] hover:bg-white/5"><td className="p-3 font-semibold">{row.tenant?.nome || row.tenant?.id}</td><td className="p-3">{row.settings.platformCommissionRate}%</td><td className="p-3">{money.format(row.grossRevenue)}</td><td className="p-3">{money.format(row.revenueShareAmount)}</td><td className="p-3">{money.format(row.tenantNetAmount ?? row.grossRevenue - row.revenueShareAmount)}</td><td className="p-3">{row.statement?.status || "open"}</td></tr>)}</tbody></table></div>
    </section>

    {detail && <section className="grid gap-4 lg:grid-cols-[360px_1fr]"><div className="admin-card p-4"><h2 className="mb-4 text-lg font-semibold text-[var(--admin-text)]">Taxa do tenant</h2><label className="mb-3 block text-sm text-[var(--admin-muted)]">Percentual<input className="admin-input mt-1" type="number" min={0} max={100} step={0.01} value={rate} onChange={event => setRate(Number(event.target.value))} /></label><label className="mb-4 block text-sm text-[var(--admin-muted)]">Base de cálculo<select className="admin-input mt-1" value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="gross_revenue">Vendas brutas pagas</option><option value="net_after_gateway_fee">Líquido após gateway</option></select></label><button type="button" onClick={() => void saveSettings()} className="admin-button w-full"><CheckCircle2 className="h-4 w-4" /> Salvar taxa</button><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => void generateStatement()} className="admin-button-secondary">Gerar fechamento</button><button type="button" onClick={() => void markStatement("mark-paid")} className="admin-button-secondary">Marcar pago</button><button type="button" onClick={() => void markStatement("mark-overdue")} className="admin-button-secondary col-span-2">Marcar vencido</button></div></div><div className="admin-card overflow-hidden p-0"><div className="border-b border-[var(--admin-border)] p-4"><h2 className="text-lg font-semibold text-[var(--admin-text)]">Lançamentos de comissão</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-[var(--admin-muted)]"><tr><th className="p-3">Pedido</th><th className="p-3">Tipo</th><th className="p-3">Bruto</th><th className="p-3">%</th><th className="p-3">Comissão</th><th className="p-3">Status</th></tr></thead><tbody>{(detail.commissionEntries || []).map(entry => <tr key={entry.id} className="border-t border-[var(--admin-border)] text-[var(--admin-text)]"><td className="p-3">{entry.order_id}</td><td className="p-3">{entry.order_type}</td><td className="p-3">{money.format(entry.gross_amount)}</td><td className="p-3">{entry.commission_rate}%</td><td className="p-3">{money.format(entry.commission_amount)}</td><td className="p-3">{entry.status}</td></tr>)}{!detail.commissionEntries?.length && <tr><td className="p-4 text-[var(--admin-muted)]" colSpan={6}>Nenhuma venda paga com comissão no período.</td></tr>}</tbody></table></div></div></section>}
  </div>;
}
