import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, X } from 'lucide-react';
import { ResponsiveMediaFrame } from './ResponsiveMediaFrame';
import type { Story } from '../types';
import { inferMediaType } from '../utils/media';

function normalizeStories(payload: unknown): Story[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((story): story is Partial<Story> => Boolean(story && typeof story === "object"))
    .map(story => ({
      id: String(story.id || crypto.randomUUID()),
      title: String(story.title || "Story"),
      mediaUrl: String(story.mediaUrl || ""),
      mediaType: story.mediaType || "image",
      duration: Math.max(1, Number.isFinite(Number(story.duration)) ? Number(story.duration) : 5),
      active: story.active !== false
    } as Story))
    .filter(story => story.active);
}

export function StoriesSection() {
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/stories')
      .then(res => res.ok ? res.json() : [])
      .then(payload => setStories(normalizeStories(payload)))
      .catch(() => setStories([]));
  }, []);

  const openStory = useCallback((idx: number) => setActiveStoryIndex(idx), []);
  const closeStory = useCallback(() => setActiveStoryIndex(null), []);

  const nextStory = useCallback(() => {
    setActiveStoryIndex(current => {
      if (current !== null && current < stories.length - 1) return current + 1;
      return null;
    });
  }, [stories.length]);

  const prevStory = useCallback(() => {
    setActiveStoryIndex(current => {
      if (current !== null && current > 0) return current - 1;
      return current;
    });
  }, []);

  return (
    <div className="w-full">
      <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-4 md:justify-center">
        {stories.map((story, idx) => (
          <motion.button 
            key={story.id} 
            onClick={() => openStory(idx)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="group flex w-[78px] flex-shrink-0 flex-col items-center gap-2 text-[var(--theme-text)]"
          >
            <div className="relative h-[72px] w-[72px] rounded-full bg-[conic-gradient(from_210deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5,#feda75)] p-[3px] shadow-[0_10px_28px_rgba(0,0,0,0.28)] transition-transform duration-300 group-hover:scale-105">
              <div className="h-full w-full rounded-full bg-[var(--theme-bg)] p-[3px]">
                <div className="h-full w-full overflow-hidden rounded-full bg-black">
                  <ResponsiveMediaFrame src={story.mediaUrl} type={story.mediaType} alt={story.title} autoPlay={false} preferredFit="cover" aspectMode="square" className="h-full w-full rounded-full" />
                </div>
              </div>
            </div>
            <span className="max-w-[78px] truncate text-center text-[11px] font-semibold leading-tight text-[var(--theme-muted)] transition-colors group-hover:text-[var(--theme-text)]">{story.title}</span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {activeStoryIndex !== null && stories[activeStoryIndex] && (
          <StoryViewer 
            story={stories[activeStoryIndex]} 
            stories={stories}
            activeIndex={activeStoryIndex}
            onClose={closeStory} 
            onNext={nextStory} 
            onPrev={prevStory} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StoryViewer({ story, stories, activeIndex, onClose, onNext, onPrev }: { story: Story, stories: Story[], activeIndex: number, onClose: () => void, onNext: () => void, onPrev: () => void }) {
  const [progress, setProgress] = useState(0);
  const [isHeld, setIsHeld] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const pressStartedAtRef = useRef(0);
  const suppressTapRef = useRef(false);
  const durationMs = Math.max(1, Number.isFinite(Number(story.duration)) ? Number(story.duration) : 5) * 1000;
  const resolvedType = useMemo(() => inferMediaType(story.mediaUrl), [story.mediaUrl]);
  const isNativeVideo = story.mediaType === "video" || resolvedType === "video";
  const isTimedStory = !isNativeVideo;

  useEffect(() => {
    window.dispatchEvent(new Event("rifapro:story-open"));
    setProgress(0);
    progressRef.current = 0;
    setIsHeld(false);
    setMuted(true);
  }, [story.id]);

  useEffect(() => {
    if (!isTimedStory) return;

    const animate = (timestamp: number) => {
      if (lastFrameRef.current === null) lastFrameRef.current = timestamp;
      const delta = timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;

      if (!isHeld) {
        const nextProgress = Math.min(progressRef.current + (delta / durationMs) * 100, 100);
        progressRef.current = nextProgress;
        setProgress(nextProgress);
        if (nextProgress >= 100) {
          onNext();
          return;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    lastFrameRef.current = null;
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastFrameRef.current = null;
    };
  }, [durationMs, isHeld, isTimedStory, onNext, story.id]);

  useEffect(() => {
    if (!isNativeVideo) return;
    const video = videoRef.current;
    if (!video) return;

    video.controls = false;
    video.muted = true;
    video.playsInline = true;
    video.currentTime = 0;

    const start = async () => {
      try {
        await video.play();
      } catch {
        video.muted = true;
        setMuted(true);
        await video.play().catch(() => null);
      }
    };

    start();
  }, [isNativeVideo, story.id]);

  useEffect(() => {
    if (!isNativeVideo) return;
    const video = videoRef.current;
    if (!video) return;

    if (isHeld) {
      video.pause();
      return;
    }

    video.play().catch(() => {
      video.muted = true;
      setMuted(true);
      video.play().catch(() => null);
    });
  }, [isHeld, isNativeVideo, story.id]);

  const handleVideoProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const nextProgress = Math.min((video.currentTime / video.duration) * 100, 100);
    progressRef.current = nextProgress;
    setProgress(nextProgress);
  }, []);

  const beginHold = useCallback(() => {
    pressStartedAtRef.current = Date.now();
    suppressTapRef.current = false;
    setIsHeld(true);
  }, []);

  const endHold = useCallback(() => {
    if (Date.now() - pressStartedAtRef.current > 240) {
      suppressTapRef.current = true;
      window.setTimeout(() => {
        suppressTapRef.current = false;
      }, 0);
    }
    setIsHeld(false);
  }, []);

  const handleSideTap = useCallback((event: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.stopPropagation();
    if (suppressTapRef.current) return;
    action();
  }, []);

  const toggleMute = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const video = videoRef.current;
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (!video) return;

    video.muted = nextMuted;
    if (!nextMuted) {
      video.play().catch(() => {
        video.muted = true;
        setMuted(true);
      });
    }
  }, [muted]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/95 p-0 md:p-8 md:backdrop-blur-2xl"
    >
        <div
          className="relative flex h-[100dvh] w-full touch-none select-none flex-col overflow-hidden bg-black shadow-[0_0_80px_rgba(255,255,255,0.05)] md:h-[86vh] md:max-w-[430px] md:rounded-[28px] md:border md:border-white/[0.08]"
          onMouseDown={beginHold}
          onMouseUp={endHold}
          onMouseLeave={endHold}
          onTouchStart={beginHold}
          onTouchEnd={endHold}
          onTouchCancel={endHold}
        >
            <div className="absolute inset-x-0 top-0 z-30 flex gap-1 px-3 pt-3">
              {stories.map((item, index) => {
                const width = index < activeIndex ? 100 : index === activeIndex ? progress : 0;
                return (
                  <div key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25 shadow-sm">
                    <div className="h-full rounded-full bg-white transition-all duration-75 ease-linear shadow-[0_0_10px_rgba(255,255,255,0.55)]" style={{ width: `${width}%` }} />
                  </div>
                );
              })}
            </div>

            <div className="absolute inset-x-0 top-5 z-30 flex items-center justify-between gap-3 px-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[conic-gradient(from_210deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5,#feda75)] p-[2px]">
                  <div className="h-full w-full overflow-hidden rounded-full bg-black">
                    <ResponsiveMediaFrame src={story.mediaUrl} type={story.mediaType} alt={story.title} className="h-full w-full rounded-full" autoPlay={false} preferredFit="cover" aspectMode="square" />
                  </div>
                </div>
                <span className="truncate text-sm font-bold text-white drop-shadow">{story.title}</span>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {isNativeVideo && (
                  <button
                    type="button"
                    onMouseDown={event => event.stopPropagation()}
                    onTouchStart={event => event.stopPropagation()}
                    onClick={toggleMute}
                    className="grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white/90 backdrop-blur-md transition hover:bg-black/55 hover:text-white"
                    aria-label={muted ? "Ativar som" : "Silenciar story"}
                  >
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onMouseDown={event => event.stopPropagation()}
                  onTouchStart={event => event.stopPropagation()}
                  onClick={onClose}
                  className="grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white/90 backdrop-blur-md transition hover:bg-black/55 hover:text-white"
                  aria-label="Fechar story"
                >
                  <X className="h-5 w-5"/>
                </button>
              </div>
            </div>

            <div key={story.id} className="relative h-full w-full flex-1">
               {isNativeVideo ? (
                 <video
                   ref={videoRef}
                   src={story.mediaUrl}
                   className="absolute inset-0 h-full w-full object-cover"
                   autoPlay
                   playsInline
                   muted={muted}
                   controls={false}
                   preload="auto"
                   onTimeUpdate={handleVideoProgress}
                   onLoadedMetadata={handleVideoProgress}
                   onEnded={onNext}
                 />
               ) : story.mediaType === "image" || resolvedType === "image" ? (
                 <img src={story.mediaUrl} alt={story.title} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
               ) : (
                 <ResponsiveMediaFrame src={story.mediaUrl} type={story.mediaType} alt={story.title} className="absolute inset-0 h-full w-full rounded-none" preferredFit="auto" aspectMode="story" autoPlay muted controls={false} loop={false} />
               )}
               <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/60" />
               <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-5 pb-8">
                 <p className="text-base font-bold leading-snug text-white drop-shadow md:text-lg">{story.title}</p>
               </div>
            </div>

            <button type="button" className="absolute inset-y-0 left-0 z-20 w-1/3 cursor-w-resize bg-transparent" aria-label="Story anterior" onClick={event => handleSideTap(event, onPrev)} />
            <button type="button" className="absolute inset-y-0 right-0 z-20 w-1/3 cursor-e-resize bg-transparent" aria-label="Proximo story" onClick={event => handleSideTap(event, onNext)} />
        </div>
    </motion.div>
  );
}
