import { useMemo, useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "../lib/utils";
import { inferMediaType, type MediaType } from "../utils/media";
import {
  aspectRatioForMode,
  detectMediaAspectRatio,
  mediaFitForMode,
  type MediaAspectDetection,
  type ResponsiveMediaAspectMode,
  type ResponsiveMediaFit
} from "../utils/mediaAspect";
import { MediaRenderer } from "./MediaRenderer";

type ResponsiveMediaFrameProps = {
  src?: string | null;
  type?: MediaType | "gif" | "fallback" | string | null;
  alt?: string;
  poster?: string;
  preferredFit?: ResponsiveMediaFit;
  aspectMode?: ResponsiveMediaAspectMode;
  priority?: boolean;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  interactive?: boolean;
  className?: string;
  mediaClassName?: string;
  fallbackTitle?: string;
  fallbackSubtitle?: string;
  onAspectDetected?: (detection: MediaAspectDetection) => void;
  onLoad?: () => void;
  onError?: () => void;
};

function normalizeType(src?: string | null, type?: ResponsiveMediaFrameProps["type"]): MediaType | "fallback" {
  if (!src || type === "fallback") return "fallback";
  if (type === "gif") return "image";
  return (type as MediaType) || inferMediaType(src);
}

export function ResponsiveMediaFrame({
  src,
  type,
  alt = "Mídia da campanha",
  poster,
  preferredFit = "auto",
  aspectMode = "auto",
  priority = false,
  controls = false,
  autoPlay = true,
  muted = true,
  loop = true,
  playsInline = true,
  interactive,
  className,
  mediaClassName,
  fallbackTitle = "Mídia indisponível",
  fallbackSubtitle = "Envie imagem ou vídeo para visualizar o prêmio.",
  onAspectDetected,
  onLoad,
  onError
}: ResponsiveMediaFrameProps) {
  const [aspect, setAspect] = useState<MediaAspectDetection | null>(null);
  const resolvedType = normalizeType(src, type);
  const fit = mediaFitForMode(preferredFit, aspect);
  const aspectRatio = aspectRatioForMode(aspectMode, aspect);
  const isContain = fit === "contain";
  const dataOrientation = aspect?.orientation || (aspectMode === "auto" ? "unknown" : aspectMode);
  const resolvedInteractive = interactive ?? (controls || resolvedType !== "image");

  const handleMetadata = (width: number, height: number) => {
    const next = detectMediaAspectRatio(width, height);
    setAspect(current => current && Math.abs(current.ratio - next.ratio) < 0.01 ? current : next);
    onAspectDetected?.(next);
  };

  const backgroundStyle = useMemo(() => ({
    aspectRatio,
    backgroundImage: isContain
      ? "radial-gradient(circle at 18% 12%, rgba(52,211,153,0.18), transparent 34%), linear-gradient(135deg, #020604, #07150d 52%, #020604)"
      : undefined
  }), [aspectRatio, isContain]);

  return (
    <div
      className={cn(
        "responsive-media-frame relative w-full min-w-0 overflow-hidden rounded-[inherit] bg-black",
        isContain && "responsive-media-contain",
        aspect?.containerClass,
        className
      )}
      data-orientation={dataOrientation}
      data-fit={fit}
      style={backgroundStyle}
    >
      {resolvedType === "fallback" ? (
        <div className="grid h-full w-full place-items-center p-4 text-center text-emerald-50/80">
          <div className="flex max-w-xs flex-col items-center gap-2">
            <ImageOff className="h-9 w-9 text-emerald-300" />
            <p className="text-xs font-black uppercase tracking-[0.22em]">{fallbackTitle}</p>
            <p className="text-xs leading-5 text-emerald-50/60">{fallbackSubtitle}</p>
          </div>
        </div>
      ) : (
        <MediaRenderer
          mediaUrl={src!}
          mediaType={resolvedType}
          mediaFit={fit}
          alt={alt}
          priority={priority}
          preload={priority ? "auto" : "metadata"}
          autoPlay={autoPlay}
          muted={muted}
          poster={poster}
          loop={loop}
          playsInline={playsInline}
          playWhenVisible={!priority}
          interactive={resolvedInteractive}
          className={cn("h-full w-full", mediaClassName)}
          onMetadata={handleMetadata}
          onLoad={onLoad}
          onError={onError}
        />
      )}
      <span className="sr-only">{alt}</span>
    </div>
  );
}

export { detectMediaAspectRatio };
