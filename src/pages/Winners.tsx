import { useEffect, useState } from "react";
import { CalendarDays, Check, MapPin, Trophy, X } from "lucide-react";
import { PremiumPageLayout } from "../components/premium/PremiumUI";
import { ResponsiveMediaFrame } from "../components/ResponsiveMediaFrame";
import type { Winner } from "../types";

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

function formatDate(value?: string) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "Data a definir";
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function winnerLocation(winner: Winner) {
  const parts = [winner.city, winner.state].filter(Boolean);
  return parts.length ? parts.join(" - ") : "Local nao informado";
}

export function Winners() {
  const [winners, setWinners] = useState<Winner[]>([]);
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

  return (
    <PremiumPageLayout className="cfx-public-winners-page">
      <main className="cfx-public-winners-shell">
        <section className="cfx-winners-hero is-compact">
          <h1><span>Ganhadores</span></h1>
        </section>

        {winners.length ? (
          <section className="cfx-winners-card-grid">
            {winners.map(winner => (
              <button key={winner.id} type="button" className="cfx-winner-showcase-card" onClick={() => setSelectedWinner(winner)}>
                {winner.mediaUrl && (
                  <div className="cfx-winner-showcase-media">
                    <ResponsiveMediaFrame
                      src={winner.mediaUrl}
                      type={winner.mediaType}
                      alt={winner.winnerName}
                      preferredFit="cover"
                      aspectMode="horizontal"
                      autoPlay={false}
                      controls={false}
                      interactive={false}
                      className="absolute inset-0 h-full w-full rounded-none"
                    />
                  </div>
                )}
                <div className="cfx-winner-showcase-info">
                  <h2>{winner.winnerName}<Check /></h2>
                  <strong>{winner.prizeDescription || winner.raffleName || "Premio confirmado"}</strong>
                  <span><MapPin /> {winnerLocation(winner)}</span>
                  <span><CalendarDays /> {formatDate(winner.date)}</span>
                </div>
              </button>
            ))}
          </section>
        ) : (
          <section className="cfx-winner-empty">
            <Trophy className="h-10 w-10" />
            <p>Os ganhadores aparecerao aqui assim que forem confirmados.</p>
          </section>
        )}
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
                  aspectMode="horizontal"
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
              <h2>{selectedWinner.winnerName}</h2>
              <strong>{selectedWinner.prizeDescription || selectedWinner.raffleName || "Premio confirmado"}</strong>
              <p>{selectedWinner.description || selectedWinner.raffleName || "Ganhador confirmado pela campanha."}</p>
              <small>{winnerLocation(selectedWinner)} - {formatDate(selectedWinner.date)}</small>
            </div>
          </div>
        </div>
      )}
    </PremiumPageLayout>
  );
}
