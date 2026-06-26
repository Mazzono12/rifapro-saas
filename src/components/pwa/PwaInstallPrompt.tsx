import { useEffect, useState } from "react";
import { Download, WifiOff, X } from "lucide-react";
import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isCheckoutSurfaceBlocked() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  return (
    window.location.pathname.startsWith("/checkout/orders/") ||
    document.body.dataset.checkoutOpen === "true"
  );
}

export function PwaInstallPrompt() {
  const { branding, companyName } = useTenantBranding();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("rifapro:pwa-install-dismissed") === "true");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [checkoutBlocked, setCheckoutBlocked] = useState(isCheckoutSurfaceBlocked);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const updateBlocked = () => setCheckoutBlocked(isCheckoutSurfaceBlocked());
    updateBlocked();

    const observer = new MutationObserver(updateBlocked);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-checkout-open"] });

    window.addEventListener("popstate", updateBlocked);
    window.addEventListener("hashchange", updateBlocked);
    const interval = window.setInterval(updateBlocked, 500);

    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", updateBlocked);
      window.removeEventListener("hashchange", updateBlocked);
      window.clearInterval(interval);
    };
  }, []);

  const close = () => {
    localStorage.setItem("rifapro:pwa-install-dismissed", "true");
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
    close();
  };

  if (checkoutBlocked) return null;

  return (
    <div className="pwa-install-prompt pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[90] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end" data-pwa-install-prompt>
      {!online && (
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-amber-300/25 bg-slate-950/92 px-4 py-3 text-sm text-amber-50 shadow-2xl backdrop-blur-xl sm:w-[360px]">
          <WifiOff className="h-5 w-5 shrink-0 text-amber-300" />
          <span>Voce esta offline. Checkout, PIX e painel admin precisam de conexao segura.</span>
        </div>
      )}
      {installEvent && !dismissed && (
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/12 bg-slate-950/92 px-4 py-3 text-sm text-slate-100 shadow-2xl backdrop-blur-xl sm:w-[360px]">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--tenant-cta)] text-[var(--tenant-cta-text)]">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Instalar {companyName || branding.header_name || "RifaPro"}</p>
            <p className="text-xs text-slate-300">Acesso rapido para rifas, bilhetes, afiliado e painel.</p>
          </div>
          <button onClick={install} className="min-h-10 rounded-xl bg-[var(--tenant-cta)] px-3 text-xs font-black text-[var(--tenant-cta-text)]">
            Instalar
          </button>
          <button onClick={close} aria-label="Fechar instalacao PWA" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
