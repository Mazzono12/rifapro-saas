import { BadgeCheck, ReceiptText, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { dateLabel, money, useAdminConsolidatedData } from "./adminDataConsolidation";

export function AdminClientes() {
  const { loading, error, customers } = useAdminConsolidatedData();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    if (!search && !digits) return customers;
    return customers.filter(customer => {
      const text = `${customer.name} ${customer.email} ${customer.phone} ${customer.cpf} ${customer.status}`.toLowerCase();
      const numeric = `${customer.phone} ${customer.cpf}`.replace(/\D/g, "");
      return text.includes(search) || (digits && numeric.includes(digits));
    });
  }, [customers, query]);

  const totals = useMemo(() => ({
    customers: customers.length,
    orders: customers.reduce((sum, customer) => sum + customer.totalOrders, 0),
    spent: customers.reduce((sum, customer) => sum + customer.totalSpent, 0),
    active: customers.filter(customer => customer.status === "ativo").length
  }), [customers]);

  return (
    <div className="space-y-4">
      <section className="admin-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--admin-muted)]">Operação</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">Clientes</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">
          Compradores consolidados por tenant e identificador normalizado. Pedidos continuam linha a linha na página Pedidos.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric icon={Users} label="Clientes únicos" value={totals.customers} />
        <Metric icon={ReceiptText} label="Pedidos vinculados" value={totals.orders} />
        <Metric icon={BadgeCheck} label="Clientes ativos" value={totals.active} />
        <Metric icon={ReceiptText} label="Total gasto" value={money(totals.spent)} />
      </section>

      <section className="admin-card">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Compradores consolidados</h2>
            <p className="text-sm text-[var(--admin-muted)]">Mesmo cliente aparece uma vez, com total de pedidos e gasto consolidado.</p>
          </div>
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
            <input className="admin-input h-10 w-full pl-9" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nome, telefone, CPF ou email" />
          </div>
        </div>
        {error && <p className="mb-3 rounded-[8px] border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-100">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="text-xs uppercase text-[var(--admin-muted)]">
              <tr className="border-b border-[var(--admin-border)]">
                <th className="py-3">Nome</th>
                <th>Telefone</th>
                <th className="text-right">Pedidos</th>
                <th className="text-right">Total gasto</th>
                <th className="text-right">Ticket médio</th>
                <th>Primeira compra</th>
                <th>Última compra</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-8 text-center text-[var(--admin-muted)]">Carregando clientes...</td></tr>
              ) : filtered.length ? filtered.map(customer => (
                <tr key={customer.key} className="border-b border-[var(--admin-border)] last:border-b-0">
                  <td className="py-3">
                    <p className="font-semibold text-[var(--admin-text)]">{customer.name}</p>
                    <p className="text-xs text-[var(--admin-muted)]">{customer.email || customer.cpf || "Sem documento/email"}</p>
                  </td>
                  <td className="font-mono text-xs text-[var(--admin-muted)]">{customer.phone || "-"}</td>
                  <td className="text-right font-semibold text-[var(--admin-text)]">{customer.totalOrders}</td>
                  <td className="text-right font-semibold text-[var(--admin-text)]">{money(customer.totalSpent)}</td>
                  <td className="text-right text-[var(--admin-muted)]">{money(customer.averageTicket)}</td>
                  <td>{dateLabel(customer.firstPurchaseAt)}</td>
                  <td>{dateLabel(customer.lastPurchaseAt)}</td>
                  <td><Status value={customer.status} /></td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="py-8 text-center text-[var(--admin-muted)]">Nenhum cliente encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
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

function Status({ value }: { value: string }) {
  const tone = value === "ativo" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-slate-200 bg-slate-100 text-slate-600";
  return <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${tone}`}>{value}</span>;
}


