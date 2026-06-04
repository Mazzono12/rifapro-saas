import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";

export function TenantHeaderName({ className }: { className?: string }) {
  const { branding } = useTenantBranding();
  return <span className={className}>{branding.header_name || "CIFHER Prime"}</span>;
}
