import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  Crown,
  Gamepad2,
  Gift,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import { useFazendinha, useGlobalSettings, useRaffles } from "../hooks/useRaffles";
import { PremiumButton, PremiumEmptyState, PremiumErrorState, PremiumPageLayout } from "../components/premium/PremiumUI";
import { markPageLoaded, startMetric } from "../lib/performanceMetrics";
import type { Raffle, Winner } from "../types";
import { StandardRaffleMediaBlock } from "../components/StandardRaffleMediaBlock";
import { StoriesSection } from "../components/StoriesSection";
import { cn } from "../lib/utils";
import type { ResponsiveMediaAspectMode, ResponsiveMediaFit } from "../utils/mediaAspect";

/* public-home-render contract: className="cfx-home-hero-media" */

type RankingBuyer = { name: string; phone: string; tickets: number; amount: number };
type TopSellerRankingItem = {
  affiliateId?: string;
  affiliateName?: string;
  affiliate?: string;
  refCode: string;
  totalSold: number;
  paidPurchasesCount?: number;
  sales?: number;
  directBuyersCount?: number;
  buyers?: number;
  position: number;
  prizeLabel?: string;
};

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

function isStoryFirstVideoSource(raffle: Pick<Raffle, "mediaType" | "mediaUrl" | "videoUrl">) {
  const type = String(raffle.mediaType || "").trim().toLowerCase();
  const url = String(raffle.mediaUrl || raffle.videoUrl || "").trim().toLowerCase();
  return type === "bunny" || url.includes("player.mediadelivery.net");
}

function resolveHomeMediaAspect(raffle: Pick<Raffle, "mediaAspect" | "mediaType" | "mediaUrl" | "videoUrl">, isVideo: boolean): ResponsiveMediaAspectMode {
  const normalized = String(raffle.mediaAspect || "").trim().toLowerCase();
  if (normalized === "story" || normalized === "vertical") return "story";
  if (normalized === "portrait") return "portrait";
  if (normalized === "square") return "square";
  if (normalized === "wide" || normalized === "horizontal" || normalized === "landscape" || normalized === "cinematic" || normalized === "banner") return "horizontal";
  if (isVideo && isStoryFirstVideoSource(raffle)) return "story";
  return isVideo ? "horizontal" : "portrait";
}

function resolveHomeMediaFit(fit: unknown): ResponsiveMediaFit {
  return String(fit || "").trim().toLowerCase() === "contain" ? "contain" : "cover";
}

