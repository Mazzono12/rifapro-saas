import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeDollarSign, Download, FileBarChart, FileText, Filter, Gift, ListChecks, ShieldCheck, Ticket, Users } from "lucide-react";
import { AdminDataTable, AdminExportButtons, ChartCard, MetricCard } from "../../components/admin/AdminPremium";

type ReportType = "global" | "raffle" | "fazendinha" | "milhar" | "centena" | "dezena";

type ReportRow = {
  id: string;
  tipo: ReportType | "rifa";
  origem: string;
  codigoSorteio: string;
  nomeCompleto: string;
  telefone: string;
  cidade: string;
  dataCompra: string;
  quantidadeCotas: number;
  status: string;
  valor: number;
};

const reportOptions: Array<{ id: ReportType; label: string; description: string }> = [
  { id: "global", label: "Global", description: "Todas as vendas da plataforma" },
  { id: "raffle", label: "Rifa especifica", description: "Compras de um sorteio selecionado" },
  { id: "fazendinha", label: "Fazendinha", description: "Grupos vendidos na Fazendinha" },
  { id: "milhar", label: "Milhar", description: "Relatorio da modalidade Milhar" },
  { id: "centena", label: "Centena", description: "Relatorio da modalidade Centena" },
  { id: "dezena", label: "Dezena", description: "Relatorio da modalidade Dezena" }
];

