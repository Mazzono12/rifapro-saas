import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BadgeDollarSign,
  Box,
  CheckCircle2,
  CreditCard,
  Download,
  Gift,
  LineChart,
  Palette,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Sprout,
  Trophy,
  Users
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AdminDataTable, AdminLoadingSkeleton, ChartCard, MetricCard } from "../../components/admin/AdminPremium";
import { supabase } from "../../lib/supabase";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  city?: string;
  state?: string;
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
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [period, setPeriod] = useState("30");
  const [status, setStatus] = useState("all");
  const [raffleId, setRaffleId] = useState("all");
  const [isRealtime, setIsRealtime] = useState(true);

  const fetchAdminData = () => {
    Promise.all([
      fetch("/api/admin/stats").then(res => res.json()).catch(() => ({})),
      fetch("/api/admin/purchases").then(res => res.json()).catch(() => []),
      fetch("/api/admin/customers").then(res => res.json()).catch(() => []),
      fetch("/api/admin/raffles").then(res => res.json()).catch(() => [])
    ]).then(([nextStats, nextPurchases, nextCustomers, nextRaffles]) => {
      setStats(nextStats);
      setPurchases(Array.isArray(nextPurchases) ? nextPurchases : []);
      setCustomers(Array.isArray(nextCustomers) ? nextCustomers : []);
      setRaffles(Array.isArray(nextRaffles) ? nextRaffles : []);
    });
  };

  useEffect(() => {
    fetchAdminData();
    const channel = supabase.channel("admin_powerbi_dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, () => {
        if (isRealtime) fetchAdminData();
      })
      .subscribe();
    const interval = setInterval(() => {
      if (isRealtime) fetchAdminData();
    }, 15000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [isRealtime]);

  const raffleNames = useMemo(() => {
    const map = new Map<string, string>();
    raffles.forEach(raffle => map.set(String(raffle.id), raffle.title || `Sorteio ${raffle.id}`));
    return map;
  }, [raffles]);

  const filteredPurchases = useMemo(() => {
    const now = new Date();
    const periodDays = Number(period);
    return purchases.filter(purchase => {
      const createdAt = new Date(purchase.createdAt || 0);
      const insidePeriod = period === "all" || (Number.isFinite(createdAt.getTime()) && createdAt >= new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000));
      const statusOk = status === "all" || purchase.status === status;
      const raffleOk = raffleId === "all" || String(purchase.raffleId) === raffleId;
      return insidePeriod && statusOk && raffleOk;
    });
  }, [purchases, period, status, raffleId]);

  const paid = filteredPurchases.filter(item => item.status === "paid");
  const pending = filteredPurchases.filter(item => item.status === "pending");
  const cancelled = filteredPurchases.filter(item => item.status === "cancelled");
  const totalRevenue = paid.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pendingRevenue = pending.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalTickets = paid.reduce((sum, item) => sum + Number(item.tickets || 0), 0);
  const averageTicket = paid.length ? totalRevenue / paid.length : 0;
  const conversionRate = filteredPurchases.length ? (paid.length / filteredPurchases.length) * 100 : 0;
  const uniqueBuyers = new Set(paid.map(item => item.customer?.id || item.customer?.phone || item.purchaseId)).size;

  const salesByDay = useMemo(() => {
    const daysToShow = period === "all" ? 14 : Math.min(Number(period), 30);
    const days = Array.from({ length: daysToShow || 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - ((daysToShow || 7) - 1 - index));
      return date;
    });
    return days.map(date => {
      const key = date.toISOString().slice(0, 10);
      const dayPaid = paid.filter(item => String(item.createdAt || "").slice(0, 10) === key);
      return {
        name: dateFormatter.format(date),
        receita: dayPaid.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        vendas: dayPaid.length,
        cotas: dayPaid.reduce((sum, item) => sum + Number(item.tickets || 0), 0)
      };
    });
  }, [paid, period]);

  const revenueByRaffle = useMemo(() => {
    const map = new Map<string, { id: string; name: string; receita: number; vendas: number; cotas: number }>();
    paid.forEach(item => {
      const id = String(item.raffleId || "geral");
      const current = map.get(id) || {
        id,
        name: raffleNames.get(id) || `Sorteio ${id}`,
        receita: 0,
        vendas: 0,
        cotas: 0
      };
      current.receita += Number(item.amount || 0);
      current.vendas += 1;
      current.cotas += Number(item.tickets || 0);
      map.set(id, current);
    });
    return [...map.values()].sort((a, b) => b.receita - a.receita);
  }, [paid, raffleNames]);

  const statusData = [
    { name: "Aprovadas", value: paid.length, color: "var(--admin-success)" },
    { name: "Pendentes", value: pending.length, color: "var(--admin-warning)" },
    { name: "Canceladas", value: cancelled.length, color: "var(--admin-danger)" }
  ].filter(item => item.value > 0);

  const topBuyers = useMemo(() => {
    const map = new Map<string, { name: string; city: string; revenue: number; tickets: number; purchases: number }>();
    paid.forEach(item => {
      const key = item.customer?.id || item.customer?.phone || item.purchaseId;
      const current = map.get(key) || {
        name: item.customer?.name || item.purchaseId,
        city: [item.customer?.city, item.customer?.state].filter(Boolean).join(" / ") || "-",
        revenue: 0,
        tickets: 0,
        purchases: 0
      };
      current.revenue += Number(item.amount || 0);
      current.tickets += Number(item.tickets || 0);
      current.purchases += 1;
      map.set(key, current);
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [paid]);

  const operationHealth = pending.length > paid.length && filteredPurchases.length > 0 ? "Atenção comercial" : "Operação saudável";
  const dailyHighlight = salesByDay[salesByDay.length - 1];
  const growthSignal = totalRevenue > 0 ? "Crescimento do período em acompanhamento" : "Sua operação está pronta para receber novas vendas.";
  const primaryRaffle = revenueByRaffle[0];

  const exportCSV = () => {
    const rows = [
      ["nome_completo", "telefone", "cidade", "data_compra", "codigo_sorteio", "quantidade_cotas"].map(csvEscape).join(","),
      ...filteredPurchases.map(item => [
        item.customer?.name || "",
        item.customer?.phone || "",
        item.customer?.city || "",
        item.createdAt,
        item.raffleId,
        item.tickets
      ].map(csvEscape).join(","))
    ];
    download("dashboard-power-bi.csv", rows.join("\n"), "text/csv");
  };

  const exportJSON = () => download("dashboard-power-bi.json", JSON.stringify({
    filters: { period, status, raffleId },
    kpis: { totalRevenue, pendingRevenue, totalTickets, averageTicket, conversionRate, uniqueBuyers },
    purchases: filteredPurchases
  }, null, 2), "application/json");

  if (!stats) return <AdminLoadingSkeleton />;

  return (
    <div className="space-y-6 pb-10">
      <section className="admin-card overflow-hidden p-0">
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-end xl:p-6">
          <div className="min-w-0 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--admin-success)]/30 bg-[var(--admin-success)]/10 px-3 py-1 text-xs font-bold text-[var(--admin-success)]">
              <span className="h-2 w-2 rounded-full bg-[var(--admin-success)] shadow-[0_0_18px_var(--admin-success)]" />
              Operação em tempo real
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--admin-muted)]">Visão executiva premium</p>
              <h2 className="mt-1 text-3xl font-semibold leading-tight text-[var(--admin-text)] sm:text-4xl">Desempenho da Operação</h2>
              <p className="mt-2 max-w-3xl text-sm text-[var(--admin-muted)] sm:text-base">
                Acompanhe faturamento confirmado, vendas, clientes ativos e ações recomendadas para acelerar os resultados do período.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ExecutiveSignal icon={ShieldCheck} label="Saúde da Operação" value={operationHealth} tone="success" />
              <ExecutiveSignal icon={LineChart} label="Crescimento do Período" value={growthSignal} tone="accent" />
              <ExecutiveSignal icon={Trophy} label="Destaque do Dia" value={primaryRaffle?.name || "Configure suas primeiras campanhas"} tone="warning" />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[620px] lg:grid-cols-5">
            <Link to="/admin/rifas" className="admin-button-primary lg:col-span-2">
              <PlusCircle className="h-4 w-4" /> Criar campanha
            </Link>
            <select value={period} onChange={event => setPeriod(event.target.value)} className="admin-input h-11 rounded-2xl px-3 text-sm outline-none">
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
              <option value="all">Tudo</option>
            </select>
            <select value={status} onChange={event => setStatus(event.target.value)} className="admin-input h-11 rounded-2xl px-3 text-sm outline-none">
              <option value="all">Todos status</option>
              <option value="paid">Aprovadas</option>
              <option value="pending">Pendentes</option>
              <option value="cancelled">Canceladas</option>
            </select>
            <select value={raffleId} onChange={event => setRaffleId(event.target.value)} className="admin-input h-11 rounded-2xl px-3 text-sm outline-none lg:col-span-2">
              <option value="all">Todas as ações</option>
              {raffles.map(raffle => <option key={raffle.id} value={raffle.id}>{raffle.title}</option>)}
            </select>
            <button onClick={fetchAdminData} className="admin-button-secondary lg:col-span-3">
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
          </div>
        </div>
      </section>

      <SectionHeader
        eyebrow="Visão Geral"
        title="Indicadores executivos"
        description="Métricas comerciais para leitura rápida da operação."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={BadgeDollarSign} label="Faturamento Confirmado" value={currency.format(totalRevenue)} trend={`${paid.length} vendas confirmadas`} tone="success" />
        <MetricCard icon={CheckCircle2} label="Vendas Confirmadas" value={paid.length} trend={`${totalTickets} números vendidos`} tone="accent" />
        <MetricCard icon={Users} label="Clientes Ativos" value={uniqueBuyers} trend={`${customers.length || stats.users || 0} clientes cadastrados`} />
        <MetricCard icon={Box} label="Conversão Operacional" value={`${conversionRate.toFixed(1)}%`} trend="Eficiência do período filtrado" tone="success" />
        <MetricCard icon={CreditCard} label="Faturamento em Análise" value={currency.format(pendingRevenue)} trend={`${pending.length} aguardando confirmação`} tone="warning" />
        <MetricCard icon={Activity} label="Ticket Médio" value={currency.format(averageTicket)} trend="Valor médio por venda confirmada" />
        <MetricCard icon={Gift} label="Experiências Ativadas" value={stats.lootboxesOpened || 0} trend={`${stats.lootboxesWon || 0} prêmios entregues`} tone="warning" />
        <MetricCard icon={Trophy} label="Campanha em Destaque" value={primaryRaffle?.name || "Sem dados no período"} trend={primaryRaffle ? currency.format(primaryRaffle.receita) : "Configure suas primeiras campanhas"} tone="accent" />
      </div>

      <SectionHeader
        eyebrow="Desempenho"
        title="Evolução de Vendas"
        description="Leitura visual do faturamento confirmado, volume de vendas e distribuição da operação."
      />
      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <ChartCard title="Faturamento Confirmado e Vendas" description="Evolução diária para comparar receita, volume e ritmo comercial.">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesByDay}>
                <defs>
                  <linearGradient id="powerRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--admin-primary)" stopOpacity={0.42} />
                    <stop offset="95%" stopColor="var(--admin-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--admin-muted)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--admin-muted)" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => name === "receita" ? currency.format(value) : value} />
                <Area dataKey="receita" type="monotone" stroke="var(--admin-primary)" strokeWidth={3} fill="url(#powerRevenue)" />
                <Area dataKey="vendas" type="monotone" stroke="var(--admin-secondary)" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Saúde das Vendas" description="Distribuição das confirmações para acompanhar a conversão operacional.">
          <div className="h-80">
            {statusData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={112} paddingAngle={4}>
                    {statusData.map(item => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyVisual label="Nenhum resultado encontrado neste período." />
            )}
          </div>
        </ChartCard>
      </div>

      <SectionHeader
        eyebrow="Operação"
        title="Ranking e clientes"
        description="Destaques comerciais para identificar campanhas, compradores e oportunidades de crescimento."
      />
      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <ChartCard title="Ranking de Campanhas" description="Campanhas com maior contribuição para o faturamento confirmado.">
          <div className="h-80">
            {revenueByRaffle.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByRaffle.slice(0, 8)} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.06)" horizontal={false} />
                  <XAxis type="number" stroke="var(--admin-muted)" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} stroke="var(--admin-muted)" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => name === "receita" ? currency.format(value) : value} />
                  <Bar dataKey="receita" fill="var(--admin-primary)" radius={[0, 12, 12, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyVisual label="Configure suas primeiras campanhas para iniciar a operação." />
            )}
          </div>
        </ChartCard>

        <ChartCard title="Ranking de Vendas" description="Clientes que mais contribuíram para o desempenho do período.">
          <AdminDataTable
            columns={["Cliente", "Cidade", "Compras", "Cotas", "Receita"]}
            rows={topBuyers.map(buyer => [
              buyer.name,
              buyer.city,
              buyer.purchases,
              buyer.tickets,
              currency.format(buyer.revenue)
            ])}
            empty="Nenhum resultado encontrado neste período."
          />
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_.42fr]">
        <ChartCard
          title="Vendas Recentes"
          description="Últimas movimentações filtradas para acompanhamento rápido da operação."
          action={
            <div className="flex gap-2">
              <button onClick={exportCSV} className="admin-button-secondary"><Download className="h-4 w-4" /> CSV</button>
              <button onClick={exportJSON} className="admin-button-secondary">Exportar dados</button>
            </div>
          }
        >
          <AdminDataTable
            columns={["Venda", "Ação", "Cliente", "Status", "Números", "Valor", "Data"]}
            rows={filteredPurchases.slice(0, 12).map((item, index) => [
              `Venda ${index + 1}`,
              raffleNames.get(String(item.raffleId)) || item.raffleId,
              item.customer?.name || "-",
              statusLabel(item.status),
              item.tickets,
              currency.format(Number(item.amount || 0)),
              item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : "-"
            ])}
          />
        </ChartCard>

        <ChartCard title="Ações Rápidas" description="Atalhos para as rotinas que mais aceleram a operação.">
          <div className="grid gap-3">
            {[
              { title: "Criar nova campanha", path: "/admin/rifas", icon: PlusCircle },
              { title: "Ver vendas", path: "/admin/vendas", icon: CreditCard },
              { title: "Configurar pagamentos", path: "/admin/pagamentos", icon: ShieldCheck },
              { title: "Personalizar aparência", path: "/admin/config/aparencia", icon: Palette },
              { title: "Ver relatórios", path: "/admin/relatorios", icon: LineChart },
              { title: "A Fazendinha", path: "/admin/fazendinha", icon: Sprout },
              { title: "Roleta Premiada", path: "/admin/caixinhas", icon: Gift }
            ].map(item => (
              <Link key={item.path} to={item.path} className="flex items-center gap-3 rounded-2xl border border-[var(--admin-border)] bg-white/[0.035] p-4 transition hover:border-[var(--admin-primary)]">
                <item.icon className="h-5 w-5 text-[var(--admin-primary)]" />
                <span className="flex-1 font-bold text-[var(--admin-text)]">{item.title}</span>
                <ArrowRight className="h-4 w-4 text-[var(--admin-muted)]" />
              </Link>
            ))}
            <button onClick={() => setIsRealtime(value => !value)} className="admin-button-secondary w-full">
              <Activity className="h-4 w-4" /> Atualização {isRealtime ? "ativa" : "pausada"}
            </button>
          </div>
        </ChartCard>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <InsightCard title="Destaques do Dia" icon={Trophy} tone="accent">
          {dailyHighlight?.vendas ? `${dailyHighlight.vendas} vendas confirmadas hoje com ${currency.format(dailyHighlight.receita)} em faturamento.` : "Sua operação está pronta para receber novas vendas."}
        </InsightCard>
        <InsightCard title="Alertas" icon={ShieldCheck} tone={pending.length ? "warning" : "success"}>
          {pending.length ? `${pending.length} venda(s) aguardam confirmação. Acompanhe para manter a saúde da operação.` : "Nenhum alerta crítico no período selecionado."}
        </InsightCard>
        <InsightCard title="Ações Recomendadas" icon={LineChart} tone="primary">
          {primaryRaffle ? "Use o ranking de campanhas para reforçar os canais com melhor desempenho." : "Configure suas primeiras campanhas para iniciar a operação."}
        </InsightCard>
      </section>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--admin-surface-strong)",
  border: "1px solid var(--admin-border)",
  borderRadius: 16,
  color: "var(--admin-text)"
};

