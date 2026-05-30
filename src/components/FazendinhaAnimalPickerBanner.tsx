import { FazendinhaHomeMediaBlock } from "./FazendinhaHomeMediaBlock";
import type { FazendinhaHomeMediaSettings } from "../types";

export function FazendinhaAnimalPickerBanner(props: Partial<FazendinhaHomeMediaSettings>) {
  return <FazendinhaHomeMediaBlock {...props} className="fazendinha-animal-picker-banner mb-5" />;
}
