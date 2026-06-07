import { motion, AnimatePresence } from 'motion/react';
import { Trophy, CheckCircle2, X, Star } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import type { InstantPrize } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  numeros: number[];
  premiosInstantaneos?: InstantPrize[];
}

export function NumberRevealModal({ isOpen, onClose, numeros, premiosInstantaneos = [] }: Props) {
  const [revealed, setRevealed] = useState<number[]>([]);
  const hasPremios = premiosInstantaneos.length > 0;

  // Sequential reveal animation
  useEffect(() => {
    if (isOpen && numeros.length > 0) {
      setRevealed([]);
      numeros.forEach((num, index) => {
        setTimeout(() => {
          setRevealed(prev => [...prev, num]);
        }, index * 200 + 500); // 500ms initial delay, then 200ms per number
      });
    }
  }, [isOpen, numeros]);

  useEffect(() => {
    if (!isOpen || !hasPremios) return;
    confetti({
      particleCount: 120,
      spread: 72,
      origin: { y: 0.62 },
      colors: ['#22C55E', '#FACC15', '#FFFFFF']
    });
  }, [isOpen, hasPremios]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-cyber-900/90 backdrop-blur-xl"
            onClick={onClose}
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="glass-card w-full max-w-3xl p-6 md:p-10 relative z-10 border-neon-cyan/30 overflow-hidden"
          >
             {/* Glows */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-neon-cyan/10 blur-[80px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-neon-purple/10 blur-[80px] rounded-full pointer-events-none" />

            {hasPremios && (
               <div className="absolute inset-0 pointer-events-none">
                  {/* Confetti-like or glowing effect container for winners */}
               </div>
            )}

            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors z-20"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center relative z-10 mb-8">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border shadow-lg",
                  hasPremios ? "bg-amber-400/20 border-amber-400/50 shadow-amber-400/30" : "bg-neon-cyan/20 border-neon-cyan/50 shadow-neon-cyan/30"
                )}
              >
                {hasPremios ? (
                  <Star className="w-10 h-10 text-amber-400 fill-amber-400 animate-pulse" />
                ) : (
                  <Trophy className="w-10 h-10 text-neon-cyan" />
                )}
              </motion.div>
              <h2 className={cn("text-3xl font-display font-bold mb-2", hasPremios ? "text-amber-400" : "text-white")}>
                {hasPremios ? "SUPER COTA ENCONTRADA!" : "Transação Aprovada!"}
              </h2>
              <p className="text-slate-400 font-mono text-sm max-w-md mx-auto">
                {hasPremios 
                  ? `Você acabou de encontrar ${premiosInstantaneos.length} Super Cota(s)!` 
                  : "Seus hashes foram gerados e garantidos pelo nosso protocolo."}
              </p>
            </div>

            <div className="relative z-10 min-h-[200px] max-h-[40vh] overflow-y-auto custom-scrollbar p-2">
               <div className="flex flex-wrap gap-3 justify-center">
                 {numeros.map((num, i) => {
                   const isRevealed = revealed.includes(num);
                   const isWinningNumber = premiosInstantaneos.some(p => p.numeroPremiado === num);

                   return (
                     <motion.div
                       key={i}
                       layout
                       initial={{ opacity: 0, scale: 0.5, rotateX: 90 }}
                       animate={isRevealed ? { opacity: 1, scale: 1, rotateX: 0 } : { opacity: 0, scale: 0.5, rotateX: 90 }}
                       transition={{ type: "spring", stiffness: 200, damping: isWinningNumber ? 10 : 15 }}
                       className={cn(
                         "border font-mono font-bold text-xl py-3 px-5 rounded-xl relative overflow-hidden group",
                         isWinningNumber 
                           ? "bg-amber-500/10 border-amber-400/80 text-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)] scale-110 z-10" 
                           : "bg-cyber-800 border-neon-cyan/40 text-neon-cyan shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                       )}
                     >
                        {/* Shimmer */}
                       <div className="absolute inset-0 w-full h-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.1)_50%,transparent_100%)] bg-[length:200%_100%] animate-[shimmer_2s_infinite] pointer-events-none" />
                       
                       {isWinningNumber && (
                         <div className="absolute -top-1 -right-1 text-[10px] bg-amber-400 text-black px-1 rounded-bl">WIN</div>
                       )}
                       
                       {String(num).padStart(6, '0')}
                     </motion.div>
                   );
                 })}
               </div>
            </div>

            {hasPremios && (
               <div className="mt-8 text-center bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                 <p className="text-amber-400 font-bold mb-2">Total Ganho: {premiosInstantaneos.reduce((acc, p) => acc + p.valorPremio, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                 <div className="mb-2 flex flex-wrap justify-center gap-2 text-xs text-amber-100">
                   {premiosInstantaneos.map(prize => (
                     <span key={prize.id} className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1">
                       Super Cota {String(prize.numeroPremiado).padStart(6, '0')} · {prize.valorPremio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                     </span>
                   ))}
                 </div>
                 <p className="text-slate-300 text-sm">Nossa equipe entrará em contato para realizar o pagamento.</p>
               </div>
            )}

            <div className="mt-10 relative z-10 text-center">
              <button 
                onClick={onClose}
                className="neon-button py-3 px-8 rounded-full font-mono text-sm tracking-widest uppercase hover:scale-105 transition-transform"
              >
                Acessar Minhas Compras
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
