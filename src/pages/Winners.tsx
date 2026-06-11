import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Crown, Gift, Grid2X2, MapPin, Package, Play, ShieldCheck, Star, Ticket, Trophy, Users, X } from "lucide-react";
import { PremiumPageLayout } from "../components/premium/PremiumUI";
import { ResponsiveMediaFrame } from "../components/ResponsiveMediaFrame";
import { cn } from "../lib/utils";
import type { Winner } from "../types";

type WinnerFilter = "Todos" | "Sorteios" | "Super Cotas" | "Roleta" | "Raspadinha" | "Caixinha";

const filters: Array<{ label: WinnerFilter; icon: React.ReactNode }> = [
  { label: "Todos", icon: <Grid2X2 /> },
  { label: "Sorteios", icon: <Gift /> },
  { label: "Super Cotas", icon: <Crown /> },
  { label: "Roleta", icon: <Trophy /> },
  { label: "Raspadinha", icon: <Ticket /> },
  { label: "Caixinha", icon: <Package /> }
];

function normalizeWinners(payload: unknown): Winner[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((winner): winner is Partial<Winner> => Boolean(winner && typeof winner === "object"))
    .filter(winner => Boolean(String(winner.winnerName || "").trim()))
    .map(winner => ({
      id: String(winner.id || `${winner.winnerName}-${winner.prizeDescription || ""}`),
      raffleName: String(winner.raffleName || "").trim(),
      winnerName: String(winner.winnerName || "").trim(),
      prizeDescription: String(winner.prizeDescription || "").trim(),
      mediaUrl: String(winner.mediaUrl || "").trim(),
      mediaType: winner.mediaType || "image",
      date: String(winner.date || ""),
      sourceType: String(winner.sourceType || winner.category || "Sorteio").trim(),
      category: String(winner.category || winner.sourceType || "Sorteio").trim(),
      status: String(winner.status || "Confirmado").trim(),
      city: String(winner.city || "").trim(),
      state: String(winner.state || "").trim(),
      description: String(winner.description || "").trim(),
      prizeValue: Number.isFinite(Number(winner.prizeValue)) ? Number(winner.prizeValue) : 0,
      active: winner.active !== false
    } as Winner));
}

function categoryToFilter(value?: string): WinnerFilter {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("super")) return "Super Cotas";
  if (normalized.includes("roleta")) return "Roleta";
  if (normalized.includes("raspad")) return "Raspadinha";
  if (normalized.includes("caix")) return "Caixinha";
  return "Sorteios";
}

function formatDate(value?: string) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "Data a definir";
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function winnerLocation(winner: Winner) {
  const parts = [winner.city, winner.state].filter(Boolean);
  return parts.length ? parts.join(" - ") : "Local não informado";
}

