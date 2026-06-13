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
  conversionProgressGoal?: number | null;
  conversionProgressLabel?: string;
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

const defaultScarcity: ScarcityPayload = {
  enabled: false,
  totalTickets: 0,
  soldTickets: 0,
  remainingTickets: 0,
  progress: 0,
  soldLastHour: 0,
  velocityPerHour: 0,
  estimatedEndAt: null,
  lastTicketsAlert: false,
  viewersOnline: 0
};

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeActivity(payload: unknown): { enabled: boolean; feedEnabled: boolean; toastEnabled: boolean; events: ActivityEvent[] } {
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as { enabled?: unknown; feedEnabled?: unknown; toastEnabled?: unknown; events?: unknown } : {};
  const events = Array.isArray(source.events) ? source.events : [];
  return {
    enabled: Boolean(source.enabled),
    feedEnabled: source.feedEnabled !== false,
    toastEnabled: source.toastEnabled !== false,
    events: events
      .filter((event): event is Partial<ActivityEvent> => Boolean(event && typeof event === "object"))
      .filter(event => ["purchase_approved", "instant_prize", "mystery_box"].includes(String(event.event_type || "")))
      .map(event => ({
        id: String(event.id || crypto.randomUUID()),
        event_type: String(event.event_type || "purchase"),
        display_name_masked: String(event.display_name_masked || "Cliente"),
        amount: safeNumber(event.amount),
        quantity: Math.max(0, safeNumber(event.quantity)),
        metadata: event.metadata && typeof event.metadata === "object" ? event.metadata : {},
        created_at: String(event.created_at || new Date().toISOString())
      }))
  };
}

function normalizeRanking(payload: unknown): RankingPayload {
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Partial<RankingPayload> : {};
  const normalizeBuyers = (items: unknown) => (
    Array.isArray(items)
      ? items
        .filter((item): item is { name?: unknown; tickets?: unknown; amount?: unknown } => Boolean(item && typeof item === "object"))
        .map(item => ({ name: String(item.name || "Cliente"), tickets: safeNumber(item.tickets), amount: safeNumber(item.amount) }))
      : []
  );
  return {
    enabled: Boolean(source.enabled),
    top_buyers: normalizeBuyers(source.top_buyers),
    weekly_buyers: normalizeBuyers(source.weekly_buyers),
    monthly_buyers: normalizeBuyers(source.monthly_buyers),
    top_affiliates: Array.isArray(source.top_affiliates) ? source.top_affiliates : [],
    top_winners: Array.isArray(source.top_winners) ? source.top_winners : []
  };
}

function normalizeScarcity(payload: unknown): ScarcityPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const source = payload as Partial<ScarcityPayload>;
  return {
    ...defaultScarcity,
    enabled: Boolean(source.enabled),
    totalTickets: safeNumber(source.totalTickets),
    soldTickets: safeNumber(source.soldTickets),
    remainingTickets: Math.max(0, safeNumber(source.remainingTickets)),
    conversionProgressGoal: source.conversionProgressGoal ? Math.max(0, safeNumber(source.conversionProgressGoal)) : null,
    conversionProgressLabel: String(source.conversionProgressLabel || "meta alcançada"),
    progress: Math.min(100, Math.max(0, safeNumber(source.progress))),
    soldLastHour: Math.max(0, safeNumber(source.soldLastHour)),
    velocityPerHour: Math.max(0, safeNumber(source.velocityPerHour)),
    estimatedEndAt: source.estimatedEndAt || null,
    lastTicketsAlert: Boolean(source.lastTicketsAlert),
    viewersOnline: Math.max(0, safeNumber(source.viewersOnline))
  };
}

function activityMessage(event: ActivityEvent) {
  if (event.event_type === "instant_prize") return `${event.display_name_masked} ganhou ${event.metadata?.prize || "premio"} na raspadinha`;
  if (event.event_type === "mystery_box") return `${event.display_name_masked} recebeu caixinha premiada`;
  return `${event.display_name_masked} acabou de comprar ${event.quantity.toLocaleString("pt-BR")} cotas`;
}

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return "agora";
  if (minutes === 1) return "há 1 min";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "há 1 h" : `há ${hours} h`;
}

async function safeJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) return fallback;
    return res.json();
  } catch {
    return fallback;
  }
}

