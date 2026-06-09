import { useState } from "react";
import { Crown, Eraser, Gift, LockKeyhole, PackageOpen, Sparkles, Ticket, Trophy, XCircle, Zap } from "lucide-react";

type Props = {
  data: any;
  purchase?: any;
  onOrderBumpChange?: (accepted: boolean) => void;
  orderBumpAccepted?: boolean;
};

export function GamificationPanel({ data, purchase, onOrderBumpChange, orderBumpAccepted }: Props) {
  const [scratchResult, setScratchResult] = useState<any>(null);
  const [boxResult, setBoxResult] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const purchaseStatus = String(purchase?.status || purchase?.statusPagamento || purchase?.paymentStatus || "").toLowerCase();
  const isPurchasePaid = ["paid", "approved", "confirmed"].includes(purchaseStatus);
  const scratchEventId = purchase?.gamification?.scratchcardEventId;
  const scratchEvent = scratchResult?.event || scratchResult?.scratchcard || scratchResult;
  const scratchPrize = scratchEvent?.result?.prize || scratchResult?.prize?.name || scratchResult?.prize?.label || "";
  const scratchPrizeValue = Number(scratchEvent?.result?.value ?? scratchResult?.prize?.value ?? 0);
  const scratchWon = Boolean(scratchResult && String(scratchEvent?.status || "").toLowerCase() === "won" && scratchPrize);

  async function revealScratch() {
    const eventId = purchase?.gamification?.scratchcardEventId;
    if (!eventId) return;
    setBusy("scratch");
    try {
      const response = await fetch(`/api/gamification/scratchcards/${eventId}/reveal`, { method: "POST" });
      setScratchResult(await response.json());
    } finally {
      setBusy("");
    }
  }

  async function openBox(boxId?: string) {
    const eventId = purchase?.gamification?.mysteryBoxEventId;
    if (!eventId) return;
    setBusy("box");
    try {
      const response = await fetch(`/api/gamification/mystery-boxes/${eventId}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boxId })
      });
      setBoxResult(await response.json());
    } finally {
      setBusy("");
    }
  }

  if (!data && !purchase?.gamification) return null;

  return (
    <div className="space-y-3">
      {data?.luckyHour?.active && (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-amber-50">
          <div className="flex items-center gap-2 font-bold"><Zap className="h-4 w-4" /> Hora premiada ativa</div>
          <p className="mt-1 text-xs text-amber-100/80">Compras agora recebem benefício promocional automático no checkout.</p>
        </div>
      )}

      {data?.doubleChance?.active && (
        <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4 text-cyan-50">
          <div className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4" /> Chance em dobro</div>
          <p className="mt-1 text-xs text-cyan-100/80">Cotas qualificadas entram com peso {data.doubleChance.weight || 2} no sorteio.</p>
        </div>
      )}

      {data?.doubleTickets?.active && (
        <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-emerald-50">
          <div className="flex items-center gap-2 font-bold"><Gift className="h-4 w-4" /> {data.doubleTickets.label || "Cotas em dobro"}</div>
          <p className="mt-1 text-xs text-emerald-100/80">
            Regra: comprou X, ganha X. Comprando a partir de {data.doubleTickets.minTickets || 1} cotas, voce recebe a mesma quantidade em cotas extras reais.
          </p>
          <p className="mt-2 text-xs font-black text-emerald-100">Exemplo: comprou 100, recebe 200 cotas no bilhete.</p>
          {Array.isArray(data.doubleTickets.packageQuantities) && data.doubleTickets.packageQuantities.length > 0 && (
            <p className="mt-2 text-xs text-emerald-100/80">Aplicavel nos pacotes: {data.doubleTickets.packageQuantities.join(", ")} cotas.</p>
          )}
        </div>
      )}

      {purchase?.gamification?.doubleTickets?.applied && (
        <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-emerald-50">
          <div className="flex items-center gap-2 font-bold"><Gift className="h-4 w-4" /> Cotas em dobro aplicadas</div>
          <p className="mt-1 text-xs">+{purchase.gamification.doubleTickets.bonusTickets} cotas extras entraram no seu bilhete e contam no sorteio.</p>
        </div>
      )}

      {data?.orderBump?.enabled && onOrderBumpChange && (
        <label className="block cursor-pointer rounded-2xl border border-fuchsia-300/30 bg-fuchsia-300/10 p-4 text-fuchsia-50">
          <div className="flex items-start gap-3">
            <input type="checkbox" className="mt-1" checked={Boolean(orderBumpAccepted)} onChange={event => onOrderBumpChange(event.target.checked)} />
            <div>
              <p className="font-bold">{data.orderBump.label || "Oferta extra"}</p>
              <p className="mt-1 text-xs text-fuchsia-100/80">+{data.orderBump.tickets} cotas com {data.orderBump.discountPercent}% de desconto.</p>
            </div>
          </div>
        </label>
      )}

      {purchase?.gamification?.autoPrizes?.length > 0 && (
        <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-emerald-50">
          <div className="flex items-center gap-2 font-bold"><Trophy className="h-4 w-4" /> Super Cota</div>
          <p className="mt-1 text-xs">{purchase.gamification.autoPrizes.join(", ")}</p>
        </div>
      )}

      {scratchEventId && (
        <section className="relative isolate overflow-hidden rounded-[1.75rem] border border-fuchsia-300/25 bg-[#05030a] p-4 text-white shadow-[0_24px_70px_rgba(88,28,135,0.28)] sm:p-5">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.34),transparent_36%),radial-gradient(circle_at_50%_58%,rgba(245,158,11,0.18),transparent_34%),linear-gradient(180deg,#08040f_0%,#020104_100%)]" />
          <div className="pointer-events-none absolute inset-x-8 top-28 -z-10 h-40 rounded-full bg-fuchsia-500/25 blur-[70px]" />

          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-fuchsia-300/35 bg-fuchsia-400/10 text-fuchsia-100 shadow-[0_0_30px_rgba(217,70,239,0.35)]">
              <Ticket className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.38em] text-amber-200">RifaPro Premium</p>
            <h3 className="mt-2 text-3xl font-black uppercase leading-none tracking-wide text-transparent [background:linear-gradient(180deg,#fff7c2_0%,#fbbf24_44%,#8a4b05_100%)] bg-clip-text sm:text-4xl">
              Raspadinha
            </h3>
            <p className="mt-1 text-lg font-black uppercase tracking-[0.32em] text-white/85">Premiada</p>
            <p className="mx-auto mt-3 max-w-xs text-sm font-medium leading-relaxed text-slate-200">
              {scratchResult ? "Resultado oficial da sua raspadinha." : "Raspe e descubra seu prêmio."}
            </p>
          </div>

          <div className="relative mx-auto max-w-sm rounded-[1.45rem] border border-amber-300/55 bg-[#08070a] p-3 shadow-[0_0_0_1px_rgba(217,70,239,0.22),0_22px_60px_rgba(0,0,0,0.55)]">
            <div className="absolute inset-1 rounded-[1.2rem] border border-fuchsia-400/25" />
            <div className="relative overflow-hidden rounded-[1.1rem] border border-amber-200/30 bg-[linear-gradient(145deg,#0b090d_0%,#17100c_48%,#070509_100%)] p-4 text-center">
              <Crown className="mx-auto mb-2 h-8 w-8 text-amber-300 drop-shadow-[0_0_14px_rgba(251,191,36,0.75)]" />
              <p className="text-2xl font-black uppercase tracking-wide text-amber-300">Raspadinha</p>
              <p className="mt-1 text-sm font-black uppercase tracking-[0.34em] text-white/85">Premium</p>

              <div className="relative mt-4 min-h-44 overflow-hidden rounded-2xl border border-amber-200/45 bg-[#070609] p-4">
                {!scratchResult ? (
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(250,204,21,0.96)_0%,rgba(120,78,18,0.94)_24%,rgba(251,191,36,0.98)_48%,rgba(71,48,17,0.92)_72%,rgba(253,224,71,0.96)_100%)]">
                    <div className="absolute inset-0 opacity-60 [background-image:repeating-linear-gradient(160deg,rgba(255,255,255,0.32)_0_2px,transparent_2px_9px),radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.45),transparent_18%),radial-gradient(circle_at_78%_78%,rgba(0,0,0,0.22),transparent_22%)]" />
                    <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.45)_46%,transparent_58%)]" />
                    <div className="relative flex h-full min-h-44 flex-col items-center justify-center text-slate-950">
                      <Eraser className="mb-3 h-10 w-10 drop-shadow" />
                      <strong className="text-2xl font-black uppercase">Área metálica</strong>
                      <span className="mt-2 text-xs font-black uppercase tracking-[0.24em]">toque para revelar</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex min-h-36 flex-col items-center justify-center gap-2">
                    {scratchWon ? (
                      <>
                        <Sparkles className="h-11 w-11 text-amber-300 drop-shadow-[0_0_18px_rgba(251,191,36,0.85)]" />
                        <strong className="text-2xl font-black uppercase text-amber-200">Parabéns!</strong>
                        <span className="text-sm font-black uppercase tracking-[0.18em] text-white">Você ganhou</span>
                        <b className="max-w-full break-words text-3xl font-black text-transparent [background:linear-gradient(180deg,#fff7ad,#f59e0b)] bg-clip-text">
                          {scratchPrizeValue > 0 ? scratchPrizeValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : scratchPrize}
                        </b>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-11 w-11 text-slate-300" />
                        <strong className="text-2xl font-black uppercase text-white">Não foi dessa vez</strong>
                        <span className="text-sm font-medium text-slate-300">Resultado oficial registrado.</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-fuchsia-300/25 bg-black/45 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-fuchsia-300/40 bg-fuchsia-400/15 text-fuchsia-100">
                {isPurchasePaid ? <Gift className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
              </div>
              <p className="min-w-0 text-sm leading-snug text-slate-100">
                {isPurchasePaid ? "Você tem uma raspadinha disponível." : "Raspadinha bloqueada até a confirmação do pagamento."}
              </p>
            </div>
          </div>

          {!scratchResult && (
            <button
              type="button"
              onClick={revealScratch}
              disabled={busy === "scratch" || !isPurchasePaid}
              className="mt-5 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-fuchsia-200/45 bg-[linear-gradient(180deg,#a855f7_0%,#6d28d9_100%)] px-5 text-base font-black uppercase tracking-wide text-white shadow-[0_0_34px_rgba(168,85,247,0.62)] transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isPurchasePaid ? <Eraser className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
              {busy === "scratch" ? "Raspando..." : "Raspar agora"}
            </button>
          )}
        </section>
      )}

      {purchase?.gamification?.mysteryBoxEventId && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
          <div className="mb-3 flex items-center gap-2 font-bold"><PackageOpen className="h-4 w-4" /> Caixinha premiada</div>
          {boxResult ? (
            <p className="text-sm">{boxResult.box?.type === "empty" ? "Caixinha vazia." : `Você abriu: ${boxResult.box?.prize}`}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {(data?.mysteryBox?.boxes || [{ id: "box-1", label: "1" }, { id: "box-2", label: "2" }, { id: "box-3", label: "3" }]).slice(0, 6).map((box: any) => (
                <button key={box.id} type="button" onClick={() => openBox(box.id)} disabled={busy === "box"} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold disabled:opacity-50">
                  {box.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
