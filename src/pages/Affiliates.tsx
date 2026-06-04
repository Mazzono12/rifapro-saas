import React, { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Banknote,
  CalendarClock,
  Camera,
  CheckCircle2,
  Copy,
  Crown,
  DollarSign,
  FileText,
  Film,
  Image,
  Megaphone,
  PlaySquare,
  QrCode,
  Save,
  Send,
  Share2,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Trophy,
  UploadCloud,
  Users,
  Wallet
} from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AdminDataTable, ChartCard, MetricCard } from "../components/admin/AdminPremium";
import { MessageVideoPlayer } from "../components/MessageVideoPlayer";
import { useCustomerStore } from "../store/useCustomerStore";
import type { AffiliateStats } from "../types";
import { cn } from "../lib/utils";
import { uploadCustomerProfilePhoto } from "../utils/customerMedia";

type MarketingTab = "banners" | "videos" | "stories" | "reels" | "textos";
type AffiliateDashboard = {
  refCode: string;
  couponCode: string;
  links: { primary: string; short: string };
  metrics: {
    clicks: number;
    conversions: number;
    referredCustomers: number;
    revenue: number;
    conversionRate: number;
    commissionsTotal: number;
    commissionsPending: number;
    commissionsReleased: number;
    commissionsPaid: number;
    availableToWithdraw: number;
    prizesBalance: number;
  };
  recurring: { enabled: boolean; status: string; monthlyCommission: number; note: string };
  customers: Array<{ customer: string; plan: string; status: string; registeredAt: string; lastPaymentAt: string; commissionGenerated: number }>;
  commissions: Array<{ id: string; type: string; source: string; amount: number; status: string; createdAt: string }>;
  withdrawals: Array<{ id: string; amount: number; status: string; requestedAt: string; paidAt?: string; adminNote?: string }>;
  ranking: {
    month: Array<{ position: number; affiliate: string; customers: number; conversions: number; revenue: number; commissionGenerated: number; conversion: number }>;
    year: Array<{ position: number; affiliate: string; customers: number; conversions: number; revenue: number; commissionGenerated: number; conversion: number }>;
  };
};

const marketingTabs: Array<{ id: MarketingTab; label: string; icon: React.ElementType }> = [
  { id: "banners", label: "Banners", icon: Image },
  { id: "videos", label: "Vídeos", icon: Film },
  { id: "stories", label: "Stories", icon: PlaySquare },
  { id: "reels", label: "Reels", icon: Sparkles },
  { id: "textos", label: "Textos prontos", icon: FileText }
];

