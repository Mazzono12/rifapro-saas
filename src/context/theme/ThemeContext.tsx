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
const LOCKED_THEME_ID: ThemeId = "vimeu_dark";

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
  const [paletteOverrides, setPaletteOverrides] = useState<PaletteOverrides>({});

  useEffect(() => {
    const storedOverrides = readStoredPalette(localStorage.getItem(`${THEME_STORAGE_KEY}_palette`));
    localStorage.setItem(THEME_STORAGE_KEY, LOCKED_THEME_ID);

    fetch("/api/settings")
      .then(res => res.json())
      .then(settings => {
        const adminPalette = settings?.theme?.paletteOverrides || {};
        const nextOverrides = storedOverrides || adminPalette;
        setThemeIdState(LOCKED_THEME_ID);
        setPaletteOverrides(nextOverrides);
        applyThemeVariables(LOCKED_THEME_ID, nextOverrides);
      })
      .catch(() => {
        const nextOverrides = storedOverrides || {};
        setThemeIdState(LOCKED_THEME_ID);
        setPaletteOverrides(nextOverrides);
        applyThemeVariables(LOCKED_THEME_ID, nextOverrides);
      });
  }, []);

  useEffect(() => {
    applyThemeVariables(LOCKED_THEME_ID, paletteOverrides);
  }, [themeId, paletteOverrides]);

  const setThemeId = useCallback((_nextThemeId: ThemeId) => {
    localStorage.setItem(THEME_STORAGE_KEY, LOCKED_THEME_ID);
    setThemeIdState(LOCKED_THEME_ID);
  }, []);

  const previewTheme = useCallback((_nextThemeId: ThemeId) => undefined, []);

  const clearPreview = useCallback(() => undefined, []);

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
