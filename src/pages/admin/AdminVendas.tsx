import { BarChart3, Percent, ReceiptText, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { money, percent, useAdminConsolidatedData } from "./adminDataConsolidation";

export function AdminVendas() {
  const { loading, error, sales, platformRate } = useAdminConsolidatedData();
  const maxDay = Math.max(1, ...sales.recentDailySales.map(day => day.amount));

  return (
    <div className="space-y-4">
      <section className="admin-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--admin-muted)]">Operação</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">Vendas</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">
          Performance comercial por agregações. Esta página não lista pedidos completos, clientes completos ou fichas de afiliados.
        </p>
      </section>

      {error && <p className="rounded-[8px] border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-100">{error}</p>}

      <section className="grid gap-4 md:grid-cols-4">
        <Metric icon={TrendingUp} label="Vendas brutas" value={loading ? "..." : money(sales.grossSales)} />
        <Metric icon={Percent} label={`Taxa da plataforma${platformRate ? ` (${percent(platformRate)})` : ""}`} value={loading ? "..." : money(sales.platformFee)} />
        <Metric icon={ReceiptText} label="Vendas líquidas" value={loading ? "..." : money(sales.netSales)} />
        <Metric icon={BarChart3} label="Ticket médio" value={loading ? "..." : money(sales.averageTicket)} />
        <Metric icon={ReceiptText} label="Pedidos pagos" value={loading ? "..." : sales.paidOrders} />
        <Metric icon={ReceiptText} label="Pedidos pendentes" value={loading ? "..." : sales.pendingOrders} />
        <Metric icon={Percent} label="Conversão" value={loading ? "..." : percent(sales.conversionRate)} />
        <Metric icon={BarChart3} label="Campanhas com venda" value={loading ? "..." : sales.topCampaigns.length} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="Campanhas que mais venderam">
          <RankList rows={sales.topCampaigns.map(item => ({ key: item.key, title: item.name, detail: `${item.orders} pedido(s) pago(s)`, value: money(item.amount) }))} empty="Nenhuma campanha com venda paga." />
        </Panel>
        <Panel title="Vendas dos últimos dias">
          <div className="flex h-56 items-end gap-3 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4">
            {sales.recentDailySales.map(day => (
              <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
                <div className="flex flex-1 items-end">
                  <div className="w-full rounded-[8px] bg-[var(--admin-primary)]" style={{ height: `${Math.max(6, (day.amount / maxDay) * 100)}%` }} title={`${day.label}: ${money(day.amount)}`} />
                </div>
                <span className="truncate text-center text-xs text-[var(--admin-muted)]">{day.label}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Afiliados que mais venderam">
          <RankList rows={sales.topAffiliates.map(item => ({ key: item.key, title: item.name, detail: `${item.referredOrders} pedido(s) indicados`, value: money(item.soldAmount) }))} empty="Nenhum afiliado com venda direta." />
        </Panel>
        <Panel title="Compradores que mais compraram">
          <RankList rows={sales.topCustomers.map(item => ({ key: item.key, title: item.name, detail: `${item.totalOrders} pedido(s)`, value: money(item.totalSpent) }))} empty="Nenhum comprador com pedido pago." />
        </Panel>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <article className="admin-card">
      <Icon className="mb-3 h-5 w-5 text-[var(--admin-primary)]" />
      <p className="text-sm text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--admin-text)]">{value}</p>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="admin-card">
      <h2 className="mb-4 text-base font-semibold text-[var(--admin-text)]">{title}</h2>
      {children}
    </section>
  );
}

function RankList({ rows, empty }: { rows: Array<{ key: string; title: string; detail: string; value: string }>; empty: string }) {
  if (!rows.length) return <p className="rounded-[8px] border border-[var(--admin-border)] p-4 text-sm text-[var(--admin-muted)]">{empty}</p>;
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={row.key} className="flex items-center justify-between gap-3 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-3">
          <div className="min-w-0">
            <p className="font-semibold text-[var(--admin-text)]">{index + 1}. {row.title}</p>
            <p className="text-xs text-[var(--admin-muted)]">{row.detail}</p>
          </div>
          <strong className="shrink-0 text-sm text-[var(--admin-text)]">{row.value}</strong>
        </div>
      ))}
    </div>
  );
}
