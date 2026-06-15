import { ImageOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";
import type { Raffle } from "../types";
import { ResponsiveMediaFrame } from "./ResponsiveMediaFrame";
import type { ResponsiveMediaAspectMode, ResponsiveMediaFit } from "../utils/mediaAspect";

type StandardRaffleMediaBlockProps = {
  mediaUrl?: string | null;
  mediaType?: Raffle["mediaType"] | null;
  fallbackImageUrl?: string | null;
  title: string;
  description?: string;
  price?: number;
  showDescriptionBelow?: boolean;
  noOverlay?: boolean;
  href?: string;
  ctaLabel?: string;
  progress?: number;
  soldTickets?: number;
  totalTickets?: number;
  priority?: boolean;
  preferredFit?: ResponsiveMediaFit;
  aspectMode?: ResponsiveMediaAspectMode;
  className?: string;
  hideInfo?: boolean;
};

function formatCurrency(value: unknown) {
  const parsed = Number(value);
  const safeValue = Number.isFinite(parsed) ? parsed : 0;
  return safeValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function StandardRaffleMediaBlock({
  mediaUrl,
  mediaType,
  fallbackImageUrl,
  title,
  description,
  price,
  showDescriptionBelow = true,
  noOverlay = true,
  href,
  ctaLabel = "Participar agora",
  progress,
  soldTickets,
  totalTickets,
  priority = false,
  preferredFit = "auto",
  aspectMode = "auto",
  className,
  hideInfo = false
}: StandardRaffleMediaBlockProps) {
  const [activeMedia, setActiveMedia] = useState<{ url: string; type: Raffle["mediaType"] } | null>(null);
  const safeProgress = Math.min(100, Math.max(0, Number.isFinite(Number(progress)) ? Number(progress) : 0));
  const safeSold = Math.max(0, Math.floor(Number(soldTickets || 0)));
  const safeTotal = Math.max(1, Math.floor(Number(totalTickets || 1)));
  const primaryUrl = typeof mediaUrl === "string" ? mediaUrl.trim() : "";
  const fallbackUrl = typeof fallbackImageUrl === "string" ? fallbackImageUrl.trim() : "";

  useEffect(() => {
    if (primaryUrl) {
      setActiveMedia({ url: primaryUrl, type: mediaType || "image" });
      return;
    }
    if (fallbackUrl) {
      setActiveMedia({ url: fallbackUrl, type: "image" });
      return;
    }
    setActiveMedia(null);
  }, [fallbackUrl, mediaType, primaryUrl]);

  const handleMediaError = () => {
    if (fallbackUrl && activeMedia?.url !== fallbackUrl) {
      setActiveMedia({ url: fallbackUrl, type: "image" });
      return;
    }
    setActiveMedia(null);
  };

  return (
    <article className={cn("overflow-hidden rounded-[1.25rem] border border-[var(--theme-border)] bg-[var(--theme-surface)]", className)}>
      <div className="clean-media-block relative w-full overflow-hidden bg-black">
        {activeMedia ? (
          <ResponsiveMediaFrame
            src={activeMedia.url}
            type={activeMedia.type}
            alt={title}
            preferredFit={preferredFit}
            aspectMode={aspectMode}
            priority={priority}
            muted={false}
            autoPlay
            playsInline
            controls={false}
            interactive={false}
            className="h-full max-h-[min(78svh,720px)] w-full rounded-none"
            mediaClassName="h-full w-full"
            onError={handleMediaError}
          />
        ) : (
          <div className="cfx-premium-media-placeholder grid min-h-[clamp(390px,72svh,620px)] w-full place-items-center bg-[#07030d] text-white sm:min-h-[360px]">
            <div className="flex max-w-[15rem] flex-col items-center gap-3 text-center">
              <ImageOff className="h-10 w-10 text-[#c084fc]" />
              <span className="text-xs font-black uppercase tracking-[0.24em]">Midia premium da campanha</span>
              <small className="text-xs font-semibold text-white/55">Imagem ou video sera exibido assim que for publicado.</small>
            </div>
          </div>
        )}
        {!noOverlay && <span className="sr-only">noOverlay preservado sem texto sobre midia</span>}
      </div>

      {!hideInfo && (
      <div className="media-info-block px-4 py-5 sm:px-6 sm:py-6">
        <h2 className="max-w-4xl text-3xl font-black leading-tight text-[var(--theme-text)] sm:text-4xl lg:text-5xl">{title}</h2>
        {showDescriptionBelow && description && (
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-[var(--theme-muted)] sm:text-lg">{description}</p>
        )}

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="mb-2 flex justify-between gap-4 text-[11px] font-bold uppercase tracking-wider text-[var(--theme-muted)]">
              <span>{safeProgress.toFixed(1)}% vendido</span>
              <span>{safeSold.toLocaleString("pt-BR")} / {safeTotal.toLocaleString("pt-BR")}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--theme-border)]">
              <div className="h-full rounded-full bg-[var(--theme-primary)]" style={{ width: `${safeProgress}%` }} />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
            {typeof price !== "undefined" && (
              <span className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] px-5 text-sm font-black text-[var(--theme-text)]">
                {formatCurrency(price)}/cota
              </span>
            )}
            {href && (
              <Link to={href} className="premium-button min-h-12 justify-center px-6 py-3 text-sm">
                {ctaLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
      )}
    </article>
  );
}
