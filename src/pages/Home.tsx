import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bell, CircleHelp, ClipboardList, Clock3, Crown, ShieldCheck, Trophy } from "lucide-react";
import { useRaffles, useGlobalSettings } from "../hooks/useRaffles";
import { PremiumButton, PremiumEmptyState, PremiumErrorState, PremiumPageLayout } from "../components/premium/PremiumUI";
import { markPageLoaded, startMetric } from "../lib/performanceMetrics";
import type { Raffle } from "../types";

const homeTimeSlots = ["Todos", "12h", "15h", "18h", "21h"];
const fazendinhaSlots = [
  { hour: "12h", emoji: "🐷", available: 12, time: "02:15:30" },
  { hour: "15h", emoji: "🐮", available: 8, time: "00:42:10", active: true },
  { hour: "18h", emoji: "🐔", available: 15, time: "03:42:10" },
  { hour: "21h", emoji: "🐴", available: 10, time: "06:42:10" }
];
const dezenaSlots = [
  { hour: "12h", available: 240, time: "02:15:30" },
  { hour: "15h", available: 180, time: "00:42:10", active: true },
  { hour: "19h", available: 200, time: "04:42:10" },
  { hour: "21h", available: 150, time: "06:42:10" }
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
    if (this.state.error) return <PublicHomeFallback mode="error" onRetry={this.props.onRetry} />;
    return this.props.children;
  }
}

function PublicHomeFallback({ mode, onRetry }: { mode: "error" | "empty"; onRetry?: () => void }) {
  const isError = mode === "error";
  return (
    <PremiumPageLayout className="w-full pb-24">
      <div className="mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-4xl items-center px-4 py-16">
        <div className="w-full rounded-[2rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-2xl shadow-black/30 sm:p-10">
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
    title: safeText(rawRaffle.title, "Honda Bros 160 2025"),
    description: safeText(rawRaffle.description, "Campanha ativa com cotas disponíveis."),
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

function splitHeroTitle(title: string) {
  const clean = safeText(title, "Honda Bros 160 2025");
  const parts = clean.split(/\s+/);
  if (parts.length <= 2) return [clean, ""];
  const midpoint = Math.ceil(parts.length / 2);
  return [parts.slice(0, midpoint).join(" "), parts.slice(midpoint).join(" ")];
}

function RifaProLogo() {
  return (
    <Link to="/" className="rp-home-logo" aria-label="Rifa Pro">
      <span className="rp-home-logo-mark" aria-hidden="true" />
      <span className="rp-home-logo-text">RIFA<span>PRO</span></span>
    </Link>
  );
}

function HomeContent() {
  const { data: rawRaffles, isLoading: loadingRaffles, isError: rafflesError, refetch: refetchRaffles } = useRaffles();
  const { isLoading: loadingSettings } = useGlobalSettings();
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

  if (loading) return <RifaProLoading />;

  if (rafflesError) {
    logPublicHome("render_error", { reason: "raffles_api_failed" });
    return <PublicHomeFallback mode="error" onRetry={() => void refetchRaffles()} />;
  }

  if (!featuredRaffle) return <PublicHomeFallback mode="empty" onRetry={() => void refetchRaffles()} />;

  return (
    <PremiumPageLayout className="rp-home-page">
      <main className="rp-home-phone" aria-label="Home Rifa Pro">
        <Header />
        <Hero raffle={featuredRaffle} />
        <ShortcutRow />
        <TodaySection />
        <FazendinhaSection />
        <DezenaSection />
        <SpecialRafflesSection raffles={activeRaffles} />
        <InviteBanner />
      </main>
    </PremiumPageLayout>
  );
}

function RifaProLoading() {
  return (
    <PremiumPageLayout className="rp-home-page">
      <main className="rp-home-phone">
        <div className="rp-home-skeleton rp-home-skeleton-top" />
        <div className="rp-home-skeleton rp-home-skeleton-hero" />
        <div className="rp-home-skeleton rp-home-skeleton-row" />
        <div className="rp-home-skeleton rp-home-skeleton-grid" />
      </main>
    </PremiumPageLayout>
  );
}

function Header() {
  return (
    <header className="rp-home-header">
      <RifaProLogo />
      <div className="rp-home-header-actions">
        <Link to="/minhas-cotas" className="rp-home-credit">
          <span className="rp-home-credit-icon"><Crown /></span>
          <span><strong>R$ 245,00</strong><small>Créditos</small></span>
        </Link>
        <Link to="/mensagens" className="rp-home-bell" aria-label="Notificações">
          <Bell />
          <span>2</span>
        </Link>
      </div>
    </header>
  );
}

function Hero({ raffle }: { raffle: Raffle }) {
  const progress = safeProgress(raffle);
  const [lineOne, lineTwo] = splitHeroTitle(raffle.title);
  const remaining = Math.max(0, Number(raffle.totalTickets || 0) - Number(raffle.soldTickets || 0));
  const mediaUrl = raffle.mediaUrl || raffle.image;

  return (
    <section className="rp-home-hero home-featured-raffle-block">
      <Link to={`/raffle/${raffle.id}`} className="rp-home-hero-media">
        {mediaUrl ? (
          <img src={mediaUrl} alt={raffle.title} loading="eager" />
        ) : (
          <div className="rp-home-media-fallback"><Trophy /></div>
        )}
      </Link>
      <div className="rp-home-hero-copy">
        <p>Próximo sorteio</p>
        <h1>{lineOne}{lineTwo && <><br />{lineTwo}</>}</h1>
        <span className="rp-home-draw-time"><Clock3 /> Sorteio hoje às {getDrawHour(raffle.drawDate)}</span>
        <div className="rp-home-progress">
          <span style={{ width: `${progress}%` }} />
          <strong>{progress.toFixed(0)}%</strong>
        </div>
        <small>{remaining.toLocaleString("pt-BR")} / {Number(raffle.totalTickets || 0).toLocaleString("pt-BR")} cotas</small>
        <Link to={`/raffle/${raffle.id}`} className="rp-home-primary">Participar agora</Link>
      </div>
    </section>
  );
}

function ShortcutRow() {
  const items = [
    { label: "Como Funciona", sub: "Veja o passo a passo", icon: ShieldCheck, href: "/transparencia" },
    { label: "Resultados", sub: "Confira ganhadores", icon: Trophy, href: "/#ganhadores" },
    { label: "Regras", sub: "Regulamento", icon: ClipboardList, href: "/transparencia" },
    { label: "Suporte", sub: "Fale conosco", icon: CircleHelp, href: "/mensagens" }
  ];
  return (
    <section className="rp-home-shortcuts">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <Link to={item.href} key={item.label} className="rp-home-shortcut">
            <span><Icon /></span>
            <strong>{item.label}</strong>
            <small>{item.sub}</small>
          </Link>
        );
      })}
    </section>
  );
}

