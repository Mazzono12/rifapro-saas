import { useState } from "react";
import { Hexagon } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";

export function TenantLogo({ className, eager = false }: { className?: string; eager?: boolean }) {
  const { companyName, logoUrl } = useTenantBranding();
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed) {
    return (
      <span className={cn("tenant-logo-slot tenant-logo-slot-image", className)}>
        <img
          src={logoUrl}
          alt={companyName || "Logo RifaPro"}
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
