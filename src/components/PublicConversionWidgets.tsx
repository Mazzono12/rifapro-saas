import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Activity, Flame, Gauge, ShoppingBag, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

type ActivityEvent = {
  id: string;
  event_type: string;
  display_name_masked: string;
  amount: number;
  quantity: number;
  metadata?: { label?: string; prize?: string; source?: string };
  created_at: string;
};

type RankingPayload = {
  enabled: boolean;
  top_buyers: Array<{ name: string; tickets: number; amount: number }>;
  weekly_buyers: Array<{ name: string; tickets: number; amount: number }>;
  monthly_buyers: Array<{ name: string; tickets: number; amount: number }>;
  top_affiliates: Array<{ name: string; conversions: number; revenue: number }>;
  top_winners: Array<{ name: string; prize: string; value: number }>;
};

type ScarcityPayload = {
  enabled: boolean;
  totalTickets: number;
  soldTickets: number;
  remainingTickets: number;
  progress: number;
  soldLastHour: number;
  velocityPerHour: number;
  estimatedEndAt: string | null;
  lastTicketsAlert: boolean;
  viewersOnline: number;
};

const defaultRanking: RankingPayload = {
  enabled: false,
  top_buyers: [],
  weekly_buyers: [],
  monthly_buyers: [],
  top_affiliates: [],
  top_winners: []
};

function activityMessage(event: ActivityEvent) {
  if (event.event_type === "instant_prize") return `${event.display_name_masked} ganhou ${event.metadata?.prize || "premio"} na raspadinha`;
  if (event.event_type === "mystery_box") return `${event.display_name_masked} recebeu caixinha premiada`;
  if (event.event_type === "purchase_created") return `${event.display_name_masked} reservou ${event.quantity} cotas agora`;
  return `${event.display_name_masked} comprou ${event.quantity} cotas agora`;
}

async function safeJson<T>(url: string, fallback: T): Promise<T> {
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) return fallback;
  return res.json();
}

export function PublicConversionWidgets({ raffleId, className }: { raffleId?: string; className?: string }) {
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [ranking, setRanking] = useState<RankingPayload>(defaultRanking);
  const [scarcity, setScarcity] = useState<ScarcityPayload | null>(null);
  const lastToastId = useRef<string>("");

  const load = async () => {
    if (!raffleId) return;
    const [activityPayload, rankingPayload, scarcityPayload] = await Promise.all([
      safeJson<{ enabled: boolean; events: ActivityEvent[] }>(`/api/public/raffles/${raffleId}/activity`, { enabled: false, events: [] }),
      safeJson<RankingPayload>(`/api/public/raffles/${raffleId}/ranking`, defaultRanking),
      safeJson<ScarcityPayload | null>(`/api/public/raffles/${raffleId}/scarcity`, null)
    ]);
    setActivity(activityPayload.enabled ? activityPayload.events || [] : []);
    setRanking(rankingPayload);
    setScarcity(scarcityPayload?.enabled ? scarcityPayload : null);
    const newest = activityPayload.events?.[0];
    if (activityPayload.enabled && newest && newest.id !== lastToastId.current) {
      lastToastId.current = newest.id;
      toast.custom(() => (
        <div className="rounded-2xl border border-emerald-300/25 bg-slate-950/95 px-4 py-3 text-sm text-white shadow-2xl">
          <span className="font-black text-emerald-200">Compra recente</span>
          <p className="mt-1 text-slate-200">{activityMessage(newest)}</p>
        </div>
      ), { duration: 4200 });
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 18000);
    return () => window.clearInterval(timer);
  }, [raffleId]);

  const featuredRanking = useMemo(() => ranking.top_buyers.slice(0, 5), [ranking.top_buyers]);
  if (!scarcity && !activity.length && !featuredRanking.length) return null;

  return (
    <section className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-200">Prova social</p>
            <h2 className="mt-1 text-xl font-black text-white">Movimento em tempo real</h2>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
            <Users className="h-5 w-5" />
          </div>
        </div>
        {scarcity && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Metric icon={<Activity className="h-4 w-4" />} label="vendo agora" value={scarcity.viewersOnline.toLocaleString("pt-BR")} />
            <Metric icon={<Flame className="h-4 w-4" />} label="ultima hora" value={scarcity.soldLastHour.toLocaleString("pt-BR")} />
          </div>
        )}
        <div className="mt-4 space-y-2">
          <AnimatePresence initial={false}>
            {activity.slice(0, 4).map(event => (
              <motion.div key={event.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex items-center gap-3 rounded-2xl bg-black/25 px-3 py-2 text-sm text-slate-200">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-300 text-slate-950">
                  <ShoppingBag className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">{activityMessage(event)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {!activity.length && <p className="rounded-2xl bg-black/25 px-3 py-3 text-sm text-slate-400">Compras recentes aparecem aqui sem expor dados sensiveis.</p>}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-100">Ranking</p>
            <h2 className="mt-1 text-xl font-black text-white">Top compradores</h2>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-200/20 bg-amber-200/10 text-amber-100">
            <Trophy className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {featuredRanking.length ? featuredRanking.map((buyer, index) => (
            <div key={`${buyer.name}-${index}`} className="flex items-center justify-between rounded-2xl bg-black/25 px-3 py-2 text-sm">
              <span className="truncate text-slate-200">{index + 1}. {buyer.name}</span>
              <span className="font-black text-amber-100">{buyer.tickets.toLocaleString("pt-BR")} cotas</span>
            </div>
          )) : <p className="rounded-2xl bg-black/25 px-3 py-3 text-sm text-slate-400">Ranking em formacao.</p>}
        </div>
        {scarcity && (
          <div className={cn("mt-4 rounded-2xl border p-3", scarcity.lastTicketsAlert ? "border-red-300/30 bg-red-400/10" : "border-white/10 bg-black/25")}>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="inline-flex items-center gap-2"><Gauge className="h-4 w-4" /> cotas restantes</span>
              <span className="font-black text-white">{scarcity.remainingTickets.toLocaleString("pt-BR")}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full premium-cta-bg" style={{ width: `${Math.min(100, Math.max(0, scarcity.progress))}%` }} />
            </div>
            {scarcity.lastTicketsAlert && <p className="mt-2 text-xs font-black text-red-100">Alerta de ultimas cotas ativo.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-center gap-2 text-slate-400">{icon}<span className="text-[10px] uppercase tracking-[0.18em]">{label}</span></div>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}
