import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crown,
  Gift,
  Globe2,
  Handshake,
  Instagram,
  MessageCircle,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  Zap
} from "lucide-react";
import { useRaffles } from "../hooks/useRaffles";
import { PremiumButton, PremiumEmptyState, PremiumErrorState, PremiumPageLayout } from "../components/premium/PremiumUI";
import { markPageLoaded, startMetric } from "../lib/performanceMetrics";
import type { Raffle, Winner } from "../types";
import { StandardRaffleMediaBlock } from "../components/StandardRaffleMediaBlock";
import { cn } from "../lib/utils";
import type { ResponsiveMediaAspectMode, ResponsiveMediaFit } from "../utils/mediaAspect";
import { useTenantBranding } from "../context/tenant-branding/TenantBrandingContext";

/* public-home-premium-v1 contract: cfx-home-premium-v1 HomeV1Hero StandardRaffleMediaBlock className="cfx-home-media-block" */

type RankingBuyer = { name: string; phone?: string; tickets?: number; amount?: number };
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
    heroEyebrow?: string;
  };
  const price = safeNumber(rawRaffle.price);
  const totalTickets = Math.max(1, Math.floor(safeNumber(rawRaffle.totalTickets, 1)));
  const soldTickets = Math.max(0, Math.floor(safeNumber(rawRaffle.soldTickets)));
  const campaignMediaUrl = typeof rawRaffle.campaignMedia === "string" ? rawRaffle.campaignMedia : rawRaffle.campaignMedia?.url || rawRaffle.campaignMedia?.mediaUrl;
  const image = safeText(rawRaffle.image || rawRaffle.imageUrl || rawRaffle.bannerUrl || rawRaffle.coverImageUrl || rawRaffle.thumbnailUrl, "");
  const rawMediaUrl = safeText(rawRaffle.mediaUrl || rawRaffle.videoUrl || campaignMediaUrl, "");
  const mediaType = normalizeRaffleMediaType(rawRaffle.mediaType);
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
    mediaUrl: rawMediaUrl,
    mediaType,
    mediaFit: normalizeRaffleMediaFit(rawRaffle.mediaFit),
    homeTitle: safeText(rawRaffle.homeTitle, ""),
    homeSubtitle: safeText(rawRaffle.homeSubtitle, ""),
    homeHighlightText: safeText(rawRaffle.homeHighlightText, ""),
    editionLabel: safeText(rawRaffle.editionLabel || rawRaffle.homeEditionLabel || rawRaffle.heroEyebrow, "1ª EDIÇÃO"),
    homeEditionLabel: safeText(rawRaffle.homeEditionLabel || rawRaffle.editionLabel || rawRaffle.heroEyebrow, "1ª EDIÇÃO"),
    heroPrimaryButton: safeText(rawRaffle.heroPrimaryButton, "Participar agora"),
    drawDate: safeText(rawRaffle.drawDate, new Date().toISOString()),
    countdownEnabled: rawRaffle.countdownEnabled === true,
    countdownEndAt: safeText(rawRaffle.countdownEndAt, ""),
    salesEndAt: safeText(rawRaffle.salesEndAt, ""),
    manuallyClosedAt: safeText(rawRaffle.manuallyClosedAt, ""),
    countdownLabel: rawRaffle.countdownLabel ? String(rawRaffle.countdownLabel) : undefined
  } as Raffle;
}

function isVideoMediaType(type: unknown) {
  const normalized = String(type || "").trim().toLowerCase();
  return ["video", "youtube", "vimeo", "bunny"].includes(normalized);
}

