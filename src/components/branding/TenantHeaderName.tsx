import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";

export function TenantHeaderName({ className }: { className?: string }) {
  const { companyName } = useTenantBranding();
  const name = String(companyName || "").trim();
  if (!name) return null;
  return <span className={className}>{name}</span>;
}
