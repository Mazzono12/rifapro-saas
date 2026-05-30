import { ResponsiveMediaFrame } from "./ResponsiveMediaFrame";
import { cn } from "../lib/utils";
import type { FazendinhaMediaSlotSettings } from "../types";

type FazendinhaCheckoutMediaProps = Partial<FazendinhaMediaSlotSettings> & {
  className?: string;
};

const supportedCheckoutMediaTypes = ["image", "video", "gif", "youtube", "vimeo", "bunny"] as const;

export function FazendinhaCheckoutMedia({
  enabled,
  mediaUrl,
  mediaType = "image",
  posterUrl,
  title,
  description,
  fitMode = "auto",
  alt,
  altText,
  className
}: FazendinhaCheckoutMediaProps) {
  if (!enabled || !mediaUrl) return null;

  const resolvedTitle = title?.trim();
  const resolvedDescription = description?.trim();
  const resolvedType = supportedCheckoutMediaTypes.includes(mediaType as any) ? mediaType : "image";

  return (
    <section className={cn("fazendinha-checkout-media checkout-media-preview overflow-hidden rounded-2xl border border-white/10 bg-slate-950", className)} data-checkout-media="fazendinha">
      <ResponsiveMediaFrame
        src={mediaUrl}
        type={resolvedType}
        poster={posterUrl}
        alt={altText || alt || resolvedTitle || "Mídia do checkout da Fazendinha"}
        preferredFit={fitMode}
        aspectMode="auto"
        autoPlay
        muted
        className="max-h-[34svh] rounded-none sm:max-h-[38svh]"
        fallbackTitle="Mídia do checkout indisponível"
        fallbackSubtitle="Revise a URL configurada no painel admin."
      />
      {(resolvedTitle || resolvedDescription) && (
        <div className="p-3 sm:p-4">
          {resolvedTitle && <h3 className="line-clamp-2 text-base font-black leading-tight text-white sm:text-lg">{resolvedTitle}</h3>}
          {resolvedDescription && <p className="mt-1 line-clamp-3 text-xs font-semibold leading-5 text-slate-300 sm:text-sm">{resolvedDescription}</p>}
        </div>
      )}
    </section>
  );
}
