import { motion } from "motion/react";
import { ChevronRight, Play } from "lucide-react";

export function CinematicHero() {
  const scrollToContent = () => {
    window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
  };

  return (
    <section className="relative w-full h-screen overflow-hidden bg-black flex items-center justify-center">
      
      {/* Background Video Container */}
      <div className="absolute inset-0 w-full h-full">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-60"
          poster="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=2000"
        >
          {/* High quality elegant abstract video */}
          <source src="https://player.vimeo.com/external/494252666.hd.mp4?s=d00161474e2a6d595166418d1f7bc6da91efecdd&profile_id=175" type="video/mp4" />
        </video>
      </div>

      {/* Dark semi-transparent overlay with slight blur */}
      <div className="absolute inset-0 bg-cyber-900/40 backdrop-blur-[2px]" />
      
      {/* Vignette effect for premium depth */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(11,11,18,0.8)_100%)] pointer-events-none" />

      {/* Bottom gradient blending into the cyber-900 background of the rest of the page */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-cyber-900 via-cyber-900/80 to-transparent pointer-events-none" />

      {/* Centered Content */}
      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto flex flex-col items-center mt-16 selection:bg-white/20">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
           className="mb-8 inline-flex items-center gap-3 px-5 py-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-3xl text-[10px] font-mono font-bold text-white uppercase tracking-[0.3em] shadow-2xl"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-[pulse_2s_ease-in-out_infinite]" />
          A nova era dos sorteios
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl lg:text-[7rem] font-display font-medium text-white tracking-tighter leading-[0.95] mb-8"
        >
          Premium. <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">Transparente.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 font-sans tracking-wide leading-relaxed font-light"
        >
          O ambiente definitivo para participar de campanhas exclusivas. <br className="hidden md:block" />
          Auditoria completa e sorteios gerados com precisão impecável.
        </motion.p>
        
        <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
           className="flex flex-col sm:flex-row gap-6 items-center justify-center w-full sm:w-auto"
        >
          <button 
            onClick={scrollToContent} 
            className="group w-full sm:w-auto px-8 py-4 bg-white text-black rounded-full hover:bg-slate-200 transition-all duration-500 flex items-center justify-center gap-2 font-mono uppercase tracking-widest text-[11px] font-bold shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)] hover:-translate-y-0.5"
          >
            Explorar Prêmios 
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button className="group w-full sm:w-auto px-8 py-4 bg-white/[0.03] text-white border border-white/10 rounded-full hover:bg-white/10 hover:border-white/20 transition-all duration-500 flex items-center justify-center gap-2 font-mono uppercase tracking-widest text-[11px] font-bold backdrop-blur-xl hover:-translate-y-0.5">
            <Play className="w-3.5 h-3.5 fill-white" /> Como Funciona
          </button>
        </motion.div>
      </div>
    </section>
  )
}
