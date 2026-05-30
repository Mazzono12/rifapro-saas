import { useState } from "react";
import { Hexagon } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";
import { ResponsiveMediaFrame } from "../ResponsiveMediaFrame";

export function TenantLogo({ className, eager = false }: { className?: string; eager?: boolean }) {
  const { branding } = useTenantBranding();
  const [failed, setFailed] = useState(false);
  if (branding.logo_url && !failed) {
    return (
      <ResponsiveMediaFrame
        src={branding.logo_url}
        type="image"
        alt={branding.header_name}
        preferredFit="contain"
        aspectMode="square"
        priority={eager}
        className={cn("h-10 w-10 rounded-xl border border-white/10", className)}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className={cn("grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-[var(--tenant-primary)]/12", className)}>
      <Hexagon className="h-6 w-6 text-[var(--tenant-primary)]" />
    </span>
  );
}
