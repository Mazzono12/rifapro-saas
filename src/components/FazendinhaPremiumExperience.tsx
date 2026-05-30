import type { ReactNode } from "react";
import { Sparkles, TicketCheck, Timer, Trophy } from "lucide-react";
import { cn } from "../lib/utils";
import type { FazendinhaPremiumExperienceSettings } from "../types";

export function formatFazendinhaExtractionLabel(settings: Partial<FazendinhaPremiumExperienceSettings> | undefined, drawDate?: string) {
  if (settings?.extractionTime) return `${settings.extractionText || "Próxima extração"}: ${settings.extractionTime}`;
  if (!drawDate) return settings?.extractionText || "Extração em breve";
  const date = new Date(drawDate);
  if (!Number.isFinite(date.getTime())) return settings?.extractionText || "Extração em breve";
  return `${settings?.extractionText || "Próxima extração"}: ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function FazendinhaPremiumInfo({ settings }: { settings?: Partial<FazendinhaPremiumExperienceSettings> }) {
  if (settings?.premiumInfoEnabled === false) return null;
  const title = settings?.premiumTitle || "Escolha seus bichinhos da sorte";
  const description = settings?.premiumDescription || "Concorra com chances extras, prêmios instantâneos e caixinha premiada.";
  const highlight = settings?.premiumHighlight || "PIX automático, seleção simples e experiência premium.";
  return (
    <section className="fazendinha-premium-info rounded-[1.5rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.10)] sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-primary)]/25 bg-[var(--theme-primary)]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--theme-primary)]">
            <Sparkles className="h-3.5 w-3.5" /> Informações premium
          </p>
          <h2 className="mt-3 font-display text-3xl font-black leading-tight text-[var(--theme-text)] sm:text-4xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--theme-muted)] sm:text-base">{description}</p>
        </div>
        <div className="rounded-2xl border border-[var(--theme-primary)]/20 bg-[var(--theme-primary)]/10 p-4 text-sm font-bold leading-6 text-[var(--theme-text)] md:max-w-xs">
          {highlight}
        </div>
      </div>
    </section>
  );
}

export function FazendinhaCaixinhaHighlight({ settings, active }: { settings?: Partial<FazendinhaPremiumExperienceSettings>; active?: boolean }) {
  if (settings?.caixinhaHighlightEnabled === false) return null;
  return (
    <section className="fazendinha-caixinha-highlight rounded-[1.5rem] border border-amber-300/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(16,185,129,0.08))] p-5 shadow-[0_18px_60px_rgba(245,158,11,0.10)] sm:p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-amber-200/25 bg-black/20 text-3xl">
          {settings?.caixinhaIcon || "🎁"}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-100">{active ? "Ativa agora" : "Destaque especial"}</p>
          <h3 className="mt-1 font-display text-2xl font-black text-[var(--theme-text)]">{settings?.caixinhaTitle || "Caixinha Premiada"}</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--theme-muted)]">{settings?.caixinhaDescription || "Compras confirmadas podem liberar uma caixinha com prêmio surpresa."}</p>
          {settings?.caixinhaPrizeValue && <p className="mt-3 inline-flex rounded-full border border-amber-200/25 bg-black/20 px-3 py-1.5 text-sm font-black text-amber-100">{settings.caixinhaPrizeValue}</p>}
        </div>
      </div>
    </section>
  );
}

export function FazendinhaExtractionBadge({ settings, drawDate }: { settings?: Partial<FazendinhaPremiumExperienceSettings>; drawDate?: string }) {
  if (settings?.extractionEnabled === false) return null;
  return (
    <section className="fazendinha-extraction-badge rounded-[1.5rem] border border-[var(--theme-primary)]/25 bg-[var(--theme-primary)]/10 p-5">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-[var(--theme-primary)]">
        <Timer className="h-4 w-4" /> Hora da extração
      </p>
      <p className="mt-2 font-display text-2xl font-black text-[var(--theme-text)] sm:text-3xl">{formatFazendinhaExtractionLabel(settings, drawDate)}</p>
    </section>
  );
}

export function FazendinhaPrizeInfo({ settings, prize, price }: { settings?: Partial<FazendinhaPremiumExperienceSettings>; prize: string; price: string }) {
  const prizeValue = settings?.prizeValue || prize;
  const ticketValue = settings?.ticketPriceValue || price;
  return (
    <section className="fazendinha-prize-info grid gap-3 sm:grid-cols-2">
      <InfoTile icon={<Trophy className="h-5 w-5" />} label={settings?.prizeLabel || "Prêmio"} value={prizeValue} />
      <InfoTile icon={<TicketCheck className="h-5 w-5" />} label={settings?.ticketPriceLabel || "Cada bichinho por apenas"} value={ticketValue} />
    </section>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--theme-muted)]">{icon}{label}</p>
      <p className="mt-2 font-display text-2xl font-black text-[var(--theme-text)]">{value}</p>
    </div>
  );
}

export function FazendinhaParticipateCTA({
  settings,
  selectedCount,
  selectedNumbers,
  total,
  disabled,
  onClick
}: {
  settings?: Partial<FazendinhaPremiumExperienceSettings>;
  selectedCount: number;
  selectedNumbers: number;
  total: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <section className="fazendinha-participate-cta rounded-[1.5rem] border border-[var(--theme-primary)]/25 bg-[var(--theme-primary)]/10 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.14)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--theme-primary)]">Pronto para participar?</p>
          <p className="mt-1 text-lg font-bold text-[var(--theme-text)]">{selectedCount} grupo(s) • {selectedNumbers} número(s) • {total}</p>
          <p className="mt-1 text-sm text-[var(--theme-muted)]">{settings?.ctaSubtitle || "Escolha seus bichinhos e revise a compra antes do PIX."}</p>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cn("inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[var(--theme-primary)] px-8 py-4 text-base font-black text-black shadow-[0_18px_42px_var(--theme-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto")}
        >
          <TicketCheck className="h-5 w-5" /> {settings?.ctaLabel || "Participar da Fazendinha"}
        </button>
      </div>
    </section>
  );
}
