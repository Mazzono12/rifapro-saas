import { ImageOff } from "lucide-react";
import { CampaignMediaHero } from "../CampaignMediaHero";
import { cn } from "../../lib/utils";
import type { Raffle } from "../../types";

type CheckoutCampaignMediaProps = {
  campaign?: string;
  raffle?: Partial<Raffle> | null;
  mediaUrl?: string;
  mediaType?: Raffle["mediaType"] | Raffle["checkoutMediaType"] | string;
  fallbackTitle?: string;
  compact?: boolean;
  className?: string;
};

export function CheckoutCampaignMedia({
  campaign,
  raffle,
  mediaUrl,
  mediaType,
  fallbackTitle,
  compact,
  className
}: CheckoutCampaignMediaProps) {
  const resolvedUrl = mediaUrl || raffle?.checkoutMediaUrl || raffle?.mediaUrl || raffle?.image || "";
  const resolvedType = mediaType || (raffle?.checkoutMediaUrl ? raffle.checkoutMediaType : raffle?.mediaType) || "image";
  const title = fallbackTitle || raffle?.title || campaign || "Premio da campanha";

  if (!resolvedUrl) {
    return (
      <div className={cn("checkout-campaign-media checkout-media-preview checkout-media-fallback flex items-center gap-3 border border-white/10 bg-slate-950 p-4", compact ? "min-h-24" : "min-h-32", className)}>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-emerald-200">
          <ImageOff className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100">Campanha</p>
          <p className="mt-1 line-clamp-2 text-sm font-black text-white">{title}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">Preview do premio indisponivel.</p>
        </div>
      </div>
    );
  }

  return (
    <CampaignMediaHero
      mediaUrl={resolvedUrl}
      mediaType={resolvedType as Raffle["mediaType"]}
      mediaFit="cover"
      title={title}
      subtitle="Preview da campanha"
      overlay={false}
      className={cn("checkout-campaign-media checkout-media-preview border border-white/10 bg-slate-950", compact ? "aspect-[16/9]" : "aspect-video", className)}
    />
  );
}
