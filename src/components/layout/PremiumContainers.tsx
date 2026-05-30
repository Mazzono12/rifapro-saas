import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function PublicPageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("public-page-container app-content-container", className)}>{children}</div>;
}

export function AppContentContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("app-content-container", className)}>{children}</div>;
}

export function CheckoutPageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("checkout-page-container", className)}>{children}</div>;
}
