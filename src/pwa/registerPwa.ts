export async function registerCifherServiceWorker() {
  try {
    if (!("serviceWorker" in navigator)) return;

    if (import.meta.env.DEV) {
      await unregisterDevelopmentServiceWorkers();
      return;
    }

    if (!import.meta.env.PROD) return;
    if (window.location.protocol !== "https:") return;

    await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  } catch (error) {
    if (import.meta.env.PROD) {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
    }
    if (import.meta.env.DEV) console.warn("Falha ao preparar PWA em desenvolvimento", error);
  }
}

async function unregisterDevelopmentServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
  await Promise.all(registrations.map(registration => registration.unregister().catch(() => false)));

  if ("caches" in window) {
    const keys = await caches.keys().catch(() => []);
    await Promise.all(
      keys
        .filter(key => key.startsWith("rifapro-"))
        .map(key => caches.delete(key).catch(() => false))
    );
  }
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

function detectDeviceType() {
  const agent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(agent)) return "ios";
  if (/android/.test(agent)) return "android";
  return "desktop";
}

export async function subscribeToEnterprisePush(customerId = "") {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("Push indisponivel neste navegador");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permissao de push nao concedida");
  const registration = await navigator.serviceWorker.ready;
  const settingsResponse = await fetch("/api/push/settings").catch(() => null);
  const settingsPayload = await settingsResponse?.json().catch(() => ({}));
  const vapidPublicKey = settingsPayload?.vapidPublicKey || "";
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidPublicKey ? urlBase64ToUint8Array(vapidPublicKey) : undefined
  });
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId,
      endpoint: subscription.endpoint,
      keys: subscription.toJSON().keys,
      deviceType: detectDeviceType()
    })
  });
  if (!response.ok) throw new Error("Falha ao salvar assinatura push");
  return response.json();
}

export async function unsubscribeFromEnterprisePush() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return null;
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint })
  }).catch(() => null);
  await subscription.unsubscribe();
  return true;
}

