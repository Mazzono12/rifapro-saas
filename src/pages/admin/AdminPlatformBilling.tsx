import { useEffect, useMemo, useState } from "react";
import { CreditCard, FileText, PackageCheck, Percent } from "lucide-react";

type PlatformBillingSummary = {
  periodStart: string;
  periodEnd: string;
  grossRevenue: number;
  platformCommissionRate: number;
  platformCommissionMode: "gross_revenue" | "net_after_gateway_fee";
  revenueShareAmount: number;
  addOnsAmount: number;
  totalDue: number;
  activeAddons: Array<{ id: string; addon_key: string; monthly_price: number; billing_status: string }>;
  statement?: { id: string; status: string; total_due: number } | null;
};

type PlatformStatement = {
  id: string;
  period_start: string;
  period_end: string;
  revenue_share_amount: number;
  add_ons_amount: number;
  total_due: number;
  status: string;
  paid_at?: string;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

function Metric({ icon: Icon, label, value }: { icon: typeof CreditCard; label: string; value: string }) {
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

export function AdminPlatformBilling() {
  const [summary, setSummary] = useState<PlatformBillingSummary | null>(null);
  const [statements, setStatements] = useState<PlatformStatement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/platform-billing/summary").then(res => res.json()),
      fetch("/api/admin/platform-billing/statements").then(res => res.json())
    ])
      .then(([summaryData, statementData]) => {
        setSummary(summaryData);
        setStatements(Array.isArray(statementData.statements) ? statementData.statements : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeAddonsTotal = useMemo(() => summary?.activeAddons.reduce((sum, addon) => sum + Number(addon.monthly_price || 0), 0) || 0, [summary]);

  if (loading) return <div className="admin-card p-6 text-[var(--admin-muted)]">Carregando custos...</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric icon={CreditCard} label="Faturamento do período" value={money.format(summary?.grossRevenue || 0)} />
        <Metric icon={Percent} label="Percentual da plataforma" value={`${summary?.platformCommissionRate || 0}%`} />
        <Metric icon={FileText} label="Comissão gerada" value={money.format(summary?.revenueShareAmount || 0)} />
        <Metric icon={PackageCheck} label="Total devido" value={money.format(summary?.totalDue || 0)} />
      </div>

      <section className="admin-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="mb-1 text-lg font-semibold text-[var(--admin-text)]">Custos da Plataforma</h2>
            <p className="text-sm text-[var(--admin-muted)]">
              {summary ? `${date.format(new Date(summary.periodStart))} a ${date.format(new Date(summary.periodEnd))}` : "Periodo atual"}
            </p>
          </div>
          <span className="rounded-[8px] border border-[var(--admin-border)] px-3 py-1 text-sm text-[var(--admin-muted)]">
            {summary?.platformCommissionMode === "net_after_gateway_fee" ? "Liquido apos gateway" : "Faturamento bruto"}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[8px] border border-[var(--admin-border)] p-3">
            <p className="text-xs uppercase text-[var(--admin-muted)]">Add-ons ativos</p>
            <p className="mt-2 text-xl font-semibold text-[var(--admin-text)]">{summary?.activeAddons.length || 0}</p>
          </div>
          <div className="rounded-[8px] border border-[var(--admin-border)] p-3">
            <p className="text-xs uppercase text-[var(--admin-muted)]">Valor mensal dos add-ons</p>
            <p className="mt-2 text-xl font-semibold text-[var(--admin-text)]">{money.format(activeAddonsTotal)}</p>
          </div>
          <div className="rounded-[8px] border border-[var(--admin-border)] p-3">
            <p className="text-xs uppercase text-[var(--admin-muted)]">Status do fechamento</p>
            <p className="mt-2 text-xl font-semibold text-[var(--admin-text)]">{summary?.statement?.status || "open"}</p>
          </div>
        </div>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="border-b border-[var(--admin-border)] p-4">
          <h2 className="mb-0 text-lg font-semibold text-[var(--admin-text)]">Histórico de fechamentos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[var(--admin-muted)]">
              <tr>
                <th className="p-3">Período</th>
                <th className="p-3">Comissão</th>
                <th className="p-3">Add-ons</th>
                <th className="p-3">Total</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {statements.map(item => (
                <tr key={item.id} className="border-t border-[var(--admin-border)] text-[var(--admin-text)]">
                  <td className="p-3">{date.format(new Date(item.period_start))} - {date.format(new Date(item.period_end))}</td>
                  <td className="p-3">{money.format(item.revenue_share_amount)}</td>
                  <td className="p-3">{money.format(item.add_ons_amount)}</td>
                  <td className="p-3 font-semibold">{money.format(item.total_due)}</td>
                  <td className="p-3">{item.status}</td>
                </tr>
              ))}
              {!statements.length && (
                <tr><td className="p-4 text-[var(--admin-muted)]" colSpan={5}>Nenhum fechamento gerado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
