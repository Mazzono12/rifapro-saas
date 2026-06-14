import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock3, Gift, ShieldCheck, Star, Target, Ticket, Trophy } from "lucide-react";
import { StandardRaffleMediaBlock } from "../components/StandardRaffleMediaBlock";
import { useFazendinha, useModalidades, useRaffleCatalog } from "../hooks/useRaffles";
import type { Raffle, Winner } from "../types";
import { cn } from "../lib/utils";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type DrawCard = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  mediaUrl: string;
  mediaType?: Raffle["mediaType"];
  fallbackImageUrl?: string;
  status: "active" | "completed";
  badge: string;
  price?: number;
  drawDate?: string;
  progress: number;
  winnerName?: string;
  winningTicket?: string;
  winnerDate?: string;
  showProgress?: boolean;
};

function safeText(value: unknown, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatCurrency(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value?: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "A definir";
  return date.toLocaleDateString("pt-BR");
}

function raffleProgress(raffle: Partial<Raffle>) {
  const explicit = Number((raffle as any).progressOverride);
  if (Number.isFinite(explicit)) return Math.min(100, Math.max(0, explicit));
  const total = Math.max(1, safeNumber(raffle.totalTickets, 1));
  const sold = Math.max(0, safeNumber(raffle.soldTickets));
  return Math.min(100, Math.max(0, Math.round((sold / total) * 100)));
}

function mediaForRaffle(raffle: Partial<Raffle>) {
  const image = safeText(raffle.image || raffle.imageUrl || raffle.bannerUrl || raffle.coverImageUrl || raffle.thumbnailUrl, "");
  const mediaUrl = safeText(raffle.mediaUrl || raffle.videoUrl, image);
  return { mediaUrl, fallbackImageUrl: image || mediaUrl };
}

function normalizeWinnerKey(value: unknown) {
  return safeText(value, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function findWinnerForRaffle(raffle: Raffle, winners: Winner[]) {
  const raffleTitle = normalizeWinnerKey(raffle.title);
  return winners.find(winner => (
    normalizeWinnerKey((winner as any).raffleId) === normalizeWinnerKey(raffle.id) ||
    normalizeWinnerKey(winner.raffleName) === raffleTitle
  ));
}

function winnerTicket(raffle: Raffle, winner?: Winner) {
  const candidates = [
    (raffle as any).winningTicket,
    (raffle as any).winnerTicket,
    (raffle as any).winningNumber,
    (raffle as any).cotaVencedora,
    (raffle as any).numeroSorteado,
    (winner as any)?.winningTicket,
    (winner as any)?.winnerTicket,
    (winner as any)?.winningNumber,
    (winner as any)?.cotaVencedora,
    (winner as any)?.numeroSorteado
  ];
  const value = candidates.map(item => safeText(item, "")).find(Boolean);
  return value ? `#${value.replace(/^#/, "")}` : "A divulgar";
}

function buildRaffleCard(raffle: Raffle, index: number, winners: Winner[]): DrawCard {
  const media = mediaForRaffle(raffle);
  const winner = findWinnerForRaffle(raffle, winners);
  const completed = raffle.status === "completed";
  return {
    id: raffle.id,
    title: raffle.title,
    subtitle: safeText(raffle.homeHighlightText, safeText(raffle.description, completed ? "Resultado confirmado" : "Participe agora.")),
    href: `/raffle/${encodeURIComponent(raffle.id)}`,
    mediaUrl: media.mediaUrl,
    mediaType: raffle.mediaType || "image",
    fallbackImageUrl: media.fallbackImageUrl,
    status: completed ? "completed" : "active",
    badge: completed ? "Encerrado" : index === 0 ? "Principal" : index === 1 ? "Em alta" : "Ativo",
    price: raffle.price,
    drawDate: raffle.drawDate,
    progress: raffleProgress(raffle),
    showProgress: true,
    winnerName: safeText(winner?.winnerName, safeText((raffle as any).winnerName, "")),
    winningTicket: winnerTicket(raffle, winner),
    winnerDate: winner?.date || raffle.drawDate
  };
}

export function Sorteios() {
  const { data: raffles = [], isLoading: loadingRaffles } = useRaffleCatalog();
  const { data: fazendinha } = useFazendinha();
  const { data: modalidades } = useModalidades();
  const [winners, setWinners] = useState<Winner[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/winners")
      .then(res => res.ok ? res.json() : [])
      .then(payload => {
        if (!active) return;
        setWinners(Array.isArray(payload) ? payload : []);
      })
      .catch(() => active && setWinners([]));
    return () => {
      active = false;
    };
  }, []);

  const raffleCards = useMemo(() => (
    [...raffles]
      .filter(raffle => ["active", "completed"].includes(String(raffle.status)))
      .sort((left, right) => {
        const statusScore = (status: Raffle["status"]) => status === "active" ? 0 : 1;
        const score = statusScore(left.status) - statusScore(right.status);
        if (score !== 0) return score;
        return String(right.drawDate || "").localeCompare(String(left.drawDate || ""));
      })
      .map((raffle, index) => buildRaffleCard(raffle, index, winners))
  ), [raffles, winners]);

  const activeRaffles = raffleCards.filter(card => card.status === "active");
  const completedRaffles = raffleCards.filter(card => card.status === "completed");
  const extraActiveCards = buildExtraActiveCards(fazendinha, modalidades);

  return (
    <main className="cfx-draws-page" aria-label="Sorteios">
      <section className="cfx-draws-hero">
        <div>
          <span className="cfx-draws-eyebrow"><Ticket /> Sorteios</span>
          <h1>Sorteios</h1>
          <p>Escolha uma campanha ativa ou confira os resultados dos sorteios encerrados.</p>
        </div>
        <aside>
          <ShieldCheck />
          <strong>100% Seguro</strong>
          <small>Participação protegida e resultados organizados por campanha.</small>
        </aside>
      </section>

      <div className="cfx-draw-tabs" aria-label="Resumo dos sorteios">
        <a href="#ativos" className="is-active"><Target /> Ativos</a>
        <a href="#encerrados"><Clock3 /> Encerrados</a>
      </div>

      <DrawSection id="ativos" title="Sorteios Ativos" subtitle="Participe agora e concorra.">
        {loadingRaffles ? (
          <DrawSkeleton />
        ) : (
          <>
            {[...activeRaffles, ...extraActiveCards].map(card => <div key={card.id} className="cfx-draw-card-shell"><DrawCardView card={card} /></div>)}
            {!activeRaffles.length && !extraActiveCards.length && <EmptyDraws text="Nenhum sorteio ativo no momento." />}
          </>
        )}
      </DrawSection>

      <DrawSection id="encerrados" title="Sorteios Encerrados" subtitle="Veja os ganhadores.">
        {completedRaffles.length ? (
          completedRaffles.map(card => <div key={card.id} className="cfx-draw-card-shell"><DrawCardView card={card} /></div>)
        ) : (
          <EmptyDraws text="Nenhum sorteio encerrado publicado ainda." />
        )}
      </DrawSection>
    </main>
  );
}

function buildExtraActiveCards(fazendinha: any, modalidades: any): DrawCard[] {
  const cards: DrawCard[] = [];
  const fazConfig = fazendinha?.config || modalidades?.fazendinha;
  if (fazConfig?.enabled !== false && String(fazConfig?.status || "active") === "active") {
    cards.push({
      id: "fazendinha",
      title: safeText(fazConfig.name, "Fazendinha da Sorte"),
      subtitle: safeText(fazConfig.description, "Escolha seus grupos especiais."),
      href: "/fazendinha",
      mediaUrl: safeText(fazConfig.mediaUrl || fazConfig.imageUrl, "/fazendinha-animais-premium.png"),
      mediaType: safeText(fazConfig.mediaType, "image") as Raffle["mediaType"],
      fallbackImageUrl: safeText(fazConfig.mediaUrl || fazConfig.imageUrl, "/fazendinha-animais-premium.png"),
      status: "active",
      badge: "Modalidade",
      price: safeNumber(fazConfig.price || fazConfig.preco),
      progress: 0,
      showProgress: false
    });
  }

  const numberModes = Array.isArray(modalidades?.numberModes) ? modalidades.numberModes : [];
  numberModes
    .filter((mode: any) => mode?.enabled !== false && String(mode?.status || "active") === "active")
    .forEach((mode: any) => {
      cards.push({
        id: `modalidade-${mode.id}`,
        title: safeText(mode.name, String(mode.id || "Modalidade").toUpperCase()),
        subtitle: safeText(mode.description, safeText(mode.prize, "Escolha sua modalidade.")),
        href: `/${mode.id}`,
        mediaUrl: safeText(mode.mediaUrl || mode.imageUrl, ""),
        mediaType: safeText(mode.mediaType, "image") as Raffle["mediaType"],
        fallbackImageUrl: safeText(mode.mediaUrl || mode.imageUrl, ""),
        status: "active",
        badge: "Modalidade",
        price: safeNumber(mode.price),
        progress: 0,
        showProgress: false
      });
    });

  return cards;
}

function DrawSection({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <section id={id} className="cfx-draw-section">
      <header>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <a href={`#${id === "ativos" ? "encerrados" : "ativos"}`}>Ver todos <ArrowRight /></a>
      </header>
      <div className="cfx-draw-list">{children}</div>
    </section>
  );
}

function DrawCardView({ card }: { card: DrawCard }) {
  const isCompleted = card.status === "completed";
  return (
    <article className={cn("cfx-draw-card", isCompleted && "is-completed")}>
      <div className="cfx-draw-media">
        {card.mediaUrl ? (
          <StandardRaffleMediaBlock
            mediaUrl={card.mediaUrl}
            mediaType={card.mediaType || "image"}
            fallbackImageUrl={card.fallbackImageUrl || card.mediaUrl}
            title={card.title}
            href={card.href}
            showDescriptionBelow={false}
            aspectMode="horizontal"
            className="cfx-draw-media-block"
          />
        ) : (
          <div className="cfx-draw-media-fallback"><Gift /></div>
        )}
        <span className="cfx-draw-badge">{isCompleted ? <CheckCircle2 /> : <Star />}{card.badge}</span>
      </div>

      <div className="cfx-draw-body">
        <div className="cfx-draw-title">
          <h3>{card.title}</h3>
          <p>{card.subtitle}</p>
        </div>

        <div className="cfx-draw-meta">
          {card.drawDate && <span><small>Sorteio</small><strong>{formatDate(card.drawDate)}</strong></span>}
          {card.price && !isCompleted && <span><small>Valor</small><strong>{formatCurrency(card.price)}</strong></span>}
          {isCompleted && <span><small>Ganhador</small><strong>{card.winnerName || "A divulgar"}</strong></span>}
          {isCompleted && <span><small>Cota vencedora</small><strong>{card.winningTicket || "A divulgar"}</strong></span>}
          {isCompleted && <span><small>Resultado</small><strong>{formatDate(card.winnerDate || card.drawDate)}</strong></span>}
        </div>

        {!isCompleted && card.showProgress !== false && (
          <div className="cfx-draw-progress" aria-label={`Progresso da meta: ${card.progress}%`}>
            <span><i style={{ width: `${card.progress}%` }} /></span>
            <strong>{card.progress}%</strong>
          </div>
        )}

        {isCompleted ? (
          <Link to={card.href} className="cfx-draw-result-button"><Trophy /> Ver resultado</Link>
        ) : (
          <Link to={card.href} className="cfx-draw-participate-button"><Ticket /> Participar</Link>
        )}
      </div>
    </article>
  );
}

function DrawSkeleton() {
  return (
    <>
      <div className="cfx-draw-card cfx-draw-skeleton" />
      <div className="cfx-draw-card cfx-draw-skeleton" />
    </>
  );
}

function EmptyDraws({ text }: { text: string }) {
  return <p className="cfx-draw-empty">{text}</p>;
}
