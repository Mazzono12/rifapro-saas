import React, { useEffect, useState } from 'react';
import { Trophy, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import { MediaRenderer } from './MediaRenderer';
import type { Winner } from '../types';

export function WinnersGallery() {
  const [winners, setWinners] = useState<Winner[]>([]);

  useEffect(() => {
    fetch('/api/winners').then(res => res.json()).then(setWinners);
  }, []);

  if (winners.length === 0) return null;

  return (
    <div className="w-full relative">
       <motion.div 
         initial={{ opacity: 0, y: 20 }}
         whileInView={{ opacity: 1, y: 0 }}
         viewport={{ once: true }}
         transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
         className="text-center mb-16"
       >
         <h2 className="text-3xl lg:text-5xl font-display font-bold text-white mb-4">Galeria de Ganhadores</h2>
         <p className="text-slate-400 font-mono text-sm uppercase tracking-widest max-w-lg mx-auto">
           Transparência materializada.
         </p>
       </motion.div>

       <div className="flex gap-5 overflow-x-auto overflow-y-hidden pb-4 pr-4 snap-x snap-mandatory scroll-smooth md:gap-8">
         {winners.map((winner, idx) => (
           <motion.div 
             key={winner.id} 
             initial={{ opacity: 0, y: 30 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true, margin: "-100px" }}
             transition={{ duration: 0.8, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
             className="glass-card group w-[82vw] min-w-[82vw] max-w-[360px] shrink-0 snap-start sm:w-[360px] sm:min-w-[360px] lg:w-[380px] lg:min-w-[380px]"
           >
             <div className="aspect-[4/3] w-full relative border-b border-white/[0.05] overflow-hidden">
                <MediaRenderer 
                   mediaUrl={winner.mediaUrl} 
                   mediaType={winner.mediaType} 
                   className="absolute inset-0 w-full h-full cursor-pointer object-cover transform duration-1000 ease-out group-hover:scale-110" 
                   autoPlay={false}
                   muted={false}
                   interactive={true}
                />
             </div>
             <div className="p-8 relative">
                <div className="absolute -top-10 right-8 w-14 h-14 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center shadow-2xl z-10">
                   <Trophy className="w-6 h-6 text-yellow-400" />
                </div>
                
                <h3 className="text-2xl font-display font-bold text-white mb-1 pr-16 truncate">{winner.winnerName}</h3>
                <p className="text-slate-400 font-mono text-xs uppercase tracking-wider mb-6 truncate">{winner.raffleName}</p>
                
                <p className="text-slate-300 text-sm mb-8 line-clamp-2 leading-relaxed">
                  {winner.prizeDescription}
                </p>

                <div className="flex items-center gap-2 text-slate-500 font-mono text-xs border-t border-white/5 pt-4">
                   <Calendar className="w-4 h-4" />
                   {new Date(winner.date).toLocaleDateString('pt-BR')}
                </div>
             </div>
           </motion.div>
         ))}
       </div>
    </div>
  );
}
