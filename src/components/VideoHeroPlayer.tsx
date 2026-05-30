import { SmartAutoPlayVideo } from "./SmartAutoPlayVideo";

type Props = {
  mediaUrl: string;
  title?: string;
  priority?: boolean;
  mediaFit?: "cover" | "contain" | "fill";
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  onMetadata?: (width: number, height: number) => void;
};

export function VideoHeroPlayer({
  mediaUrl,
  title,
  priority = false,
  mediaFit = "cover",
  className,
  onLoad,
  onError,
  onMetadata
}: Props) {
  return (
    <SmartAutoPlayVideo
      src={mediaUrl}
      title={title}
      priority={priority}
      mutedDefault={false}
      controls={false}
      playsInline
      preload="metadata"
      mediaFit={mediaFit}
      className={className}
      threshold={0.62}
      onLoad={onLoad}
      onError={onError}
      onMetadata={onMetadata}
    />
  );
}
