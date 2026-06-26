import { Download, ExternalLink, MoreVertical, RefreshCw, Search, ShoppingCart, Users, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminBadge, AdminButton, AdminFilters, AdminIconButton, AdminInput, AdminMetricCard, AdminPage, AdminPageHeader, AdminPagination, AdminSection, AdminSelect, AdminTable } from "../../components/ui/admin/AdminDesignSystem";
import { dateLabel, isPaidStatus, isPendingStatus, money, useAdminConsolidatedData, type AdminPurchase } from "./adminDataConsolidation";

export function AdminPedidos() {
  const { loading, purchases, sales, reload } = useAdminConsolidatedData();
  const [query, setQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [minValue, setMinValue] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<AdminPurchase | null>(null);

  const campaigns = useMemo(() => Array.from(new Set(purchases.map(order => order.campaignName).filter(Boolean))).sort(), [purchases]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const min = Number(minValue || 0);
    return purchases.filter(order => {
      const text = `${order.orderId} ${order.customer.name} ${order.customer.phone} ${order.customer.cpf} ${order.campaignName}`.toLowerCase();
      const statusKind = isPaidStatus(order.status) ? "paid" : isPendingStatus(order.status) ? "pending" : "other";
      const paymentKind = String(order.status || "").toLowerCase().includes("pix") || statusKind !== "other" ? "pix" : "other";
      return (!search || text.includes(search))
        && (campaignFilter === "all" || order.campaignName === campaignFilter)
        && (statusFilter === "all" || statusKind === statusFilter)
        && (paymentFilter === "all" || paymentKind === paymentFilter)
        && (!minValue || order.amount >= min);
    });
  }, [purchases, query, campaignFilter, statusFilter, paymentFilter, minValue]);

  const rows = filtered.slice(0, 50).map(order => [
    <button type="button" className="font-mono text-[#2563eb]" onClick={() => setSelectedOrder(order)}>#{order.orderId}</button>,
    dateLabel(order.createdAt),
    order.customer.name,
    order.campaignName,
    "1 item",
    money(order.amount),
    String(order.status).toUpperCase().includes("PIX") ? "PIX" : "-",
    <AdminBadge tone={isPaidStatus(order.status) ? "success" : isPendingStatus(order.status) ? "warning" : "danger"}>{isPaidStatus(order.status) ? "Aprovado" : isPendingStatus(order.status) ? "Aguardando" : order.status}</AdminBadge>,
    order.affiliate.refCode ? "Afiliado" : "Site",
    <div className="flex gap-1"><AdminIconButton aria-label="Detalhes do pedido" onClick={() => setSelectedOrder(order)}><MoreVertical className="h-4 w-4" /></AdminIconButton><AdminIconButton aria-label="Abrir pedido" onClick={() => openOrder(order)}><ExternalLink className="h-4 w-4" /></AdminIconButton></div>
  ]);

  const handleReload = async () => { await reload(); toast.success("Pedidos atualizados"); };
  const exportOrders = () => downloadCsv("pedidos.csv", ["Pedido", "Data", "Cliente", "Telefone", "Campanha", "Valor", "Status", "Afiliado"], filtered.map(order => [order.orderId, order.createdAt, order.customer.name, order.customer.phone, order.campaignName, order.amount, order.status, order.affiliate.refCode]));

  return <AdminPage><AdminPageHeader title="Pedidos" description="Gerencie e acompanhe todos os pedidos da plataforma" actions={<><AdminButton variant="secondary" onClick={exportOrders}><Download className="h-4 w-4" />Exportar</AdminButton><AdminButton variant="secondary" disabled>Colunas pendente</AdminButton><AdminButton onClick={() => void handleReload()}><RefreshCw className="h-4 w-4" />Atualizar</AdminButton></>} />
    <AdminSection>
      <AdminFilters><div className="relative min-w-[240px] flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--rp-muted)]" /><AdminInput className="pl-10" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar pedido, cliente, CPF ou telefone" /></div><AdminSelect value={campaignFilter} onChange={event => setCampaignFilter(event.target.value)}><option value="all">Todas as campanhas</option>{campaigns.map(campaign => <option key={campaign} value={campaign}>{campaign}</option>)}</AdminSelect><AdminSelect value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">Todos os status</option><option value="paid">Pagos</option><option value="pending">Pendentes</option><option value="other">Outros</option></AdminSelect><AdminSelect value={paymentFilter} onChange={event => setPaymentFilter(event.target.value)}><option value="all">Todos os pagamentos</option><option value="pix">PIX</option><option value="other">Outros</option></AdminSelect><AdminInput value={minValue} onChange={event => setMinValue(event.target.value)} placeholder="Valor minimo" type="number" /></AdminFilters>
      <AdminTable columns={["ID do Pedido", "Data", "Cliente", "Campanha", "Itens", "Valor", "Pagamento", "Status", "Origem", "Acoes"]} rows={rows} empty={loading ? "Carregando pedidos..." : "Nenhum pedido encontrado."} />
      <AdminPagination />
    </AdminSection>
    {selectedOrder && <AdminSection title={`Pedido #${selectedOrder.orderId}`} actions={<AdminButton variant="secondary" onClick={() => setSelectedOrder(null)}>Fechar</AdminButton>}><div className="grid gap-3 text-sm md:grid-cols-4"><Line label="Cliente" value={selectedOrder.customer.name} /><Line label="Telefone" value={selectedOrder.customer.phone || "-"} /><Line label="Valor" value={money(selectedOrder.amount)} /><Line label="Status" value={selectedOrder.status} /><Line label="Campanha" value={selectedOrder.campaignName} /><Line label="Criado em" value={dateLabel(selectedOrder.createdAt)} /><Line label="Pago em" value={dateLabel(selectedOrder.paidAt)} /><Line label="Afiliado" value={selectedOrder.affiliate.refCode || "-"} /></div><div className="mt-4 flex flex-wrap gap-2"><AdminButton onClick={() => openOrder(selectedOrder)}><ExternalLink className="h-4 w-4" />Abrir pedido</AdminButton><AdminButton variant="secondary" onClick={() => window.location.href = `/admin/pix-recuperacao?pedido=${encodeURIComponent(selectedOrder.orderId)}`}>Recuperacao PIX</AdminButton></div></AdminSection>}
    <AdminSection title="Resumo do periodo"><div className="grid gap-3 text-sm md:grid-cols-5"><Line label="Total de pedidos" value={filtered.length} /><Line label="Valor bruto" value={money(sales.grossSales)} /><Line label="Taxas e tarifas" value={money(sales.platformFee)} /><Line label="Valor liquido" value={money(sales.netSales)} /><Line label="Ticket medio" value={money(sales.averageTicket)} /></div></AdminSection>
    <AdminSection title="Status dos pedidos"><div className="grid gap-3 text-sm md:grid-cols-3"><Line label="Aprovados" value={sales.paidOrders} /><Line label="Pendentes" value={sales.pendingOrders} /><Line label="Total" value={purchases.length} /></div></AdminSection>
    <div className="rp-admin-grid-4"><AdminMetricCard icon={Wallet} label="Receita por dia" value={money(sales.grossSales / 30)} tone="green" /><AdminMetricCard icon={Users} label="Conversao" value={sales.conversionRate.toFixed(2) + "%"} tone="purple" /><AdminMetricCard icon={ShoppingCart} label="Pedidos por dia" value={Math.round(purchases.length / 30)} tone="blue" /><AdminMetricCard icon={RefreshCw} label="Cancelamentos" value={purchases.filter(p => /cancel/i.test(p.status)).length} tone="red" /></div>
  </AdminPage>;
}
function openOrder(order: AdminPurchase) { window.open(`/checkout/pedido/${encodeURIComponent(order.orderId)}`, "_blank", "noopener,noreferrer"); }
function Line({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg border border-[var(--rp-border)] bg-white p-3"><span className="block text-[var(--rp-muted)]">{label}</span><strong className="mt-1 block break-words">{value}</strong></div>; }
function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) { const escape = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`; const csv = [headers.map(escape).join(","), ...rows.map(row => row.map(escape).join(","))].join("\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
