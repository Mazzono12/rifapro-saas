import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BadgeDollarSign, Download, FileBarChart, FileText, Filter, Link2, ListChecks, ShieldCheck, Ticket, Users } from "lucide-react";
import { AdminBadge, AdminButton, AdminCard, AdminEmptyState, AdminInput, AdminPage, AdminPageHeader, AdminProgress, AdminSection, AdminSelect, AdminTable } from "../../components/ui/admin/AdminDesignSystem";

type ReportType = "global" | "raffle" | "fazendinha" | "milhar" | "centena" | "dezena";
type ReportRow = { id: string; tipo: ReportType | "rifa"; origem: string; codigoSorteio: string; nomeCompleto: string; telefone: string; cidade: string; dataCompra: string; quantidadeCotas: number; status: string; valor: number };
const reportOptions: Array<{ id: ReportType; label: string; description: string }> = [
  { id: "global", label: "Global", description: "Todas as vendas do ambiente" },
  { id: "raffle", label: "Acao especifica", description: "Vendas de uma campanha selecionada" },
  { id: "fazendinha", label: "Fazendinha", description: "Grupos vendidos na Fazendinha" },
  { id: "milhar", label: "Milhar", description: "Relatorio da modalidade Milhar" },
  { id: "centena", label: "Centena", description: "Relatorio da modalidade Centena" },
  { id: "dezena", label: "Dezena", description: "Relatorio da modalidade Dezena" }
];

