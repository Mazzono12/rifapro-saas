import { Download, Plus, Search, Users, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminBadge, AdminButton, AdminInput, AdminMetricCard, AdminPage, AdminPageHeader, AdminPagination, AdminSection, AdminSelect, AdminTable, AdminTabs } from "../../components/ui/admin/AdminDesignSystem";
import { dateLabel, money, useAdminConsolidatedData } from "./adminDataConsolidation";

const tabs = ["Lista", "Carteira", "Comissoes", "Saques", "Repasses", "Ranking", "Evolucao"];
const emptyAffiliate = { name: "", phone: "", cpf: "", city: "", state: "", refCode: "", pixKey: "", accessPassword: "123456" };

type Withdrawal = { id: string; refCode?: string; affiliateName?: string; customerName?: string; amount: number; status: string; requestedAt: string; paidAt?: string };

export function AdminAfiliados() {
  const { loading, affiliates, reload } = useAdminConsolidatedData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("Lista");
  const [creating, setCreating] = useState(false);
  const [manualAffiliate, setManualAffiliate] = useState(emptyAffiliate);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [selectedRef, setSelectedRef] = useState("");
  const [walletForm, setWalletForm] = useState({ amount: "", note: "" });

  const loadWithdrawals = async () => {
    try { const response = await fetch("/api/admin/affiliates/withdrawals"); setWithdrawals(response.ok ? await response.json() : []); } catch { setWithdrawals([]); }
  };
  useEffect(() => { void loadWithdrawals(); }, []);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return affiliates.filter(a => {
      const active = a.soldAmount > 0;
      return (!search || `${a.name} ${a.refCode} ${a.link}`.toLowerCase().includes(search)) && (statusFilter === "all" || (statusFilter === "active" ? active : !active));
    });
  }, [affiliates, query, statusFilter]);
  const selected = filtered.find(item => item.refCode === selectedRef) || filtered[0] || affiliates[0];
  const totals = useMemo(() => ({ affiliates: affiliates.length, active: affiliates.filter(a => a.soldAmount > 0).length, generated: affiliates.reduce((sum, a) => sum + a.commissionGenerated, 0), paid: affiliates.reduce((sum, a) => sum + a.commissionPaid, 0), pending: affiliates.reduce((sum, a) => sum + a.commissionPending, 0) }), [affiliates]);

  const rows = filtered.slice(0, 50).map(a => ["#" + (a.affiliateId || a.refCode || a.key).slice(0, 8), <button type="button" className="text-left" onClick={() => setSelectedRef(a.refCode)}><strong>{a.name}</strong><small className="block text-[var(--rp-muted)]">{a.refCode || "Sem codigo"}</small></button>, <AdminBadge tone="info">Direto</AdminBadge>, a.referredCustomers, money(a.soldAmount), money(a.commissionGenerated), money(a.commissionPending), <AdminBadge tone={a.soldAmount > 0 ? "success" : "slate"}>{a.soldAmount > 0 ? "Ativo" : "Sem vendas"}</AdminBadge>, dateLabel(a.lastSaleAt), <button type="button" className="rp-admin-icon-button" onClick={() => setSelectedRef(a.refCode)}>...</button>]);
  const withdrawalRows = withdrawals.slice(0, 20).map(item => [item.id, item.refCode || "-", money(item.amount), item.status, dateLabel(item.requestedAt), item.status === "pending" ? <div className="flex gap-2"><button type="button" className="rp-admin-icon-button" onClick={() => void updateWithdrawal(item.id, "paid")}>Pagar</button><button type="button" className="rp-admin-icon-button" onClick={() => void updateWithdrawal(item.id, "rejected")}>Recusar</button></div> : dateLabel(item.paidAt)]);

  const createManualAffiliate = async () => {
    const response = await fetch("/api/admin/affiliates/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(manualAffiliate) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(data.error || "Erro ao cadastrar afiliado"); return; }
    toast.success("Afiliado cadastrado");
    setManualAffiliate(emptyAffiliate);
    setCreating(false);
    await reload();
  };

  const adjustWallet = async (action: "credit_commission" | "debit_commission") => {
    if (!selected?.refCode) return;
    const amount = Number(walletForm.amount || 0);
    if (!amount || !walletForm.note.trim()) { toast.error("Informe valor e motivo do ajuste"); return; }
    const response = await fetch(`/api/admin/affiliates/${selected.refCode}/wallet`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, amount, note: walletForm.note }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(data.error || "Erro ao atualizar carteira"); return; }
    toast.success("Carteira atualizada");
    setWalletForm({ amount: "", note: "" });
    await reload();
  };

  const updateWithdrawal = async (id: string, status: "paid" | "rejected") => {
    if (!window.confirm(status === "paid" ? "Marcar saque como pago?" : "Recusar saque?")) return;
    const response = await fetch(`/api/admin/affiliates/withdrawals/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, note: status === "paid" ? "Transferencia manual confirmada pelo admin" : "Saque recusado pelo admin" }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(data.error || "Erro ao atualizar saque"); return; }
    toast.success(status === "paid" ? "Saque marcado como pago" : "Saque recusado");
    await loadWithdrawals();
    await reload();
  };

  const exportAffiliates = () => downloadCsv("afiliados.csv", ["Nome", "Codigo", "Clientes indicados", "Pedidos indicados", "Vendido", "Comissao gerada", "Pendente", "Ultima venda"], filtered.map(a => [a.name, a.refCode, a.referredCustomers, a.referredOrders, a.soldAmount, a.commissionGenerated, a.commissionPending, a.lastSaleAt]));

  return <AdminPage><AdminPageHeader title="Afiliados" description="Gerencie afiliados, comissoes e repasses diretos" actions={<><AdminButton variant="secondary" onClick={exportAffiliates}><Download className="h-4 w-4" />Exportar</AdminButton><AdminButton onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Novo afiliado</AdminButton></>} />
    <AdminTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
    {creating && <AdminSection title="Novo afiliado" actions={<AdminButton variant="secondary" onClick={() => setCreating(false)}>Cancelar</AdminButton>}><div className="grid gap-3 md:grid-cols-3"><AdminInput value={manualAffiliate.name} onChange={event => setManualAffiliate(current => ({ ...current, name: event.target.value }))} placeholder="Nome" /><AdminInput value={manualAffiliate.phone} onChange={event => setManualAffiliate(current => ({ ...current, phone: event.target.value }))} placeholder="Telefone" /><AdminInput value={manualAffiliate.cpf} onChange={event => setManualAffiliate(current => ({ ...current, cpf: event.target.value }))} placeholder="CPF" /><AdminInput value={manualAffiliate.city} onChange={event => setManualAffiliate(current => ({ ...current, city: event.target.value }))} placeholder="Cidade" /><AdminInput value={manualAffiliate.state} onChange={event => setManualAffiliate(current => ({ ...current, state: event.target.value }))} placeholder="Estado" /><AdminInput value={manualAffiliate.refCode} onChange={event => setManualAffiliate(current => ({ ...current, refCode: event.target.value }))} placeholder="Código opcional" /><AdminInput value={manualAffiliate.pixKey} onChange={event => setManualAffiliate(current => ({ ...current, pixKey: event.target.value }))} placeholder="Chave PIX" /><AdminInput value={manualAffiliate.accessPassword} onChange={event => setManualAffiliate(current => ({ ...current, accessPassword: event.target.value }))} placeholder="Senha de acesso" /></div><AdminButton className="mt-4" onClick={() => void createManualAffiliate()}>Cadastrar afiliado</AdminButton></AdminSection>}
    <AdminSection>
      <div className="rp-admin-filters"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--rp-muted)]" /><AdminInput className="pl-10" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar afiliado por nome, código ou link..." /></div><AdminSelect value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">Todos os status</option><option value="active">Ativos</option><option value="inactive">Sem vendas</option></AdminSelect><AdminButton variant="secondary" disabled>Filtros avancados pendentes</AdminButton></div>
      <div className="rp-admin-metrics"><AdminMetricCard icon={Users} label="Total de afiliados" value={totals.affiliates} detail="Base consolidada por tenant e codigo" tone="purple" /><AdminMetricCard icon={Users} label="Afiliados ativos" value={totals.active} detail="Com vendas diretas" tone="green" /><AdminMetricCard icon={Wallet} label="Comissoes geradas" value={money(totals.generated)} tone="purple" /><AdminMetricCard icon={Wallet} label="Comissoes pagas" value={money(totals.paid)} tone="green" /><AdminMetricCard icon={Wallet} label="Pendente de repasse" value={money(totals.pending)} tone="orange" /></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div><AdminTable columns={["ID", "Afiliado", "Tipo", "Clientes", "Vendas", "Comissoes", "Pendente", "Status", "Ultima venda", "Acoes"]} rows={rows} empty={loading ? "Carregando afiliados..." : "Nenhum afiliado encontrado."} /><AdminPagination /></div><div className="grid gap-4"><AdminSection title="Carteira selecionada"><Line label="Afiliado" value={selected?.name || "Sem afiliado"} /><Line label="Código" value={selected?.refCode || "-"} /><Line label="Saldo pendente" value={money(selected?.commissionPending || 0)} /><Line label="Total recebido" value={money(selected?.commissionPaid || 0)} /><AdminInput className="mt-3" type="number" value={walletForm.amount} onChange={event => setWalletForm(current => ({ ...current, amount: event.target.value }))} placeholder="Valor do ajuste" /><AdminInput value={walletForm.note} onChange={event => setWalletForm(current => ({ ...current, note: event.target.value }))} placeholder="Motivo obrigatório" /><div className="mt-3 flex gap-2"><AdminButton className="flex-1" onClick={() => void adjustWallet("credit_commission")}>Creditar</AdminButton><AdminButton className="flex-1" variant="secondary" onClick={() => void adjustWallet("debit_commission")}>Debitar</AdminButton></div></AdminSection></div></div>
    </AdminSection>
    <AdminSection title="Saques e repasses"><AdminTable columns={["ID", "Afiliado", "Valor", "Status", "Solicitado", "Acoes"]} rows={withdrawalRows} empty="Nenhuma solicitacao de saque encontrada." /></AdminSection>
  </AdminPage>;
}
function Line({ label, value }: { label: string; value: string | number }) { return <div className="flex justify-between gap-4 py-2 text-sm"><span className="text-[var(--rp-muted)]">{label}</span><strong className="break-words text-right">{value}</strong></div>; }
function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) { const escape = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`; const csv = [headers.map(escape).join(","), ...rows.map(row => row.map(escape).join(","))].join("\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
