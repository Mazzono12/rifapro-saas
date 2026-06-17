import React from "react";
import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Clock3, Copy, Inbox, QrCode, ShieldCheck, Ticket, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "../../lib/utils";
import { ResponsiveMediaFrame } from "../ResponsiveMediaFrame";
import { TenantHeaderName } from "../branding/TenantHeaderName";
import { TenantLogo } from "../branding/TenantLogo";
import { CheckoutPageContainer } from "../layout/PremiumContainers";

let checkoutOverlayCount = 0;

function useCheckoutOverlayMode(active = true) {
  React.useEffect(() => {
    if (!active || typeof document === "undefined") return;
    checkoutOverlayCount += 1;
    document.body.dataset.checkoutOpen = "true";
    return () => {
      checkoutOverlayCount = Math.max(0, checkoutOverlayCount - 1);
      if (checkoutOverlayCount === 0) delete document.body.dataset.checkoutOpen;
    };
  }, [active]);
}

export function PremiumPageLayout({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("premium-page min-h-screen w-full min-w-0 text-white", className)}>
      <div className="premium-ambient" />
      <div className="relative z-10 w-full min-w-0">{children}</div>
    </div>
  );
}

export function PremiumButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const variantClass = {
    primary: "premium-button",
    secondary: "premium-button premium-button-secondary",
    danger: "premium-button premium-button-danger",
    ghost: "premium-button premium-button-ghost"
  }[variant];

  return (
    <button type="button" className={cn(variantClass, className)} {...props}>
      {children}
    </button>
  );
}

export function CheckoutPrimaryActionButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn("checkout-primary-action-button checkout-primary-button premium-button", className)} {...props}>
      {children}
    </button>
  );
}

export const CheckoutPrimaryButton = CheckoutPrimaryActionButton;

export function PremiumInput({
  label,
  helper,
  error,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helper?: string;
  error?: string;
}) {
  return (
    <label className="premium-field">
      <span>{label}</span>
      <input className={cn("premium-input", error && "premium-input-error", className)} aria-invalid={Boolean(error)} {...props} />
      {(error || helper) && <small className={error ? "premium-field-error" : "premium-field-helper"}>{error || helper}</small>}
    </label>
  );
}

export function PremiumBadge({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "premium" | "gold";
}) {
  return <span className={cn("premium-badge", `premium-badge-${tone}`)}>{children}</span>;
}

export function PremiumStatsCard({
  label,
  value,
  meta,
  icon
}: {
  label: string;
  value: React.ReactNode;
  meta?: string;
  icon?: React.ReactNode;
}) {
  return (
    <article className="premium-stats-card">
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {meta && <span>{meta}</span>}
      </div>
      {icon && <div className="premium-stats-icon">{icon}</div>}
    </article>
  );
}

export function PremiumChartCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="premium-chart-card">
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function PremiumEmptyState({
  title = "Nada por aqui ainda",
  description = "Assim que houver dados, eles aparecem aqui.",
  action
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="premium-empty-state">
      <Inbox className="h-9 w-9" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

export function PremiumErrorState({
  title = "Nao foi possivel carregar",
  description = "Tente novamente em alguns instantes.",
  action
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="premium-error-state">
      <AlertTriangle className="h-9 w-9" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

export function PremiumSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => <div key={index} className="premium-skeleton" />)}
    </div>
  );
}

