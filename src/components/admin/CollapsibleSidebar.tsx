import { Link, useLocation } from "react-router-dom";
import type React from "react";
import { ChevronLeft, ChevronRight, Hexagon, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

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
          "premium-admin-sidebar admin-collapsible-sidebar flex h-dvh flex-col border-r border-[var(--admin-border)] bg-[var(--admin-sidebar)] text-[var(--admin-text)] shadow-[12px_0_36px_rgba(0,0,0,0.18)] transition-[width,transform] duration-300",
          mobile ? "w-[min(86vw,288px)] px-3" : "fixed left-0 top-0 z-50 hidden px-2 lg:flex",
          !mobile && (minimized ? "w-[80px]" : "w-[224px]")
        )}
        data-collapsed={minimized ? "true" : "false"}
      >
        <div className="flex min-h-[58px] items-center justify-center border-b border-[var(--admin-border)]">
          <Link
            to={rootPath}
            className={cn("admin-sidebar-brand-link shrink-0", minimized && "is-minimized")}
            aria-label={title}
          >
            {logoUrl ? <img src={logoUrl} alt={title} className="admin-sidebar-brand-logo" /> : <Hexagon className="h-7 w-7" />}
          </Link>
          {mobile && (
            <button onClick={() => onMobileOpenChange(false)} className="admin-icon-button ml-auto" aria-label="Fechar menu">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className={cn("flex-1 overflow-y-auto py-3 cifher-scrollbar custom-scrollbar", minimized ? "space-y-3 overflow-x-visible" : "space-y-3")} aria-label="Menu principal">
          {(Object.entries(grouped) as Array<[string, SidebarNavItem[]]>).map(([group, groupItems]) => (
            <div key={group}>
              {!minimized && <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase text-[var(--admin-muted)]">{group}</p>}
              <div className="space-y-1">
                {groupItems.map(item => {
                  const isActive = location.pathname === item.path || (item.path !== rootPath && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={`${item.group}-${item.name}`}
                      to={item.path}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={minimized ? item.name : undefined}
                      title={minimized ? item.name : undefined}
                      onClick={() => onMobileOpenChange(false)}
                      className={cn(
                        "group/sidebar relative flex min-h-9 items-center gap-2 rounded-[10px] px-2 py-1.5 text-[13px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]",
                        minimized && "justify-center px-0",
                        isActive
                          ? "bg-[var(--admin-primary)] text-[var(--admin-button-text)] shadow-[0_10px_28px_var(--admin-glow)]"
                          : "text-[var(--admin-secondary-text)] hover:bg-[var(--admin-primary)]/10 hover:text-[var(--admin-text)]"
                      )}
                    >
                      <span className={cn("grid shrink-0 place-items-center rounded-[8px]", minimized ? "h-9 w-9" : "h-7 w-7", isActive ? "bg-black/10" : "bg-[var(--admin-primary)]/10")}>
                        <item.icon className={minimized ? "h-5 w-5" : "h-4.5 w-4.5"} />
                      </span>
                      {!minimized && <span className="min-w-0 flex-1 truncate">{item.name}</span>}
                      {minimized && (
                        <span role="tooltip" className="sidebar-tooltip pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-[120] hidden -translate-y-1/2 whitespace-nowrap rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] px-3 py-2 text-xs font-semibold text-[var(--admin-text)] shadow-2xl backdrop-blur-2xl group-hover/sidebar:block group-focus-visible/sidebar:block">
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

        <div className="space-y-2 border-t border-[var(--admin-border)] py-3">
          {!mobile && (
            <button onClick={() => onCollapsedChange(!collapsed)} className="admin-sidebar-toggle mx-auto" aria-label={minimized ? "Expandir menu" : "Recolher menu"} title={minimized ? "Expandir menu" : "Recolher menu"}>
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