export function AdminReports() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [raffles, setRaffles] = useState<any[]>([]);
  const [fazendinha, setFazendinha] = useState<any>({});
  const [modalidades, setModalidades] = useState<any>({});
  const [period, setPeriod] = useState("30d");
  const [reportType, setReportType] = useState<ReportType>("global");
  const [selectedRaffleId, setSelectedRaffleId] = useState("");
  const [officialExports, setOfficialExports] = useState<any[]>([]);
  const [exportingOfficial, setExportingOfficial] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/admin/purchases").then(res => res.json()).then(setPurchases).catch(() => setPurchases([]));
    fetch("/api/admin/raffles").then(res => res.json()).then(data => { setRaffles(Array.isArray(data) ? data : []); setSelectedRaffleId(current => current || data?.[0]?.id || ""); }).catch(() => setRaffles([]));
    fetch("/api/admin/fazendinha").then(res => res.json()).then(setFazendinha).catch(() => setFazendinha({}));
    fetch("/api/admin/modalidades").then(res => res.json()).then(setModalidades).catch(() => setModalidades({}));
    fetch("/api/admin/reports").then(res => res.json()).then(data => setOfficialExports(Array.isArray(data) ? data : [])).catch(() => setOfficialExports([]));
  }, []);
  const raffleNameById = useMemo(() => {
    const map = new Map<string, string>();
    raffles.forEach(raffle => map.set(String(raffle.id), raffle.title || `Sorteio ${raffle.id}`));
    return map;
  }, [raffles]);

  const reportRows = useMemo(() => {
    const raffleRows: ReportRow[] = purchases.map(item => ({
      id: item.purchaseId || `${item.raffleId}-${item.createdAt}`,
      tipo: "rifa",
      origem: raffleNameById.get(String(item.raffleId)) || `Sorteio ${item.raffleId || "-"}`,
      codigoSorteio: String(item.raffleId || "-"),
      nomeCompleto: item.customer?.name || item.contact || "",
      telefone: item.customer?.phone || item.contact || "",
      cidade: item.customer?.city || "",
      dataCompra: item.createdAt || "",
      quantidadeCotas: Number(item.tickets || 0),
      status: item.status || "pending",
      valor: Number(item.amount || 0)
    }));
    const fazendinhaRows: ReportRow[] = (fazendinha?.purchases || []).map((item: any) => ({ id: item.id || `${item.grupoId}-${item.dataCompra}`, tipo: "fazendinha", origem: fazendinha?.config?.name || "Fazendinha", codigoSorteio: "fazendinha", nomeCompleto: item.customer?.name || "", telefone: item.customer?.phone || "", cidade: item.customer?.city || "", dataCompra: item.dataCompra || "", quantidadeCotas: Array.isArray(item.numeros) ? item.numeros.length : Number(item.quantidadeCotas || 0), status: item.statusPagamento || "reserved", valor: Number(item.valorPago || 0) }));
    const modalidadeRows: ReportRow[] = (modalidades?.purchases || []).map((item: any) => ({ id: item.id || `${item.mode}-${item.createdAt}`, tipo: item.mode, origem: modalidadeLabel(item.mode), codigoSorteio: item.mode || "-", nomeCompleto: item.customer?.name || "", telefone: item.customer?.phone || "", cidade: item.customer?.city || "", dataCompra: item.createdAt || "", quantidadeCotas: Array.isArray(item.numbers) ? item.numbers.length : 0, status: item.status || "reserved", valor: Number(item.amount || 0) }));
    return [...raffleRows, ...fazendinhaRows, ...modalidadeRows].sort((a, b) => dateValue(b.dataCompra) - dateValue(a.dataCompra));
  }, [fazendinha, modalidades, purchases, raffleNameById]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const byType = reportRows.filter(item => {
      if (reportType === "global") return true;
      if (reportType === "raffle") return item.tipo === "rifa" && (!selectedRaffleId || item.codigoSorteio === selectedRaffleId);
      return item.tipo === reportType;
    });
    return byType.filter(item => isInsidePeriod(item.dataCompra, period)).filter(item => !normalizedQuery || [item.origem, item.nomeCompleto, item.telefone, item.codigoSorteio].some(value => String(value || "").toLowerCase().includes(normalizedQuery)));
  }, [period, query, reportRows, reportType, selectedRaffleId]);

  const paidRows = filteredRows.filter(item => ["paid", "pago"].includes(String(item.status).toLowerCase()));
  const reportTitle = reportType === "raffle" ? raffleNameById.get(selectedRaffleId) || "Rifa especifica" : reportOptions.find(option => option.id === reportType)?.label || "Global";
  const summary = useMemo(() => {
    const uniqueBuyers = new Set(filteredRows.map(item => `${item.telefone}-${item.nomeCompleto}`).filter(Boolean));
    return { revenue: paidRows.reduce((sum, item) => sum + item.valor, 0), tickets: paidRows.reduce((sum, item) => sum + item.quantidadeCotas, 0), buyers: uniqueBuyers.size, records: filteredRows.length };
  }, [filteredRows, paidRows]);

  const chartRows = useMemo(() => {
    const map = new Map<string, { name: string; receita: number; vendas: number }>();
    paidRows.forEach(item => { const key = reportType === "global" ? item.origem : item.codigoSorteio; const current = map.get(key) || { name: item.origem || key, receita: 0, vendas: 0 }; current.receita += item.valor; current.vendas += 1; map.set(key, current); });
    return [...map.values()].sort((a, b) => b.receita - a.receita).slice(0, 8);
  }, [paidRows, reportType]);

  const optionCounts = useMemo(() => reportOptions.reduce<Record<ReportType, number>>((acc, option) => { acc[option.id] = reportRows.filter(item => option.id === "global" ? true : option.id === "raffle" ? item.tipo === "rifa" : item.tipo === option.id).length; return acc; }, {} as Record<ReportType, number>), [reportRows]);
  function exportCSV() {
    const headers = ["Tipo", "Origem", "Nome completo", "Telefone", "Cidade", "Data da compra", "Codigo do sorteio", "Quantidade de cotas", "Status", "Valor"];
    const rows = filteredRows.map(item => [item.tipo, item.origem, item.nomeCompleto, item.telefone, item.cidade, item.dataCompra, item.codigoSorteio, item.quantidadeCotas, statusLabel(item.status), item.valor.toFixed(2)]);
    download(`relatorio-${reportFileName(reportType)}.csv`, [headers, ...rows].map(row => row.map(csvEscape).join(",")).join("\n"), "text/csv");
  }
  function exportJSON() { download(`relatorio-${reportFileName(reportType)}.json`, JSON.stringify({ reportType, reportTitle, period, summary, rows: filteredRows }, null, 2), "application/json"); }
  async function exportOfficial(format: "pdf" | "csv") {
    setExportingOfficial(format);
    try {
      const res = await fetch("/api/admin/reports/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportType: reportType === "global" ? "financial_tenant" : reportType === "raffle" ? "sold_tickets" : reportType, format, filters: { period, raffleId: reportType === "raffle" ? selectedRaffleId : undefined } }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao gerar relatorio oficial");
      setOfficialExports(current => [data, ...current]);
      await downloadOfficial(data.id);
    } finally { setExportingOfficial(""); }
  }
  async function downloadOfficial(id: string) {
    const res = await fetch(`/api/admin/reports/${id}/download`);
    const blob = await res.blob();
    const filename = (res.headers.get("content-disposition") || "").match(/filename="([^"]+)"/)?.[1] || `relatorio-${id}.pdf`;
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <AdminPage className="rp-reports-page">
      <AdminPageHeader title="Relatorios completos" description="Visao global, campanhas, Fazendinha, Milhar, Centena e Dezena." actions={<><AdminButton onClick={() => void exportOfficial("pdf")} disabled={Boolean(exportingOfficial)}><FileText className="h-4 w-4" />{exportingOfficial === "pdf" ? "Gerando..." : "PDF oficial"}</AdminButton><AdminButton variant="secondary" onClick={() => void exportOfficial("csv")} disabled={Boolean(exportingOfficial)}><ShieldCheck className="h-4 w-4" />CSV verificado</AdminButton></>} />
      <AdminSection><div className="rp-reports-filters"><AdminSelect value={reportType} onChange={event => setReportType(event.target.value as ReportType)}>{reportOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</AdminSelect>{reportType === "raffle" && <AdminSelect value={selectedRaffleId} onChange={event => setSelectedRaffleId(event.target.value)}>{raffles.map(raffle => <option key={raffle.id} value={raffle.id}>{raffle.title || `Sorteio ${raffle.id}`}</option>)}</AdminSelect>}<AdminSelect value={period} onChange={event => setPeriod(event.target.value)}><option value="24h">24h</option><option value="7d">7 dias</option><option value="30d">30 dias</option><option value="all">Todo periodo</option></AdminSelect><AdminInput value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar cliente, telefone, campanha..." /><AdminButton variant="secondary" onClick={exportCSV}><Download className="h-4 w-4" />CSV</AdminButton><AdminButton variant="secondary" onClick={exportJSON}>JSON</AdminButton></div></AdminSection>
      <section className="rp-reports-options">{reportOptions.map(option => <button type="button" key={option.id} onClick={() => setReportType(option.id)} className={reportType === option.id ? "is-active" : ""}><span><strong>{option.label}</strong><b>{optionCounts[option.id] || 0}</b></span><small>{option.description}</small></button>)}</section>
      <section className="rp-dashboard-kpis"><ReportMetric icon={<BadgeDollarSign className="h-4 w-4" />} label="Faturamento" value={`R$ ${summary.revenue.toFixed(2)}`} detail={`Relatorio ${reportTitle}`} /><ReportMetric icon={<Ticket className="h-4 w-4" />} label="Numeros confirmados" value={summary.tickets.toLocaleString("pt-BR")} detail="Somente vendas confirmadas" /><ReportMetric icon={<Users className="h-4 w-4" />} label="Compradores" value={summary.buyers.toLocaleString("pt-BR")} detail="Clientes unicos no filtro" /><ReportMetric icon={<ListChecks className="h-4 w-4" />} label="Registros" value={summary.records.toLocaleString("pt-BR")} detail={`Periodo ${periodLabel(period)}`} /></section>
      <section className="rp-reports-grid"><AdminSection title={`Faturamento - ${reportTitle}`}>{chartRows.length ? <div className="rp-reports-bars">{chartRows.map(row => <div key={row.name}><span>{row.name}</span><AdminProgress value={(row.receita / Math.max(1, chartRows[0].receita)) * 100} /><strong>R$ {row.receita.toFixed(2)}</strong></div>)}</div> : <AdminEmptyState title="Sem faturamento no filtro" description="Os dados aparecem quando houver vendas pagas no periodo." />}</AdminSection><AdminSection title="Registros por status"><div className="rp-reports-status-list">{statusSummary(filteredRows).map(item => <div key={item.status}><span>{item.status}</span><AdminBadge tone={item.status === "Pago" ? "success" : item.status === "Cancelado" ? "danger" : "slate"}>{item.count}</AdminBadge></div>)}</div></AdminSection></section>
      <AdminSection title="Relatorio selecionado" description="Exportacao completa com nome, telefone, cidade, data, codigo da campanha e quantidade de numeros." actions={<span className="rp-dashboard-filter"><Filter className="h-4 w-4" /> {reportTitle} - {periodLabel(period)}</span>}>
        <AdminTable columns={["Tipo", "Origem", "Cliente", "Telefone", "Cidade", "Data", "Codigo", "Numeros", "Status", "Valor"]} rows={filteredRows.slice(0, 80).map(item => [modalidadeLabel(item.tipo), item.origem, item.nomeCompleto || "-", item.telefone || "-", item.cidade || "-", item.dataCompra ? new Date(item.dataCompra).toLocaleString("pt-BR") : "-", item.codigoSorteio, item.quantidadeCotas, statusLabel(item.status), `R$ ${item.valor.toFixed(2)}`])} empty="Nenhum registro encontrado para este relatorio." />
      </AdminSection>
      <AdminSection title="Exportacoes oficiais" description="PDF/CSV com verificacao protegida e validacao publica por QR Code." actions={<Download className="h-5 w-5 text-[var(--rp-primary)]" />}>
        <AdminTable columns={["Tipo", "Formato", "Validacao", "Gerado em", "Download"]} rows={officialExports.slice(0, 8).map(item => [item.report_type, String(item.format).toUpperCase(), <AdminBadge tone="success">Registro validado</AdminBadge>, item.created_at ? new Date(item.created_at).toLocaleString("pt-BR") : "-", <AdminButton variant="secondary" onClick={() => void downloadOfficial(item.id)}><Download className="h-4 w-4" />Baixar</AdminButton>])} empty="Nenhuma exportacao oficial gerada ainda." />
      </AdminSection>
    </AdminPage>
  );
}

