import { useEffect, useMemo, useState } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";

type SuperWhatsAppNumber = {
  id: string;
  tenant?: { id: string; nome: string; slug: string };
  displayName: string;
  phoneNumber: string;
  phoneNumberId: string;
  status: string;
  qualityRating: string;
  dailySentCount: number;
  dailyLimit: number;
  lastErrorAt?: string;
  isDefault: boolean;
};

function formatDate(value?: string) {
  if (!value) return "Sem erro";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function SuperAdminWhatsAppNumbers() {
  const [numbers, setNumbers] = useState<SuperWhatsAppNumber[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/superadmin/whatsapp-center/numbers");
    const data = await response.json().catch(() => ({ numbers: [] }));
    if (response.ok) setNumbers(data.numbers || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(() => ({
    total: numbers.length,
    active: numbers.filter(item => item.status === "active").length,
    errors: numbers.filter(item => item.status === "error" || item.lastErrorAt).length,
    sent: numbers.reduce((sum, item) => sum + Number(item.dailySentCount || 0), 0)
  }), [numbers]);

  if (loading) return <div className="admin-card p-6 text-[var(--admin-muted)]">Carregando números WhatsApp...</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="admin-card p-4"><p className="text-sm text-[var(--admin-muted)]">Números</p><p className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">{totals.total}</p></div>
        <div className="admin-card p-4"><p className="text-sm text-[var(--admin-muted)]">Ativos</p><p className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">{totals.active}</p></div>
        <div className="admin-card p-4"><p className="text-sm text-[var(--admin-muted)]">Enviados hoje</p><p className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">{totals.sent}</p></div>
        <div className="admin-card p-4"><p className="text-sm text-[var(--admin-muted)]">Com erro recente</p><p className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">{totals.errors}</p></div>
      </div>

      <section className="admin-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[var(--admin-primary)] text-[var(--admin-button-text)]"><MessageCircle className="h-5 w-5" /></div>
            <div>
              <h2 className="mb-1 text-lg font-semibold text-[var(--admin-text)]">WhatsApp Enterprise</h2>
              <p className="text-sm text-[var(--admin-muted)]">Todos os tenants e números Cloud API conectados</p>
            </div>
          </div>
          <button type="button" onClick={() => void load()} className="admin-icon-button" aria-label="Atualizar" title="Atualizar"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-[var(--admin-muted)]"><tr><th className="p-3">Tenant</th><th className="p-3">Número</th><th className="p-3">Status</th><th className="p-3">Qualidade</th><th className="p-3">Enviados hoje</th><th className="p-3">Erro recente</th></tr></thead>
            <tbody>
              {numbers.map(number => (
                <tr key={number.id} className="border-t border-[var(--admin-border)] text-[var(--admin-text)]">
                  <td className="p-3"><p className="font-semibold">{number.tenant?.nome || "Tenant"}</p><p className="text-xs text-[var(--admin-muted)]">{number.tenant?.slug || number.tenant?.id}</p></td>
                  <td className="p-3"><p className="font-semibold">{number.displayName} {number.isDefault ? "• padrão" : ""}</p><p className="text-xs text-[var(--admin-muted)]">{number.phoneNumberId}</p></td>
                  <td className="p-3">{number.status}</td>
                  <td className="p-3">{number.qualityRating}</td>
                  <td className="p-3">{number.dailySentCount}/{number.dailyLimit}</td>
                  <td className="p-3">{formatDate(number.lastErrorAt)}</td>
                </tr>
              ))}
              {!numbers.length && <tr><td className="p-4 text-[var(--admin-muted)]" colSpan={6}>Nenhum número conectado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
