import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bell, ChevronRight, Gift, Headphones, Home as HomeIcon, LockKeyhole, ShieldCheck, Ticket, Trophy, TrendingUp, UserRound } from "lucide-react";
import { useRaffles } from "../hooks/useRaffles";
import { PremiumButton, PremiumEmptyState, PremiumErrorState, PremiumPageLayout } from "../components/premium/PremiumUI";
import { markPageLoaded, startMetric } from "../lib/performanceMetrics";
import type { Raffle } from "../types";
import { StandardRaffleMediaBlock } from "../components/StandardRaffleMediaBlock";

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

function RifaProLogo() {
  return (
    <Link to="/" className="cfx-home-logo" aria-label="RifaPro">
      <span className="cfx-home-logo-text">Rifa<span>Pro</span></span>
    </Link>
  );
}

function HomeContent() {
  const { data: rawRaffles, isLoading: loadingRaffles, isError: rafflesError, refetch: refetchRaffles } = useRaffles();
  const [ranking, setRanking] = useState<Array<{ name: string; phone: string; tickets: number; amount: number }>>([]);
  const raffles = useMemo(() => (
    Array.isArray(rawRaffles)
      ? rawRaffles.map(raffle => normalizePublicRaffle(raffle)).filter((raffle): raffle is Raffle => Boolean(raffle))
      : []
  ), [rawRaffles]);
  const activeRaffles = raffles.filter(raffle => raffle.status === "active");
  const featuredRaffle = activeRaffles[0];
  const loading = loadingRaffles;

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

  useEffect(() => {
    if (!featuredRaffle?.id) return;
    fetch(`/api/raffles/${featuredRaffle.id}/ranking`)
      .then(res => res.ok ? res.json() : [])
      .then(payload => setRanking(Array.isArray(payload) ? payload : []))
      .catch(() => setRanking([]));
  }, [featuredRaffle?.id]);

  if (loading) return <RifaProLoading />;

  if (rafflesError) {
    logPublicHome("render_error", { reason: "raffles_api_failed" });
    return <PublicHomeFallback mode="error" onRetry={() => void refetchRaffles()} />;
  }

  if (!featuredRaffle) return <PublicHomeFallback mode="empty" onRetry={() => void refetchRaffles()} />;

  return (
    <PremiumPageLayout className="cfx-home-page">
      <main className="cfx-home-shell" aria-label="Home CIFHER Prime">
        <Header />
        <Hero raffle={featuredRaffle} ranking={ranking} />
        <TopBuyers ranking={ranking} />
        <HomeTrustRail />
        <HomeBottomNav />
      </main>
    </PremiumPageLayout>
  );
}

function RifaProLoading() {
  return (
    <PremiumPageLayout className="cfx-home-page">
      <main className="cfx-home-shell">
        <div className="cfx-skeleton cfx-skeleton-top" />
        <div className="cfx-skeleton cfx-skeleton-hero" />
      </main>
    </PremiumPageLayout>
  );
}

function Header() {
  return (
    <header className="cfx-home-header">
      <span className="cfx-device-time" aria-hidden="true">9:41</span>
      <RifaProLogo />
      <Link to="/meus-bilhetes" className="cfx-home-bell" aria-label="Notificações e bilhetes">
        <Bell />
        <span />
      </Link>
    </header>
  );
}

