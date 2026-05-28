import { useEffect, useState } from "react";
import { FileSearch, Scale, ShieldAlert, WalletCards } from "lucide-react";

export function AdminComplianceCenter() {
  const [audit, setAudit] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any[]>([]);
  const [compliance, setCompliance] = useState<any>(null);
  const [fraud, setFraud] = useState<any[]>([]);

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
      setFraud(Array.isArray(fraudData) ? fraudData : []);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={FileSearch} label="Eventos imutaveis" value={audit.length} />
        <Metric icon={Scale} label="Ajustes de cotas" value={adjustments.length} />
        <Metric icon={WalletCards} label="Ledger financeiro" value={wallet.length} />
        <Metric icon={ShieldAlert} label="Sinais antifraude" value={fraud.length} />
      </div>

      <Section title="Auditoria imutavel" rows={audit.map(item => [item.action, item.resource_type, item.reason, item.hash])} />
      <Section title="Gerenciar cotas do pedido" rows={adjustments.map(item => [item.adjustment_type, item.order_id, item.old_numbers?.join(", "), item.new_numbers?.join(", ")])} />
      <Section title="Ledger financeiro" rows={wallet.map(item => [item.source_type, item.customer_id || item.affiliate_ref || "-", `R$ ${Number(item.amount || 0).toFixed(2)}`, item.reason])} />
      <Section title="Compliance LGPD" rows={(compliance?.requests || []).map((item: any) => [item.request_type, item.customer_id, item.status, item.reason])} />
      <Section title="Antifraude" rows={fraud.map(item => [item.signal_type, item.severity, item.status, JSON.stringify(item.metadata || {})])} />
    </div>
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
