import { Clock, Gift, Sparkles, Trophy, Zap } from "lucide-react";
import type { PromotionSummary, PromotionType } from "../../types";

const iconByType: Partial<Record<PromotionType, typeof Zap>> = {
  double_tickets: Zap,
  buy_and_win: Gift,
  lucky_hour: Clock,
  pre_pix_upsell: Sparkles,
  buyer_ranking: Trophy
};

export function PromotionBadges({ badges, summary }: { badges?: Array<{ label: string; type: PromotionType; promotionId: string }>; summary?: PromotionSummary }) {
  const items = badges?.length ? badges : summary?.badges || [];
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2" data-promotion-badges>
      {items.map(item => {
        const Icon = iconByType[item.type] || Sparkles;
        return (
          <span key={`${item.promotionId}-${item.label}`} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-amber-200/25 bg-amber-300/12 px-3 text-xs font-black text-amber-100 shadow-[0_12px_36px_rgba(251,191,36,0.12)]">
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </span>
        );
      })}
    </div>
  );
}

export function PromotionSummaryCard({ summary }: { summary?: PromotionSummary }) {
  if (!summary || (!summary.bonusTickets && !summary.rewards?.length && !summary.upsellOffer && !summary.luckyHour?.applied)) return null;
  return (
    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-50" data-promotion-summary>
      <PromotionBadges summary={summary} />
      {summary.bonusTickets ? <p className="mt-3 font-bold">+{summary.bonusTickets} cotas extras contando no sorteio.</p> : null}
      {summary.rewards?.length ? <p className="mt-2 text-emerald-100/80">{summary.rewards.map(reward => `${reward.label}: ${reward.quantity}`).join(" • ")}</p> : null}
      {summary.upsellOffer ? <p className="mt-2 text-emerald-100/80">{summary.upsellOffer.label}: {summary.upsellOffer.description}</p> : null}
    </div>
  );
}
