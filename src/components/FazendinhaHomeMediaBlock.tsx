import { ResponsiveMediaFrame } from "./ResponsiveMediaFrame";
import { cn } from "../lib/utils";
import type { FazendinhaMediaSlotSettings } from "../types";

type FazendinhaHomeMediaBlockProps = Partial<FazendinhaMediaSlotSettings> & {
  className?: string;
};

export function FazendinhaHomeMediaBlock({
  enabled,
  mediaUrl,
  mediaType = "image",
  posterUrl,
  title,
  description,
  fitMode = "auto",
  alt,
  altText,
  linkUrl,
  linkTarget = "_self",
  className
}: FazendinhaHomeMediaBlockProps) {
  if (!enabled || !mediaUrl) return null;

  const resolvedTitle = title?.trim() || "A Fazendinha";
  const resolvedDescription = description?.trim();

  const mediaCard = (
    <div className="overflow-hidden rounded-[1.1rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-[0_18px_60px_rgba(0,0,0,0.16)]">
      <ResponsiveMediaFrame
        src={mediaUrl}
        type={mediaType}
        poster={posterUrl}
        alt={altText || alt || resolvedTitle}
        preferredFit={fitMode}
        aspectMode="auto"
        autoPlay
        muted
        className="max-h-[52svh] rounded-none sm:max-h-[58svh]"
        fallbackTitle="Mídia da Fazendinha indisponível"
        fallbackSubtitle="Revise a URL configurada no painel admin."
      />
      <div className="p-3 sm:p-4">
        {resolvedTitle && <h2 className="text-xl font-black leading-tight text-[var(--theme-text)] sm:text-2xl">{resolvedTitle}</h2>}
        {resolvedDescription && <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-[var(--theme-muted)]">{resolvedDescription}</p>}
      </div>
    </div>
  );

  return (
    <section className={cn("fazendinha-home-media-block w-full min-w-0", className)} data-home-media="fazendinha">
      <div className="mx-auto max-w-5xl">
        {linkUrl ? (
          <a href={linkUrl} target={linkTarget} rel={linkTarget === "_blank" ? "noreferrer" : undefined} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]">
            {mediaCard}
          </a>
        ) : mediaCard}
      </div>
    </section>
  );
}