function Hero({ raffle, ranking }: { raffle: Raffle; ranking: Array<{ name: string; phone: string; tickets: number; amount: number }> }) {
  const progress = safeProgress(raffle);
  const remaining = Math.max(0, Number(raffle.totalTickets || 0) - Number(raffle.soldTickets || 0));
  const sold = Math.max(0, Number(raffle.soldTickets || 0));
  const total = Math.max(1, Number(raffle.totalTickets || 1));
  const mediaUrl = raffle.mediaUrl || raffle.image;
  const countdownTarget = raffle.salesEndAt || raffle.countdownEndAt || raffle.drawDate;
  const countdown = useHomeCountdown(countdownTarget);

  return (
    <section className="cfx-home-hero">
      <div className="cfx-home-title-lockup">
        <span>Ganhe uma</span>
        <h1>{raffle.title}</h1>
        <strong>ou prêmio no PIX</strong>
      </div>
      <div className="cfx-home-hero-media">
        <StandardRaffleMediaBlock
          mediaUrl={mediaUrl}
          mediaType={raffle.mediaType}
          title={raffle.title}
          href={`/raffle/${raffle.id}`}
          priority
          showDescriptionBelow={false}
          preferredFit={raffle.mediaFit === "contain" ? "contain" : raffle.mediaFit === "cover" ? "cover" : "auto"}
          aspectMode="auto"
          className="cfx-home-media-block"
        />
        <button type="button" className="cfx-home-play" aria-label="Reproduzir vídeo da campanha" />
        <div className="cfx-video-control" aria-hidden="true">
          <span />
          <small>0:00</small>
          <i><b /></i>
          <small>0:30</small>
        </div>
      </div>
      <div className="cfx-live-card">
        <p>Sorteio ao vivo em</p>
        <div className="cfx-countdown-grid">
          <CountdownUnit label="Dias" value={countdown.days} />
          <CountdownUnit label="Horas" value={countdown.hours} />
          <CountdownUnit label="Minutos" value={countdown.minutes} />
          <CountdownUnit label="Segundos" value={countdown.seconds} />
        </div>
        <div className="cfx-progress-meta">
          <span>{progress.toFixed(0)}% dos bilhetes vendidos</span>
          <span>{sold.toLocaleString("pt-BR")} / {total.toLocaleString("pt-BR")}</span>
        </div>
        <div className="cfx-home-progress"><span style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="cfx-home-hero-actions">
        <Link to={`/raffle/${raffle.id}`} className="cfx-home-primary">Participar agora <ChevronRight /></Link>
        <Link to="/minhas-cotas" className="cfx-home-secondary"><Ticket /> Meus bilhetes <ChevronRight /></Link>
      </div>
      <p className="cfx-home-remaining" aria-label="Cotas restantes">{remaining.toLocaleString("pt-BR")} cotas restantes</p>
      <span className="cfx-home-compat" aria-hidden="true">{ranking.length}</span>
    </section>
  );
}

function CountdownUnit({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <strong>{String(value).padStart(2, "0")}</strong>
      <small>{label}</small>
    </span>
  );
}

function TopBuyers({ ranking }: { ranking: Array<{ name: string; phone: string; tickets: number; amount: number }> }) {
  const buyers = ranking.slice(0, 3);

  return (
    <section className="cfx-top-buyers">
      <header>
        <strong><TrendingUp /> Top compradores</strong>
        <Link to="/ganhadores">Ver ranking <ChevronRight /></Link>
      </header>
      {buyers.length ? (
        <div>
          {buyers.map((buyer, index) => (
          <article key={`${buyer.phone}-${index}`}>
            <span>{maskBuyerName(buyer.name).slice(0, 1)}</span>
            <b>{maskBuyerName(buyer.name)}</b>
            <small>{Number(buyer.tickets || 0).toLocaleString("pt-BR")} bilhetes</small>
            <i>{index + 1}</i>
          </article>
          ))}
        </div>
      ) : (
        <p className="cfx-top-buyers-empty">Ranking em apuração com dados reais da campanha.</p>
      )}
    </section>
  );
}

function HomeTrustRail() {
  const seals = [
    { icon: <ShieldCheck />, title: "Pagamento 100% seguro" },
    { icon: <LockKeyhole />, title: "Seus dados protegidos" },
    { icon: <Ticket />, title: "Transparência e confiabilidade" },
    { icon: <Headphones />, title: "Suporte especializado" }
  ];

  return (
    <section className="cfx-home-trust-rail" aria-label="Selos de confiança">
      {seals.map(seal => (
        <span key={seal.title}>{seal.icon}<small>{seal.title}</small></span>
      ))}
    </section>
  );
}

function HomeBottomNav() {
  const items = [
    { label: "Início", to: "/", icon: <HomeIcon /> },
    { label: "Sorteios", to: "/", icon: <Gift /> },
    { label: "Resultados", to: "/ganhadores", icon: <Trophy /> },
    { label: "Promoções", to: "/", icon: <TrendingUp /> },
    { label: "Conta", to: "/minhas-cotas", icon: <UserRound /> }
  ];

  return (
    <nav className="cfx-home-bottom-nav" aria-label="Navegação principal">
      {items.map((item, index) => (
        <Link to={item.to} key={item.label} className={index === 0 ? "is-active" : ""}>
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function useHomeCountdown(date?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const target = date ? new Date(date).getTime() : now + 3 * 86400000;
  const diff = Math.max(0, (Number.isFinite(target) ? target : now + 3 * 86400000) - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000)
  };
}

function maskBuyerName(value: string) {
  const clean = safeText(value, "Cliente");
  const [first, second] = clean.split(/\s+/);
  return `${first || "Cliente"} ${second ? `${second.slice(0, 1)}.` : ""}`.trim();
}
