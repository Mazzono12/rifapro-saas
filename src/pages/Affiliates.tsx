import React, { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Banknote,
  CalendarClock,
  Camera,
  CheckCircle2,
  Copy,
  Crown,
  DollarSign,
  ExternalLink,
  Gift,
  Megaphone,
  Medal,
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

type AffiliateCampaignLink = {
  publicId: string;
  name: string;
  type: string;
  status: string;
  commissionEnabled?: boolean;
  commissionStatusLabel?: string;
  publicPath: string;
  affiliateUrl: string;
  imageUrl?: string;
  whatsappText?: string;
};
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
  eligibility: {
    monthlyRequiredAmount: number;
    monthlyPurchasedAmount: number;
    remainingAmount: number;
    isEligibleThisMonth: boolean;
    eligibilityStatus: "active" | "pending";
    blockedCommissionAmount: number;
  };
  customers: Array<{ customer: string; plan: string; status: string; registeredAt: string; lastPaymentAt: string; commissionGenerated: number }>;
  commissions: Array<{ id: string; type: string; source: string; amount: number; status: string; createdAt: string }>;
  withdrawals: Array<{ id: string; amount: number; status: string; requestedAt: string; paidAt?: string; adminNote?: string }>;
  performanceRewards?: {
    enabled: boolean;
    balances?: {
      scratchcard: number;
      wheel_spin: number;
      super_quota: number;
      bonus_number: number;
      future_reward: number;
    };
    rules: Array<{
      id: string;
      name: string;
      goalType: string;
      goalLabel: string;
      threshold: number;
      progress: number;
      currentProgress: number;
      progressLabel: string;
      percent: number;
      completed: number;
      nextReward: string;
      rewardType: string;
      rewardQuantity: number;
    }>;
    history: Array<{ id: string; ruleName: string; reward: string; goalLabel: string; milestone: number; createdAt: string }>;
    consumptions: Array<{ id: string; rewardType: string; quantity: number; label: string; status: string; eventId?: string; lootboxId?: string; message?: string; createdAt: string }>;
  };
  ranking: {
    month: Array<{ position: number; affiliate: string; customers: number; conversions: number; revenue: number; conversion: number }>;
    year: Array<{ position: number; affiliate: string; customers: number; conversions: number; revenue: number; conversion: number }>;
  };
};

type AffiliateRankingRow = AffiliateDashboard["ranking"]["month"][number];
type AffiliateGamificationSummary = {
  positionLabel: string;
  revenue: number;
  monthlyRevenue: number;
  referredCustomers: number;
  conversions: number;
  bestAffiliate: string;
  bestRevenue: number;
  nextAffiliate: string;
  nextRevenue: number;
  distanceToClimb: number;
  currentLevel: AffiliateLevel;
  nextLevel?: AffiliateLevel;
  levelProgress: number;
  monthlyGoal: number;
  monthlyProgress: number;
  rewardText: string;
  achievements: Array<{ label: string; unlocked: boolean }>;
};
type AffiliateLevel = {
  name: "Bronze" | "Prata" | "Ouro" | "Diamante";
  threshold: number;
  icon: string;
  tone: string;
};