export function Affiliates() {
  const { customer, setCustomer } = useCustomerStore();
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [dashboard, setDashboard] = useState<AffiliateDashboard | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [pixKey, setPixKey] = useState("");
  const [useBalance, setUseBalance] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [marketingTab, setMarketingTab] = useState<MarketingTab>("banners");

  useEffect(() => {
    if (!customer) return;
    Promise.all([
      fetch(`/api/affiliates/${customer.affiliateRefCode}`).then(res => res.json()),
      fetch(`/api/affiliates/${customer.affiliateRefCode}/dashboard`).then(res => res.ok ? res.json() : null).catch(() => null)
    ]).then(([data, dashboardData]) => {
      setStats(data);
      setDashboard(dashboardData);
      setPixKey(data.pixKey || "");
      setUseBalance(Boolean(data.useBalanceForPurchases));
      const balance = Number(dashboardData?.metrics?.availableToWithdraw ?? ((data.commissionBalance ?? data.commission ?? 0) + Number(data.prizeBalance || 0)));
      setWithdrawAmount(balance ? balance.toFixed(2) : "");
      setCustomer({ ...customer, affiliate: data });
    }).catch(() => null);
  }, [customer?.affiliateRefCode]);

  useEffect(() => {
    fetch("/api/settings").then(res => res.json()).then(setSettings).catch(() => null);
  }, []);

  const affiliateLink = useMemo(() => {
    if (dashboard?.links?.primary) return dashboard.links.primary;
    if (typeof window === "undefined" || !customer) return "";
    return `${window.location.origin}/?ref=${customer.affiliateRefCode}&utm_source=afiliado&utm_medium=painel`;
  }, [customer?.affiliateRefCode, dashboard?.links?.primary]);

  const shortLink = useMemo(() => {
    if (dashboard?.links?.short) return dashboard.links.short;
    if (typeof window === "undefined" || !customer) return "";
    return `${window.location.origin}/?ref=${customer.affiliateRefCode}`;
  }, [customer?.affiliateRefCode, dashboard?.links?.short]);

  const copyValue = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  };

  const saveAffiliate = async () => {
    if (!customer) return;
    const res = await fetch(`/api/affiliates/${customer.affiliateRefCode}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pixKey, useBalanceForPurchases: useBalance })
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao salvar afiliado");
      return;
    }
    setStats(data);
    setCustomer({ ...customer, affiliate: data });
    fetch(`/api/affiliates/${customer.affiliateRefCode}/dashboard`).then(res => res.ok ? res.json() : null).then(setDashboard).catch(() => null);
    toast.success("Preferências de afiliado salvas");
  };

  const uploadAffiliatePhoto = async (file?: File) => {
    if (!customer || !file) return;
    setUploadingPhoto(true);
    try {
      const updatedCustomer = await uploadCustomerProfilePhoto(customer.id, file);
      if (!updatedCustomer) return;
      setCustomer({ ...updatedCustomer, affiliate: stats || updatedCustomer.affiliate });
      toast.success("Foto compartilhada atualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao subir foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const requestWithdrawal = async () => {
    if (!customer || !stats) return;
    if (!pixKey.trim()) {
      toast.error("Configure sua chave PIX antes de solicitar saque");
      return;
    }
    setIsWithdrawing(true);
    try {
      const res = await fetch(`/api/affiliates/${customer.affiliateRefCode}/withdrawals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixKey, amount: Number(withdrawAmount || 0) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao solicitar saque");
      setStats(data.affiliate);
      setCustomer({ ...customer, affiliate: data.affiliate });
      fetch(`/api/affiliates/${customer.affiliateRefCode}/dashboard`).then(response => response.ok ? response.json() : null).then(setDashboard).catch(() => null);
      toast.success("Solicitação de saque enviada", {
        description: "O admin foi notificado para fazer a transferência manual no banco."
      });
    } catch (error: any) {
      toast.error("Saque não solicitado", { description: error.message });
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (!customer) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-6">
        <div className="admin-card p-8 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-[var(--admin-muted)]" />
          <h1 className="text-3xl font-bold text-[var(--admin-text)]">Programa de Afiliados</h1>
          <p className="mt-3 text-sm text-[var(--admin-muted)]">Seu link único será criado automaticamente quando você fizer seu primeiro cadastro no checkout.</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const rules = stats.rules;
  const eligible = stats.enabled;
  const commissionBalance = Number(dashboard?.metrics.commissionsReleased ?? stats.commissionBalance ?? stats.commission ?? 0);
  const prizeBalance = Number(dashboard?.metrics.prizesBalance ?? stats.prizeBalance ?? 0);
  const totalBalance = commissionBalance + prizeBalance;
  const paidAmount = Number(dashboard?.metrics.commissionsPaid ?? stats.history
    .filter(entry => entry.amount < 0 || /paid/i.test(entry.type))
    .reduce((sum, entry) => sum + Math.abs(Number(entry.amount || 0)), 0));
  const expectedCommission = Number((stats.revenue * ((rules?.commissionRate || 0) / 100)).toFixed(2));
  const totalCommissions = Number(dashboard?.metrics.commissionsTotal ?? Math.max(expectedCommission, commissionBalance + paidAmount));
  const pendingCommissions = Number(dashboard?.metrics.commissionsPending ?? Math.max(0, expectedCommission - commissionBalance - paidAmount));
  const releasedCommissions = commissionBalance;
  const conversionRate = Number(dashboard?.metrics.conversionRate ?? (stats.clicks > 0 ? (stats.conversions / stats.clicks) * 100 : stats.conversions > 0 ? 100 : 0));
  const canWithdraw = totalBalance >= (rules?.minWithdrawAmount || 0);
  const nextPayment = nextBusinessPaymentLabel();
  const couponCode = dashboard?.couponCode || String(customer.affiliateRefCode || "").toUpperCase();
  const referredRows = dashboard ? buildReferredRowsFromDashboard(dashboard.customers) : buildReferredRows(stats);
  const historyRows = dashboard ? buildHistoryRowsFromDashboard(dashboard.commissions, dashboard.withdrawals, nextPayment) : buildHistoryRows(stats.history, nextPayment);
  const rankingMonth = dashboard ? buildRankingRowsFromDashboard(dashboard.ranking.month) : buildRankingRows(customer.name, stats, "month");
  const rankingYear = dashboard ? buildRankingRowsFromDashboard(dashboard.ranking.year) : buildRankingRows(customer.name, stats, "year");
  const chartData = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((name, index) => ({
    name,
    ganhos: Number(Math.max(0, totalCommissions * ((index + 1) / 8)).toFixed(2))
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-10 pt-4 text-[var(--admin-text)]">
      <section className="admin-card p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--admin-primary)]">
              <Crown className="h-4 w-4" />
              Afiliados Premium V1
            </p>
            <h1 className="text-3xl font-black text-[var(--admin-text)] md:text-4xl">Painel de Afiliado</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">
              Comissão de {rules?.commissionRate || 0}% por compra indicada, com saque mínimo de R$ {(rules?.minWithdrawAmount || 0).toFixed(2)}.
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-3 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-2">
            <AffiliateAvatar customer={customer} />
            <div className="min-w-0 pr-2">
              <p className="truncate text-sm font-bold text-[var(--admin-text)]">{customer.name}</p>
              <p className="truncate font-mono text-xs text-[var(--admin-muted)]">{customer.affiliateRefCode}</p>
            </div>
            <button onClick={() => void copyValue(affiliateLink, "Link de afiliado copiado")} className="admin-button-secondary shrink-0">
              <Copy className="h-4 w-4" />
              Copiar
            </button>
          </div>
        </div>
      </section>

      {!eligible && (
        <div className="rounded-[8px] border border-[var(--admin-warning)]/40 bg-[var(--admin-warning)]/10 p-4 text-sm font-semibold text-[var(--admin-warning)]">
          Compre mais {Math.max(0, (rules?.minTicketsToJoin || 0) - customer.totalTickets)} cota(s) para liberar o cadastro ativo no programa de afiliados.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={DollarSign} label="Comissões Totais" value={money(totalCommissions)} trend="histórico estimado" tone="success" />
        <MetricCard icon={CalendarClock} label="Comissões Pendentes" value={money(pendingCommissions)} trend="a liberar" tone="warning" />
        <MetricCard icon={CheckCircle2} label="Comissões Liberadas" value={money(releasedCommissions)} trend="saldo disponível" tone="primary" />
        <MetricCard icon={Banknote} label="Saques Realizados" value={money(paidAmount)} trend={`${paidWithdrawalCount(stats.history)} baixa(s)`} tone="accent" />
        <MetricCard icon={Users} label="Clientes Indicados" value={dashboard?.metrics.referredCustomers ?? stats.referredCustomers} trend={`${dashboard?.metrics.conversions ?? stats.conversions} conversões`} />
        <MetricCard icon={TrendingUp} label="Conversão" value={`${conversionRate.toFixed(1)}%`} trend={`${dashboard?.metrics.clicks ?? stats.clicks} cliques`} tone="success" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <ChartCard title="Receita por indicação" description="Visão semanal do potencial de comissão">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="name" stroke="var(--admin-muted)" axisLine={false} tickLine={false} />
                <YAxis stroke="var(--admin-muted)" axisLine={false} tickLine={false} tickFormatter={(value) => `R$${value}`} />
                <Tooltip contentStyle={{ background: "var(--admin-surface-strong)", border: "1px solid var(--admin-border)", borderRadius: 8, color: "var(--admin-text)" }} />
                <Area type="monotone" dataKey="ganhos" stroke="var(--admin-primary)" fill="var(--admin-primary)" fillOpacity={0.16} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <section className="admin-card p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[var(--admin-text)]">Central de Links</h2>
              <p className="text-sm text-[var(--admin-muted)]">Link principal, curto, cupom e QR Code.</p>
            </div>
            <QrCode className="h-5 w-5 text-[var(--admin-primary)]" />
          </div>
          <div className="grid gap-3">
            <LinkRow label="Link principal" value={affiliateLink} onCopy={() => void copyValue(affiliateLink, "Link principal copiado")} />
            <LinkRow label="Link curto" value={shortLink} onCopy={() => void copyValue(shortLink, "Link curto copiado")} />
            <LinkRow label="Cupom personalizado" value={couponCode} onCopy={() => void copyValue(couponCode, "Cupom copiado")} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-[150px_1fr]">
            <div className="grid aspect-square place-items-center rounded-[8px] border border-[var(--admin-border)] bg-white p-3">
              <QRCodeSVG value={affiliateLink} className="h-full w-full" bgColor="#ffffff" fgColor="#0f172a" level="M" />
            </div>
            <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4">
              <p className="text-sm font-semibold text-[var(--admin-text)]">QR Code de divulgação</p>
              <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">Use em stories, grupos, bio ou atendimento. O código direciona para o link principal com sua indicação.</p>
              <button onClick={() => void copyValue(affiliateLink, "Link do QR copiado")} className="admin-button-secondary mt-4">
                <Share2 className="h-4 w-4" />
                Compartilhar link
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="admin-card p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[var(--admin-text)]">Área Financeira</h2>
              <p className="text-sm text-[var(--admin-muted)]">Saldo, liberação e próximo pagamento.</p>
            </div>
            <Wallet className="h-5 w-5 text-[var(--admin-primary)]" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FinanceStat label="Disponível para saque" value={money(totalBalance)} />
            <FinanceStat label="A liberar" value={money(pendingCommissions)} />
            <FinanceStat label="Pago" value={money(paidAmount)} />
            <FinanceStat label="Próximo pagamento" value={nextPayment} />
          </div>
          {dashboard?.recurring && (
            <div className="mt-3 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-xs leading-5 text-[var(--admin-muted)]">
              Comissão recorrente: {dashboard.recurring.status === "preparation" ? "em preparação" : "ativa"}. {dashboard.recurring.note}
            </div>
          )}
          <div className="mt-5 space-y-4 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4">
            <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">
              Chave PIX para saque
              <input value={pixKey} onChange={event => setPixKey(event.target.value)} placeholder="CPF, telefone, e-mail ou aleatória" className="admin-input" />
            </label>
            <button type="button" onClick={() => setUseBalance(!useBalance)} className="flex w-full items-center justify-between rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 text-left">
              <span className="text-sm font-semibold text-[var(--admin-text)]">Usar saldo para comprar cotas</span>
              {useBalance ? <ToggleRight className="h-7 w-7 text-[var(--admin-success)]" /> : <ToggleLeft className="h-7 w-7 text-[var(--admin-muted)]" />}
            </button>
            <button onClick={saveAffiliate} className="admin-button-primary w-full justify-center">
              <Save className="h-4 w-4" />
              Salvar preferências
            </button>
            {canWithdraw ? (
              <div className="space-y-3 rounded-[8px] border border-[var(--admin-success)]/35 bg-[var(--admin-success)]/10 p-4">
                <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">
                  Valor sacável
                  <input
                    type="number"
                    min={rules?.minWithdrawAmount || 0}
                    max={totalBalance}
                    step="0.01"
                    value={withdrawAmount}
                    onChange={event => setWithdrawAmount(event.target.value)}
                    className="admin-input"
                  />
                </label>
                <button type="button" onClick={requestWithdrawal} disabled={isWithdrawing} className="admin-button-primary w-full justify-center disabled:opacity-60">
                  <Send className="h-4 w-4" />
                  {isWithdrawing ? "Enviando..." : "Solicitar saque"}
                </button>
              </div>
            ) : (
              <button disabled className="admin-button-secondary w-full justify-center opacity-50">
                Saque mínimo: R$ {(rules?.minWithdrawAmount || 0).toFixed(2)}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <AdminDataTable
            columns={["Cliente", "Plano", "Status", "Data de cadastro", "Último pagamento", "Comissão"]}
            rows={referredRows}
            empty="Nenhum cliente indicado identificado ainda."
            minWidth="820px"
          />
          <AdminDataTable
            columns={["Tipo", "Valor", "Data", "Status"]}
            rows={historyRows}
            empty="Nenhum histórico financeiro ainda."
            minWidth="640px"
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <RankingCard title="Top afiliados do mês" rows={rankingMonth} />
        <RankingCard title="Top afiliados do ano" rows={rankingYear} />
      </section>

      <section className="admin-card p-5">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--admin-text)]">
              <Megaphone className="h-5 w-5 text-[var(--admin-primary)]" />
              Central de Marketing
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Materiais rápidos para divulgação em canais sociais.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {marketingTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMarketingTab(tab.id)}
                className={cn("admin-button-secondary", marketingTab === tab.id && "border-[var(--admin-primary)] text-[var(--admin-primary)]")}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <MarketingPanel
          activeTab={marketingTab}
          customerName={customer.name}
          affiliateLink={affiliateLink}
          couponCode={couponCode}
          settings={settings}
          onCopy={copyValue}
        />
      </section>

      {settings?.affiliateInstructionVideo?.enabled && settings.affiliateInstructionVideo?.mediaUrl && (
        <section className="admin-card overflow-hidden p-5">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--admin-primary)]">Treinamento do afiliado</p>
            <h2 className="mt-1 text-xl font-bold text-[var(--admin-text)]">{settings.affiliateInstructionVideo.title || "Como divulgar seu link"}</h2>
            {settings.affiliateInstructionVideo.description && (
              <p className="mt-1 text-sm text-[var(--admin-muted)]">{settings.affiliateInstructionVideo.description}</p>
            )}
          </div>
          <div className="aspect-video overflow-hidden rounded-[8px] border border-[var(--admin-border)] bg-black">
            <MessageVideoPlayer
              mediaUrl={settings.affiliateInstructionVideo.mediaUrl}
              mediaType={settings.affiliateInstructionVideo.mediaType}
              config={{ ...(settings.affiliateInstructionVideo.videoConfig || {}), showControls: false, tapToUnmute: false }}
              className="h-full w-full"
            />
          </div>
        </section>
      )}

      <section className="admin-card p-5">
        <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
          <AffiliateAvatar customer={customer} large />
          <div>
            <h2 className="text-lg font-bold text-[var(--admin-text)]">Foto de divulgação</h2>
            <p className="text-sm text-[var(--admin-muted)]">A mesma imagem aparece no perfil do cliente e deixa os materiais mais reconhecíveis.</p>
          </div>
          <label className="admin-button-secondary inline-flex min-h-11 cursor-pointer items-center justify-center gap-2">
            <UploadCloud className="h-4 w-4" />
            {uploadingPhoto ? "Enviando..." : "Escolher foto"}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp"
              disabled={uploadingPhoto}
              onChange={event => {
                uploadAffiliatePhoto(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
              className="sr-only"
            />
          </label>
        </div>
      </section>
    </div>
  );
}

function AffiliateAvatar({ customer, large = false }: { customer: { name: string; photoUrl?: string }; large?: boolean }) {
  return (
    <div className={cn("shrink-0 overflow-hidden rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)]", large ? "h-16 w-16" : "h-11 w-11")}>
      {customer.photoUrl ? (
        <img src={customer.photoUrl} alt={customer.name} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-[var(--admin-muted)]">
          <Camera className={large ? "h-7 w-7" : "h-5 w-5"} />
        </div>
      )}
    </div>
  );
}

function LinkRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="grid gap-2 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-3 sm:grid-cols-[130px_1fr_auto] sm:items-center">
      <span className="text-xs font-bold uppercase text-[var(--admin-muted)]">{label}</span>
      <span className="truncate font-mono text-sm text-[var(--admin-text)]">{value}</span>
      <button onClick={onCopy} className="admin-button-secondary justify-center py-2 text-xs">
        <Copy className="h-4 w-4" />
        Copiar
      </button>
    </div>
  );
}

function FinanceStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4">
      <p className="text-xs font-bold uppercase text-[var(--admin-muted)]">{label}</p>
      <p className="mt-2 text-xl font-black text-[var(--admin-text)]">{value}</p>
    </div>
  );
}

function RankingCard({ title, rows }: { title: string; rows: React.ReactNode[][] }) {
  return (
    <section className="admin-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[var(--admin-text)]">{title}</h2>
        <Trophy className="h-5 w-5 text-[var(--admin-primary)]" />
      </div>
      <AdminDataTable columns={["Posição", "Afiliado", "Clientes", "Receita", "Comissão"]} rows={rows} minWidth="640px" />
    </section>
  );
}

function MarketingPanel({
  activeTab,
  customerName,
  affiliateLink,
  couponCode,
  settings,
  onCopy
}: {
  activeTab: MarketingTab;
  customerName: string;
  affiliateLink: string;
  couponCode: string;
  settings: any;
  onCopy: (value: string, message: string) => Promise<void>;
}) {
  const videoTitle = settings?.affiliateInstructionVideo?.title || "Como divulgar seu link";
  const copy = {
    banners: [
      ["Banner principal", "Use em grupos e páginas com chamada direta para a ação ativa."],
      ["Banner de cupom", `Destaque o cupom ${couponCode} junto ao seu link.`],
      ["Banner de prova social", "Mostre urgência, prêmio e benefício de entrar pelo seu convite."]
    ],
    videos: [
      [videoTitle, "Conteúdo de treinamento configurado no admin."],
      ["Vídeo curto de convite", "Roteiro de 15 segundos com benefício, prova e chamada para comprar."],
      ["Vídeo de tutorial", "Explique como escolher números e finalizar a participação."]
    ],
    stories: [
      ["Story 1", "Gancho rápido com prêmio e chamada para arrastar ou tocar no link."],
      ["Story 2", "Prova social com clientes entrando pela indicação."],
      ["Story 3", `Cupom ${couponCode} em destaque.`]
    ],
    reels: [
      ["Reel de abertura", "Mostre o prêmio nos primeiros 2 segundos."],
      ["Reel de urgência", "Use contagem regressiva e chamada direta."],
      ["Reel de bastidores", "Humanize sua divulgação e reforce confiança."]
    ],
    textos: [
      ["WhatsApp curto", `Pessoal, estou indicando essa ação. Entra pelo meu link: ${affiliateLink}`],
      ["Grupo VIP", `Use meu cupom ${couponCode} e acompanhe as novidades pelo link: ${affiliateLink}`],
      ["Bio", `Participe pelo meu convite oficial: ${affiliateLink}`]
    ]
  }[activeTab];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {copy.map(([title, description]) => (
        <article key={title} className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4">
          <p className="text-sm font-bold text-[var(--admin-text)]">{title}</p>
          <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--admin-muted)]">{description}</p>
          <button onClick={() => void onCopy(`${title}\n${description}\n\n${customerName}: ${affiliateLink}`, "Material copiado")} className="admin-button-secondary mt-4 w-full justify-center">
            <Copy className="h-4 w-4" />
            Copiar material
          </button>
        </article>
      ))}
    </div>
  );
}