export function AdminReports() {
  const [stats, setStats] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [raffles, setRaffles] = useState<any[]>([]);
  const [fazendinha, setFazendinha] = useState<any>({});
  const [modalidades, setModalidades] = useState<any>({});
  const [period, setPeriod] = useState("30d");
  const [reportType, setReportType] = useState<ReportType>("global");
  const [selectedRaffleId, setSelectedRaffleId] = useState("");
  const [officialExports, setOfficialExports] = useState<any[]>([]);
  const [exportingOfficial, setExportingOfficial] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats").then(res => res.json()).then(setStats).catch(() => setStats({}));
    fetch("/api/admin/purchases").then(res => res.json()).then(setPurchases).catch(() => setPurchases([]));
    fetch("/api/admin/raffles").then(res => res.json()).then(data => {
      setRaffles(data);
      setSelectedRaffleId((current) => current || data?.[0]?.id || "");
    }).catch(() => setRaffles([]));
    fetch("/api/admin/fazendinha").then(res => res.json()).then(setFazendinha).catch(() => setFazendinha({}));
    fetch("/api/admin/modalidades").then(res => res.json()).then(setModalidades).catch(() => setModalidades({}));
    fetch("/api/admin/reports").then(res => res.json()).then(setOfficialExports).catch(() => setOfficialExports([]));
  }, []);

  const raffleNameById = useMemo(() => {
    const map = new Map<string, string>();
    raffles.forEach((raffle) => map.set(String(raffle.id), raffle.title || `Sorteio ${raffle.id}`));
    return map;
  }, [raffles]);

  const reportRows = useMemo(() => {
    const raffleRows: ReportRow[] = purchases.map((item) => ({
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

    const fazendinhaRows: ReportRow[] = (fazendinha?.purchases || []).map((item: any) => ({
      id: item.id || `${item.grupoId}-${item.dataCompra}`,
      tipo: "fazendinha",
      origem: fazendinha?.config?.name || "Fazendinha",
      codigoSorteio: "fazendinha",
      nomeCompleto: item.customer?.name || "",
      telefone: item.customer?.phone || "",
      cidade: item.customer?.city || "",
      dataCompra: item.dataCompra || "",
      quantidadeCotas: Array.isArray(item.numeros) ? item.numeros.length : Number(item.quantidadeCotas || 0),
      status: item.statusPagamento || "reserved",
      valor: Number(item.valorPago || 0)
    }));

    const modalidadeRows: ReportRow[] = (modalidades?.purchases || []).map((item: any) => ({
      id: item.id || `${item.mode}-${item.createdAt}`,
      tipo: item.mode,
      origem: modalidadeLabel(item.mode),
      codigoSorteio: item.mode || "-",
      nomeCompleto: item.customer?.name || "",
      telefone: item.customer?.phone || "",
      cidade: item.customer?.city || "",
      dataCompra: item.createdAt || "",
      quantidadeCotas: Array.isArray(item.numbers) ? item.numbers.length : 0,
      status: item.status || "reserved",
      valor: Number(item.amount || 0)
    }));

    return [...raffleRows, ...fazendinhaRows, ...modalidadeRows].sort((a, b) => dateValue(b.dataCompra) - dateValue(a.dataCompra));
  }, [fazendinha, modalidades, purchases, raffleNameById]);

  const filteredRows = useMemo(() => {
    const byType = reportRows.filter((item) => {
      if (reportType === "global") return true;
      if (reportType === "raffle") return item.tipo === "rifa" && (!selectedRaffleId || item.codigoSorteio === selectedRaffleId);
      return item.tipo === reportType;
    });

    return byType.filter((item) => isInsidePeriod(item.dataCompra, period));
  }, [period, reportRows, reportType, selectedRaffleId]);

  const paidRows = filteredRows.filter((item) => ["paid", "pago"].includes(String(item.status).toLowerCase()));
  const reportTitle = reportType === "raffle"
    ? raffleNameById.get(selectedRaffleId) || "Rifa especifica"
    : reportOptions.find(option => option.id === reportType)?.label || "Global";

  const summary = useMemo(() => {
    const uniqueBuyers = new Set(filteredRows.map((item) => `${item.telefone}-${item.nomeCompleto}`).filter(Boolean));
    return {
      revenue: paidRows.reduce((sum, item) => sum + item.valor, 0),
      tickets: paidRows.reduce((sum, item) => sum + item.quantidadeCotas, 0),
      buyers: uniqueBuyers.size,
      records: filteredRows.length
    };
  }, [filteredRows, paidRows]);

  const chartData = useMemo(() => {
    const map = new Map<string, { name: string; receita: number; vendas: number }>();
    paidRows.forEach(item => {
      const key = reportType === "global" ? item.origem : item.codigoSorteio;
      const current = map.get(key) || { name: item.origem || key, receita: 0, vendas: 0 };
      current.receita += item.valor;
      current.vendas += 1;
      map.set(key, current);
    });
    return [...map.values()].slice(0, 12);
  }, [paidRows, reportType]);

  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    filteredRows.forEach(item => map.set(statusLabel(item.status), (map.get(statusLabel(item.status)) || 0) + 1));
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [filteredRows]);

  const optionCounts = useMemo(() => {
    return reportOptions.reduce<Record<ReportType, number>>((acc, option) => {
      acc[option.id] = reportRows.filter((item) => {
        if (option.id === "global") return true;
        if (option.id === "raffle") return item.tipo === "rifa";
        return item.tipo === option.id;
      }).length;
      return acc;
    }, {} as Record<ReportType, number>);
  }, [reportRows]);

  const exportCSV = () => {
    const headers = ["Tipo", "Origem", "Nome completo", "Telefone", "Cidade", "Data da compra", "Codigo do sorteio", "Quantidade de cotas", "Status", "Valor"];
    const rows = filteredRows.map(item => [
      item.tipo,
      item.origem,
      item.nomeCompleto,
      item.telefone,
      item.cidade,
      item.dataCompra,
      item.codigoSorteio,
      item.quantidadeCotas,
      statusLabel(item.status),
      item.valor.toFixed(2)
    ]);
    const csv = [headers, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
    download(`relatorio-${reportFileName(reportType)}.csv`, csv, "text/csv");
  };

  const exportJSON = () => download(`relatorio-${reportFileName(reportType)}.json`, JSON.stringify({ reportType, reportTitle, period, summary, rows: filteredRows }, null, 2), "application/json");

  const exportOfficial = async (format: "pdf" | "csv") => {
    setExportingOfficial(format);
    try {
      const res = await fetch("/api/admin/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: reportType === "global" ? "financial_tenant" : reportType === "raffle" ? "sold_tickets" : reportType,
          format,
          filters: { period, raffleId: reportType === "raffle" ? selectedRaffleId : undefined }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao gerar relatorio oficial");
      setOfficialExports(current => [data, ...current]);
      await downloadOfficial(data.id);
    } finally {
      setExportingOfficial("");
    }
  };

  const downloadOfficial = async (id: string) => {
    const res = await fetch(`/api/admin/reports/${id}/download`);
    const blob = await res.blob();
    const contentDisposition = res.headers.get("content-disposition") || "";
    const filename = contentDisposition.match(/filename="([^"]+)"/)?.[1] || `relatorio-${id}.pdf`;
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-black text-[var(--admin-text)]">Relatorios completos</h1>
            <p className="text-sm text-[var(--admin-muted)]">Escolha entre relatorio global, rifa especifica, Fazendinha, Milhar, Centena ou Dezena.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={reportType} onChange={event => setReportType(event.target.value as ReportType)} className="admin-input h-11 min-w-48 rounded-2xl px-4 outline-none">
              {reportOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            {reportType === "raffle" && (
              <select value={selectedRaffleId} onChange={event => setSelectedRaffleId(event.target.value)} className="admin-input h-11 min-w-56 rounded-2xl px-4 outline-none">
                {raffles.map((raffle) => <option key={raffle.id} value={raffle.id}>{raffle.title || `Sorteio ${raffle.id}`}</option>)}
              </select>
            )}
            <select value={period} onChange={event => setPeriod(event.target.value)} className="admin-input h-11 min-w-40 rounded-2xl px-4 outline-none">
              <option value="24h">24h</option>
              <option value="7d">7 dias</option>
              <option value="30d">30 dias</option>
              <option value="all">Todo periodo</option>
            </select>
            <AdminExportButtons onCSV={exportCSV} onJSON={exportJSON} />
            <button onClick={() => void exportOfficial("pdf")} disabled={Boolean(exportingOfficial)} className="admin-button-primary">
              <FileText className="h-4 w-4" /> {exportingOfficial === "pdf" ? "Gerando..." : "PDF oficial"}
            </button>
            <button onClick={() => void exportOfficial("csv")} disabled={Boolean(exportingOfficial)} className="admin-button-secondary">
              <ShieldCheck className="h-4 w-4" /> CSV auditavel
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {reportOptions.map((option) => (
          <button
            type="button"
            key={option.id}
            onClick={() => setReportType(option.id)}
            className={`admin-card p-4 text-left transition ${reportType === option.id ? "border-[var(--admin-primary)]" : "hover:border-[var(--admin-primary)]"}`}
            style={reportType === option.id ? { background: "color-mix(in srgb, var(--admin-primary) 12%, var(--admin-surface))" } : undefined}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-[var(--admin-text)]">{option.label}</span>
              <span className="rounded-full bg-[var(--admin-surface-strong)] px-2 py-1 text-xs font-bold text-[var(--admin-primary)]">{optionCounts[option.id] || 0}</span>
            </span>
            <span className="mt-2 block text-xs leading-5 text-[var(--admin-muted)]">{option.description}</span>
          </button>
        ))}
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={BadgeDollarSign} label="Faturamento" value={`R$ ${summary.revenue.toFixed(2)}`} trend={`Relatorio ${reportTitle}`} tone="success" />
        <MetricCard icon={Ticket} label="Quantidade de cotas" value={summary.tickets} trend="somente cotas confirmadas" />
        <MetricCard icon={Users} label="Compradores" value={summary.buyers} trend="clientes unicos no filtro" tone="accent" />
        <MetricCard icon={ListChecks} label="Registros" value={summary.records} trend={`Periodo ${period}`} tone="warning" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title={`Faturamento - ${reportTitle}`}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--admin-muted)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--admin-muted)" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "var(--admin-surface-strong)", border: "1px solid var(--admin-border)", borderRadius: 16, color: "var(--admin-text)" }} />
                <Bar dataKey="receita" radius={[12, 12, 0, 0]} fill="var(--admin-primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Registros por Status">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={110}>
                  {["var(--admin-success)", "var(--admin-warning)", "var(--admin-danger)", "var(--admin-primary)", "var(--admin-accent)"].map(color => <Cell key={color} fill={color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--admin-surface-strong)", border: "1px solid var(--admin-border)", borderRadius: 16 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <section className="admin-card p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-[var(--admin-text)]"><FileBarChart className="h-5 w-5 text-[var(--admin-primary)]" /> Relatorio selecionado</h2>
            <p className="text-sm text-[var(--admin-muted)]">Exportacao completa com nome, telefone, cidade, data, codigo do sorteio e quantidade de cotas.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-sm text-[var(--admin-muted)]">
            <Filter className="h-4 w-4" />
            {reportTitle} · {periodLabel(period)}
          </div>
        </div>
      </section>

      <section className="admin-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--admin-text)]">Exportacoes oficiais auditaveis</h2>
            <p className="text-sm text-[var(--admin-muted)]">PDF/CSV com hash, request_id, assinatura e URL de validacao por QR Code.</p>
          </div>
          <Download className="h-5 w-5 text-[var(--admin-primary)]" />
        </div>
        <AdminDataTable
          columns={["Tipo", "Formato", "Hash", "Request ID", "Gerado em", "Download"]}
          rows={officialExports.slice(0, 8).map(item => [
            item.report_type,
            String(item.format).toUpperCase(),
            <span className="font-mono text-xs">{String(item.file_hash).slice(0, 18)}...</span>,
            <span className="font-mono text-xs">{item.request_id}</span>,
            item.created_at ? new Date(item.created_at).toLocaleString("pt-BR") : "-",
            <button onClick={() => void downloadOfficial(item.id)} className="admin-button-secondary py-2 text-xs"><Download className="h-4 w-4" /> Baixar</button>
          ])}
          empty="Nenhuma exportacao oficial gerada ainda."
        />
      </section>

      <AdminDataTable
        columns={["Tipo", "Origem", "Cliente", "Telefone", "Cidade", "Data", "Codigo sorteio", "Qtd. cotas", "Status", "Valor"]}
        rows={filteredRows.slice(0, 80).map(item => [
          modalidadeLabel(item.tipo),
          item.origem,
          item.nomeCompleto || "-",
          item.telefone || "-",
          item.cidade || "-",
          item.dataCompra ? new Date(item.dataCompra).toLocaleString("pt-BR") : "-",
          item.codigoSorteio,
          item.quantidadeCotas,
          statusLabel(item.status),
          `R$ ${item.valor.toFixed(2)}`
        ])}
        empty="Nenhum registro encontrado para este relatorio."
      />
    </div>
  );
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function dateValue(value: string) {
  const date = new Date(value).getTime();
  return Number.isFinite(date) ? date : 0;
}

function isInsidePeriod(value: string, period: string) {
  if (period === "all") return true;
  const date = dateValue(value);
  if (!date) return true;
  const days = period === "24h" ? 1 : period === "7d" ? 7 : 30;
  return date >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function modalidadeLabel(value: string) {
  const labels: Record<string, string> = {
    global: "Global",
    raffle: "Rifa especifica",
    rifa: "Rifa",
    fazendinha: "Fazendinha",
    milhar: "Milhar",
    centena: "Centena",
    dezena: "Dezena"
  };
  return labels[value] || value || "-";
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    paid: "Pago",
    pago: "Pago",
    pending: "Pendente",
    reserved: "Reservado",
    cancelled: "Cancelado",
    rejected: "Rejeitado"
  };
  return labels[String(value || "").toLowerCase()] || value || "-";
}

function periodLabel(value: string) {
  const labels: Record<string, string> = {
    "24h": "ultimas 24h",
    "7d": "ultimos 7 dias",
    "30d": "ultimos 30 dias",
    all: "todo periodo"
  };
  return labels[value] || value;
}

function reportFileName(value: ReportType) {
  return value === "raffle" ? "rifa-especifica" : value;
}
