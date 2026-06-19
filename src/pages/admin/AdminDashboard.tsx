import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeDollarSign,
  CheckCircle2,
  ListChecks,
  Plus,
  Settings,
  Ticket,
  Users
} from "lucide-react";
import { AdminLoadingSkeleton } from "../../components/admin/AdminPremium";
import { supabase } from "../../lib/supabase";

type Customer = {
  id: string;
  name: string;
  phone?: string;
};

type Purchase = {
  purchaseId: string;
  raffleId: string;
  amount: number;
  tickets: number;
  status: "pending" | "paid" | "cancelled" | string;
  createdAt: string;
  customer?: Customer;
};

type Raffle = {
  id: string;
  title: string;
  status?: string;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);

  const fetchAdminData = () => {
    Promise.all([
      fetch("/api/admin/stats").then(res => res.json()).catch(() => ({})),
      fetch("/api/admin/purchases").then(res => res.json()).catch(() => []),
      fetch("/api/admin/raffles").then(res => res.json()).catch(() => [])
    ]).then(([nextStats, nextPurchases, nextRaffles]) => {
      setStats(nextStats);
      setPurchases(Array.isArray(nextPurchases) ? nextPurchases : []);
      setRaffles(Array.isArray(nextRaffles) ? nextRaffles : []);
    });
  };

  useEffect(() => {
    fetchAdminData();
    const channel = supabase.channel("admin_operations_dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, fetchAdminData)
      .subscribe();
    const interval = setInterval(fetchAdminData, 20000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const todayKey = new Date().toISOString().slice(0, 10);
  const paid = purchases.filter(item => item.status === "paid");
  const pending = purchases.filter(item => item.status === "pending");
  const confirmedToday = paid.filter(item => String(item.createdAt || "").slice(0, 10) === todayKey);
  const salesToday = confirmedToday.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const activeCampaigns = raffles.filter(item => String(item.status || "").toLowerCase() === "active");

  const recentPurchases = useMemo(() => {
    return [...purchases]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 6);
  }, [purchases]);

  if (!stats) return <AdminLoadingSkeleton />;

  return (
    <div className="space-y-4 pb-8">
      <section className="admin-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-primary)]">Operação</p>
            <h2 className="mt-1 text-2xl font-semibold leading-tight text-[var(--admin-text)]">Painel operacional</h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Acesse rapidamente as ações que movem sua operação diária.</p>
          </div>
          <Link to="/admin/rifas" className="admin-button inline-flex min-h-11 items-center justify-center gap-2 px-5">
            <Plus className="h-4 w-4" /> Nova campanha
          </Link>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OperationCard icon={BadgeDollarSign} label="Vendas hoje" value={currency.format(salesToday)} detail={`${confirmedToday.length} pagamento(s) confirmado(s)`} />
        <OperationCard icon={ListChecks} label="Pedidos pendentes" value={String(pending.length)} detail="aguardando pagamento" />
        <OperationCard icon={CheckCircle2} label="Pagamentos confirmados" value={String(paid.length)} detail="total confirmado" />
        <OperationCard icon={Ticket} label="Campanhas ativas" value={String(activeCampaigns.length)} detail={`${raffles.length} campanha(s) no total`} />
      </div>

      <section className="admin-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--admin-text)]">Ações rápidas</h3>
            <p className="text-sm text-[var(--admin-muted)]">Caminhos principais para operação.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <QuickAction to="/admin/rifas" icon={Plus} label="Criar campanha" />
          <QuickAction to="/admin/central-pedidos" icon={ListChecks} label="Central de Pedidos" />
          <QuickAction to="/admin/crm" icon={Users} label="Clientes" />
          <QuickAction to="/admin/relatorios" icon={BadgeDollarSign} label="Afiliados" />
          <QuickAction to="/admin/pagamentos" icon={Settings} label="Configurações de PIX" />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_.8fr]">
        <section className="admin-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--admin-text)]">Pedidos recentes</h3>
            <Link to="/admin/central-pedidos" className="text-sm font-semibold text-[var(--admin-primary)]">Ver todos</Link>
          </div>
          {recentPurchases.length ? (
            <div className="divide-y divide-[var(--admin-border)]">
              {recentPurchases.map(item => (
                <article key={item.purchaseId} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--admin-text)]">{item.customer?.name || "Cliente nao informado"}</p>
                    <p className="mt-1 text-xs text-[var(--admin-muted)]">{item.purchaseId} · {item.tickets || 0} cota(s)</p>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <span className={`admin-status-badge ${item.status === "paid" ? "is-success" : item.status === "pending" ? "is-warning" : "is-muted"}`}>{statusLabel(item.status)}</span>
                    <strong className="text-sm text-[var(--admin-text)]">{currency.format(Number(item.amount || 0))}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <SmallEmptyState text="Nenhum pedido registrado ainda." />
          )}
        </section>

        <section className="admin-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--admin-text)]">Campanhas ativas</h3>
            <Link to="/admin/rifas" className="text-sm font-semibold text-[var(--admin-primary)]">Gerenciar</Link>
          </div>
          {activeCampaigns.length ? (
            <div className="grid gap-2">
              {activeCampaigns.slice(0, 5).map(raffle => (
                <Link key={raffle.id} to="/admin/rifas" className="rounded-xl border border-[var(--admin-border)] bg-black px-3 py-3 text-sm font-semibold text-[var(--admin-text)] hover:border-[var(--admin-primary)]">
                  {raffle.title || raffle.id}
                </Link>
              ))}
            </div>
          ) : (
            <SmallEmptyState text="Nenhuma campanha ativa no momento." />
          )}
        </section>
      </div>
    </div>
  );
}

function OperationCard({ icon: Icon, label, value, detail }: { icon: any; label: string; value: string; detail: string }) {
  return (
    <article className="admin-card min-h-[112px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">{label}</p>
          <strong className="mt-2 block text-2xl font-semibold text-[var(--admin-text)]">{value}</strong>
          <span className="mt-1 block text-xs text-[var(--admin-muted)]">{detail}</span>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--admin-primary)] text-black">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to} className="admin-card flex min-h-[78px] items-center gap-3 p-3 transition hover:border-[var(--admin-primary)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--admin-primary)] text-black">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold text-[var(--admin-text)]">{label}</span>
    </Link>
  );
}

function SmallEmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-black p-4 text-sm text-[var(--admin-muted)]">
      {text}
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "paid") return "Pago";
  if (status === "pending") return "Pendente";
  if (status === "cancelled") return "Cancelado";
  return status || "-";
}