export function PremiumTable({ columns, rows, empty = "Nenhum registro encontrado." }: { columns: string[]; rows: React.ReactNode[][]; empty?: string }) {
  return (
    <div className="premium-table-wrap">
      <table className="premium-table">
        <thead>
          <tr>{columns.map(column => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          )) : (
            <tr><td colSpan={columns.length}><PremiumEmptyState title={empty} description="Ajuste os filtros ou aguarde novas movimentacoes." /></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function CheckoutSummary({ items, total }: { items: Array<[string, React.ReactNode]>; total: React.ReactNode }) {
  return (
    <div className="checkout-summary-card">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      <div className="checkout-summary-total">
        <span>Total</span>
        <strong>{total}</strong>
      </div>
    </div>
  );
}

export function WalletBalanceCard({ balance, label = "Saldo disponivel" }: { balance: React.ReactNode; label?: string }) {
  return (
    <div className="wallet-balance-card">
      <ShieldCheck className="h-5 w-5" />
      <span>{label}</span>
      <strong>{balance}</strong>
    </div>
  );
}

export function PremiumHeader({
  title = "CIFHER Ambiente Premium",
  subtitle = "Premiacoes",
  right,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="premium-header">
      <div className="app-content-container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <span className="premium-logo-mark">R</span>
          <span className="leading-none">
            <span className="block text-base font-black tracking-wide">{title}</span>
            <span className="block text-[10px] uppercase tracking-[0.24em] text-emerald-100/70">{subtitle}</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

export function PremiumHero({
  eyebrow,
  title,
  subtitle,
  image,
  cta,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  image?: string;
  cta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="premium-hero">
      {image && (
        <ResponsiveMediaFrame
          src={image}
          type="image"
          alt={title}
          preferredFit="auto"
          aspectMode="auto"
          className="absolute inset-0 h-full w-full rounded-none opacity-42"
          priority={false}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/20" />
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 mx-auto flex min-h-[560px] w-full max-w-7xl min-w-0 flex-col justify-end px-4 pb-8 pt-24 sm:min-h-[640px] sm:pb-12">
        {eyebrow && <p className="premium-eyebrow mb-4">{eyebrow}</p>}
        <h1 className="max-w-4xl text-5xl font-black leading-[0.92] tracking-tight sm:text-7xl">{title}</h1>
        {subtitle && <p className="mt-5 max-w-2xl text-lg leading-7 text-slate-200 sm:text-2xl">{subtitle}</p>}
        {cta && <div className="mt-7">{cta}</div>}
        {children && <div className="mt-7">{children}</div>}
      </motion.div>
    </section>
  );
}

export function SectionTitle({ eyebrow, title, description, compact = false }: { eyebrow: string; title: string; description?: string; compact?: boolean }) {
  return (
    <div>
      <p className="premium-eyebrow">{eyebrow}</p>
      <h2 className={cn("font-black tracking-tight text-white", compact ? "text-2xl" : "text-3xl sm:text-4xl")}>{title}</h2>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>}
    </div>
  );
}

export function PrizeCard({ title, description, image, badge }: { title: string; description: string; image?: string; badge?: string }) {
  return (
    <article className="premium-card overflow-hidden p-0">
      <div className="relative aspect-[16/10] bg-slate-950">
        {image ? (
          <ResponsiveMediaFrame
            src={image}
            type="image"
            alt={title}
            preferredFit="auto"
            aspectMode="auto"
            className="h-full w-full rounded-none"
          />
        ) : <div className="h-full w-full bg-gradient-to-br from-emerald-400/20 to-cyan-400/10" />}
        {badge && <span className="absolute left-3 top-3 rounded-full bg-emerald-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-950">{badge}</span>}
      </div>
      <div className="p-4">
        <h3 className="text-xl font-black">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </article>
  );
}

export function CountdownCard({ label = "Vendas encerram em", parts }: { label?: string; parts: Array<[string, number | string]> }) {
  return (
    <div className="premium-card border-emerald-300/20 bg-emerald-300/[0.065]">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-emerald-100">
        <Clock3 className="h-4 w-4" /> {label}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {parts.map(([name, value]) => (
          <div key={name} className="rounded-2xl bg-black/30 p-3 text-center">
            <span className="block text-2xl font-black">{String(value).padStart(2, "0")}</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TicketPackageCard({ qty, value, bonus, selected, onClick }: { qty: number; value: string; bonus?: string; selected?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("premium-card w-full p-4 text-left active:scale-[0.98]", selected && "border-emerald-200 bg-emerald-300/14 shadow-[0_0_32px_rgba(52,211,153,0.22)]")}>
      <p className="text-2xl font-black">{qty.toLocaleString("pt-BR")} títulos</p>
      <p className="mt-1 text-sm font-bold text-emerald-100">{value}</p>
      {bonus && <p className="mt-2 rounded-xl bg-black/30 px-2 py-1 text-xs text-amber-100">{bonus}</p>}
    </button>
  );
}

export function QuickQuantityGrid({ values, selected, onSelect }: { values: number[]; selected: number; onSelect: (value: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {values.map(value => (
        <button key={value} type="button" onClick={() => onSelect(value)} className={cn("min-h-20 rounded-2xl border border-white/10 bg-white/[0.04] text-center font-black transition active:scale-95", selected === value && "border-lime-200 bg-lime-200 text-slate-950")}>
          <span className="block text-2xl">+{value.toLocaleString("pt-BR")}</span>
          <span className="text-[10px] uppercase tracking-[0.18em] opacity-75">Selecionar</span>
        </button>
      ))}
    </div>
  );
}

export function FloatingCTA({ label, meta, onClick, hidden = false }: { label: string; meta?: string; onClick?: () => void; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <button type="button" onClick={onClick} className="premium-floating-cta">
      <span className="flex items-center gap-2"><Ticket className="h-5 w-5" /> {label}</span>
      {meta && <span className="rounded-xl bg-black/10 px-3 py-2 text-sm">{meta}</span>}
    </button>
  );
}

type CheckoutModalShellProps = {
  open: boolean;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  onClose: () => void;
  compact?: boolean;
  variant?: "modal" | "receipt";
  shellClassName?: string;
  contentClassName?: string;
  mediaAware?: "with-media" | "compact-no-media" | "standard-media";
};

export function CheckoutModalShell({
  open,
  title,
  eyebrow,
  children,
  onClose,
  compact = false,
  variant = "modal",
  shellClassName = "",
  contentClassName = "",
  mediaAware
}: CheckoutModalShellProps) {
  useCheckoutOverlayMode(open);
  if (!open) return null;
  const isReceipt = variant === "receipt";
  return (
    <div className={cn(
      isReceipt
        ? "checkout-receipt-overlay fixed inset-0 z-[130] overflow-y-auto bg-[#020407] p-2 backdrop-blur-xl sm:p-3"
        : "checkout-modal-overlay fixed inset-0 z-[120] overflow-y-auto bg-[#020407] p-2 backdrop-blur-2xl sm:p-3"
    )}>
      <motion.section
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 28, opacity: 0 }}
        className={cn(
          isReceipt
            ? "checkout-screen checkout-receipt-shell mx-auto my-3 flex w-full flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#070a0f] text-white shadow-[0_30px_120px_rgba(0,0,0,0.5)] sm:my-4 sm:rounded-[1.75rem]"
            : "checkout-screen checkout-modal-shell mx-auto my-3 flex w-full flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#090b11] shadow-[0_0_100px_rgba(52,211,153,0.16)] sm:my-5 sm:rounded-[2rem]",
          shellClassName
        )}
        data-media-aware={mediaAware || (compact ? "compact-no-media" : "standard-media")}
      >
        <CheckoutModalHeader title={title} eyebrow={eyebrow || (isReceipt ? "Recibo pre-pagamento" : "Checkout seguro")} onClose={onClose} compact={compact} />
        <CheckoutContentArea className={contentClassName}>{children}</CheckoutContentArea>
      </motion.section>
    </div>
  );
}

export function PremiumCheckoutModal({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <CheckoutModalShell open={open} title={title} onClose={onClose} compact>
      {children}
    </CheckoutModalShell>
  );
}

export function CheckoutSafeTop({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn("checkout-safe-top w-full min-w-0", className)}>{children}</div>;
}

export function CheckoutContentArea({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("checkout-content-area min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain", className)}>{children}</div>;
}

export function CheckoutModalHeader({ title, eyebrow = "Checkout seguro", compact = false }: { title: string; eyebrow?: string; onClose: () => void; compact?: boolean }) {
  return (
    <header className={cn("checkout-modal-header sticky top-0 z-10 shrink-0 border-b border-white/10 bg-[#090b11]/96 backdrop-blur-xl", compact ? "px-3 py-2" : "px-3 py-3 sm:px-4")} data-media-aware={compact ? "compact-no-media" : "standard-media"}>
      <CheckoutPageContainer className="grid grid-cols-1 items-center gap-3 px-0">
        <div className="checkout-modal-title-block flex min-w-0 items-center gap-2.5 sm:gap-3">
          <TenantLogo className={cn("checkout-modal-logo shrink-0", compact && "is-compact")} eager />
          <div className="min-w-0">
            <p className={cn("checkout-modal-kicker font-black uppercase tracking-[0.14em] text-[var(--theme-primary)]", compact ? "text-[8px]" : "text-[9px] sm:text-[10px]")}>
              {eyebrow}
            </p>
            <h2 className={cn("checkout-modal-title font-black leading-tight text-white", compact ? "text-base sm:text-lg" : "text-lg sm:text-xl")}>{title}</h2>
            <p className={cn("checkout-modal-tenant font-semibold leading-tight text-slate-400", compact ? "text-[11px]" : "text-xs")}>
              <TenantHeaderName />
            </p>
          </div>
        </div>
      </CheckoutPageContainer>
    </header>
  );
}

export function normalizePixQrImage(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (/^(data:image\/|https?:\/\/)/i.test(normalized)) return normalized;
  return `data:image/png;base64,${normalized}`;
}

export function PixPaymentCard({ payload, qrImage, copied, onCopy }: { payload?: string; qrImage?: string; copied?: boolean; onCopy: () => void }) {
  const pixQrImage = normalizePixQrImage(qrImage);
  return (
    <div className="checkout-pix-card space-y-4 text-center" style={{ background: "#000", backgroundColor: "#000", backgroundImage: "none" }}>
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-cyan-300/10 text-cyan-100" style={{ background: "#000", backgroundColor: "#000", backgroundImage: "none" }}>
        <QrCode className="h-8 w-8" />
      </div>
      {pixQrImage || payload ? (
        <>
          <div className="mx-auto w-full max-w-[min(18rem,calc(100vw-3rem))] rounded-[1.35rem] bg-white p-3 sm:w-fit sm:max-w-none sm:rounded-[1.75rem] sm:p-5">
            {pixQrImage ? (
              <img src={pixQrImage} className="h-auto w-full sm:h-[236px] sm:w-[236px]" alt="QR Code PIX" />
            ) : (
              <QRCodeSVG value={payload || ""} className="h-auto w-full sm:h-[236px] sm:w-[236px]" bgColor="#ffffff" fgColor="#0f172a" level="M" />
            )}
          </div>
          {payload && (
            <div className="checkout-pix-code-box" style={{ background: "#000", backgroundColor: "#000", backgroundImage: "none" }}>
              <span>PIX copia e cola</span>
              <code>{payload}</code>
            </div>
          )}
        </>
      ) : (
        <div className="premium-card border-red-300/20 bg-red-500/10 text-red-100">Não foi possível gerar o PIX. Tente novamente ou fale com o suporte.</div>
      )}
      {payload && <CheckoutPrimaryButton onClick={onCopy} aria-label="Copiar PIX copia e cola" className={cn("checkout-pix-copy-button pix-copy-gold-button w-full", copied && "bg-emerald-200")}>
        {copied ? "Código PIX copiado" : <><Copy className="h-5 w-5" /> Copiar código PIX</>}
      </CheckoutPrimaryButton>}
      <p className="checkout-pix-help">Depois de copiar, abra o app do banco e pague via PIX copia e cola.</p>
    </div>
  );
}

export function PremiumTicketReceipt({ title, purchaseId, numbers, onShare }: { title: string; purchaseId: string; numbers: number[]; onShare?: () => void }) {
  return (
    <div className="premium-card border-emerald-200/30 bg-gradient-to-br from-emerald-300/16 via-white/[0.055] to-cyan-300/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="premium-eyebrow text-emerald-100">Compra Confirmada</p>
          <h3 className="mt-2 text-2xl font-black">{title}</h3>
          <p className="mt-2 text-sm text-slate-300">Pedido #{purchaseId}</p>
        </div>
        <ShieldCheck className="h-10 w-10 text-emerald-200" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {numbers.slice(0, 18).map(number => <span key={number} className="rounded-xl bg-black/25 px-3 py-2 text-xs font-black">{String(number).padStart(6, "0")}</span>)}
      </div>
      {onShare && <button type="button" onClick={onShare} className="premium-button mt-5 w-full">Compartilhar no WhatsApp</button>}
    </div>
  );
}

export function TrustBadges() {
  const badges = [
    [ShieldCheck, "Compra Segura"],
    [QrCode, "PIX Automático"],
    [Trophy, "Sorteio Auditável"],
    [CheckCircle2, "Dados Protegidos"]
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map(([Icon, label]) => (
        <span key={label as string} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-black text-slate-100">
          <Icon className="h-4 w-4 text-emerald-200" /> {label as string}
        </span>
      ))}
    </div>
  );
}

export function BonusRouletteCard({ qty, chances, prize, tone = "from-blue-600 to-cyan-400" }: { qty: number; chances: number; prize: string; tone?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r p-4 text-white shadow-xl", tone)}>
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
      <p className="text-lg font-black">{qty.toLocaleString("pt-BR")} Números</p>
      <p className="mt-1 text-sm font-bold">Receba {chances} roletas premiadas</p>
      <p className="mt-2 text-xs text-white/80">{prize}</p>
    </div>
  );
}