function buildReferredRows(stats: AffiliateStats) {
  return Array.from({ length: stats.referredCustomers }).slice(0, 20).map((_, index) => [
    `Cliente indicado #${index + 1}`,
    "Plano ativo",
    <span key={`status-${index}`} className="text-xs font-semibold text-[var(--admin-success)]">Ativo</span>,
    "-",
    stats.conversions > index ? "Pagamento confirmado" : "-",
    stats.conversions > index ? money((stats.revenue * ((stats.rules?.commissionRate || 0) / 100)) / Math.max(1, stats.conversions)) : money(0)
  ]);
}

function buildReferredRowsFromDashboard(customers: AffiliateDashboard["customers"]) {
  return customers.slice(0, 40).map((item, index) => [
    item.customer || `Cliente indicado #${index + 1}`,
    item.plan || "Cliente",
    <span key={`status-${index}`} className={cn("text-xs font-semibold", item.status === "active" ? "text-[var(--admin-success)]" : "text-[var(--admin-muted)]")}>
      {item.status === "active" ? "Ativo" : "Cadastrado"}
    </span>,
    item.registeredAt ? new Date(item.registeredAt).toLocaleDateString("pt-BR") : "-",
    item.lastPaymentAt ? new Date(item.lastPaymentAt).toLocaleDateString("pt-BR") : "-",
    money(item.commissionGenerated)
  ]);
}