function resolveHomeHeroMedia(raffle: Raffle) {
  const rawMedia = safeText(raffle.mediaUrl || (raffle as any).videoUrl, "");
  if (rawMedia) {
    return { mediaUrl: rawMedia, mediaType: raffle.mediaType, fallbackImageUrl: "", isVideo: isVideoMediaType(raffle.mediaType), hasMedia: true };
  }
  return { mediaUrl: "", mediaType: "image" as Raffle["mediaType"], fallbackImageUrl: "", isVideo: false, hasMedia: false };
}

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
  const { branding } = useTenantBranding();
  const [ranking, setRanking] = useState<RankingBuyer[]>([]);
  const [topSellers, setTopSellers] = useState<TopSellerRankingItem[]>([]);
  const [livePurchases, setLivePurchases] = useState<RankingBuyer[]>([]);
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

  useEffect(() => {
    startMetric("public_page_load");
  }, []);

  useEffect(() => {
    if (loadingRaffles) logPublicHome("loading");
  }, [loadingRaffles]);

  useEffect(() => {
    if (!loadingRaffles) logPublicHome("raffles_count", { count: activeRaffles.length });
  }, [activeRaffles.length, loadingRaffles]);

  useEffect(() => {
    if (!loadingRaffles) markPageLoaded({ page: "home", raffles: activeRaffles.length });
  }, [activeRaffles.length, loadingRaffles]);

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
        setRanking(asArray<RankingBuyer>(buyersPayload));
        setTopSellers(asArray<TopSellerRankingItem>(sellersPayload));
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
    if (!activeRaffles.length) {
      setLivePurchases([]);
      return;
    }
    let active = true;
    loadHomeRankings(activeRaffles)
      .then(payload => active && setLivePurchases(payload))
      .catch(() => active && setLivePurchases([]));
    return () => {
      active = false;
    };
  }, [activeRaffles]);

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

  if (loadingRaffles) return <RifaProLoading />;

  if (rafflesError) {
    logPublicHome("render_error", { reason: "raffles_api_failed" });
    return <PublicHomeFallback mode="error" onRetry={() => void refetchRaffles()} />;
  }

  if (!featuredRaffle) return <PublicHomeFallback mode="empty" onRetry={() => void refetchRaffles()} />;

  return (
    <PremiumPageLayout className="cfx-home-page cfx-home-premium-v1">
      <main className="cfx-v1-shell" aria-label="Home publica premium V1">
        <HomeV1Brand branding={branding} />
        <HomeV1Hero raffle={featuredRaffle} />
        <HomeV1Meta raffle={featuredRaffle} />
        <HomeV1LivePurchases items={livePurchases} />
        <HomeV1Rankings ranking={ranking} topSellers={topSellers} />
        <HomeV1Chances rewards={instantRewards} ranking={ranking} topSellers={topSellers} />
        <HomeV1Winners winners={winners} />
        <HomeV1FeaturedDraws raffles={secondaryRaffles} />
        <HomeV1StayInside branding={branding} />
        <HomeV1TrustStrip />
      </main>
    </PremiumPageLayout>
  );
}

function RifaProLoading() {
  return (
    <PremiumPageLayout className="cfx-home-page cfx-home-premium-v1">
      <main className="cfx-v1-shell">
        <div className="cfx-v1-skeleton cfx-v1-skeleton-brand" />
        <div className="cfx-v1-skeleton cfx-v1-skeleton-hero" />
      </main>
    </PremiumPageLayout>
  );
}

function HomeV1Brand({ branding }: { branding: any }) {
  const layout = branding?.home_branding?.brandLayout === "inline" ? "inline" : "centered";
  const name = safeText(branding?.display_name || branding?.header_name || branding?.company_name, "CIFHER");
  return (
    <header className={cn("cfx-v1-brand", layout === "inline" && "is-inline")}>
      {branding?.logo_url ? (
        <img src={branding.logo_url} alt={name} />
      ) : (
        <span className="cfx-v1-brand-mark"><Crown /></span>
      )}
      <strong>{name}</strong>
    </header>
  );
}

