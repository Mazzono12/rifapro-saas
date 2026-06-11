import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Gift, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { ResponsiveMediaFrame } from './ResponsiveMediaFrame';
import type { Winner } from '../types';

function normalizeWinners(payload: unknown): Winner[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((winner): winner is Partial<Winner> => Boolean(winner && typeof winner === "object"))
    .filter(winner => Boolean(String(winner.winnerName || "").trim()))
    .map(winner => ({
      id: String(winner.id || `winner-${String(winner.winnerName).trim()}-${String(winner.prizeDescription || "").trim()}`),
      raffleName: String(winner.raffleName || "").trim(),
      winnerName: String(winner.winnerName || "").trim(),
      prizeDescription: String(winner.prizeDescription || "").trim(),
      mediaUrl: String(winner.mediaUrl || ""),
      mediaType: winner.mediaType || "image",
      date: winner.date || "",
      sourceType: String(winner.sourceType || "").trim(),
      status: String(winner.status || "Confirmado").trim()
    } as Winner));
}

function formatWinnerDate(date: string) {
  const parsed = date ? new Date(date) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "Data a definir";
  return parsed.toLocaleDateString('pt-BR');
}

export function WinnersGallery({ showEmpty = false }: { showEmpty?: boolean }) {
  const [winners, setWinners] = useState<Winner[]>([]);

  useEffect(() => {
    fetch('/api/winners')
      .then(res => res.ok ? res.json() : [])
      .then(payload => setWinners(normalizeWinners(payload)))
      .catch(() => setWinners([]));
  }, []);

  if (winners.length === 0) {
    if (!showEmpty) return null;
    return (
      <section className="cfx-winners-page-gallery">
        <div className="cfx-winner-empty">
          <Trophy className="h-10 w-10" />
          <p>Os ganhadores aparecerão aqui assim que forem confirmados.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="cfx-winners-page-gallery w-full relative">
       <motion.div 
         initial={{ opacity: 0, y: 20 }}
         whileInView={{ opacity: 1, y: 0 }}
         viewport={{ once: true }}
         transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
         className="cfx-winners-gallery-heading text-center mb-8"
       >
         <h2>Ganhadores confirmados</h2>
         <p>Pessoas reais. Prêmios reais. Transparência em cada entrega.</p>
       </motion.div>

       <div className="cfx-winners-grid">
         {winners.map((winner, idx) => (
           <motion.div 
             key={winner.id} 
             initial={{ opacity: 0, y: 30 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true, margin: "-100px" }}
             transition={{ duration: 0.8, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
             className="cfx-winner-card group"
           >
             <div className="cfx-winner-media">
                {winner.mediaUrl ? (
                  <ResponsiveMediaFrame
                     src={winner.mediaUrl}
                     type={winner.mediaType}
                     alt={winner.winnerName}
                     className="absolute inset-0 h-full w-full cursor-pointer rounded-none"
                     mediaClassName="transform duration-1000 ease-out group-hover:scale-105"
                     preferredFit="auto"
                     aspectMode="portrait"
                     autoPlay={false}
                     muted={false}
                     controls
                  />
                ) : (
                  <div className="cfx-winner-media-placeholder">
                    <Trophy className="h-11 w-11" />
                  </div>
                )}
                <span className="cfx-winner-source">{winner.sourceType || "Sorteio"}</span>
                <div className="cfx-winner-play">
                  <Trophy className="h-5 w-5" />
                </div>
             </div>
             <div className="cfx-winner-body">
                <h3>{winner.winnerName}</h3>
                {winner.raffleName && <p className="cfx-winner-campaign">{winner.raffleName}</p>}
                {winner.prizeDescription && (
                  <p className="cfx-winner-prize"><Gift className="h-4 w-4" /> {winner.prizeDescription}</p>
                )}

                <div className="cfx-winner-meta">
                   <Calendar className="w-4 h-4" />
                   {formatWinnerDate(winner.date)}
                </div>
                <span className="cfx-winner-status"><CheckCircle2 className="h-4 w-4" /> {winner.status || "Confirmado"}</span>
             </div>
           </motion.div>
         ))}
       </div>
    </section>
  );
}
