const allowedRelativeBrandingPrefixes = ["/uploads/", "/assets/", "/icons/"];

export function sanitizeBrandingText(value: unknown, fallback = "", max = 120) {
  const text = String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/[<>]/g, "")
    .trim();
  return (text || fallback).slice(0, max);
}

export function sanitizeBrandingImageUrl(value: unknown) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/[\u0000-\u001f<>]/.test(url)) return "";
  if (/^(javascript|data|vbscript|file|blob):/i.test(url)) return "";
  if (url.startsWith("/") && !url.startsWith("//")) {
    return allowedRelativeBrandingPrefixes.some(prefix => url.startsWith(prefix)) ? url.slice(0, 600) : "";
  }
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    if (!/\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?$/i.test(parsed.pathname)) return "";
    return url.slice(0, 600);
  } catch {
    return "";
  }
}

export function resolveTenantCompanyName(input: {
  company_name?: unknown;
  companyName?: unknown;
  display_name?: unknown;
  displayName?: unknown;
  header_name?: unknown;
  headerName?: unknown;
  tenantName?: unknown;
}, fallback = "RifaPro") {
  return sanitizeBrandingText(
    input.company_name ?? input.companyName ?? input.display_name ?? input.displayName ?? input.header_name ?? input.headerName ?? input.tenantName,
    fallback,
    120
  );
}

export function resolveTenantLogoUrl(input: {
  logo_url?: unknown;
  logoUrl?: unknown;
  login_logo_url?: unknown;
  loginLogoUrl?: unknown;
}) {
  return sanitizeBrandingImageUrl(input.logo_url ?? input.logoUrl ?? input.login_logo_url ?? input.loginLogoUrl);
}
