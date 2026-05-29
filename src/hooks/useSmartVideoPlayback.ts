import { RefObject, useEffect, useId } from "react";
import { useVideoPlaybackRegistry } from "../context/video-playback/VideoPlaybackContext";

type SmartPlaybackOptions = {
  enabled?: boolean;
  threshold?: number;
  mutedDefault?: boolean;
  priority?: boolean;
  setMuted: (value: boolean) => void;
  setSoundBlocked: (value: boolean) => void;
};

export function useSmartVideoPlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  {
    enabled = true,
    threshold = 0.62,
    mutedDefault = false,
    priority = false,
    setMuted,
    setSoundBlocked
  }: SmartPlaybackOptions
) {
  const id = useId();
  const registry = useVideoPlaybackRegistry();

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video) return;

    video.dataset.rifaproSmartAutoplay = "true";
    video.dataset.rifaproAutoplay = "true";
    video.dataset.rifaproMuted = String(mutedDefault);
    registry.register({ id, video, threshold, mutedDefault, setMuted, setSoundBlocked });

    const onPlay = () => registry.markUserPlayed(id);
    const onPause = () => registry.markUserPaused(id);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    if (!("IntersectionObserver" in window)) {
      registry.updateVisibility(id, priority ? 1 : 0);
      return () => {
        video.removeEventListener("play", onPlay);
        video.removeEventListener("pause", onPause);
        registry.unregister(id);
      };
    }

    const observer = new IntersectionObserver(entries => {
      const ratio = entries[0]?.intersectionRatio || 0;
      registry.updateVisibility(id, ratio);
    }, { threshold: [0, 0.25, threshold, 0.75, 1] });

    observer.observe(video);
    if (priority) registry.updateVisibility(id, 1);

    return () => {
      observer.disconnect();
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      registry.unregister(id);
    };
  }, [enabled, id, mutedDefault, priority, registry, setMuted, setSoundBlocked, threshold, videoRef]);

  return {
    activateSound: () => registry.activateSound(id),
    markUserPlayed: () => registry.markUserPlayed(id),
    markUserPaused: () => registry.markUserPaused(id)
  };
}
