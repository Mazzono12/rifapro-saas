import { Activity, Download, Filter, RefreshCw, Save, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminBadge, AdminButton, AdminCard, AdminFilters, AdminInput, AdminPage, AdminPageHeader, AdminPagination, AdminSection, AdminSelect, AdminTable } from "../../components/ui/admin/AdminDesignSystem";
import { dateLabel, isPaidStatus, isPendingStatus, money, useAdminConsolidatedData } from "./adminDataConsolidation";

type AsaasDraft = { apiKey: string; environment: string; webhookUrl: string; webhookSecret: string; releaseMode: string; paymentMode: string; orderExpirationMinutes: string; enabled: boolean };
const defaultAsaas: AsaasDraft = { apiKey: "", environment: "production", webhookUrl: "/api/webhooks/asaas", webhookSecret: "", releaseMode: "PAYMENT_RECEIVED", paymentMode: "pix_direct", orderExpirationMinutes: "15", enabled: false };

export function AdminPagamentos() {
  const { loading, purchases, sales, reload } = useAdminConsolidatedData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [gatewayLoading, setGatewayLoading] = useState(true);
  const [asaas, setAsaas] = useState<AsaasDraft>(defaultAsaas);
  const [gatewayStatus, setGatewayStatus] = useState("Nao testado");
  const [queueDashboard, setQueueDashboard] = useState<any>(null);

  const loadGateways = async () => {
    setGatewayLoading(true);
    try {
      const response = await fetch("/api/admin/gateways", { headers: { Accept: "application/json" } });
      const data = response.ok ? await response.json() : {};
      const configs = Array.isArray(data.configs) ? data.configs : Array.isArray(data.paymentGatewayConfigs) ? data.paymentGatewayConfigs : [];
      const asaasConfig = configs.find((config: any) => String(config.provider || "").toLowerCase() === "asaas") || data.asaas || {};
      setAsaas({
        apiKey: asaasConfig.credentials?.apiKey || asaasConfig.apiKey || "",
        environment: asaasConfig.environment || "production",
        webhookUrl: asaasConfig.webhookUrl || "/api/webhooks/asaas",
        webhookSecret: asaasConfig.webhook_secret || asaasConfig.webhookSecret || "",
        releaseMode: asaasConfig.config_json?.releaseMode || asaasConfig.credentials?.releaseMode || asaasConfig.releaseMode || "PAYMENT_RECEIVED",
        paymentMode: asaasConfig.config_json?.paymentMode || asaasConfig.credentials?.paymentMode || asaasConfig.paymentMode || "pix_direct",
        orderExpirationMinutes: String(asaasConfig.config_json?.orderExpirationMinutes || asaasConfig.credentials?.orderExpirationMinutes || asaasConfig.orderExpirationMinutes || "15"),
        enabled: Boolean(asaasConfig.enabled || data.active === "asaas" || data.defaultProvider === "asaas")
      });
    } finally {
      setGatewayLoading(false);
    }
  };

  const loadQueues = async () => {
    try { const response = await fetch("/api/admin/payments/queues"); if (response.ok) setQueueDashboard(await response.json()); } catch { setQueueDashboard(null); }
  };

  useEffect(() => { void loadGateways(); void loadQueues(); }, []);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return purchases.filter(order => {
      const statusKind = isPaidStatus(order.status) ? "paid" : isPendingStatus(order.status) ? "pending" : "other";
      const text = `${order.orderId} ${order.customer.name} ${order.campaignName} ${order.status}`.toLowerCase();
      return (!search || text.includes(search)) && (statusFilter === "all" || statusFilter === statusKind);
    });
  }, [purchases, query, statusFilter]);

  const rows = filtered.slice(0, 50).map(order => ["#" + order.orderId, dateLabel(order.createdAt), order.customer.name, "#" + order.orderId, "Asaas", "PIX", money(order.amount), <AdminBadge tone={isPaidStatus(order.status) ? "success" : isPendingStatus(order.status) ? "warning" : "danger"}>{isPaidStatus(order.status) ? "Aprovado" : isPendingStatus(order.status) ? "Pendente" : order.status}</AdminBadge>, <button type="button" className="rp-admin-icon-button" onClick={() => window.open(`/checkout/pedido/${encodeURIComponent(order.orderId)}`, "_blank", "noopener,noreferrer")}>...</button>]);

  const saveAsaas = async () => {
    if (!asaas.apiKey.trim()) { toast.error("Informe a chave privada Asaas antes de salvar"); return; }
    setSaving(true);
    const config = { provider: "asaas", display_name: "Asaas", enabled: true, environment: "production", credentials: { apiKey: asaas.apiKey, paymentMode: asaas.paymentMode, orderExpirationMinutes: asaas.orderExpirationMinutes, releaseMode: asaas.releaseMode }, webhook_secret: asaas.webhookSecret, pix_key: "", is_default: true, config_json: { releaseMode: asaas.releaseMode, paymentMode: asaas.paymentMode, orderExpirationMinutes: Number(asaas.orderExpirationMinutes || 15) } };
    try {
      const response = await fetch("/api/admin/gateways", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: "asaas", defaultProvider: "asaas", pix: { enabled: true, sandbox: false, webhookUrl: "/api/webhooks/asaas" }, asaas: { ...asaas, enabled: true, environment: "production", webhookUrl: "/api/webhooks/asaas" }, configs: [config], paymentGatewayConfigs: [config] }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || "Erro ao salvar Asaas");
      toast.success("Configuração Asaas salva");
      await loadGateways();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar Asaas"); }
    finally { setSaving(false); }
  };

  const testAsaas = async () => {
    setTesting(true);
    try {
      const response = await fetch("/api/admin/gateways/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gateway: "asaas", active: "asaas", pix: { enabled: true, sandbox: false, webhookUrl: "/api/webhooks/asaas" }, config: asaas }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Erro ao testar Asaas");
      setGatewayStatus(data.ok ? "Operacional" : data.issues?.[0] || "Requer atenção");
      data.ok ? toast.success("Asaas validado") : toast.warning("Asaas requer atenção");
    } catch (error) { setGatewayStatus("Erro no teste"); toast.error(error instanceof Error ? error.message : "Erro ao testar Asaas"); }
    finally { setTesting(false); }
  };

  const processQueues = async () => {
    const response = await fetch("/api/admin/payments/queues/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 25 }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(data.error || "Erro ao processar filas"); return; }
    toast.success("Filas de pagamento processadas");
    setQueueDashboard(data.queues || data);
  };

  const exportPayments = () => downloadCsv("pagamentos.csv", ["Pedido", "Data", "Cliente", "Gateway", "Tipo", "Valor", "Status"], filtered.map(order => [order.orderId, order.createdAt, order.customer.name, "Asaas", "PIX", order.amount, order.status]));

  return <AdminPage><AdminPageHeader title="Pagamentos" description="Centro financeiro - gerencie Asaas, transacoes e monitoramento" actions={<><AdminButton variant="secondary" onClick={() => { void reload(); void loadQueues(); }}><RefreshCw className="h-4 w-4" />Atualizar</AdminButton><AdminButton onClick={saveAsaas} disabled={saving || gatewayLoading}><Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar Asaas"}</AdminButton></>} />
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <AdminSection title="Configuração Asaas" actions={<AdminButton variant="secondary" onClick={testAsaas} disabled={testing || gatewayLoading}><ShieldCheck className="h-4 w-4" />{testing ? "Testando..." : "Testar"}</AdminButton>}>
        <div className="grid gap-3"><Line label="Status" value={gatewayLoading ? "Carregando..." : asaas.enabled ? "Configurado" : "Nao configurado"} /><Line label="Ambiente" value="Produção" /><Line label="Webhook" value="/api/webhooks/asaas" /><Line label="Teste" value={gatewayStatus} /></div>
        <div className="mt-4 grid gap-3"><label className="grid gap-2 text-sm font-bold">Chave privada Asaas<AdminInput type="password" value={asaas.apiKey} onChange={event => setAsaas(current => ({ ...current, apiKey: event.target.value }))} placeholder="Cole a chave privada Asaas" /></label><label className="grid gap-2 text-sm font-bold">Webhook secret<AdminInput value={asaas.webhookSecret} onChange={event => setAsaas(current => ({ ...current, webhookSecret: event.target.value }))} placeholder="Opcional" /></label><label className="grid gap-2 text-sm font-bold">Expiração do pedido (min)<AdminInput type="number" value={asaas.orderExpirationMinutes} onChange={event => setAsaas(current => ({ ...current, orderExpirationMinutes: event.target.value }))} /></label><label className="grid gap-2 text-sm font-bold">Liberar pedido quando<AdminSelect value={asaas.releaseMode} onChange={event => setAsaas(current => ({ ...current, releaseMode: event.target.value }))}><option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option><option value="PAYMENT_CONFIRMED">PAYMENT_CONFIRMED</option></AdminSelect></label></div>
      </AdminSection>
      <AdminSection title="Transacoes" actions={<><AdminInput value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar transacao..." /><AdminButton variant="secondary" onClick={exportPayments}><Download className="h-4 w-4" /></AdminButton></>}>
        <AdminFilters><AdminSelect value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">Todos os status</option><option value="paid">Pagos</option><option value="pending">Pendentes</option><option value="other">Outros</option></AdminSelect><AdminButton variant="secondary" disabled><Filter className="h-4 w-4" />Filtros avançados pendentes</AdminButton></AdminFilters>
        <AdminTable columns={["ID", "Data", "Cliente", "Pedido", "Gateway", "Tipo", "Valor", "Status", "Acoes"]} rows={rows} empty={loading ? "Carregando transacoes..." : "Nenhuma transacao encontrada."} /><AdminPagination />
      </AdminSection>
    </div>
    <div className="mt-5 grid gap-5 md:grid-cols-3"><AdminCard><Wallet className="h-5 w-5 text-[#2563eb]" /><Line label="Receita bruta paga" value={money(sales.grossSales)} /><Line label="Taxa da plataforma" value={money(sales.platformFee)} /><Line label="Receita liquida" value={money(sales.netSales)} /></AdminCard><AdminCard><Activity className="h-5 w-5 text-[#2563eb]" /><Line label="Fila pendente" value={queueDashboard?.pending ?? queueDashboard?.summary?.pending ?? "Sem dados"} /><Line label="Falhas" value={queueDashboard?.failed ?? queueDashboard?.summary?.failed ?? "Sem dados"} /><AdminButton className="mt-3 w-full" variant="secondary" onClick={() => void processQueues()}>Processar filas</AdminButton></AdminCard><AdminCard><Line label="Pedidos pagos" value={sales.paidOrders} /><Line label="Pedidos pendentes" value={sales.pendingOrders} /><Line label="Ticket medio" value={money(sales.averageTicket)} /></AdminCard></div>
  </AdminPage>;
}
function Line({ label, value }: { label: string; value: string | number }) { return <div className="flex justify-between gap-4 py-2 text-sm"><span className="text-[var(--rp-muted)]">{label}</span><strong className="break-words text-right">{value}</strong></div>; }
function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) { const escape = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`; const csv = [headers.map(escape).join(","), ...rows.map(row => row.map(escape).join(","))].join("\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
