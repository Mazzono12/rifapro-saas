import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getReadableTextColor, normalizeReadableColor } from "../../lib/contrast";

export type PublicTenantBranding = {
  tenant_id?: string;
  company_name?: string;
  display_name?: string;
  header_name: string;
  logo_url: string;
  logo_mime_type?: string;
  favicon_url: string;
  colors: {
    primary: string;
    secondary: string;
    cta: string;
    accent?: string;
    success?: string;
    warning?: string;
    error?: string;
  };
  custom_css?: string;
  theme_mode: "vimeu_dark" | "dark" | "light" | "premium";
  slogan: string;
  footer_text: string;
  support_whatsapp: string;
  login_logo_url: string;
  login_title: string;
  login_subtitle: string;
  login_support_text: string;
  login_background_url: string;
  login_primary_color: string;
  login_accent_color: string;
  login_button_text: string;
  login_footer_text: string;
  seo?: {
    meta_title?: string;
    meta_description?: string;
    meta_keywords?: string;
    og_title?: string;
    og_description?: string;
    og_image?: string;
    twitter_title?: string;
    twitter_description?: string;
    twitter_image?: string;
  };
  landing?: {
    headline?: string;
    subheadline?: string;
    about_company?: string;
    whatsapp?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
    telegram?: string;
    banner_image?: string;
  };
};

const fallbackBranding: PublicTenantBranding = {
  header_name: "CIFHER Prime",
  logo_url: "",
  favicon_url: "",
  colors: {
    primary: "#00d66b",
    secondary: "#0f2d1d",
    cta: "#00d66b"
  },
  theme_mode: "vimeu_dark",
  slogan: "Tecnologia premium para gestao avancada",
  footer_text: "CIFHER Prime",
  support_whatsapp: "",
  login_logo_url: "",
  login_title: "CIFHER Prime",
  login_subtitle: "Acesse seu ambiente exclusivo com segurança, controle e alta performance.",
  login_support_text: "Tecnologia premium para gestão inteligente, operação avançada e crescimento profissional.",
  login_background_url: "",
  login_primary_color: "#00d66b",
  login_accent_color: "#f5c451",
  login_button_text: "Entrar com segurança",
  login_footer_text: "Ambiente protegido • Acesso autorizado"
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

function objectOrEmpty<T extends object>(value: unknown): Partial<T> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Partial<T> : {};
}

function normalizeBranding(value: Partial<PublicTenantBranding> | null | undefined): PublicTenantBranding {
  const source = objectOrEmpty<PublicTenantBranding>(value);
  const colors = objectOrEmpty<PublicTenantBranding["colors"]>(source.colors);
  return {
    ...fallbackBranding,
    ...source,
    colors: {
      ...fallbackBranding.colors,
      ...colors
    }
  };
}

function applyBranding(branding: PublicTenantBranding) {
  const root = document.documentElement;
  const colors = objectOrEmpty<PublicTenantBranding["colors"]>(branding.colors);
  const primary = normalizeReadableColor(colors.primary, fallbackBranding.colors.primary);
  const secondary = normalizeReadableColor(colors.secondary, fallbackBranding.colors.secondary);
  const cta = normalizeReadableColor(colors.cta, fallbackBranding.colors.cta);
  root.style.setProperty("--tenant-primary", primary);
  root.style.setProperty("--tenant-secondary", secondary);
  root.style.setProperty("--tenant-cta", cta);
  root.style.setProperty("--tenant-primary-text", getReadableTextColor(primary));
  root.style.setProperty("--tenant-secondary-text", getReadableTextColor(secondary));
  root.style.setProperty("--tenant-cta-text", getReadableTextColor(cta));
  root.style.setProperty("--login-primary", normalizeReadableColor(branding.login_primary_color, primary));
  root.style.setProperty("--login-accent", normalizeReadableColor(branding.login_accent_color, cta));
  root.style.setProperty("--theme-primary", primary);
  root.style.setProperty("--theme-glow", `${primary}55`);
  root.dataset.tenantTheme = branding.theme_mode || fallbackBranding.theme_mode;
  let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.appendChild(themeColor);
  }
  themeColor.content = primary;
  const seoTitle = branding.seo?.meta_title || branding.display_name || branding.header_name;
  const seoDescription = branding.seo?.meta_description || branding.slogan || "Sorteios premium com operacao profissional.";
  document.title = seoTitle || "CIFHER Prime";
  const setMeta = (selector: string, attr: "name" | "property", key: string, content: string) => {
    let meta = document.querySelector<HTMLMetaElement>(selector);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute(attr, key);
      document.head.appendChild(meta);
    }
    meta.content = content;
  };
  setMeta('meta[name="description"]', "name", "description", seoDescription);
  setMeta('meta[name="keywords"]', "name", "keywords", branding.seo?.meta_keywords || "");
  setMeta('meta[property="og:title"]', "property", "og:title", branding.seo?.og_title || seoTitle || "");
  setMeta('meta[property="og:description"]', "property", "og:description", branding.seo?.og_description || seoDescription);
  setMeta('meta[property="og:image"]', "property", "og:image", branding.seo?.og_image || branding.logo_url || "");
  setMeta('meta[name="twitter:title"]', "name", "twitter:title", branding.seo?.twitter_title || seoTitle || "");
  setMeta('meta[name="twitter:description"]', "name", "twitter:description", branding.seo?.twitter_description || seoDescription);
  setMeta('meta[name="twitter:image"]', "name", "twitter:image", branding.seo?.twitter_image || branding.seo?.og_image || branding.logo_url || "");
  let customStyle = document.querySelector<HTMLStyleElement>('style[data-tenant-custom-css="true"]');
  if (!customStyle) {
    customStyle = document.createElement("style");
    customStyle.dataset.tenantCustomCss = "true";
    document.head.appendChild(customStyle);
  }
  customStyle.textContent = branding.custom_css || "";
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
