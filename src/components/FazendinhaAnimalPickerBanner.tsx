import { FazendinhaHomeBanner } from "./FazendinhaHomeBanner";
import type { FazendinhaMediaSlotSettings } from "../types";

export function FazendinhaAnimalPickerBanner(props: Partial<FazendinhaMediaSlotSettings>) {
  return <FazendinhaHomeBanner {...props} className="fazendinha-animal-picker-banner" />;
}
