import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type ComponentType, type CSSProperties, type InputHTMLAttributes, type Key, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import {
  Bell,
  Building2,
  ChevronDown,
  CircleHelp,
  CreditCard,
  FileBarChart,
  Gamepad2,
  Home,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Ticket,
  Trophy,
  UserRound,
  Users,
  Wallet,
  X
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useAuth } from "../../../context/auth/AuthContext";
import { useTenantBranding } from "../../../context/tenant-branding/TenantBrandingContext";
import { NotificationBell } from "../../notifications/NotificationBell";

type IconType = ComponentType<{ className?: string; style?: CSSProperties }>;

type NavItem = {
  label: string;
  to: string;
  icon: IconType;
  children?: Array<{ label: string; to: string }>;
};

type NavGroup = {
  title?: string;
  items: NavItem[];
};

const adminGroups: NavGroup[] = [
  { items: [{ label: "Dashboard", to: "/admin/dashboard", icon: Home }] },
  {
    title: "Principal",
    items: [
      { label: "Campanhas", to: "/admin/campanhas", icon: Ticket },
      { label: "Pedidos", to: "/admin/pedidos", icon: Wallet },
      { label: "Pagamentos", to: "/admin/pagamentos", icon: CreditCard },
      { label: "Afiliados", to: "/admin/afiliados", icon: Users },
      { label: "Usuarios", to: "/admin/usuarios", icon: UserRound }
    ]
  },
  {
    title: "Modalidades",
    items: [
      { label: "Fazendinha", to: "/admin/fazendinha", icon: Package },
      { label: "Dezena", to: "/admin/dezena", icon: Gamepad2 },
      { label: "Centena", to: "/admin/centena", icon: Gamepad2 },
      { label: "Milhar", to: "/admin/milhar", icon: Gamepad2 },
      { label: "Roleta", to: "/admin/roleta-premiada", icon: Sparkles },
      { label: "Caixinha Premiada", to: "/admin/caixinha-premiada", icon: Trophy },
      { label: "Raspadinha", to: "/admin/raspadinha", icon: Ticket },
      { label: "Super Cotas", to: "/admin/cotas", icon: ShieldCheck }
    ]
  },
  {
    title: "Operacao",
    items: [
      { label: "Promocoes", to: "/admin/promocoes", icon: Sparkles },
      { label: "Gamificacao", to: "/admin/gamificacao", icon: Trophy },
      { label: "Relatorios", to: "/admin/relatorios", icon: FileBarChart }
    ]
  },
  {
    title: "Sistema",
    items: [
      { label: "Aparencia", to: "/admin/aparencia", icon: Settings },
      { label: "Integracoes", to: "/admin/integracoes", icon: Package },
      { label: "Configuracoes", to: "/admin/configuracoes", icon: Settings }
    ]
  }
];

const superAdminGroups: NavGroup[] = [
  { items: [{ label: "Dashboard", to: "/superadmin/dashboard", icon: LayoutDashboard }] },
  {
    title: "Plataforma",
    items: [
      { label: "Gestao de Tenantes", to: "/superadmin/clientes", icon: Building2 },
      { label: "Comissoes", to: "/superadmin/platform-billing", icon: Wallet },
      { label: "Dominios", to: "/superadmin/dominios", icon: ShieldCheck },
      { label: "Relatorios", to: "/superadmin/relatorios", icon: FileBarChart }
    ]
  },
  {
    title: "Governanca",
    items: [
      { label: "Logs e Auditoria", to: "/superadmin/auditoria", icon: ShieldCheck },
      { label: "Integracoes", to: "/superadmin/integracoes", icon: Package },
      { label: "Configuracoes", to: "/superadmin/white-label", icon: Settings }
    ]
  }
];

