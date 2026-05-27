import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, X, Check, Star } from "lucide-react";
import type { InstantPrize, Raffle } from "../../types";

export function AdminInstantPrizes() {
  const [prizes, setPrizes] = useState<InstantPrize[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [selectedRaffleId, setSelectedRaffleId] = useState("all");
  const [isEditing, setIsEditing] = useState(false);
  const [currentPrize, setCurrentPrize] = useState<Partial<InstantPrize>>({});

  const loadPrizes = () => {
    fetch("/api/admin/instant-prizes")
      .then(res => res.json())
      .then(setPrizes);
  };

  useEffect(() => {
    loadPrizes();
    fetch("/api/raffles").then(res => res.json()).then((data: Raffle[]) => {
      setRaffles(data);
      if (data[0]) setSelectedRaffleId(data[0].id);
    }).catch(() => null);
  }, []);

  const filteredPrizes = selectedRaffleId === "all"
    ? prizes
    : prizes.filter(prize => prize.raffleId === selectedRaffleId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = currentPrize.id ? "PUT" : "POST";
    const url = currentPrize.id ? `/api/admin/instant-prizes/${currentPrize.id}` : "/api/admin/instant-prizes";
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentPrize)
    });
    
    setIsEditing(false);
    setCurrentPrize({});
    loadPrizes();
  };

  return (
    <div className="space-y-6 fade-in">
       <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
         <div>
            <h1 className="text-3xl font-display font-bold text-[var(--admin-text)] flex items-center gap-3">
               <Star className="w-8 h-8" /> Cotas Premiadas
            </h1>
            <p className="text-[var(--admin-muted)] font-mono text-sm tracking-widest uppercase mt-1">Cada sorteio possui sua própria lista de cotas premiadas.</p>
         </div>
         <div className="flex flex-wrap gap-2">
           <select value={selectedRaffleId} onChange={e => setSelectedRaffleId(e.target.value)} className="admin-input px-3 py-2">
             <option value="all">Todos os sorteios</option>
             {raffles.map(raffle => <option key={raffle.id} value={raffle.id}>{raffle.title}</option>)}
           </select>
           <button
             onClick={() => { setCurrentPrize({ raffleId: selectedRaffleId === "all" ? raffles[0]?.id : selectedRaffleId }); setIsEditing(true); }}
             className="admin-button"
           >
             <Plus className="w-4 h-4" /> Nova cota premiada
           </button>
         </div>
       </div>

       {isEditing ? (
         <div className="admin-card p-6 rounded-2xl border border-amber-400/30">
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
               <h2 className="text-xl font-bold">{currentPrize.id ? 'Editar Prêmio' : 'Criar Novo Prêmio'}</h2>
               <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Sorteio</label>
                    <select required className="w-full rounded-lg p-3"
                           value={currentPrize.raffleId || ''} onChange={e => setCurrentPrize({...currentPrize, raffleId: e.target.value})}>
                      <option value="">Selecione</option>
                      {raffles.map(raffle => <option key={raffle.id} value={raffle.id}>{raffle.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Número Premiado</label>
                    <input required type="number" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-amber-400/50" 
                           value={currentPrize.numeroPremiado || ''} onChange={e => setCurrentPrize({...currentPrize, numeroPremiado: parseInt(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Valor do Prêmio (R$)</label>
                    <input required type="number" step="0.01" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-amber-400/50" 
                           value={currentPrize.valorPremio || ''} onChange={e => setCurrentPrize({...currentPrize, valorPremio: parseFloat(e.target.value)})} />
                  </div>
               </div>
               
               <div className="flex justify-end pt-4">
                 <button type="submit" className="bg-amber-400 text-black px-6 py-3 rounded-lg font-bold font-mono tracking-wider flex items-center gap-2 hover:bg-white transition-colors">
                    <Check className="w-5 h-5" /> Salvar Prêmio
                 </button>
               </div>
            </form>
         </div>
       ) : (
         <div className="admin-card overflow-hidden">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-cyber-900/50 text-xs font-mono text-slate-400 tracking-wider">
                  <th className="font-semibold py-4 px-6 border-b border-white/5">RIFA ID</th>
                  <th className="font-semibold py-4 px-6 border-b border-white/5">NÚMERO</th>
                  <th className="font-semibold py-4 px-6 border-b border-white/5">VALOR</th>
                  <th className="font-semibold py-4 px-6 border-b border-white/5 text-center">STATUS</th>
                  <th className="font-semibold py-4 px-6 border-b border-white/5 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="font-mono text-sm">
                 {filteredPrizes.map((p, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                       <td className="py-4 px-6 text-slate-400">{raffles.find(raffle => raffle.id === p.raffleId)?.title || p.raffleId}</td>
                       <td className="py-4 px-6 text-amber-400 font-bold text-lg">{String(p.numeroPremiado).padStart(6, '0')}</td>
                       <td className="py-4 px-6 text-emerald-400 font-bold">{p.valorPremio.toLocaleString('pt-BR', {style: 'currency', currency:'BRL'})}</td>
                       <td className="py-4 px-6 text-center">
                         <span className={`text-[10px] px-3 py-1 font-bold rounded-sm tracking-widest ${p.status === 'available' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                           {p.status === 'available' ? 'DISPONÍVEL' : 'RESGATADO'}
                         </span>
                       </td>
                       <td className="py-4 px-6 text-right">
                          <button onClick={() => { setCurrentPrize(p); setIsEditing(true); }} className="p-2 hover:text-[var(--admin-primary)] text-slate-500 transition-colors"><Edit2 className="w-4 h-4 inline" /></button>
                          <button onClick={async () => { await fetch(`/api/admin/instant-prizes/${p.id}`, {method: 'DELETE'}); loadPrizes(); }} className="p-2 hover:text-red-500 text-slate-500 transition-colors"><Trash2 className="w-4 h-4 inline" /></button>
                       </td>
                    </tr>
                 ))}
              </tbody>
            </table>
         </div>
       )}
    </div>
  );
}
