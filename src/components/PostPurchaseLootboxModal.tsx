import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Gift, Sparkles, X, Flame, Gem, Zap, XCircle, Play } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useLootboxOpen } from '../hooks/useLootboxOpen';
import { lootboxService, type LootboxOpenResult, type PrizeRarity } from '../services/lootboxService';
import type { LootboxConfig, RewardWheelSegment } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  earnedCount: number;
  contact: string;
  config?: Partial<LootboxConfig>;
}

const rarityLabels: Record<PrizeRarity, string> = {
  common: "Comum",
  rare: "Rara",
  epic: "Épica",
  legendary: "Lendária"
};

const rarityStyles: Record<PrizeRarity, {
  icon: typeof Sparkles;
  text: string;
  border: string;
  surface: string;
  shadow: string;
  badge: string;
  ambient: string;
  particle: string;
  confetti: string[];
  rays: string;
}> = {
  common: {
    icon: Sparkles,
    text: "text-emerald-300 drop-shadow-[0_0_18px_rgba(110,231,183,0.7)]",
    border: "border-emerald-300/60",
    surface: "bg-emerald-400/10",
    shadow: "shadow-[0_0_120px_rgba(16,185,129,0.24)]",
    badge: "bg-emerald-300 shadow-[0_0_45px_rgba(16,185,129,0.75)]",
    ambient: "bg-emerald-400/20",
    particle: "bg-emerald-200/70 shadow-[0_0_16px_rgba(110,231,183,0.9)]",
    confetti: ["#6ee7b7", "#34d399", "#ffffff"],
    rays: "bg-[radial-gradient(circle_at_50%_0%,rgba(110,231,183,0.22),transparent_45%)]"
  },
  rare: {
    icon: Zap,
    text: "text-cyan-300 drop-shadow-[0_0_18px_rgba(103,232,249,0.8)]",
    border: "border-cyan-300/60",
    surface: "bg-cyan-400/10",
    shadow: "shadow-[0_0_120px_rgba(6,182,212,0.28)]",
    badge: "bg-cyan-300 shadow-[0_0_45px_rgba(6,182,212,0.8)]",
    ambient: "bg-cyan-400/20",
    particle: "bg-cyan-200/75 shadow-[0_0_18px_rgba(103,232,249,0.95)]",
    confetti: ["#67e8f9", "#06b6d4", "#ffffff"],
    rays: "bg-[radial-gradient(circle_at_50%_0%,rgba(103,232,249,0.25),transparent_45%)]"
  },
  epic: {
    icon: Gem,
    text: "text-fuchsia-300 drop-shadow-[0_0_20px_rgba(217,70,239,0.85)]",
    border: "border-fuchsia-300/60",
    surface: "bg-fuchsia-400/10",
    shadow: "shadow-[0_0_130px_rgba(217,70,239,0.3)]",
    badge: "bg-fuchsia-300 shadow-[0_0_50px_rgba(217,70,239,0.9)]",
    ambient: "bg-fuchsia-400/20",
    particle: "bg-fuchsia-200/75 shadow-[0_0_20px_rgba(240,171,252,0.95)]",
    confetti: ["#f0abfc", "#d946ef", "#ffffff"],
    rays: "bg-[radial-gradient(circle_at_50%_0%,rgba(240,171,252,0.28),transparent_45%)]"
  },
  legendary: {
    icon: Flame,
    text: "text-amber-300 drop-shadow-[0_0_22px_rgba(245,158,11,0.95)]",
    border: "border-amber-300/70",
    surface: "bg-amber-400/12",
    shadow: "shadow-[0_0_150px_rgba(245,158,11,0.36)]",
    badge: "bg-amber-300 shadow-[0_0_60px_rgba(245,158,11,1)]",
    ambient: "bg-amber-400/25",
    particle: "bg-amber-200/85 shadow-[0_0_24px_rgba(253,230,138,1)]",
    confetti: ["#fde68a", "#f59e0b", "#ef4444", "#ffffff"],
    rays: "bg-[radial-gradient(circle_at_50%_0%,rgba(253,230,138,0.34),transparent_48%)]"
  }
};

