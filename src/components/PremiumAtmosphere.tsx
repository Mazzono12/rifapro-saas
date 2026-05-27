import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

export function PremiumAtmosphere() {
  const [enabled, setEnabled] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const smoothX = useSpring(x, { stiffness: 80, damping: 22, mass: 0.4 });
  const smoothY = useSpring(y, { stiffness: 80, damping: 22, mass: 0.4 });

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    setEnabled(finePointer);

    const onMove = (event: PointerEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
      document.documentElement.style.setProperty("--cursor-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--cursor-y", `${event.clientY}px`);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [x, y]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 premium-grid opacity-70" />
      <motion.div
        className="absolute -top-36 left-[8%] h-80 w-80 rounded-full blur-[120px]"
        style={{ background: "var(--theme-glow)" }}
        animate={{ y: [0, 28, 0], x: [0, 18, 0], opacity: [0.45, 0.75, 0.45] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[10%] right-[6%] h-96 w-96 rounded-full blur-[135px]"
        style={{ background: "var(--theme-glow-2)" }}
        animate={{ y: [0, -24, 0], x: [0, -20, 0], opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-[42%] top-[28%] h-72 w-72 rounded-full blur-[100px]"
        style={{ background: "color-mix(in srgb, var(--theme-primary) 18%, transparent)" }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      {enabled && (
        <motion.div
          className="absolute h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[54px] mix-blend-screen"
          style={{ left: smoothX, top: smoothY, background: "var(--theme-glow-2)" }}
        />
      )}
    </div>
  );
}
