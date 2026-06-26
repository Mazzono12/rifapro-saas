import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export const ADMIN_THEMES = ["light"] as const;
export type AdminThemeId = typeof ADMIN_THEMES[number];

type AdminTheme = {
  id: AdminThemeId;
  name: string;
  description: string;
  variables: Record<string, string>;
};

const lightVariables: Record<string, string> = {
  "--admin-bg": "#f6f7f9",
  "--admin-bg-soft": "#f8fafc",
  "--admin-bg-deep": "#eef1f5",
  "--admin-sidebar": "#f6f7f9",
  "--admin-surface": "#ffffff",
  "--admin-surface-strong": "#f8fafc",
  "--admin-border": "#dde2e8",
  "--admin-text": "#111827",
  "--admin-muted": "#667085",
  "--admin-secondary-text": "#344054",
  "--admin-primary": "#111827",
  "--admin-secondary": "#eef1f5",
  "--admin-accent": "#e5e7eb",
  "--admin-info": "#2563eb",
  "--admin-success": "#16a34a",
  "--admin-warning": "#d97706",
  "--admin-danger": "#dc2626",
  "--admin-button": "#111827",
  "--admin-button-text": "#ffffff",
  "--admin-glow": "rgba(17,24,39,0.08)"
};

export const adminThemes: AdminTheme[] = [
  {
    id: "light",
    name: "Claro",
    description: "Painel SaaS branco gelo, limpo e operacional.",
    variables: lightVariables
  }
];

type AdminThemeContextValue = {
  theme: AdminTheme;
  themeId: AdminThemeId;
  setThemeId: (id: AdminThemeId) => void;
};

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);
const storageKey = "rifapro.admin.theme";

function normalizeAdminThemeId(_value: unknown): AdminThemeId {
  return "light";
}

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<AdminThemeId>(() => normalizeAdminThemeId(localStorage.getItem(storageKey)));

  const theme = useMemo(() => adminThemes[0], []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.adminTheme = "light";
    root.dataset.adminResolvedTheme = "light";
    Object.entries(lightVariables).forEach(([key, value]) => root.style.setProperty(key, String(value)));
    localStorage.setItem(storageKey, "light");
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
