import { FazendinhaHomeMediaBlock } from "./FazendinhaHomeMediaBlock";
import { cn } from "../lib/utils";
import type { FazendinhaMediaSlotSettings } from "../types";

export function FazendinhaHomeBanner({ className, ...props }: Partial<FazendinhaMediaSlotSettings> & { className?: string }) {
  return <FazendinhaHomeMediaBlock {...props} className={cn("fazendinha-home-banner fazendinha-animal-picker-banner", className)} />;
}
