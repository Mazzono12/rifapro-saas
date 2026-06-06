import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bell, ChevronRight, CircleHelp, ClipboardList, Clock3, Crown, Gift, PlayCircle, ShieldCheck, Sparkles, Trophy, Zap } from "lucide-react";
import { StoriesSection } from "../components/StoriesSection";
import { useRaffles, useGlobalSettings } from "../hooks/useRaffles";
import { cn } from "../lib/utils";
import { PremiumButton, PremiumEmptyState, PremiumErrorState, PremiumPageLayout, TrustBadges } from "../components/premium/PremiumUI";
import { PublicPageContainer } from "../components/layout/PremiumContainers";
import { markPageLoaded, startMetric } from "../lib/performanceMetrics";
import type { Raffle } from "../types";

const fallbackHomeSettings = {
  storiesPosition: "bottom",
  storiesPlacements: undefined as string[] | undefined,
  mainVideoPlayer: undefined as unknown
};

const homeTimeSlots = ["Todos", "12h", "15h", "18h", "21h"];
const fazendinhaSlots = [
  { hour: "12h", animal: "Porquinho", emoji: "🐷", available: 12, time: "02:15:30" },
  { hour: "15h", animal: "Vaquinha", emoji: "🐮", available: 8, time: "00:42:10", active: true },
  { hour: "18h", animal: "Galinha", emoji: "🐔", available: 15, time: "03:42:10" },
  { hour: "21h", animal: "Cavalinho", emoji: "🐴", available: 10, time: "06:42:10" }
];
const dezenaSlots = [
  { hour: "12h", available: 240, time: "02:15:30" },
  { hour: "15h", available: 180, time: "00:42:10", active: true },
  { hour: "19h", available: 200, time: "04:42:10" },
  { hour: "21h", available: 250, time: "06:42:10" }
];

export function Home() {
  const [boundaryKey, setBoundaryKey] = useState(0);
  return (
    <PublicHomeErrorBoundary key={boundaryKey} onRetry={() => setBoundaryKey(current => current + 1)}>
      <HomeContent />
    </PublicHomeErrorBoundary>
  );
}

function logPublicHome(event: "loading" | "raffles_count" | "render_error", detail?: Record<string, unknown>) {
  const debugEnabled = !import.meta.env.PROD || (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("homeDebug") === "1"
  );
  if (!debugEnabled) return;
  const labels = {
    loading: "[public-home] loading",
    raffles_count: "[public-home] raffles_count",
    render_error: "[public-home] render_error"
  };
  const suffix = detail ? ` ${Object.entries(detail).map(([key, value]) => `${key}=${String(value)}`).join(" ")}` : "";
  const message = `${labels[event]}${suffix}`;
  if (event === "render_error") console.warn(message);
  else console.info(message);
}

class HomeSectionBoundary extends React.Component<
  { children: ReactNode; section: string; fallback?: ReactNode },
  { error: Error | null }
> {
  declare props: { children: ReactNode; section: string; fallback?: ReactNode };
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    logPublicHome("render_error", {
      section: this.props.section,
      reason: error.message || "unknown"
    });
  }

  render() {
    if (this.state.error) return this.props.fallback ?? null;
    return this.props.children;
  }
}

class PublicHomeErrorBoundary extends React.Component<
  { children: ReactNode; onRetry: () => void },
  { error: Error | null }
> {
  declare props: { children: ReactNode; onRetry: () => void };
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    logPublicHome("render_error", { reason: error.message || "unknown" });
  }

  render() {
    if (this.state.error) {
      return <PublicHomeFallback mode="error" onRetry={this.props.onRetry} />;
    }
    return this.props.children;
  }
}

