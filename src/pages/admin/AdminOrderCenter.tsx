import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileSearch,
  Grid3X3,
  List,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Shuffle,
  Ticket,
  Users,
  Wallet,
  X
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "../../lib/authSession";

type OrderCenterRow = {
  id: string;
  source: "raffle" | "number_mode" | "fazendinha";
  pedido: string;
  purchaseId: string;
  orderId: string;
  cliente: string;
  telefone: string;
  cpf: string;
  email: string;
  campanha: string;
  campaignId: string;
  quantidadeCotas: number;
  valor: number;
  gateway: string;
  statusPedido: string;
  statusPagamento: string;
  dataCompra: string;
  dataPagamento: string;
  paymentId: string;
  externalReference: string;
  pixTransactionId: string;
  tickets: string[];
  numbersPreview: string;
};

type OrderCenterDetail = {
  row: OrderCenterRow;
  cliente: Record<string, string>;
  compra: Record<string, any>;
  pagamento: Record<string, any>;
  webhook: { eventId: string; ultimoEvento: string; status: string; data: string; jobId: string; historico: any[] };
  cotas: string[];
  historicoCotas: Array<Record<string, any>>;
  premiosInstantaneos: Array<Record<string, any>>;
  premioPrincipal: Record<string, any> | null;
  timeline: Array<Record<string, any>>;
  ajustes: Array<Record<string, any>>;
  auditoria: Array<Record<string, any>>;
};

const emptyRow: OrderCenterRow = {
  id: "",
  source: "raffle",
  pedido: "",
  purchaseId: "",
  orderId: "",
  cliente: "Cliente",
  telefone: "",
  cpf: "",
  email: "",
  campanha: "Campanha",
  campaignId: "",
  quantidadeCotas: 0,
  valor: 0,
  gateway: "manual",
  statusPedido: "pending",
  statusPagamento: "pending",
  dataCompra: "",
  dataPagamento: "",
  paymentId: "",
  externalReference: "",
  pixTransactionId: "",
  tickets: [],
  numbersPreview: ""
};

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value === undefined || value === null ? fallback : String(value);
}

function normalizeRow(value: any): OrderCenterRow {
  const raw = value && typeof value === "object" ? value : {};
  const orderId = safeText(raw.orderId || raw.purchaseId || raw.pedido || raw.id);
  const source = ["raffle", "number_mode", "fazendinha"].includes(raw.source) ? raw.source : "raffle";
  return {
    ...emptyRow,
    ...raw,
    id: safeText(raw.id || orderId),
    source,
    pedido: safeText(raw.pedido || orderId),
    purchaseId: safeText(raw.purchaseId || orderId),
    orderId,
    cliente: safeText(raw.cliente, "Cliente"),
    telefone: safeText(raw.telefone),
    cpf: safeText(raw.cpf),
    email: safeText(raw.email),
    campanha: safeText(raw.campanha, "Campanha"),
    campaignId: safeText(raw.campaignId),
    quantidadeCotas: Number(raw.quantidadeCotas || 0),
    valor: Number(raw.valor || 0),
    gateway: safeText(raw.gateway, "manual"),
    statusPedido: safeText(raw.statusPedido, "pending"),
    statusPagamento: safeText(raw.statusPagamento, "pending"),
    dataCompra: safeText(raw.dataCompra),
    dataPagamento: safeText(raw.dataPagamento),
    paymentId: safeText(raw.paymentId),
    externalReference: safeText(raw.externalReference),
    pixTransactionId: safeText(raw.pixTransactionId),
    tickets: asArray(raw.tickets).map(item => safeText(item)).filter(Boolean),
    numbersPreview: safeText(raw.numbersPreview)
  };
}

