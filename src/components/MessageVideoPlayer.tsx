import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { extractVimeoId, extractYouTubeId, getBunnyEmbedUrl, inferMediaType } from "../utils/media";
import { cn } from "../lib/utils";

type PlaybackEntry = {
  id: string;
  ratio: number;
  eligible: boolean;
  play: () => void;
  pause: () => void;
};

const playbackGroups = new Map<string, Map<string, PlaybackEntry>>();

function evaluatePlaybackGroup(group: string) {
  const entries = playbackGroups.get(group);
  if (!entries) return;
  const winner = Array.from(entries.values())
    .filter(entry => entry.eligible && entry.ratio >= 0.45)
    .sort((a, b) => b.ratio - a.ratio)[0];

  entries.forEach(entry => {
    if (winner && entry.id === winner.id) {
      entry.play();
    } else {
      entry.pause();
    }
  });
}

export type MessageVideoConfig = {
  enabled: boolean;
  autoplay: boolean;
  allowPause: boolean;
  allowMute: boolean;
  allowRewind: boolean;
  startMuted: boolean;
  tapToUnmute: boolean;
  tapToTogglePlay: boolean;
  unmuteOnViewMotion: boolean;
  pauseAudioOnScroll: boolean;
  focusModeEnabled: boolean;
  autoFocusOnAutoplay: boolean;
  hideHeaderOnPlay: boolean;
  hideHeroInfoOnPlay: boolean;
  refocusOnTopDelaySeconds: number;
  autoplayCardsOnView: boolean;
  cardsAutoplayThreshold: number;
  initialVolume: number;
  showControls: boolean;
  labels?: {
    play?: string;
    pause?: string;
    mute?: string;
    unmute?: string;
    rewind?: string;
    tapToUnmute?: string;
    volume?: string;
  };
};

const defaultConfig: MessageVideoConfig = {
  enabled: true,
  autoplay: true,
  allowPause: true,
  allowMute: true,
  allowRewind: true,
  startMuted: false,
  tapToUnmute: false,
  tapToTogglePlay: true,
  unmuteOnViewMotion: false,
  pauseAudioOnScroll: false,
  focusModeEnabled: true,
  autoFocusOnAutoplay: true,
  hideHeaderOnPlay: true,
  hideHeroInfoOnPlay: true,
  refocusOnTopDelaySeconds: 3,
  autoplayCardsOnView: true,
  cardsAutoplayThreshold: 55,
  initialVolume: 40,
  showControls: false,
  labels: {
    play: "Play",
    pause: "Pause",
    mute: "Mutar",
    unmute: "Ouvir",
    rewind: "Voltar 10s",
    tapToUnmute: "Toque para ouvir",
    volume: "Vol."
  }
};

export function normalizeMessageVideoConfig(config?: Partial<MessageVideoConfig>): MessageVideoConfig {
  return {
    ...defaultConfig,
    ...(config || {}),
    initialVolume: Math.min(100, Math.max(0, Number(config?.initialVolume ?? defaultConfig.initialVolume))),
    refocusOnTopDelaySeconds: Math.min(30, Math.max(0, Number(config?.refocusOnTopDelaySeconds ?? defaultConfig.refocusOnTopDelaySeconds))),
    cardsAutoplayThreshold: Math.min(100, Math.max(10, Number(config?.cardsAutoplayThreshold ?? defaultConfig.cardsAutoplayThreshold))),
    labels: {
      ...defaultConfig.labels,
      ...(config?.labels || {})
    }
  };
}

