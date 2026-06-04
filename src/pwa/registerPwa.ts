export async function registerCifherServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (window.location.protocol !== "https:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") return;

  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (error) {
    if (import.meta.env.DEV) console.warn("Falha ao registrar PWA", error);
  }
}