function HomeV1Hero({ raffle }: { raffle: Raffle }) {
  const heroMedia = resolveHomeHeroMedia(raffle);
  const isVideo = heroMedia.isVideo;
  const homeMediaAspect = resolveHomeMediaAspect(raffle, isVideo);
  const title = safeText(raffle.homeTitle || raffle.title, raffle.title);
  const subtitle = safeText(raffle.homeSubtitle || raffle.homeHighlightText || raffle.description, "ou prêmio especial no PIX");
  const editionLabel = safeText(raffle.editionLabel || raffle.homeEditionLabel, "1ª EDIÇÃO");

  return (
    <section className="cfx-v1-hero HomeV1Hero">
      <Link
        to={`/raffle/${raffle.id}`}
        className="cfx-v1-media"
        data-home-media-type={isVideo ? "video" : "image"}
        data-home-media-aspect={homeMediaAspect}
        aria-label={`Participar de ${title}`}
      >
        {heroMedia.hasMedia ? (
          <StandardRaffleMediaBlock
            mediaUrl={heroMedia.mediaUrl}
            mediaType={heroMedia.mediaType}
            title={title}
            href={`/raffle/${raffle.id}`}
            fallbackImageUrl=""
            priority
            showDescriptionBelow={false}
            preferredFit={resolveHomeMediaFit(raffle.mediaFit)}
            aspectMode={homeMediaAspect}
            className="cfx-v1-media-block cfx-home-media-block"
          />
        ) : (
          <div className="cfx-v1-media-empty">
            <Sparkles />
            <span>{title}</span>
          </div>
        )}
        <span className="cfx-v1-edition"><Crown /> {editionLabel}</span>
      </Link>

      <div className="cfx-v1-hero-copy">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <Link to={`/raffle/${raffle.id}`} className="cfx-v1-primary-cta">
        <Ticket /> Participar Agora
      </Link>
    </section>
  );
}

