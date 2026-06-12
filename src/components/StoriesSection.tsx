import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, ExternalLink, Volume2, VolumeX } from 'lucide-react';
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
      active: story.active !== false,
      link: typeof story.link === "string" ? story.link.trim() : "",
      order: Number.isFinite(Number(story.order)) ? Number(story.order) : 0
    } as Story))
    .filter(story => story.active && Boolean(story.mediaUrl));
}

function storiesDebug(event: string, detail: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!new URLSearchParams(window.location.search).has("storiesDebug")) return;
  console.info(`[stories-debug] ${event}`, detail);
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

  useEffect(() => {
    storiesDebug("StoriesSection rendered", {
      component: "StoriesSection",
      count: stories.length,
      mediaTypes: stories.map(story => story.mediaType).join(",")
    });
  }, [stories]);

  const openStory = useCallback((idx: number) => {
    storiesDebug("story clicked", {
      component: "StoriesSection",
      index: idx,
      storyId: stories[idx]?.id,
      mediaType: stories[idx]?.mediaType,
      mediaUrl: stories[idx]?.mediaUrl
    });
    setActiveStoryIndex(idx);
  }, [stories]);
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

  if (stories.length === 0) return null;

  return (
    <div className="cfx-stories-section w-full" aria-label="Stories CIFHER">
      <div className="cfx-stories-strip no-scrollbar">
        {stories.map((story, idx) => (
          <motion.button 
            key={story.id} 
            onClick={() => openStory(idx)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="cfx-story-thumb group"
          >
            <div className="cfx-story-avatar-ring">
              <div className="cfx-story-avatar-shell">
                <div className="cfx-story-avatar-media" data-rifapro-story-thumb={story.id}>
                  <ResponsiveMediaFrame src={story.mediaUrl} type={story.mediaType} alt={story.title} autoPlay={false} controls={false} interactive={false} preferredFit="cover" aspectMode="square" className="h-full w-full rounded-full" mediaClassName="pointer-events-none" />
                </div>
              </div>
            </div>
            <span className="cfx-story-title">{story.title}</span>
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
  const [viewerMuted, setViewerMuted] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
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
    storiesDebug("StoryViewer mounted", {
      component: "StoryViewer",
      storyId: story.id,
      mediaType: story.mediaType,
      resolvedType,
      isNativeVideo
    });
    setProgress(0);
    progressRef.current = 0;
    setIsHeld(false);
    setViewerMuted(false);
    setSoundBlocked(false);
  }, [isNativeVideo, resolvedType, story.id, story.mediaType]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

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
    video.muted = false;
    video.dataset.rifaproMuted = "false";
    video.playsInline = true;
    video.currentTime = 0;

    const start = async () => {
      try {
        video.muted = false;
        video.dataset.rifaproMuted = "false";
        await video.play();
        setViewerMuted(false);
        setSoundBlocked(false);
      } catch {
        video.muted = true;
        video.dataset.rifaproMuted = "true";
        setViewerMuted(true);
        setSoundBlocked(true);
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
      video.dataset.rifaproMuted = "true";
      setViewerMuted(true);
      setSoundBlocked(true);
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

  const activateStorySound = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    video.dataset.rifaproMuted = "false";
    video.play()
      .then(() => {
        setViewerMuted(false);
        setSoundBlocked(false);
      })
      .catch(() => {
        video.muted = true;
        video.dataset.rifaproMuted = "true";
        setViewerMuted(true);
        setSoundBlocked(true);
      });
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/95 p-0 md:p-8 md:backdrop-blur-2xl"
    >
        <div
          className="cfx-story-viewer-frame"
          data-rifapro-story-viewer={story.id}
          data-rifapro-story-component="StoryViewer"
          data-rifapro-story-media-type={story.mediaType}
          data-rifapro-story-resolved-type={resolvedType}
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
                  <div className="h-full w-full overflow-hidden rounded-full bg-black" data-rifapro-story-avatar={story.id}>
                    <ResponsiveMediaFrame src={story.mediaUrl} type={story.mediaType} alt={story.title} className="h-full w-full rounded-full" mediaClassName="pointer-events-none" autoPlay={false} controls={false} interactive={false} preferredFit="cover" aspectMode="square" />
                  </div>
                </div>
                <span className="truncate text-sm font-bold text-white drop-shadow">{story.title}</span>
              </div>
              {isNativeVideo && soundBlocked && (
                <button
                  type="button"
                  className="relative z-50 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-black/45 text-white shadow-lg backdrop-blur-xl"
                  aria-label={viewerMuted ? "Ativar som do story" : "Som do story ativo"}
                  onClick={activateStorySound}
                >
                  {viewerMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              )}
            </div>

            <div key={story.id} className="relative h-full w-full flex-1">
               {isNativeVideo ? (
                 <video
                   ref={videoRef}
                   src={story.mediaUrl}
                   className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                   autoPlay
                   playsInline
                   muted={viewerMuted}
                   data-rifapro-muted={String(viewerMuted)}
                   controls={false}
                   controlsList="nodownload noplaybackrate noremoteplayback"
                   disablePictureInPicture
                   preload="auto"
                   onTimeUpdate={handleVideoProgress}
                   onLoadedMetadata={handleVideoProgress}
                   onEnded={onNext}
                 />
               ) : story.mediaType === "image" || resolvedType === "image" ? (
                 <img src={story.mediaUrl} alt={story.title} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
               ) : (
                 <ResponsiveMediaFrame src={story.mediaUrl} type={story.mediaType} alt={story.title} className="absolute inset-0 h-full w-full rounded-none" mediaClassName="pointer-events-none" preferredFit="auto" aspectMode="story" autoPlay muted controls={false} interactive={false} loop={false} />
               )}
               <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/60" />
               <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[60] p-5 pb-8">
                 <p className="text-base font-bold leading-snug text-white drop-shadow md:text-lg">{story.title}</p>
                 {story.link && (
                   <a
                     href={story.link}
                     target="_blank"
                     rel="noreferrer"
                     className="pointer-events-auto relative z-[70] mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/50 bg-cyan-400/15 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.24)]"
                     onClick={event => event.stopPropagation()}
                   >
                     Saiba Mais <ExternalLink className="h-3.5 w-3.5" />
                   </a>
                 )}
               </div>
            </div>

            <button type="button" className="absolute inset-y-0 left-0 z-40 w-1/2 cursor-w-resize bg-transparent" aria-label="Story anterior" onClick={event => handleSideTap(event, onPrev)} />
            <button type="button" className="absolute inset-y-0 right-0 z-40 w-1/2 cursor-e-resize bg-transparent" aria-label="Proximo story" onClick={event => handleSideTap(event, onNext)} />
            <button type="button" className="cfx-story-nav-button cfx-story-nav-button--prev" aria-label="Story anterior" onClick={event => handleSideTap(event, onPrev)}><ChevronLeft /></button>
            <button type="button" className="cfx-story-nav-button cfx-story-nav-button--next" aria-label="Proximo story" onClick={event => handleSideTap(event, onNext)}><ChevronRight /></button>
        </div>
    </motion.div>
  );
}
