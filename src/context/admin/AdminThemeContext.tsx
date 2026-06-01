import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export const ADMIN_THEMES = ["black", "white", "neon_blue"] as const;
export type AdminThemeId = typeof ADMIN_THEMES[number];

type AdminTheme = {
  id: AdminThemeId;
  name: string;
  description: string;
  variables: Record<string, string>;
};

export const adminThemes: AdminTheme[] = [
  {
    id: "black",
    name: "Black",
    description: "Painel escuro premium com contraste alto e superfícies limpas.",
    variables: {
      "--admin-bg": "#030407",
      "--admin-bg-soft": "#090b10",
      "--admin-surface": "rgba(255,255,255,0.055)",
      "--admin-surface-strong": "rgba(255,255,255,0.09)",
      "--admin-border": "rgba(255,255,255,0.14)",
      "--admin-text": "#ffffff",
      "--admin-muted": "#a1a1aa",
      "--admin-primary": "#ffffff",
      "--admin-secondary": "#d4d4d8",
      "--admin-accent": "#71717a",
      "--admin-success": "#ffffff",
      "--admin-warning": "#d4d4d8",
      "--admin-danger": "#fca5a5",
      "--admin-button": "#ffffff",
      "--admin-button-text": "#030407",
      "--admin-glow": "rgba(255,255,255,0.18)"
    }
  },
  {
    id: "white",
    name: "White",
    description: "Painel claro premium, legível e focado em operação.",
    variables: {
      "--admin-bg": "#f8fafc",
      "--admin-bg-soft": "#eef2f7",
      "--admin-surface": "#ffffff",
      "--admin-surface-strong": "#ffffff",
      "--admin-border": "#d8dee8",
      "--admin-text": "#0f172a",
      "--admin-muted": "#475569",
      "--admin-primary": "#465fff",
      "--admin-secondary": "#7592ff",
      "--admin-accent": "#7cd4fd",
      "--admin-success": "#12b76a",
      "--admin-warning": "#f79009",
      "--admin-danger": "#f04438",
      "--admin-button": "#465fff",
      "--admin-button-text": "#ffffff",
      "--admin-glow": "rgba(70,95,255,0.16)"
    }
  },
  {
    id: "neon_blue",
    name: "Azul Neon",
    description: "Dark premium com azul neon para painéis de alta atenção.",
    variables: {
      "--admin-bg": "#020617",
      "--admin-bg-soft": "#071426",
      "--admin-surface": "rgba(15,23,42,0.86)",
      "--admin-surface-strong": "rgba(8,20,38,0.94)",
      "--admin-border": "rgba(56,189,248,0.22)",
      "--admin-text": "#eff6ff",
      "--admin-muted": "#93b4d7",
      "--admin-primary": "#38bdf8",
      "--admin-secondary": "#60a5fa",
      "--admin-accent": "#22d3ee",
      "--admin-success": "#34d399",
      "--admin-warning": "#fbbf24",
      "--admin-danger": "#fb7185",
      "--admin-button": "#38bdf8",
      "--admin-button-text": "#020617",
      "--admin-glow": "rgba(56,189,248,0.24)"
    }
  }
];

type AdminThemeContextValue = {
  theme: AdminTheme;
  themeId: AdminThemeId;
  setThemeId: (id: AdminThemeId) => void;
};

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);
const storageKey = "rifapro.admin.theme";

function normalizeAdminThemeId(value: unknown): AdminThemeId {
  const raw = String(value || "").trim();
  if ((ADMIN_THEMES as readonly string[]).includes(raw)) return raw as AdminThemeId;
  return "black";
}

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<AdminThemeId>(() => {
    const stored = localStorage.getItem(storageKey);
    return normalizeAdminThemeId(stored);
  });

  const theme = useMemo(() => adminThemes.find(item => item.id === themeId) || adminThemes[0], [themeId]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.adminTheme = theme.id;
    Object.entries(theme.variables).forEach(([key, value]) => root.style.setProperty(key, String(value)));
    localStorage.setItem(storageKey, theme.id);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    themeId,
    setThemeId: (id: AdminThemeId) => setThemeIdState(normalizeAdminThemeId(id))
  }), [theme, themeId]);

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
}

export function useAdminTheme() {
  const context = useContext(AdminThemeContext);
  if (!context) throw new Error("useAdminTheme must be used inside AdminThemeProvider");
  return context;
}
