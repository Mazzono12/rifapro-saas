import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Zap, Activity, Terminal, ChevronRight, PlayCircle } from "lucide-react";
import { StoriesSection } from "../components/StoriesSection";
import { WinnersGallery } from "../components/WinnersGallery";
import { MessageVideoPlayer, normalizeMessageVideoConfig } from "../components/MessageVideoPlayer";
import { FazendinhaSection } from "../components/FazendinhaSection";
import { ModalidadesSection } from "../components/ModalidadesSection";
import { useRaffles, useGlobalSettings } from "../hooks/useRaffles";
import { cn } from "../lib/utils";
import { PremiumEmptyState, PremiumPageLayout, TrustBadges } from "../components/premium/PremiumUI";

export function Home() {
  const { data: raffles = [], isLoading: loadingRaffles } = useRaffles();
  const { data: settings = { storiesPosition: 'bottom' }, isLoading: loadingSettings } = useGlobalSettings();
  const activeRaffles = raffles.filter(raffle => raffle.status === "active");
  const featuredRaffle = activeRaffles[0];
  const secondaryRaffles = activeRaffles.slice(1);
  const featuredVideoConfig = normalizeMessageVideoConfig(featuredRaffle?.videoConfig || settings.mainVideoPlayer);
  const [heroCinemaMode, setHeroCinemaModeState] = useState(false);
  const setHeroCinemaMode = useCallback((active: boolean) => {
    const nextActive = Boolean(active && featuredVideoConfig.focusModeEnabled);
    setHeroCinemaModeState(nextActive);
    window.dispatchEvent(new CustomEvent("rifapro:hero-video-cinema", {
      detail: { active: nextActive && featuredVideoConfig.hideHeaderOnPlay }
    }));
  }, [featuredVideoConfig.focusModeEnabled, featuredVideoConfig.hideHeaderOnPlay]);

  useEffect(() => {
    if (!featuredRaffle || !featuredVideoConfig.focusModeEnabled) return;
    let topTimer: number | undefined;
    const clearTopTimer = () => {
      window.clearTimeout(topTimer);
      topTimer = undefined;
    };
    const onScroll = () => {
      clearTopTimer();
      if (window.scrollY > 24) {
        setHeroCinemaMode(false);
        return;
      }
      if (featuredVideoConfig.autoplay && featuredVideoConfig.autoFocusOnAutoplay) {
        topTimer = window.setTimeout(() => setHeroCinemaMode(true), featuredVideoConfig.refocusOnTopDelaySeconds * 1000);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTopTimer();
      setHeroCinemaMode(false);
    };
  }, [
    featuredRaffle?.id,
    featuredVideoConfig.autoFocusOnAutoplay,
    featuredVideoConfig.autoplay,
    featuredVideoConfig.focusModeEnabled,
    featuredVideoConfig.refocusOnTopDelaySeconds,
    setHeroCinemaMode
  ]);

  useEffect(() => {
    let frame = 0;
    const syncVisibleVideo = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const videos = Array.from(document.querySelectorAll("video"));
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const scored = videos.map(video => {
          const rect = video.getBoundingClientRect();
          const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
          const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
          const visibleArea = visibleHeight * visibleWidth;
          const totalArea = Math.max(1, rect.height * rect.width);
          return { video, ratio: visibleArea / totalArea, area: totalArea };
        });
        const manualWinner = scored
          .filter(item => item.area > 10000 && item.ratio >= 0.25 && item.video.dataset.rifaproAutoplay === "false" && !item.video.paused)
          .sort((a, b) => b.ratio - a.ratio)[0]?.video;
        const winner = manualWinner ?? scored
          .filter(item => item.area > 10000 && item.ratio >= 0.35 && item.video.dataset.rifaproAutoplay !== "false")
          .sort((a, b) => b.ratio - a.ratio)[0]?.video;

        scored.forEach(({ video }) => {
          if (video === winner) {
            if (video.dataset.rifaproMuted) video.muted = video.dataset.rifaproMuted === "true";
            if (video.dataset.rifaproAutoplay !== "false" && video.paused && video.dataset.rifaproUserPaused !== "true") {
              video.play().catch(() => null);
            }
          } else if (!video.paused) {
            video.muted = true;
            video.pause();
          }
        });
      });
    };

    syncVisibleVideo();
    window.addEventListener("scroll", syncVisibleVideo, { passive: true });
    window.addEventListener("resize", syncVisibleVideo);
    const interval = window.setInterval(syncVisibleVideo, 900);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", syncVisibleVideo);
      window.removeEventListener("resize", syncVisibleVideo);
      window.clearInterval(interval);
    };
  }, []);

  const loading = loadingRaffles || loadingSettings;

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

  const hasStoryPlacement = (placement: string, legacyPosition: string) => {
    if (Array.isArray(settings.storiesPlacements)) return settings.storiesPlacements.includes(placement);
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

  const featuredProgress = featuredRaffle
    ? (featuredRaffle.progressOverride ?? (featuredRaffle.soldTickets / featuredRaffle.totalTickets * 100))
    : 0;
  const heroPlacement = featuredRaffle?.heroContentPlacement || "below";
  const heroEyebrow = featuredRaffle?.heroEyebrow || "Plataforma de rifas premium";
  const heroTitle = featuredRaffle?.heroTitle || "Sorteios com experiência cinematográfica.";
  const heroSubtitle = featuredRaffle?.heroSubtitle || (featuredRaffle ? `Participe de ${featuredRaffle.title}. Vídeo em tela cheia, ranking ao vivo, cotas premiadas, PIX e caixinha surpresa.` : "");
  const heroPrimaryButton = featuredRaffle?.heroPrimaryButton || "Participar agora";
  const heroSecondaryText = featuredRaffle?.heroSecondaryText || "";
  const heroShowStats = featuredRaffle?.heroShowStats !== false;
  const heroTextTone = "text-white";
  const heroMutedTone = "text-slate-200";
  const heroStatsClass = heroPlacement === "below"
    ? "border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)]"
    : "border-white/18 bg-black/34 text-white";
  const heroContent = featuredRaffle ? (
    <div className={heroPlacement === "below" ? "mx-auto max-w-7xl px-4 py-10 md:py-14" : "relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl items-end px-4 pb-14 pt-24 md:items-center md:pb-24"}>
      <div className="max-w-3xl">
        {heroEyebrow && (
          <div className={cn("mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] backdrop-blur-2xl", heroPlacement === "below" ? "border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-muted)]" : "border-white/20 bg-white/10 text-white")}>
            <Zap className="h-3.5 w-3.5 fill-[var(--theme-primary)] text-[var(--theme-primary)]" />
            {heroEyebrow}
          </div>
        )}

        <h1 className={cn("mb-6 max-w-4xl text-5xl font-black leading-[0.92] md:text-7xl xl:text-8xl", heroTextTone)}>
          {heroTitle}
        </h1>

        {heroSubtitle && (
          <p className={cn("mb-8 max-w-2xl text-lg leading-relaxed md:text-2xl", heroMutedTone)}>
            {heroSubtitle}
          </p>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link to={`/raffle/${featuredRaffle.id}`} className="neon-button px-8 py-4 text-sm">
            {heroPrimaryButton} <ChevronRight className="h-4 w-4" />
          </Link>
          {heroShowStats && (
            <div className={cn("inline-flex items-center gap-4 rounded-full border px-6 py-4 text-xs font-bold backdrop-blur-2xl", heroStatsClass)}>
              <PlayCircle className="h-5 w-5 text-[var(--theme-primary)]" />
              <span>{(featuredRaffle.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/cota</span>
              <span className="h-5 w-px bg-current opacity-20" />
              <span>{featuredProgress.toFixed(1)}% vendido</span>
            </div>
          )}
        </div>
        {heroSecondaryText && (
          <p className={cn("mt-5 text-sm font-semibold", heroMutedTone)}>{heroSecondaryText}</p>
        )}
        <div className="mt-5">
          <TrustBadges />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <PremiumPageLayout className="w-full relative pb-40">
      {!heroCinemaMode && renderStories('top')}
      {!heroCinemaMode && renderStories('floating-left')}
      {!heroCinemaMode && renderStories('floating-right')}

      <div className="w-full max-w-7xl mx-auto px-4 pb-8 pt-0 space-y-16">
        {/* 1. Featured Prize (Top) */}
        {featuredRaffle && (
          <section
            onWheel={event => {
              if (!heroCinemaMode) return;
              setHeroCinemaMode(false);
              if (event.deltaY > 0) {
                document.documentElement.scrollTop += event.deltaY;
                document.body.scrollTop += event.deltaY;
              }
            }}
            className={cn(
            "relative left-1/2 w-screen -translate-x-1/2 overflow-hidden",
            heroPlacement === "below" ? "bg-[var(--theme-bg)]" : "min-h-[calc(100svh-4rem)] bg-black",
            heroCinemaMode && "min-h-[100svh]"
          )}>
            <div className={cn(
              "relative overflow-hidden bg-black transition-all duration-300",
              heroPlacement === "below" ? "min-h-[62svh]" : "absolute inset-0",
              heroCinemaMode && "absolute inset-0 z-[45] min-h-[100svh]"
            )}>
              {featuredRaffle.mediaType ? (
                <MessageVideoPlayer
                  mediaUrl={featuredRaffle.mediaUrl!}
                  mediaType={featuredRaffle.mediaType}
                  config={featuredRaffle.videoConfig || settings.mainVideoPlayer}
                  mediaFit={featuredRaffle.mediaFit === "fill" ? "fill" : "contain"}
                  className="absolute inset-0 h-full w-full"
                  onCinemaModeChange={setHeroCinemaMode}
                  singleAutoplayGroup="home-raffles"
                />
              ) : (
                <img src={featuredRaffle.image} alt={featuredRaffle.title} className={`absolute inset-0 h-full w-full ${featuredRaffle.mediaFit === "fill" ? "object-fill" : "object-contain"}`} />
              )}
              {!heroCinemaMode && (
                <>
                  <div className={cn("pointer-events-none absolute inset-0", heroPlacement === "below" ? "bg-gradient-to-t from-[var(--theme-bg)]/40 via-transparent to-transparent" : "bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.44)_44%,rgba(0,0,0,0.14)_100%)]")} />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[var(--theme-bg)] via-[var(--theme-bg)]/70 to-transparent" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(0,173,239,0.24),transparent_30%)]" />
                </>
              )}
            </div>
            {(heroPlacement === "below" || !heroCinemaMode || !featuredVideoConfig.hideHeroInfoOnPlay) && heroContent}

            {!heroCinemaMode && <div className="absolute bottom-4 left-1/2 z-10 h-1.5 w-20 -translate-x-1/2 rounded-full bg-white/45" />}
        </section>
      )}

      {!featuredRaffle && (
        <section className="mx-auto max-w-3xl pt-28">
          <PremiumEmptyState
            title="Nenhuma campanha ativa no momento"
            description="Quando uma nova campanha for publicada pelo tenant, ela aparece aqui com banner, cotas rapidas, PIX e CTA de compra."
            action={<Link to="/transparencia" className="premium-button mt-4 px-5">Ver transparencia</Link>}
          />
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
          const progress = raffle.progressOverride ?? (raffle.soldTickets / raffle.totalTickets) * 100;
          const raffleVideoConfig = normalizeMessageVideoConfig(raffle.videoConfig || settings.mainVideoPlayer);
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
                {raffle.mediaType ? (
                  <MessageVideoPlayer
                    mediaUrl={raffle.mediaUrl!}
                    mediaType={raffle.mediaType}
                    mediaFit={raffle.mediaFit === "fill" ? "fill" : "contain"}
                    className="absolute inset-0 h-full w-full"
                    config={{
                      ...raffleVideoConfig,
                      autoplay: true,
                      startMuted: false,
                      tapToUnmute: false,
                      tapToTogglePlay: true,
                      pauseAudioOnScroll: false,
                      showControls: false,
                      focusModeEnabled: false,
                      hideHeaderOnPlay: false,
                      hideHeroInfoOnPlay: false
                    }}
                    singleAutoplayGroup="home-raffles"
                  />
                ) : (
                  <img 
                    src={raffle.image} 
                    alt={raffle.title}
                    className={`absolute inset-0 h-full w-full ${raffle.mediaFit === "fill" ? "object-fill" : "object-contain"}`}
                  />
                )}
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
                      className="neon-button px-8 py-4 text-sm"
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

    {!heroCinemaMode && renderStories('bottom')}
    </PremiumPageLayout>
  );
}