function TodaySection() {
  return (
    <section className="rp-home-today" data-premium-section="modalidades">
      <SectionHeader title="Sorteios de hoje" href="/#sorteios" />
      <div className="rp-home-filters">
        {homeTimeSlots.map(slot => (
          <button key={slot} type="button" className={slot === "Todos" ? "is-active" : undefined}>{slot}</button>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({ title, subtitle, icon, href }: { title: string; subtitle?: string; icon?: string; href: string }) {
  return (
    <header className="rp-home-section-head">
      <div>
        {icon && <span className="rp-home-section-icon">{icon}</span>}
        <span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </span>
      </div>
      <Link to={href}>Ver todos</Link>
    </header>
  );
}

function FazendinhaSection() {
  return (
    <section className="rp-home-band" data-premium-section="fazendinha">
      <SectionHeader title="Fazendinha" subtitle="Escolha seu bichinho e boa sorte!" icon="🐷" href="/fazendinha" />
      <div className="rp-home-animal-grid">
        {fazendinhaSlots.map(slot => (
          <Link to="/fazendinha" className={`rp-home-animal-card${slot.active ? " is-active" : ""}`} key={slot.hour}>
            <span className="rp-home-animal">{slot.emoji}</span>
            <strong>Fazendinha<br />{slot.hour}</strong>
            <em>{slot.available} disponíveis</em>
            <small>Encerra em</small>
            <b>{slot.time}</b>
            <span className="rp-home-card-cta">Participar</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function DezenaSection() {
  return (
    <section className="rp-home-band rp-home-purple-band">
      <SectionHeader title="Dezena Premiada" subtitle="Escolha sua dezena da sorte!" icon="🎯" href="/dezena" />
      <div className="rp-home-dezena-grid">
        {dezenaSlots.map(slot => (
          <Link to="/dezena" className={`rp-home-dezena-card${slot.active ? " is-active" : ""}`} key={slot.hour}>
            <strong>Dezena<br />{slot.hour}</strong>
            <b>{slot.available}</b>
            <em>Dezenas disponíveis</em>
            <small>Encerra em</small>
            <span>{slot.time}</span>
            <i>Escolher</i>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SpecialRafflesSection({ raffles }: { raffles: Raffle[] }) {
  return (
    <section className="rp-home-specials" id="ganhadores" data-premium-section="ganhadores" data-compat="WinnersGallery">
      <SectionHeader title="Rifas Especiais" subtitle="Grandes prêmios te esperam!" icon="🎁" href="/#sorteios" />
      <div className="rp-home-special-row">
        {raffles.slice(0, 4).map(raffle => (
          <Link to={`/raffle/${raffle.id}`} className="rp-home-special-card" key={raffle.id}>
            <span>
              {(raffle.mediaUrl || raffle.image) ? <img src={raffle.mediaUrl || raffle.image} alt={raffle.title} loading="lazy" /> : <Trophy />}
            </span>
            <strong>{raffle.title}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}

function InviteBanner() {
  return (
    <Link to="/afiliados" className="rp-home-invite">
      <span>🎁</span>
      <strong>Convide amigos e ganhe prêmios</strong>
      <small>Quanto mais amigos, mais chances de ganhar.</small>
    </Link>
  );
}
