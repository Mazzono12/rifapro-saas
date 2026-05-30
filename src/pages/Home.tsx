import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Zap, Activity, Terminal, ChevronRight, PlayCircle } from "lucide-react";
import { StoriesSection } from "../components/StoriesSection";
import { WinnersGallery } from "../components/WinnersGallery";
import { CampaignMediaHero } from "../components/CampaignMediaHero";
import { StandardRaffleMediaBlock } from "../components/StandardRaffleMediaBlock";
import { FazendinhaSection } from "../components/FazendinhaSection";
import { ModalidadesSection } from "../components/ModalidadesSection";
import { useRaffles, useGlobalSettings } from "../hooks/useRaffles";
import { cn } from "../lib/utils";
import { PremiumButton, PremiumEmptyState, PremiumErrorState, PremiumPageLayout, TrustBadges } from "../components/premium/PremiumUI";
import { markPageLoaded, startMetric } from "../lib/performanceMetrics";
import type { Raffle } from "../types";

const fallbackHomeSettings = {
  storiesPosition: "bottom",
  storiesPlacements: undefined as string[] | undefined,
  mainVideoPlayer: undefined as unknown
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
  if (!import.meta.env.PROD) return;
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
              description="Este tenant ainda nao possui uma campanha ativa publicada. Assim que uma rifa for ativada, ela aparece aqui automaticamente."
              action={<PremiumButton onClick={onRetry || (() => window.location.reload())} className="mt-4 px-5">Tentar novamente</PremiumButton>}
            />
          )}
        </div>
      </div>
    </PremiumPageLayout>
  );
}

function normalizePublicRaffle(raffle: Partial<Raffle> | null | undefined): Raffle | null {
  if (!raffle || !raffle.id) return null;
  const rawRaffle = raffle as Partial<Raffle> & { imageUrl?: string };
  const price = Number(rawRaffle.price);
  const totalTickets = Math.max(1, Math.floor(Number(rawRaffle.totalTickets)));
  const soldTickets = Math.max(0, Math.floor(Number(rawRaffle.soldTickets)));
  return {
    ...rawRaffle,
    id: String(rawRaffle.id),
    title: String(rawRaffle.title || "Campanha sem titulo"),
    description: String(rawRaffle.description || "Campanha ativa com cotas disponíveis."),
    price: Number.isFinite(price) ? price : 0,
    totalTickets: Number.isFinite(totalTickets) ? totalTickets : 1,
    soldTickets: Number.isFinite(soldTickets) ? soldTickets : 0,
    status: rawRaffle.status || "active",
    image: rawRaffle.image || rawRaffle.imageUrl || "",
    mediaUrl: rawRaffle.mediaUrl || rawRaffle.image || rawRaffle.imageUrl || "",
    drawDate: rawRaffle.drawDate || new Date().toISOString()
  } as Raffle;
}

