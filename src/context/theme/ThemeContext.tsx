import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { THEME_STORAGE_KEY, defaultThemeId, getTheme, themes, type ThemeId } from "../../themes";

type PaletteOverrides = Record<string, string>;

interface ThemeContextValue {
  themeId: ThemeId;
  setThemeId: (themeId: ThemeId) => void;
  previewTheme: (themeId: ThemeId) => void;
  clearPreview: () => void;
  paletteOverrides: PaletteOverrides;
  applyPaletteOverrides: (overrides: PaletteOverrides) => void;
  themes: typeof themes;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const VIMEO_THEME_IDS: ThemeId[] = ["vimeo-original", "vimeo-dark"];

function readStoredPalette(raw: string | null): PaletteOverrides | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(`${THEME_STORAGE_KEY}_palette`);
    return null;
  }
}

function applyThemeVariables(themeId: ThemeId, overrides: PaletteOverrides = {}) {
  const theme = getTheme(themeId);
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  Object.entries({ ...theme.variables, ...overrides }).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(defaultThemeId);
  const [previewId, setPreviewId] = useState<ThemeId | null>(null);
  const [paletteOverrides, setPaletteOverrides] = useState<PaletteOverrides>({});

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    const storedOverrides = readStoredPalette(localStorage.getItem(`${THEME_STORAGE_KEY}_palette`));

    fetch("/api/settings")
      .then(res => res.json())
      .then(settings => {
        const defaultFromAdmin = settings?.theme?.defaultTheme as ThemeId | undefined;
        const adminPalette = settings?.theme?.paletteOverrides || {};
        const nextTheme = VIMEO_THEME_IDS.includes(stored as ThemeId)
          ? stored
          : (defaultFromAdmin && VIMEO_THEME_IDS.includes(defaultFromAdmin) ? defaultFromAdmin : defaultThemeId);
        const nextOverrides = storedOverrides || adminPalette;
        setThemeIdState(getTheme(nextTheme).id);
        setPaletteOverrides(nextOverrides);
        applyThemeVariables(getTheme(nextTheme).id, nextOverrides);
      })
      .catch(() => {
        const nextTheme = getTheme(stored || defaultThemeId).id;
        const nextOverrides = storedOverrides || {};
        setThemeIdState(nextTheme);
        setPaletteOverrides(nextOverrides);
        applyThemeVariables(nextTheme, nextOverrides);
      });
  }, []);

  useEffect(() => {
    applyThemeVariables(previewId || themeId, paletteOverrides);
  }, [themeId, previewId, paletteOverrides]);

  const setThemeId = useCallback((nextThemeId: ThemeId) => {
    const normalized = getTheme(nextThemeId).id;
    localStorage.setItem(THEME_STORAGE_KEY, normalized);
    setThemeIdState(normalized);
    setPreviewId(null);
  }, []);

  const previewTheme = useCallback((nextThemeId: ThemeId) => {
    setPreviewId(getTheme(nextThemeId).id);
  }, []);

  const clearPreview = useCallback(() => setPreviewId(null), []);

  const applyPaletteOverrides = useCallback((overrides: PaletteOverrides) => {
    localStorage.setItem(`${THEME_STORAGE_KEY}_palette`, JSON.stringify(overrides));
    setPaletteOverrides(overrides);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    themeId,
    setThemeId,
    previewTheme,
    clearPreview,
    paletteOverrides,
    applyPaletteOverrides,
    themes,
  }), [themeId, setThemeId, previewTheme, clearPreview, paletteOverrides, applyPaletteOverrides]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