export function PublicConversionWidgets({ raffleId, className }: { raffleId?: string; className?: string }) {
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [feedEnabled, setFeedEnabled] = useState(false);
  const [ranking, setRanking] = useState<RankingPayload>(defaultRanking);
  const [scarcity, setScarcity] = useState<ScarcityPayload | null>(null);
  const lastToastId = useRef<string>("");
  const nextToastType = useRef<"purchase" | "winner">("purchase");

  const load = async () => {
    if (!raffleId) return;
    const [activityPayload, rankingPayload, scarcityPayload] = await Promise.all([
      safeJson<{ enabled: boolean; events: ActivityEvent[] }>(`/api/public/raffles/${raffleId}/activity`, { enabled: false, events: [] }),
      safeJson<RankingPayload>(`/api/public/raffles/${raffleId}/ranking`, defaultRanking),
      safeJson<ScarcityPayload | null>(`/api/public/raffles/${raffleId}/scarcity`, null)
    ]);
    const normalizedActivity = normalizeActivity(activityPayload);
    const normalizedRanking = normalizeRanking(rankingPayload);
    const normalizedScarcity = normalizeScarcity(scarcityPayload);
    setFeedEnabled(normalizedActivity.enabled && normalizedActivity.feedEnabled);
    setActivity(normalizedActivity.enabled ? normalizedActivity.events : []);
    setRanking(normalizedRanking.enabled ? normalizedRanking : defaultRanking);
    setScarcity(normalizedScarcity?.enabled ? normalizedScarcity : null);
    if (normalizedActivity.enabled && normalizedActivity.toastEnabled && !document.body.dataset.checkoutOpen) {
      const purchases = normalizedActivity.events.filter(event => event.event_type === "purchase_approved");
      const winners = normalizedActivity.events.filter(event => event.event_type === "instant_prize" || event.event_type === "mystery_box");
      const preferred = nextToastType.current === "winner" ? winners[0] || purchases[0] : purchases[0] || winners[0];
      if (preferred && preferred.id !== lastToastId.current) {
        lastToastId.current = preferred.id;
        nextToastType.current = preferred.event_type === "purchase_approved" ? "winner" : "purchase";
        toast.custom(() => <SocialProofToast event={preferred} />, { duration: 4200, position: "top-center" });
      }
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 18000);
    return () => window.clearInterval(timer);
  }, [raffleId]);

  const featuredRanking = useMemo(() => (Array.isArray(ranking.top_buyers) ? ranking.top_buyers : []).slice(0, 5), [ranking.top_buyers]);
  if (!scarcity && !(feedEnabled && activity.length) && !featuredRanking.length) return null;

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
            <Metric icon={<Activity className="h-4 w-4" />} label="cotas vendidas" value={scarcity.soldTickets.toLocaleString("pt-BR")} />
            <Metric icon={<Flame className="h-4 w-4" />} label="ultima hora" value={scarcity.soldLastHour.toLocaleString("pt-BR")} />
          </div>
        )}
        {feedEnabled && <LivePurchaseFeed events={activity.filter(event => event.event_type === "purchase_approved").slice(0, 20)} />}
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
              <span className="inline-flex items-center gap-2"><Gauge className="h-4 w-4" /> {scarcity.conversionProgressGoal ? "meta comercial" : "progresso"}</span>
              <span className="font-black text-white">{scarcity.progress.toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full premium-cta-bg" style={{ width: `${Math.min(100, Math.max(0, scarcity.progress))}%` }} />
            </div>
            <p className="mt-2 text-xs font-black text-amber-100">🔥 {scarcity.soldTickets.toLocaleString("pt-BR")} cotas vendidas</p>
            <p className="mt-1 text-xs text-slate-300">🎯 {scarcity.progress.toFixed(0)}% da {scarcity.conversionProgressLabel || "meta alcançada"}</p>
            {scarcity.lastTicketsAlert && <p className="mt-2 text-xs font-black text-red-100">Alerta de ultimas cotas ativo.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

export function LivePurchaseFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="mt-4 space-y-2" data-live-purchase-feed="paid-only">
      <AnimatePresence initial={false}>
        {events.map(event => (
          <motion.div key={event.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex items-center gap-3 rounded-2xl bg-black/25 px-3 py-2 text-sm text-slate-200">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-300 text-slate-950">
              <ShoppingBag className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate">🔥 {activityMessage(event)}</span>
            <span className="shrink-0 text-xs font-bold text-emerald-100">{relativeTime(event.created_at)}</span>
          </motion.div>
        ))}
      </AnimatePresence>
      {!events.length && <p className="rounded-2xl bg-black/25 px-3 py-3 text-sm text-slate-400">Compras pagas recentes aparecem aqui sem expor dados sensiveis.</p>}
    </div>
  );
}

export function SocialProofToast({ event }: { event: ActivityEvent }) {
  const isWinner = event.event_type === "instant_prize" || event.event_type === "mystery_box";
  return (
    <div className={cn("pointer-events-none max-w-[min(92vw,360px)] rounded-2xl border px-4 py-3 text-sm text-white shadow-2xl", isWinner ? "border-amber-200/30 bg-slate-950/95" : "border-emerald-300/25 bg-slate-950/95")}>
      <span className={cn("font-black", isWinner ? "text-amber-100" : "text-emerald-200")}>{isWinner ? "GANHADOR" : "COMPRA"}</span>
      <p className="mt-1 text-slate-200">{isWinner ? `🎉 ${activityMessage(event)}` : `🔥 ${activityMessage(event)}`}</p>
    </div>
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
