export type ThemeId = "vimeu_dark";

export interface ThemeTokens {
  id: ThemeId;
  name: string;
  inspiration: string;
  description: string;
  preview: string;
  variables: Record<string, string>;
}

export const THEME_STORAGE_KEY = "nexusdraw_theme";

export const themes: ThemeTokens[] = [
  {
    id: "vimeu_dark",
    name: "Vimeu Dark",
    inspiration: "Vimeu dark premium",
    description: "Tema único escuro premium com azul streaming, verde CTA e alto contraste.",
    preview: "linear-gradient(135deg, #020711 0%, #071c2c 45%, #00adef 100%)",
    variables: {
      "--theme-bg": "#020711",
      "--theme-bg-soft": "#061520",
      "--theme-surface-elevated": "rgba(13,42,62,0.92)",
      "--theme-card": "rgba(8,25,38,0.82)",
      "--theme-surface": "rgba(8,25,38,0.74)",
      "--theme-surface-strong": "rgba(11,35,52,0.88)",
      "--theme-border": "rgba(125,211,252,0.18)",
      "--theme-text": "#f2fbff",
      "--theme-text-muted": "#a5bac7",
      "--theme-muted": "#a5bac7",
      "--theme-primary": "#00adef",
      "--theme-cta": "#34d399",
      "--theme-success": "#34d399",
      "--theme-danger": "#fb7185",
      "--theme-warning": "#fbbf24",
      "--theme-secondary": "#7dd3fc",
      "--theme-accent": "#17d5ff",
      "--theme-glow": "rgba(0,173,239,0.34)",
      "--theme-glow-2": "rgba(8,47,73,0.72)",
      "--theme-button-bg": "#00adef",
      "--theme-button-text": "#001018",
      "--theme-grid": "rgba(125,211,252,0.03)",
      "--theme-radius": "26px",
      "--theme-blur": "42px",
      "--theme-motion": "720ms"
    }
  }
];

export const defaultThemeId: ThemeId = "vimeu_dark";

export function getTheme(id?: string | null) {
  return themes.find(theme => theme.id === id) || themes[0];
}