function normalizeDetail(value: any): OrderCenterDetail {
  const raw = value && typeof value === "object" ? value : {};
  const row = normalizeRow(raw.row);
  const cliente = raw.cliente && typeof raw.cliente === "object" ? raw.cliente : {};
  const compra = raw.compra && typeof raw.compra === "object" ? raw.compra : {};
  const pagamento = raw.pagamento && typeof raw.pagamento === "object" ? raw.pagamento : {};
  const webhook = raw.webhook && typeof raw.webhook === "object" ? raw.webhook : {};
  return {
    row,
    cliente: {
      nome: safeText(cliente.nome || row.cliente, "Cliente"),
      telefone: safeText(cliente.telefone || row.telefone),
      cpf: safeText(cliente.cpf || row.cpf),
      email: safeText(cliente.email || row.email)
    },
    compra: {
      pedido: safeText(compra.pedido || row.orderId),
      purchaseId: safeText(compra.purchaseId || row.purchaseId),
      campanha: safeText(compra.campanha || row.campanha, "Campanha"),
      campanhaId: safeText(compra.campanhaId || row.campaignId),
      quantidadeCotas: Number(compra.quantidadeCotas || row.quantidadeCotas || 0),
      valor: Number(compra.valor || row.valor || 0),
      dataCompra: safeText(compra.dataCompra || row.dataCompra),
      status: safeText(compra.status || row.statusPedido, "pending"),
      source: safeText(compra.source || row.source)
    },
    pagamento: {
      gateway: safeText(pagamento.gateway || row.gateway, "manual"),
      paymentId: safeText(pagamento.paymentId || row.paymentId),
      externalReference: safeText(pagamento.externalReference || row.externalReference),
      pixTransaction: safeText(pagamento.pixTransaction || row.pixTransactionId),
      statusGateway: safeText(pagamento.statusGateway || row.statusPagamento, "pending"),
      dataPagamento: safeText(pagamento.dataPagamento || row.dataPagamento),
      valorPago: Number(pagamento.valorPago || row.valor || 0),
      cobrancaUrl: safeText(pagamento.cobrancaUrl),
      comprovanteUrl: safeText(pagamento.comprovanteUrl)
    },
    webhook: {
      eventId: safeText(webhook.eventId),
      ultimoEvento: safeText(webhook.ultimoEvento),
      status: safeText(webhook.status),
      data: safeText(webhook.data),
      jobId: safeText(webhook.jobId),
      historico: asArray(webhook.historico)
    },
    cotas: asArray(raw.cotas).map(item => safeText(item)).filter(Boolean),
    historicoCotas: asArray(raw.historicoCotas),
    premiosInstantaneos: asArray(raw.premiosInstantaneos),
    premioPrincipal: raw.premioPrincipal && typeof raw.premioPrincipal === "object" ? raw.premioPrincipal : null,
    timeline: asArray(raw.timeline),
    ajustes: asArray(raw.ajustes),
    auditoria: asArray(raw.auditoria)
  };
}

