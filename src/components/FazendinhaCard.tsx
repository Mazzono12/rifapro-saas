import { motion } from "motion/react";
import { CheckCircle2, Clock, Lock } from "lucide-react";
import { cn } from "../lib/utils";
import { FAZENDINHA_ANIMAL_MARKS } from "../lib/fazendinha";
import type { FazendinhaGroup } from "../types";
import type React from "react";

const statusMap = {
  available: { label: "Disponivel", icon: CheckCircle2, className: "border-emerald-300/30 text-emerald-200 bg-emerald-400/10" },
  reserved: { label: "Reservado", icon: Clock, className: "border-amber-300/30 text-amber-200 bg-amber-400/10" },
  sold: { label: "Vendido", icon: Lock, className: "border-slate-300/20 text-slate-300 bg-slate-400/10" },
};

const gradients = [
  "from-emerald-200 via-cyan-200 to-sky-300",
  "from-fuchsia-200 via-rose-200 to-amber-200",
  "from-indigo-200 via-violet-200 to-cyan-200",
  "from-lime-200 via-emerald-200 to-teal-200",
];

type FazendinhaCardProps = {
  key?: React.Key;
  group: FazendinhaGroup;
  selected?: boolean;
  onSelect?: () => void;
};

export function FazendinhaCard({ group, selected, onSelect }: FazendinhaCardProps) {
  const status = statusMap[group.status];
  const StatusIcon = status.icon;
  const gradient = gradients[Math.abs(group.id.charCodeAt(0) + group.id.length) % gradients.length];
  const disabled = group.status !== "available";

  return (
    <motion.button
      type="button"
      whileHover={!disabled ? { y: -6, scale: 1.015 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className={cn(
        "group relative min-h-[128px] overflow-hidden rounded-2xl border p-2 text-left transition-all sm:min-h-[170px] sm:p-3 lg:min-h-[196px] lg:p-4",
        "bg-white/[0.055] shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl",
        selected ? "border-neon-cyan shadow-[0_0_42px_var(--theme-glow)]" : "border-white/10 hover:border-white/25",
        disabled && "opacity-70 cursor-not-allowed"
      )}
    >
      <div className={cn("absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br blur-2xl opacity-40", gradient)} />
      <div className="relative z-10 flex items-start justify-between gap-1.5 sm:gap-2">
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-2xl font-black text-slate-950 shadow-[inset_0_-10px_22px_rgba(0,0,0,0.16)] sm:h-16 sm:w-16 sm:rounded-2xl sm:text-4xl lg:h-20 lg:w-20 lg:text-5xl", gradient)}>
          {FAZENDINHA_ANIMAL_MARKS[group.id] || group.nomeBicho.slice(0, 2).toUpperCase()}
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-1 text-[8px] font-mono uppercase sm:px-2 sm:text-[10px]", status.className)}>
          <StatusIcon className="h-3 w-3" /> <span className="hidden sm:inline">{status.label}</span>
        </span>
      </div>
      <div className="relative z-10 mt-3 sm:mt-4">
        <h3 className="truncate font-display text-xs font-bold text-white sm:text-base lg:text-xl">{group.nomeBicho}</h3>
        <div className="mt-2 grid grid-cols-2 gap-1 sm:gap-1.5 lg:gap-2">
          {group.numeros.map(numero => (
            <span key={numero} className="rounded-md border border-white/10 bg-black/25 px-1 py-0.5 text-center text-[10px] font-mono text-white sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs lg:text-sm">
              {numero}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-end justify-between gap-1 sm:mt-4 sm:gap-2">
          <div>
            <p className="text-[8px] font-mono uppercase tracking-widest text-slate-500 sm:text-[10px]">Grupo</p>
            <p className="hidden text-sm text-slate-300 sm:block">4 numeros</p>
          </div>
          <p className="text-right font-display text-[11px] font-bold text-white sm:text-lg lg:text-2xl">R$ {Number(group.preco || 0).toFixed(2).replace(".", ",")}</p>
        </div>
      </div>
    </motion.button>
  );
}