export function AdminAppShell({ mode = "admin" }: { mode?: "admin" | "superadmin" }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { companyName, logoUrl, branding } = useTenantBranding();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const groups = mode === "superadmin" ? superAdminGroups : adminGroups;
  const brandName = mode === "superadmin" ? "RifaPro" : companyName || "RifaPro";
  const brandLogo = mode === "superadmin" ? branding.logo_url : logoUrl;
  const profileLabel = auth.profile?.name || auth.user?.email || (mode === "superadmin" ? "Super Admin" : "Admin");
  const initials = profileLabel.slice(0, 2).toUpperCase();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  async function signOut() {
    await auth.logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className={cn("rp-admin-shell", collapsed && "rp-admin-shell--collapsed")} style={{ background: "#f8fafc", backgroundColor: "#f8fafc", color: "#111827", colorScheme: "light" }}>
      <AdminSidebar
        groups={groups}
        brandName={brandName}
        brandLogo={brandLogo}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        currentPath={location.pathname}
        onClose={() => setMobileOpen(false)}
      />
      <div className="rp-admin-main" style={{ background: "#f8fafc", backgroundColor: "#f8fafc", color: "#111827" }}>
        <AdminTopbar
          collapsed={collapsed}
          dark={dark}
          profileLabel={profileLabel}
          initials={initials}
          mode={mode}
          onMenu={() => setMobileOpen(true)}
          onToggleSidebar={() => setCollapsed(value => !value)}
          onToggleTheme={() => setDark(value => !value)}
          onSignOut={() => void signOut()}
        />
        <main className="rp-admin-content" style={{ background: "#f8fafc", backgroundColor: "#f8fafc", color: "#111827" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminSidebar({ groups, brandName, brandLogo, collapsed, mobileOpen, currentPath, onClose }: {
  groups: NavGroup[];
  brandName: string;
  brandLogo?: string;
  collapsed: boolean;
  mobileOpen: boolean;
  currentPath: string;
  onClose: () => void;
}) {
  return (
    <>
      <button className={cn("rp-admin-sidebar-backdrop", mobileOpen && "is-open")} onClick={onClose} aria-label="Fechar menu" />
      <aside className={cn("rp-admin-sidebar", collapsed && "is-collapsed", mobileOpen && "is-open")} style={{ background: "#ffffff", backgroundColor: "#ffffff", backgroundImage: "none", color: "#334155", colorScheme: "light" }}>
        <div className="rp-admin-brand" style={{ background: "#ffffff", backgroundColor: "#ffffff", color: "#334155" }}>
          <div className="rp-admin-brand-mark" style={{ background: "#eff6ff", backgroundColor: "#eff6ff", color: "#2563eb" }}>
            {brandLogo ? <img src={brandLogo} alt="" /> : <span>R</span>}
          </div>
          {!collapsed && <strong style={{ color: "#2563eb" }}>{brandName}</strong>}
          {!collapsed && <span className="rp-admin-brand-pill" style={{ background: "#ffffff", backgroundColor: "#ffffff", color: "#334155", borderColor: "#dbe3ef" }}>ADMIN</span>}
          <button className="rp-admin-mobile-close" onClick={onClose} aria-label="Fechar menu"><X className="h-4 w-4" /></button>
        </div>
        <nav className="rp-admin-nav">
          {groups.map((group, groupIndex) => (
            <div key={group.title || groupIndex} className="rp-admin-nav-group" style={{ background: "#ffffff", backgroundColor: "#ffffff" }}>
              {group.title && !collapsed && <p style={{ color: "#64748b" }}>{group.title}</p>}
              {group.items.map(item => {
                const active = currentPath === item.to || (item.to !== "/admin/dashboard" && currentPath.startsWith(item.to));
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} className={cn("rp-admin-nav-link", active && "is-active")} title={collapsed ? item.label : undefined} style={{ background: active ? "#eff6ff" : "transparent", backgroundColor: active ? "#eff6ff" : "transparent", color: active ? "#2563eb" : "#475569" }}>
                    <Icon className="h-4 w-4" style={{ color: "currentColor", stroke: "currentColor" }} />
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && item.children && <ChevronDown className="ml-auto h-4 w-4" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export function AdminTopbar({ collapsed, dark, profileLabel, initials, mode, onMenu, onToggleSidebar, onToggleTheme, onSignOut }: {
  collapsed: boolean;
  dark: boolean;
  profileLabel: string;
  initials: string;
  mode: "admin" | "superadmin";
  onMenu: () => void;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onSignOut: () => void;
}) {
  return (
    <header className="rp-admin-topbar" style={{ background: "rgba(255,255,255,.96)", backgroundColor: "rgba(255,255,255,.96)", color: "#111827" }}>
      <button className="rp-admin-icon-button rp-admin-sidebar-toggle lg:hidden" style={{ background: "#eff6ff", backgroundColor: "#eff6ff", color: "#2563eb", borderColor: "#dbeafe" }} onClick={onMenu} aria-label="Abrir menu"><PanelLeftOpen className="h-5 w-5" /></button>
      <button className="rp-admin-icon-button rp-admin-sidebar-toggle hidden lg:inline-grid" style={{ background: "#eff6ff", backgroundColor: "#eff6ff", color: "#2563eb", borderColor: "#dbeafe" }} onClick={onToggleSidebar} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>{collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}</button>
      <AdminSearch placeholder={mode === "superadmin" ? "Buscar tenantes, dominios, logs..." : "Buscar pedidos, numeros, campanhas..."} />
      <div className="rp-admin-topbar-actions">
        <button className="rp-admin-icon-button" onClick={onToggleTheme} aria-label="Alternar tema">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
        <button className="rp-admin-icon-button" aria-label="Ajuda"><CircleHelp className="h-4 w-4" /></button>
        <NotificationBell centerPath={mode === "superadmin" ? "/superadmin/notificacoes" : "/admin/notificacoes"} />
        <button className="rp-admin-notification" aria-label="Notificacoes"><Bell className="h-4 w-4" /><span>5</span></button>
        <button className="rp-admin-profile" type="button">
          <span className="rp-admin-avatar">{initials}</span>
          <span><strong>{profileLabel}</strong><small>{mode === "superadmin" ? "Super Administrador" : "Administrador"}</small></span>
          <ChevronDown className="h-4 w-4" />
        </button>
        <button className="rp-admin-icon-button" onClick={onSignOut} aria-label="Sair"><LogOut className="h-4 w-4" /></button>
      </div>
    </header>
  );
}

export function AdminPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rp-admin-page", className)} style={{ background: "transparent", color: "#111827" }}>{children}</div>;
}

export function AdminPageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="rp-admin-page-header" style={{ background: "transparent", color: "#111827" }}>
      <div>
        {eyebrow && <div className="rp-admin-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="rp-admin-page-actions">{actions}</div>}
    </div>
  );
}

export function AdminSection({ title, description, actions, children, className }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rp-admin-section", className)} style={{ background: "#ffffff", backgroundColor: "#ffffff", color: "#111827", borderColor: "#e5e7eb" }}>
      {(title || description || actions) && (
        <div className="rp-admin-section-header">
          <div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function AdminToolbar({ children }: { children: ReactNode }) {
  return <div className="rp-admin-toolbar">{children}</div>;
}

export function AdminCard({ children, className }: { children: ReactNode; className?: string; key?: Key }) {
  return <article className={cn("rp-admin-card", className)} style={{ background: "#ffffff", backgroundColor: "#ffffff", color: "#111827", borderColor: "#e5e7eb" }}>{children}</article>;
}

export function AdminMetricCard({ icon: Icon, label, value, detail, tone = "blue" }: { icon: IconType; label: string; value: ReactNode; detail?: ReactNode; tone?: "blue" | "purple" | "green" | "orange" | "red" | "slate" }) {
  return (
    <AdminCard className="rp-admin-metric-card">
      <span className={cn("rp-admin-metric-icon", `tone-${tone}`)}><Icon className="h-4 w-4" style={{ color: "currentColor", stroke: "currentColor" }} /></span>
      <div><p>{label}</p><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
    </AdminCard>
  );
}

export const AdminStatCard = AdminMetricCard;

export function AdminButton({ children, variant = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; className?: string }) {
  return <button className={cn("rp-admin-button", `is-${variant}`, className)} style={{ background: variant === "primary" ? "#2563eb" : "#ffffff", backgroundColor: variant === "primary" ? "#2563eb" : "#ffffff", color: variant === "primary" ? "#ffffff" : "#111827", borderColor: variant === "primary" ? "#2563eb" : "#e5e7eb", ...props.style }} {...props}>{children}</button>;
}

export function AdminIconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn("rp-admin-icon-button", props.className)} style={{ background: "transparent", color: "#334155", borderColor: "transparent", ...props.style }} />;
}

export function AdminInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("rp-admin-input", props.className)} style={{ background: "#ffffff", backgroundColor: "#ffffff", color: "#111827", borderColor: "#e5e7eb", colorScheme: "light", ...props.style }} />;
}

export function AdminTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("rp-admin-input min-h-32", props.className)} style={{ background: "#ffffff", backgroundColor: "#ffffff", color: "#111827", borderColor: "#e5e7eb", colorScheme: "light", ...props.style }} />;
}

export function AdminSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("rp-admin-input", props.className)} style={{ background: "#ffffff", backgroundColor: "#ffffff", color: "#111827", borderColor: "#e5e7eb", colorScheme: "light", ...props.style }} />;
}

export function AdminSwitch({ checked }: { checked?: boolean }) {
  return <span className={cn("rp-admin-switch", checked && "is-on")}><i /></span>;
}

export function AdminCheckbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" {...props} className={cn("rp-admin-checkbox", props.className)} />;
}

export function AdminTabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (tab: string) => void }) {
  return <div className="rp-admin-tabs" style={{ background: "#ffffff", backgroundColor: "#ffffff", borderColor: "#e5e7eb" }}>{tabs.map(tab => <button key={tab} className={cn(active === tab && "is-active")} style={{ background: "transparent", color: active === tab ? "#2563eb" : "#475569", borderColor: active === tab ? "#2563eb" : "transparent" }} onClick={() => onChange(tab)}>{tab}</button>)}</div>;
}

export function AdminModal({ children }: { children: ReactNode }) {
  return <div className="rp-admin-modal">{children}</div>;
}

export function AdminDrawer({ children }: { children: ReactNode }) {
  return <aside className="rp-admin-drawer">{children}</aside>;
}

export function AdminBadge({ children, tone = "slate" }: { children: ReactNode; tone?: "success" | "warning" | "danger" | "info" | "purple" | "slate" }) {
  return <span className={cn("rp-admin-badge", `tone-${tone}`)}>{children}</span>;
}

export function AdminAvatar({ children }: { children: ReactNode }) {
  return <span className="rp-admin-avatar">{children}</span>;
}

export function AdminTable({ columns, rows, empty = "Nenhum registro encontrado." }: { columns: string[]; rows: ReactNode[][]; empty?: string }) {
  return (
    <div className="rp-admin-table-wrap" style={{ background: "#ffffff", backgroundColor: "#ffffff", color: "#111827" }}>
      <table className="rp-admin-table" style={{ background: "#ffffff", backgroundColor: "#ffffff", color: "#111827" }}>
        <thead><tr>{columns.map(column => <th key={column} style={{ background: "#ffffff", color: "#64748b", borderColor: "#e5e7eb" }}>{column}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} style={{ background: "#ffffff", color: "#111827", borderColor: "#e5e7eb" }}>{cell}</td>)}</tr>) : <tr><td colSpan={columns.length} className="rp-admin-table-empty" style={{ background: "#ffffff", color: "#64748b", borderColor: "#e5e7eb" }}>{empty}</td></tr>}</tbody>
      </table>
    </div>
  );
}
export const AdminDataGrid = AdminTable;

