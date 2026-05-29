import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { Download, Flame, Lock, Rocket, Search, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import type { Raffle } from "../../types";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

export function AdminLiveDraw() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [form, setForm] = useState({ raffleId: "1", number: "" });
  const [raffleDraft, setRaffleDraft] = useState({ soldTickets: "", totalTickets: "", drawDate: "" });
  const [result, setResult] = useState<any | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingRaffle, setSavingRaffle] = useState(false);

  useEffect(() => {
    fetch("/api/raffles").then(res => res.json()).then(data => {
      setRaffles(data);
      if (data?.[0]?.id) setForm(current => ({ ...current, raffleId: current.raffleId || data[0].id }));
    }).catch(() => null);
  }, []);

  const raffle = useMemo(() => raffles.find(item => item.id === form.raffleId), [form.raffleId, raffles]);
  const winner = result?.status === "winner" ? result : null;
  const allWinnerTickets = result?.customerProfile?.purchases?.flatMap((purchase: any) => purchase.numeros || []) || [];

  useEffect(() => {
    if (!raffle) return;
    setRaffleDraft({
      soldTickets: String(raffle.soldTickets),
      totalTickets: String(raffle.totalTickets),
      drawDate: toDateTimeLocal(raffle.drawDate),
    });
  }, [raffle?.id]);

  const celebrate = () => {
    const duration = 4200;
    const end = Date.now() + duration;
    const timer = window.setInterval(() => {
      const left = end - Date.now();
      if (left <= 0) {
        window.clearInterval(timer);
        return;
      }
      const particleCount = 80 * (left / duration);
      confetti({ particleCount, spread: 85, origin: { x: 0.15, y: 0.75 }, colors: ["#22d3ee", "#facc15", "#ffffff", "#fb7185"] });
      confetti({ particleCount, spread: 85, origin: { x: 0.85, y: 0.75 }, colors: ["#a78bfa", "#facc15", "#ffffff", "#34d399"] });
    }, 230);
  };

  const runDraw = async () => {
    if (!form.raffleId) {
      toast.error("Informe o sorteio");
      return;
    }
    setDrawing(true);
    try {
      const res = await fetch(`/api/admin/raffles/${form.raffleId}/draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicSeed: `rifapro-public-${form.raffleId}-${new Date().toISOString()}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao realizar sorteio");
      setResult(data);
      if (data.status === "winner") {
        celebrate();
        toast.success("PARABÉNS! Ganhador encontrado");
      } else {
        toast.info(data.message || "Cota sem ganhador pago");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao realizar sorteio");
    } finally {
      setDrawing(false);
    }
  };

  const prepareDraw = async () => {
    if (!form.raffleId) return;
    setPreparing(true);
    try {
      const res = await fetch(`/api/admin/raffles/${form.raffleId}/draw/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicSeed: `rifapro-public-${form.raffleId}-${new Date().toISOString()}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao preparar sorteio");
      setResult(data);
      toast.success("Participantes travados e hash publicado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao preparar sorteio");
    } finally {
      setPreparing(false);
    }
  };

  const publishDraw = async () => {
    if (!form.raffleId) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/admin/raffles/${form.raffleId}/draw/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao publicar resultado");
      setResult((current: any) => ({ ...(current || {}), drawAudit: data.drawAudit }));
      toast.success("Resultado publicado com certificado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao publicar resultado");
    } finally {
      setPublishing(false);
    }
  };

  const downloadCertificate = () => {
    const url = result?.drawAudit?.audit_pdf_url;
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = `certificado-sorteio-${form.raffleId}.pdf`;
    link.click();
  };

  const saveRaffleDetails = async () => {
    if (!raffle) return;
    setSavingRaffle(true);
    try {
      const res = await fetch(`/api/admin/raffles/${raffle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soldTickets: Number(raffleDraft.soldTickets),
          totalTickets: Number(raffleDraft.totalTickets),
          drawDate: raffleDraft.drawDate ? new Date(raffleDraft.drawDate).toISOString() : raffle.drawDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar sorteio");
      setRaffles(current => current.map(item => item.id === data.id ? data : item));
      toast.success("Dados do sorteio atualizados");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar dados");
    } finally {
      setSavingRaffle(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden rounded-[2rem] border border-white/10 bg-black p-4 md:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.2),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(250,204,21,0.16),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(217,70,239,0.18),transparent_40%)]" />
      {winner && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 18 }).map((_, index) => (
            <span
              key={index}
              className="absolute animate-[rocket_2.4s_ease-in_infinite] text-3xl"
              style={{
                left: `${4 + (index * 11) % 92}%`,
                bottom: `${-10 - (index % 4) * 8}%`,
                animationDelay: `${(index % 9) * 0.18}s`
              }}
            >
              🚀
            </span>
          ))}
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-6xl space-y-6">
        <div className="text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-mono uppercase tracking-[0.28em] text-amber-200">
            <Sparkles className="h-4 w-4" /> Tema Sorteio
          </p>
          <h1 className="mt-5 font-sans text-5xl font-black uppercase tracking-[0.14em] text-white md:text-7xl">Número da SORTE</h1>
          <p className="mt-3 text-slate-300">Sorteio provably fair com lock de participantes, seed secreta, hash publico e certificado auditavel.</p>
        </div>

        <section className="glass-card p-5 md:p-6">
          <div className="grid gap-3 md:grid-cols-[1.4fr_auto_auto_auto]">
            <select value={form.raffleId} onChange={e => setForm({ ...form, raffleId: e.target.value })} className="p-4">
              {raffles.map(item => <option key={item.id} value={item.id}>{item.id} • {item.title}</option>)}
            </select>
            <button onClick={prepareDraw} disabled={preparing} className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-6 py-4 font-bold text-cyan-100 disabled:opacity-50">
              <Lock className="mr-2 inline h-5 w-5" /> {preparing ? "Travando..." : "Preparar"}
            </button>
            <button onClick={runDraw} disabled={drawing} className="neon-button rounded-xl px-8 py-4 disabled:opacity-50">
              <Search className="mr-2 inline h-5 w-5" /> {drawing ? "Apurando..." : "Executar"}
            </button>
            <button onClick={publishDraw} disabled={publishing || !result?.drawAudit?.server_seed_revealed} className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-6 py-4 font-bold text-emerald-100 disabled:opacity-50">
              <ShieldCheck className="mr-2 inline h-5 w-5" /> {publishing ? "Publicando..." : "Publicar"}
            </button>
          </div>
          {raffle && (
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Mini label="Sorteio" value={raffle.title} />
              <Mini label="Preço" value={`R$ ${raffle.price.toFixed(2)}`} />
              <EditableMini
                label="Vendidas"
                value={raffleDraft.soldTickets}
                suffix={`/ ${Number(raffleDraft.totalTickets || raffle.totalTickets).toLocaleString("pt-BR")}`}
                onChange={value => setRaffleDraft(current => ({ ...current, soldTickets: value.replace(/\D/g, "") }))}
              />
              <EditableMini
                label="Total"
                value={raffleDraft.totalTickets}
                onChange={value => setRaffleDraft(current => ({ ...current, totalTickets: value.replace(/\D/g, "") }))}
              />
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:col-span-3">
                <p className="text-[10px] font-mono uppercase text-slate-500">Data do sorteio</p>
                <input
                  type="datetime-local"
                  value={raffleDraft.drawDate}
                  onChange={event => setRaffleDraft(current => ({ ...current, drawDate: event.target.value }))}
                  className="mt-1 w-full border-0 bg-transparent p-0 font-bold text-white focus:ring-0"
                />
              </div>
              <button onClick={saveRaffleDetails} disabled={savingRaffle} className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 font-bold text-emerald-100 transition hover:bg-emerald-300/20 disabled:opacity-50">
                {savingRaffle ? "Salvando..." : "Salvar dados"}
              </button>
            </div>
          )}
        </section>

        {result && (
          <section className={cn("glass-card overflow-hidden p-6 text-center md:p-10", winner ? "border-amber-300/30 bg-amber-300/10" : "border-cyan-300/20 bg-cyan-300/5")}>
            {result.drawAudit && (
              <div className="mb-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-left">
                <div className="grid gap-3 md:grid-cols-2">
                  <Info label="Status provably fair" value={result.drawAudit.status || "locked"} />
                  <Info label="Hash da seed" value={result.drawAudit.server_seed_hash} />
                  <Info label="Hash cotas elegiveis" value={result.drawAudit.eligible_numbers_hash} />
                  <Info label="Algoritmo" value={result.drawAudit.algorithm_version} />
                  <Info label="Seed revelada" value={result.drawAudit.server_seed_revealed || "Nao revelada antes da execucao"} />
                  <Info label="Hash resultado" value={result.drawAudit.result_hash || "Aguardando execucao"} />
                </div>
                {result.drawAudit.audit_pdf_url && (
                  <button onClick={downloadCertificate} className="mt-4 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-white hover:bg-white/[0.1]">
                    <Download className="mr-2 inline h-4 w-4" /> Baixar certificado
                  </button>
                )}
              </div>
            )}
            {winner ? (
              <>
                <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-amber-300 text-black shadow-[0_0_80px_rgba(250,204,21,0.75)]">
                  <Trophy className="h-12 w-12" />
                </div>
                <p className="mt-6 text-xs font-mono uppercase tracking-[0.35em] text-amber-100">PARABÉNS</p>
                <h2 className="mt-2 font-display text-5xl font-black text-white md:text-7xl">{formatWinnerName(result.customer?.name)}</h2>
                <p className="mt-3 font-mono text-xl text-amber-200">Cota sorteada #{String(result.number).padStart(6, "0")}</p>
              </>
            ) : (
              <>
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-cyan-300/10 text-cyan-200">
                  <Flame className="h-10 w-10" />
                </div>
                <h2 className="mt-5 font-display text-4xl font-black text-white">{result.status === "available" ? "Cota disponível" : "Cota reservada"}</h2>
                <p className="mt-2 text-slate-300">{result.message}</p>
              </>
            )}

            {result.customer && (
              <div className="mt-8 grid gap-4 text-left lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-bold text-white"><Rocket className="h-5 w-5 text-amber-300" /> Dados do ganhador</h3>
                  <Info label="Nome" value={formatWinnerName(result.customer.name)} />
                  <Info label="Telefone" value={maskPhone(result.customer.phone)} />
                  <Info label="Cidade" value={`${result.customer.city || "Nao informado"} / ${result.customer.state || "UF"}`} />
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <h3 className="mb-4 font-display text-xl font-bold text-white">Todas as cotas compradas</h3>
                  <div className="max-h-72 overflow-y-auto custom-scrollbar">
                    {allWinnerTickets.length ? (
                      <div className="flex flex-wrap gap-2">
                        {allWinnerTickets.map((number: number, index: number) => (
                          <span key={`${number}-${index}`} className={cn("rounded-xl border px-3 py-2 font-mono text-sm", Number(number) === Number(result.number) ? "border-amber-300 bg-amber-300/20 text-amber-100" : "border-white/10 bg-white/[0.04] text-slate-300")}>
                            {String(number).padStart(6, "0")}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Nenhuma cota tradicional listada para este cliente.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-mono uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate font-bold text-white">{value}</p>
    </div>
  );
}

function EditableMini({ label, value, suffix = "", onChange }: { label: string; value: string; suffix?: string; onChange: (value: string) => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-mono uppercase text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <input value={value} onChange={event => onChange(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent p-0 font-bold text-white focus:ring-0" />
        {suffix && <span className="text-sm font-bold text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p className="mb-2 text-sm text-slate-300"><span className="font-mono text-xs uppercase tracking-widest text-slate-500">{label}:</span> <strong className="text-white">{value}</strong></p>
  );
}

function formatWinnerName(name?: string) {
  const parts = String(name || "Ganhador").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "Ganhador";
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function maskPhone(phone?: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "Nao informado";
  return `****${digits.slice(-4)}`;
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}
