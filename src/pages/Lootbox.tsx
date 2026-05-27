import React, { useState, useEffect } from "react";
import { Package, LockOpen, Sparkles, CreditCard, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

export function Lootbox() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLogged, setIsLogged] = useState(false);
  const [data, setData] = useState<any>(null);
  
  const [isOpening, setIsOpening] = useState(false);
  const [openedPrize, setOpenedPrize] = useState<any>(null);

  const fetchLootboxes = async (phone: string) => {
    try {
      const res = await fetch(`/api/lootboxes/${phone}`);
      const d = await res.json();
      setData(d);
    } catch (e) {
      toast.error("Erro ao carregar caixinhas");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 10) {
      toast.error("Digite um telefone válido");
      return;
    }
    await fetchLootboxes(phoneNumber.replace(/\D/g, ''));
    setIsLogged(true);
  };

  const openBox = async () => {
    if (!data || data.available <= 0 || isOpening) return;
    
    setIsOpening(true);
    setOpenedPrize(null);
    
    try {
      // Fetch the result
      const phone = phoneNumber.replace(/\D/g, '');
      const res = await fetch(`/api/lootboxes/${phone}/open`, { method: 'POST' });
      const responseData = await res.json();
      
      if (res.ok) {
        // Mock a suspenseful delay
        setTimeout(() => {
          setIsOpening(false);
          setOpenedPrize(responseData.prize);
          fetchLootboxes(phone);
        }, 3000);
      } else {
        toast.error(responseData.error);
        setIsOpening(false);
      }
    } catch (error) {
      toast.error("Erro ao abrir a caixinha");
      setIsOpening(false);
    }
  };

  if (!isLogged) {
    return (
      <div className="relative z-10 mx-auto w-full max-w-lg px-4 pb-10 pt-6 fade-in">
         <div className="glass-card p-10 border border-white/5 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-5">
               <Package className="w-40 h-40 text-yellow-400" />
            </div>
            
            <h1 className="text-3xl font-display font-medium text-white mb-2 relative z-10">Caixa Premiada</h1>
            <p className="text-slate-400 mb-10 text-sm leading-relaxed relative z-10">Acesse suas caixas misteriosas. Insira seu telefone para conferir se você ganhou cotas extras ou prêmios no PIX.</p>
            
            <form onSubmit={handleLogin} className="space-y-6 relative z-10">
               <div>
                  <label className="block text-xs font-mono font-medium text-slate-400 uppercase tracking-widest mb-2">Seu WhatsApp</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full"
                    required
                  />
               </div>
               <button type="submit" className="w-full neon-button py-4 rounded-xl text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                  Acessar <ChevronRight className="w-4 h-4" />
               </button>
            </form>
         </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-[70vh] w-full max-w-5xl flex-col items-center justify-center space-y-8 px-4 pb-8 pt-4">
      
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-5xl font-display font-medium text-white tracking-tight">Caixas Disponíveis</h1>
        <p className="text-slate-400 font-mono tracking-widest uppercase text-sm">Você tem <strong className="text-cyan-400">{data?.available || 0}</strong> caixas fechadas</p>
      </div>

      <div className="relative w-full max-w-sm aspect-square flex items-center justify-center perspective-1000">
         
         <AnimatePresence>
            {!isOpening && !openedPrize && (
               <motion.div 
                 initial={{ scale: 0.8, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1, y: [0, -10, 0] }}
                 exit={{ scale: 0.5, opacity: 0, rotateY: 180 }}
                 transition={{ y: { repeat: Infinity, duration: 4, ease: "easeInOut" }, duration: 0.5 }}
                 className="relative w-64 h-64 cursor-pointer group"
                 onClick={openBox}
               >
                 <div className="absolute inset-0 bg-white/20 blur-[60px] rounded-full group-hover:bg-cyan-400/30 transition-colors duration-500" />
                 <div className="absolute inset-0 glass-card rounded-3xl border border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.1)] flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.1)_0%,transparent_60%)]" />
                    <Package className="w-32 h-32 text-white/50 group-hover:text-white transition-colors duration-500 drop-shadow-2xl" strokeWidth={1} />
                 </div>
               </motion.div>
            )}
         </AnimatePresence>

         <AnimatePresence>
            {isOpening && (
               <motion.div
                 initial={{ scale: 0.5, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1, rotateZ: [0, -5, 5, -5, 5, 0] }}
                 exit={{ scale: 2, opacity: 0 }}
                 transition={{ rotateZ: { repeat: Infinity, duration: 0.2 }, duration: 0.4 }}
                 className="relative w-64 h-64 flex items-center justify-center"
               >
                 <div className="absolute inset-0 bg-yellow-400/40 blur-[80px] rounded-full" />
                 <LockOpen className="w-24 h-24 text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,1)]" />
               </motion.div>
            )}
         </AnimatePresence>

         <AnimatePresence>
            {openedPrize && !isOpening && (
               <motion.div
                 initial={{ scale: 0.5, opacity: 0, y: 50 }}
                 animate={{ scale: 1, opacity: 1, y: 0 }}
                 className="absolute inset-x-0 mx-auto w-full glass-card p-10 border border-yellow-400/30 rounded-[2.5rem] flex flex-col items-center text-center shadow-[0_0_80px_rgba(250,204,21,0.2)]"
               >
                 <Sparkles className="w-16 h-16 text-yellow-400 mb-6 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]" />
                 <p className="text-slate-400 font-mono text-xs uppercase tracking-[0.2em] mb-2">Você ganhou</p>
                 <h2 className="text-4xl font-display font-medium text-white mb-8">{openedPrize.name}</h2>
                 
                 <button 
                   onClick={() => setOpenedPrize(null)} 
                   className="w-full py-4 bg-white text-black font-bold font-mono tracking-widest text-xs uppercase rounded-xl hover:bg-slate-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                 >
                    Ir para próxima
                 </button>
               </motion.div>
            )}
         </AnimatePresence>

      </div>

      {data?.available > 0 && !isOpening && !openedPrize && (
        <button onClick={openBox} className="neon-button px-10 py-5 rounded-full text-xs font-bold font-mono uppercase tracking-[0.2em] shadow-[0_0_40px_rgba(255,255,255,0.15)] flex items-center gap-3">
          <LockOpen className="w-4 h-4" /> Abrir Caixa
        </button>
      )}

      {/* Histórico */}
      {data?.history?.length > 0 && (
         <div className="w-full max-w-2xl mt-24 glass-card p-8 group">
            <h3 className="text-lg font-display font-bold text-white mb-6 flex items-center gap-2"><CreditCard className="w-5 h-5 opacity-50" /> Histórico de Prêmios</h3>
            <div className="space-y-3">
               {data.history.slice().reverse().map((h: any, i: number) => (
                  <div key={i} className="flex justify-between items-center py-4 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] -mx-4 px-4 transition-colors rounded-xl">
                     <span className="font-medium text-white text-lg">{h.prize}</span>
                     <span className="text-xs font-mono text-slate-500">{new Date(h.date).toLocaleDateString('pt-BR')}</span>
                  </div>
               ))}
            </div>
         </div>
      )}

    </div>
  );
}
