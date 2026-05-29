import React, { createContext, useCallback, useContext, useMemo, useRef } from "react";

type VideoEntry = {
  id: string;
  video: HTMLVideoElement;
  ratio: number;
  threshold: number;
  mutedDefault: boolean;
  userPaused: boolean;
  programmaticPause: boolean;
  setMuted: (value: boolean) => void;
  setSoundBlocked: (value: boolean) => void;
};

type RegisterPayload = Omit<VideoEntry, "ratio" | "userPaused" | "programmaticPause">;

type VideoPlaybackContextValue = {
  register: (entry: RegisterPayload) => void;
  unregister: (id: string) => void;
  updateVisibility: (id: string, ratio: number) => void;
  markUserPaused: (id: string) => void;
  markUserPlayed: (id: string) => void;
  activateSound: (id: string) => Promise<void>;
};

const VideoPlaybackContext = createContext<VideoPlaybackContextValue | null>(null);

export function VideoPlaybackProvider({ children }: { children: React.ReactNode }) {
  const entriesRef = useRef<Map<string, VideoEntry>>(new Map());

  const pauseEntry = useCallback((entry: VideoEntry) => {
    if (entry.video.paused) return;
    entry.programmaticPause = true;
    entry.video.pause();
    window.setTimeout(() => {
      const current = entriesRef.current.get(entry.id);
      if (current) current.programmaticPause = false;
    }, 0);
  }, []);

  const chooseActive = useCallback(() => {
    const entries = Array.from(entriesRef.current.values()) as VideoEntry[];
    const active = entries
      .filter(entry => entry.ratio >= entry.threshold && !entry.userPaused)
      .sort((a, b) => b.ratio - a.ratio)[0];

    entries.forEach(entry => {
      if (!active || entry.id !== active.id) pauseEntry(entry);
    });

    if (!active) return;

    const play = async () => {
      try {
        active.video.muted = active.mutedDefault;
        active.video.dataset.rifaproMuted = String(active.mutedDefault);
        await active.video.play();
        active.setMuted(active.video.muted);
        active.setSoundBlocked(false);
      } catch {
        try {
          active.video.muted = true;
          active.video.dataset.rifaproMuted = "true";
          await active.video.play();
          active.setMuted(true);
          active.setSoundBlocked(!active.mutedDefault);
        } catch {
          active.setMuted(true);
          active.setSoundBlocked(true);
        }
      }
    };

    void play();
  }, [pauseEntry]);

  const value = useMemo<VideoPlaybackContextValue>(() => ({
    register: entry => {
      entriesRef.current.set(entry.id, { ...entry, ratio: entry.video.getBoundingClientRect().height ? 0 : 0, userPaused: false, programmaticPause: false });
      chooseActive();
    },
    unregister: id => {
      const entry = entriesRef.current.get(id);
      if (entry) pauseEntry(entry);
      entriesRef.current.delete(id);
      chooseActive();
    },
    updateVisibility: (id, ratio) => {
      const entry = entriesRef.current.get(id);
      if (!entry) return;
      entry.ratio = ratio;
      if (ratio < entry.threshold) {
        entry.userPaused = false;
        pauseEntry(entry);
      }
      chooseActive();
    },
    markUserPaused: id => {
      const entry = entriesRef.current.get(id);
      if (!entry || entry.programmaticPause) return;
      entry.userPaused = true;
      pauseEntry(entry);
    },
    markUserPlayed: id => {
      const entry = entriesRef.current.get(id);
      if (!entry) return;
      entry.userPaused = false;
      chooseActive();
    },
    activateSound: async id => {
      const entry = entriesRef.current.get(id);
      if (!entry) return;
      entry.video.muted = false;
      entry.video.volume = 1;
      entry.video.dataset.rifaproMuted = "false";
      try {
        await entry.video.play();
        entry.setMuted(false);
        entry.setSoundBlocked(false);
        entry.userPaused = false;
      } catch {
        entry.video.muted = true;
        entry.video.dataset.rifaproMuted = "true";
        entry.setMuted(true);
        entry.setSoundBlocked(true);
      }
      chooseActive();
    }
  }), [chooseActive, pauseEntry]);

  return <VideoPlaybackContext.Provider value={value}>{children}</VideoPlaybackContext.Provider>;
}

export function useVideoPlaybackRegistry() {
  const context = useContext(VideoPlaybackContext);
  if (!context) throw new Error("useVideoPlaybackRegistry must be used inside VideoPlaybackProvider");
  return context;
}
