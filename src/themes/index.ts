export type ThemeId = "vimeo-original" | "vimeo-dark" | "apple-glass" | "vimeo-cinematic" | "samsung-neon" | "social-luxe" | "black-white";

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
    id: "vimeo-original",
    name: "Vimeo Original",
    inspiration: "Vimeo homepage",
    description: "Editorial claro, mídia grande, azul Vimeo e sensação SaaS cinematográfica.",
    preview: "linear-gradient(135deg, #fafcfd 0%, #eaf7ff 42%, #17d5ff 100%)",
    variables: {
      "--theme-bg": "#fafcfd",
      "--theme-bg-soft": "#eef7fb",
      "--theme-surface": "rgba(255,255,255,0.88)",
      "--theme-surface-strong": "rgba(255,255,255,0.96)",
      "--theme-border": "rgba(35,49,59,0.12)",
      "--theme-text": "#17212b",
      "--theme-muted": "#526371",
      "--theme-primary": "#00adef",
      "--theme-secondary": "#23313b",
      "--theme-accent": "#17d5ff",
      "--theme-glow": "rgba(0,173,239,0.22)",
      "--theme-glow-2": "rgba(23,213,255,0.16)",
      "--theme-button-bg": "#17212b",
      "--theme-button-text": "#ffffff",
      "--theme-grid": "rgba(35,49,59,0.045)",
      "--theme-radius": "26px",
      "--theme-blur": "30px",
      "--theme-motion": "720ms"
    }
  },
  {
    id: "vimeo-dark",
    name: "Vimeo Dark",
    inspiration: "Vimeo cinematic player",
    description: "Modo escuro de cinema, azul streaming e cards de mídia premium.",
    preview: "linear-gradient(135deg, #020711 0%, #071c2c 45%, #00adef 100%)",
    variables: {
      "--theme-bg": "#020711",
      "--theme-bg-soft": "#061520",
      "--theme-surface": "rgba(8,25,38,0.74)",
      "--theme-surface-strong": "rgba(11,35,52,0.88)",
      "--theme-border": "rgba(125,211,252,0.18)",
      "--theme-text": "#f2fbff",
      "--theme-muted": "#a5bac7",
      "--theme-primary": "#00adef",
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
  },
  {
    id: "apple-glass",
    name: "Apple Glass",
    inspiration: "Apple Vision Pro",
    description: "Minimalismo espacial, glass extremo e cyan cristalino.",
    preview: "linear-gradient(135deg, #f8fafc 0%, #60a5fa 48%, #020617 100%)",
    variables: {
      "--theme-bg": "#02040a",
      "--theme-bg-soft": "#080b12",
      "--theme-surface": "rgba(255,255,255,0.045)",
      "--theme-surface-strong": "rgba(255,255,255,0.075)",
      "--theme-border": "rgba(255,255,255,0.13)",
      "--theme-text": "#f8fafc",
      "--theme-muted": "#aab4c5",
      "--theme-primary": "#9bdcff",
      "--theme-secondary": "#dbeafe",
      "--theme-accent": "#60a5fa",
      "--theme-glow": "rgba(125,211,252,0.42)",
      "--theme-glow-2": "rgba(255,255,255,0.18)",
      "--theme-button-bg": "#f8fafc",
      "--theme-button-text": "#020617",
      "--theme-grid": "rgba(255,255,255,0.034)",
      "--theme-radius": "28px",
      "--theme-blur": "52px",
      "--theme-motion": "900ms"
    }
  },
  {
    id: "vimeo-cinematic",
    name: "Vimeo Cinematic",
    inspiration: "Vimeo streaming premium",
    description: "Navy profundo, luz audiovisual e contraste fosco.",
    preview: "linear-gradient(135deg, #020617 0%, #075985 50%, #22d3ee 100%)",
    variables: {
      "--theme-bg": "#020711",
      "--theme-bg-soft": "#061520",
      "--theme-surface": "rgba(13,42,62,0.42)",
      "--theme-surface-strong": "rgba(14,58,82,0.58)",
      "--theme-border": "rgba(125,211,252,0.16)",
      "--theme-text": "#eef8ff",
      "--theme-muted": "#9ab3c3",
      "--theme-primary": "#22d3ee",
      "--theme-secondary": "#7dd3fc",
      "--theme-accent": "#38bdf8",
      "--theme-glow": "rgba(34,211,238,0.34)",
      "--theme-glow-2": "rgba(8,47,73,0.72)",
      "--theme-button-bg": "#22d3ee",
      "--theme-button-text": "#001018",
      "--theme-grid": "rgba(125,211,252,0.026)",
      "--theme-radius": "22px",
      "--theme-blur": "46px",
      "--theme-motion": "760ms"
    }
  },
  {
    id: "samsung-neon",
    name: "Samsung Neon",
    inspiration: "Samsung flagship devices",
    description: "Energia high-tech, azul elétrico e roxo neon.",
    preview: "linear-gradient(135deg, #020617 0%, #2563eb 42%, #a855f7 100%)",
    variables: {
      "--theme-bg": "#02030a",
      "--theme-bg-soft": "#070814",
      "--theme-surface": "rgba(37,99,235,0.08)",
      "--theme-surface-strong": "rgba(124,58,237,0.13)",
      "--theme-border": "rgba(96,165,250,0.22)",
      "--theme-text": "#f8fbff",
      "--theme-muted": "#aeb9d3",
      "--theme-primary": "#3b82f6",
      "--theme-secondary": "#a855f7",
      "--theme-accent": "#22d3ee",
      "--theme-glow": "rgba(59,130,246,0.52)",
      "--theme-glow-2": "rgba(168,85,247,0.38)",
      "--theme-button-bg": "linear-gradient(135deg, #3b82f6, #a855f7)",
      "--theme-button-text": "#ffffff",
      "--theme-grid": "rgba(96,165,250,0.04)",
      "--theme-radius": "24px",
      "--theme-blur": "42px",
      "--theme-motion": "620ms"
    }
  },
  {
    id: "black-white",
    name: "Black & White",
    inspiration: "Luxury monochrome SaaS",
    description: "Preto e branco premium, alto contraste e botões minimalistas.",
    preview: "linear-gradient(135deg, #030712 0%, #111827 42%, #ffffff 100%)",
    variables: {
      "--theme-bg": "#030407",
      "--theme-bg-soft": "#090b10",
      "--theme-surface": "rgba(255,255,255,0.055)",
      "--theme-surface-strong": "rgba(255,255,255,0.09)",
      "--theme-border": "rgba(255,255,255,0.14)",
      "--theme-text": "#ffffff",
      "--theme-muted": "#a1a1aa",
      "--theme-primary": "#ffffff",
      "--theme-secondary": "#d4d4d8",
      "--theme-accent": "#71717a",
      "--theme-glow": "rgba(255,255,255,0.18)",
      "--theme-glow-2": "rgba(255,255,255,0.08)",
      "--theme-button-bg": "#ffffff",
      "--theme-button-text": "#030407",
      "--theme-grid": "rgba(255,255,255,0.04)",
      "--theme-radius": "26px",
      "--theme-blur": "44px",
      "--theme-motion": "820ms"
    }
  },
  {
    id: "social-luxe",
    name: "Social Luxe",
    inspiration: "Instagram + Facebook",
    description: "Social futurista, gradientes vibrantes e energia viral.",
    preview: "linear-gradient(135deg, #1877f2 0%, #c13584 48%, #f77737 100%)",
    variables: {
      "--theme-bg": "#07030b",
      "--theme-bg-soft": "#110719",
      "--theme-surface": "rgba(193,53,132,0.08)",
      "--theme-surface-strong": "rgba(24,119,242,0.11)",
      "--theme-border": "rgba(244,114,182,0.20)",
      "--theme-text": "#fff7fb",
      "--theme-muted": "#c7afc7",
      "--theme-primary": "#f472b6",
      "--theme-secondary": "#8b5cf6",
      "--theme-accent": "#1877f2",
      "--theme-glow": "rgba(244,114,182,0.46)",
      "--theme-glow-2": "rgba(24,119,242,0.34)",
      "--theme-button-bg": "linear-gradient(135deg, #f472b6, #8b5cf6, #1877f2)",
      "--theme-button-text": "#ffffff",
      "--theme-grid": "rgba(244,114,182,0.035)",
      "--theme-radius": "26px",
      "--theme-blur": "44px",
      "--theme-motion": "700ms"
    }
  }
];

export const defaultThemeId: ThemeId = "vimeo-original";

export function getTheme(id?: string | null) {
  return themes.find(theme => theme.id === id) || themes.find(theme => theme.id === defaultThemeId)!;
}