function ReportMetric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: ReactNode; detail: string }) { return <AdminCard className="rp-dashboard-kpi"><span className="rp-dashboard-kpi-icon tone-blue">{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></AdminCard>; }
function statusSummary(rows: ReportRow[]) { const map = new Map<string, number>(); rows.forEach(row => map.set(statusLabel(row.status), (map.get(statusLabel(row.status)) || 0) + 1)); return [...map.entries()].map(([status, count]) => ({ status, count })); }
function csvEscape(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function download(name: string, content: string, type: string) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
function dateValue(value: string) { const date = new Date(value).getTime(); return Number.isFinite(date) ? date : 0; }
function isInsidePeriod(value: string, period: string) { if (period === "all") return true; const date = dateValue(value); if (!date) return true; const days = period === "24h" ? 1 : period === "7d" ? 7 : 30; return date >= Date.now() - days * 24 * 60 * 60 * 1000; }
function modalidadeLabel(value: string) { const labels: Record<string, string> = { global: "Global", raffle: "Acao especifica", rifa: "Rifa", fazendinha: "Fazendinha", milhar: "Milhar", centena: "Centena", dezena: "Dezena" }; return labels[value] || value || "-"; }
function statusLabel(value: string) { const labels: Record<string, string> = { paid: "Pago", pago: "Pago", pending: "Pendente", reserved: "Reservado", cancelled: "Cancelado", rejected: "Rejeitado" }; return labels[String(value || "").toLowerCase()] || value || "-"; }
function periodLabel(value: string) { const labels: Record<string, string> = { "24h": "ultimas 24h", "7d": "ultimos 7 dias", "30d": "ultimos 30 dias", all: "todo periodo" }; return labels[value] || value; }
function reportFileName(value: ReportType) { return value === "raffle" ? "rifa-especifica" : value; }
