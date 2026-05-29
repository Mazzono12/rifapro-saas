import { useState } from "react";
import { Gift, PackageOpen, Sparkles, Trophy, Zap } from "lucide-react";

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
            Comprando a partir de {data.doubleTickets.minTickets || 1} cotas, voce recebe a mesma quantidade em cotas extras reais.
          </p>
        </div>
      )}

      {purchase?.gamification?.doubleTickets?.applied && (
        <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-emerald-50">
          <div className="flex items-center gap-2 font-bold"><Gift className="h-4 w-4" /> Cotas em dobro aplicadas</div>
          <p className="mt-1 text-xs">+{purchase.gamification.doubleTickets.bonusTickets} cotas extras entraram no seu bilhete.</p>
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
          <div className="flex items-center gap-2 font-bold"><Trophy className="h-4 w-4" /> Bilhete premiado</div>
          <p className="mt-1 text-xs">{purchase.gamification.autoPrizes.join(", ")}</p>
        </div>
      )}

      {purchase?.gamification?.scratchcardEventId && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
          <div className="mb-3 flex items-center gap-2 font-bold"><Gift className="h-4 w-4" /> Raspadinha liberada</div>
          {scratchResult ? (
            <p className="text-sm">{scratchResult.event?.status === "won" ? `Você ganhou ${scratchResult.event?.result?.prize}` : "Não foi dessa vez."}</p>
          ) : (
            <button type="button" onClick={revealScratch} disabled={busy === "scratch"} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">
              Raspar agora
            </button>
          )}
        </div>
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
