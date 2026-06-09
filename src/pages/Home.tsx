import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Crown, Gift, Goal, Headphones, Home as HomeIcon, Instagram, LockKeyhole, MessageCircle, ShieldCheck, Ticket, Trophy, TrendingUp } from "lucide-react";
import { useRaffles } from "../hooks/useRaffles";
import { PremiumButton, PremiumEmptyState, PremiumErrorState, PremiumPageLayout } from "../components/premium/PremiumUI";
import { markPageLoaded, startMetric } from "../lib/performanceMetrics";
import type { Raffle } from "../types";
import { StandardRaffleMediaBlock } from "../components/StandardRaffleMediaBlock";
import { cn } from "../lib/utils";

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

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
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
  const rawRaffle = raffle as Partial<Raffle> & { imageUrl?: string; bannerUrl?: string; coverImageUrl?: string; thumbnailUrl?: string; videoUrl?: string; campaignMedia?: string | { url?: string; mediaUrl?: string } };
  const price = safeNumber(rawRaffle.price);
  const totalTickets = Math.max(1, Math.floor(safeNumber(rawRaffle.totalTickets, 1)));
  const soldTickets = Math.max(0, Math.floor(safeNumber(rawRaffle.soldTickets)));
  const campaignMediaUrl = typeof rawRaffle.campaignMedia === "string" ? rawRaffle.campaignMedia : rawRaffle.campaignMedia?.url || rawRaffle.campaignMedia?.mediaUrl;
  const image = safeText(rawRaffle.image || rawRaffle.imageUrl || rawRaffle.bannerUrl || rawRaffle.coverImageUrl || rawRaffle.thumbnailUrl, "");
  const rawMediaUrl = safeText(rawRaffle.mediaUrl || rawRaffle.videoUrl || campaignMediaUrl, "");
  const mediaUrl = rawMediaUrl || image;
  const mediaType = rawMediaUrl ? normalizeRaffleMediaType(rawRaffle.mediaType) : image ? "image" : normalizeRaffleMediaType(rawRaffle.mediaType);
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
    mediaType,
    mediaFit: normalizeRaffleMediaFit(rawRaffle.mediaFit),
    homeTitle: safeText(rawRaffle.homeTitle, ""),
    homeSubtitle: safeText(rawRaffle.homeSubtitle, ""),
    homeHighlightText: safeText(rawRaffle.homeHighlightText, ""),
    drawDate: safeText(rawRaffle.drawDate, new Date().toISOString()),
    countdownEnabled: rawRaffle.countdownEnabled === true,
    countdownEndAt: safeText(rawRaffle.countdownEndAt, ""),
    salesEndAt: safeText(rawRaffle.salesEndAt, ""),
    manuallyClosedAt: safeText(rawRaffle.manuallyClosedAt, ""),
    heroPrimaryButton: safeText(rawRaffle.heroPrimaryButton, "Participar agora"),
    countdownLabel: rawRaffle.countdownLabel ? String(rawRaffle.countdownLabel) : undefined
  } as Raffle;
}

function isVideoMediaType(type: unknown) {
  const normalized = String(type || "").trim().toLowerCase();
  return ["video", "youtube", "vimeo", "bunny"].includes(normalized);
}

type HomeRewardStatus = "available" | "claimed" | "drawn";

type HomeRewardItem = {
  id: string;
  number?: number;
  prize: string;
  value?: number;
  buyerName?: string;
  status: HomeRewardStatus;
};

type HomeInstantRewardsData = {
  superCotas: HomeRewardItem[];
  wheel: HomeRewardItem[];
  scratchcard: HomeRewardItem[];
  mysteryBox: HomeRewardItem[];
};

const emptyHomeRewards: HomeInstantRewardsData = {
  superCotas: [],
  wheel: [],
  scratchcard: [],
  mysteryBox: []
};

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

function formatHomeDrawText(value?: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return `Sorteio ao vivo em ${date.toLocaleDateString("pt-BR")} às ${getDrawHour(value)}`;
}

