import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";

export function TenantHeaderName({ className }: { className?: string }) {
  const { branding } = useTenantBranding();
  const name = String(branding.header_name || branding.display_name || branding.company_name || "").trim();
  if (!name) return null;
  return <span className={className}>{name}</span>;
}