const affiliateLevels: AffiliateLevel[] = [
  { name: "Bronze", threshold: 0, icon: "🥉", tone: "text-amber-300" },
  { name: "Prata", threshold: 1000, icon: "🥈", tone: "text-slate-200" },
  { name: "Ouro", threshold: 5000, icon: "🥇", tone: "text-yellow-300" },
  { name: "Diamante", threshold: 20000, icon: "💎", tone: "text-cyan-300" }
];
const monthlySalesGoal = 10000;

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
  const [isLoadingAffiliate, setIsLoadingAffiliate] = useState(true);
  const [affiliateLoadError, setAffiliateLoadError] = useState("");
  const [campaignLinks, setCampaignLinks] = useState<AffiliateCampaignLink[]>([]);
  const [isLoadingCampaignLinks, setIsLoadingCampaignLinks] = useState(true);
  const [campaignLinksError, setCampaignLinksError] = useState("");
  const [consumingReward, setConsumingReward] = useState("");
  const consumingRewardRef = useRef("");

  useEffect(() => {
    if (!customer) return;
    setIsLoadingAffiliate(true);
    setAffiliateLoadError("");
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
    }).catch(() => {
      setAffiliateLoadError("Não foi possível carregar seu painel de afiliado agora. Tente novamente em alguns instantes.");
    }).finally(() => setIsLoadingAffiliate(false));
  }, [customer?.affiliateRefCode]);

  useEffect(() => {
    fetch("/api/settings").then(res => res.json()).then(setSettings).catch(() => null);
  }, []);

  useEffect(() => {
    if (!customer?.affiliateRefCode) return;
    setIsLoadingCampaignLinks(true);
    setCampaignLinksError("");
    fetch(`/api/affiliates/${customer.affiliateRefCode}/campaign-links`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao carregar campanhas");
        setCampaignLinks(Array.isArray(data?.campaigns) ? data.campaigns : []);
      })
      .catch(() => {
        setCampaignLinks([]);
        setCampaignLinksError("Não foi possível carregar os links das campanhas agora.");
      })
      .finally(() => setIsLoadingCampaignLinks(false));
  }, [customer?.affiliateRefCode]);

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

  const consumeReward = async (rewardType: string, quantity = 1) => {
    if (!customer?.affiliateRefCode) return;
    if (consumingRewardRef.current) return;
    const idempotencyKey = `${customer.id}:${rewardType}:${Date.now()}`;
    consumingRewardRef.current = rewardType;
    setConsumingReward(rewardType);
    try {
      const res = await fetch(`/api/affiliates/${customer.affiliateRefCode}/rewards/consume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardType, quantity, idempotencyKey })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível usar esta recompensa.");
      if (data.dashboard) setDashboard(data.dashboard);
      toast.success("Recompensa utilizada", {
        description: data.consumption?.result?.message || data.consumption?.result?.label || "Histórico atualizado."
      });
    } catch (error) {
      toast.error("Recompensa não utilizada", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes."
      });
    } finally {
      consumingRewardRef.current = "";
      setConsumingReward("");
    }
  };

  if (!customer) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-6">
        <div className="admin-card p-8 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-[var(--admin-muted)]" />
          <h1 className="text-3xl font-bold text-[var(--admin-text)]">Programa de Afiliados</h1>
          <p className="mt-3 text-sm font-semibold text-[var(--admin-text)]">Você ainda não possui cadastro de afiliado.</p>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">Seu link único será criado automaticamente quando seu cadastro estiver habilitado no programa.</p>
        </div>
      </div>
    );
  }

  if (isLoadingAffiliate) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 px-3 pb-10 pt-4 text-[var(--admin-text)] sm:px-4">
        <div className="admin-card p-5">
          <div className="h-6 w-40 animate-pulse rounded-[8px] bg-white/[0.08]" />
          <div className="mt-4 h-9 w-full max-w-sm animate-pulse rounded-[8px] bg-white/[0.08]" />
          <div className="mt-3 h-5 w-full max-w-2xl animate-pulse rounded-[8px] bg-white/[0.06]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="admin-card h-32 animate-pulse bg-white/[0.06]" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats || affiliateLoadError) {
    return (
      <div className="mx-auto w-full max-w-2xl px-3 pb-10 pt-6 sm:px-4">
        <div className="admin-card p-6 text-center">
          <Wallet className="mx-auto mb-4 h-10 w-10 text-[var(--admin-warning)]" />
          <h1 className="text-2xl font-black text-[var(--admin-text)]">Painel indisponível</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--admin-muted)]">
            {affiliateLoadError || "Ainda não recebemos os dados do seu painel de afiliado."}
          </p>
        </div>
      </div>
    );
  }

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
  const gamification = buildAffiliateGamification({
    affiliateName: customer.name,
    revenue: Number(dashboard?.metrics.revenue ?? stats.revenue ?? 0),
    referredCustomers: Number(dashboard?.metrics.referredCustomers ?? stats.referredCustomers ?? 0),
    conversions: Number(dashboard?.metrics.conversions ?? stats.conversions ?? 0),
    ranking: dashboard?.ranking.month ?? []
  });
  const eligibility = dashboard?.eligibility;
  const chartData = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((name, index) => ({
    name,
    ganhos: Number(Math.max(0, totalCommissions * ((index + 1) / 8)).toFixed(2))
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-3 pb-10 pt-3 text-[var(--admin-text)] sm:space-y-6 sm:px-4 sm:pt-4">
      <section className="admin-card p-4 sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 flex min-w-0 items-center gap-2 text-xs font-bold uppercase text-[var(--admin-primary)]">
              <Crown className="h-4 w-4" />
              <span className="min-w-0 break-words">Afiliados Premium</span>
            </p>
            <h1 className="break-words text-3xl font-black text-[var(--admin-text)] md:text-4xl">Painel de Afiliado</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">
              Comissão de {rules?.commissionRate || 0}% por compra indicada, com saque mínimo de R$ {(rules?.minWithdrawAmount || 0).toFixed(2)}.
            </p>
          </div>
          <div className="grid min-w-0 gap-3 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center lg:w-auto lg:min-w-[320px]">
            <AffiliateAvatar customer={customer} />
            <div className="min-w-0 sm:pr-2">
              <p className="min-w-0 break-words text-sm font-bold text-[var(--admin-text)] sm:truncate">{customer.name}</p>
              <p className="min-w-0 break-all font-mono text-xs text-[var(--admin-muted)] sm:truncate sm:break-normal">{customer.affiliateRefCode}</p>
            </div>
            <button onClick={() => void copyValue(affiliateLink, "Link de afiliado copiado")} className="admin-button-secondary w-full shrink-0 justify-center sm:w-auto">
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <MetricCard icon={DollarSign} label="Comissões Totais" value={<MetricValue>{money(totalCommissions)}</MetricValue>} trend="histórico estimado" tone="success" />
        <MetricCard icon={CalendarClock} label="Comissões Pendentes" value={<MetricValue>{money(pendingCommissions)}</MetricValue>} trend="a liberar" tone="warning" />
        <MetricCard icon={CheckCircle2} label="Comissões Liberadas" value={<MetricValue>{money(releasedCommissions)}</MetricValue>} trend="saldo disponível" tone="primary" />
        <MetricCard icon={Banknote} label="Saques Realizados" value={<MetricValue>{money(paidAmount)}</MetricValue>} trend={`${paidWithdrawalCount(stats.history)} baixa(s)`} tone="accent" />
        <MetricCard icon={Users} label="Clientes Indicados" value={dashboard?.metrics.referredCustomers ?? stats.referredCustomers} trend={`${dashboard?.metrics.conversions ?? stats.conversions} conversões`} />
        <MetricCard icon={TrendingUp} label="Conversão" value={`${conversionRate.toFixed(1)}%`} trend={`${dashboard?.metrics.clicks ?? stats.clicks} cliques`} tone="success" />
      </section>

      <AffiliateGamificationPanel summary={gamification} />
      <AffiliatePerformanceBonusPanel rewards={dashboard?.performanceRewards} />
      <AffiliateRewardsWalletPanel
        rewards={dashboard?.performanceRewards}
        consumingReward={consumingReward}
        onConsume={consumeReward}
      />

      {eligibility && (
        <section className={cn("admin-card border p-4 sm:p-5", eligibility.isEligibleThisMonth ? "border-[var(--admin-success)]/30" : "border-[var(--admin-warning)]/40")}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-black uppercase text-[var(--admin-muted)]">Status do Afiliado</p>
              <h2 className="break-words text-xl font-black text-[var(--admin-text)] sm:text-2xl">
                {eligibility.isEligibleThisMonth ? "Ativo para receber comissões" : "Pendente de ativação mensal"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
                {eligibility.isEligibleThisMonth
                  ? "Você já está ativo para receber comissões neste mês."
                  : `Faltam ${money(eligibility.remainingAmount)} em cotas para liberar suas comissões deste mês.`}
              </p>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:w-full lg:max-w-[560px]">
              <FinanceStat label="Mínimo mensal" value={money(eligibility.monthlyRequiredAmount)} />
              <FinanceStat label="Comprado este mês" value={money(eligibility.monthlyPurchasedAmount)} />
              <FinanceStat label="Falta para ativar" value={money(eligibility.remainingAmount)} />
            </div>
          </div>
          {!eligibility.isEligibleThisMonth && (
            <a href="/" className="admin-button-primary mt-4 inline-flex w-full justify-center sm:w-auto">
              Comprar cotas
            </a>
          )}
        </section>
      )}

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

        <section className="admin-card p-4 sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[var(--admin-text)]">Central de Links</h2>
              <p className="text-sm leading-6 text-[var(--admin-muted)]">Copie seu link, cupom ou QR Code para divulgar com segurança.</p>
            </div>
            <QrCode className="h-5 w-5 shrink-0 text-[var(--admin-primary)]" />
          </div>
          <div className="grid gap-3">
            <LinkRow label="Link principal" value={affiliateLink} onCopy={() => void copyValue(affiliateLink, "Link principal copiado")} />
            <LinkRow label="Link curto" value={shortLink} onCopy={() => void copyValue(shortLink, "Link curto copiado")} />
            <LinkRow label="Cupom personalizado" value={couponCode} onCopy={() => void copyValue(couponCode, "Cupom copiado")} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-[150px_1fr]">
            <div className="mx-auto grid aspect-square w-full max-w-[180px] place-items-center rounded-[8px] border border-[var(--admin-border)] bg-white p-3 sm:mx-0 sm:max-w-none">
              <QRCodeSVG value={affiliateLink} className="h-full w-full" bgColor="#ffffff" fgColor="#0f172a" level="M" />
            </div>
            <div className="min-w-0 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4">
              <p className="text-sm font-semibold text-[var(--admin-text)]">QR Code de divulgação</p>
              <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">Use em stories, grupos, bio ou atendimento. O código direciona para o link principal com sua indicação.</p>
              <button onClick={() => void copyValue(affiliateLink, "Link do QR copiado")} className="admin-button-secondary mt-4 w-full justify-center sm:w-auto">
                <Share2 className="h-4 w-4" />
                Compartilhar link
              </button>
            </div>
          </div>
        </section>
      </div>

      <MarketingCenterSection
        campaigns={campaignLinks}
        isLoading={isLoadingCampaignLinks}
        error={campaignLinksError}
        onCopy={copyValue}
      />

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="admin-card p-4 sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[var(--admin-text)]">Área Financeira</h2>
              <p className="text-sm leading-6 text-[var(--admin-muted)]">Acompanhe saldo, liberação e próximo pagamento.</p>
            </div>
            <Wallet className="h-5 w-5 shrink-0 text-[var(--admin-primary)]" />
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
              <input value={pixKey} onChange={event => setPixKey(event.target.value)} placeholder="CPF, telefone, e-mail ou aleatória" className="admin-input min-w-0" />
            </label>
            <button type="button" onClick={() => setUseBalance(!useBalance)} className="flex w-full items-center justify-between gap-3 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 text-left">
              <span className="min-w-0 text-sm font-semibold leading-5 text-[var(--admin-text)]">Usar saldo para comprar cotas</span>
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
                    className="admin-input min-w-0"
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
          <ResponsiveDataTable
            columns={["Cliente", "Plano", "Status", "Data de cadastro", "Último pagamento", "Comissão"]}
            rows={referredRows}
            empty="Quando alguém entrar pelo seu link, o cliente aparecerá aqui com status e comissão."
            minWidth="820px"
          />
          <ResponsiveDataTable
            columns={["Tipo", "Valor", "Data", "Status"]}
            rows={historyRows}
            empty="Suas comissões, liberações e saques aparecerão aqui."
            minWidth="640px"
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <RankingCard title="Top afiliados do mês" rows={rankingMonth} />
        <RankingCard title="Top afiliados do ano" rows={rankingYear} />
      </section>

      {settings?.affiliateInstructionVideo?.enabled && settings.affiliateInstructionVideo?.mediaUrl && (
        <section className="admin-card overflow-hidden p-4 sm:p-5">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase text-[var(--admin-primary)]">Treinamento do afiliado</p>
            <h2 className="mt-1 break-words text-xl font-bold text-[var(--admin-text)]">{settings.affiliateInstructionVideo.title || "Como divulgar seu link"}</h2>
            {settings.affiliateInstructionVideo.description && (
              <p className="mt-1 break-words text-sm leading-6 text-[var(--admin-muted)]">{settings.affiliateInstructionVideo.description}</p>
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

      <section className="admin-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto] md:items-center">
          <AffiliateAvatar customer={customer} large />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[var(--admin-text)]">Foto de divulgação</h2>
            <p className="text-sm leading-6 text-[var(--admin-muted)]">A mesma imagem aparece no perfil do cliente e deixa os materiais mais reconhecíveis.</p>
          </div>
          <label className="admin-button-secondary inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 sm:col-span-2 md:col-span-1 md:w-auto">
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

function AffiliatePerformanceBonusPanel({ rewards }: { rewards?: AffiliateDashboard["performanceRewards"] }) {
  if (!rewards?.enabled) return null;
  const rules = rewards.rules || [];
  const history = rewards.history || [];
  const balances = rewards.balances || { scratchcard: 0, wheel_spin: 0, super_quota: 0, bonus_number: 0, future_reward: 0 };
  const receivedTotal = Object.values(balances).reduce((sum, value) => sum + Number(value || 0), 0);
  return (
    <section className="admin-card overflow-hidden p-0">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4 sm:p-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-[var(--admin-primary)]">
          <Gift className="h-4 w-4" />
          Bônus de Performance
        </p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-2xl font-black text-[var(--admin-text)]">Premiações por metas</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
              Ganhe recompensas extras quando suas vendas indicadas atingirem as metas liberadas.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-[260px]">
            <FinanceStat label="Metas concluídas" value={String(rules.reduce((sum, rule) => sum + Number(rule.completed || 0), 0))} />
            <FinanceStat label="Recompensas recebidas" value={String(receivedTotal)} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-3">
          {rules.map(rule => (
            <div key={rule.id} className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4">
              <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-sm font-black text-[var(--admin-text)]">{rule.name}</p>
                  <p className="mt-1 text-xs text-[var(--admin-muted)]">Meta atual: {rule.goalLabel}</p>
                </div>
                <span className="rounded-full border border-[var(--admin-primary)]/25 bg-[var(--admin-primary)]/10 px-3 py-1 text-xs font-bold text-[var(--admin-primary)]">
                  {rule.completed > 0 ? `${rule.completed} concluída(s)` : "Em andamento"}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-black/30">
                <div className="h-full rounded-full bg-[var(--admin-primary)] transition-all" style={{ width: `${Math.max(0, Math.min(100, rule.percent || 0))}%` }} />
              </div>
              <div className="mt-3 flex flex-col gap-2 text-xs text-[var(--admin-muted)] sm:flex-row sm:items-center sm:justify-between">
                <span className="font-bold text-[var(--admin-text)]">{rule.progressLabel}</span>
                <span>Próxima recompensa: {rule.nextReward}</span>
              </div>
            </div>
          ))}
          {!rules.length && (
            <div className="rounded-[8px] border border-dashed border-[var(--admin-border)] p-5 text-sm text-[var(--admin-muted)]">
              Nenhuma meta de performance está ativa no momento.
            </div>
          )}
        </div>

        <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4">
          <div className="mb-4 grid grid-cols-2 gap-2">
            <FinanceStat label="Raspadinhas" value={String(balances.scratchcard || 0)} />
            <FinanceStat label="Giros" value={String(balances.wheel_spin || 0)} />
            <FinanceStat label="Super Cotas" value={String(balances.super_quota || 0)} />
            <FinanceStat label="Números bônus" value={String(balances.bonus_number || 0)} />
          </div>
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[var(--admin-warning)]" />
            <h3 className="text-lg font-black text-[var(--admin-text)]">Histórico de recompensas</h3>
          </div>
          <div className="grid gap-3">
            {history.slice(0, 8).map(item => (
              <div key={item.id} className="rounded-[8px] border border-[var(--admin-border)] bg-black/20 p-3">
                <p className="text-sm font-bold text-[var(--admin-text)]">{item.reward}</p>
                <p className="mt-1 text-xs text-[var(--admin-muted)]">{item.ruleName} • meta {item.milestone}</p>
                <p className="mt-1 text-[11px] text-[var(--admin-muted)]">{new Date(item.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
            ))}
            {!history.length && (
              <p className="rounded-[8px] border border-dashed border-[var(--admin-border)] p-4 text-sm text-[var(--admin-muted)]">
                Suas recompensas aparecerão aqui quando uma meta for concluída.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AffiliateRewardsWalletPanel({
  rewards,
  consumingReward,
  onConsume
}: {
  rewards?: AffiliateDashboard["performanceRewards"];
  consumingReward: string;
  onConsume: (rewardType: string, quantity?: number) => void;
}) {
  if (!rewards?.enabled) return null;
  const balances = rewards.balances || { scratchcard: 0, wheel_spin: 0, super_quota: 0, bonus_number: 0, future_reward: 0 };
  const items = [
    { type: "scratchcard", title: "Raspadinhas", balance: balances.scratchcard || 0, description: "Use para liberar uma raspadinha no módulo de premiação." },
    { type: "wheel_spin", title: "Roletas", balance: balances.wheel_spin || 0, description: "Use para liberar um giro na roleta premiada." },
    { type: "super_quota", title: "Super Cotas", balance: balances.super_quota || 0, description: "Use para registrar uma super cota para atendimento pela operação." },
    { type: "bonus_number", title: "Números bônus", balance: balances.bonus_number || 0, description: "Use para registrar um número bônus disponível." }
  ];
  const consumptions = rewards.consumptions || [];
  return (
    <section className="admin-card overflow-hidden p-0">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4 sm:p-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-[var(--admin-primary)]">
          <Gift className="h-4 w-4" />
          Minhas Recompensas
        </p>
        <h2 className="break-words text-2xl font-black text-[var(--admin-text)]">Use seus bônus disponíveis</h2>
      </div>
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-4">
        {items.map(item => (
          <article key={item.type} className="flex min-w-0 flex-col rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4">
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-black text-[var(--admin-text)]">{item.title}</p>
              <p className="mt-2 text-3xl font-black text-[var(--admin-primary)]">{item.balance}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--admin-muted)]">{item.description}</p>
            </div>
            <button
              disabled={item.balance <= 0 || Boolean(consumingReward)}
              onClick={() => onConsume(item.type, 1)}
              className="admin-button-primary mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              {consumingReward === item.type ? "Usando..." : "Usar agora"}
            </button>
          </article>
        ))}
      </div>
      <div className="border-t border-[var(--admin-border)] p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-[var(--admin-primary)]" />
          <h3 className="text-lg font-black text-[var(--admin-text)]">Histórico de Utilização</h3>
        </div>
        <div className="grid gap-3">
          {consumptions.slice(0, 10).map(item => (
            <div key={item.id} className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-3">
              <p className="text-sm font-bold text-[var(--admin-text)]">{item.label}</p>
              <p className="mt-1 text-xs text-[var(--admin-muted)]">{item.message || "Uso registrado."}</p>
              <p className="mt-1 text-[11px] text-[var(--admin-muted)]">{new Date(item.createdAt).toLocaleDateString("pt-BR")}</p>
            </div>
          ))}
          {!consumptions.length && (
            <p className="rounded-[8px] border border-dashed border-[var(--admin-border)] p-4 text-sm text-[var(--admin-muted)]">
              Seus usos de recompensa aparecerão aqui.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function AffiliateGamificationPanel({ summary }: { summary: AffiliateGamificationSummary }) {
  return (
    <section className="grid min-w-0 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <RankingOverviewCard summary={summary} />
        <LevelProgressCard summary={summary} />
        <MonthlyGoalCard summary={summary} />
        <RewardCard summary={summary} />
      </div>
      <AchievementsCard achievements={summary.achievements} />
    </section>
  );
}

function RankingOverviewCard({ summary }: { summary: AffiliateGamificationSummary }) {
  return (
    <section className="admin-card min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-[var(--admin-primary)]">Ranking de Afiliados</p>
          <h2 className="mt-2 break-words text-2xl font-black text-[var(--admin-text)]">{summary.positionLabel}</h2>
        </div>
        <Trophy className="h-8 w-8 shrink-0 text-[var(--admin-primary)]" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <GameStat label="Você vendeu" value={money(summary.monthlyRevenue)} />
        <GameStat label="Total indicado" value={`${summary.referredCustomers}`} />
        <GameStat label="Melhor afiliado" value={summary.bestAffiliate} muted={money(summary.bestRevenue)} />
        <GameStat label="Faltam para subir" value={summary.distanceToClimb > 0 ? money(summary.distanceToClimb) : "Você está no topo"} />
      </div>
      <div className="mt-4 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
        <p className="text-xs font-bold uppercase text-[var(--admin-muted)]">Próximo colocado</p>
        <p className="mt-1 min-w-0 break-words text-sm font-bold text-[var(--admin-text)]">{summary.nextAffiliate}</p>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">{summary.nextRevenue > 0 ? money(summary.nextRevenue) : "Continue vendendo para entrar na disputa."}</p>
      </div>
    </section>
  );
}

function LevelProgressCard({ summary }: { summary: AffiliateGamificationSummary }) {
  return (
    <section className="admin-card min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-[var(--admin-primary)]">Níveis</p>
          <h2 className={cn("mt-2 break-words text-2xl font-black", summary.currentLevel.tone)}>
            {summary.currentLevel.icon} {summary.currentLevel.name}
          </h2>
        </div>
        <Medal className="h-8 w-8 shrink-0 text-[var(--admin-primary)]" />
      </div>
      <div className="mt-5 grid gap-2">
        {affiliateLevels.map(level => (
          <div key={level.name} className="flex min-w-0 items-center justify-between gap-3 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2">
            <span className={cn("min-w-0 break-words text-sm font-bold", level.tone)}>{level.icon} {level.name}</span>
            <span className="shrink-0 text-sm font-semibold text-[var(--admin-muted)]">{money(level.threshold)}</span>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <p className="min-w-0 break-words text-sm font-bold text-[var(--admin-text)]">
            Próximo nível: {summary.nextLevel ? summary.nextLevel.name : "nível máximo"}
          </p>
          <span className="shrink-0 text-sm font-bold text-[var(--admin-primary)]">{summary.levelProgress.toFixed(0)}%</span>
        </div>
        <ProgressBar value={summary.levelProgress} className="mt-3" />
        <p className="mt-3 text-sm leading-6 text-[var(--admin-muted)]">
          {summary.nextLevel ? `Faltam ${money(Math.max(0, summary.nextLevel.threshold - summary.revenue))} para atingir ${summary.nextLevel.name}.` : "Você alcançou o maior nível comercial."}
        </p>
      </div>
    </section>
  );
}

function MonthlyGoalCard({ summary }: { summary: AffiliateGamificationSummary }) {
  return (
    <section className="admin-card min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-[var(--admin-primary)]">Meta do mês</p>
          <h2 className="mt-2 break-words text-2xl font-black text-[var(--admin-text)]">{money(summary.monthlyGoal)}</h2>
        </div>
        <TrendingUp className="h-8 w-8 shrink-0 text-[var(--admin-primary)]" />
      </div>
      <div className="mt-5 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <p className="text-xs font-bold uppercase text-[var(--admin-muted)]">Você possui</p>
        <p className="mt-2 break-words text-2xl font-black text-[var(--admin-text)]">{money(summary.monthlyRevenue)}</p>
        <p className="mt-1 text-sm font-bold text-[var(--admin-primary)]">{summary.monthlyProgress.toFixed(0)}%</p>
        <ProgressBar value={summary.monthlyProgress} className="mt-3" animated />
      </div>
    </section>
  );
}

function AchievementsCard({ achievements }: { achievements: AffiliateGamificationSummary["achievements"] }) {
  return (
    <section className="admin-card min-w-0 p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-[var(--admin-primary)]">Conquistas</p>
          <h2 className="mt-2 break-words text-2xl font-black text-[var(--admin-text)]">Badges premium</h2>
        </div>
        <Sparkles className="h-8 w-8 shrink-0 text-[var(--admin-primary)]" />
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {achievements.map(item => (
          <div
            key={item.label}
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-[8px] border p-3",
              item.unlocked ? "border-[var(--admin-success)]/35 bg-[var(--admin-success)]/10" : "border-[var(--admin-border)] bg-[var(--admin-surface)] opacity-70"
            )}
          >
            <CheckCircle2 className={cn("h-5 w-5 shrink-0", item.unlocked ? "text-[var(--admin-success)]" : "text-[var(--admin-muted)]")} />
            <span className="min-w-0 break-words text-sm font-bold text-[var(--admin-text)]">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RewardCard({ summary }: { summary: AffiliateGamificationSummary }) {
  return (
    <section className="admin-card min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-[var(--admin-primary)]">Próxima recompensa</p>
          <h2 className="mt-2 break-words text-xl font-black text-[var(--admin-text)]">{summary.rewardText}</h2>
        </div>
        <Gift className="h-8 w-8 shrink-0 text-[var(--admin-primary)]" />
      </div>
      <div className="mt-5 rounded-[8px] border border-[var(--admin-primary)]/25 bg-[var(--admin-primary)]/10 p-4">
        <p className="text-xs font-bold uppercase text-[var(--admin-primary)]">Benefício</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--admin-text)]">Maior destaque no ranking.</p>
      </div>
    </section>
  );
}

function GameStat({ label, value, muted }: { label: string; value: React.ReactNode; muted?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
      <p className="text-xs font-bold uppercase text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 min-w-0 break-words text-lg font-black leading-tight text-[var(--admin-text)]">{value}</p>
      {muted ? <p className="mt-1 min-w-0 break-words text-xs font-semibold text-[var(--admin-muted)]">{muted}</p> : null}
    </div>
  );
}

function ProgressBar({ value, animated = false, className = "" }: { value: number; animated?: boolean; className?: string }) {
  return (
    <div className={cn("h-3 overflow-hidden rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)]", className)}>
      <div
        className={cn("h-full rounded-full bg-[var(--admin-primary)] transition-all duration-700", animated && "animate-pulse")}
        style={{ width: `${clamp(value, 0, 100)}%` }}
      />
    </div>
  );
}

function MarketingCenterSection({
  campaigns,
  isLoading,
  error,
  onCopy
}: {
  campaigns: AffiliateCampaignLink[];
  isLoading: boolean;
  error: string;
  onCopy: (value: string, message: string) => Promise<void>;
}) {
  return (
    <section className="admin-card p-4 sm:p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-[var(--admin-primary)]">Material pronto para divulgar</p>
          <h2 className="mt-1 flex items-center gap-2 break-words text-xl font-black text-[var(--admin-text)]">
            <Megaphone className="h-5 w-5 shrink-0 text-[var(--admin-primary)]" />
            Central de Marketing
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">Copie links e textos comerciais prontos para cada campanha ativa com sua indicação aplicada.</p>
        </div>
        <div className="w-full rounded-[8px] border border-[var(--admin-primary)]/25 bg-[var(--admin-primary)]/10 px-4 py-3 text-sm font-bold text-[var(--admin-primary)] sm:w-auto">
          {isLoading ? "Preparando materiais..." : `${campaigns.length} ${campaigns.length === 1 ? "material pronto para divulgar" : "materiais prontos para divulgar"}`}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-sm font-semibold text-[var(--admin-muted)]">
            Carregando seus materiais de divulgação...
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="min-h-[360px] animate-pulse rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)]" />
          ))}
          </div>
        </div>
      ) : error ? (
        <div className="rounded-[8px] border border-[var(--admin-warning)]/35 bg-[var(--admin-warning)]/10 p-4 text-sm font-semibold leading-6 text-[var(--admin-warning)]">
          {error}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-[var(--admin-muted)]" />
          <p className="text-sm font-semibold leading-6 text-[var(--admin-text)]">Nenhum material de divulgação disponível no momento.</p>
          <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">Quando uma campanha ativa estiver disponível, os textos e links aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map(campaign => (
            <MarketingCampaignCard key={`${campaign.type}-${campaign.publicId}-${campaign.affiliateUrl}`} campaign={campaign} onCopy={onCopy} />
          ))}
        </div>
      )}
    </section>
  );
}

type MarketingCampaignCardProps = {
  campaign: AffiliateCampaignLink;
  onCopy: (value: string, message: string) => Promise<void>;
  key?: React.Key;
};

function MarketingCampaignCard({ campaign, onCopy }: MarketingCampaignCardProps) {
  const texts = buildCampaignMarketingTexts(campaign);

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)]">
      {campaign.imageUrl ? (
        <div className="aspect-[16/8] min-w-0 overflow-hidden bg-[var(--admin-surface)]">
          <img src={campaign.imageUrl} alt={campaign.name} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="grid aspect-[16/8] place-items-center bg-[var(--admin-surface)]">
          <div className="grid h-14 w-14 place-items-center rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] text-[var(--admin-primary)]">
            <Megaphone className="h-7 w-7" />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase text-[var(--admin-primary)]">{campaign.type}</p>
            <h3 className="mt-1 break-words text-base font-black leading-tight text-[var(--admin-text)]">{campaign.name}</h3>
          </div>
          <span className="shrink-0 rounded-full border border-[var(--admin-success)]/30 bg-[var(--admin-success)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--admin-success)]">
            {campaign.status}
          </span>
        </div>
        {campaign.commissionStatusLabel && (
          <div className={cn(
            "mt-3 rounded-[8px] border px-3 py-2 text-xs font-bold",
            campaign.commissionEnabled
              ? "border-[var(--admin-success)]/30 bg-[var(--admin-success)]/10 text-[var(--admin-success)]"
              : "border-[var(--admin-warning)]/35 bg-[var(--admin-warning)]/10 text-[var(--admin-warning)]"
          )}>
            {campaign.commissionStatusLabel}
          </div>
        )}
        <div className="mt-4 min-w-0 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
          <p className="text-[11px] font-bold uppercase text-[var(--admin-muted)]">Link da campanha</p>
          <p className="mt-1 min-w-0 break-all font-mono text-xs leading-5 text-[var(--admin-text)] sm:line-clamp-2">
            {campaign.affiliateUrl}
          </p>
        </div>
        <div className="mt-3 grid gap-3">
          <MarketingTextPreview label="Texto pronto para WhatsApp" text={texts.whatsapp} />
          <MarketingTextPreview label="Texto pronto para Instagram" text={texts.instagram} />
          <MarketingTextPreview label="Texto curto para Status" text={texts.status} />
          <MarketingTextPreview label="Texto de chamada para Facebook" text={texts.facebook} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button onClick={() => void onCopy(campaign.affiliateUrl, "Link da campanha copiado")} className="admin-button-primary min-w-0 justify-center py-3">
            <Copy className="h-4 w-4" />
            Copiar link
          </button>
          <button onClick={() => void onCopy(texts.whatsapp, "Texto WhatsApp copiado")} className="admin-button-secondary min-w-0 justify-center py-3">
            <Send className="h-4 w-4" />
            Copiar texto WhatsApp
          </button>
          <button onClick={() => void onCopy(texts.instagram, "Legenda copiada")} className="admin-button-secondary min-w-0 justify-center py-3">
            <Copy className="h-4 w-4" />
            Copiar legenda
          </button>
          <a href={campaign.affiliateUrl} target="_blank" rel="noreferrer" className="admin-button-secondary min-w-0 justify-center py-3">
            <ExternalLink className="h-4 w-4" />
            Abrir campanha
          </a>
        </div>
        <button onClick={() => void onCopy(texts.whatsapp, "Tudo pronto para WhatsApp copiado")} className="admin-button-primary mt-2 w-full min-w-0 justify-center py-3">
          <Share2 className="h-4 w-4" />
          Copiar tudo para WhatsApp
        </button>
      </div>
    </article>
  );
}

function MarketingTextPreview({ label, text }: { label: string; text: string }) {
  return (
    <div className="min-w-0 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
      <p className="text-[11px] font-bold uppercase text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 line-clamp-3 min-w-0 whitespace-pre-line break-words text-xs leading-5 text-[var(--admin-muted)]">{text}</p>
    </div>
  );
}

function buildCampaignMarketingTexts(campaign: AffiliateCampaignLink) {
  const name = campaign.name || "campanha";
  const affiliateUrl = campaign.affiliateUrl;
  const whatsapp = campaign.whatsappText || `🚀 Olha essa oportunidade!

Participe agora da campanha: ${name}

Você concorre a prêmios incríveis com segurança e praticidade.

👉 Acesse pelo meu link:
${affiliateUrl}

Boa sorte! 🍀`;

  return {
    whatsapp,
    instagram: `Participe agora da campanha ${name} e concorra a prêmios incríveis com segurança e praticidade.\n\nAcesse pelo meu link: ${affiliateUrl}\n\n#sorteio #premios #campanha`,
    status: `Campanha ${name} no ar! Entre pelo meu link: ${affiliateUrl}`,
    facebook: `Olha essa oportunidade: a campanha ${name} já está ativa. Participe com segurança pelo meu link oficial: ${affiliateUrl}`
  };
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

function MetricValue({ children }: { children: React.ReactNode }) {
  return (
    <span className="block min-w-0 max-w-full break-words text-[clamp(1.15rem,5vw,1.5rem)] leading-tight sm:text-2xl">
      {children}
    </span>
  );
}

function ResponsiveDataTable({
  columns,
  rows,
  empty,
  minWidth
}: {
  columns: string[];
  rows: React.ReactNode[][];
  empty: string;
  minWidth: string;
}) {
  return (
    <div className="min-w-0">
      <div className="hidden min-w-0 md:block">
        <AdminDataTable columns={columns} rows={rows} empty={empty} minWidth={minWidth} />
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-center">
            <p className="text-sm font-semibold leading-6 text-[var(--admin-text)]">{empty}</p>
          </div>
        ) : (
          rows.map((row, rowIndex) => (
            <article key={rowIndex} className="min-w-0 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <div className="grid gap-3">
                {columns.map((column, columnIndex) => (
                  <div key={`${column}-${columnIndex}`} className="min-w-0 border-b border-[var(--admin-border)] pb-2 last:border-b-0 last:pb-0">
                    <p className="text-[11px] font-bold uppercase text-[var(--admin-muted)]">{column}</p>
                    <div className="mt-1 min-w-0 break-words text-sm leading-6 text-[var(--admin-text)]">
                      {row[columnIndex] ?? "-"}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function LinkRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="grid min-w-0 gap-2 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-3 sm:grid-cols-[130px_1fr_auto] sm:items-center">
      <span className="min-w-0 text-xs font-bold uppercase text-[var(--admin-muted)]">{label}</span>
      <span className="min-w-0 break-all font-mono text-sm leading-5 text-[var(--admin-text)] sm:truncate sm:break-normal">{value}</span>
      <button onClick={onCopy} className="admin-button-secondary w-full justify-center py-2 text-xs sm:w-auto">
        <Copy className="h-4 w-4" />
        Copiar
      </button>
    </div>
  );
}

function FinanceStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4">
      <p className="min-w-0 break-words text-xs font-bold uppercase text-[var(--admin-muted)]">{label}</p>
      <p className="mt-2 min-w-0 break-words text-lg font-black leading-tight text-[var(--admin-text)] sm:text-xl">{value}</p>
    </div>
  );
}

function RankingCard({ title, rows }: { title: string; rows: React.ReactNode[][] }) {
  return (
    <section className="admin-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="min-w-0 break-words text-lg font-bold text-[var(--admin-text)]">{title}</h2>
        <Trophy className="h-5 w-5 shrink-0 text-[var(--admin-primary)]" />
      </div>
      <ResponsiveDataTable
        columns={["Posição", "Afiliado", "Indicados", "Vendido", "Conversão"]}
        rows={rows}
        empty="O ranking aparecerá quando houver desempenho suficiente para comparar afiliados."
        minWidth="640px"
      />
    </section>
  );
}

function buildAffiliateGamification({
  affiliateName,
  revenue,
  referredCustomers,
  conversions,
  ranking
}: {
  affiliateName: string;
  revenue: number;
  referredCustomers: number;
  conversions: number;
  ranking: AffiliateRankingRow[];
}): AffiliateGamificationSummary {
  const maskedName = maskDisplayName(affiliateName);
  const ownRank = ranking.find(item => item.affiliate === maskedName);
  const monthlyRevenue = Number(ownRank?.revenue ?? revenue ?? 0);
  const currentIndex = affiliateLevels.reduce((selected, level, index) => monthlyRevenue >= level.threshold ? index : selected, 0);
  const currentLevel = affiliateLevels[currentIndex];
  const nextLevel = affiliateLevels[currentIndex + 1];
  const previousThreshold = currentLevel.threshold;
  const nextThreshold = nextLevel?.threshold ?? currentLevel.threshold;
  const levelProgress = nextLevel ? ((monthlyRevenue - previousThreshold) / Math.max(1, nextThreshold - previousThreshold)) * 100 : 100;
  const best = ranking[0];
  const nextPlaced = ownRank && ownRank.position > 1
    ? ranking.find(item => item.position === ownRank.position - 1)
    : ownRank?.position === 1
      ? ownRank
      : ranking[ranking.length - 1];
  const distanceToClimb = nextPlaced && (!ownRank || ownRank.position > 1)
    ? Math.max(0, Number(nextPlaced.revenue || 0) - monthlyRevenue)
    : 0;
  const positionLabel = ownRank ? `#${ownRank.position} colocado` : monthlyRevenue > 0 ? "Fora do top 10" : "Aguardando vendas";
  const topPosition = ownRank?.position ?? 99;

  return {
    positionLabel,
    revenue: monthlyRevenue,
    monthlyRevenue,
    referredCustomers,
    conversions,
    bestAffiliate: best?.affiliate || "Ranking em formação",
    bestRevenue: Number(best?.revenue || 0),
    nextAffiliate: ownRank?.position === 1 ? "Você lidera o ranking" : nextPlaced?.affiliate || "Próximo colocado em formação",
    nextRevenue: ownRank?.position === 1 ? monthlyRevenue : Number(nextPlaced?.revenue || 0),
    distanceToClimb,
    currentLevel,
    nextLevel,
    levelProgress: clamp(levelProgress, 0, 100),
    monthlyGoal: monthlySalesGoal,
    monthlyProgress: clamp((monthlyRevenue / monthlySalesGoal) * 100, 0, 100),
    rewardText: nextLevel ? `Faltam ${money(Math.max(0, nextLevel.threshold - monthlyRevenue))} para atingir ${nextLevel.name}.` : "Você atingiu Diamante.",
    achievements: [
      { label: "Primeira venda", unlocked: conversions >= 1 },
      { label: "10 vendas", unlocked: conversions >= 10 },
      { label: "50 vendas", unlocked: conversions >= 50 },
      { label: "100 vendas", unlocked: conversions >= 100 },
      { label: "R$ 1.000 vendidos", unlocked: monthlyRevenue >= 1000 },
      { label: "R$ 10.000 vendidos", unlocked: monthlyRevenue >= 10000 },
      { label: "Top 10", unlocked: topPosition <= 10 },
      { label: "Top 3", unlocked: topPosition <= 3 },
      { label: "Top 1", unlocked: topPosition === 1 }
    ]
  };
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
      status: item.status === "released" ? "Liberado" : item.status === "pending" ? "Pendente de ativação" : item.status,
      tone: item.status === "pending" ? "text-[var(--admin-warning)]" : "text-[var(--admin-muted)]"
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
    { name, customers: stats.referredCustomers, revenue: stats.revenue, conversion: stats.clicks > 0 ? (stats.conversions / stats.clicks) * 100 : stats.conversions > 0 ? 100 : 0 },
    { name: "Afiliado Prime", customers: Math.max(stats.referredCustomers + 2, 8), revenue: Math.max(stats.revenue * 1.35, 4200) * multiplier, conversion: 18.5 },
    { name: "Afiliado Elite", customers: Math.max(stats.referredCustomers + 1, 5), revenue: Math.max(stats.revenue * 1.12, 2800) * multiplier, conversion: 14.2 }
  ].sort((a, b) => b.revenue - a.revenue);

  return base.map((item, index) => [
    `#${index + 1}`,
    item.name,
    item.customers,
    money(item.revenue),
    `${item.conversion.toFixed(1)}%`
  ]);
}

function buildRankingRowsFromDashboard(rows: AffiliateDashboard["ranking"]["month"]) {
  return rows.map(item => [
    `#${item.position}`,
    item.affiliate,
    item.customers,
    money(item.revenue),
    <span key={item.position} className="text-[var(--admin-success)]">{item.conversion.toFixed(1)}%</span>
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

function maskDisplayName(name?: string) {
  const clean = String(name || "Cliente").trim().replace(/\s+/g, " ");
  const parts = clean.split(" ").filter(Boolean);
  if (!parts.length) return "Cliente";
  const first = parts[0];
  const safeFirst = first.length <= 2 ? `${first[0] || "C"}***` : `${first.slice(0, 2)}***`;
  const second = parts[1] ? ` ${parts[1][0]}***` : "";
  return `${safeFirst}${second}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function money(value: number) {
  return `R$ ${Number(value || 0).toFixed(2)}`;
}
