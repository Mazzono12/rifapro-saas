import { Link, useLocation } from "react-router-dom";
import type React from "react";
import { ChevronLeft, ChevronRight, Hexagon, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { ResponsiveMediaFrame } from "../ResponsiveMediaFrame";

export type SidebarNavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  group: string;
};

type CollapsibleSidebarProps = {
  items: SidebarNavItem[];
  rootPath: string;
  logoUrl?: string;
  title: string;
  subtitle: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onMobileOpenChange: (open: boolean) => void;
  footer?: React.ReactNode;
};

function groupedItems(items: SidebarNavItem[]) {
  return items.reduce<Record<string, SidebarNavItem[]>>((acc, item) => {
    acc[item.group] ||= [];
    acc[item.group].push(item);
    return acc;
  }, {});
}

export function CollapsibleSidebar({
  items,
  rootPath,
  logoUrl,
  title,
  subtitle,
  collapsed,
  mobileOpen,
  onCollapsedChange,
  onMobileOpenChange,
  footer
}: CollapsibleSidebarProps) {
  const location = useLocation();
  const grouped = groupedItems(items);
  const activeItem = items.find(item => location.pathname === item.path || (item.path !== rootPath && location.pathname.startsWith(item.path)));

  const renderSidebar = (mobile = false) => {
    const minimized = collapsed && !mobile;
    return (
      <aside
        className={cn(
          "premium-admin-sidebar admin-collapsible-sidebar flex h-dvh flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface-strong)] text-[var(--admin-text)] shadow-[12px_0_36px_rgba(0,0,0,0.18)] transition-[width,transform] duration-300",
          mobile ? "w-[min(88vw,304px)] px-4" : "fixed left-0 top-0 z-50 hidden px-3 lg:flex",
          !mobile && (minimized ? "w-20" : "w-72")
        )}
        data-collapsed={minimized ? "true" : "false"}
      >
        <div className={cn("flex min-h-[76px] items-center border-b border-[var(--admin-border)]", minimized ? "justify-center" : "gap-3")}>
          <Link to={rootPath} className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[var(--admin-primary)] text-[var(--admin-button-text)] shadow-[0_0_28px_var(--admin-glow)]" aria-label={title}>
            {logoUrl ? <ResponsiveMediaFrame src={logoUrl} type="image" alt={title} preferredFit="contain" aspectMode="square" className="h-full w-full rounded-none" /> : <Hexagon className="h-7 w-7" />}
          </Link>
          {!minimized && (
            <Link to={rootPath} className="min-w-0">
              <h1 className="mb-0 truncate text-lg font-semibold text-[var(--admin-text)]">{title}</h1>
              <p className="truncate text-xs text-[var(--admin-muted)]">{subtitle}</p>
            </Link>
          )}
          {mobile && (
            <button onClick={() => onMobileOpenChange(false)} className="admin-icon-button ml-auto" aria-label="Fechar menu">
              <X className="h-5 w-5" />
            </button>
          )}
          {!mobile && !minimized && (
            <button onClick={() => onCollapsedChange(true)} className="admin-icon-button ml-auto h-8 w-8" aria-label="Recolher menu" title="Recolher menu">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className={cn("flex-1 overflow-y-auto py-5 custom-scrollbar", minimized ? "space-y-4 overflow-visible" : "space-y-6")} aria-label="Menu principal">
          {(Object.entries(grouped) as Array<[string, SidebarNavItem[]]>).map(([group, groupItems]) => (
            <div key={group}>
              {!minimized && <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">{group}</p>}
              <div className="space-y-1">
                {groupItems.map(item => {
                  const isActive = location.pathname === item.path || (item.path !== rootPath && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={`${item.group}-${item.name}`}
                      to={item.path}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={minimized ? item.name : undefined}
                      onClick={() => onMobileOpenChange(false)}
                      className={cn(
                        "group/sidebar relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]",
                        minimized && "justify-center px-0",
                        isActive
                          ? "bg-[var(--admin-primary)] text-[var(--admin-button-text)] shadow-[0_10px_28px_var(--admin-glow)]"
                          : "text-[var(--admin-muted)] hover:bg-white/[0.07] hover:text-[var(--admin-text)]"
                      )}
                    >
                      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", isActive ? "bg-black/10" : "bg-white/[0.04]")}>
                        <item.icon className="h-4.5 w-4.5" />
                      </span>
                      {!minimized && <span className="min-w-0 flex-1 truncate">{item.name}</span>}
                      {minimized && (
                        <span role="tooltip" className="sidebar-tooltip pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-[120] hidden -translate-y-1/2 whitespace-nowrap rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] px-3 py-2 text-xs font-semibold text-[var(--admin-text)] shadow-2xl backdrop-blur-2xl group-hover/sidebar:block group-focus-visible/sidebar:block">
                          {item.name}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-[var(--admin-border)] py-4">
          {!mobile && (
            <button onClick={() => onCollapsedChange(!collapsed)} className={cn("admin-icon-button mx-auto h-9 w-9", minimized && "h-10 w-10")} aria-label={minimized ? "Expandir menu" : "Recolher menu"} title={minimized ? "Expandir menu" : "Recolher menu"}>
              {minimized ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
          {footer}
        </div>
      </aside>
    );
  };

  return (
    <>
      {renderSidebar(false)}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <button className="absolute inset-0 h-full w-full bg-black/55 backdrop-blur-sm" onClick={() => onMobileOpenChange(false)} aria-label="Fechar menu lateral" />
          <div className="relative h-full">{renderSidebar(true)}</div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">{activeItem?.name || title}</span>
    </>
  );
}