function normalizePublicRaffle(raffle: Partial<Raffle> | null | undefined): Raffle | null {
  if (!raffle || !raffle.id) return null;
  const rawRaffle = raffle as Partial<Raffle> & {
    imageUrl?: string;
    bannerUrl?: string;
    coverImageUrl?: string;
    thumbnailUrl?: string;
    videoUrl?: string;
    campaignMedia?: string | { url?: string; mediaUrl?: string };
  };
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
    title: safeText(rawRaffle.title, "Campanha ativa"),
    description: safeText(rawRaffle.description, "Campanha ativa com cotas disponiveis."),
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
    showHomePrice: (rawRaffle as any).showHomePrice !== false,
    showHomeText: (rawRaffle as any).showHomeText !== false,
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

function resolveHomeHeroMedia(raffle: Raffle) {
  const image = safeText(
    raffle.image || (raffle as any).imageUrl || (raffle as any).bannerUrl || (raffle as any).coverImageUrl || (raffle as any).thumbnailUrl,
    ""
  );
  const rawMedia = safeText(raffle.mediaUrl || (raffle as any).videoUrl, "");
  const mediaType = String(raffle.mediaType || "").trim().toLowerCase();
  const shouldPreferImage = mediaType === "bunny" || rawMedia.includes("player.mediadelivery.net");

  if (image && shouldPreferImage) {
    return { mediaUrl: image, mediaType: "image" as Raffle["mediaType"], fallbackImageUrl: image, isVideo: false, hasMedia: true };
  }
  if (rawMedia) {
    return { mediaUrl: rawMedia, mediaType: raffle.mediaType, fallbackImageUrl: image, isVideo: isVideoMediaType(raffle.mediaType), hasMedia: true };
  }
  if (image) {
    return { mediaUrl: image, mediaType: "image" as Raffle["mediaType"], fallbackImageUrl: image, isVideo: false, hasMedia: true };
  }
  return { mediaUrl: "", mediaType: "image" as Raffle["mediaType"], fallbackImageUrl: "", isVideo: false, hasMedia: false };
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

function sortHomeRaffles(raffles: Raffle[]) {
  return [...raffles].sort((left, right) => {
    const rightPriority = Number((right as any).homePriority ?? (right as any).home_priority ?? 0);
    const leftPriority = Number((left as any).homePriority ?? (left as any).home_priority ?? 0);
    if (rightPriority !== leftPriority) return rightPriority - leftPriority;
    const rightDate = String((right as any).createdAt || (right as any).created_at || right.drawDate || "");
    const leftDate = String((left as any).createdAt || (left as any).created_at || left.drawDate || "");
    return rightDate.localeCompare(leftDate);
  });
}

function HomeContent() {
  const { data: rawRaffles, isLoading: loadingRaffles, isError: rafflesError, refetch: refetchRaffles } = useRaffles();
  const { data: settings } = useGlobalSettings();
  const { data: fazendinha } = useFazendinha();
  const [modalidades, setModalidades] = useState<any>(null);
  const [ranking, setRanking] = useState<RankingBuyer[]>([]);
  const [topSellers, setTopSellers] = useState<TopSellerRankingItem[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [instantRewards, setInstantRewards] = useState<HomeInstantRewardsData>(emptyHomeRewards);
  const raffles = useMemo(() => (
    Array.isArray(rawRaffles)
      ? rawRaffles.map(raffle => normalizePublicRaffle(raffle)).filter((raffle): raffle is Raffle => Boolean(raffle))
      : []
  ), [rawRaffles]);
  const activeRaffles = useMemo(() => sortHomeRaffles(raffles.filter(raffle => raffle.status === "active")), [raffles]);
  const featuredRaffle = activeRaffles[0];
  const secondaryRaffles = useMemo(
    () => activeRaffles.filter(raffle => raffle.id !== featuredRaffle?.id),
    [activeRaffles, featuredRaffle?.id]
  );
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
    if (!featuredRaffle?.id) {
      setRanking([]);
      setTopSellers([]);
      return;
    }
    let active = true;
    Promise.all([
      fetch(`/api/raffles/${featuredRaffle.id}/ranking`).then(res => res.ok ? res.json() : []),
      fetch(`/api/raffles/${featuredRaffle.id}/top-sellers`).then(res => res.ok ? res.json() : [])
    ])
      .then(([buyersPayload, sellersPayload]) => {
        if (!active) return;
        setRanking(Array.isArray(buyersPayload) ? buyersPayload : []);
        setTopSellers(Array.isArray(sellersPayload) ? sellersPayload : []);
      })
      .catch(() => {
        if (!active) return;
        setRanking([]);
        setTopSellers([]);
      });
    return () => {
      active = false;
    };
  }, [featuredRaffle?.id]);

  useEffect(() => {
    let active = true;
    safeJson("/api/modalidades")
      .then(payload => active && setModalidades(payload && typeof payload === "object" ? payload : null))
      .catch(() => active && setModalidades(null));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    safeJson("/api/winners")
      .then(payload => active && setWinners(asArray<Winner>(payload).filter(item => item.active !== false).slice(0, 6)))
      .catch(() => active && setWinners([]));
    return () => {
      active = false;
    };
  }, []);

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

  const storySlots = resolveHomeStorySlots(settings);

  return (
    <PremiumPageLayout className="cfx-home-page">
      <main className="cfx-home-shell cfx-home-shell--multi" aria-label="Home publica">
        {storySlots.homeTop && <StoriesSection />}
        <Hero raffle={featuredRaffle} ranking={ranking} topSellers={topSellers} />
        <CampaignsSection raffles={secondaryRaffles} />
        <GamesAndModalidadesSection fazendinha={fazendinha} modalidades={modalidades} rewards={instantRewards} featuredRaffle={featuredRaffle} />
        <WinnersSection winners={winners} />
        <HomeInstantRewards rewards={instantRewards} />
        {storySlots.homeBottom && <StoriesSection />}
        {storySlots.floatingLeft && <div className="cfx-stories-floating cfx-stories-floating--left"><StoriesSection /></div>}
        {storySlots.floatingRight && <div className="cfx-stories-floating cfx-stories-floating--right"><StoriesSection /></div>}
      </main>
    </PremiumPageLayout>
  );
}

function resolveHomeStorySlots(settings: any) {
  const position = String(settings?.storiesPosition || "bottom").trim();
  const placements = Array.isArray(settings?.storiesPlacements) ? settings.storiesPlacements.map(String) : ["home-bottom"];
  if (position === "hidden") {
    return { homeTop: false, homeBottom: false, floatingLeft: false, floatingRight: false };
  }
  return {
    homeTop: placements.includes("home-top") || position === "top",
    homeBottom: placements.includes("home-bottom") || position === "bottom",
    floatingLeft: placements.includes("floating-left") || position === "floating-left",
    floatingRight: placements.includes("floating-right") || position === "floating-right"
  };
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

function Hero({ raffle, ranking, topSellers }: { raffle: Raffle; ranking: RankingBuyer[]; topSellers: TopSellerRankingItem[] }) {
  const progress = safeProgress(raffle);
  const heroMedia = resolveHomeHeroMedia(raffle);
  const headline = safeText(raffle.homeTitle, safeText(raffle.heroTitle, raffle.title));
  const highlight = safeText(raffle.homeHighlightText, "");
  const isVideo = heroMedia.isVideo;
  const mediaKind = isVideo ? "video" : "image";
  const homeMediaAspect = resolveHomeMediaAspect(raffle, isVideo);
  const isStoryMedia = homeMediaAspect === "story" || homeMediaAspect === "vertical";

  return (
    <section className="cfx-home-hero">
      <div
        className={cn("cfx-home-hero-media", isStoryMedia && "cfx-home-hero-media--story")}
        data-home-media-type={mediaKind}
        data-home-media-aspect={homeMediaAspect}
      >
        {heroMedia.hasMedia ? (
          <StandardRaffleMediaBlock
            mediaUrl={heroMedia.mediaUrl}
            mediaType={heroMedia.mediaType}
            title={raffle.title}
            href={`/raffle/${raffle.id}`}
            fallbackImageUrl={heroMedia.fallbackImageUrl}
            priority
            showDescriptionBelow={false}
            preferredFit={resolveHomeMediaFit(raffle.mediaFit)}
            aspectMode={homeMediaAspect}
            className="cfx-home-media-block"
          />
        ) : (
          <HomeHeroFallback raffle={raffle} headline={headline} highlight={highlight} />
        )}
        <div className="cfx-home-hero-progress-badge">
          <strong>{progress.toFixed(0)}%</strong>
          <small>cotas vendidas</small>
        </div>
        <Link to={`/raffle/${raffle.id}`} className="cfx-home-hero-quick-cta">Comprar Agora <ChevronRight /></Link>
      </div>

      <TopBuyers ranking={ranking} />
      <TopSellers ranking={topSellers} />
    </section>
  );
}

function HomeHeroFallback({ raffle, headline, highlight }: { raffle: Raffle; headline: string; highlight: string }) {
  return (
    <div className="cfx-home-hero-fallback" data-home-hero-fallback="premium">
      <div>
        <span><Sparkles /> PIX imediato</span>
        <span><ShieldCheck /> Compra segura</span>
      </div>
      <h2>{headline}</h2>
      <strong>{safeText(highlight, safeText(raffle.description, "Campanha ativa com cotas disponiveis."))}</strong>
    </div>
  );
}

function HomeSection({
  icon,
  title,
  action,
  children,
  className
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("cfx-home-section", className)}>
      <header className="cfx-home-section-header">
        <h2>{icon}{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function CampaignsSection({ raffles }: { raffles: Raffle[] }) {
  if (raffles.length === 0) return null;
  return (
    <HomeSection
      icon={<Sparkles />}
      title="Campanhas em andamento"
      action={<Link to="/" aria-label="Todas as campanhas">Ver todas <ChevronRight /></Link>}
      className="cfx-home-campaigns"
    >
      <div className="cfx-campaign-list">
        {raffles.map(raffle => (
          <CampaignCard key={raffle.id} raffle={raffle} />
        ))}
      </div>
    </HomeSection>
  );
}

function CampaignCard({ raffle }: { key?: React.Key; raffle: Raffle }) {
  const progress = safeProgress(raffle);
  return (
    <article className="cfx-campaign-card">
      <Link to={`/raffle/${raffle.id}`} className="cfx-campaign-media" aria-label={`Participar de ${raffle.title}`}>
        <StandardRaffleMediaBlock
          mediaUrl={raffle.mediaUrl || raffle.image}
          mediaType={raffle.mediaType}
          fallbackImageUrl={raffle.image}
          title={raffle.title}
          showDescriptionBelow={false}
          preferredFit={resolveHomeMediaFit(raffle.mediaFit)}
          aspectMode="square"
          className="cfx-campaign-media-block"
        />
      </Link>
      <div className="cfx-campaign-body">
        <div className="cfx-campaign-status"><span>Em andamento</span></div>
        <h3>{raffle.title}</h3>
        <p>{safeText(raffle.homeHighlightText, safeText(raffle.description, "Campanha ativa"))}</p>
        <div className="cfx-campaign-stats">
          <span><small>Cotas vendidas</small>{Number(raffle.soldTickets || 0).toLocaleString("pt-BR")} / {Number(raffle.totalTickets || 0).toLocaleString("pt-BR")}</span>
        </div>
        <div className="cfx-home-progress"><span style={{ width: `${progress}%` }} /></div>
        <Link to={`/raffle/${raffle.id}`} className="cfx-home-primary cfx-campaign-button">Participar <ChevronRight /></Link>
      </div>
    </article>
  );
}

function GamesAndModalidadesSection({ fazendinha, modalidades, rewards, featuredRaffle }: { fazendinha: any; modalidades: any; rewards: HomeInstantRewardsData; featuredRaffle: Raffle }) {
  const cards: Array<{ id: string; title: string; description: string; href: string; icon: ReactNode; tone: string; meta?: string }> = [];
  const fazConfig = fazendinha?.config || modalidades?.fazendinha;
  if (fazConfig?.enabled !== false && String(fazConfig?.status || "active") === "active") {
    cards.push({
      id: "fazendinha",
      title: safeText(fazConfig?.name, "Fazendinha da sorte"),
      description: safeText(fazConfig?.description, "Concorra com grupos especiais."),
      href: "/fazendinha",
      icon: <Gift />,
      tone: "green",
      meta: fazendinha?.groups ? `${asArray(fazendinha.groups).filter((group: any) => group.status === "available").length} grupos disponiveis` : undefined
    });
  }
  asArray<any>(modalidades?.numberModes)
    .filter(mode => mode?.enabled !== false && String(mode?.status || "active") === "active")
    .slice(0, 3)
    .forEach(mode => {
      cards.push({
        id: String(mode.id),
        title: safeText(mode.name, String(mode.id).toUpperCase()),
        description: safeText(mode.description, safeText(mode.prize, "Modalidade ativa.")),
        href: `/${mode.id}`,
        icon: <Gamepad2 />,
        tone: "purple",
        meta: mode.price ? `${formatCurrency(mode.price)} por jogo` : undefined
      });
    });
  if (rewards.scratchcard.length) {
    cards.push({
      id: "scratchcard",
      title: "Raspadinha premiada",
      description: `${rewards.scratchcard.length} premio(s) configurado(s) nesta campanha.`,
      href: `/raffle/${featuredRaffle.id}`,
      icon: <Ticket />,
      tone: "blue",
      meta: "Disponivel ao participar"
    });
  }

  if (!cards.length) return null;

  return (
    <HomeSection icon={<Gamepad2 />} title="Jogos e modalidades" className="cfx-home-games">
      <div className="cfx-game-grid">
        {cards.map(card => (
          <Link key={card.id} to={card.href} className="cfx-game-card" data-tone={card.tone}>
            <span>{card.icon}</span>
            <div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              {card.meta && <small>{card.meta}</small>}
            </div>
            <ChevronRight />
          </Link>
        ))}
      </div>
    </HomeSection>
  );
}

function WinnersSection({ winners }: { winners: Winner[] }) {
  if (!winners.length) return null;
  return (
    <HomeSection
      icon={<Trophy />}
      title="Ultimos ganhadores"
      action={<Link to="/ganhadores">Ver todos <ChevronRight /></Link>}
      className="cfx-home-winners"
    >
      <div className="cfx-winner-list">
        {winners.slice(0, 5).map((winner, index) => (
          <article key={winner.id || `${winner.winnerName}-${index}`} className="cfx-winner-card">
            <span>{winner.mediaUrl ? <img src={winner.mediaUrl} alt="" loading="lazy" /> : maskBuyerName(winner.winnerName).slice(0, 1)}</span>
            <div>
              <h3>{maskBuyerName(winner.winnerName)}</h3>
              <p>{safeText(winner.prizeDescription || winner.raffleName, "Premio confirmado")}</p>
            </div>
            <time>{formatDate(winner.date)}</time>
          </article>
        ))}
      </div>
    </HomeSection>
  );
}

function TopBuyers({ ranking }: { ranking: RankingBuyer[] }) {
  const buyers = ranking.slice(0, 5);

  return (
    <HomeSection
      icon={<Crown />}
      title="Top compradores"
      action={<Link to="/ganhadores">Ver ranking <ChevronRight /></Link>}
      className="cfx-top-buyers"
    >
      <div className="cfx-top-buyers-list">
        {buyers.length ? (
          buyers.map((buyer, index) => (
            <article key={`${buyer.phone || buyer.name}-${index}`}>
              <span>{index + 1}</span>
              <div>
                <b>{maskBuyerName(buyer.name)}</b>
                <small>{Number(buyer.tickets || 0).toLocaleString("pt-BR")} cotas</small>
              </div>
              <strong>{formatCurrency(buyer.amount)}</strong>
            </article>
          ))
        ) : (
          <p className="cfx-top-buyers-empty">Ranking em apuração com dados reais da campanha.</p>
        )}
      </div>
    </HomeSection>
  );
}

function TopSellers({ ranking }: { ranking: TopSellerRankingItem[] }) {
  const sellers = ranking.slice(0, 3);
  if (!sellers.length) return null;

  return (
    <HomeSection
      icon={<Trophy />}
      title="Top Vendedores"
      action={<Link to="/afiliados">Divulgar <ChevronRight /></Link>}
      className="cfx-top-buyers cfx-top-sellers"
    >
      <div className="cfx-top-buyers-list">
        {sellers.map((seller, index) => (
          <article key={`${seller.refCode}-${index}`}>
            <span>{seller.position || index + 1}</span>
            <div>
              <b>{seller.affiliateName || seller.affiliate || seller.refCode}</b>
              <small>{Number(seller.paidPurchasesCount ?? seller.sales ?? 0).toLocaleString("pt-BR")} vendas diretas</small>
            </div>
            <strong>{seller.prizeLabel || formatCurrency(Number(seller.totalSold || 0))}</strong>
          </article>
        ))}
      </div>
    </HomeSection>
  );
}

async function safeJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function loadHomeRankings(raffles: Raffle[]): Promise<RankingBuyer[]> {
  const rows = await Promise.all(
    raffles.map(raffle => safeJson(`/api/raffles/${encodeURIComponent(raffle.id)}/ranking`).catch(() => []))
  );
  const byBuyer = new Map<string, RankingBuyer>();
  rows.flatMap(row => asArray<RankingBuyer>(row)).forEach(buyer => {
    const key = safeText(buyer.phone, safeText(buyer.name, "cliente")).toLowerCase();
    const current = byBuyer.get(key) || { name: buyer.name, phone: buyer.phone, tickets: 0, amount: 0 };
    current.name = current.name || buyer.name;
    current.phone = current.phone || buyer.phone;
    current.tickets += Number(buyer.tickets || 0);
    current.amount += Number(buyer.amount || 0);
    byBuyer.set(key, current);
  });
  return [...byBuyer.values()].sort((a, b) => b.tickets - a.tickets || b.amount - a.amount).slice(0, 10);
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

function rewardWinnerName(source: any) {
  return safeText(source?.winnerName || source?.ganhadorNome || source?.nomeGanhador || source?.winner || source?.winner?.name || source?.customerName || source?.buyerName, "");
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
      const manualWinnerName = safeText(prize?.winnerName || prize?.ganhadorNome || prize?.nomeGanhador, "");
      return {
        id: String(prize?.id || `super-cota-${number}-${index}`),
        number,
        prize: value > 0 ? formatCurrency(value) : "Super Cota",
        value: Number.isFinite(value) ? value : undefined,
        buyerName: manualWinnerName || winner?.name,
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
        buyerName: rewardWinnerName(reward) || rewardWinnerName(segment),
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
        buyerName: rewardWinnerName(prize),
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
        buyerName: rewardWinnerName(milestone),
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
        buyerName: rewardWinnerName(box),
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

function formatDate(value?: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "A definir";
  return date.toLocaleDateString("pt-BR");
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
      columns: { primary: "Número", secondary: "Prêmio", person: "Ganhador" }
    },
    {
      id: "wheel" as const,
      title: "ROLETA PREMIADA",
      icon: <Gamepad2 />,
      tone: "purple",
      cta: "VER PRÊMIOS DA ROLETA",
      items: rewards.wheel,
      columns: { primary: "Prêmio", secondary: "", person: "Ganhador" }
    },
    {
      id: "scratchcard" as const,
      title: "RASPADINHA PREMIADA",
      icon: <Ticket />,
      tone: "green",
      cta: "VER PRÊMIOS DA RASPADINHA",
      items: rewards.scratchcard,
      columns: { primary: "Prêmio", secondary: "", person: "Ganhador" }
    },
    {
      id: "mysteryBox" as const,
      title: "CAIXINHA PREMIADA",
      icon: <Gift />,
      tone: "pink",
      cta: "VER PRÊMIOS DA CAIXINHA",
      items: rewards.mysteryBox,
      columns: { primary: "Prêmio", secondary: "", person: "Ganhador" }
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
  const showValueColumn = Boolean(columns.secondary);

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
              <strong>{typeof item.number === "number" ? String(item.number).padStart(6, "0") : item.prize}</strong>
            </div>
            {showValueColumn && (
              <div>
                <small>{columns.secondary}</small>
                <strong>{typeof item.number === "number" ? item.prize : formatCurrency(item.value)}</strong>
              </div>
            )}
            <div>
              <small>{columns.person}</small>
              <strong>{item.buyerName ? (id === "superCotas" ? item.buyerName : maskBuyerName(item.buyerName)) : "—"}</strong>
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

function maskBuyerName(value: string) {
  const clean = safeText(value, "Cliente");
  const [first, second] = clean.split(/\s+/);
  return `${first || "Cliente"} ${second ? `${second.slice(0, 1)}.` : ""}`.trim();
}
