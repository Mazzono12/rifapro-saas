import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AdminThemeId = "neon-executive" | "titanium-light" | "power-dark-bi" | "golden-vip" | "black-white";

type AdminTheme = {
  id: AdminThemeId;
  name: string;
  description: string;
  variables: Record<string, string>;
};

export const adminThemes: AdminTheme[] = [
  {
    id: "black-white",
    name: "Black & White",
    description: "Painel monocromático premium com contraste alto e botões brancos.",
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
    id: "neon-executive",
    name: "TailAdmin Dark",
    description: "Dashboard escuro no padrão TailAdmin, com azul brand e superfícies limpas.",
    variables: {
      "--admin-bg": "#101828",
      "--admin-bg-soft": "#0c111d",
      "--admin-surface": "#111827",
      "--admin-surface-strong": "#101828",
      "--admin-border": "rgba(255,255,255,0.08)",
      "--admin-text": "#f9fafb",
      "--admin-muted": "#98a2b3",
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
    id: "titanium-light",
    name: "TailAdmin Light",
    description: "Aparência principal TailAdmin: branco, cinza suave e azul brand.",
    variables: {
      "--admin-bg": "#f9fafb",
      "--admin-bg-soft": "#f2f4f7",
      "--admin-surface": "#ffffff",
      "--admin-surface-strong": "#ffffff",
      "--admin-border": "#e4e7ec",
      "--admin-text": "#101828",
      "--admin-muted": "#667085",
      "--admin-primary": "#465fff",
      "--admin-secondary": "#7592ff",
      "--admin-accent": "#0ba5ec",
      "--admin-success": "#12b76a",
      "--admin-warning": "#f79009",
      "--admin-danger": "#f04438",
      "--admin-button": "#465fff",
      "--admin-button-text": "#ffffff",
      "--admin-glow": "rgba(70,95,255,0.12)"
    }
  },
  {
    id: "power-dark-bi",
    name: "TailAdmin Analytics",
    description: "Variação analítica com navy e indicadores verdes.",
    variables: {
      "--admin-bg": "#f5fbff",
      "--admin-bg-soft": "#f0f9ff",
      "--admin-surface": "#ffffff",
      "--admin-surface-strong": "#ffffff",
      "--admin-border": "#d0e8f8",
      "--admin-text": "#102a43",
      "--admin-muted": "#486581",
      "--admin-primary": "#026aa2",
      "--admin-secondary": "#12b76a",
      "--admin-accent": "#0ba5ec",
      "--admin-success": "#039855",
      "--admin-warning": "#eab308",
      "--admin-danger": "#ef4444",
      "--admin-button": "#026aa2",
      "--admin-button-text": "#ffffff",
      "--admin-glow": "rgba(2,106,162,0.12)"
    }
  },
  {
    id: "golden-vip",
    name: "TailAdmin VIP",
    description: "Variação premium clara com destaque âmbar.",
    variables: {
      "--admin-bg": "#fffcf5",
      "--admin-bg-soft": "#fffaeb",
      "--admin-surface": "#ffffff",
      "--admin-surface-strong": "#ffffff",
      "--admin-border": "#fedf89",
      "--admin-text": "#1d2939",
      "--admin-muted": "#7a5f2a",
      "--admin-primary": "#dc6803",
      "--admin-secondary": "#f79009",
      "--admin-accent": "#fdb022",
      "--admin-success": "#12b76a",
      "--admin-warning": "#f59e0b",
      "--admin-danger": "#f43f5e",
      "--admin-button": "#dc6803",
      "--admin-button-text": "#ffffff",
      "--admin-glow": "rgba(220,104,3,0.12)"
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

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<AdminThemeId>(() => {
    const stored = localStorage.getItem(storageKey) as AdminThemeId | null;
    if (stored === "neon-executive") return "titanium-light";
    return adminThemes.some(theme => theme.id === stored) ? stored! : "titanium-light";
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
    setThemeId: setThemeIdState
  }), [theme, themeId]);

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
}

export function useAdminTheme() {
  const context = useContext(AdminThemeContext);
  if (!context) throw new Error("useAdminTheme must be used inside AdminThemeProvider");
  return context;
}
