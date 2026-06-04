import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export function DrawAudit() {
  const { raffleId = "" } = useParams();
  const [audit, setAudit] = useState<any>(null);
  const [error, setError] = useState("");
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

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
    return JSON.stringify({
      server_seed: audit.server_seed_revealed,
      public_seed: audit.public_seed,
      raffle_id: audit.raffle_id,
      timestamp: audit.executed_at,
      nonce: audit.nonce,
      eligible_numbers_hash: audit.eligible_numbers_hash,
      algorithm_version: audit.algorithm_version
    });
  }, [audit]);

  const verifyResult = async () => {
    if (!audit?.server_seed_revealed) {
      toast.error("Seed ainda nao revelada");
      return;
    }
    setVerifying(true);
    try {
      const localSeedHash = await sha256(audit.server_seed_revealed);
      const res = await fetch(`/api/public/raffles/${raffleId}/draw-audit/verify`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao verificar");
      setVerificationResult({ ...data, localSeedHashOk: localSeedHash === audit.server_seed_hash });
      if (data.verified && localSeedHash === audit.server_seed_hash) toast.success("Resultado verificado com sucesso");
      else toast.error("A prova nao confere");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nao foi possivel verificar");
    } finally {
      setVerifying(false);
    }
  };

  const exportCertificate = () => {
    if (!audit?.audit_pdf_url) return;
    const link = document.createElement("a");
    link.href = audit.audit_pdf_url;
    link.download = `certificado-sorteio-${audit.raffle_id}.pdf`;
    link.click();
  };

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
              <p className="text-sm text-slate-300">Compromisso criptografico antes do sorteio, seed revelada depois e recalculo publico independente.</p>
            </div>
          </div>

          {error && <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">{error}</p>}

          {audit && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <AuditField label="Metodo" value={audit.draw_method} />
              <AuditField label="Numero vencedor" value={audit.winning_number} />
              <AuditField label="Status" value={audit.status} />
              <AuditField label="Seed publica" value={audit.public_seed} />
              <AuditField label="Hash da seed" value={audit.server_seed_hash} />
              <AuditField label="Seed revelada" value={audit.server_seed_revealed || "Sera revelada apos a publicacao do resultado"} />
              <AuditField label="Nonce" value={String(audit.nonce || 1)} />
              <AuditField label="Hash cotas elegiveis" value={audit.eligible_numbers_hash} />
              <AuditField label="Algoritmo" value={audit.algorithm_version} />
              <AuditField label="Data/hora" value={new Date(audit.created_at).toLocaleString("pt-BR")} />
              <AuditField label="Lock dos participantes" value={audit.locked_at ? new Date(audit.locked_at).toLocaleString("pt-BR") : "-"} />
              <AuditField label="Execucao" value={audit.executed_at ? new Date(audit.executed_at).toLocaleString("pt-BR") : "-"} />
              <div className="md:col-span-2">
                <AuditField label="Hash final do resultado" value={audit.result_hash} />
              </div>
              <div className="md:col-span-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <p className="text-xs font-bold uppercase text-emerald-100">Como verificar</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Antes do sorteio o ambiente publica apenas a verificação protegida da seed secreta e das cotas elegiveis. Depois do sorteio a seed e revelada. O botao abaixo recalcula a conferência da seed e o resultado deterministico usando seed publica, raffle_id, timestamp, nonce e a lista travada.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={verifyResult} disabled={verifying || !audit.server_seed_revealed} className="premium-button min-h-12 px-5 disabled:opacity-50">
                    <ShieldCheck className="mr-2 inline h-4 w-4" /> {verifying ? "Verificando..." : "Verificar resultado"}
                  </button>
                  {audit.audit_pdf_url && (
                    <button onClick={exportCertificate} className="min-h-12 rounded-xl border border-white/10 bg-white/[0.06] px-5 font-bold text-white hover:bg-white/[0.1]">
                      <Download className="mr-2 inline h-4 w-4" /> Exportar certificado
                    </button>
                  )}
                </div>
                {verificationResult && (
                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                    <Check label="Seed" ok={verificationResult.seedHashOk && verificationResult.localSeedHashOk} />
                    <Check label="Cotas" ok={verificationResult.eligibleHashOk} />
                    <Check label="Resultado" ok={verificationResult.resultOk} />
                    <Check label="Final" ok={verificationResult.verified} />
                  </div>
                )}
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

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={ok ? "rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-emerald-100" : "rounded-xl border border-red-300/30 bg-red-400/10 p-3 text-red-100"}>
      <p className="text-xs font-black uppercase">{label}</p>
      <p className="mt-1 text-sm">{ok ? "Confere" : "Diverge"}</p>
    </div>
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
