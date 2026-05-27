import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Download, Palette, Search } from "lucide-react";
import { adminThemes, AdminThemeId, useAdminTheme } from "../../context/admin/AdminThemeContext";
import { cn } from "../../lib/utils";
import { PremiumEmptyState } from "../premium/PremiumUI";

export function AdminPageTransition({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 14, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function AdminThemeSwitcher({
  collapsed = false,
  placement = "top"
}: {
  collapsed?: boolean;
  placement?: "top" | "bottom";
}) {
  const { themeId, setThemeId } = useAdminTheme();
  const [open, setOpen] = React.useState(false);
  const currentTheme = adminThemes.find(theme => theme.id === themeId) || adminThemes[0];

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={collapsed ? "admin-icon-button shrink-0" : "admin-button-secondary w-full"}
        title={collapsed ? `Tema: ${currentTheme.name}` : undefined}
        aria-label={`Tema atual: ${currentTheme.name}`}
        aria-expanded={open}
      >
        <Palette className="h-4 w-4" />
        {!collapsed && <span>Temas</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "absolute z-50 w-64 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-2 shadow-2xl backdrop-blur-2xl",
              placement === "bottom" ? "right-0 top-[calc(100%+0.75rem)]" : "bottom-[calc(100%+0.75rem)] left-0"
            )}
          >
            {adminThemes.map(theme => (
              <button
                key={theme.id}
                onClick={() => {
                  setThemeId(theme.id as AdminThemeId);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/[0.06]",
                  themeId === theme.id ? "text-[var(--admin-primary)]" : "text-[var(--admin-text)]"
                )}
                title={theme.description}
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-lg border border-white/10"
                  style={{ background: `linear-gradient(135deg, ${theme.variables["--admin-bg"]}, ${theme.variables["--admin-primary"]}, ${theme.variables["--admin-secondary"]})` }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{theme.name}</span>
                  <span className="block truncate text-[11px] text-[var(--admin-muted)]">{theme.description}</span>
                </span>
                {themeId === theme.id && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AdminSearchBox({ placeholder = "Buscar usuarios, cotas, vendas, sorteios..." }: { placeholder?: string }) {
  return (
    <label className="relative block w-full">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
      <input
        className="h-11 w-full rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] pl-11 pr-4 text-sm text-[var(--admin-text)] outline-none transition focus:border-[var(--admin-primary)]"
        placeholder={placeholder}
      />
    </label>
  );
}

export function MetricCard({
  label,
  value,
  trend,
  icon: Icon,
  tone = "primary"
}: {
  label: string;
  value: React.ReactNode;
  trend?: string;
  icon: React.ElementType;
  tone?: "primary" | "success" | "warning" | "danger" | "accent";
}) {
  const toneVar = {
    primary: "var(--admin-primary)",
    success: "var(--admin-success)",
    warning: "var(--admin-warning)",
    danger: "var(--admin-danger)",
    accent: "var(--admin-accent)"
  }[tone];

  return (
    <motion.article whileHover={{ y: -2 }} className="admin-card group overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--admin-muted)]">{label}</p>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-[var(--admin-text)]">{value}</div>
          {trend && <p className="mt-1 text-sm" style={{ color: toneVar }}>{trend}</p>}
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-xl" style={{ color: toneVar, background: `${toneVar}18` }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.article>
  );
}

export function ChartCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="admin-card p-5">
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-[var(--admin-border)] pb-4">
        <h2 className="mb-0 text-lg font-semibold text-[var(--admin-text)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AdminExportButtons({ onCSV, onJSON }: { onCSV?: () => void; onJSON?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onCSV} className="admin-button-secondary">
        <Download className="h-4 w-4" /> CSV
      </button>
      <button onClick={onJSON} className="admin-button-secondary">
        {"{ }"} JSON
      </button>
    </div>
  );
}

export function AdminLoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="admin-card h-32 animate-pulse bg-white/[0.06]" />
      ))}
    </div>
  );
}

export function AdminDataTable({ columns, rows, empty = "Nenhum registro encontrado." }: { columns: string[]; rows: React.ReactNode[][]; empty?: string }) {
  return (
    <div className="admin-card overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--admin-border)] bg-gray-50/80 text-xs text-[var(--admin-muted)]">
            <tr>{columns.map(column => <th key={column} className="px-5 py-3 font-medium">{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]">
            {rows.length === 0 ? (
              <tr><td className="px-5 py-8 text-center text-[var(--admin-muted)]" colSpan={columns.length}><PremiumEmptyState title={empty} description="Os dados aparecem aqui assim que houver movimentacao no tenant." /></td></tr>
            ) : rows.map((row, index) => (
              <tr key={index} className="transition hover:bg-gray-50/80">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="px-5 py-4 text-[var(--admin-text)]">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
