import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export const ADMIN_THEMES = ["dark", "light", "system"] as const;
export type AdminThemeId = typeof ADMIN_THEMES[number];

type AdminTheme = {
  id: AdminThemeId;
  name: string;
  description: string;
  variables: Record<string, string>;
};

export const adminThemes: AdminTheme[] = [
  {
    id: "dark",
    name: "Escuro",
    description: "CIFHER escuro operacional, denso e premium.",
    variables: {
      "--admin-bg": "#06020d",
      "--admin-bg-soft": "#090514",
      "--admin-bg-deep": "#10091f",
      "--admin-sidebar": "#07030f",
      "--admin-surface": "#120a22",
      "--admin-surface-strong": "#170d2b",
      "--admin-border": "rgba(168,85,247,0.24)",
      "--admin-text": "#f5f3ff",
      "--admin-muted": "#8b7bae",
      "--admin-secondary-text": "#c4b5fd",
      "--admin-primary": "#8b2cff",
      "--admin-secondary": "#a855f7",
      "--admin-accent": "#d946ef",
      "--admin-info": "#38bdf8",
      "--admin-success": "#34d399",
      "--admin-warning": "#fbbf24",
      "--admin-danger": "#fb7185",
      "--admin-button": "linear-gradient(90deg, #8b2cff, #d946ef)",
      "--admin-button-text": "#f5f3ff",
      "--admin-glow": "rgba(139,44,255,0.32)"
    }
  },
  {
    id: "light",
    name: "Claro",
    description: "CIFHER White operacional com superfícies claras.",
    variables: {
      "--admin-bg": "#f8f6ff",
      "--admin-bg-soft": "#ffffff",
      "--admin-bg-deep": "#f1edff",
      "--admin-sidebar": "#ffffff",
      "--admin-surface": "#ffffff",
      "--admin-surface-strong": "#f7f3ff",
      "--admin-border": "rgba(139,44,255,0.20)",
      "--admin-text": "#211432",
      "--admin-muted": "#8a7a9f",
      "--admin-secondary-text": "#625178",
      "--admin-primary": "#8b2cff",
      "--admin-secondary": "#a855f7",
      "--admin-accent": "#d946ef",
      "--admin-info": "#38bdf8",
      "--admin-success": "#12b76a",
      "--admin-warning": "#fbbf24",
      "--admin-danger": "#fb7185",
      "--admin-button": "linear-gradient(90deg, #8b2cff, #d946ef)",
      "--admin-button-text": "#ffffff",
      "--admin-glow": "rgba(139,44,255,0.18)"
    }
  },
  {
    id: "system",
    name: "Sistema",
    description: "Acompanha o tema do dispositivo mantendo o padrão CIFHER.",
    variables: {
      "--admin-bg": "#06020d",
      "--admin-bg-soft": "#090514",
      "--admin-bg-deep": "#10091f",
      "--admin-sidebar": "#07030f",
      "--admin-surface": "#120a22",
      "--admin-surface-strong": "#170d2b",
      "--admin-border": "rgba(168,85,247,0.24)",
      "--admin-text": "#f5f3ff",
      "--admin-muted": "#8b7bae",
      "--admin-secondary-text": "#c4b5fd",
      "--admin-primary": "#8b2cff",
      "--admin-secondary": "#a855f7",
      "--admin-accent": "#d946ef",
      "--admin-info": "#38bdf8",
      "--admin-success": "#34d399",
      "--admin-warning": "#fbbf24",
      "--admin-danger": "#fb7185",
      "--admin-button": "linear-gradient(90deg, #8b2cff, #d946ef)",
      "--admin-button-text": "#f5f3ff",
      "--admin-glow": "rgba(139,44,255,0.32)"
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
  if (raw === "black") return "dark";
  if (raw === "white") return "light";
  if (raw === "neon_blue") return "system";
  return "dark";
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
    const applyVariables = () => {
      const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      const systemTheme = prefersLight ? adminThemes[1] : adminThemes[0];
      const variables = theme.id === "system" ? systemTheme.variables : theme.variables;
      Object.entries(variables).forEach(([key, value]) => root.style.setProperty(key, String(value)));
    };
    applyVariables();
    localStorage.setItem(storageKey, theme.id);
    if (theme.id === "system") {
      const query = window.matchMedia("(prefers-color-scheme: light)");
      query.addEventListener("change", applyVariables);
      return () => query.removeEventListener("change", applyVariables);
    }
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
