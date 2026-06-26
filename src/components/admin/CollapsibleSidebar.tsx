import { Link, useLocation } from "react-router-dom";
import type React from "react";
import { ChevronsUpDown, Hexagon, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
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
        data-premium-sidebar="true"
        className={cn(
          "premium-admin-sidebar admin-collapsible-sidebar flex h-dvh flex-col border-r border-[var(--admin-border)] bg-[var(--admin-sidebar)] text-[var(--admin-text)] transition-[width,transform] duration-200",
          mobile ? "w-[min(86vw,288px)] p-2" : "fixed left-0 top-0 z-50 hidden p-2 lg:flex",
          !mobile && (minimized ? "w-[56px]" : "w-[256px]")
        )}
        data-collapsed={minimized ? "true" : "false"}
      >
        <div className={cn("flex min-h-12 items-center gap-2", minimized ? "justify-center" : "justify-start")}>
          <Link to={rootPath} className={cn("admin-sidebar-team-button", minimized && "is-minimized")} aria-label={title}>
            <span className="admin-sidebar-team-logo">
              {logoUrl ? <img src={logoUrl} alt={title} className="admin-sidebar-brand-logo" /> : <Hexagon className="h-4 w-4" />}
            </span>
            {!minimized && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold leading-tight text-[var(--admin-text)]">{title}</span>
                  <span className="block truncate text-xs text-[var(--admin-muted)]">{subtitle || "Operacao SaaS"}</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 text-[var(--admin-muted)]" />
              </>
            )}
          </Link>
          {mobile && (
            <button onClick={() => onMobileOpenChange(false)} className="admin-icon-button ml-auto" aria-label="Fechar menu">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className={cn("flex-1 overflow-y-auto py-2 cifher-scrollbar custom-scrollbar", minimized ? "space-y-3 overflow-x-visible" : "space-y-3")} aria-label="Menu principal">
          {(Object.entries(grouped) as Array<[string, SidebarNavItem[]]>).map(([group, groupItems]) => (
            <div key={group} className="admin-sidebar-group">
              {!minimized && <p className="admin-sidebar-group-label">{group}</p>}
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
                        "admin-sidebar-menu-button group/sidebar relative flex min-h-8 items-center gap-2 rounded-md px-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]",
                        minimized && "justify-center px-0",
                        isActive
                          ? "is-active"
                          : "text-[var(--admin-secondary-text)] hover:bg-[var(--admin-secondary)] hover:text-[var(--admin-text)]"
                      )}
                    >
                      <span className={cn("grid shrink-0 place-items-center", minimized ? "h-8 w-8" : "h-4 w-4")}>
                        <item.icon className="h-4 w-4" />
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

        <div className="space-y-2 border-t border-[var(--admin-border)] pt-2">
          {!mobile && (
            <button onClick={() => onCollapsedChange(!collapsed)} className="admin-sidebar-toggle mx-auto" aria-label={minimized ? "Expandir menu" : "Recolher menu"} title={minimized ? "Expandir menu" : "Recolher menu"}>
              {minimized ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
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



