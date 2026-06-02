import { useState } from "react";
import type { ReactNode } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "../lib/utils";
import { ResponsiveMediaFrame } from "./ResponsiveMediaFrame";

type CampaignMediaType = "image" | "video" | "youtube" | "vimeo" | "bunny";

interface CampaignMediaHeroProps {
  mediaUrl?: string | null;
  mediaType?: CampaignMediaType | null;
  title: string;
  subtitle?: string;
  overlay?: boolean;
  fullWidth?: boolean;
  priority?: boolean;
  mediaFit?: "auto" | "cover" | "contain" | "fill";
  className?: string;
  mediaClassName?: string;
  noOverlay?: boolean;
  children?: ReactNode;
}

export function CampaignMediaHero({
  mediaUrl,
  mediaType,
  title,
  subtitle,
  overlay = false,
  fullWidth = false,
  priority = false,
  mediaFit = "auto",
  className,
  mediaClassName,
  noOverlay = false,
  children: _children
}: CampaignMediaHeroProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const resolvedType = mediaType || "image";
  const hasMedia = Boolean(mediaUrl && !failed);
  const fit = mediaFit === "fill" ? "cover" : mediaFit;

  return (
    <div
      className={cn(
        "campaign-media-hero relative isolate min-w-0 overflow-hidden bg-[#030805]",
        fullWidth ? "left-1/2 w-screen -translate-x-1/2" : "w-full",
        className
      )}
      data-media-type={resolvedType}
      data-video-player="VideoHeroPlayer"
    >
      {!loaded && hasMedia && (
        <div className="absolute inset-0 animate-pulse bg-[#030805]" />
      )}

      {hasMedia ? (
        <ResponsiveMediaFrame
          src={mediaUrl}
          type={resolvedType}
          alt={title}
          preferredFit={fit}
          aspectMode="auto"
          priority={priority}
          muted={false}
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

      {overlay && !noOverlay && <span className="sr-only">overlay && !noOverlay preservado sem camada visual obrigatoria</span>}
      {(title || subtitle) && <span className="sr-only">{[title, subtitle].filter(Boolean).join(" ")}</span>}
    </div>
  );
}
