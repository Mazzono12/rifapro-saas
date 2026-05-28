import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { VideoSoundToggle } from "./VideoSoundToggle";

type Props = {
  mediaUrl: string;
  title?: string;
  priority?: boolean;
  mediaFit?: "cover" | "contain" | "fill";
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
};

export function VideoHeroPlayer({
  mediaUrl,
  title,
  priority = false,
  mediaFit = "cover",
  className,
  onLoad,
  onError
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [shouldPlay, setShouldPlay] = useState(priority);

  useEffect(() => {
    if (priority) return;
    const video = videoRef.current;
    if (!video || !("IntersectionObserver" in window)) {
      setShouldPlay(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setShouldPlay(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [priority]);

  const syncDataset = useCallback((nextMuted: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    video.dataset.rifaproAutoplay = "true";
    video.dataset.rifaproMuted = String(nextMuted);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldPlay) return;
    let cancelled = false;

    async function playWithSoundFallback() {
      try {
        video.muted = false;
        video.volume = 1;
        syncDataset(false);
        await video.play();
        if (!cancelled) {
          setMuted(false);
          setSoundBlocked(false);
        }
      } catch {
        try {
          video.muted = true;
          syncDataset(true);
          await video.play();
          if (!cancelled) {
            setMuted(true);
            setSoundBlocked(true);
          }
        } catch {
          if (!cancelled) {
            setMuted(true);
            setSoundBlocked(true);
          }
        }
      }
    }

    void playWithSoundFallback();
    return () => {
      cancelled = true;
    };
  }, [shouldPlay, mediaUrl, syncDataset]);

  const activateSound = async () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    syncDataset(false);
    setMuted(false);
    setSoundBlocked(false);
    await video.play().catch(() => {
      setMuted(true);
      setSoundBlocked(true);
      syncDataset(true);
    });
  };

  return (
    <>
      <video
        ref={videoRef}
        src={mediaUrl}
        className={cn("h-full w-full", mediaFit === "contain" ? "object-contain" : mediaFit === "fill" ? "object-fill" : "object-cover", className)}
        aria-label={title ? `Video da campanha ${title}` : "Video da campanha"}
        autoPlay={shouldPlay}
        muted={muted}
        data-rifapro-autoplay="true"
        data-rifapro-muted={String(muted)}
        loop
        playsInline
        preload={priority ? "auto" : "metadata"}
        controls={false}
        onCanPlay={onLoad}
        onError={onError}
      />
      <VideoSoundToggle visible={soundBlocked} onActivate={activateSound} />
    </>
  );
}