const defaultWheelSegments: RewardWheelSegment[] = [
  { label: "PREMIO", color: "#f59e0b" },
  { label: "TENTE", color: "#334155" },
  { label: "PIX", color: "#06b6d4" },
  { label: "TENTE", color: "#475569" },
  { label: "BONUS", color: "#10b981" },
  { label: "TENTE", color: "#334155" },
  { label: "PREMIO", color: "#e11d48" },
  { label: "TENTE", color: "#475569" }
];

function segmentTextColor(color: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return "#ffffff";
  const value = match[1];
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 160 ? "#141414" : "#ffffff";
}

export function PostPurchaseLootboxModal({ isOpen, onClose, earnedCount, contact, config }: Props) {
  const { opening: requesting, setResult: setServerResult, open } = useLootboxOpen(contact);
  const [remaining, setRemaining] = useState(earnedCount);
  const [result, setResult] = useState<LootboxOpenResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [nextExperienceType, setNextExperienceType] = useState<"box" | "wheel">("wheel");
  const [queuedWheelSegments, setQueuedWheelSegments] = useState<LootboxOpenResult["wheelSegments"]>();
  const opening = requesting || spinning;
  const experienceType = result?.experienceType || nextExperienceType;
  const wheelSegments = result?.wheelSegments?.length ? result.wheelSegments : queuedWheelSegments?.length ? queuedWheelSegments : config?.wheelSegments?.length ? config.wheelSegments : defaultWheelSegments;
  const wheelSegmentDegrees = 360 / wheelSegments.length;
  const wheelBackground = useMemo(() => `conic-gradient(${wheelSegments
    .map((segment, index) => `${segment.color} ${index * wheelSegmentDegrees}deg ${(index + 1) * wheelSegmentDegrees}deg`)
    .join(", ")})`, [wheelSegmentDegrees, wheelSegments]);
  const rarity = (result?.prize?.rarity || result?.nearMiss?.rarity || "common") as PrizeRarity;
  const style = rarityStyles[rarity];
  const BoxIcon = style.icon;

  useEffect(() => {
    if (isOpen) {
      setRemaining(earnedCount);
      setResult(null);
      setServerResult(null);
      setSpinning(false);
      setRotation(0);
      setNextExperienceType(config?.rewardModes?.box ? "box" : config?.experienceType || "wheel");
      setQueuedWheelSegments(undefined);
      let cancelled = false;
      lootboxService.getAvailable(contact).then(queue => {
        const nextBox = queue.boxes.find(box => box.status === "closed");
        if (!cancelled && nextBox) {
          setNextExperienceType(nextBox.experienceType || config?.experienceType || "wheel");
          setQueuedWheelSegments(nextBox.wheelSegments);
        }
      }).catch(() => {
        // A confirmação já liberou o modal; a abertura exibirá o erro se a sessão não puder acessar a fila.
      });
      return () => {
        cancelled = true;
      };
    }
  }, [config?.experienceType, config?.rewardModes?.box, contact, earnedCount, isOpen, setServerResult]);

  const burstConfetti = (currentRarity: PrizeRarity) => {
    const duration = 2800;
    const end = Date.now() + duration;
    const defaults = { startVelocity: currentRarity === "legendary" ? 55 : 38, spread: 360, ticks: 90, zIndex: 1300, colors: style.confetti };

    const timer = window.setInterval(() => {
      const timeLeft = end - Date.now();
      if (timeLeft <= 0) {
        window.clearInterval(timer);
        return;
      }

      const particleCount = 70 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: 0.15, y: 0.25 } });
      confetti({ ...defaults, particleCount, origin: { x: 0.85, y: 0.25 } });
      confetti({ ...defaults, particleCount: particleCount / 2, origin: { x: 0.5, y: 0.15 } });
    }, 220);
  };

  const playSuspenseSound = () => {
    try {
      const audio = new AudioContext();
      [196, 220, 247, 294].forEach((freq, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = freq;
        oscillator.type = "sawtooth";
        gain.gain.setValueAtTime(0.0001, audio.currentTime + index * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.05, audio.currentTime + index * 0.16 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + index * 0.16 + 0.18);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(audio.currentTime + index * 0.16);
        oscillator.stop(audio.currentTime + index * 0.16 + 0.2);
      });
    } catch {
      // Best effort.
    }
  };

  const playPartySound = () => {
    try {
      const audio = new AudioContext();
      [523, 659, 784, 1046, 1318].forEach((freq, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = freq;
        oscillator.type = "triangle";
        gain.gain.setValueAtTime(0.0001, audio.currentTime + index * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + index * 0.11 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + index * 0.11 + 0.22);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(audio.currentTime + index * 0.11);
        oscillator.stop(audio.currentTime + index * 0.11 + 0.24);
      });

      Array.from({ length: 8 }).forEach((_, clapIndex) => {
        const bufferSize = audio.sampleRate * 0.08;
        const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i += 1) {
          output[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.2);
        }

        const source = audio.createBufferSource();
        const filter = audio.createBiquadFilter();
        const gain = audio.createGain();
        source.buffer = buffer;
        filter.type = "bandpass";
        filter.frequency.value = 1250;
        gain.gain.setValueAtTime(0.0001, audio.currentTime + 0.2 + clapIndex * 0.13);
        gain.gain.exponentialRampToValueAtTime(0.16, audio.currentTime + 0.22 + clapIndex * 0.13);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.29 + clapIndex * 0.13);
        source.connect(filter).connect(gain).connect(audio.destination);
        source.start(audio.currentTime + 0.2 + clapIndex * 0.13);
      });
    } catch {
      // Best effort.
    }
  };

  const playNegativeSound = () => {
    try {
      const audio = new AudioContext();
      [220, 164, 123].forEach((freq, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = freq;
        oscillator.type = "sine";
        gain.gain.setValueAtTime(0.0001, audio.currentTime + index * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.07, audio.currentTime + index * 0.18 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + index * 0.18 + 0.26);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(audio.currentTime + index * 0.18);
        oscillator.stop(audio.currentTime + index * 0.18 + 0.28);
      });
    } catch {
      // Best effort.
    }
  };

  const handleOpen = async () => {
    if (opening || remaining <= 0) return;
    setResult(null);
    setServerResult(null);
    setSpinning(true);

    try {
      playSuspenseSound();
      const data = await open();
      if (!data) {
        setSpinning(false);
        return;
      }

      const openedExperienceType = data.experienceType || experienceType;
      const openedWheelSegments = data.wheelSegments?.length ? data.wheelSegments : wheelSegments;
      const openedSegmentDegrees = 360 / openedWheelSegments.length;
      const winningIndexes = openedWheelSegments.map((segment, index) => segment.rewardEnabled || /premio|pix|bonus/i.test(segment.label) ? index : -1).filter(index => index >= 0);
      const losingIndexes = openedWheelSegments.map((segment, index) => !segment.rewardEnabled && /tente|nao|não/i.test(segment.label) ? index : -1).filter(index => index >= 0);
      const firstNonWinningIndex = openedWheelSegments.findIndex(segment => !segment.rewardEnabled);
      const targetIndex = data.won
        ? (data.prize?.wheelSegmentIndex ?? winningIndexes[0] ?? 0)
        : (losingIndexes[0] ?? (firstNonWinningIndex >= 0 ? firstNonWinningIndex : 0));
      const targetRotation = 90 - targetIndex * openedSegmentDegrees - openedSegmentDegrees / 2;
      if (openedExperienceType === "wheel") setRotation(current => current + 360 * 7 + targetRotation);
      await new Promise(resolve => setTimeout(resolve, openedExperienceType === "wheel" ? 3800 : 1200));
      if ((data.remaining ?? 0) > 0) {
        try {
          const queue = await lootboxService.getAvailable(contact);
          const nextBox = queue.boxes.find(box => box.status === "closed");
          if (nextBox) {
            setNextExperienceType(nextBox.experienceType || "wheel");
            setQueuedWheelSegments(nextBox.wheelSegments);
          }
        } catch {
          // O próximo clique exibirá o erro caso a fila deixe de estar acessível.
        }
      }
      setSpinning(false);
      setResult(data);
      setRemaining(data.remaining ?? Math.max(0, remaining - 1));

      if (data.won && data.effects?.confetti !== false) {
        burstConfetti(data.prize?.rarity || "rare");
        playPartySound();
      } else {
        playNegativeSound();
      }
    } catch (err) {
      setSpinning(false);
      toast.error("Erro ao girar roleta", {
        description: err instanceof Error ? err.message : "Tente novamente em instantes."
      });
      onClose();
    }
  };

  const continueFlow = () => {
    if (remaining > 0) {
      setResult(null);
      return;
    }
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn("absolute inset-0 backdrop-blur-3xl", experienceType === "wheel" && !result ? "bg-[#faf9ff]" : "bg-black/95")}
          />

          <div className="absolute inset-0 pointer-events-none">
            {experienceType !== "wheel" && <div className="absolute left-[8%] top-[18%] w-72 h-72 rounded-full bg-red-500/20 blur-[110px]" />}
            {experienceType !== "wheel" && <div className={cn("absolute right-[10%] bottom-[14%] w-80 h-80 rounded-full blur-[120px]", style.ambient)} />}
            {experienceType !== "wheel" && Array.from({ length: 22 }).map((_, index) => (
              <motion.span
                key={index}
                className={cn("absolute rounded-full", index % 4 === 0 ? "w-2 h-2" : "w-1.5 h-1.5", opening ? style.particle : "bg-white/35")}
                style={{ left: `${8 + (index * 41) % 86}%`, top: `${12 + (index * 29) % 76}%` }}
                animate={{ y: [0, -18, 0], opacity: [0.2, 0.8, 0.2], scale: [1, 1.8, 1] }}
                transition={{ duration: 2.5 + (index % 5) * 0.4, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.86, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.86, y: 40 }}
            transition={{ type: "spring", damping: 18, stiffness: 150 }}
            className="relative z-10 w-full max-w-2xl text-center"
          >
            {result && (
              <button onClick={onClose} className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors" aria-label="Fechar">
                <X className="w-6 h-6" />
              </button>
            )}

            {!result ? (
              <>
                <div className="mb-8">
                  <p className={cn("mb-3 text-xs font-mono uppercase tracking-[0.35em]", experienceType === "wheel" ? "!text-pink-600" : "!text-amber-300")}>{experienceType === "wheel" ? "Giro liberado" : "Abertura liberada"}</p>
                  <h2 className={cn("text-4xl md:text-6xl font-display font-black tracking-tight", experienceType === "wheel" ? "!text-slate-950" : "!text-white")}>
                    {experienceType === "wheel" ? "Roleta Premiada" : "Caixinha Premiada"}
                  </h2>
                  <p className={cn("mt-4 font-mono text-sm", experienceType === "wheel" ? "!text-slate-700" : "!text-slate-200")}>
                    {remaining} {experienceType === "wheel" ? "giro(s)" : "caixinha(s)"} disponível(is)
                  </p>
                </div>

                {experienceType === "wheel" ? <div className="relative mx-auto h-[min(84vw,26rem)] w-[min(84vw,26rem)] rounded-full bg-[#fafafa]">
                  <div className="absolute right-[-1.1rem] top-1/2 z-20 -translate-y-1/2">
                    <div className="h-0 w-0 border-y-[16px] border-r-[29px] border-y-transparent border-r-[#111827] drop-shadow-[0_2px_2px_rgba(0,0,0,.28)]" />
                  </div>
                  <motion.div
                    className="absolute inset-0 overflow-hidden rounded-full border-2 border-[#1f2937] bg-white shadow-[0_8px_28px_rgba(15,23,42,.22)]"
                    style={{ background: wheelBackground }}
                    animate={{ rotate: rotation }}
                    transition={{ duration: spinning ? 3.65 : 0, ease: [0.12, 0.72, 0.14, 1] }}
                  >
                    {wheelSegments.map((segment, index) => (
                      <div
                        key={`${segment.label}-${index}`}
                        className="absolute left-1/2 top-1/2 z-10 text-center"
                        style={{ transform: `translate(-50%, -50%) rotate(${index * wheelSegmentDegrees + wheelSegmentDegrees / 2}deg) translateY(-7.4rem)` }}
                      >
                        {segment.imageUrl && <img src={segment.imageUrl} alt="" className="mx-auto mb-1 h-9 w-9 rounded-full border border-white/80 object-cover shadow-sm" />}
                        <span
                          className="block rotate-90 whitespace-nowrap text-xs font-semibold sm:text-base"
                          style={{ color: segmentTextColor(segment.color), textShadow: segmentTextColor(segment.color) === "#ffffff" ? "0 1px 2px rgba(0,0,0,.38)" : "none" }}
                        >
                          {segment.label}
                        </span>
                      </div>
                    ))}
                    <div className="absolute inset-[39%] rounded-full border border-slate-300 bg-white shadow-[0_2px_8px_rgba(15,23,42,.16)]" />
                  </motion.div>
                  <button
                    type="button"
                    onClick={handleOpen}
                    disabled={opening}
                    className="absolute left-1/2 top-1/2 z-10 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white !bg-[#ec4899] !text-white shadow-[0_5px_16px_rgba(236,72,153,.45)] transition-transform hover:scale-105 hover:!bg-[#db2777] disabled:cursor-wait disabled:opacity-75"
                    aria-label="Girar roleta premiada"
                  >
                    {opening ? <span className="text-lg font-black">...</span> : <Play className="ml-1 h-7 w-7 fill-current" />}
                  </button>
                  {spinning && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-amber-300/50"
                      animate={{ scale: [1, 1.06, 1], opacity: [0.7, 0.15, 0.7] }}
                      transition={{ repeat: Infinity, duration: 0.7 }}
                    />
                  )}
                </div> : (
                  <button
                    type="button"
                    onClick={handleOpen}
                    disabled={opening}
                    className="relative mx-auto grid h-[min(70vw,20rem)] w-[min(70vw,20rem)] place-items-center rounded-[2rem] border border-amber-200/70 bg-gradient-to-br from-rose-600 via-red-700 to-slate-950 shadow-[0_0_80px_rgba(239,68,68,.48)] disabled:cursor-wait"
                    aria-label="Abrir caixinha premiada"
                  >
                    <div className="absolute inset-y-0 w-10 bg-amber-200/90" />
                    <div className="absolute inset-x-0 h-10 bg-amber-200/90" />
                    <Gift className="relative z-10 h-28 w-28 !text-white" />
                  </button>
                )}

                <p className={cn("mt-8 text-xs font-mono uppercase tracking-[0.25em]", experienceType === "wheel" ? "!text-slate-700" : "!text-white/80")}>
                  {opening ? (experienceType === "wheel" ? "Girando..." : "Abrindo...") : (experienceType === "wheel" ? "Toque no play para girar" : "Toque para abrir")}
                </p>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.78, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.55 }}
                className={cn(
                  "relative overflow-hidden rounded-[2rem] border !bg-[#090c14] p-8 md:p-12",
                  result.won
                    ? `${style.border} ${style.surface} ${style.shadow}`
                    : "border-red-300/30 shadow-[0_0_80px_rgba(239,68,68,0.12)]"
                )}
              >
                <div className={cn("absolute inset-0 pointer-events-none", result.won ? style.rays : "bg-[radial-gradient(circle_at_50%_0%,rgba(248,113,113,0.18),transparent_48%)]")} />
                {Array.from({ length: result.won ? 28 : 14 }).map((_, index) => (
                  <motion.span
                    key={index}
                    className={cn("absolute rounded-full", style.particle)}
                    style={{ left: `${6 + (index * 37) % 88}%`, top: `${8 + (index * 19) % 78}%`, width: index % 3 === 0 ? 6 : 4, height: index % 3 === 0 ? 6 : 4 }}
                    animate={{ y: [0, -16, 0], opacity: [0.15, 0.85, 0.15], scale: [1, 1.7, 1] }}
                    transition={{ duration: 2 + (index % 6) * 0.25, repeat: Infinity, ease: "easeInOut" }}
                  />
                ))}
                <div className={cn("relative z-10 w-24 h-24 mx-auto mb-6 rounded-full grid place-items-center", result.won ? `${style.badge} text-black` : "bg-red-500/10 text-red-200 border border-red-300/20")}>
                  {result.won ? <BoxIcon className="w-12 h-12" /> : <XCircle className="w-10 h-10" />}
                </div>

                <p className={cn("relative z-10 text-xs font-mono uppercase tracking-[0.35em] mb-3", result.won ? style.text : "text-red-200")}>
                  {result.won ? `Raridade ${rarityLabels[rarity]}` : "Não foi dessa vez"}
                </p>

                <h3 className={cn("relative z-10 text-5xl md:text-6xl font-display font-black uppercase tracking-tight mb-5", result.won ? "!text-amber-300 drop-shadow-[0_0_22px_rgba(245,158,11,0.85)]" : "!text-white")}>
                  {result.won ? "PARABÉNS, VOCÊ GANHOU:" : "NÃO FOI DESSA VEZ"}
                </h3>

                {result.won ? (
                  <div className="relative z-10 inline-block rounded-2xl border border-amber-300/30 bg-black/35 px-7 py-4 mb-8">
                    <p className="text-xs font-mono uppercase tracking-[0.25em] text-amber-100/70">Prêmio ganho</p>
                    <p className="text-3xl font-bold !text-white mt-1">{result.prize?.name}</p>
                    {typeof result.prize?.value === "number" && <p className="text-amber-200 mt-1">Valor: R$ {result.prize.value.toFixed(2).replace(".", ",")}</p>}
                  </div>
                ) : (
                  <div className="relative z-10 max-w-md mx-auto mb-8">
                    <p className="!text-slate-200">Tente de novo.</p>
                    {result.nearMiss && (
                      <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 px-5 py-4">
                        <p className="text-xs font-mono uppercase tracking-[0.2em] text-red-200/70">Prêmio disponível nesta ação</p>
                        <p className="text-xl font-bold !text-white mt-1">{result.nearMiss.name}</p>
                        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                          <motion.div className="h-full bg-gradient-to-r from-red-400 via-amber-300 to-white" initial={{ width: "0%" }} animate={{ width: "94%" }} transition={{ duration: 1.1, ease: "easeOut" }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={continueFlow}
                  className={cn("relative z-10 w-full rounded-xl py-4 font-display font-bold uppercase tracking-widest transition-all", result.won ? "!bg-amber-300 !text-black hover:!bg-amber-200" : "!bg-white/10 !text-white hover:!bg-white/15 border border-white/15")}
                >
                  {remaining > 0 ? `${experienceType === "wheel" ? "Girar novamente" : "Abrir próxima"} (${remaining})` : "Voltar aos sorteios"}
                </button>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
