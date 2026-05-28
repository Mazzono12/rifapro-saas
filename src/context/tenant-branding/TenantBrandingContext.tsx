import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getReadableTextColor, normalizeReadableColor } from "../../lib/contrast";

export type PublicTenantBranding = {
  header_name: string;
  logo_url: string;
  logo_mime_type?: string;
  favicon_url: string;
  colors: {
    primary: string;
    secondary: string;
    cta: string;
  };
  theme_mode: "dark" | "light" | "premium";
  slogan: string;
  footer_text: string;
  support_whatsapp: string;
};

const fallbackBranding: PublicTenantBranding = {
  header_name: "RifaPro",
  logo_url: "",
  favicon_url: "",
  colors: {
    primary: "#00d66b",
    secondary: "#0f2d1d",
    cta: "#00d66b"
  },
  theme_mode: "premium",
  slogan: "Sorteios premium com PIX automatico",
  footer_text: "RifaPro SaaS",
  support_whatsapp: ""
};

const TenantBrandingContext = createContext<{
  branding: PublicTenantBranding;
  loading: boolean;
  refresh: () => Promise<void>;
}>({
  branding: fallbackBranding,
  loading: true,
  refresh: async () => undefined
});

const cache = new Map<string, { value: PublicTenantBranding; expiresAt: number }>();

function normalizeBranding(value: Partial<PublicTenantBranding> | null | undefined): PublicTenantBranding {
  return {
    ...fallbackBranding,
    ...(value || {}),
    colors: {
      ...fallbackBranding.colors,
      ...(value?.colors || {})
    }
  };
}

function applyBranding(branding: PublicTenantBranding) {
  const root = document.documentElement;
  const primary = normalizeReadableColor(branding.colors.primary, fallbackBranding.colors.primary);
  const secondary = normalizeReadableColor(branding.colors.secondary, fallbackBranding.colors.secondary);
  const cta = normalizeReadableColor(branding.colors.cta, fallbackBranding.colors.cta);
  root.style.setProperty("--tenant-primary", primary);
  root.style.setProperty("--tenant-secondary", secondary);
  root.style.setProperty("--tenant-cta", cta);
  root.style.setProperty("--tenant-primary-text", getReadableTextColor(primary));
  root.style.setProperty("--tenant-secondary-text", getReadableTextColor(secondary));
  root.style.setProperty("--tenant-cta-text", getReadableTextColor(cta));
  root.style.setProperty("--theme-primary", primary);
  root.style.setProperty("--theme-glow", `${primary}55`);
  root.dataset.tenantTheme = branding.theme_mode;
  document.title = branding.header_name ? `${branding.header_name} | RifaPro` : "RifaPro";
  const existingFavicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') || document.createElement("link");
  existingFavicon.rel = "icon";
  existingFavicon.href = branding.favicon_url || "/favicon.ico";
  if (!existingFavicon.parentNode) document.head.appendChild(existingFavicon);
}

export function TenantBrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState(fallbackBranding);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const cacheKey = window.location.host || "default";
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setBranding(cached.value);
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/public/branding", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("branding_unavailable");
      const next = normalizeBranding(await response.json());
      cache.set(cacheKey, { value: next, expiresAt: Date.now() + 60_000 });
      setBranding(next);
    } catch {
      setBranding(fallbackBranding);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    applyBranding(branding);
  }, [branding]);

  const value = useMemo(() => ({ branding, loading, refresh }), [branding, loading]);
  return <TenantBrandingContext.Provider value={value}>{children}</TenantBrandingContext.Provider>;
}

export function useTenantBranding() {
  return useContext(TenantBrandingContext);
}

export { fallbackBranding };
