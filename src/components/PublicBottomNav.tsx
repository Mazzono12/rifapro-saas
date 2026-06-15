import { Link, useLocation } from "react-router-dom";
import { Bell, Gift, Home, Trophy, User } from "lucide-react";

export function PublicBottomNav({ hidden = false }: { hidden?: boolean }) {
  const location = useLocation();

  if (hidden) return null;

  const items = [
    { label: "Início", to: "/", icon: Home, active: location.pathname === "/" && !location.hash },
    { label: "Sorteios", to: "/sorteios", icon: Gift, active: location.pathname.startsWith("/raffle") || location.pathname === "/sorteios" },
    { label: "Ganhadores", to: "/ganhadores", icon: Trophy, active: location.pathname === "/ganhadores" || location.hash === "#ganhadores" },
    { label: "Perfil", to: "/perfil", icon: User, badgeIcon: Bell, active: location.pathname === "/perfil" }
  ];

  return (
    <nav className="public-mobile-bottom-nav fixed inset-x-3 bottom-3 z-50 rounded-[20px] border border-white/10 bg-[#141417]/92 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:hidden" aria-label="Menu inferior">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(item => {
          const Icon = item.icon;
          const BadgeIcon = item.badgeIcon;
          const className = `relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-black transition ${item.active ? "border border-violet-300/35 bg-violet-500/20 text-violet-100 shadow-[0_10px_30px_rgba(168,85,247,0.28)]" : "text-[#A1A1AA] hover:bg-white/5 hover:text-white"}`;
          return (
            <Link key={item.label} to={item.to} className={className}>
              <Icon className="h-5 w-5" />
              {BadgeIcon && <BadgeIcon className="absolute right-4 top-2 h-3.5 w-3.5 text-amber-300" />}
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