function buildHistoryRows(history: AffiliateStats["history"], nextPayment: string) {
  const rows = history.slice(-20).reverse().map((entry, index) => [
    historyTypeLabel(entry.type),
    money(Math.abs(Number(entry.amount || 0))),
    entry.date ? new Date(entry.date).toLocaleString("pt-BR") : "-",
    <span key={`${entry.type}-${index}`} className="text-xs font-semibold text-[var(--admin-muted)]">{historyStatus(entry.type, nextPayment)}</span>
  ]);
  return rows;
}

function buildHistoryRowsFromDashboard(commissions: AffiliateDashboard["commissions"], withdrawals: AffiliateDashboard["withdrawals"], nextPayment: string) {
  return [
    ...withdrawals.map(item => ({
      type: "Saque",
      amount: item.amount,
      date: item.paidAt || item.requestedAt,
      status: withdrawalStatusLabel(item.status, nextPayment),
      tone: item.status === "paid" ? "text-[var(--admin-success)]" : item.status === "pending" ? "text-[var(--admin-warning)]" : "text-[var(--admin-danger)]"
    })),
    ...commissions.map(item => ({
      type: commissionTypeLabel(item.type),
      amount: item.amount,
      date: item.createdAt,
      status: item.status === "released" ? "Liberado" : item.status,
      tone: "text-[var(--admin-muted)]"
    }))
  ]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 30)
    .map((item, index) => [
      item.type,
      money(item.amount),
      item.date ? new Date(item.date).toLocaleString("pt-BR") : "-",
      <span key={`${item.type}-${index}`} className={cn("text-xs font-semibold", item.tone)}>{item.status}</span>
    ]);
}

