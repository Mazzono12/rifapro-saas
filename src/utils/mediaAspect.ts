export type ResponsiveMediaOrientation = "square" | "vertical" | "story" | "portrait" | "horizontal" | "banner";
export type ResponsiveMediaAspectMode = "auto" | "square" | "vertical" | "horizontal" | "wide" | "cinematic" | "story" | "banner" | "portrait";
export type ResponsiveMediaFit = "cover" | "contain" | "auto";

export type MediaAspectDetection = {
  ratio: number;
  orientation: ResponsiveMediaOrientation;
  recommendedFit: "cover" | "contain";
  containerClass: string;
};

export function detectMediaAspectRatio(width: number, height: number): MediaAspectDetection {
  const safeWidth = Number(width);
  const safeHeight = Number(height);
  const ratio = safeWidth > 0 && safeHeight > 0 ? safeWidth / safeHeight : 16 / 9;
  const orientation: ResponsiveMediaOrientation = ratio > 1.8
    ? "banner"
    : ratio > 1.2
      ? "horizontal"
      : ratio >= 0.9 && ratio <= 1.1
        ? "square"
        : ratio < 0.8
          ? ratio <= 0.62
            ? "story"
            : "vertical"
          : "portrait";
  const recommendedFit = "contain";
  const containerClass = `responsive-media-${orientation}`;
  return { ratio, orientation, recommendedFit, containerClass };
}

export function aspectRatioForMode(mode: ResponsiveMediaAspectMode, detected?: MediaAspectDetection | null) {
  const orientation = mode === "auto" ? detected?.orientation : mode;
  if (orientation === "square") return "1 / 1";
  if (orientation === "story" || orientation === "vertical") return "9 / 16";
  if (orientation === "portrait") return "4 / 5";
  if (orientation === "banner" || orientation === "cinematic") return "21 / 9";
  return "16 / 9";
}

export function mediaFitForMode(preferredFit: ResponsiveMediaFit, detected?: MediaAspectDetection | null) {
  if (preferredFit === "cover" || preferredFit === "contain") return preferredFit;
  return detected?.recommendedFit || "contain";
}
