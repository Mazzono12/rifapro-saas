import { useEffect } from "react";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "motion/react";

type PaymentResult = "approved" | "rejected" | null;

export function PixPaymentResultModal({ result, onClose }: { result: PaymentResult; onClose: () => void }) {
  useEffect(() => {
    if (result !== "approved") return;
    confetti({ particleCount: 180, spread: 90, origin: { y: 0.7 }, colors: ["#22d3ee", "#facc15", "#ffffff", "#34d399"] });
    const timeout = window.setTimeout(onClose, 2600);
    return () => window.clearTimeout(timeout);
  }, [result, onClose]);

  useEffect(() => {
    if (result !== "rejected") return;
    const timeout = window.setTimeout(onClose, 2200);
    return () => window.clearTimeout(timeout);
  }, [result, onClose]);

  return (
    <AnimatePresence>
      {result && (
        <motion.div
          className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.86, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.86, y: 24 }}
            className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-black p-10 text-center shadow-[0_0_90px_rgba(34,211,238,0.22)]"
          >
            <h1 className="font-display text-4xl font-black uppercase tracking-widest text-white md:text-6xl">
              {result === "approved" ? "PARABÉNS" : "TENTE DE NOVO"}
            </h1>
            {result === "approved" && (
              <p className="mt-5 font-display text-2xl font-black uppercase tracking-widest text-emerald-200 md:text-3xl">
                BOA SORTE COMPRA APROVADA
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