export function AdminFilters({ children }: { children: ReactNode }) {
  return <div className="rp-admin-filters" style={{ background: "#ffffff", backgroundColor: "#ffffff", color: "#111827" }}>{children}</div>;
}

export function AdminChartCard({ title, children }: { title: string; children: ReactNode }) {
  return <AdminSection title={title}>{children}</AdminSection>;
}

export function AdminEmptyState({ title, description }: { title: string; description?: string }) {
  return <div className="rp-admin-empty"><strong>{title}</strong>{description && <p>{description}</p>}</div>;
}

export function AdminLoading() {
  return <div className="rp-admin-empty">Carregando...</div>;
}

export function AdminSkeleton() {
  return <div className="rp-admin-skeleton" />;
}

export function AdminPagination() {
  return <div className="rp-admin-pagination"><button>‹</button><button className="is-active">1</button><button>2</button><button>3</button><button>...</button><button>›</button></div>;
}

export function AdminSearch({ placeholder = "Buscar..." }: { placeholder?: string }) {
  return <label className="rp-admin-search" style={{ background: "#ffffff", backgroundColor: "#ffffff", color: "#64748b", borderColor: "#e5e7eb" }}><Search className="h-4 w-4" /><input placeholder={placeholder} style={{ background: "transparent", backgroundColor: "transparent", color: "#111827", colorScheme: "light" }} /><kbd>Ctrl + K</kbd></label>;
}

export function AdminStatus({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "warning" | "danger" | "info" | "slate" }) {
  return <AdminBadge tone={tone}>{children}</AdminBadge>;
}

export function AdminTimeline({ items }: { items: Array<{ title: string; detail?: string }> }) {
  return <div className="rp-admin-timeline">{items.map(item => <div key={item.title}><span /><strong>{item.title}</strong>{item.detail && <p>{item.detail}</p>}</div>)}</div>;
}

export function AdminAlert({ children }: { children: ReactNode }) {
  return <div className="rp-admin-alert">{children}</div>;
}

export const AdminInfoCard = AdminCard;
export const AdminWidget = AdminCard;

export function AdminProgress({ value }: { value: number }) {
  return <span className="rp-admin-progress"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>;
}









