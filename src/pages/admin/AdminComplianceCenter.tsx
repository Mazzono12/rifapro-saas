import { useEffect, useState } from "react";
import { FileSearch, Scale, ShieldAlert, WalletCards } from "lucide-react";

export function AdminComplianceCenter() {
  const [audit, setAudit] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any[]>([]);
  const [compliance, setCompliance] = useState<any>(null);
  const [fraud, setFraud] = useState<any[]>([]);
  const [fraudCases, setFraudCases] = useState<any[]>([]);
  const [fraudSummary, setFraudSummary] = useState<any>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/audit-ledger").then(res => res.json()).catch(() => []),
      fetch("/api/admin/ticket-adjustments").then(res => res.json()).catch(() => []),
      fetch("/api/admin/wallet-ledger").then(res => res.json()).catch(() => []),
      fetch("/api/admin/compliance").then(res => res.json()).catch(() => null),
      fetch("/api/admin/antifraud").then(res => res.json()).catch(() => [])
    ]).then(([auditData, adjustmentData, walletData, complianceData, fraudData]) => {
      setAudit(Array.isArray(auditData) ? auditData : []);
      setAdjustments(Array.isArray(adjustmentData) ? adjustmentData : []);
      setWallet(Array.isArray(walletData) ? walletData : []);
      setCompliance(complianceData);
      setFraud(Array.isArray(fraudData) ? fraudData : fraudData?.signals || []);
      setFraudCases(fraudData?.cases || []);
      setFraudSummary(fraudData?.summary || {});
    });
  }, []);

  const reviewCase = async (id: string, status: string) => {
    await fetch(`/api/admin/antifraud/cases/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason: `Revisao antifraude: ${status}`, blockCustomer: status === "blocked", releaseCustomer: status === "approved" })
    });
    const data = await fetch("/api/admin/antifraud").then(res => res.json());
    setFraud(data?.signals || []);
    setFraudCases(data?.cases || []);
    setFraudSummary(data?.summary || {});
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={FileSearch} label="Eventos imutaveis" value={audit.length} />
        <Metric icon={Scale} label="Ajustes de cotas" value={adjustments.length} />
        <Metric icon={WalletCards} label="Ledger financeiro" value={wallet.length} />
        <Metric icon={ShieldAlert} label="Sinais antifraude" value={fraud.length} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Metric icon={ShieldAlert} label="Casos em revisão" value={fraudSummary.open || 0} />
        <Metric icon={ShieldAlert} label="Alto risco" value={fraudSummary.highRisk || 0} />
        <Metric icon={ShieldAlert} label="Score médio" value={fraudSummary.averageScore || 0} />
      </div>

      <Section title="Auditoria imutavel" rows={audit.map(item => [item.action, item.resource_type, item.reason, item.hash])} />
      <Section title="Gerenciar cotas do pedido" rows={adjustments.map(item => [item.adjustment_type, item.order_id, item.old_numbers?.join(", "), item.new_numbers?.join(", ")])} />
      <Section title="Ledger financeiro" rows={wallet.map(item => [item.source_type, item.customer_id || item.affiliate_ref || "-", `R$ ${Number(item.amount || 0).toFixed(2)}`, item.reason])} />
      <Section title="Compliance LGPD" rows={(compliance?.requests || []).map((item: any) => [item.request_type, item.customer_id, item.status, item.reason])} />
      <AntifraudCases cases={fraudCases} onReview={reviewCase} />
      <Section title="Antifraude - eventos de score" rows={fraud.map(item => [item.signal_type, `${item.severity} (${item.score ?? 0})`, item.status, JSON.stringify(item.metadata || {})])} />
    </div>
  );
}

function AntifraudCases({ cases, onReview }: { cases: any[]; onReview: (id: string, status: string) => void }) {
  return (
    <section className="admin-card overflow-hidden p-0">
      <div className="border-b border-[var(--admin-border)] p-4">
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">Antifraude avançado - fila de revisão</h2>
        <p className="text-sm text-[var(--admin-muted)]">Score 0-30 baixo, 31-70 médio, 71-100 alto. Casos de alto risco podem bloquear checkout, saque ou afiliado.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <tbody>
            {cases.slice(0, 12).map(item => (
              <tr key={item.id} className="border-b border-[var(--admin-border)]">
                <td className="p-3 text-[var(--admin-text)]">{item.signal_type}</td>
                <td className="p-3 font-black text-[var(--admin-text)]">{item.score}</td>
                <td className="p-3 text-[var(--admin-text)]">{item.severity}</td>
                <td className="p-3 text-[var(--admin-text)]">{item.action}</td>
                <td className="p-3 text-[var(--admin-text)]">{item.status}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button onClick={() => onReview(item.id, "approved")} className="admin-button-secondary py-2 text-xs">Aprovar</button>
                    <button onClick={() => onReview(item.id, "blocked")} className="admin-button-secondary py-2 text-xs">Bloquear cliente</button>
                    <button onClick={() => onReview(item.id, "dismissed")} className="admin-button-secondary py-2 text-xs">Rejeitar</button>
                  </div>
                </td>
              </tr>
            ))}
            {!cases.length && <tr><td className="p-4 text-[var(--admin-muted)]">Nenhum caso antifraude em revisão.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="admin-card p-4">
      <Icon className="h-5 w-5 text-[var(--admin-primary)]" />
      <p className="mt-3 text-sm text-[var(--admin-muted)]">{label}</p>
      <p className="text-3xl font-black text-[var(--admin-text)]">{value}</p>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="admin-card overflow-hidden p-0">
      <div className="border-b border-[var(--admin-border)] p-4">
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <tbody>
            {rows.slice(0, 12).map((row, index) => (
              <tr key={index} className="border-b border-[var(--admin-border)]">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-[360px] truncate p-3 text-[var(--admin-text)]">{cell || "-"}</td>)}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="p-4 text-[var(--admin-muted)]">Nenhum registro encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