function buildRankingRows(name: string, stats: AffiliateStats, period: "month" | "year") {
  const multiplier = period === "month" ? 1 : 3.4;
  const base = [
    { name, customers: stats.referredCustomers, revenue: stats.revenue, commission: stats.commissionBalance ?? stats.commission ?? 0 },
    { name: "Afiliado Prime", customers: Math.max(stats.referredCustomers + 2, 8), revenue: Math.max(stats.revenue * 1.35, 4200) * multiplier, commission: Math.max(stats.commission * 1.35, 420) * multiplier },
    { name: "Afiliado Elite", customers: Math.max(stats.referredCustomers + 1, 5), revenue: Math.max(stats.revenue * 1.12, 2800) * multiplier, commission: Math.max(stats.commission * 1.12, 280) * multiplier }
  ].sort((a, b) => b.revenue - a.revenue);

  return base.map((item, index) => [
    `#${index + 1}`,
    item.name,
    item.customers,
    money(item.revenue),
    money(item.commission)
  ]);
}

function buildRankingRowsFromDashboard(rows: AffiliateDashboard["ranking"]["month"]) {
  return rows.map(item => [
    `#${item.position}`,
    item.affiliate,
    item.customers,
    money(item.revenue),
    <span key={item.position} className="text-[var(--admin-success)]">{money(item.commissionGenerated)} · {item.conversion.toFixed(1)}%</span>
  ]);
}

