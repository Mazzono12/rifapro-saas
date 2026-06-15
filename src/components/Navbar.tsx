import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Bell, Home, Ticket, Trophy, User, Users } from "lucide-react";
import { useCustomerStore } from "../store/useCustomerStore";
import { TenantLogo } from "./branding/TenantLogo";
import { TenantHeaderName } from "./branding/TenantHeaderName";
import { useTenantBranding } from "../context/tenant-branding/TenantBrandingContext";

export function Navbar() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const { branding } = useTenantBranding();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [heroVideoCinema, setHeroVideoCinema] = useState(false);
  const notifiedMessageIds = useRef<Set<string>>(new Set());
  const { customer } = useCustomerStore();
  const showAffiliatesPublic = settings?.publicModules?.affiliates !== false;
  const bottomNavItems = [
    { label: "Início", to: "/", icon: Home, active: location.pathname === "/" && !location.hash },
    { label: "Sorteios", to: "/sorteios", icon: Ticket, active: location.pathname.startsWith("/raffle") || location.pathname === "/sorteios" },
    { label: "Ganhadores", to: "/ganhadores", icon: Trophy, active: location.pathname === "/ganhadores" || location.hash === "#ganhadores" },
    { label: "Perfil", to: "/perfil", icon: User, badgeIcon: Bell, active: location.pathname === "/perfil" }
  ];

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.ok ? res.json() : null)
      .then(payload => setSettings(payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null))
      .catch(() => setSettings(null));
  }, []);

  useEffect(() => {
    setHeroVideoCinema(false);
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isAdmin) return;
    const onCinemaMode = (event: Event) => {
      const active = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      setHeroVideoCinema(active && location.pathname === "/");
      if (active) setOpen(false);
    };
    const showHeader = () => setHeroVideoCinema(false);
    window.addEventListener("rifapro:hero-video-cinema", onCinemaMode);
    window.addEventListener("scroll", showHeader, { passive: true });
    return () => {
      window.removeEventListener("rifapro:hero-video-cinema", onCinemaMode);
      window.removeEventListener("scroll", showHeader);
    };
  }, [isAdmin, location.pathname]);

  useEffect(() => {
    if (!customer || isAdmin) return;
    let active = true;

    const playMessageSound = () => {
      try {
        const audio = new AudioContext();
        [880, 1174].forEach((frequency, index) => {
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0.0001, audio.currentTime + index * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.14, audio.currentTime + index * 0.12 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + index * 0.12 + 0.22);
          oscillator.connect(gain).connect(audio.destination);
          oscillator.start(audio.currentTime + index * 0.12);
          oscillator.stop(audio.currentTime + index * 0.12 + 0.24);
        });
      } catch {
        // Navegadores podem bloquear áudio antes da primeira interação.
      }
    };

    const loadMessages = async () => {
      const res = await fetch(`/api/customers/${customer.id}/messages`);
      if (!res.ok) return;
      const payload = await res.json();
      const messages = Array.isArray(payload) ? payload : [];
      if (!active) return;
      const unread = messages.filter((message: any) => !message.read);
      setUnreadMessages(unread.length);
      const fresh = unread.find((message: any) => !notifiedMessageIds.current.has(message.id));
      unread.forEach((message: any) => notifiedMessageIds.current.add(message.id));
      if (fresh) {
        playMessageSound();
        if ("Notification" in window) {
          const showNotification = () => new Notification(fresh.title, { body: fresh.body });
          if (Notification.permission === "granted") showNotification();
          if (Notification.permission === "default") Notification.requestPermission().then(permission => permission === "granted" && showNotification());
        }
      }
    };

    loadMessages().catch(() => null);
    const interval = window.setInterval(() => loadMessages().catch(() => null), 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [customer?.id, isAdmin]);

  const goHomeTop = () => {
    setOpen(false);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  return (
    <>
      <nav className={`premium-site-header sticky top-0 z-[80] h-[68px] border-b border-[var(--theme-border)] bg-[var(--theme-surface-strong)]/90 backdrop-blur-2xl transition-transform duration-300 ${heroVideoCinema && !isAdmin ? "-translate-y-full" : "translate-y-0"}`}>
        <div className="app-content-container flex h-full items-center justify-between gap-3">
          <Link to="/" onClick={goHomeTop} className="group flex min-w-0 items-center gap-2.5 sm:gap-3" aria-label="Ir para a página principal">
            <TenantLogo className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" eager />
            <span className="min-w-0 truncate font-display text-lg font-bold tracking-wide text-[var(--theme-text)] sm:text-xl">
              <TenantHeaderName />
            </span>
          </Link>
          
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              className="touch-target w-10 h-10 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-[var(--theme-surface-strong)] flex items-center justify-center text-[var(--theme-text)] transition-colors active:scale-95"
              aria-label="Abrir menu da conta"
              title="Menu da conta"
            >
              <User className="w-5 h-5" />
              {unreadMessages > 0 && !isAdmin && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-300 px-1 text-[10px] font-black text-black">
                  {unreadMessages}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 top-12 w-[min(16rem,calc(100vw-1rem))] rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] text-[var(--theme-text)] backdrop-blur-2xl shadow-2xl overflow-visible">
                {settings?.socialLinks?.group && (
                  <a onClick={() => setOpen(false)} href={settings.socialLinks.group} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                    <Users className="w-4 h-4 text-[var(--theme-primary)]" /> Participar do grupo
                  </a>
                )}
                <Link onClick={() => setOpen(false)} to="/minhas-cotas" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                  <Ticket className="w-4 h-4 text-[var(--theme-primary)]" /> Minhas Cotas
                </Link>
                <Link onClick={() => setOpen(false)} to="/mensagens" className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                  <span className="flex items-center gap-3"><Bell className="w-4 h-4 text-amber-300" /> Mensagens</span>
                  {unreadMessages > 0 && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-black text-black">{unreadMessages}</span>}
                </Link>
                <Link onClick={() => setOpen(false)} to="/perfil" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                  <User className="w-4 h-4 text-white" /> Meu Perfil
                </Link>
                {showAffiliatesPublic && (
                  <Link onClick={() => setOpen(false)} to="/afiliados" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                    <Users className="w-4 h-4 text-emerald-300" /> Afiliados
                  </Link>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </nav>

      {!isAdmin && !heroVideoCinema && (
        <nav className="public-mobile-bottom-nav fixed inset-x-3 bottom-3 z-50 rounded-[20px] border border-white/10 bg-[#141417]/92 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:hidden" aria-label="Menu inferior">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${bottomNavItems.length}, minmax(0, 1fr))` }}>
            {bottomNavItems.map(item => {
              const Icon = item.icon;
              const BadgeIcon = item.badgeIcon;
              const className = `relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-black transition ${item.active ? "border border-violet-300/35 bg-violet-500/20 text-violet-100 shadow-[0_10px_30px_rgba(168,85,247,0.28)]" : "text-[#A1A1AA] hover:bg-white/5 hover:text-white"}`;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={className}
                >
                  <Icon className="h-5 w-5" />
                  {BadgeIcon && <BadgeIcon className="absolute right-4 top-2 h-3.5 w-3.5 text-amber-300" />}
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
