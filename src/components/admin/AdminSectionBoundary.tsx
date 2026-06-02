import React, { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";

function adminDebugEnabled() {
  return !import.meta.env.PROD || (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("adminDebug") === "1"
  );
}

function logAdminSectionError(section: string, error: Error) {
  if (!adminDebugEnabled()) return;
  console.warn("[admin-section] render_error", {
    section,
    reason: error.message || "unknown"
  });
}

export class AdminSectionBoundary extends Component<
  { children: ReactNode; section: string },
  { error: Error | null; retryKey: number }
> {
  declare props: { children: ReactNode; section: string };
  state: { error: Error | null; retryKey: number } = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    logAdminSectionError(this.props.section, error);
  }

  render() {
    if (!this.state.error) {
      return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
    }

    return (
      <section className="admin-card mx-auto max-w-3xl border-amber-300/30 bg-amber-300/10 p-6 text-[var(--admin-text)] shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-amber-300/30 bg-amber-300/15 text-amber-200">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Painel administrativo</p>
            <h2 className="mt-2 text-2xl font-black text-[var(--admin-text)]">Não foi possível carregar esta seção</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
              A seção {this.props.section} encontrou uma instabilidade ao montar os dados. O restante do painel continua disponível.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="admin-button justify-center"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-4 w-4" /> Tentar novamente
              </button>
              <Link to="/admin" className="admin-button-secondary justify-center">
                <LayoutDashboard className="h-4 w-4" /> Voltar ao dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }
}