function statusLabel(status: string) {
  if (status === "paid") return "Aprovada";
  if (status === "pending") return "Pendente";
  if (status === "cancelled") return "Cancelada";
  return status;
}

function EmptyVisual({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center rounded-3xl border border-[var(--admin-border)] bg-white/[0.025] text-center text-sm text-[var(--admin-muted)]">
      {label}
    </div>
  );
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase text-[var(--admin-primary)]">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--admin-text)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">{description}</p>
      </div>
    </div>
  );
}

function ExecutiveSignal({ icon: Icon, label, value, tone }: { icon: ElementType; label: string; value: string; tone: "success" | "warning" | "accent" }) {
  const color = tone === "success" ? "var(--admin-success)" : tone === "warning" ? "var(--admin-warning)" : "var(--admin-accent)";
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold" style={{ color }}>
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="line-clamp-2 text-sm font-semibold text-[var(--admin-text)]">{value}</p>
    </div>
  );
}

function InsightCard({ title, icon: Icon, tone, children }: { title: string; icon: ElementType; tone: "primary" | "success" | "warning" | "accent"; children: ReactNode }) {
  const color = {
    primary: "var(--admin-primary)",
    success: "var(--admin-success)",
    warning: "var(--admin-warning)",
    accent: "var(--admin-accent)"
  }[tone];
  return (
    <article className="admin-card p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ color, background: `${color}18` }}>
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-[var(--admin-text)]">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-[var(--admin-muted)]">{children}</p>
    </article>
  );
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
