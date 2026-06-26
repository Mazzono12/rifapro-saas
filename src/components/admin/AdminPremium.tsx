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
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
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
              "absolute z-50 w-64 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-2 shadow-2xl backdrop-blur-2xl",
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
                  "flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-sm transition hover:bg-[var(--admin-primary)]/10",
                  themeId === theme.id ? "text-[var(--admin-primary)]" : "text-[var(--admin-text)]"
                )}
                title={theme.description}
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-lg border border-white/10"
                  style={{ background: theme.variables["--admin-surface"], borderColor: theme.variables["--admin-border"] }}
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
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
      <input
        className="admin-input h-10 w-full rounded-md pl-9 pr-3"
        placeholder={placeholder}
      />
    </label>
  );
}


export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("admin-page-container min-w-0 space-y-6", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("admin-page-header flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="text-xs font-medium uppercase tracking-normal text-[var(--admin-muted)]">{eyebrow}</p>}
        <h1 className="truncate text-2xl font-semibold tracking-normal text-[var(--admin-text)]">{title}</h1>
        {description && <p className="max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function KPICard(props: React.ComponentProps<typeof MetricCard>) {
  return <MetricCard {...props} />;
}

export function TableWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("admin-table-shell min-w-0 overflow-hidden rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)]", className)}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Search,
  action,
  className
}: {
  title: string;
  description?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("admin-empty-state flex min-h-48 flex-col items-center justify-center rounded-md border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center", className)}>
      <span className="mb-3 grid h-10 w-10 place-items-center rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] text-[var(--admin-muted)]">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="text-sm font-semibold text-[var(--admin-text)]">{title}</h2>
      {description && <p className="mt-1 max-w-md text-sm leading-6 text-[var(--admin-muted)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  className
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  return <span className={cn("admin-status-badge", `admin-status-badge--${tone}`, className)}>{children}</span>;
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
    <article className="admin-card group relative flex h-full min-h-[124px] overflow-hidden p-5">
      <div className="flex w-full items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch">
          <p className="truncate text-sm font-medium text-[var(--admin-muted)]">{label}</p>
          <div className="mt-2 min-h-8 break-words text-2xl font-semibold leading-tight tracking-tight text-[var(--admin-text)]">{value}</div>
          {trend && <p className="mt-2 line-clamp-1 text-xs leading-snug" style={{ color: toneVar }}>{trend}</p>}
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--admin-border)]" style={{ color: toneVar, background: `${toneVar}18` }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

export function ChartCard({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="admin-card min-w-0 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="admin-card-heading truncate">{title}</h2>
          {description && <p className="mt-1 line-clamp-1 text-sm text-[var(--admin-muted)]">{description}</p>}
        </div>
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
        <div key={index} className="admin-card h-32 animate-pulse bg-[var(--admin-surface)]" />
      ))}
    </div>
  );
}

export function AdminDataTable({
  columns,
  rows,
  empty = "Nenhum registro encontrado.",
  minWidth = "720px"
}: {
  columns: string[];
  rows: React.ReactNode[][];
  empty?: string;
  minWidth?: string;
}) {
  return (
    <div className="admin-table-shell min-w-0 overflow-hidden rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="overflow-x-auto cifher-scrollbar">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs text-[var(--admin-muted)]">
            <tr>{columns.map(column => <th key={column} className="sticky top-0 h-10 px-4 text-left align-middle font-medium">{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]">
            {rows.length === 0 ? (
              <tr><td className="px-4 py-8 text-center text-[var(--admin-muted)]" colSpan={columns.length}><PremiumEmptyState title={empty} description="" /></td></tr>
            ) : rows.map((row, index) => (
              <tr key={index} className="transition hover:bg-[var(--admin-primary)]/10">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 align-middle text-[var(--admin-text)]">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

