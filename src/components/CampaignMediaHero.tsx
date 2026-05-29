import { useState } from "react";
import type { ReactNode } from "react";
import { ImageOff, PlayCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { MediaRenderer } from "./MediaRenderer";
import { VideoHeroPlayer } from "./VideoHeroPlayer";

type CampaignMediaType = "image" | "video" | "youtube" | "vimeo" | "bunny";

interface CampaignMediaHeroProps {
  mediaUrl?: string | null;
  mediaType?: CampaignMediaType | null;
  title: string;
  subtitle?: string;
  overlay?: boolean;
  fullWidth?: boolean;
  priority?: boolean;
  mediaFit?: "cover" | "contain" | "fill";
  className?: string;
  mediaClassName?: string;
  children?: ReactNode;
}

export function CampaignMediaHero({
  mediaUrl,
  mediaType,
  title,
  subtitle,
  overlay = true,
  fullWidth = false,
  priority = false,
  mediaFit = "cover",
  className,
  mediaClassName,
  children
}: CampaignMediaHeroProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const resolvedType = mediaType || "image";
  const hasMedia = Boolean(mediaUrl && !failed);
  const fit = resolvedType === "image" ? mediaFit : mediaFit === "contain" ? "cover" : mediaFit;

  return (
    <div
      className={cn(
        "campaign-media-hero relative isolate min-w-0 overflow-hidden bg-[#030805]",
        fullWidth ? "left-1/2 w-screen -translate-x-1/2" : "w-full",
        className
      )}
      data-media-type={resolvedType}
    >
      {!loaded && hasMedia && (
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(115deg,rgba(5,22,15,0.92),rgba(13,70,38,0.38),rgba(0,0,0,0.9))]" />
      )}

      {hasMedia && resolvedType === "video" ? (
        <VideoHeroPlayer
          mediaUrl={mediaUrl!}
          mediaFit={fit}
          priority={priority}
          title={title}
          className={cn("absolute inset-0 h-full w-full", mediaClassName)}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(true);
          }}
        />
      ) : hasMedia ? (
        <MediaRenderer
          mediaUrl={mediaUrl!}
          mediaType={resolvedType}
          mediaFit={fit}
          priority={priority}
          preload="metadata"
          autoPlay={resolvedType !== "image"}
          muted={false}
          playWhenVisible={!priority}
          interactive={resolvedType !== "image"}
          className={cn("absolute inset-0 h-full w-full", mediaClassName)}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(true);
          }}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_24%_18%,rgba(0,214,107,0.22),transparent_34%),linear-gradient(135deg,#020604,#07150d_52%,#020604)]">
          <div className="flex flex-col items-center gap-3 text-center text-emerald-50/80">
            <ImageOff className="h-10 w-10 text-emerald-300" />
            <span className="text-xs font-black uppercase tracking-[0.24em]">Banner da campanha</span>
          </div>
        </div>
      )}

      {overlay && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.32)_48%,rgba(0,0,0,0.88)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(0,214,107,0.22),transparent_34%)]" />
        </>
      )}

      {children ? (
        <div className="absolute inset-0 z-10">{children}</div>
      ) : (title || subtitle) && (
        <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-6">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-black/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100 backdrop-blur-xl">
              <PlayCircle className="h-3.5 w-3.5 text-emerald-300" />
              Campanha ativa
            </div>
            <h1 className="text-balance text-3xl font-black leading-[0.95] text-white sm:text-5xl">{title}</h1>
            {subtitle && <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-emerald-50/80 sm:text-base">{subtitle}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
