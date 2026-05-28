import { Volume2 } from "lucide-react";
import { cn } from "../lib/utils";

type Props = {
  visible: boolean;
  onActivate: () => void;
  className?: string;
};

export function VideoSoundToggle({ visible, onActivate, className }: Props) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        "absolute bottom-4 right-4 z-20 inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-200/30 bg-black/72 px-4 text-sm font-black text-emerald-50 shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-xl transition hover:border-emerald-200/60 hover:bg-emerald-400 hover:text-slate-950 active:scale-[0.98]",
        className
      )}
    >
      <Volume2 className="h-4 w-4" />
      Ativar Som
    </button>
  );
}