function safeProgress(raffle: Raffle) {
  const total = Math.max(1, Number(raffle.totalTickets || 1));
  const sold = Math.max(0, Number(raffle.soldTickets || 0));
  const progress = Number(raffle.progressOverride ?? (sold / total) * 100);
  return Math.min(100, Math.max(0, Number.isFinite(progress) ? progress : 0));
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
  const secondaryRaffles = activeRaffles.slice(1);

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
        <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="pointer-events-auto w-[120px]">
            <StoriesSection />
          </div>
        </div>
      );
    }
    
    if (position === 'floating-right') {
      return (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="pointer-events-auto w-[120px]">
            <StoriesSection />
          </div>
        </div>
      );
    }

    if (position === 'top') {
      return (
        <div className="w-full pt-8 pb-4 border-b border-white/5">
          <StoriesSection />
        </div>
      );
    }

    // Default 'bottom'
    return (
      <div className="fixed bottom-0 inset-x-0 z-50 pointer-events-none pb-4 bg-gradient-to-t from-black via-black/80 to-transparent pt-12">
        <div className="pointer-events-auto w-full max-w-7xl mx-auto flex justify-center">
          <StoriesSection />
        </div>
      </div>
    );
  };

  const featuredProgress = safeProgress(featuredRaffle);

  return (
    <PremiumPageLayout className="w-full relative pb-40">
      {renderStories('top')}
      {renderStories('floating-left')}
      {renderStories('floating-right')}

      <div className="w-full max-w-7xl mx-auto px-4 pb-8 pt-0 space-y-16">
        {/* 1. Featured Prize (Top) */}
        {featuredRaffle && (
          <section className="relative left-1/2 w-screen -translate-x-1/2 bg-[var(--theme-bg)] px-4">
            <div className="mx-auto max-w-7xl">
              <StandardRaffleMediaBlock
                mediaUrl={featuredRaffle.mediaUrl || featuredRaffle.image}
                mediaType={(featuredRaffle.mediaType || "image") as any}
                title={featuredRaffle.title}
                description={featuredRaffle.description}
                price={featuredRaffle.price}
                showDescriptionBelow
                noOverlay
                href={`/raffle/${featuredRaffle.id}`}
                ctaLabel={featuredRaffle.heroPrimaryButton || "Participar agora"}
                progress={featuredProgress}
                soldTickets={featuredRaffle.soldTickets}
                totalTickets={featuredRaffle.totalTickets}
                priority
                className="rounded-none border-x-0 sm:rounded-[1.25rem] sm:border-x"
              />
              <div className="mt-5">
                <TrustBadges />
              </div>
            </div>
          </section>
      )}

      <ModalidadesSection />
      <FazendinhaSection />

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["PIX automatico", "Pagamento com confirmacao em tempo real e reserva de cotas."],
          ["Suporte WhatsApp", "Contato rapido antes, durante e depois da compra."],
          ["Sorteio auditavel", "Campanhas com status, progresso e comprovantes rastreaveis."],
          ["Gamificacao", "Roletas, caixinhas e raspadinhas integradas ao checkout."]
        ].map(([title, description]) => (
          <article key={title} className="premium-card p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--theme-primary)]">{title}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--theme-muted)]">{description}</p>
          </article>
        ))}
      </section>

      <div className="flex items-center justify-between mb-8 pt-8 border-t border-[var(--theme-border)]">
        <h2 className="text-3xl md:text-5xl font-black flex items-center gap-3 text-[var(--theme-text)]">
          <Terminal className="w-6 h-6 text-[var(--theme-primary)]" />
          Rifas ativas
        </h2>
      </div>

      <div className="space-y-14">
        {secondaryRaffles.map((raffle, idx) => {
          const progress = safeProgress(raffle);
          return (
            <motion.section
              key={raffle.id}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: idx * 0.1 }}
              className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-[var(--theme-bg)]"
            >
              <div className="relative min-h-[68svh] overflow-hidden bg-black md:min-h-[82svh]">
                <CampaignMediaHero
                  mediaUrl={raffle.mediaUrl || raffle.image}
                  mediaType={(raffle.mediaType || "image") as any}
                  mediaFit={raffle.mediaFit === "fill" ? "fill" : "cover"}
                  title={raffle.title}
                  overlay={false}
                  className="absolute inset-0 h-full w-full"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[var(--theme-bg)] via-[var(--theme-bg)]/70 to-transparent" />
                <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg backdrop-blur-xl">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Ativo</span>
                </div>
              </div>
              
              <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
                <div className="max-w-3xl">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--theme-muted)]">
                    <Zap className="h-3.5 w-3.5 fill-[var(--theme-primary)] text-[var(--theme-primary)]" />
                    Sorteio ativo
                  </div>
                  <h3 className="mb-5 max-w-4xl text-4xl font-black leading-none text-[var(--theme-text)] md:text-6xl">
                    {raffle.title}
                  </h3>
                  <p className="mb-7 max-w-2xl text-lg leading-relaxed text-[var(--theme-muted)] md:text-xl">
                    {raffle.description}
                  </p>

                  <div className="mb-7 max-w-2xl">
                    <div className="mb-3 flex justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--theme-muted)]">
                      <span>{progress.toFixed(1)}% vendido</span>
                      <span>{raffle.soldTickets.toLocaleString()} / {raffle.totalTickets.toLocaleString()}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--theme-border)]">
                      <div
                        className="h-full rounded-full bg-[var(--theme-primary)] shadow-[0_0_15px_var(--theme-glow)]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    {raffle.countdownLabel && (
                      <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-[var(--theme-muted)]">{raffle.countdownLabel}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Link
                      to={`/raffle/${raffle.id}`}
                      className="premium-button px-8 py-4 text-sm"
                    >
                      Participar agora <ChevronRight className="h-4 w-4" />
                    </Link>
                    <div className="inline-flex items-center gap-4 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-6 py-4 text-xs font-bold text-[var(--theme-text)] backdrop-blur-2xl">
                      <PlayCircle className="h-5 w-5 text-[var(--theme-primary)]" />
                      <span>{raffle.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/cota</span>
                      <span className="h-5 w-px bg-current opacity-20" />
                      <span>{progress.toFixed(1)}% vendido</span>
                    </div>
                  </div>
                  {raffle.countdownLabel && (
                    <p className="mt-5 text-sm font-semibold text-[var(--theme-muted)]">{raffle.countdownLabel}</p>
                  )}
                </div>
              </div>
            </motion.section>
          );
        })}
      </div>

      <section>
        <WinnersGallery />
      </section>
    </div>

    {renderStories('bottom')}
    </PremiumPageLayout>
  );
}