export function MessageVideoPlayer({
  mediaUrl,
  mediaType,
  config,
  className,
  mediaFit = "cover",
  onCinemaModeChange,
  onPlaybackStateChange,
  singleAutoplayGroup,
}: {
  mediaUrl: string;
  mediaType?: "image" | "video" | "youtube" | "vimeo" | "bunny";
  config?: Partial<MessageVideoConfig>;
  className?: string;
  mediaFit?: "cover" | "contain" | "fill";
  onCinemaModeChange?: (active: boolean) => void;
  onPlaybackStateChange?: (playing: boolean) => void;
  singleAutoplayGroup?: string;
}) {
  const finalType = mediaType || inferMediaType(mediaUrl);
  const options = normalizeMessageVideoConfig(config);
  const labels = options.labels || {};
  const fitClass = mediaFit === "contain" ? "object-contain" : mediaFit === "fill" ? "object-fill" : "object-cover";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [muted, setMuted] = useState(options.startMuted);
  const [playing, setPlaying] = useState(options.autoplay);
  const [scrolledMuted, setScrolledMuted] = useState(false);
  const [externalStarted, setExternalStarted] = useState(false);
  const playbackIdRef = useRef(`video-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || finalType !== "video") return;
    video.volume = options.initialVolume / 100;
    video.muted = muted;
    if (options.autoplay && !singleAutoplayGroup) {
      video.play().then(() => {
        setPlaying(true);
        onPlaybackStateChange?.(true);
      }).catch(() => {
        setPlaying(false);
        onPlaybackStateChange?.(false);
      });
    }
  }, [finalType, mediaUrl, singleAutoplayGroup]);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!singleAutoplayGroup || finalType !== "video" || !video || !container) return;

    const id = playbackIdRef.current;
    const groupEntries = playbackGroups.get(singleAutoplayGroup) || new Map<string, PlaybackEntry>();
    playbackGroups.set(singleAutoplayGroup, groupEntries);

    const entry: PlaybackEntry = {
      id,
      ratio: 0,
      eligible: options.autoplay,
      play: () => {
        if (video.dataset.rifaproUserPaused === "true") return;
        if (!options.autoplay || !video.paused) return;
        video.muted = options.startMuted;
        setMuted(options.startMuted);
        video.play().then(() => {
          setPlaying(true);
          onPlaybackStateChange?.(true);
          if (options.focusModeEnabled) onCinemaModeChange?.(true);
        }).catch(() => {
          setPlaying(false);
          onPlaybackStateChange?.(false);
        });
      },
      pause: () => {
        if (video.paused) return;
        video.pause();
        setPlaying(false);
        onPlaybackStateChange?.(false);
        if (options.focusModeEnabled) onCinemaModeChange?.(false);
      }
    };
    groupEntries.set(id, entry);

    const observer = new IntersectionObserver(entries => {
      entry.ratio = entries[0]?.intersectionRatio || 0;
      entry.eligible = Boolean(options.autoplay && entries[0]?.isIntersecting && video.dataset.rifaproUserPaused !== "true");
      evaluatePlaybackGroup(singleAutoplayGroup);
    }, { threshold: [0, 0.2, 0.45, 0.6, 0.8, 1] });

    observer.observe(container);
    evaluatePlaybackGroup(singleAutoplayGroup);

    return () => {
      observer.disconnect();
      entry.pause();
      groupEntries.delete(id);
      if (groupEntries.size === 0) {
        playbackGroups.delete(singleAutoplayGroup);
      } else {
        evaluatePlaybackGroup(singleAutoplayGroup);
      }
    };
  }, [
    finalType,
    mediaUrl,
    onCinemaModeChange,
    onPlaybackStateChange,
    options.autoplay,
    options.focusModeEnabled,
    singleAutoplayGroup
  ]);

  useEffect(() => {
    return () => onCinemaModeChange?.(false);
  }, [onCinemaModeChange]);

  useEffect(() => {
    if (!onCinemaModeChange || !options.focusModeEnabled || !options.autoFocusOnAutoplay || !options.autoplay || finalType === "image") return;
    const timer = window.setTimeout(() => {
      setExternalStarted(true);
      onCinemaModeChange(true);
      if (finalType === "youtube") {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
      }
      if (finalType === "vimeo") {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ method: "play" }), "*");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [finalType, mediaUrl, onCinemaModeChange, options.autoplay, options.autoFocusOnAutoplay, options.focusModeEnabled]);

  useEffect(() => {
    if (!onCinemaModeChange || !options.focusModeEnabled || !["youtube", "vimeo"].includes(finalType)) return;
    const onMessage = (event: MessageEvent) => {
      let payload: any = event.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }

      if (finalType === "youtube" && payload?.event === "infoDelivery") {
        const state = payload.info?.playerState;
        if (state === 1 && externalStarted) onCinemaModeChange(true);
        if (state === 0 || state === 2 || payload.info?.muted === true) {
          setExternalStarted(false);
          onCinemaModeChange(false);
        }
      }

      if (finalType === "vimeo") {
        if (payload?.event === "play" && externalStarted) onCinemaModeChange(true);
        if (payload?.event === "pause" || payload?.event === "ended") {
          setExternalStarted(false);
          onCinemaModeChange(false);
        }
        if (payload?.event === "volumechange" && Number(payload?.data?.volume || 0) === 0) {
          setExternalStarted(false);
          onCinemaModeChange(false);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [externalStarted, finalType, onCinemaModeChange, options.focusModeEnabled]);

  useEffect(() => {
    if (!options.pauseAudioOnScroll || !["youtube", "vimeo"].includes(finalType)) return;
    const onScroll = () => {
      setExternalStarted(false);
      onCinemaModeChange?.(false);
      if (finalType === "youtube") {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "mute", args: [] }), "*");
      }
      if (finalType === "vimeo") {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ method: "setVolume", value: 0 }), "*");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [finalType, onCinemaModeChange, options.pauseAudioOnScroll]);

  useEffect(() => {
    if (!options.pauseAudioOnScroll || finalType !== "video") return;
    let scrollTimer: number | undefined;
    const onScroll = () => {
      const video = videoRef.current;
      if (!video) return;
      if (!video.muted) {
        video.muted = true;
        setMuted(true);
        setScrolledMuted(true);
        onCinemaModeChange?.(false);
      }
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => setScrolledMuted(false), 900);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(scrollTimer);
    };
  }, [options.pauseAudioOnScroll, finalType]);

  useEffect(() => {
    if (!options.unmuteOnViewMotion || finalType !== "video" || !containerRef.current) return;
    const observer = new IntersectionObserver(entries => {
      const video = videoRef.current;
      const visible = entries[0]?.isIntersecting;
      if (!video || !visible || scrolledMuted) return;
      video.muted = false;
      setMuted(false);
      video.play().then(() => setPlaying(true)).catch(() => null);
    }, { threshold: 0.65 });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [options.unmuteOnViewMotion, finalType, scrolledMuted]);

  if (!options.enabled) return null;

  if (finalType === "image") {
    return <img src={mediaUrl} alt="Mensagem" className={cn(fitClass, className)} loading="lazy" />;
  }

  const stopExternalFocus = (action: "pause" | "mute") => {
    if (finalType === "youtube") {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: action === "pause" ? "pauseVideo" : "mute", args: [] }), "*");
    }
    if (finalType === "vimeo") {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify(action === "pause" ? { method: "pause" } : { method: "setVolume", value: 0 }), "*");
    }
    setExternalStarted(false);
    onCinemaModeChange?.(false);
  };

  if (finalType === "youtube") {
    const videoId = extractYouTubeId(mediaUrl);
    const controls = options.showControls && (options.allowPause || options.allowMute || options.allowRewind) ? 1 : 0;
    const origin = typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : "";
    if (!videoId) return <InvalidMediaFallback className={className} label="Link do YouTube inválido" />;
    return (
      <div className={cn("relative overflow-hidden bg-black", className)}>
        <iframe
          ref={iframeRef}
          className={cn("h-full w-full", externalStarted && options.focusModeEnabled && "pointer-events-none")}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=${options.autoplay ? 1 : 0}&mute=${options.startMuted ? 1 : 0}&controls=${controls}&disablekb=${options.allowRewind ? 0 : 1}&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&fs=0&enablejsapi=1&origin=${origin}`}
          title="YouTube video player"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="autoplay; encrypted-media; picture-in-picture"
        />
        {onCinemaModeChange && options.focusModeEnabled && !options.autoFocusOnAutoplay && !externalStarted && (
          <ExternalPlayOverlay
            label="Assistir vídeo"
            onClick={() => {
              setExternalStarted(true);
              if (options.focusModeEnabled) onCinemaModeChange(true);
              iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
              iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "unMute", args: [] }), "*");
            }}
          />
        )}
        {externalStarted && options.focusModeEnabled && options.showControls && (
          <ExternalFocusControls onPause={() => stopExternalFocus("pause")} onMute={() => stopExternalFocus("mute")} labels={labels} />
        )}
        {!controls && (
          <ExternalOverlay
            label={options.autoplay ? "Vídeo reproduzindo no sistema" : "Vídeo incorporado no sistema"}
          />
        )}
      </div>
    );
  }

  if (finalType === "vimeo") {
    const videoId = extractVimeoId(mediaUrl);
    const controls = options.showControls && (options.allowPause || options.allowMute || options.allowRewind) ? 1 : 0;
    if (!videoId) return <InvalidMediaFallback className={className} label="Link do Vimeo inválido" />;
    return (
      <div className={cn("relative overflow-hidden bg-black", className)}>
        <iframe
          ref={iframeRef}
          className={cn("h-full w-full", externalStarted && options.focusModeEnabled && "pointer-events-none")}
          src={`https://player.vimeo.com/video/${videoId}?autoplay=${options.autoplay ? 1 : 0}&muted=${options.startMuted ? 1 : 0}&controls=${controls}&title=0&byline=0&portrait=0&dnt=1&api=1`}
          title="Vimeo video player"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="autoplay; picture-in-picture"
        />
        {onCinemaModeChange && options.focusModeEnabled && !options.autoFocusOnAutoplay && !externalStarted && (
          <ExternalPlayOverlay
            label="Assistir vídeo"
            onClick={() => {
              setExternalStarted(true);
              if (options.focusModeEnabled) onCinemaModeChange(true);
              iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ method: "play" }), "*");
              iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ method: "setVolume", value: options.initialVolume / 100 }), "*");
            }}
          />
        )}
        {externalStarted && options.focusModeEnabled && options.showControls && (
          <ExternalFocusControls onPause={() => stopExternalFocus("pause")} onMute={() => stopExternalFocus("mute")} labels={labels} />
        )}
        {!controls && (
          <ExternalOverlay
            label={options.autoplay ? "Vídeo reproduzindo no sistema" : "Vídeo incorporado no sistema"}
          />
        )}
      </div>
    );
  }

  if (finalType === "bunny") {
    const controls = options.showControls && (options.allowPause || options.allowMute || options.allowRewind);
    const embedUrl = getBunnyEmbedUrl(mediaUrl, { autoPlay: options.autoplay, muted: options.startMuted, controls });
    if (!embedUrl) return <InvalidMediaFallback className={className} label="Link do Bunny.net inválido" />;
    return (
      <div className={cn("relative overflow-hidden bg-black", className)}>
        <iframe
          ref={iframeRef}
          className="h-full w-full"
          src={embedUrl}
          title="Bunny Stream video player"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  const togglePlay = () => {
    if (!options.allowPause || !videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.dataset.rifaproUserPaused = "false";
      videoRef.current.muted = options.startMuted;
      setMuted(options.startMuted);
      videoRef.current.play().then(() => {
        setPlaying(true);
        onPlaybackStateChange?.(true);
        if (options.focusModeEnabled) onCinemaModeChange?.(true);
      }).catch(() => null);
    } else {
      videoRef.current.dataset.rifaproUserPaused = "true";
      videoRef.current.pause();
      setPlaying(false);
      onPlaybackStateChange?.(false);
      onCinemaModeChange?.(false);
    }
  };

  const toggleMute = () => {
    if (!options.allowMute || !videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setMuted(videoRef.current.muted);
    if (videoRef.current.muted) onCinemaModeChange?.(false);
  };

  const rewind = () => {
    if (!options.allowRewind || !videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
  };

  const handleTap = () => {
    const video = videoRef.current;
    if (!video) return;
    if (options.tapToTogglePlay) {
      togglePlay();
      return;
    }
    if (!options.tapToUnmute) return;
    video.muted = false;
    setMuted(false);
    video.play().then(() => {
      setPlaying(true);
      onPlaybackStateChange?.(true);
      if (options.focusModeEnabled) onCinemaModeChange?.(true);
    }).catch(() => null);
  };

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden bg-black", className)}>
      <video
        ref={videoRef}
        src={mediaUrl}
        className={cn("h-full w-full", fitClass)}
        autoPlay={options.autoplay}
        data-rifapro-autoplay={String(options.autoplay)}
        data-rifapro-muted={String(options.startMuted)}
        muted={options.startMuted}
        playsInline
        loop
        onClick={handleTap}
        onPause={() => {
          setPlaying(false);
          onPlaybackStateChange?.(false);
          onCinemaModeChange?.(false);
        }}
        onPlay={() => {
          setPlaying(true);
          onPlaybackStateChange?.(true);
        }}
      />
      {options.tapToUnmute && muted && (
        <button type="button" onClick={handleTap} className="absolute inset-0 grid place-items-center bg-black/20 text-white">
          <span className="rounded-full border border-white/20 bg-black/55 px-4 py-2 text-sm font-bold backdrop-blur-xl">{labels.tapToUnmute || "Toque para ouvir"}</span>
        </button>
      )}
      {options.showControls && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/55 p-2 backdrop-blur-xl">
          <div className="flex gap-2">
            {options.allowPause && (
              <ControlButton label={playing ? labels.pause || "Pause" : labels.play || "Play"} onClick={togglePlay}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </ControlButton>
            )}
            {options.allowRewind && <ControlButton label={labels.rewind || "Voltar 10s"} onClick={rewind}><RotateCcw className="h-4 w-4" /></ControlButton>}
            {options.allowMute && (
              <ControlButton label={muted ? labels.unmute || "Ouvir" : labels.mute || "Mutar"} onClick={toggleMute}>
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </ControlButton>
            )}
          </div>
          <span className="text-[10px] font-mono uppercase text-white/70">{labels.volume || "Vol."} {options.initialVolume}%</span>
        </div>
      )}
    </div>
  );
}

function ControlButton({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20">
      {children}
    </button>
  );
}

function ExternalOverlay({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-black/55 px-3 py-2 text-center text-[10px] font-mono uppercase tracking-widest text-white/75 backdrop-blur-xl">
      {label}
    </div>
  );
}

function ExternalPlayOverlay({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid="featured-video-play"
      onClick={onClick}
      className="absolute inset-0 z-[60] grid place-items-center bg-black/25 text-white transition hover:bg-black/15"
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/65 px-5 py-3 text-sm font-black uppercase tracking-widest shadow-2xl backdrop-blur-xl">
        <Play className="h-4 w-4" /> {label}
      </span>
    </button>
  );
}

function ExternalFocusControls({
  labels,
  onPause,
  onMute
}: {
  labels: MessageVideoConfig["labels"];
  onPause: () => void;
  onMute: () => void;
}) {
  return (
    <div className="absolute bottom-4 right-4 z-[70] flex gap-2 rounded-2xl border border-white/10 bg-black/55 p-2 backdrop-blur-xl">
      <ControlButton label={labels?.pause || "Pause"} onClick={onPause}>
        <Pause className="h-4 w-4" />
      </ControlButton>
      <ControlButton label={labels?.mute || "Mutar"} onClick={onMute}>
        <VolumeX className="h-4 w-4" />
      </ControlButton>
    </div>
  );
}

function InvalidMediaFallback({ className, label }: { className?: string; label: string }) {
  return (
    <div className={cn("grid place-items-center bg-black p-6 text-center text-sm font-semibold text-white/75", className)}>
      {label}
    </div>
  );
}