function money(value: unknown) {
  const parsed = Number(value || 0);
  return (Number.isFinite(parsed) ? parsed : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateTime(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-BR");
}

function statusLabel(value: unknown) {
  const raw = String(value || "pendente");
  const normalized = raw.toLowerCase();
  if (["paid", "confirmed", "received", "recebido", "confirmado"].some(item => normalized.includes(item))) return "Pago";
  if (["cancelled", "canceled", "rejected", "failed"].some(item => normalized.includes(item))) return "Cancelado";
  if (["reserved", "pending"].some(item => normalized.includes(item))) return "Pendente";
  return raw;
}

function StatusPill({ value }: { value: unknown }) {
  const label = statusLabel(value);
  const tone = label === "Pago" ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10" : label === "Cancelado" ? "text-red-300 border-red-400/30 bg-red-400/10" : "text-amber-200 border-amber-300/30 bg-amber-300/10";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${tone}`}>{label}</span>;
}

function copyText(label: string, text: string) {
  if (!text) return toast.error(`${label} vazio`);
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copiado`)).catch(() => toast.error("Nao foi possivel copiar"));
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

class OrderCenterResponseError extends Error {
  status: number;
  invalidResponse: boolean;

  constructor(message: string, status: number, invalidResponse = false) {
    super(message);
    this.name = "OrderCenterResponseError";
    this.status = status;
    this.invalidResponse = invalidResponse;
  }
}

async function readAdminJson<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  if (response.status === 401) {
    throw new OrderCenterResponseError("Sessao expirada. Faça login novamente para acessar a Central de Pedidos.", response.status);
  }
  if (response.status === 403) {
    throw new OrderCenterResponseError("Seu usuario nao tem permissao para acessar a Central de Pedidos.", response.status);
  }
  if (!isJson) {
    const preview = await response.text().catch(() => "");
    console.warn("[ORDER_CENTER_INVALID_RESPONSE]", {
      status: response.status,
      contentType,
      preview: preview.slice(0, 160)
    });
    throw new OrderCenterResponseError("Resposta invalida do servidor", response.status, true);
  }
  const payload = await response.json();
  if (!response.ok) {
    throw new OrderCenterResponseError(payload?.error || "Falha ao carregar dados da Central de Pedidos", response.status);
  }
  return payload as T;
}

function InfoLine({ label, value, copyable }: { label: string; value: unknown; copyable?: boolean }) {
  const text = value === undefined || value === null || value === "" ? "-" : String(value);
  return (
    <div className="min-w-0 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--admin-muted)]">{label}</p>
      <div className="mt-1 flex min-w-0 items-center gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-[var(--admin-text)]" title={text}>{text}</p>
        {copyable && text !== "-" && (
          <button type="button" className="admin-icon-button h-7 w-7" onClick={() => copyText(label, text)} aria-label={`Copiar ${label}`}>
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function TruncateText({ value, className = "" }: { value: unknown; className?: string }) {
  const text = value === undefined || value === null || value === "" ? "-" : String(value);
  return <span className={`block min-w-0 truncate ${className}`} title={text}>{text}</span>;
}

export function AdminOrderCenter() {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<OrderCenterRow[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadMessage, setLoadMessage] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<OrderCenterDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [ticketView, setTicketView] = useState<"grid" | "list">("grid");
  const [busy, setBusy] = useState("");
  const [swapForm, setSwapForm] = useState({ newNumbers: "", reason: "", confirmation: "" });

  async function loadOrders(search = query) {
    setLoading(true);
    setLoadMessage("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      const queryString = params.toString();
      const response = await authFetch(queryString ? `/api/admin/order-center?${queryString}` : "/api/admin/order-center", {
        headers: { Accept: "application/json" }
      });
      const payload = await readAdminJson(response);
      setOrders(asArray(payload.orders).map(normalizeRow).filter(order => order.orderId));
      setMetrics(payload.metrics || {});
    } catch (error) {
      console.warn("[ORDER_CENTER_REFRESH_ERROR]", error);
      const responseError = error instanceof OrderCenterResponseError ? error : null;
      if (responseError?.invalidResponse) {
        setOrders([]);
        setMetrics({ total: 0, filtered: 0, paid: 0, pending: 0, amount: 0 });
        setLoadMessage("Nenhum pedido encontrado.");
        return;
      }
      const message = error instanceof Error ? error.message : "Erro ao carregar Central";
      setLoadMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(orderId: string) {
    setSelectedId(orderId);
    setDetailLoading(true);
    try {
      const response = await authFetch(`/api/admin/order-center/${encodeURIComponent(orderId)}`);
      const payload = await readAdminJson(response);
      const normalized = normalizeDetail(payload);
      setDetail(normalized);
      setSwapForm({ newNumbers: normalized.cotas.join("\n"), reason: "", confirmation: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao abrir pedido");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const logRenderIssue = (event: ErrorEvent | PromiseRejectionEvent) => {
      console.warn("[ORDER_CENTER_RENDER_ERROR]", "reason" in event ? event.reason : event.error);
    };
    window.addEventListener("error", logRenderIssue);
    window.addEventListener("unhandledrejection", logRenderIssue);
    return () => {
      window.removeEventListener("error", logRenderIssue);
      window.removeEventListener("unhandledrejection", logRenderIssue);
    };
  }, []);

  const visibleOrders = useMemo(() => orders.slice(0, 500), [orders]);
  const selectedOrder = useMemo(() => orders.find(order => order.orderId === selectedId), [orders, selectedId]);

  async function runAction(action: "reprocess" | "reconcile" | "swap") {
    if (!detail) return;
    setBusy(action);
    try {
      let response: Response;
      if (action === "reconcile") {
        response = await authFetch("/api/admin/payments/asaas/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: detail.row.orderId, paymentId: detail.row.paymentId })
        });
      } else if (action === "reprocess") {
        response = await authFetch(`/api/admin/order-center/${encodeURIComponent(detail.row.orderId)}/reprocess-webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Reprocessamento manual pela Central de Pedidos" })
        });
      } else {
        response = await authFetch(`/api/admin/order-center/${encodeURIComponent(detail.row.orderId)}/tickets/swap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(swapForm)
        });
      }
      await readAdminJson(response);
      toast.success(action === "swap" ? "Cotas alteradas com auditoria" : "Acao operacional concluida");
      await loadOrders();
      await loadDetail(detail.row.orderId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro operacional");
    } finally {
      setBusy("");
    }
  }

  function exportAudit() {
    if (!detail) return;
    downloadText(`auditoria-${detail.row.orderId}.json`, JSON.stringify(detail, null, 2));
  }

  return (
    <div className="min-w-0 space-y-5">
      <section className="admin-card min-w-0 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--admin-muted)]">Operação</p>
            <h1 className="mt-1 truncate text-2xl font-black text-[var(--admin-text)]">Central de Pedidos</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">Localize cliente, pagamento, cotas, webhook e auditoria em uma tela.</p>
          </div>
          <button type="button" className="admin-button-secondary h-11 shrink-0 justify-center" onClick={() => void loadOrders()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </button>
        </div>
        <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoLine label="Pedidos" value={metrics.total || 0} />
          <InfoLine label="Filtrados" value={metrics.filtered || 0} />
          <InfoLine label="Pagos" value={metrics.paid || 0} />
          <InfoLine label="Volume" value={money(metrics.amount || 0)} />
        </div>
        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
          <input
            className="admin-input h-12 w-full pl-11"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Buscar por pedido, cliente, CPF, telefone, e-mail, Payment ID, PIX, cota ou numero vencedor"
          />
        </div>
        {loadMessage && !loading && (
          <p className="mt-3 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-muted)]">{loadMessage}</p>
        )}
      </section>

      <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">
        <section className="admin-card min-w-0 overflow-hidden p-0">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[120px]" />
                <col className="w-[150px]" />
                <col className="w-[130px]" />
                <col className="w-[120px]" />
                <col className="w-[180px]" />
                <col className="w-[80px]" />
                <col className="w-[105px]" />
                <col className="w-[115px]" />
                <col className="w-[135px]" />
                <col className="w-[120px]" />
              </colgroup>
              <thead className="border-b border-[var(--admin-border)] text-xs uppercase tracking-[0.12em] text-[var(--admin-muted)]">
                <tr>
                  {["Pedido", "Cliente", "Telefone", "CPF", "Campanha", "Cotas", "Valor", "Status", "Data", ""].map((header, index) => (
                    <th key={`${header || "actions"}-${index}`} className="px-4 py-3 font-bold">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-[var(--admin-muted)]">Carregando pedidos...</td></tr>
                ) : visibleOrders.length ? visibleOrders.map(order => (
                  <tr key={`${order.source}-${order.orderId}`} className={selectedId === order.orderId ? "bg-[var(--admin-primary)]/10" : "hover:bg-[var(--admin-surface)]"}>
                    <td className="px-4 py-3 font-mono font-bold text-[var(--admin-text)]"><TruncateText value={order.orderId} /></td>
                    <td className="px-4 py-3 font-semibold text-[var(--admin-text)]"><TruncateText value={order.cliente} /></td>
                    <td className="px-4 py-3 font-mono text-[var(--admin-muted)]"><TruncateText value={order.telefone || "-"} /></td>
                    <td className="px-4 py-3 font-mono text-[var(--admin-muted)]"><TruncateText value={order.cpf || "-"} /></td>
                    <td className="px-4 py-3 text-[var(--admin-muted)]"><TruncateText value={order.campanha} /></td>
                    <td className="px-4 py-3 font-bold text-[var(--admin-text)]">{order.quantidadeCotas}</td>
                    <td className="px-4 py-3 font-bold text-[var(--admin-text)]"><TruncateText value={money(order.valor)} /></td>
                    <td className="px-4 py-3"><StatusPill value={order.statusPagamento || order.statusPedido} /></td>
                    <td className="px-4 py-3 text-[var(--admin-muted)]"><TruncateText value={dateTime(order.dataCompra)} /></td>
                    <td className="px-4 py-3">
                      <button type="button" className="admin-button-secondary h-9 justify-center px-3 py-2 text-xs" onClick={() => void loadDetail(order.orderId)}>
                        <FileSearch className="h-4 w-4" />
                        Detalhes
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-[var(--admin-muted)]">Nenhum pedido encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-3 lg:hidden">
            {loading ? (
              <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-center text-sm text-[var(--admin-muted)]">Carregando pedidos...</div>
            ) : visibleOrders.length ? visibleOrders.map(order => (
              <button key={`${order.source}-${order.orderId}-mobile`} type="button" onClick={() => void loadDetail(order.orderId)} className="min-w-0 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left transition hover:border-[var(--admin-primary)]/40">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-black text-[var(--admin-text)]" title={order.orderId}>{order.orderId}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[var(--admin-text)]" title={order.cliente}>{order.cliente}</p>
                    <p className="mt-1 truncate text-xs text-[var(--admin-muted)]" title={order.campanha}>{order.campanha}</p>
                  </div>
                  <StatusPill value={order.statusPagamento || order.statusPedido} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--admin-muted)]">
                  <span className="truncate" title={order.telefone}>Tel: {order.telefone || "-"}</span>
                  <span className="truncate" title={order.cpf}>CPF: {order.cpf || "-"}</span>
                  <span>Cotas: <strong className="text-[var(--admin-text)]">{order.quantidadeCotas}</strong></span>
                  <span className="font-bold text-[var(--admin-text)]">{money(order.valor)}</span>
                </div>
              </button>
            )) : (
              <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-center text-sm text-[var(--admin-muted)]">Nenhum pedido encontrado.</div>
            )}
          </div>
        </section>

        <aside className="admin-card min-w-0 overflow-hidden p-0 2xl:min-h-[720px]">
          {!selectedId ? (
            <div className="grid h-full min-h-[420px] place-items-center p-8 text-center">
              <div>
                <ShieldCheck className="mx-auto h-10 w-10 text-[var(--admin-primary)]" />
                <h2 className="mt-3 text-lg font-black text-[var(--admin-text)]">Selecione um pedido</h2>
                <p className="mt-2 text-sm text-[var(--admin-muted)]">Os detalhes operacionais aparecem aqui.</p>
              </div>
            </div>
          ) : detailLoading || !detail ? (
            <div className="grid h-full min-h-[420px] place-items-center text-[var(--admin-muted)]"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <div className="min-w-0 space-y-5 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--admin-muted)]">Pedido</p>
                  <h2 className="truncate text-xl font-black text-[var(--admin-text)] sm:text-2xl" title={detail.row.orderId}>{detail.row.orderId}</h2>
                  <p className="truncate text-sm text-[var(--admin-muted)]" title={selectedOrder?.campanha || detail.row.campanha}>{selectedOrder?.campanha || detail.row.campanha}</p>
                </div>
                <button type="button" className="admin-icon-button" onClick={() => { setSelectedId(""); setDetail(null); }} aria-label="Fechar detalhe"><X className="h-4 w-4" /></button>
              </div>

              <Section title="Cliente" icon={<Users className="h-4 w-4" />}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <InfoLine label="Nome" value={detail.cliente.nome} copyable />
                  <InfoLine label="Telefone" value={detail.cliente.telefone} copyable />
                  <InfoLine label="CPF" value={detail.cliente.cpf} copyable />
                  <InfoLine label="E-mail" value={detail.cliente.email} copyable />
                </div>
              </Section>

              <Section title="Compra" icon={<Ticket className="h-4 w-4" />}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <InfoLine label="PurchaseId" value={detail.compra.purchaseId} copyable />
                  <InfoLine label="Campanha" value={detail.compra.campanha} />
                  <InfoLine label="Qtd. cotas" value={detail.compra.quantidadeCotas} />
                  <InfoLine label="Valor" value={money(detail.compra.valor)} />
                  <InfoLine label="Data compra" value={dateTime(detail.compra.dataCompra)} />
                  <InfoLine label="Status" value={statusLabel(detail.compra.status)} />
                </div>
              </Section>

              <Section title="Pagamento" icon={<Wallet className="h-4 w-4" />}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <InfoLine label="Gateway" value={detail.pagamento.gateway} />
                  <InfoLine label="Payment ID" value={detail.pagamento.paymentId} copyable />
                  <InfoLine label="External Reference" value={detail.pagamento.externalReference} copyable />
                  <InfoLine label="PIX Transaction" value={detail.pagamento.pixTransaction} copyable />
                  <InfoLine label="Status gateway" value={statusLabel(detail.pagamento.statusGateway)} />
                  <InfoLine label="Data pagamento" value={dateTime(detail.pagamento.dataPagamento)} />
                  <InfoLine label="Valor pago" value={money(detail.pagamento.valorPago)} />
                  <InfoLine label="URL cobranca" value={detail.pagamento.cobrancaUrl} copyable />
                </div>
              </Section>

              <Section title="Webhook" icon={<RefreshCw className="h-4 w-4" />}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <InfoLine label="Event ID" value={detail.webhook.eventId} copyable />
                  <InfoLine label="Ultimo evento" value={detail.webhook.ultimoEvento} />
                  <InfoLine label="Status" value={detail.webhook.status} />
                  <InfoLine label="Data/hora" value={dateTime(detail.webhook.data)} />
                </div>
              </Section>

              <Section title="Cotas compradas" icon={<Grid3X3 className="h-4 w-4" />}>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={ticketView === "grid" ? "admin-button-primary h-9 py-2 text-xs" : "admin-button-secondary h-9 py-2 text-xs"} onClick={() => setTicketView("grid")}><Grid3X3 className="h-4 w-4" /> Grade</button>
                  <button type="button" className={ticketView === "list" ? "admin-button-primary h-9 py-2 text-xs" : "admin-button-secondary h-9 py-2 text-xs"} onClick={() => setTicketView("list")}><List className="h-4 w-4" /> Lista</button>
                  <button type="button" className="admin-button-secondary h-9 py-2 text-xs" onClick={() => copyText("Cotas", asArray(detail.cotas).join("\n"))}><Copy className="h-4 w-4" /> Copiar</button>
                  <button type="button" className="admin-button-secondary h-9 py-2 text-xs" onClick={() => downloadText(`cotas-${detail.row.orderId}.csv`, asArray(detail.cotas).join("\n"))}><Download className="h-4 w-4" /> Exportar</button>
                </div>
                <div className={ticketView === "grid" ? "mt-3 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5" : "mt-3 max-h-64 min-w-0 overflow-y-auto rounded-[8px] border border-[var(--admin-border)] p-3"}>
                  {asArray<string>(detail.cotas).length ? asArray<string>(detail.cotas).map(ticket => (
                    <span key={ticket} className="min-w-0 truncate rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-2 text-center font-mono text-xs font-bold text-[var(--admin-text)]" title={ticket}>{ticket}</span>
                  )) : <p className="col-span-full text-sm text-[var(--admin-muted)]">Nenhuma cota vinculada a este pedido.</p>}
                </div>
              </Section>

              <Section title="Alterar cotas" icon={<Shuffle className="h-4 w-4" />}>
                <div className="rounded-[8px] border border-amber-300/25 bg-amber-300/10 p-3 text-xs text-amber-100">
                  <AlertTriangle className="mr-2 inline h-4 w-4" /> A troca exige cotas livres e bloqueia cotas premiadas, reservadas, vendidas ou sorteadas. O historico nunca e apagado.
                </div>
                <textarea className="admin-input mt-3 min-h-24 w-full resize-y font-mono text-xs" value={swapForm.newNumbers} onChange={event => setSwapForm({ ...swapForm, newNumbers: event.target.value })} placeholder="Uma cota por linha" />
                <input className="admin-input mt-2 h-11 w-full" value={swapForm.reason} onChange={event => setSwapForm({ ...swapForm, reason: event.target.value })} placeholder="Motivo obrigatorio da troca" />
                <input className="admin-input mt-2 h-11 w-full" value={swapForm.confirmation} onChange={event => setSwapForm({ ...swapForm, confirmation: event.target.value })} placeholder="Digite CONFIRMAR TROCA" />
                <button type="button" className="admin-button-primary mt-3 w-full justify-center" disabled={busy === "swap"} onClick={() => void runAction("swap")}>
                  {busy === "swap" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                  Executar troca auditada
                </button>
              </Section>

              <Section title="Prêmios" icon={<CheckCircle2 className="h-4 w-4" />}>
                <CompactList empty="Nenhum prêmio instantâneo vinculado." items={asArray<Record<string, any>>(detail.premiosInstantaneos).map(item => `${item.tipo || "Premio"}: ${item.numero || "-"} - ${item.premio || "-"}`)} />
                <div className="mt-2">
                  <InfoLine label="Prêmio principal" value={detail.premioPrincipal ? `${detail.premioPrincipal.numeroVencedor} - ${detail.premioPrincipal.nomeGanhador}` : "Sem premio principal vinculado"} />
                </div>
              </Section>

              <Section title="Timeline operacional" icon={<Clock className="h-4 w-4" />}>
                <div className="space-y-2">
                  {asArray<Record<string, any>>(detail.timeline).length ? asArray<Record<string, any>>(detail.timeline).map((item, index) => (
                    <div key={`${item.type}-${index}`} className="flex gap-3 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--admin-primary)]" />
                      <div>
                        <p className="text-sm font-bold text-[var(--admin-text)]">{item.label}</p>
                        <p className="text-xs text-[var(--admin-muted)]">{dateTime(item.date)} · {item.status}</p>
                      </div>
                    </div>
                  )) : <p className="text-sm text-[var(--admin-muted)]">Nenhum evento operacional registrado.</p>}
                </div>
              </Section>

              <Section title="Ações administrativas" icon={<ShieldCheck className="h-4 w-4" />}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" className="admin-button-secondary h-10 justify-center" disabled={busy === "reconcile"} onClick={() => void runAction("reconcile")}><RefreshCw className="h-4 w-4" /> Reconciliar</button>
                  <button type="button" className="admin-button-secondary h-10 justify-center" disabled={busy === "reprocess"} onClick={() => void runAction("reprocess")}><RefreshCw className="h-4 w-4" /> Reprocessar</button>
                  <button type="button" className="admin-button-secondary h-10 justify-center" onClick={() => copyText("Pedido", detail.row.orderId)}><Copy className="h-4 w-4" /> Copiar pedido</button>
                  <button type="button" className="admin-button-secondary h-10 justify-center" onClick={exportAudit}><Download className="h-4 w-4" /> Exportar</button>
                  <a className="admin-button-secondary h-10 justify-center sm:col-span-2" href={`/checkout/pedido/${encodeURIComponent(detail.row.orderId)}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Abrir página pública</a>
                </div>
              </Section>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4">
      <div className="mb-3 flex min-w-0 items-center gap-2 text-sm font-black text-[var(--admin-text)]">
        <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-[var(--admin-primary)]/15 text-[var(--admin-primary)]">{icon}</span>
        <span className="min-w-0 truncate" title={title}>{title}</span>
      </div>
      {children}
    </section>
  );
}

function CompactList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-[var(--admin-muted)]">{empty}</p>;
  return (
    <div className="space-y-2">
      {items.map(item => <p key={item} className="truncate rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 text-sm text-[var(--admin-text)]" title={item}>{item}</p>)}
    </div>
  );
}
