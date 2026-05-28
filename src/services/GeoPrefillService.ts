export type GeoPrefill = {
  city: string;
  state: string;
  source: "cache" | "edge" | "browser" | "fallback";
  latitude?: number;
  longitude?: number;
};

const cacheKey = "rifapro.geo-prefill.v1";
const cacheTtlMs = 1000 * 60 * 60 * 24;

function normalize(value?: string | null) {
  return String(value || "").trim();
}

function readCache(): GeoPrefill | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (!parsed?.city || Date.now() - Number(parsed.cachedAt || 0) > cacheTtlMs) return null;
    return { city: parsed.city, state: parsed.state || "", source: "cache" };
  } catch {
    return null;
  }
}

function writeCache(value: GeoPrefill) {
  if (!value.city) return;
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ ...value, cachedAt: Date.now() }));
  } catch {
    // Local storage can be unavailable in private contexts; prefill remains best-effort.
  }
}

async function detectFromEdge(): Promise<GeoPrefill | null> {
  const res = await fetch("/api/public/geo", { headers: { Accept: "application/json" } }).catch(() => null);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  const city = normalize(data?.city);
  if (!city) return null;
  return { city, state: normalize(data?.state).slice(0, 2).toUpperCase(), source: "edge" };
}

async function detectFromBrowser(): Promise<GeoPrefill | null> {
  if (!("geolocation" in navigator)) return null;
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 3500, maximumAge: 300000 });
  }).catch(() => null);
  if (!position) return null;
  return {
    city: "",
    state: "",
    source: "browser",
    latitude: position.coords.latitude,
    longitude: position.coords.longitude
  };
}

export const GeoPrefillService = {
  async detect(): Promise<GeoPrefill | null> {
    const cached = readCache();
    if (cached) return cached;
    const edge = await detectFromEdge();
    if (edge) {
      writeCache(edge);
      return edge;
    }
    const browser = await detectFromBrowser();
    if (browser?.city) writeCache(browser);
    return browser;
  },

  async captureCoordinates() {
    const browser = await detectFromBrowser();
    return browser
      ? {
          latitude: browser.latitude,
          longitude: browser.longitude,
          city: browser.city || "Nao detectada",
          state: browser.state || "BR"
        }
      : undefined;
  },

  saveManual(city?: string, state?: string) {
    const normalized = { city: normalize(city), state: normalize(state).slice(0, 2).toUpperCase(), source: "fallback" as const };
    if (normalized.city) writeCache(normalized);
  }
};
