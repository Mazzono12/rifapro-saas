import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Hash, Trophy } from "lucide-react";
import { useModalidades } from "../hooks/useRaffles";
import { DynamicMedia } from "./DynamicMedia";

export function ModalidadesSection() {
  const { data } = useModalidades();
  if (!data) return null;

  const banners = data.numberModes
    .filter(mode => mode.enabled && mode.status === "active")
    .map(mode => ({
      id: mode.id,
      title: mode.name,
      description: mode.description,
      href: `/${mode.id}`,
      mediaUrl: mode.mediaUrl,
      mediaType: mode.mediaType,
      price: mode.price,
      prize: mode.prize,
      drawDate: mode.drawDate,
      ranking: mode.ranking || []
    }));

  if (!banners.length) return null;

  return (
    <section className="space-y-5">
      {banners.map((banner, index) => (
        <motion.article
          key={banner.id}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08 }}
          className="glass-card group relative overflow-hidden border border-white/10"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(6,182,212,0.16),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(168,85,247,0.14),transparent_38%)]" />
          <div className="relative z-10 grid gap-6 p-5 md:p-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="relative min-h-56 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
              <DynamicMedia
                mediaUrl={banner.mediaUrl}
                mediaType={banner.mediaType}
                autoPlay={true}
                muted={false}
                interactive={true}
                className="h-full min-h-56 w-full object-cover transition-transform duration-700 group-hover:scale-105"
                fallback={<div className="grid h-56 place-items-center bg-gradient-to-br from-neon-cyan/20 via-neon-purple/10 to-fuchsia-300/20"><Hash className="h-14 w-14 text-white/70" /></div>}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <span className="pointer-events-none absolute left-4 top-4 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-emerald-200">
                Ativo
              </span>
            </div>

            <div>
              <p className="text-xs font-mono uppercase tracking-[0.28em] text-neon-cyan">Jogo ativo</p>
              <h2 className="mt-3 font-display text-4xl font-black text-white md:text-5xl">{banner.title}</h2>
              <p className="mt-4 max-w-2xl text-slate-300">{banner.description}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Info icon={Hash} label="Cota" value={`R$ ${banner.price.toFixed(2).replace(".", ",")}`} />
                <Info icon={Trophy} label="Prêmio" value={banner.prize} />
                <Info label="Ranking" value={banner.ranking.length ? `${banner.ranking.length} compradores` : "Em formação"} />
              </div>

              <Link to={banner.href} className="neon-button mt-6 inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 font-mono text-sm uppercase tracking-widest">
                Participar <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </motion.article>
      ))}
    </section>
  );
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Hash }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5 text-neon-cyan" />} {label}
      </p>
      <p className="mt-1 truncate font-display text-lg font-bold text-white">{value}</p>
    </div>
  );
}
