import { useEffect, useMemo, useState } from "react";
import { Activity, Bell, Download, FileClock, HeartPulse, Megaphone, Plus, ShieldCheck, TicketPercent, Users } from "lucide-react";
import { toast } from "sonner";
import { MetricCard } from "../../components/admin/AdminPremium";

type Coupon = {
  id: string;
  code: string;
  name: string;
  type: "percent" | "fixed" | "bonus";
  value: number;
  active: boolean;
  minTickets?: number;
  maxUses?: number;
  used: number;
};

export function AdminOperations() {
  const [finance, setFinance] = useState<any>(null);
  const [notifications, setNotifications] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [form, setForm] = useState({ code: "", name: "", type: "percent", value: "10", minTickets: "" });

  const formatCurrency = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const load = async () => {
    const [financeRes, notificationsRes, healthRes, auditRes, couponsRes, supportRes, settingsRes] = await Promise.all([
      fetch("/api/admin/finance-summary"),
      fetch("/api/admin/notifications"),
      fetch("/api/admin/system-health"),
      fetch("/api/admin/audit-logs"),
      fetch("/api/admin/campaigns"),
      fetch("/api/admin/support/tickets"),
      fetch("/api/settings")
    ]);
    setFinance(await financeRes.json());
    setNotifications(await notificationsRes.json());
    setHealth(await healthRes.json());
    setAuditLogs(await auditRes.json());
    setCoupons(await couponsRes.json());
    setSupportTickets(await supportRes.json());
    setSettings(await settingsRes.json());
  };

  useEffect(() => {
    load().catch(() => null);
    const interval = window.setInterval(() => load().catch(() => null), 15000);
    return () => window.clearInterval(interval);
  }, []);

  const createCoupon = async () => {
    const res = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        value: Number(form.value || 0),
        minTickets: Number(form.minTickets || 0) || undefined
      })
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao criar cupom");
      return;
    }
    toast.success("Cupom criado");
    setForm({ code: "", name: "", type: "percent", value: "10", minTickets: "" });
    load().catch(() => null);
  };

  const toggleCoupon = async (coupon: Coupon) => {
    await fetch(`/api/admin/campaigns/${coupon.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !coupon.active })
    });
    load().catch(() => null);
  };

  const exportReports = async () => {
    const res = await fetch("/api/admin/reports/export");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio-geral.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const closeTicket = async (ticket: any) => {
    await fetch(`/api/admin/support/tickets/${ticket.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed", assignedTo: "Administrador" })
    });
    toast.success("Atendimento encerrado");
    load().catch(() => null);
  };

  const saveSmsProvider = async () => {
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smsProvider: settings?.smsProvider })
    });
    if (!res.ok) {
      toast.error("Erro ao salvar SMS");
      return;
    }
    toast.success("Configuração de SMS salva");
    load().catch(() => null);
  };

  const criticalIssues = useMemo(() => (health?.issues || []).filter((issue: any) => issue.level === "critical").length, [health]);

  return (
    <div className="admin-ops space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Bell} label="Notificações" value={notifications?.total || 0} trend="PIX, saques e suporte" tone="warning" />
        <MetricCard icon={HeartPulse} label="Saúde operacional" value={criticalIssues ? "Atenção" : "OK"} trend={`${health?.issues?.length || 0} aviso(s)`} tone={criticalIssues ? "danger" : "success"} />
        <MetricCard icon={TicketPercent} label="Cupons ativos" value={coupons.filter(item => item.active).length} trend={`${coupons.length} campanha(s)`} tone="accent" />
        <MetricCard icon={ShieldCheck} label="Auditoria" value={auditLogs.length} trend="ações administrativas" />
      </div>

      <section className="admin-card p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-[var(--admin-text)]">Financeiro operacional</h2>
            <p className="text-sm text-[var(--admin-muted)]">Receita por canal, PIX pendente, saques e saldo líquido estimado.</p>
          </div>
          <button onClick={exportReports} className="admin-button-secondary inline-flex items-center gap-2">
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Mini label="Receita bruta" value={formatCurrency(finance?.grossRevenue)} />
          <Mini label="PIX pendente" value={formatCurrency(finance?.pendingRevenue)} />
          <Mini label="Saques pagos" value={formatCurrency(finance?.paidWithdrawals)} />
          <Mini label="Líquido estimado" value={formatCurrency(finance?.estimatedNet)} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(finance?.channels || []).map((channel: any) => (
            <div key={channel.name} className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-4">
              <p className="font-bold text-[var(--admin-text)]">{channel.name}</p>
              <p className="mt-1 text-2xl font-black text-[var(--admin-primary)]">{formatCurrency(channel.revenue)}</p>
              <p className="text-xs text-[var(--admin-muted)]">{channel.purchases} compra(s)</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_.9fr]">
        <div className="admin-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TicketPercent className="h-5 w-5 text-[var(--admin-primary)]" />
            <h2 className="text-xl font-black text-[var(--admin-text)]">Campanhas e cupons</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_130px_120px_120px_auto]">
            <label className="grid gap-1.5 text-sm font-semibold text-[var(--admin-text)]">
              Código
              <input className="admin-input" placeholder="Ex: PROMO10" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[var(--admin-text)]">
              Campanha
              <input className="admin-input" placeholder="Nome da campanha" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[var(--admin-text)]">
              Tipo
              <select className="admin-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="percent">%</option>
                <option value="fixed">R$</option>
                <option value="bonus">Bônus</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[var(--admin-text)]">
              Valor
              <input className="admin-input" placeholder="10" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[var(--admin-text)]">
              Mín. cotas
              <input className="admin-input" placeholder="0" value={form.minTickets} onChange={e => setForm({ ...form, minTickets: e.target.value })} />
            </label>
            <button onClick={createCoupon} className="admin-button mt-auto inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Criar</button>
          </div>
          <div className="mt-4 space-y-2">
            {coupons.map(coupon => (
              <div key={coupon.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-black text-[var(--admin-text)]">{coupon.code} <span className="text-sm font-normal text-[var(--admin-muted)]">{coupon.name}</span></p>
                  <p className="text-xs text-[var(--admin-muted)]">{coupon.type} {coupon.value} • usado {coupon.used}{coupon.maxUses ? `/${coupon.maxUses}` : ""}</p>
                </div>
                <button onClick={() => toggleCoupon(coupon)} className={coupon.active ? "admin-button-secondary" : "admin-button"}>
                  {coupon.active ? "Pausar" : "Ativar"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-[var(--admin-primary)]" />
            <h2 className="text-xl font-black text-[var(--admin-text)]">Saúde e alertas</h2>
          </div>
          <div className="space-y-2">
            {(health?.issues || []).map((issue: any, index: number) => (
              <div key={`${issue.area}-${index}`} className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-3">
                <p className="text-sm font-bold text-[var(--admin-text)]">{issue.area} • {issue.level}</p>
                <p className="text-xs text-[var(--admin-muted)]">{issue.message}</p>
              </div>
            ))}
            {!health?.issues?.length && <p className="text-sm text-[var(--admin-muted)]">Nenhum alerta ativo.</p>}
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-4">
            <p className="text-sm font-bold text-[var(--admin-text)]">SMS/WhatsApp senha</p>
            <p className="mt-1 text-xs text-[var(--admin-muted)]">Modo atual: {health?.issues?.some((issue: any) => issue.area === "SMS") ? "local/simulado" : "provedor ativo"}</p>
            <div className="mt-3 grid gap-2">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--admin-border)] p-3 text-sm text-[var(--admin-text)]">
                Provedor ativo
                <input
                  type="checkbox"
                  checked={Boolean(settings?.smsProvider?.enabled)}
                  onChange={e => setSettings((current: any) => ({ ...current, smsProvider: { ...(current?.smsProvider || {}), enabled: e.target.checked } }))}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-[var(--admin-text)]">
                Provedor
                <input
                  className="admin-input"
                  placeholder="local, twilio, zenvia, whatsapp"
                  value={settings?.smsProvider?.provider || ""}
                  onChange={e => setSettings((current: any) => ({ ...current, smsProvider: { ...(current?.smsProvider || {}), provider: e.target.value } }))}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-[var(--admin-text)]">
                Remetente
                <input
                  className="admin-input"
                  placeholder="Nome exibido no envio"
                  value={settings?.smsProvider?.sender || ""}
                  onChange={e => setSettings((current: any) => ({ ...current, smsProvider: { ...(current?.smsProvider || {}), sender: e.target.value } }))}
                />
              </label>
              <button onClick={saveSmsProvider} className="admin-button-secondary">Salvar SMS</button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="admin-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-[var(--admin-text)]"><Users className="h-5 w-5 text-[var(--admin-primary)]" /> Fila de suporte</h2>
          <div className="space-y-3">
            {supportTickets.slice(0, 8).map(ticket => (
              <div key={ticket.id} className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[var(--admin-text)]">{ticket.customerName}</p>
                    <p className="text-xs text-[var(--admin-muted)]">{ticket.status} • {ticket.customerPhone}</p>
                  </div>
                  {ticket.status !== "closed" && <button onClick={() => closeTicket(ticket)} className="admin-button-secondary">Resolver</button>}
                </div>
                <p className="mt-3 text-sm text-[var(--admin-muted)]">{ticket.messages?.at(-1)?.body || "Sem mensagens"}</p>
              </div>
            ))}
            {!supportTickets.length && <p className="text-sm text-[var(--admin-muted)]">Nenhum atendimento aberto.</p>}
          </div>
        </div>

        <div className="admin-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-[var(--admin-text)]"><FileClock className="h-5 w-5 text-[var(--admin-primary)]" /> Auditoria recente</h2>
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {auditLogs.slice(0, 20).map(log => (
              <div key={log.id} className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-3">
                <p className="text-sm font-bold text-[var(--admin-text)]">{log.action}</p>
                <p className="text-xs text-[var(--admin-muted)]">{log.method} {log.path} • {log.status} • {new Date(log.createdAt).toLocaleString("pt-BR")}</p>
              </div>
            ))}
            {!auditLogs.length && <p className="text-sm text-[var(--admin-muted)]">As próximas alterações administrativas aparecerão aqui.</p>}
          </div>
        </div>
      </section>

      <section className="admin-card p-5">
        <h2 className="mb-2 flex items-center gap-2 text-xl font-black text-[var(--admin-text)]"><Megaphone className="h-5 w-5 text-[var(--admin-primary)]" /> Transparência pública</h2>
        <p className="text-sm text-[var(--admin-muted)]">A página pública de transparência mostra sorteios, ganhadores, Super Cotas e totais de participação.</p>
        <a href="/transparencia" target="_blank" rel="noreferrer" className="admin-button mt-4 inline-flex">Abrir página pública</a>
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-2 text-xl font-black text-[var(--admin-text)]">{value}</p>
    </div>
  );
}
