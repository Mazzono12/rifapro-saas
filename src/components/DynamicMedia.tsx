import { inferMediaType } from "../utils/media";
import { ResponsiveMediaFrame } from "./ResponsiveMediaFrame";
import type React from "react";

export function DynamicMedia({ mediaUrl, mediaType, className, autoPlay = true, muted = true, interactive = true, fallback, mediaFit = "cover" }: {
  mediaUrl?: string;
  mediaType?: "image" | "video" | "youtube" | "vimeo" | "bunny";
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  interactive?: boolean;
  fallback?: React.ReactNode;
  mediaFit?: "cover" | "contain" | "fill";
}) {
  if (!mediaUrl) return <>{fallback || null}</>;
  return (
    <ResponsiveMediaFrame
      src={mediaUrl}
      type={mediaType || inferMediaType(mediaUrl)}
      preferredFit={mediaFit === "fill" ? "cover" : mediaFit}
      aspectMode="auto"
      autoPlay={autoPlay}
      muted={muted}
      controls={interactive}
      className={className}
    />
  );
}
