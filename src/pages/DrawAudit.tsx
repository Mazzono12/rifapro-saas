import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export function DrawAudit() {
  const { raffleId = "" } = useParams();
  const [audit, setAudit] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/raffles/${raffleId}/draw-audit`)
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Auditoria nao encontrada");
        setAudit(data);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Auditoria nao encontrada"));
  }, [raffleId]);

  const verification = useMemo(() => {
    if (!audit) return "";
    return `${audit.raffle_id}:${audit.public_seed}:${audit.server_seed_revealed}:${audit.winning_number}:${audit.eligible_numbers_hash}`;
  }, [audit]);

  return (
    <main className="min-h-screen bg-[var(--theme-bg)] px-4 py-10 text-[var(--theme-text)]">
      <section className="mx-auto max-w-4xl">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-400 text-slate-950">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-white">Auditoria do Sorteio</h1>
              <p className="text-sm text-slate-300">Verificacao publica, seed revelada e hash das cotas elegiveis.</p>
            </div>
          </div>

          {error && <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">{error}</p>}

          {audit && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <AuditField label="Metodo" value={audit.draw_method} />
              <AuditField label="Numero vencedor" value={audit.winning_number} />
              <AuditField label="Seed publica" value={audit.public_seed} />
              <AuditField label="Hash da seed" value={audit.server_seed_hash} />
              <AuditField label="Seed revelada" value={audit.server_seed_revealed} />
              <AuditField label="Hash cotas elegiveis" value={audit.eligible_numbers_hash} />
              <AuditField label="Algoritmo" value={audit.algorithm_version} />
              <AuditField label="Data/hora" value={new Date(audit.created_at).toLocaleString("pt-BR")} />
              <div className="md:col-span-2">
                <AuditField label="Hash final do resultado" value={audit.result_hash} />
              </div>
              <div className="md:col-span-2 rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Base de verificacao</p>
                <code className="mt-2 block break-all text-xs text-emerald-200">{verification}</code>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function AuditField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-2 break-all text-sm font-semibold text-white">{value || "-"}</p>
    </div>
  );
}
