import { useState } from "react";
import { Palette, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../context/theme/ThemeContext";

export function ThemeSwitcher({ label = false }: { label?: boolean }) {
  const [open, setOpen] = useState(false);
  const { themeId, setThemeId, previewTheme, clearPreview, themes } = useTheme();
  const publicThemes = themes.filter(theme => ["vimeo-original", "vimeo-dark", "black-white"].includes(theme.id));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={label
          ? "w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--theme-muted)] hover:bg-[var(--theme-primary)]/10 hover:text-[var(--theme-text)]"
          : "touch-target w-10 h-10 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-[var(--theme-surface-strong)] flex items-center justify-center text-[var(--theme-text)] transition-colors active:scale-95"
        }
        aria-label="Trocar tema"
      >
        <Palette className="w-5 h-5" />
        {label && <span>Temas</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            className="absolute right-0 top-12 z-50 w-[min(92vw,360px)] rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] p-3 shadow-2xl backdrop-blur-2xl"
            onMouseLeave={clearPreview}
          >
            <div className="px-2 pb-3">
              <p className="text-xs font-mono uppercase tracking-[0.25em] text-[var(--theme-muted)]">Templates premium</p>
              <h3 className="text-lg font-display font-bold">Escolha uma identidade</h3>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {publicThemes.map(theme => (
                <button
                  key={theme.id}
                  type="button"
                  onMouseEnter={() => previewTheme(theme.id)}
                  onFocus={() => previewTheme(theme.id)}
                  onClick={() => {
                    setThemeId(theme.id);
                    setOpen(false);
                  }}
                  className="group flex items-center gap-3 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 text-left transition-all hover:bg-[var(--theme-primary)]/10"
                >
                  <span className="h-12 w-12 shrink-0 rounded-xl border border-white/15 shadow-[0_0_28px_rgba(255,255,255,0.08)]" style={{ background: theme.preview }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[var(--theme-text)]">{theme.name}</span>
                    <span className="block truncate text-xs text-[var(--theme-muted)]">{theme.description}</span>
                  </span>
                  {themeId === theme.id && <Check className="w-4 h-4 text-neon-cyan" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
