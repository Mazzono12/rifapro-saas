import { ResponsiveMediaFrame } from "./ResponsiveMediaFrame";
import { cn } from "../lib/utils";
import type { FazendinhaHomeMediaSettings } from "../types";

type FazendinhaHomeMediaBlockProps = Partial<FazendinhaHomeMediaSettings> & {
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
  className
}: FazendinhaHomeMediaBlockProps) {
  if (!enabled || !mediaUrl) return null;

  const resolvedTitle = title?.trim() || "A Fazendinha";
  const resolvedDescription = description?.trim();

  return (
    <section className={cn("fazendinha-home-media-block w-full min-w-0", className)} data-home-media="fazendinha">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[1.25rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
          <ResponsiveMediaFrame
            src={mediaUrl}
            type={mediaType}
            poster={posterUrl}
            alt={alt || resolvedTitle}
            preferredFit={fitMode}
            aspectMode="auto"
            autoPlay
            muted
            className="max-h-[72svh] rounded-none"
            fallbackTitle="Mídia da Fazendinha indisponível"
            fallbackSubtitle="Revise a URL configurada no painel admin."
          />
          <div className="p-4 sm:p-5">
            {resolvedTitle && <h2 className="text-2xl font-black leading-tight text-[var(--theme-text)] sm:text-3xl">{resolvedTitle}</h2>}
            {resolvedDescription && <p className="mt-2 text-sm leading-6 text-[var(--theme-muted)] sm:text-base">{resolvedDescription}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
