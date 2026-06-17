import { useState } from "react";
import { Hexagon } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";

export function TenantLogo({ className, eager = false }: { className?: string; eager?: boolean }) {
  const { branding } = useTenantBranding();
  const [failed, setFailed] = useState(false);
  if (branding.logo_url && !failed) {
    return (
      <span className={cn("tenant-logo-slot tenant-logo-slot-image", className)}>
        <img
          src={branding.logo_url}
          alt={branding.header_name || branding.display_name || branding.company_name || "Logo da marca"}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="tenant-logo-img"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span className={cn("tenant-logo-slot tenant-logo-fallback grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-[var(--tenant-primary)]/12", className)}>
      <Hexagon className="h-6 w-6 text-[var(--tenant-primary)]" />
    </span>
  );
}
