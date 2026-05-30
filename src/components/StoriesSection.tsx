import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { MediaRenderer } from './MediaRenderer';
import type { Story } from '../types';

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

  const openStory = (idx: number) => setActiveStoryIndex(idx);
  const closeStory = () => setActiveStoryIndex(null);

  const nextStory = () => {
    if (activeStoryIndex !== null && activeStoryIndex < stories.length - 1) {
      setActiveStoryIndex(activeStoryIndex + 1);
    } else {
      closeStory();
    }
  };

  const prevStory = () => {
    if (activeStoryIndex !== null && activeStoryIndex > 0) {
      setActiveStoryIndex(activeStoryIndex - 1);
    }
  };

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
                  <MediaRenderer mediaUrl={story.mediaUrl} mediaType={story.mediaType} autoPlay={false} className="h-full w-full object-cover" />
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
            onClose={closeStory} 
            onNext={nextStory} 
            onPrev={prevStory} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StoryViewer({ story, onClose, onNext }: { story: Story, onClose: () => void, onNext: () => void, onPrev: () => void }) {
  const [progress, setProgress] = useState(0);
  const durationMs = Math.max(1, Number.isFinite(Number(story.duration)) ? Number(story.duration) : 5) * 1000;

  useEffect(() => {
    window.dispatchEvent(new Event("rifapro:story-open"));
  }, [story.id]);

  useEffect(() => {
    let startTime = Date.now();
    let animationFrame: number;
    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const pct = Math.min((elapsed / durationMs) * 100, 100);
      setProgress(pct);

      if (pct < 100) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        onNext();
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [durationMs, story.id, onNext]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/95 p-0 md:p-8 md:backdrop-blur-2xl"
    >
        <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-black shadow-[0_0_80px_rgba(255,255,255,0.05)] md:h-[86vh] md:max-w-[430px] md:rounded-[28px] md:border md:border-white/[0.08]">
            <div className="absolute inset-x-0 top-0 z-30 px-3 pt-3">
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/25 shadow-sm">
                <div className="h-full rounded-full bg-white transition-all duration-75 ease-linear shadow-[0_0_10px_rgba(255,255,255,0.55)]" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="absolute inset-x-0 top-5 z-30 flex items-center justify-between gap-3 px-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[conic-gradient(from_210deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5,#feda75)] p-[2px]">
                  <div className="h-full w-full overflow-hidden rounded-full bg-black">
                    <MediaRenderer mediaUrl={story.mediaUrl} mediaType={story.mediaType} className="h-full w-full object-cover" autoPlay={false} />
                  </div>
                </div>
                <span className="truncate text-sm font-bold text-white drop-shadow">{story.title}</span>
              </div>
              <button onClick={onClose} className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-black/35 text-white/90 backdrop-blur-md transition hover:bg-black/55 hover:text-white" aria-label="Fechar story">
                <X className="h-5 w-5"/>
              </button>
            </div>

            <div key={story.id} className="relative h-full w-full flex-1" onClick={onNext}>
               <MediaRenderer mediaUrl={story.mediaUrl} mediaType={story.mediaType} className="absolute inset-0 h-full w-full object-cover" autoPlay={true} muted={false} interactive={false} />
               <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/60" />
               <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-5 pb-8">
                 <p className="text-base font-bold leading-snug text-white drop-shadow md:text-lg">{story.title}</p>
               </div>
            </div>

            <div className="absolute inset-y-0 left-0 z-20 w-1/3 cursor-pointer" onClick={(e) => { e.stopPropagation(); onNext(); }} />
            <div className="absolute inset-y-0 right-0 w-1/3 z-20 cursor-e-resize" onClick={(e) => { e.stopPropagation(); onNext(); }} />
        </div>
    </motion.div>
  );
}
