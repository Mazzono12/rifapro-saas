import { useRef, useState } from "react";
import { cn } from "../lib/utils";
import { useSmartVideoPlayback } from "../hooks/useSmartVideoPlayback";
import { VideoSoundToggle } from "./VideoSoundToggle";

type Props = {
  src: string;
  poster?: string;
  mutedDefault?: boolean;
  controls?: boolean;
  playsInline?: boolean;
  className?: string;
  priority?: boolean;
  title?: string;
  loop?: boolean;
  preload?: "none" | "metadata" | "auto";
  mediaFit?: "cover" | "contain" | "fill";
  threshold?: number;
  onLoad?: () => void;
  onError?: () => void;
};

export function SmartAutoPlayVideo({
  src,
  poster,
  mutedDefault = false,
  controls = false,
  playsInline = true,
  className,
  priority = false,
  title,
  loop = true,
  preload = "metadata",
  mediaFit = "cover",
  threshold = 0.62,
  onLoad,
  onError
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(mutedDefault);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const playback = useSmartVideoPlayback(videoRef, {
    enabled: true,
    threshold,
    mutedDefault,
    priority,
    setMuted,
    setSoundBlocked
  });
  const fitClass = mediaFit === "contain" ? "object-contain" : mediaFit === "fill" ? "object-fill" : "object-cover";

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className={cn("h-full w-full", fitClass, className)}
        aria-label={title ? `Video da campanha ${title}` : "Video da campanha"}
        muted={muted}
        data-rifapro-autoplay="true"
        data-rifapro-muted={String(muted)}
        loop={loop}
        playsInline={playsInline}
        preload={priority ? "auto" : preload}
        controls={controls}
        onCanPlay={onLoad}
        onLoadedData={onLoad}
        onError={onError}
      />
      <VideoSoundToggle visible={soundBlocked && !controls} onActivate={playback.activateSound} />
    </>
  );
}
