import { ImageOff } from "lucide-react";
import { ResponsiveMediaFrame } from "../ResponsiveMediaFrame";
import { cn } from "../../lib/utils";
import type { Raffle } from "../../types";

type CheckoutMediaKind = "image" | "video" | "youtube" | "vimeo" | "bunny" | "fallback";

type CheckoutCampaignMediaProps = {
  campaign?: string | Record<string, any>;
  raffle?: Partial<Raffle> | null;
  modality?: string | Record<string, any>;
  mediaUrl?: string;
  mediaType?: CheckoutMediaKind | Raffle["mediaType"] | Raffle["checkoutMediaType"] | string;
  posterUrl?: string;
  title?: string;
  subtitle?: string;
  fallbackTitle?: string;
  compact?: boolean;
  showStatus?: boolean;
  showPrice?: boolean;
  statusLabel?: string;
  priceLabel?: string;
  className?: string;
};

export function getCampaignCheckoutMedia(campaign?: any, raffle?: any, modality?: any) {
  const sources = [campaign, raffle, modality].filter(Boolean);
  const first = (...keys: string[]) => {
    for (const source of sources) {
      for (const key of keys) {
        const value = source?.[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    }
    return "";
  };
  const explicitVideo = first("checkout_video_url", "checkoutVideoUrl", "videoUrl", "mainVideoUrl", "prizeVideo", "premioVideo", "campanhaVideo");
  const explicitImage = first("checkout_image_url", "checkoutImageUrl", "checkoutMediaUrl", "imageUrl", "bannerUrl", "coverImage", "prizeImage", "mainImage", "thumbnailUrl", "premioImagem", "campanhaImagem", "image", "mediaUrl");
  const posterUrl = first("checkout_video_poster_url", "checkoutVideoPosterUrl", "posterUrl", "videoPosterUrl", "thumbnailUrl", "imageUrl", "image");
  const rawMediaUrl = first("checkoutMediaUrl", "mediaUrl");
  const mediaUrl = explicitVideo || rawMediaUrl || explicitImage;
  const rawType = String(first("checkoutMediaType", "mediaType") || "").toLowerCase();
  const mediaType = explicitVideo
    ? inferCheckoutMediaType(explicitVideo, "video")
    : inferCheckoutMediaType(mediaUrl, rawType || (mediaUrl === explicitImage ? "image" : ""));
  const title = first("title", "name", "nome", "campaignName", "nomeCampanha") || (typeof campaign === "string" ? campaign : "") || "Campanha";
  const subtitle = first("subtitle", "description", "descricao", "prize", "premio", "prizeName") || "Preview do premio";
  return {
    mediaUrl,
    mediaType: mediaUrl ? mediaType : "fallback" as CheckoutMediaKind,
    title,
    subtitle,
    posterUrl
  };
}

function inferCheckoutMediaType(url?: string, declared?: string): CheckoutMediaKind {
  const value = String(url || "").toLowerCase();
  const type = String(declared || "").toLowerCase();
  if (["video", "youtube", "vimeo", "bunny", "image"].includes(type)) return type as CheckoutMediaKind;
  if (/player\.mediadelivery\.net\/play\//i.test(value)) return "bunny";
  if (/youtube\.com|youtu\.be/.test(value)) return "youtube";
  if (/vimeo\.com/.test(value)) return "vimeo";
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/.test(value)) return "video";
  return "image";
}

export function CheckoutCampaignMedia({
  campaign,
  raffle,
  modality,
  mediaUrl,
  mediaType,
  posterUrl,
  title,
  subtitle,
  fallbackTitle,
  compact,
  showStatus = true,
  showPrice = false,
  statusLabel = "Campanha ativa",
  priceLabel,
  className
}: CheckoutCampaignMediaProps) {
  const resolved = getCampaignCheckoutMedia(campaign, raffle, modality);
  const resolvedUrl = mediaUrl || resolved.mediaUrl;
  const resolvedType = (mediaType || resolved.mediaType || "fallback") as CheckoutMediaKind;
  const resolvedTitle = title || fallbackTitle || resolved.title || raffle?.title || (typeof campaign === "string" ? campaign : "") || "Premio da campanha";
  const resolvedSubtitle = subtitle || resolved.subtitle;
  const resolvedPoster = posterUrl || resolved.posterUrl;

  if (!resolvedUrl) {
    return (
      <div className={cn("checkout-campaign-media checkout-media-preview checkout-media-fallback flex items-center gap-3 border border-white/10 bg-slate-950 p-4", compact ? "min-h-24" : "min-h-32", className)}>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-emerald-200">
          <ImageOff className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          {showStatus && <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100">{statusLabel}</p>}
          <p className="mt-1 line-clamp-2 text-sm font-black text-white">{resolvedTitle}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">{resolvedSubtitle || "Preview do premio indisponivel."}</p>
          {showPrice && priceLabel && <p className="mt-2 text-xs font-black text-emerald-100">{priceLabel}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("checkout-campaign-media checkout-media-preview overflow-hidden rounded-2xl border border-white/10 bg-slate-950", className)}>
      <ResponsiveMediaFrame
        src={resolvedUrl}
        type={(resolvedType === "fallback" ? "image" : resolvedType) as Raffle["mediaType"]}
        alt={resolvedTitle}
        preferredFit="auto"
        aspectMode="auto"
        priority={false}
        muted
        className={cn(compact ? "max-h-[38svh]" : "max-h-[44svh]", resolvedPoster ? "bg-slate-950" : undefined)}
      />
      <div className="p-3 sm:p-4">
        <div className="min-w-0">
          {showStatus && <p className="mb-2 inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100">{statusLabel}</p>}
          <h3 className="line-clamp-2 text-base font-black leading-tight text-white sm:text-lg">{resolvedTitle}</h3>
          {resolvedSubtitle && <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-300">{resolvedSubtitle}</p>}
          {showPrice && priceLabel && <p className="mt-2 text-xs font-black text-emerald-100">{priceLabel}</p>}
        </div>
      </div>
    </div>
  );
}
