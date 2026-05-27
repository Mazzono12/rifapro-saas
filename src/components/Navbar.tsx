import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Bell, Hexagon, Instagram, MessageCircle, MoreVertical, User, Users, Ticket } from "lucide-react";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useCustomerStore } from "../store/useCustomerStore";

export function Navbar() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [heroVideoCinema, setHeroVideoCinema] = useState(false);
  const notifiedMessageIds = useRef<Set<string>>(new Set());
  const { customer } = useCustomerStore();

  useEffect(() => {
    fetch("/api/settings").then(res => res.json()).then(setSettings).catch(() => null);
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
      const messages = await res.json();
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
      <nav className={`premium-site-header fixed top-0 inset-x-0 z-50 border-b border-[var(--theme-border)] bg-[var(--theme-surface-strong)]/90 backdrop-blur-2xl transition-transform duration-300 ${heroVideoCinema && !isAdmin ? "-translate-y-full" : "translate-y-0"}`}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" onClick={goHomeTop} className="flex items-center gap-3 group" aria-label="Ir para a página principal">
            {settings?.branding?.logoUrl ? (
              <img src={settings.branding.logoUrl} alt={settings.branding.logoAlt || settings.branding.companyName} className="h-9 w-9 rounded-lg object-cover border border-white/10" />
            ) : (
              <div className="relative flex items-center justify-center">
                <Hexagon className="w-8 h-8 text-[var(--theme-primary)] relative z-10 group-hover:scale-110 transition-transform duration-300" />
                <div className="absolute inset-0 bg-[var(--theme-glow)] blur-md rounded-full transition-colors" />
              </div>
            )}
            <span className="font-display font-bold text-xl tracking-wider text-[var(--theme-text)]">
              {settings?.branding?.companyName || "NexusDraw"}
            </span>
          </Link>
          
          <div className="flex items-center gap-2">
            <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              className="touch-target w-10 h-10 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-[var(--theme-surface-strong)] flex items-center justify-center text-[var(--theme-text)] transition-colors active:scale-95"
              aria-label="Abrir menu"
            >
              <MoreVertical className="w-5 h-5" />
              {unreadMessages > 0 && !isAdmin && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-300 px-1 text-[10px] font-black text-black">
                  {unreadMessages}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 top-12 w-64 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] text-[var(--theme-text)] backdrop-blur-2xl shadow-2xl overflow-visible">
                <ThemeSwitcher label />
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
                <Link onClick={() => setOpen(false)} to="/afiliados" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                  <Users className="w-4 h-4 text-[var(--theme-primary)]" /> Meus Afiliados
                </Link>
                <Link onClick={() => setOpen(false)} to="/perfil" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                  <User className="w-4 h-4 text-white" /> Meu Perfil
                </Link>
              </div>
            )}
            </div>
          </div>
        </div>
      </nav>

      {!isAdmin && !heroVideoCinema && settings?.socialLinks && (
        <div className="fixed right-4 bottom-24 z-50 flex flex-col gap-3">
          {settings.socialLinks.group && (
            <a href={settings.socialLinks.group} target="_blank" rel="noreferrer" className="premium-button h-12 w-12 rounded-full p-0" aria-label="Participar do grupo">
              <Users className="w-5 h-5" />
            </a>
          )}
          {settings.socialLinks.whatsapp && <a href={settings.socialLinks.whatsapp} target="_blank" rel="noreferrer" className="premium-button h-12 w-12 rounded-full p-0" aria-label="WhatsApp">
            <MessageCircle className="w-6 h-6" />
          </a>}
          {settings.socialLinks.instagram && <a href={settings.socialLinks.instagram} target="_blank" rel="noreferrer" className="premium-button h-12 w-12 rounded-full p-0" aria-label="Instagram">
            <Instagram className="w-6 h-6" />
          </a>}
        </div>
      )}
    </>
  );
}