function HomeV1Meta({ raffle }: { raffle: Raffle }) {
  const progress = safeProgress(raffle);
  return (
    <section className="cfx-v1-meta HomeV1Meta">
      <div className="cfx-v1-meta-head">
        <span>Meta do sorteio</span>
        <strong>{progress.toFixed(0)}%</strong>
      </div>
      <div className="cfx-v1-progress" aria-label={`Meta do sorteio ${progress.toFixed(0)}%`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="cfx-v1-countdown"><Clock3 /> {countdownText(raffle)}</p>
      <div className="cfx-v1-trust-grid">
        <span><ShieldCheck /> 100%<br />Transparente</span>
        <span><CheckCircle2 /> Resultado<br />ao vivo</span>
        <span><Sparkles /> Pagamento<br />via PIX</span>
        <span><Gift /> Sorteio<br />auditado</span>
      </div>
    </section>
  );
}

function HomeV1LivePurchases({ items }: { items: RankingBuyer[] }) {
  const [visible, setVisible] = useState(3);
  const shown = items.slice(0, visible);
  if (!shown.length) return null;
  const nextVisible = visible === 3 ? 5 : 10;
  return (
    <section className="cfx-v1-card cfx-v1-live HomeV1LivePurchases">
      <header>
        <h2><span className="cfx-v1-live-dot" /> Compras ao vivo</h2>
        {items.length > visible && (
          <button type="button" onClick={() => setVisible(nextVisible)}>Ver Mais <ChevronRight /></button>
        )}
      </header>
      <div className="cfx-v1-live-list">
        {shown.map((buyer, index) => (
          <article key={`${buyer.phone || buyer.name}-${index}`}>
            <span />
            <strong>{maskBuyerName(buyer.name)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function HomeV1Rankings({ ranking, topSellers }: { ranking: RankingBuyer[]; topSellers: TopSellerRankingItem[] }) {
  return (
    <section className="cfx-v1-rankings HomeV1Rankings">
      <RankingCard title="Top compradores" icon={<Trophy />} names={ranking.slice(0, 3).map(item => item.name)} />
      <RankingCard title="Top vendedores" icon={<Handshake />} names={topSellers.slice(0, 3).map(item => item.affiliateName || item.affiliate || item.refCode)} />
    </section>
  );
}

function RankingCard({ title, icon, names }: { title: string; icon: ReactNode; names: string[] }) {
  if (!names.length) return null;
  return (
    <article className="cfx-v1-card cfx-v1-ranking-card">
      <h2>{icon}{title}</h2>
      <ol>
        {names.map((name, index) => (
          <li key={`${name}-${index}`}>
            <span>{index + 1}</span>
            <strong>{maskBuyerName(name)}</strong>
          </li>
        ))}
      </ol>
    </article>
  );
}

function HomeV1Chances({ rewards, ranking, topSellers }: { rewards: HomeInstantRewardsData; ranking: RankingBuyer[]; topSellers: TopSellerRankingItem[] }) {
  const cards = [
    rewards.superCotas.length ? { label: "Super Cota", icon: <Gift /> } : null,
    rewards.wheel.length ? { label: "Roleta Premiada", icon: <Sparkles /> } : null,
    rewards.mysteryBox.length ? { label: "Caixinha Premiada", icon: <Gift /> } : null,
    rewards.scratchcard.length ? { label: "Raspadinha", icon: <Ticket /> } : null,
    rewards.wheel.length || rewards.mysteryBox.length ? { label: "Hora Premiada", icon: <Zap /> } : null,
    rewards.superCotas.length > 1 ? { label: "Chance em Dobro", icon: <Rocket /> } : null,
    ranking.length ? { label: "Top Compradores", icon: <Trophy /> } : null,
    topSellers.length ? { label: "Top Vendedores", icon: <Handshake /> } : null
  ].filter((item): item is { label: string; icon: ReactNode } => Boolean(item));

  if (!cards.length) return null;

  return (
    <section className="cfx-v1-card cfx-v1-chances HomeV1Chances">
      <h2><Gift /> Muitas chances de ganhar</h2>
      <div className="cfx-v1-chance-grid">
        {cards.map(card => (
          <article key={card.label}>{card.icon}<span>{card.label}</span></article>
        ))}
      </div>
    </section>
  );
}

function HomeV1Winners({ winners }: { winners: Winner[] }) {
  return (
    <section className="cfx-v1-card cfx-v1-winners HomeV1Winners">
      <header>
        <h2><Trophy /> Ganhadores reais</h2>
        {winners.length > 0 && <Link to="/ganhadores">Ver todos <ChevronRight /></Link>}
      </header>
      {winners.length ? (
        <div className="cfx-v1-winner-row">
          {winners.slice(0, 4).map((winner, index) => (
            <article key={winner.id || `${winner.winnerName}-${index}`}>
              {winner.mediaUrl ? <img src={winner.mediaUrl} alt="" loading="lazy" /> : <span>{maskBuyerName(winner.winnerName).slice(0, 1)}</span>}
              <strong>{maskBuyerName(winner.winnerName)}</strong>
              <small>{safeText(winner.prizeDescription || winner.raffleName, "Prêmio confirmado")}</small>
            </article>
          ))}
        </div>
      ) : (
        <div className="cfx-v1-empty">
          <Rocket />
          <strong>Você pode ser o primeiro ganhador</strong>
          <span>Esta é a primeira edição. Seu nome pode aparecer aqui.</span>
        </div>
      )}
    </section>
  );
}

function HomeV1FeaturedDraws({ raffles }: { raffles: Raffle[] }) {
  return (
    <section className="cfx-v1-card cfx-v1-draws HomeV1FeaturedDraws">
      <header>
        <h2><Star /> Sorteios em destaque</h2>
        {raffles.length > 0 && <Link to="/sorteios">Ver todos <ChevronRight /></Link>}
      </header>
      {raffles.length ? (
        <div className="cfx-v1-draw-list">
          {raffles.slice(0, 3).map(raffle => (
            <article key={raffle.id}>
              <Link to={`/raffle/${raffle.id}`} className="cfx-v1-draw-media">
                <StandardRaffleMediaBlock
                  mediaUrl={raffle.mediaUrl}
                  mediaType={raffle.mediaType}
                  fallbackImageUrl=""
                  title={raffle.title}
                  showDescriptionBelow={false}
                  preferredFit={resolveHomeMediaFit(raffle.mediaFit)}
                  aspectMode="square"
                  className="cfx-v1-draw-media-block"
                />
              </Link>
              <div>
                <strong>{raffle.title}</strong>
                <Link to={`/raffle/${raffle.id}`}>Participar</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="cfx-v1-empty">
          <Star />
          <strong>Novos sorteios chegando</strong>
          <span>Os próximos sorteios aparecerão aqui.</span>
        </div>
      )}
    </section>
  );
}

function HomeV1StayInside({ branding }: { branding: any }) {
  const homeBranding = branding?.home_branding || {};
  const links = [
    { label: "WhatsApp", href: safeText(homeBranding.whatsapp || branding?.landing?.whatsapp || branding?.support_whatsapp, ""), icon: <MessageCircle /> },
    { label: "Instagram", href: safeText(homeBranding.instagram || branding?.landing?.instagram, ""), icon: <Instagram /> },
    { label: "Grupo Oficial", href: safeText(homeBranding.officialGroup, ""), icon: <Globe2 /> }
  ].filter(item => item.href);

  if (!links.length) return null;

  return (
    <section className="cfx-v1-card cfx-v1-inside HomeV1StayInside">
      <h2><Globe2 /> Fique por dentro</h2>
      <p>Acompanhe novidades, ganhadores, promoções e sorteios.</p>
      <div>
        {links.map(link => (
          <a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.icon}{link.label}</a>
        ))}
      </div>
    </section>
  );
}

function HomeV1TrustStrip() {
  return (
    <section className="cfx-v1-safe-strip HomeV1TrustStrip">
      <span><Zap /> PIX Imediato</span>
      <span><ShieldCheck /> Compra Segura</span>
      <span><CheckCircle2 /> Sorteio Transparente</span>
      <span><MessageCircle /> Suporte Premium</span>
    </section>
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
    current.tickets = Number(current.tickets || 0) + Number(buyer.tickets || 0);
    current.amount = Number(current.amount || 0) + Number(buyer.amount || 0);
    byBuyer.set(key, current);
  });
  return [...byBuyer.values()].sort((a, b) => Number(b.tickets || 0) - Number(a.tickets || 0) || Number(b.amount || 0) - Number(a.amount || 0)).slice(0, 10);
}

async function loadHomeInstantRewards(raffle: Raffle): Promise<HomeInstantRewardsData> {
  const raffleId = encodeURIComponent(raffle.id);
  const [instantPrizesPayload, superCotasPayload, gamificationPayload] = await Promise.all([
    safeJson(`/api/raffles/${raffleId}/instant-prizes`),
    safeJson(`/api/public/raffles/${raffleId}/super-cotas`),
    safeJson(`/api/raffles/${raffleId}/gamification`)
  ]);

  return {
    superCotas: buildSuperCotaRewards(instantPrizesPayload, superCotasPayload),
    wheel: buildWheelRewards(raffle),
    scratchcard: buildScratchcardRewards(gamificationPayload),
    mysteryBox: buildMysteryBoxRewards(raffle, gamificationPayload)
  };
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

  return asArray(instantPrizesPayload)
    .map((prize: any, index) => {
      const number = Number(prize?.numeroPremiado);
      const value = Number(prize?.valorPremio);
      if (!Number.isFinite(number)) return null;
      const winner = winners.get(number);
      return {
        id: String(prize?.id || `super-cota-${number}-${index}`),
        number,
        prize: value > 0 ? formatCurrency(value) : "Super Cota",
        value: Number.isFinite(value) ? value : undefined,
        buyerName: safeText(prize?.winnerName || prize?.ganhadorNome || prize?.nomeGanhador, "") || winner?.name,
        status: normalizeRewardStatus(prize?.status)
      } satisfies HomeRewardItem;
    })
    .filter(Boolean) as HomeRewardItem[];
}

function buildWheelRewards(raffle: Raffle): HomeRewardItem[] {
  const config = (raffle.lootboxConfig || {}) as any;
  const wheelEnabled = Boolean(config?.rewardModes?.wheel || config?.experienceType === "wheel");
  if (!wheelEnabled) return [];
  return asArray(config.wheelSegments)
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
    })
    .filter(Boolean) as HomeRewardItem[];
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
  const configured = asArray(config.milestones)
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
    })
    .filter(Boolean) as HomeRewardItem[];

  if (configured.length) return configured;

  return asArray(gamificationPayload?.mysteryBox?.boxes)
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
    })
    .filter(Boolean) as HomeRewardItem[];
}

function formatCurrency(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "Prêmio";
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function countdownText(raffle: Raffle) {
  if (raffle.countdownLabel) return raffle.countdownLabel;
  const target = raffle.salesEndAt || raffle.countdownEndAt || raffle.drawDate;
  const date = target ? new Date(target) : null;
  if (!date || Number.isNaN(date.getTime())) return "Sorteio em breve";
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "Sorteio em breve";
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  if (days > 0) return `Sorteio em ${String(days).padStart(2, "0")} dias ${hours}h`;
  return `Sorteio em ${Math.max(1, hours)}h`;
}

function maskBuyerName(name?: string) {
  const text = safeText(name, "Participante");
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "Participante";
  return `${parts[0]} ${parts[1].slice(0, 1)}.`;
}
