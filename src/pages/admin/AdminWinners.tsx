import React, { useEffect, useState } from "react";
import { Plus, Trash2, X, Check, Trophy } from "lucide-react";
import type { Winner } from "../../types";

import { ResponsiveMediaFrame } from "../../components/ResponsiveMediaFrame";
import { inferMediaType } from "../../utils/media";
import { MediaPicker } from "../../components/admin/MediaPicker";

export function AdminWinners() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [current, setCurrent] = useState<Partial<Winner>>({});

  const loadWinners = () => {
    fetch("/api/winners")
      .then(res => res.json())
      .then(setWinners);
  };

  useEffect(() => {
    loadWinners();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/admin/winners", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...current,
        mediaType: current.mediaUrl ? inferMediaType(current.mediaUrl) : current.mediaType,
        date: new Date().toISOString(),
      })
    });
    
    setIsEditing(false);
    setCurrent({});
    loadWinners();
  };

  return (
    <div className="space-y-6 fade-in">
       <div className="flex justify-between items-center">
         <div>
            <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
               <Trophy className="w-8 h-8 text-emerald-400" /> Galeria de Ganhadores
            </h1>
         </div>
         <button 
           onClick={() => { setCurrent({}); setIsEditing(true); }}
           className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 px-4 py-2 rounded-lg font-mono text-xs tracking-wider flex items-center gap-2 transition-colors"
         >
           <Plus className="w-4 h-4" /> Novo Ganhador
         </button>
       </div>

       {isEditing ? (
         <div className="glass-card p-6 rounded-2xl border border-emerald-500/30">
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
               <h2 className="text-xl font-bold">Adicionar Ganhador</h2>
               <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Nome do Ganhador</label>
                    <input required type="text" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-emerald-500/50" 
                           value={current.winnerName || ''} onChange={e => setCurrent({...current, winnerName: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Nome da Rifa</label>
                    <input required type="text" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-emerald-500/50" 
                           value={current.raffleName || ''} onChange={e => setCurrent({...current, raffleName: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Descrição Curta (ex: Levou com 2 cotas)</label>
                    <input required type="text" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-emerald-500/50" 
                           value={current.prizeDescription || ''} onChange={e => setCurrent({...current, prizeDescription: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <MediaPicker
                      label="Mídia do ganhador"
                      mediaUsage="winner"
                      value={current.mediaUrl || ""}
                      mediaType={current.mediaType}
                      required
                      onChange={(mediaUrl, mediaType) => setCurrent({ ...current, mediaUrl, mediaType: mediaType as any })}
                    />
                  </div>
               </div>
               
               <div className="flex justify-end pt-4">
                 <button type="submit" className="bg-emerald-400 text-black px-6 py-3 rounded-lg font-bold font-mono tracking-wider flex items-center gap-2 hover:bg-white transition-colors">
                    <Check className="w-5 h-5" /> Adicionar à Galeria
                 </button>
               </div>
            </form>
         </div>
       ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {winners.map(w => (
               <div key={w.id} className="glass-card rounded-xl border border-white/5 overflow-hidden group">
                  <div className="aspect-[4/3] bg-cyber-900 relative">
                     <ResponsiveMediaFrame src={w.mediaUrl} type={w.mediaType || "image"} alt={w.winnerName} preferredFit="auto" aspectMode="auto" className="h-full w-full rounded-none" autoPlay />
                     <button onClick={async () => { await fetch(`/api/admin/winners/${w.id}`, {method: 'DELETE'}); loadWinners(); }} className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-red-500 rounded-lg text-white backdrop-blur transition-colors opacity-0 group-hover:opacity-100 z-10">
                        <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
                  <div className="p-4">
                     <h3 className="font-bold text-lg text-white">{w.winnerName}</h3>
                     <p className="text-neon-cyan font-mono text-xs uppercase tracking-wider mb-2">{w.raffleName}</p>
                     <p className="text-slate-400 text-sm line-clamp-2">{w.prizeDescription}</p>
                  </div>
               </div>
            ))}
         </div>
       )}
    </div>
  );
}
