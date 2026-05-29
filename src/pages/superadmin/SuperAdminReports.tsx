import { useEffect, useState } from "react";
import { Download, FileText, ShieldCheck } from "lucide-react";
import { AdminDataTable, MetricCard } from "../../components/admin/AdminPremium";

const reportTypes = [
  ["financial_global", "Financeiro global"],
  ["financial_tenant", "Financeiro por tenant"],
  ["draw_report", "Relatorio de sorteio"],
  ["draw_certificate", "Certificado do sorteio"],
  ["sold_tickets", "Cotas vendidas"],
  ["ticket_adjustments", "Alteracoes de cotas"],
  ["audit_ledger", "Auditoria"],
  ["lgpd", "LGPD"],
  ["affiliates", "Afiliados"],
  ["whatsapp", "WhatsApp/envios"]
];

export function SuperAdminReports() {
  const [exportsList, setExportsList] = useState<any[]>([]);
  const [reportType, setReportType] = useState("financial_global");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [tenantId, setTenantId] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = () => fetch("/api/superadmin/reports").then(res => res.json()).then(setExportsList).catch(() => setExportsList([]));
  useEffect(() => { void load(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/superadmin/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType, format, tenantId: tenantId || undefined, filters: { period: "last30", tenant_id: tenantId || undefined } })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao gerar relatorio");
      setExportsList(current => [data, ...current]);
      await downloadOfficial(data.id);
    } finally {
      setGenerating(false);
    }
  };

  const downloadOfficial = async (id: string) => {
    const res = await fetch(`/api/superadmin/reports/${id}/download`);
    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") || "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `relatorio-${id}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="admin-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-[var(--admin-primary)]">Exportacoes oficiais</p>
            <h2 className="mt-1 text-2xl font-black text-[var(--admin-text)]">Relatorios auditaveis da plataforma</h2>
            <p className="mt-2 text-sm text-[var(--admin-muted)]">PDF/CSV com hash, request_id, assinatura digital e validacao publica por QR Code.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={reportType} onChange={event => setReportType(event.target.value)} className="admin-input h-11 min-w-56 rounded-2xl px-4">
              {reportTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <input value={tenantId} onChange={event => setTenantId(event.target.value)} className="admin-input h-11 min-w-56 rounded-2xl px-4" placeholder="tenant_id opcional" />
            <select value={format} onChange={event => setFormat(event.target.value as "pdf" | "csv")} className="admin-input h-11 rounded-2xl px-4">
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
            </select>
            <button onClick={() => void generate()} disabled={generating} className="admin-button-primary">
              <FileText className="h-4 w-4" /> {generating ? "Gerando..." : "Gerar oficial"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={ShieldCheck} label="Relatorios gerados" value={exportsList.length} trend="com hash auditavel" />
        <MetricCard icon={FileText} label="PDFs" value={exportsList.filter(item => item.format === "pdf").length} trend="certificados formais" tone="success" />
        <MetricCard icon={Download} label="Downloads" value="Autorizado" trend="URLs privadas protegidas" tone="accent" />
      </div>

      <AdminDataTable
        columns={["Tipo", "Tenant", "Formato", "Hash", "Request ID", "Gerado por", "Download"]}
        rows={exportsList.map(item => [
          item.report_type,
          item.tenant_id || "global",
          String(item.format).toUpperCase(),
          <span className="font-mono text-xs">{String(item.file_hash).slice(0, 22)}...</span>,
          <span className="font-mono text-xs">{item.request_id}</span>,
          item.generated_by || "-",
          <button onClick={() => void downloadOfficial(item.id)} className="admin-button-secondary py-2 text-xs"><Download className="h-4 w-4" /> Baixar</button>
        ])}
        empty="Nenhum relatorio oficial gerado."
      />
    </div>
  );
}
