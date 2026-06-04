import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingSkeleton } from "../../components/admin/AdminPremium";

export function SuperAdminAudit() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/superadmin/audit-logs")
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Falha ao carregar auditoria");
        setLogs(data);
      })
      .catch(error => toast.error("Falha na auditoria", { description: error instanceof Error ? error.message : "Tente novamente." }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AdminLoadingSkeleton />;

  return (
    <AdminDataTable
      columns={["Data", "Ação", "Cliente", "Recurso", "IP", "Verificação"]}
      rows={logs.map(log => [
        new Date(log.created_at).toLocaleString("pt-BR"),
        log.action,
        log.tenant || log.client || "Global",
        log.resource_type || "-",
        log.ip_address,
        <span key={log.id} className="text-xs text-[var(--admin-muted)]">Protegida</span>
      ])}
      empty="Nenhum registro de auditoria."
    />
  );
}
