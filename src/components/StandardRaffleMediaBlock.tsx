import { ImageOff } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import type { Raffle } from "../types";
import { MediaRenderer } from "./MediaRenderer";

type StandardRaffleMediaBlockProps = {
  mediaUrl?: string | null;
  mediaType?: Raffle["mediaType"] | null;
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
  className?: string;
};

function formatCurrency(value: unknown) {
  const parsed = Number(value);
  const safeValue = Number.isFinite(parsed) ? parsed : 0;
  return safeValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function StandardRaffleMediaBlock({
  mediaUrl,
  mediaType,
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
  className
}: StandardRaffleMediaBlockProps) {
  const resolvedType = mediaType || "image";
  const hasMedia = Boolean(mediaUrl);
  const safeProgress = Math.min(100, Math.max(0, Number.isFinite(Number(progress)) ? Number(progress) : 0));
  const safeSold = Math.max(0, Math.floor(Number(soldTickets || 0)));
  const safeTotal = Math.max(1, Math.floor(Number(totalTickets || 1)));

  return (
    <article className={cn("overflow-hidden rounded-[1.25rem] border border-[var(--theme-border)] bg-[var(--theme-surface)]", className)}>
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {hasMedia ? (
          <MediaRenderer
            mediaUrl={mediaUrl!}
            mediaType={resolvedType}
            mediaFit="cover"
            priority={priority}
            preload={priority ? "auto" : "metadata"}
            autoPlay={resolvedType !== "image"}
            muted={false}
            playWhenVisible={!priority}
            interactive={resolvedType !== "image"}
            className="h-full w-full"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[#030805] text-emerald-50/80">
            <div className="flex flex-col items-center gap-3 text-center">
              <ImageOff className="h-10 w-10 text-emerald-300" />
              <span className="text-xs font-black uppercase tracking-[0.24em]">Banner da campanha</span>
            </div>
          </div>
        )}
        {!noOverlay && <div className="pointer-events-none absolute inset-0 bg-black/10" />}
      </div>

      <div className="px-4 py-5 sm:px-6 sm:py-6">
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
    </article>
  );
}