export function Winners() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [activeFilter, setActiveFilter] = useState<WinnerFilter>("Todos");
  const [selectedWinner, setSelectedWinner] = useState<Winner | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/winners")
      .then(res => res.ok ? res.json() : [])
      .then(payload => active && setWinners(normalizeWinners(payload)))
      .catch(() => active && setWinners([]));
    return () => {
      active = false;
    };
  }, []);

  const visibleWinners = useMemo(() => {
    if (activeFilter === "Todos") return winners;
    return winners.filter(winner => categoryToFilter(winner.sourceType || winner.category) === activeFilter);
  }, [activeFilter, winners]);

  const stats = useMemo(() => {
    const totalValue = winners.reduce((sum, winner) => sum + (Number(winner.prizeValue) || 0), 0);
    return [
      { label: "Prêmios Entregues", value: String(winners.length), icon: <Trophy /> },
      { label: "Valor Total Entregue", value: formatMoney(totalValue), icon: <Gift /> },
      { label: "Total de Ganhadores", value: String(winners.length), icon: <Users /> },
      { label: "Avaliação", value: winners.length ? "98%" : "0", icon: <Star /> }
    ];
  }, [winners]);

  return (
    <PremiumPageLayout className="cfx-public-winners-page">
      <main className="cfx-public-winners-shell">
        <section className="cfx-winners-hero">
          <Crown className="cfx-winners-crown" />
          <h1><span>Ganhadores</span><strong>da CIFHER</strong></h1>
          <p>Quem ganhou <b>de verdade</b></p>
          <div className="cfx-winners-proof">
            <span><ShieldCheck /> 100% transparente</span>
            <span><Trophy /> Prêmios entregues</span>
            <span><Users /> Ganhadores reais</span>
          </div>
        </section>

        <div className="cfx-winners-filters" role="tablist" aria-label="Filtros de ganhadores">
          {filters.map(filter => (
            <button
              key={filter.label}
              type="button"
              role="tab"
              aria-selected={activeFilter === filter.label}
              className={cn(activeFilter === filter.label && "is-active")}
              onClick={() => setActiveFilter(filter.label)}
            >
              {filter.icon}
              {filter.label}
            </button>
          ))}
        </div>

        {visibleWinners.length ? (
          <section className="cfx-winners-card-grid">
            {visibleWinners.map(winner => (
              <button key={winner.id} type="button" className="cfx-winner-showcase-card" onClick={() => setSelectedWinner(winner)}>
                <div className="cfx-winner-showcase-media">
                  {winner.mediaUrl ? (
                    <ResponsiveMediaFrame
                      src={winner.mediaUrl}
                      type={winner.mediaType}
                      alt={winner.winnerName}
                      preferredFit="cover"
                      aspectMode="portrait"
                      autoPlay={false}
                      controls={false}
                      interactive={false}
                      className="absolute inset-0 h-full w-full rounded-none"
                    />
                  ) : (
                    <div className="cfx-winner-showcase-placeholder"><Trophy /></div>
                  )}
                  <span className={cn("cfx-winner-category", `is-${categoryToFilter(winner.sourceType || winner.category).toLowerCase().replace(/\s+/g, "-")}`)}>
                    {categoryToFilter(winner.sourceType || winner.category)}
                  </span>
                  <span className="cfx-winner-play-button"><Play fill="currentColor" /></span>
                </div>
                <div className="cfx-winner-showcase-info">
                  <h2>{winner.winnerName}<Check /></h2>
                  <strong>{winner.prizeDescription || winner.raffleName || "Prêmio confirmado"}</strong>
                  <span><MapPin /> {winnerLocation(winner)}</span>
                  <span><CalendarDays /> {formatDate(winner.date)}</span>
                </div>
              </button>
            ))}
          </section>
        ) : (
          <section className="cfx-winner-empty">
            <Trophy className="h-10 w-10" />
            <p>Os ganhadores aparecerão aqui assim que forem confirmados.</p>
          </section>
        )}

        <section className="cfx-winners-stats">
          {stats.map(stat => (
            <article key={stat.label}>
              {stat.icon}
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </article>
          ))}
          <p><ShieldCheck /> Compromisso CIFHER: total transparência e confiança</p>
        </section>
      </main>

      {selectedWinner && (
        <div className="cfx-winner-modal" role="dialog" aria-modal="true" aria-label={`Ganhador ${selectedWinner.winnerName}`}>
          <button type="button" className="cfx-winner-modal-close" onClick={() => setSelectedWinner(null)} aria-label="Fechar">
            <X />
          </button>
          <div className="cfx-winner-modal-card">
            <div className="cfx-winner-modal-media">
              {selectedWinner.mediaUrl ? (
                <ResponsiveMediaFrame
                  src={selectedWinner.mediaUrl}
                  type={selectedWinner.mediaType}
                  alt={selectedWinner.winnerName}
                  preferredFit="auto"
                  aspectMode="portrait"
                  autoPlay
                  muted={false}
                  controls
                  className="h-full w-full rounded-none"
                />
              ) : (
                <div className="cfx-winner-showcase-placeholder"><Trophy /></div>
              )}
            </div>
            <div className="cfx-winner-modal-info">
              <span>{categoryToFilter(selectedWinner.sourceType || selectedWinner.category)}</span>
              <h2>{selectedWinner.winnerName}</h2>
              <strong>{selectedWinner.prizeDescription || selectedWinner.raffleName || "Prêmio confirmado"}</strong>
              <p>{selectedWinner.description || selectedWinner.raffleName || "Ganhador confirmado pela campanha."}</p>
              <small>{winnerLocation(selectedWinner)} • {formatDate(selectedWinner.date)}</small>
            </div>
          </div>
        </div>
      )}
    </PremiumPageLayout>
  );
}
