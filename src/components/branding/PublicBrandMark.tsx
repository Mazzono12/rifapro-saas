import { Hexagon } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";

type PublicBrandMarkProps = {
  className?: string;
  logoClassName?: string;
  nameClassName?: string;
  showName?: boolean;
  eager?: boolean;
  inline?: boolean;
};

function brandName(branding: ReturnType<typeof useTenantBranding>["branding"]) {
  return String(branding.display_name || branding.header_name || branding.company_name || "").trim();
}

export function PublicBrandMark({
  className,
  logoClassName,
  nameClassName,
  showName = true,
  eager = false,
  inline = false
}: PublicBrandMarkProps) {
  const { branding } = useTenantBranding();
  const name = brandName(branding);
  const shouldShowName = showName && branding.home_branding?.showName !== false && Boolean(name);

  return (
    <span className={cn("public-brand-mark", (inline || !shouldShowName) && "is-inline", !shouldShowName && "logo-only", className)}>
      {branding.logo_url ? (
        <img
          src={branding.logo_url}
          alt={name || "Logo da marca"}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={cn("public-brand-logo", logoClassName)}
        />
      ) : (
        <span className={cn("public-brand-logo public-brand-logo-fallback", logoClassName)}>
          <Hexagon />
        </span>
      )}
      {shouldShowName && <strong className={cn("public-brand-name", nameClassName)}>{name}</strong>}
    </span>
  );
}
