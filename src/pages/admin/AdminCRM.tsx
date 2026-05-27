import React, { useEffect, useMemo, useState } from "react";
import { Activity, BadgeDollarSign, Phone, Search, Star, Tag, Ticket, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable, MetricCard } from "../../components/admin/AdminPremium";

type Customer = {
  id: string;
  name: string;
  phone: string;
  cpf: string;
  city?: string;
  state?: string;
  totalTickets?: number;
  affiliateRefCode?: string;
  createdAt?: string;
  blocked?: boolean;
  blockedReason?: string;
};

type Purchase = {
  purchaseId: string;
  raffleId: string;
  amount: number;
  tickets: number;
  status: string;
  createdAt: string;
  customer?: Customer;
};

const statusFromCustomer = (customer: Customer, purchases: Purchase[]) => {
  const paid = purchases.filter(item => item.customer?.id === customer.id && item.status === "paid");
  if (paid.some(item => item.amount >= 500)) return "VIP";
  if (paid.length >= 3) return "comprador ativo";
  if (paid.length === 1) return "novo comprador";
  if ((customer.totalTickets || 0) > 0) return "lead quente";
  return "lead";
};

export function AdminUsers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    fetch("/api/admin/customers").then(res => res.json()).then(setCustomers).catch(() => setCustomers([]));
    fetch("/api/admin/purchases").then(res => res.json()).then(setPurchases).catch(() => setPurchases([]));
  };

  const toggleBlockCustomer = async (customer: Customer) => {
    const reason = customer.blocked ? "" : window.prompt("Motivo do bloqueio", "Análise de segurança") || "Bloqueado pelo administrador";
    const res = await fetch(`/api/admin/customers/${customer.id}/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: !customer.blocked, reason })
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao atualizar usuário");
      return;
    }
    toast.success(customer.blocked ? "Usuário desbloqueado" : "Usuário bloqueado");
    setSelected(data);
    loadData();
  };

  const resetPassword = async (customer: Customer) => {
    const accessPassword = window.prompt("Nova senha de 6 dígitos", "123456");
    if (!accessPassword) return;
    const res = await fetch(`/api/admin/customers/${customer.id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessPassword })
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao redefinir senha");
      return;
    }
    toast.success(`Senha redefinida: ${data.accessPassword}`);
    setSelected(data.customer);
  };

  const filtered = useMemo(() => {
    const value = query.toLowerCase().replace(/\D/g, "");
    const text = query.toLowerCase();
    return customers.filter(customer => {
      const haystack = `${customer.name} ${customer.phone} ${customer.cpf} ${customer.city || ""} ${customer.state || ""} ${customer.affiliateRefCode || ""}`.toLowerCase();
      return !query || haystack.includes(text) || customer.phone?.includes(value) || customer.cpf?.includes(value);
    });
  }, [customers, query]);

  const profilePurchases = selected ? purchases.filter(item => item.customer?.id === selected.id) : [];
  const paidPurchases = purchases.filter(item => item.status === "paid");
  const totalRevenue = paidPurchases.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={UserRound} label="Usuários" value={customers.length} trend="clientes, leads e afiliados" />
        <MetricCard icon={BadgeDollarSign} label="Receita dos usuários" value={`R$ ${totalRevenue.toFixed(2)}`} trend="pagamentos aprovados" tone="success" />
        <MetricCard icon={Ticket} label="Cotas pagas" value={paidPurchases.reduce((sum, item) => sum + Number(item.tickets || 0), 0)} trend="base confirmada" tone="accent" />
        <MetricCard icon={Star} label="VIPs" value={customers.filter(customer => statusFromCustomer(customer, purchases) === "VIP").length} trend="alto valor" tone="warning" />
      </div>

      <section className="admin-card p-5">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-black text-[var(--admin-text)]">Usuários</h1>
            <p className="text-sm text-[var(--admin-muted)]">Perfil, status, origem, compras, prêmios, afiliados e comissões em uma visão única.</p>
          </div>
          <label className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome, CPF, telefone, cidade..." className="admin-input h-12 w-full rounded-2xl pl-11 pr-4 outline-none" />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <AdminDataTable
            columns={["Cliente", "Contato", "Status", "Cotas", "Cidade", "Ações"]}
            rows={filtered.map(customer => [
              <span className="font-bold">{customer.name}</span>,
              <span>{customer.phone || "Sem telefone"}</span>,
              <span className="rounded-full border border-[var(--admin-border)] px-2 py-1 text-xs uppercase text-[var(--admin-primary)]">{customer.blocked ? "bloqueado" : statusFromCustomer(customer, purchases)}</span>,
              customer.totalTickets || 0,
              `${customer.city || "Nao informado"} ${customer.state || ""}`,
              <button onClick={() => setSelected(customer)} className="admin-button-secondary">Perfil</button>
            ])}
          />

          <aside className="admin-card p-5">
            {selected ? (
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--admin-primary)]/15 text-xl font-black text-[var(--admin-primary)]">{selected.name?.charAt(0) || "C"}</div>
                  <div>
                    <h2 className="mb-1 text-xl font-black text-[var(--admin-text)]">{selected.name}</h2>
                    <p className="text-sm text-[var(--admin-muted)]">{selected.city || "Cidade nao informada"} {selected.state || ""}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MiniProfileStat icon={Phone} label="Telefone" value={selected.phone || "-"} />
                  <MiniProfileStat icon={Tag} label="CPF" value={selected.cpf || "-"} />
                  <MiniProfileStat icon={Ticket} label="Compras" value={profilePurchases.length} />
                  <MiniProfileStat icon={BadgeDollarSign} label="Total gasto" value={`R$ ${profilePurchases.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)}`} />
                </div>

                {selected.blocked && (
                  <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                    Usuário bloqueado: {selected.blockedReason || "sem motivo informado"}
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  <button onClick={() => resetPassword(selected)} className="admin-button-secondary">Redefinir senha</button>
                  <button onClick={() => toggleBlockCustomer(selected)} className={selected.blocked ? "admin-button" : "rounded-xl border border-rose-400/30 px-4 py-3 text-sm font-bold text-rose-200 hover:bg-rose-500/10"}>
                    {selected.blocked ? "Desbloquear usuário" : "Bloquear usuário"}
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[var(--admin-text)]">Histórico recente</h3>
                  <div className="mt-3 space-y-2">
                    {profilePurchases.slice(0, 5).map(item => (
                      <div key={item.purchaseId} className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-3">
                        <p className="text-sm font-bold text-[var(--admin-text)]">#{item.purchaseId} - R$ {Number(item.amount || 0).toFixed(2)}</p>
                        <p className="text-xs text-[var(--admin-muted)]">{item.tickets} cotas, status {item.status}</p>
                      </div>
                    ))}
                    {profilePurchases.length === 0 && <p className="text-sm text-[var(--admin-muted)]">Sem compras registradas.</p>}
                  </div>
                </div>

              </div>
            ) : (
              <div className="grid min-h-[460px] place-items-center text-center">
                <div>
                  <Activity className="mx-auto mb-3 h-10 w-10 text-[var(--admin-primary)]" />
                  <p className="font-bold text-[var(--admin-text)]">Selecione um contato</p>
                  <p className="mt-1 text-sm text-[var(--admin-muted)]">O perfil completo aparece aqui.</p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

export const AdminCRM = AdminUsers;

function MiniProfileStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-3">
      <Icon className="mb-2 h-4 w-4 text-[var(--admin-primary)]" />
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-[var(--admin-text)]">{value}</p>
    </div>
  );
}