function paidWithdrawalCount(history: AffiliateStats["history"]) {
  return history.filter(entry => entry.amount < 0 || /paid/i.test(entry.type)).length;
}

function commissionTypeLabel(type: string) {
  if (type === "sale_commission") return "Comissão por venda";
  return historyTypeLabel(type);
}

function withdrawalStatusLabel(status: string, nextPayment: string) {
  if (status === "paid") return "Pago";
  if (status === "rejected") return "Rejeitado";
  return `Pendente · ${nextPayment}`;
}

function historyTypeLabel(type: string) {
  if (/withdrawal_requested/i.test(type)) return "Saque solicitado";
  if (/withdraw|paid/i.test(type)) return "Saque pago";
  if (/prize/i.test(type)) return "Prêmio";
  if (/commission/i.test(type)) return "Comissão";
  if (/balance_purchase/i.test(type)) return "Compra com saldo";
  return "Movimento";
}

function historyStatus(type: string, nextPayment: string) {
  if (/requested/i.test(type)) return `Previsto: ${nextPayment}`;
  if (/paid/i.test(type)) return "Pago";
  return "Liberado";
}

function nextBusinessPaymentLabel() {
  const date = new Date();
  date.setDate(date.getDate() + ((5 - date.getDay() + 7) % 7 || 7));
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function money(value: number) {
  return `R$ ${Number(value || 0).toFixed(2)}`;
}
