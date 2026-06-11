import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Gift, Home, Instagram, MessageCircle, Trophy } from "lucide-react";
import { useTenantBranding } from "../context/tenant-branding/TenantBrandingContext";

export function PublicBottomNav({ hidden = false }: { hidden?: boolean }) {
  const location = useLocation();
  const { branding } = useTenantBranding();
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.ok ? res.json() : null)
      .then(payload => setSettings(payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null))
      .catch(() => setSettings(null));
  }, []);

  if (hidden) return null;

  const whatsappUrl = String(settings?.socialLinks?.whatsapp || branding.support_whatsapp || "").trim();
  const instagramUrl = String(settings?.socialLinks?.instagram || "").trim();
  const isExternalUrl = (value: string) => /^https?:\/\//i.test(value);
  const items = [
    { label: "Início", to: "/", icon: Home, active: location.pathname === "/" && !location.hash },
    { label: "Sorteios", to: "/sorteios", icon: Gift, active: location.pathname.startsWith("/raffle") || location.pathname === "/sorteios" },
    { label: "Ganhadores", to: "/ganhadores", icon: Trophy, active: location.pathname === "/ganhadores" || location.hash === "#ganhadores" },
    ...(whatsappUrl ? [{ label: "WhatsApp", to: whatsappUrl, icon: MessageCircle, active: false, external: isExternalUrl(whatsappUrl), tone: "whatsapp" }] : []),
    ...(instagramUrl ? [{ label: "Instagram", to: instagramUrl, icon: Instagram, active: false, external: isExternalUrl(instagramUrl), tone: "instagram" }] : [])
  ].slice(0, 5);

  return (
    <nav className="public-mobile-bottom-nav fixed inset-x-3 bottom-3 z-50 rounded-[20px] border border-white/10 bg-[#141417]/92 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:hidden" aria-label="Menu inferior">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(item => {
          const Icon = item.icon;
          const socialTone = item.tone === "whatsapp" ? "text-emerald-300" : item.tone === "instagram" ? "text-fuchsia-300" : "";
          const className = `flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-black transition ${item.active ? "border border-violet-300/35 bg-violet-500/20 text-violet-100 shadow-[0_10px_30px_rgba(168,85,247,0.28)]" : `text-[#A1A1AA] hover:bg-white/5 hover:text-white ${socialTone}`}`;
          return item.external ? (
            <a key={item.label} href={item.to} target="_blank" rel="noreferrer" className={className}>
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{item.label}</span>
            </a>
          ) : (
            <Link key={item.label} to={item.to} className={className}>
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
