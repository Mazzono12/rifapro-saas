import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Activity, Users, DollarSign, ArrowLeft, Database, Hexagon } from "lucide-react";
import { cn } from "../lib/utils";

export function Admin() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="flex-1 flex justify-center py-32">
      <div className="w-12 h-12 rounded-full border-2 border-neon-purple/20 border-t-neon-purple animate-spin" />
    </div>
  );
  
  const statCards = [
    { label: "VOLUME TRANSACIONADO", value: `R$ ${stats.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}`, icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" },
    { label: "BLOCOS ATIVOS", value: stats.totalRaffles, icon: Database, color: "text-neon-cyan", bg: "bg-neon-cyan/10", border: "border-neon-cyan/30" },
    { label: "TRANSAÇÕES", value: stats.totalPurchases || 120, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
    { label: "TAXA DE SUCESSO", value: "94.8%", icon: Activity, color: "text-neon-purple", bg: "bg-neon-purple/10", border: "border-neon-purple/30" },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-neon-cyan mb-8 font-medium transition-colors">
        <ArrowLeft className="w-4 h-4" /> Desconectar Terminal
      </Link>
      
      <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-white flex items-center gap-3">
            <Hexagon className="w-8 h-8 text-neon-purple" />
            NEXUS Admin
          </h1>
          <p className="text-slate-400 mt-2 font-mono text-sm uppercase tracking-widest">Acesso de Nível 5 Concedido</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {statCards.map((card, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={cn("glass-card p-6 border group hover:bg-cyber-800/80 transition-all", card.border)}
          >
            <div className="flex items-center gap-4 mb-5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.bg} ${card.color}`}>
                <card.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xs font-mono font-bold text-slate-400 tracking-wider w-min">{card.label}</h3>
            </div>
            <p className="text-3xl font-display font-bold text-white group-hover:neon-text transition-colors">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
         <div className="p-6 border-b border-white/5">
           <h2 className="text-xl font-bold font-display flex items-center gap-2">
             <Activity className="w-5 h-5 text-neon-cyan" /> LOG DE TRANSAÇÕES
           </h2>
         </div>
         <div className="overflow-x-auto">
           <table className="w-full text-left border-collapse whitespace-nowrap">
             <thead>
               <tr className="bg-cyber-900/50 text-xs font-mono text-slate-400 tracking-wider">
                 <th className="font-semibold py-4 px-6 border-b border-white/5">HASH</th>
                 <th className="font-semibold py-4 px-6 border-b border-white/5">ORIGEM</th>
                 <th className="font-semibold py-4 px-6 border-b border-white/5 text-center">STATUS REDE</th>
                 <th className="font-semibold py-4 px-6 border-b border-white/5 text-right">VOLUME</th>
               </tr>
             </thead>
             <tbody className="font-mono text-sm">
               {[
                 { id: "X8K9M", client: "NODE: 11-99823-1122", status: "LIQUIDADO", val: "R$ 5,00", type: "success" },
                 { id: "P2N1Z", client: "NODE: 22-99122-8811", status: "PENDENTE MEMPOOL", val: "R$ 10,00", type: "pending" },
                 { id: "A1B2C", client: "NODE: 11-98833-2211", status: "LIQUIDADO", val: "R$ 50,00", type: "success" },
                 { id: "F9R4L", client: "NODE: 11-98000-0001", status: "FALHA PROTOCOLO", val: "R$ 2,50", type: "error" },
               ].map((row, i) => (
                 <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                   <td className="py-4 px-6 text-neon-cyan">{row.id}</td>
                   <td className="py-4 px-6 text-slate-300">{row.client}</td>
                   <td className="py-4 px-6 text-center">
                     <span className={cn(
                       "text-[10px] px-3 py-1 font-bold rounded-sm tracking-widest",
                       row.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                       row.type === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 
                       'bg-red-500/10 text-red-500 border border-red-500/20'
                     )}>
                       {row.status}
                     </span>
                   </td>
                   <td className="py-4 px-6 text-right font-bold text-white">{row.val}</td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
}