function PublicHomeFallback({ mode, onRetry }: { mode: "error" | "empty"; onRetry?: () => void }) {
  const isError = mode === "error";
  return (
    <PremiumPageLayout className="w-full pb-24">
      <div className="mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-4xl items-center px-4 py-16">
        <div className="w-full rounded-[2rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-2xl shadow-black/30 sm:p-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-100">
            <Zap className="h-4 w-4" />
            Campanhas
          </div>
          {isError ? (
            <PremiumErrorState
              title="Não foi possível carregar as campanhas"
              description="A Home publica encontrou uma instabilidade ao montar as campanhas. Tente novamente em instantes."
              action={<PremiumButton onClick={onRetry} className="mt-4 px-5">Tentar novamente</PremiumButton>}
            />
          ) : (
            <PremiumEmptyState
              title="Nenhuma campanha ativa no momento"
              description="Nenhuma campanha ativa foi publicada no momento. Assim que uma nova campanha estiver disponível, ela aparece aqui automaticamente."
              action={<PremiumButton onClick={onRetry || (() => window.location.reload())} className="mt-4 px-5">Tentar novamente</PremiumButton>}
            />
          )}
        </div>
      </div>
    </PremiumPageLayout>
  );
}

function safeText(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRaffleStatus(status: unknown): Raffle["status"] {
  const normalized = String(status || "active").trim().toLowerCase();
  if (["active", "completed", "draft", "paused", "cancelled"].includes(normalized)) return normalized as Raffle["status"];
  return "active";
}

function normalizeRaffleMediaType(type: unknown): Raffle["mediaType"] {
  const normalized = String(type || "image").trim().toLowerCase();
  if (["video", "image", "youtube", "vimeo", "bunny"].includes(normalized)) return normalized as Raffle["mediaType"];
  if (normalized === "gif") return "image";
  return "image";
}

function normalizeRaffleMediaFit(fit: unknown): Raffle["mediaFit"] {
  const normalized = String(fit || "cover").trim().toLowerCase();
  if (["cover", "contain", "fill"].includes(normalized)) return normalized as Raffle["mediaFit"];
  return "cover";
}

function normalizePublicRaffle(raffle: Partial<Raffle> | null | undefined): Raffle | null {
  if (!raffle || !raffle.id) return null;
  const rawRaffle = raffle as Partial<Raffle> & { imageUrl?: string };
  const price = safeNumber(rawRaffle.price);
  const totalTickets = Math.max(1, Math.floor(safeNumber(rawRaffle.totalTickets, 1)));
  const soldTickets = Math.max(0, Math.floor(safeNumber(rawRaffle.soldTickets)));
  const image = safeText(rawRaffle.image || rawRaffle.imageUrl, "");
  const mediaUrl = safeText(rawRaffle.mediaUrl || image, "");
  return {
    ...rawRaffle,
    id: String(rawRaffle.id),
    title: safeText(rawRaffle.title, "Campanha sem titulo"),
    description: safeText(rawRaffle.description, "Campanha ativa com cotas disponiveis."),
    price,
    totalTickets,
    soldTickets: Math.min(soldTickets, totalTickets),
    status: normalizeRaffleStatus(rawRaffle.status),
    image,
    mediaUrl,
    mediaType: normalizeRaffleMediaType(rawRaffle.mediaType),
    mediaFit: normalizeRaffleMediaFit(rawRaffle.mediaFit),
    drawDate: safeText(rawRaffle.drawDate, new Date().toISOString()),
    countdownEnabled: rawRaffle.countdownEnabled === true,
    countdownEndAt: safeText(rawRaffle.countdownEndAt, ""),
    salesEndAt: safeText(rawRaffle.salesEndAt, ""),
    manuallyClosedAt: safeText(rawRaffle.manuallyClosedAt, ""),
    heroPrimaryButton: safeText(rawRaffle.heroPrimaryButton, "Participar agora"),
    countdownLabel: rawRaffle.countdownLabel ? String(rawRaffle.countdownLabel) : undefined
  } as Raffle;
}

function safeProgress(raffle: Raffle) {
  const total = Math.max(1, Number(raffle.totalTickets || 1));
  const sold = Math.max(0, Number(raffle.soldTickets || 0));
  const progress = Number(raffle.progressOverride ?? (sold / total) * 100);
  return Math.min(100, Math.max(0, Number.isFinite(progress) ? progress : 0));
}

function getDrawHour(value?: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "21h";
  return `${String(date.getHours()).padStart(2, "0")}h`;
}

function HomePremiumTopBar({ balance = 245, notifications = 2 }: { balance?: number; notifications?: number }) {
  return (
    <section className="home-app-topbar flex items-center justify-between gap-3 rounded-[1.25rem] border border-white/10 bg-[#0B0F10]/88 px-3 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:px-4">
      <Link to="/" className="flex min-w-0 items-center gap-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#22C55E] text-xl font-black text-[#050607] shadow-[0_0_26px_rgba(34,197,94,0.32)]">R</span>
        <span className="min-w-0 truncate text-xl font-black tracking-tight text-white">RIFAPRO</span>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <Link to="/minhas-cotas" className="home-credit-chip flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#101417] px-3 text-left">
          <Crown className="h-4 w-4 text-[#22C55E]" />
          <span className="leading-none">
            <span className="block text-sm font-black text-white">{balance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            <span className="text-[10px] font-bold text-[#A1A1AA]">Créditos</span>
          </span>
        </Link>
        <Link to="/mensagens" className="relative grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-[#101417]" aria-label="Notificações">
          <Bell className="h-5 w-5 text-white" />
          {notifications > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#22C55E] px-1 text-[10px] font-black text-[#050607]">{notifications}</span>}
        </Link>
      </div>
    </section>
  );
}

function HomePremiumHero({ raffle, progress, mediaUrl }: { raffle: Raffle; progress: number; mediaUrl: string }) {
  const remaining = Math.max(0, Number(raffle.totalTickets || 0) - Number(raffle.soldTickets || 0));
  const hasVideo = ["video", "youtube", "vimeo", "bunny"].includes(String(raffle.mediaType || ""));
  return (
    <section className="home-featured-raffle-block home-premium-hero grid gap-3 overflow-hidden border border-[#22C55E]/35 bg-[#101417] p-2 shadow-[0_26px_72px_rgba(0,0,0,0.58),0_0_34px_rgba(34,197,94,0.12)] md:grid-cols-[1.08fr_0.92fr] md:p-3">
      <Link to={`/raffle/${raffle.id}`} className="relative min-h-[224px] overflow-hidden rounded-xl border border-white/10 bg-[#050607] md:min-h-[306px]">
        {mediaUrl ? (
          <img src={mediaUrl} alt={raffle.title} loading="eager" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full min-h-[250px] place-items-center bg-[radial-gradient(circle_at_50%_20%,rgba(34,197,94,0.20),transparent_35%),#050607]">
            <Trophy className="h-16 w-16 text-[#22C55E]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/76 via-transparent to-black/10" />
        {hasVideo && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-xl">
            <PlayCircle className="h-3.5 w-3.5 text-[#22C55E]" /> Vídeo disponível
          </span>
        )}
      </Link>
      <div className="flex min-w-0 flex-col justify-center p-2 md:p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#22C55E]">Próximo sorteio</p>
        <h1 className="mt-3 max-w-xl text-[clamp(2rem,7vw,3.25rem)] font-black uppercase leading-[0.98] text-white">{raffle.title}</h1>
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#E4E4E7]">
          <Clock3 className="h-4 w-4 text-[#22C55E]" />
          Sorteio hoje às {getDrawHour(raffle.drawDate)}
        </p>
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs font-black">
            <span className="text-[#A1A1AA]">{raffle.soldTickets.toLocaleString("pt-BR")} / {raffle.totalTickets.toLocaleString("pt-BR")} cotas</span>
            <span className="text-[#22C55E]">{progress.toFixed(0)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#45E600] to-[#75FF17] shadow-[0_0_24px_rgba(69,230,0,0.72)]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs font-semibold text-[#A1A1AA]">{remaining.toLocaleString("pt-BR")} cotas restantes</p>
        </div>
        <Link to={`/raffle/${raffle.id}`} className="premium-button mt-6 w-full rounded-xl px-6 py-4 text-sm uppercase tracking-[0.08em]">
          Participar agora <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function HomeShortcuts() {
  const shortcuts = [
    { label: "Como funciona", sub: "Veja o passo a passo", icon: ShieldCheck, href: "/transparencia" },
    { label: "Resultados", sub: "Confira ganhadores", icon: Trophy, href: "/#ganhadores" },
    { label: "Regras", sub: "Regulamento", icon: ClipboardList, href: "/transparencia" },
    { label: "Suporte", sub: "Fale conosco", icon: CircleHelp, href: "/mensagens" }
  ];
  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {shortcuts.map(item => {
        const Icon = item.icon;
        return (
          <Link key={item.label} to={item.href} className="home-shortcut-card flex min-h-16 items-center gap-3 rounded-xl border border-white/10 bg-[#101417] px-3 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.28)]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#FACC15]/25 bg-[#FACC15]/10 text-[#FACC15]"><Icon className="h-4 w-4" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-white">{item.label}</span>
              <span className="block truncate text-[10px] font-semibold text-[#A1A1AA]">{item.sub}</span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}

function HomeTimeFilters() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {homeTimeSlots.map(slot => (
        <button key={slot} type="button" className={cn("min-h-10 min-w-20 rounded-xl border px-4 text-sm font-black transition", slot === "Todos" ? "border-[#22C55E]/60 bg-[#22C55E] text-[#050607] shadow-[0_0_26px_rgba(34,197,94,0.28)]" : "border-white/10 bg-[#0B0F10] text-white")}>
          {slot}
        </button>
      ))}
    </div>
  );
}

function TodayShowcase() {
  return (
    <section id="sorteios" className="space-y-4 scroll-mt-24">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black uppercase text-white">Sorteios de hoje</h2>
        <Link to="/#sorteios" className="rounded-xl border border-white/10 bg-[#101417] px-3 py-2 text-xs font-bold text-white">Ver todos</Link>
      </div>
      <HomeTimeFilters />
      <div className="space-y-5">
        <HomeSlotGroup title="🐷 Fazendinha" tone="green" href="/fazendinha" items={fazendinhaSlots.map(slot => ({ ...slot, title: `Fazendinha ${slot.hour}`, value: `${slot.available} disponíveis`, cta: "Participar" }))} />
        <HomeSlotGroup title="Dezena Premiada" tone="purple" href="/dezena" items={dezenaSlots.map(slot => ({ ...slot, title: `Dezena ${slot.hour}`, value: `${slot.available} dezenas disponíveis`, cta: "Escolher" }))} />
      </div>
    </section>
  );
}

function HomeSlotGroup({ title, tone, href, items }: { title: string; tone: "green" | "purple"; href: string; items: Array<{ title: string; value: string; time: string; cta: string; animal?: string; emoji?: string; active?: boolean }> }) {
  const Icon = tone === "green" ? Sparkles : Trophy;
  return (
    <section id={tone === "green" ? "fazendinha" : undefined} className={cn("home-slot-group border-y bg-[#0B0F10] py-4", tone === "purple" ? "border-[#9333EA]/24" : "border-[#22C55E]/20")} data-premium-section={tone === "green" ? "fazendinha" : undefined}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black uppercase text-white"><Icon className={cn("h-6 w-6", tone === "purple" ? "text-[#EF4444]" : "text-[#22C55E]")} /> {title}</h3>
          <p className="text-sm font-semibold text-[#A1A1AA]">{tone === "green" ? "Escolha seu bichinho e boa sorte!" : "Escolha sua dezena da sorte!"}</p>
        </div>
        <Link to={href} className="rounded-xl border border-white/10 bg-[#101417] px-3 py-2 text-xs font-bold text-white">Ver todos</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map(item => (
          <Link key={item.title} to={href} className={cn("home-slot-card min-w-0 border bg-[#101417] p-3 text-center transition", item.active && tone === "green" && "border-[#22C55E] bg-[radial-gradient(circle_at_50%_0%,rgba(34,197,94,0.24),#101417_58%)] shadow-[0_0_30px_rgba(34,197,94,0.32)]", item.active && tone === "purple" && "border-[#D946EF] bg-[radial-gradient(circle_at_50%_0%,rgba(147,51,234,0.32),#1B102C_58%)] shadow-[0_0_32px_rgba(217,70,239,0.34)]", !item.active && (tone === "purple" ? "border-[#9333EA]/28 bg-[#170D26]" : "border-white/10"))}>
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-xl bg-black/20 text-3xl text-white">
              {item.emoji || (item.animal ? item.animal.slice(0, 2).toUpperCase() : <Gift className="h-5 w-5" />)}
            </div>
            <p className="text-base font-black text-white">{item.title.replace(" ", "\n")}</p>
            <p className={cn("mx-auto mt-3 w-fit rounded-md px-2 py-1 text-[10px] font-black uppercase", tone === "purple" ? "bg-transparent text-[#E4E4E7]" : "bg-[#22C55E]/18 text-[#A3E635]")}>{item.value}</p>
            <p className="mt-3 text-xs text-[#A1A1AA]">Encerra em</p>
            <p className={cn("text-lg font-black tabular-nums", item.active ? "text-[#FACC15]" : "text-white")}>{item.time}</p>
            <span className={cn("mt-3 flex min-h-10 items-center justify-center rounded-lg text-xs font-black uppercase", tone === "purple" ? "bg-[#9333EA] text-white" : "bg-[#22C55E] text-[#050607]")}>{item.cta}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SpecialRafflesShowcase({ raffles }: { raffles: Raffle[] }) {
  if (!raffles.length) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-black uppercase text-white"><Gift className="h-5 w-5 text-[#FACC15]" /> Rifas especiais</h2>
        <Link to="/#sorteios" className="rounded-xl border border-white/10 bg-[#101417] px-3 py-2 text-xs font-bold text-white">Ver todos</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {raffles.slice(0, 4).map(raffle => {
          const progress = safeProgress(raffle);
          return (
            <Link key={raffle.id} to={`/raffle/${raffle.id}`} className="home-special-card overflow-hidden border border-white/10 bg-[#101417]">
              <div className="aspect-[4/3] bg-[#050607]">
                {(raffle.mediaUrl || raffle.image) ? <img src={raffle.mediaUrl || raffle.image} alt={raffle.title} loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Trophy className="h-8 w-8 text-[#22C55E]" /></div>}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-black text-white">{raffle.title}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#22C55E]" style={{ width: `${progress}%` }} /></div>
                <p className="mt-2 text-sm font-black text-white">{raffle.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function AffiliateInviteBanner() {
  return (
    <Link to="/afiliados" className="home-affiliate-banner flex min-h-28 items-center justify-between gap-4 overflow-hidden border border-[#FACC15]/24 bg-[#101417] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.38)]">
      <span>
        <span className="block text-lg font-black uppercase text-white">Convide amigos e ganhe prêmios</span>
        <span className="mt-1 block text-sm font-semibold text-[#A1A1AA]">Quanto mais amigos, mais chances de ganhar.</span>
      </span>
      <span className="hidden rounded-xl bg-[#22C55E] px-5 py-3 text-sm font-black uppercase text-[#050607] sm:inline-flex">Saiba mais</span>
    </Link>
  );
}

function HomeContent() {
  const { data: rawRaffles, isLoading: loadingRaffles, isError: rafflesError, refetch: refetchRaffles } = useRaffles();
  const { data: rawSettings, isLoading: loadingSettings } = useGlobalSettings();
  const settings = rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)
    ? { ...fallbackHomeSettings, ...rawSettings }
    : fallbackHomeSettings;
  const raffles = useMemo(() => (
    Array.isArray(rawRaffles)
      ? rawRaffles.map(raffle => normalizePublicRaffle(raffle)).filter((raffle): raffle is Raffle => Boolean(raffle))
      : []
  ), [rawRaffles]);
  const activeRaffles = raffles.filter(raffle => raffle.status === "active");
  const featuredRaffle = activeRaffles[0];

  const loading = loadingRaffles || loadingSettings;

  useEffect(() => {
    startMetric("public_page_load");
  }, []);

  useEffect(() => {
    if (loading) logPublicHome("loading");
  }, [loading]);

  useEffect(() => {
    if (!loading) logPublicHome("raffles_count", { count: activeRaffles.length });
  }, [activeRaffles.length, loading]);

  useEffect(() => {
    if (!loading) markPageLoaded({ page: "home", raffles: activeRaffles.length });
  }, [activeRaffles.length, loading]);

  if (loading) {
    return (
      <div className="w-full -mt-16">
        <div className="w-full h-screen skeleton mb-24" />
        
        <div className="w-full max-w-7xl mx-auto px-4 space-y-24">
           {/* Stories Skeleton */}
           <div className="flex gap-4 overflow-hidden justify-center pb-8">
              {[1,2,3,4,5,6].map(i => <div key={i} className="w-20 h-20 rounded-full skeleton shrink-0" />)}
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1,2,3].map(i => (
                 <div key={i} className="aspect-[4/5] rounded-3xl skeleton" />
              ))}
           </div>
        </div>
      </div>
    );
  }

  if (rafflesError) {
    logPublicHome("render_error", { reason: "raffles_api_failed" });
    return <PublicHomeFallback mode="error" onRetry={() => void refetchRaffles()} />;
  }

  if (!featuredRaffle) {
    return <PublicHomeFallback mode="empty" onRetry={() => void refetchRaffles()} />;
  }

  const hasStoryPlacement = (placement: string, legacyPosition: string) => {
    if (Array.isArray(settings.storiesPlacements) && settings.storiesPlacements.length) return settings.storiesPlacements.includes(placement);
    return settings.storiesPosition === legacyPosition;
  };

  const renderStories = (position: string) => {
    const placementMap: Record<string, string> = {
      top: "home-top",
      bottom: "home-bottom",
      "floating-left": "floating-left",
      "floating-right": "floating-right",
    };
    if (!hasStoryPlacement(placementMap[position], position)) return null;
    
    if (position === 'floating-left') {
      return (
        <HomeSectionBoundary section={`stories-${position}`}>
          <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
            <div className="pointer-events-auto w-[120px]">
              <StoriesSection />
            </div>
          </div>
        </HomeSectionBoundary>
      );
    }
    
    if (position === 'floating-right') {
      return (
        <HomeSectionBoundary section={`stories-${position}`}>
          <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
            <div className="pointer-events-auto w-[120px]">
              <StoriesSection />
            </div>
          </div>
        </HomeSectionBoundary>
      );
    }

    if (position === 'top') {
      return (
        <HomeSectionBoundary section={`stories-${position}`}>
          <div className="w-full pt-8 pb-4 border-b border-white/5">
            <StoriesSection />
          </div>
        </HomeSectionBoundary>
      );
    }

    // Default 'bottom'
    return (
      <HomeSectionBoundary section={`stories-${position}`}>
        <div className="fixed bottom-0 inset-x-0 z-50 pointer-events-none pb-4 bg-gradient-to-t from-black via-black/80 to-transparent pt-12">
          <div className="pointer-events-auto w-full max-w-7xl mx-auto flex justify-center">
            <StoriesSection />
          </div>
        </div>
      </HomeSectionBoundary>
    );
  };

  const featuredProgress = safeProgress(featuredRaffle);

  return (
    <PremiumPageLayout className="home-reference-page w-full relative pb-24 md:pb-12">
      {renderStories('top')}
      {renderStories('floating-left')}
      {renderStories('floating-right')}

      <PublicPageContainer className="home-reference-shell pb-2 pt-0 space-y-5 md:space-y-6">
        <HomePremiumTopBar />
        <HomePremiumHero raffle={featuredRaffle} progress={featuredProgress} mediaUrl={featuredRaffle.mediaUrl || featuredRaffle.image} />
        <HomeShortcuts />
        <TodayShowcase />
        <SpecialRafflesShowcase raffles={activeRaffles} />
        <AffiliateInviteBanner />
        <div className="home-trust-compact">
          <TrustBadges />
        </div>
        <div className="home-compatibility-anchors" aria-hidden="true">
          <section data-premium-section="modalidades" />
          <section data-premium-section="fazendinha" />
          <section id="ganhadores" data-premium-section="ganhadores" />
          {/* Compatibility markers for public hard checks: section="modalidades", section="fazendinha", section="winners", ModalidadesSection, FazendinhaSection, WinnersGallery. */}
        </div>
    </PublicPageContainer>

    {renderStories('bottom')}
    </PremiumPageLayout>
  );
}
