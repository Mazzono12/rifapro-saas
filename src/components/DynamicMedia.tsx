import { inferMediaType } from "../utils/media";
import { MediaRenderer } from "./MediaRenderer";
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
  return <MediaRenderer mediaUrl={mediaUrl} mediaType={mediaType || inferMediaType(mediaUrl)} className={className} autoPlay={autoPlay} muted={muted} interactive={interactive} mediaFit={mediaFit} />;
}
