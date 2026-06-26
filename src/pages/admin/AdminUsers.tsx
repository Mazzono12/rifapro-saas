import { Download, Plus, Search, ShieldCheck, UserRound, Users } from "lucide-react";
import { AdminBadge, AdminButton, AdminInput, AdminMetricCard, AdminPage, AdminPageHeader, AdminPagination, AdminSection, AdminSelect, AdminTable } from "../../components/ui/admin/AdminDesignSystem";
import { dateLabel, money, useAdminConsolidatedData } from "./adminDataConsolidation";

export function AdminUsers() {
  const { loading, customers } = useAdminConsolidatedData();
  const rows = customers.slice(0, 12).map(customer => [
    <div className="flex items-center gap-3"><span className="rp-admin-avatar">{customer.name.slice(0, 2).toUpperCase()}</span><div><strong>{customer.name}</strong><small className="block text-[var(--rp-muted)]">{customer.email || customer.phone || "Sem contato"}</small></div></div>,
    customer.phone || "-",
    customer.totalOrders,
    money(customer.totalSpent),
    dateLabel(customer.lastPurchaseAt),
    <AdminBadge tone={customer.status === "ativo" ? "success" : "warning"}>{customer.status}</AdminBadge>,
    <button className="rp-admin-icon-button">...</button>
  ]);
  return <AdminPage>
    <AdminPageHeader title="Usuarios" description="Gerencie usuarios, clientes e acessos administrativos" actions={<><AdminButton variant="secondary"><Download className="h-4 w-4" />Exportar</AdminButton><AdminButton><Plus className="h-4 w-4" />Novo usuario</AdminButton></>} />
    <div className="rp-admin-metrics"><AdminMetricCard icon={Users} label="Usuarios e clientes" value={customers.length} tone="purple" /><AdminMetricCard icon={UserRound} label="Clientes ativos" value={customers.filter(c => c.status === "ativo").length} tone="green" /><AdminMetricCard icon={ShieldCheck} label="Acessos administrativos" value="Protegido" tone="blue" /></div>
    <AdminSection>
      <div className="rp-admin-filters"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--rp-muted)]" /><AdminInput className="pl-10" placeholder="Buscar usuario, e-mail ou telefone..." /></div><AdminSelect><option>Todos os status</option></AdminSelect><AdminSelect><option>Todos os perfis</option></AdminSelect><AdminButton variant="secondary">Filtros</AdminButton></div>
      <AdminTable columns={["Usuario", "Telefone", "Pedidos", "Total gasto", "Ultima compra", "Status", "Acoes"]} rows={rows} empty={loading ? "Carregando usuarios..." : "Nenhum usuario encontrado."} /><AdminPagination />
    </AdminSection>
  </AdminPage>;
}
