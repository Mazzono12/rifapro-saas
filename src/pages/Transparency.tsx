import { useEffect, useState } from "react";
import type React from "react";
import { Award, BarChart3, CheckCircle2, ShieldCheck, Trophy } from "lucide-react";

export function Transparency() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/transparency").then(res => res.json()).then(setData).catch(() => null);
  }, []);

  const totals = data?.totals || {};

  return (
    <main className="container mx-auto max-w-6xl px-4 pb-8 pt-4">
      <section className="mb-6 rounded-[2rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5 sm:p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--theme-primary)]/25 bg-[var(--theme-primary)]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--theme-primary)]">
          <ShieldCheck className="h-4 w-4" /> Transparência
        </div>
        <h1 className="text-3xl font-black text-[var(--theme-text)] sm:text-5xl">Sorteios, ganhadores e cotas premiadas</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--theme-muted)] sm:text-base">
          Acompanhe os principais indicadores públicos do ambiente: campanhas ativas, participação confirmada, ganhadores e prêmios instantâneos.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <PublicMetric icon={BarChart3} label="Sorteios ativos" value={totals.activeRaffles || 0} />
        <PublicMetric icon={CheckCircle2} label="Compras pagas" value={totals.paidPurchases || 0} />
        <PublicMetric icon={Award} label="Cotas confirmadas" value={totals.paidTickets || 0} />
        <PublicMetric icon={Trophy} label="Ganhadores" value={totals.winners || 0} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[2rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
          <h2 className="mb-4 text-xl font-black text-[var(--theme-text)]">Campanhas</h2>
          <div className="space-y-3">
            {(data?.raffles || []).map((raffle: any) => (
              <div key={raffle.id} className="rounded-2xl border border-[var(--theme-border)] bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[var(--theme-text)]">{raffle.title}</p>
                    <p className="text-xs text-[var(--theme-muted)]">Status: {raffle.status} • Sorteio: {raffle.drawDate ? new Date(raffle.drawDate).toLocaleString("pt-BR") : "a definir"}</p>
                  </div>
                  <span className="rounded-full border border-[var(--theme-primary)]/20 px-3 py-1 text-xs font-bold text-[var(--theme-primary)]">{raffle.progress}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/20">
                  <div className="h-full rounded-full bg-[var(--theme-primary)]" style={{ width: `${Math.min(100, raffle.progress)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
            <h2 className="mb-4 text-xl font-black text-[var(--theme-text)]">Últimos ganhadores</h2>
            <div className="space-y-3">
              {(data?.winners || []).map((winner: any) => (
                <div key={winner.id} className="rounded-2xl border border-[var(--theme-border)] bg-white/[0.04] p-4">
                  <p className="font-bold text-[var(--theme-text)]">{winner.winnerName}</p>
                  <p className="text-sm text-[var(--theme-muted)]">{winner.raffleName} • {winner.prizeDescription}</p>
                </div>
              ))}
              {!data?.winners?.length && <p className="text-sm text-[var(--theme-muted)]">Nenhum ganhador publicado ainda.</p>}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
            <h2 className="mb-4 text-xl font-black text-[var(--theme-text)]">Cotas premiadas</h2>
            <div className="flex flex-wrap gap-2">
              {(data?.instantPrizes || []).map((prize: any) => (
                <span key={prize.id} className="rounded-full border border-[var(--theme-border)] bg-white/[0.04] px-3 py-2 text-xs font-bold text-[var(--theme-text)]">
                  #{String(prize.numeroPremiado).padStart(6, "0")} • R$ {Number(prize.valorPremio || 0).toFixed(2).replace(".", ",")} • {prize.status}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function PublicMetric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
      <Icon className="mb-3 h-5 w-5 text-[var(--theme-primary)]" />
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--theme-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[var(--theme-text)]">{value}</p>
    </div>
  );
}