function HomeContent() {
  const { data: rawRaffles, isLoading: loadingRaffles, isError: rafflesError, refetch: refetchRaffles } = useRaffles();
  const [ranking, setRanking] = useState<Array<{ name: string; phone: string; tickets: number; amount: number }>>([]);
  const [instantRewards, setInstantRewards] = useState<HomeInstantRewardsData>(emptyHomeRewards);
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
    let active = true;
    fetch(`/api/raffles/${featuredRaffle.id}/ranking`)
      .then(res => res.ok ? res.json() : [])
      .then(payload => active && setRanking(Array.isArray(payload) ? payload : []))
      .catch(() => active && setRanking([]));
    return () => {
      active = false;
    };
  }, [featuredRaffle?.id]);

  useEffect(() => {
    if (!featuredRaffle?.id) {
      setInstantRewards(emptyHomeRewards);
      return;
    }
    let active = true;
    loadHomeInstantRewards(featuredRaffle)
      .then(payload => active && setInstantRewards(payload))
      .catch(() => active && setInstantRewards(emptyHomeRewards));
    return () => {
      active = false;
    };
  }, [featuredRaffle]);

  if (loading) return <RifaProLoading />;

  if (rafflesError) {
    logPublicHome("render_error", { reason: "raffles_api_failed" });
    return <PublicHomeFallback mode="error" onRetry={() => void refetchRaffles()} />;
  }

  if (!featuredRaffle) return <PublicHomeFallback mode="empty" onRetry={() => void refetchRaffles()} />;

  return (
    <PremiumPageLayout className="cfx-home-page">
      <main className="cfx-home-shell" aria-label="Home CIFHER Prime">
        <Hero raffle={featuredRaffle} ranking={ranking} />
        <HomeInstantRewards rewards={instantRewards} />
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

function Hero({ raffle, ranking }: { raffle: Raffle; ranking: Array<{ name: string; phone: string; tickets: number; amount: number }> }) {
  const progress = safeProgress(raffle);
  const remaining = Math.max(0, Number(raffle.totalTickets || 0) - Number(raffle.soldTickets || 0));
  const mediaUrl = raffle.mediaUrl || raffle.image;
  const countdownTarget = raffle.salesEndAt || raffle.countdownEndAt || raffle.drawDate;
  const countdown = useHomeCountdown(countdownTarget);
  const headline = safeText(raffle.homeTitle, safeText(raffle.heroTitle, raffle.title));
  const description = safeText(raffle.homeSubtitle, safeText(raffle.heroSubtitle, raffle.description));
  const highlight = safeText(raffle.homeHighlightText, formatHomeDrawText(raffle.drawDate));
  const isVideo = isVideoMediaType(raffle.mediaType);
  const mediaKind = isVideo ? "video" : "image";

  return (
    <section className="cfx-home-hero">
      <div className="cfx-home-hero-media" data-home-media-type={mediaKind}>
        <StandardRaffleMediaBlock
          mediaUrl={mediaUrl}
          mediaType={raffle.mediaType}
          title={raffle.title}
          href={`/raffle/${raffle.id}`}
          fallbackImageUrl={raffle.image}
          priority
          showDescriptionBelow={false}
          preferredFit="cover"
          aspectMode={isVideo ? "horizontal" : "portrait"}
          className="cfx-home-media-block"
        />
      </div>
      <div className="cfx-home-hero-actions">
        <Link to={`/raffle/${raffle.id}`} className="cfx-home-primary">Participar agora <ChevronRight /></Link>
        <Link to="/minhas-cotas" className="cfx-home-secondary"><Ticket /> Meus bilhetes <ChevronRight /></Link>
      </div>
      <div className="cfx-home-title-lockup">
        {raffle.heroEyebrow && <span>{raffle.heroEyebrow}</span>}
        <h1>{headline}</h1>
        {description && <p>{description}</p>}
        {highlight && <strong>{highlight}</strong>}
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
          <span>{progress.toFixed(0)}% das cotas vendidas</span>
        </div>
        <div className="cfx-home-progress"><span style={{ width: `${progress}%` }} /></div>
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

async function safeJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function loadHomeInstantRewards(raffle: Raffle): Promise<HomeInstantRewardsData> {
  const raffleId = encodeURIComponent(raffle.id);
  const [instantPrizesPayload, superCotasPayload, gamificationPayload] = await Promise.all([
    safeJson(`/api/raffles/${raffleId}/instant-prizes`),
    safeJson(`/api/public/raffles/${raffleId}/super-cotas`),
    safeJson(`/api/raffles/${raffleId}/gamification`)
  ]);

  const rewards = {
    superCotas: buildSuperCotaRewards(instantPrizesPayload, superCotasPayload),
    wheel: buildWheelRewards(raffle),
    scratchcard: buildScratchcardRewards(gamificationPayload),
    mysteryBox: buildMysteryBoxRewards(raffle, gamificationPayload)
  };

  if (!import.meta.env.PROD) {
    console.info("[home-instant-rewards]", {
      raffleId: raffle.id,
      hasSuperCotas: rewards.superCotas.length > 0,
      hasRoulette: rewards.wheel.length > 0,
      hasScratchcard: rewards.scratchcard.length > 0,
      hasLootbox: rewards.mysteryBox.length > 0
    });
  }

  return rewards;
}

function normalizeRewardStatus(value: unknown): HomeRewardStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (["claimed", "won", "opened", "drawn", "sorteada", "resgatada"].includes(normalized)) return normalized === "claimed" || normalized === "resgatada" ? "claimed" : "drawn";
  return "available";
}

function buildSuperCotaRewards(instantPrizesPayload: unknown, superCotasPayload: any): HomeRewardItem[] {
  const winners = new Map<number, { name?: string }>();
  asArray(superCotasPayload?.winners).forEach((winner: any) => {
    const number = Number(winner?.numeroPremiado);
    if (Number.isFinite(number)) winners.set(number, { name: safeText(winner?.name, "") });
  });

  const rows: Array<HomeRewardItem | null> = asArray(instantPrizesPayload)
    .map((prize: any, index) => {
      const number = Number(prize?.numeroPremiado);
      const value = Number(prize?.valorPremio);
      if (!Number.isFinite(number)) return null;
      const status = normalizeRewardStatus(prize?.status);
      const winner = winners.get(number);
      return {
        id: String(prize?.id || `super-cota-${number}-${index}`),
        number,
        prize: value > 0 ? formatCurrency(value) : "Super Cota",
        value: Number.isFinite(value) ? value : undefined,
        buyerName: winner?.name,
        status
      } satisfies HomeRewardItem;
    });
  return rows.filter((item): item is HomeRewardItem => Boolean(item));
}

function buildWheelRewards(raffle: Raffle): HomeRewardItem[] {
  const config = (raffle.lootboxConfig || {}) as any;
  const wheelEnabled = Boolean(config?.rewardModes?.wheel || config?.experienceType === "wheel");
  if (!wheelEnabled) return [];
  const rows: Array<HomeRewardItem | null> = asArray(config.wheelSegments)
    .map((segment: any, index) => {
      const reward = segment?.reward;
      const label = safeText(reward?.name || segment?.label, "");
      if (!label) return null;
      const value = Number(reward?.value);
      return {
        id: String(reward?.id || `wheel-${index}`),
        prize: label,
        value: Number.isFinite(value) ? value : undefined,
        status: normalizeRewardStatus(reward?.status)
      } satisfies HomeRewardItem;
    });
  return rows.filter((item): item is HomeRewardItem => Boolean(item));
}

function buildScratchcardRewards(gamificationPayload: any): HomeRewardItem[] {
  return asArray(gamificationPayload?.scratchcard?.prizes)
    .map((prize: any, index) => {
      const value = Number(prize?.value);
      const stock = Number(prize?.stock);
      return {
        id: String(prize?.id || `scratchcard-${index}`),
        prize: safeText(prize?.name, "Prêmio da raspadinha"),
        value: Number.isFinite(value) ? value : undefined,
        status: normalizeRewardStatus(prize?.status || (Number.isFinite(stock) && stock <= 0 ? "drawn" : "available"))
      } satisfies HomeRewardItem;
    })
    .filter(item => item.prize.trim() && item.prize.toLowerCase() !== "vazio");
}

function buildMysteryBoxRewards(raffle: Raffle, gamificationPayload: any): HomeRewardItem[] {
  const config = (raffle.lootboxConfig || {}) as any;
  const configuredRows: Array<HomeRewardItem | null> = asArray(config.milestones)
    .map((milestone: any, index) => {
      const value = Number(milestone?.value);
      if (!safeText(milestone?.name, "") && !Number.isFinite(value)) return null;
      return {
        id: String(milestone?.id || milestone?.tier || `mystery-${index}`),
        prize: safeText(milestone?.name, "Prêmio da caixinha"),
        value: Number.isFinite(value) ? value : undefined,
        status: normalizeRewardStatus(milestone?.status)
      } satisfies HomeRewardItem;
    });
  const configured = configuredRows.filter((item): item is HomeRewardItem => Boolean(item));

  if (configured.length) return configured;

  const rows: Array<HomeRewardItem | null> = asArray(gamificationPayload?.mysteryBox?.boxes)
    .map((box: any, index) => {
      const value = Number(box?.value);
      const prize = safeText(box?.prize || box?.label, "");
      if (!prize || prize.toLowerCase() === "vazio") return null;
      return {
        id: String(box?.id || `box-${index}`),
        prize,
        value: Number.isFinite(value) ? value : undefined,
        status: normalizeRewardStatus(box?.status)
      } satisfies HomeRewardItem;
    });
  return rows.filter((item): item is HomeRewardItem => Boolean(item));
}

function formatCurrency(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "—";
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusLabel(status: HomeRewardStatus) {
  if (status === "available") return "Disponível";
  if (status === "claimed") return "Resgatada";
  return "Sorteada";
}

function HomeInstantRewards({ rewards }: { rewards: HomeInstantRewardsData }) {
  const sections = [
    {
      id: "superCotas" as const,
      title: "SUPER COTAS PREMIADAS",
      icon: <Crown />,
      tone: "gold",
      description: "Concorra a prêmios especiais com números exclusivos!",
      items: rewards.superCotas,
      columns: { primary: "Número", secondary: "Prêmio/valor", person: "Comprador" }
    },
    {
      id: "wheel" as const,
      title: "ROLETA PREMIADA",
      icon: <Goal />,
      tone: "purple",
      cta: "VER PRÊMIOS DA ROLETA",
      items: rewards.wheel,
      columns: { primary: "Prêmio", secondary: "Valor", person: "Ganhador" }
    },
    {
      id: "scratchcard" as const,
      title: "RASPADINHA PREMIADA",
      icon: <Ticket />,
      tone: "green",
      cta: "VER PRÊMIOS DA RASPADINHA",
      items: rewards.scratchcard,
      columns: { primary: "Prêmio", secondary: "Valor", person: "Ganhador" }
    },
    {
      id: "mysteryBox" as const,
      title: "CAIXINHA PREMIADA",
      icon: <Gift />,
      tone: "pink",
      cta: "VER PRÊMIOS DA CAIXINHA",
      items: rewards.mysteryBox,
      columns: { primary: "Prêmio", secondary: "Valor", person: "Ganhador" }
    }
  ].filter(section => section.items.length > 0);

  if (!sections.length) return null;

  return (
    <section className="cfx-instant-rewards" aria-label="Prêmios instantâneos da campanha">
      {sections.map(section => (
        <InstantRewardSection
          key={section.id}
          id={section.id}
          title={section.title}
          icon={section.icon}
          tone={section.tone}
          description={section.description}
          cta={section.cta}
          items={section.items}
          columns={section.columns}
        />
      ))}
    </section>
  );
}

function InstantRewardSection({
  id,
  title,
  icon,
  tone,
  description,
  cta,
  items,
  columns
}: {
  key?: React.Key;
  id: keyof HomeInstantRewardsData;
  title: string;
  icon: ReactNode;
  tone: string;
  description?: string;
  cta?: string;
  items: HomeRewardItem[];
  columns: { primary: string; secondary: string; person: string };
}) {
  const [visible, setVisible] = useState(10);
  const cappedItems = items.slice(0, 50);
  const visibleItems = cappedItems.slice(0, visible);
  const available = cappedItems.filter(item => item.status === "available").length;
  const claimed = cappedItems.filter(item => item.status !== "available").length;
  const totalValue = cappedItems.reduce((sum, item) => sum + (Number(item.value) > 0 ? Number(item.value) : 0), 0);
  const canShowMore = visible < cappedItems.length && visible < 50;

  return (
    <article className="cfx-reward-section" data-reward-tone={tone} data-reward-id={id}>
      <header className="cfx-reward-header">
        <span>{icon}</span>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <strong className="cfx-reward-total-badge"><small>Total</small>{cappedItems.length}<em>{id === "superCotas" ? "Super Cotas" : "Prêmios"}</em></strong>
      </header>

      <div className="cfx-reward-summary" data-summary-count={id === "superCotas" && totalValue > 0 ? 4 : 3}>
        <RewardSummaryCard label="Disponíveis" value={available} />
        <RewardSummaryCard label={id === "superCotas" ? "Resgatadas" : "Sorteadas"} value={claimed} />
        <RewardSummaryCard label="Total" value={cappedItems.length} />
        {id === "superCotas" && totalValue > 0 && <RewardSummaryCard label="Valor total" value={formatCurrency(totalValue)} />}
      </div>

      <div className="cfx-reward-list" role="list">
        {visibleItems.map(item => (
          <div className="cfx-reward-card" role="listitem" key={item.id}>
            <div>
              <small>{columns.primary}</small>
              <strong>{typeof item.number === "number" ? `#${String(item.number).padStart(6, "0")}` : item.prize}</strong>
            </div>
            <div>
              <small>{columns.secondary}</small>
              <strong>{typeof item.number === "number" ? item.prize : formatCurrency(item.value)}</strong>
            </div>
            <div>
              <small>{columns.person}</small>
              <strong>{item.buyerName ? maskBuyerName(item.buyerName) : "—"}</strong>
            </div>
            <span className={item.status === "available" ? "is-available" : "is-claimed"}>{statusLabel(item.status)}</span>
          </div>
        ))}
      </div>

      {canShowMore && (
        <button
          type="button"
          className="cfx-reward-more"
          onClick={() => setVisible(current => Math.min(50, current + 10, cappedItems.length))}
        >
          {cta || "MOSTRAR MAIS"} (10)
        </button>
      )}
    </article>
  );
}

function RewardSummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
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
    { icon: <ShieldCheck />, title: "Pagamento Seguro" },
    { icon: <LockKeyhole />, title: "Dados Protegidos" },
    { icon: <Ticket />, title: "Transparência" },
    { icon: <Headphones />, title: "Suporte", tone: "support" }
  ];

  return (
    <section className="cfx-home-trust-rail" aria-label="Selos de confiança">
      {seals.map(seal => (
        <span key={seal.title} className={seal.tone === "support" ? "is-support" : ""}>{seal.icon}<small>{seal.title}</small></span>
      ))}
    </section>
  );
}

function HomeBottomNav() {
  const [settings, setSettings] = useState<any>(null);
  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.ok ? res.json() : null)
      .then(payload => setSettings(payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null))
      .catch(() => setSettings(null));
  }, []);
  const whatsappUrl = typeof settings?.socialLinks?.whatsapp === "string" ? settings.socialLinks.whatsapp.trim() : "";
  const instagramUrl = typeof settings?.socialLinks?.instagram === "string" ? settings.socialLinks.instagram.trim() : "";
  const items = [
    { label: "Início", to: "/", icon: <HomeIcon /> },
    { label: "Sorteios", to: "/", icon: <Gift /> },
    { label: "Ganhadores", to: "/ganhadores", icon: <Trophy /> },
    ...(whatsappUrl ? [{ label: "WhatsApp", to: whatsappUrl, icon: <MessageCircle />, external: /^https?:\/\//i.test(whatsappUrl), tone: "whatsapp" }] : []),
    ...(instagramUrl ? [{ label: "Instagram", to: instagramUrl, icon: <Instagram />, external: /^https?:\/\//i.test(instagramUrl), tone: "instagram" }] : [])
  ];

  return (
    <nav className="cfx-home-bottom-nav" data-count={items.length} aria-label="Navegação principal">
      {items.map((item, index) => (
        item.external ? (
          <a href={item.to} key={item.label} target="_blank" rel="noreferrer" className={cn(index === 0 ? "is-active" : "", item.tone === "whatsapp" ? "is-whatsapp" : "", item.tone === "instagram" ? "is-instagram" : "")}>
            {item.icon}
            <span>{item.label}</span>
          </a>
        ) : (
          <Link to={item.to} key={item.label} className={cn(index === 0 ? "is-active" : "", item.tone === "whatsapp" ? "is-whatsapp" : "", item.tone === "instagram" ? "is-instagram" : "")}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        )
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
