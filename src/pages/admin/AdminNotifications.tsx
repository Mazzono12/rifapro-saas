import { Archive, Check, ExternalLink, Inbox, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  status: "unread" | "read" | "archived";
  actionUrl?: string;
  createdAt: string;
};

const filters = [
  { id: "all", label: "Todas" },
  { id: "unread", label: "Nao lidas" },
  { id: "important", label: "Importantes" },
  { id: "errors", label: "Erros" },
  { id: "archived", label: "Arquivadas" }
] as const;

const severityClass: Record<NotificationItem["severity"], string> = {
  info: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  success: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  warning: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  error: "border-rose-300/30 bg-rose-300/10 text-rose-100"
};

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function AdminNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    if (filter === "unread") return "status=unread";
    if (filter === "archived") return "status=archived";
    if (filter === "important") return "important=true";
    if (filter === "errors") return "severity=error";
    return "status=all";
  }, [filter]);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/notifications?${query}`);
    const data = await response.json().catch(() => ({}));
    setItems(response.ok && Array.isArray(data.notifications) ? data.notifications : []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [query]);

  async function update(id: string, action: "read" | "archive" | "delete") {
    const url = action === "delete" ? `/api/notifications/${id}` : `/api/notifications/${id}/${action}`;
    await fetch(url, { method: action === "delete" ? "DELETE" : "PUT" });
    await load();
  }

  async function readAll() {
    await fetch("/api/notifications/read-all", { method: "PUT" });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--admin-muted)]">Acompanhe os avisos importantes da sua operacao.</p>
        </div>
        <button type="button" onClick={() => void readAll()} className="admin-button-secondary">
          <Check className="h-4 w-4" />
          Marcar todas como lidas
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2">
        {filters.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              "h-10 shrink-0 rounded-[8px] px-4 text-sm font-semibold transition",
              filter === item.id ? "bg-[var(--admin-primary)] text-[var(--admin-button-text)]" : "text-[var(--admin-muted)] hover:bg-white/5 hover:text-[var(--admin-text)]"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="admin-card overflow-hidden p-0">
        {loading && <div className="p-6 text-sm text-[var(--admin-muted)]">Carregando avisos...</div>}
        {!loading && items.length === 0 && (
          <div className="grid min-h-[260px] place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-[8px] border border-[var(--admin-border)] bg-white/5 text-[var(--admin-muted)]">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-semibold text-[var(--admin-text)]">Nenhum aviso encontrado</p>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">Quando algo pedir sua atencao, vai aparecer aqui.</p>
            </div>
          </div>
        )}
        {!loading && items.map(item => (
          <div key={item.id} className={cn("border-b border-[var(--admin-border)] p-4 last:border-b-0", item.status === "unread" && "bg-white/[0.045]")}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-[8px] border px-2 py-1 text-xs font-semibold", severityClass[item.severity])}>
                    {item.severity === "error" ? "Erro" : item.severity === "warning" ? "Importante" : item.severity === "success" ? "Resolvido" : "Aviso"}
                  </span>
                  {item.status === "unread" && <span className="rounded-[8px] bg-amber-300 px-2 py-1 text-xs font-black text-black">Nova</span>}
                  <span className="text-xs text-[var(--admin-muted)]">{dateLabel(item.createdAt)}</span>
                </div>
                <h2 className="mt-3 text-base font-semibold text-[var(--admin-text)]">{item.title}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">{item.message}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {item.actionUrl && (
                  <Link to={item.actionUrl} className="admin-button-secondary">
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </Link>
                )}
                {item.status === "unread" && (
                  <button type="button" onClick={() => void update(item.id, "read")} className="admin-icon-button" aria-label="Marcar como lida" title="Marcar como lida">
                    <Check className="h-5 w-5" />
                  </button>
                )}
                {item.status !== "archived" && (
                  <button type="button" onClick={() => void update(item.id, "archive")} className="admin-icon-button" aria-label="Arquivar" title="Arquivar">
                    <Archive className="h-5 w-5" />
                  </button>
                )}
                <button type="button" onClick={() => void update(item.id, "delete")} className="admin-icon-button" aria-label="Excluir" title="Excluir">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
