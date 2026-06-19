import { Link, useLocation } from "react-router-dom";
import { Bell, Gift, Home, Ticket, Trophy } from "lucide-react";

export function PublicBottomNav({ hidden = false }: { hidden?: boolean }) {
  const location = useLocation();

  if (hidden) return null;

  const items = [
    { label: "Início", to: "/", icon: Home, iconColor: "text-[#38BDF8]", active: location.pathname === "/" && !location.hash },
    { label: "Sorteios", to: "/sorteios", icon: Gift, iconColor: "text-[#FFD700]", active: location.pathname.startsWith("/raffle") || location.pathname === "/sorteios" },
    { label: "Ganhadores", to: "/ganhadores", icon: Trophy, iconColor: "text-[#22C55E]", active: location.pathname === "/ganhadores" },
    { label: "Bilhetes", to: "/meus-bilhetes", icon: Ticket, iconColor: "text-[#FFD700]", active: ["/meus-bilhetes", "/minhas-cotas", "/meus-numeros", "/meus-jogos"].includes(location.pathname) },
    { label: "Notific.", to: "/mensagens", icon: Bell, iconColor: "text-[#FB923C]", active: location.pathname === "/mensagens" || location.pathname === "/contato" }
  ];

  return (
    <nav className="public-mobile-bottom-nav fixed inset-x-3 bottom-3 z-50 rounded-[20px] border border-white/15 bg-black p-1.5 md:hidden" aria-label="Menu inferior">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(item => {
          const Icon = item.icon;
          const className = `relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-black transition ${item.active ? "text-white" : "text-[#F5F5F5] hover:text-white"}`;
          const content = (
            <>
              <span className="flex h-5 items-center justify-center">
                <Icon className={`h-5 w-5 ${item.iconColor}`} />
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </>
          );
          return (
            <Link key={item.label} to={item.to} className={className}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
