import { Archive, Bell, Check, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  status: "unread" | "read" | "archived";
  actionUrl?: string;
  createdAt: string;
};

const severityDot: Record<NotificationItem["severity"], string> = {
  info: "bg-cyan-300",
  success: "bg-emerald-300",
  warning: "bg-slate-100",
  error: "bg-rose-300"
};

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function NotificationBell({ centerPath = "/admin/notificacoes" }: { centerPath?: string }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    const [countRes, listRes] = await Promise.all([
      fetch("/api/notifications/unread-count"),
      fetch("/api/notifications?status=all")
    ]);
    if (countRes.ok) {
      const data = await countRes.json().catch(() => ({}));
      setUnread(Number(data.unread || 0));
    }
    if (listRes.ok) {
      const data = await listRes.json().catch(() => ({}));
      setItems(Array.isArray(data.notifications) ? data.notifications.slice(0, 6) : []);
    }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const visibleItems = useMemo(() => items.filter(item => item.status !== "archived"), [items]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
    await load();
  }

  async function archive(id: string) {
    await fetch(`/api/notifications/${id}/archive`, { method: "PUT" });
    await load();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button type="button" onClick={() => setOpen(value => !value)} className="rp-admin-icon-button rp-admin-notification-trigger relative" aria-label="Notificacoes" title="Notificacoes">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="rp-admin-notification-count absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-black">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="rp-admin-notification-menu absolute right-0 top-12 z-50 w-[min(92vw,380px)] overflow-hidden rounded-[10px] border shadow-xl">
          <div className="rp-admin-notification-menu-header flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--rp-text)]">Notificacoes</p>
              <p className="text-xs text-[var(--rp-muted)]">{unread ? `${unread} nao lida${unread > 1 ? "s" : ""}` : "Tudo em dia"}</p>
            </div>
            <Link to={centerPath} onClick={() => setOpen(false)} className="rp-admin-notification-view-all rp-admin-button is-secondary !min-h-9 !px-3 text-xs">
              Ver todas
            </Link>
          </div>

          <div className="rp-admin-notification-list max-h-[420px] overflow-y-auto p-2">
            {visibleItems.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-[var(--rp-muted)]">Nenhum aviso por enquanto.</div>
            )}
            {visibleItems.map(item => (
              <div key={item.id} className={cn("rp-admin-notification-item rounded-[8px] border p-3", item.status === "unread" ? "is-unread" : "is-read")}>
                <div className="flex items-start gap-3">
                  <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", severityDot[item.severity])} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-semibold text-[var(--rp-text)]">{item.title}</p>
                      <span className="shrink-0 text-[11px] text-[var(--rp-muted)]">{timeLabel(item.createdAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--rp-muted)]">{item.message}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {item.actionUrl && (
                        <Link to={item.actionUrl} onClick={() => setOpen(false)} className="rp-admin-notification-action rp-admin-button is-secondary !min-h-8 !px-2 text-xs">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir
                        </Link>
                      )}
                      {item.status === "unread" && (
                        <button type="button" onClick={() => void markRead(item.id)} className="rp-admin-icon-button !h-8 !w-8" aria-label="Marcar como lida" title="Marcar como lida">
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button type="button" onClick={() => void archive(item.id)} className="rp-admin-icon-button !h-8 !w-8" aria-label="Arquivar" title="Arquivar">
                        <Archive className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

